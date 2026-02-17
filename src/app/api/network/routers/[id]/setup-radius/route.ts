import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routerId } = await params;

    // Get router details from router table
    const router = await prisma.router.findUnique({
      where: { id: routerId },
      include: {
        vpnClient: true,
      },
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Determine RADIUS server IP based on connection type
    let radiusServerIp = process.env.RADIUS_SERVER_IP || process.env.VPS_IP || '127.0.0.1';

    // LOGIC:
    // - Jika router MENGGUNAKAN VPN Client → pakai VPN IP dari isRadiusServer
    // - Jika router TIDAK menggunakan VPN Client (IP Publik) → pakai IP VPS publik
    
    if (router.vpnClientId && router.vpnClient) {
      // Router terhubung via VPN Client
      const radiusServerVpn = await prisma.vpnClient.findFirst({
        where: { isRadiusServer: true },
      });
      
      if (radiusServerVpn) {
        radiusServerIp = radiusServerVpn.vpnIp;
      }
    }

    // Get RADIUS config from router record
    const radiusSecret = router.secret || 'secret123';
    const radiusAuthPort = router.ports ? parseInt(router.ports.toString()) : 1812;
    const radiusAcctPort = 1813;
    const radiusCOAPort = 3799;

    const comment = 'AIBILL RADIUS - Auto Setup';

    // Generate MikroTik script for copy-paste
    const script = `
# ============================================
# AIBILL RADIUS Setup Script
# Router: ${router.name}
# Generated: ${new Date().toISOString()}
# ============================================

# 1. Hapus RADIUS lama (jika ada)
/radius remove [find where comment~"AIBILL" || comment~"Auto Setup"]

# 2. Tambah RADIUS Server
/radius add address=${radiusServerIp} secret=${radiusSecret} service=ppp,hotspot,login,wireless authentication-port=${radiusAuthPort} accounting-port=${radiusAcctPort} timeout=3s comment="${comment}"

# 3. Enable RADIUS untuk PPP
/ppp aaa set use-radius=yes accounting=yes

# 4. Enable RADIUS Incoming (CoA/Disconnect)
/radius incoming set accept=yes port=${radiusCOAPort}

# 5. Buat IP Pool untuk PPP (jika belum ada)
:if ([:len [/ip pool find name="pool-radius-default"]] = 0) do={
    /ip pool add name=pool-radius-default ranges=10.10.10.2-10.10.10.254 comment="AIBILL RADIUS"
}

# 6. Buat PPP Profile radius-default (jika belum ada)
:if ([:len [/ppp profile find name="radius-default"]] = 0) do={
    /ppp profile add name=radius-default local-address=10.10.10.1 remote-address=pool-radius-default comment="AIBILL RADIUS - Default Profile"
}

# 7. Buat Hotspot User Profile radius-default (jika belum ada)
:if ([:len [/ip hotspot user profile find name="radius-default"]] = 0) do={
    /ip hotspot user profile add name=radius-default shared-users=1 rate-limit=""
}

# 8. Enable RADIUS untuk semua Hotspot Server Profile
/ip hotspot profile set [find] use-radius=yes

# ============================================
# SELESAI! Verifikasi dengan:
# /radius print
# /ppp aaa print
# /radius incoming print
# /ip hotspot user profile print
# ============================================
`.trim();

    // Sync radius-default group to RADIUS database
    try {
      const existingRadiusGroup = await prisma.radgroupreply.findFirst({
        where: {
          groupname: 'radius-default',
          attribute: 'Mikrotik-Group',
        },
      });
      
      if (!existingRadiusGroup) {
        await prisma.radgroupreply.create({
          data: {
            groupname: 'radius-default',
            attribute: 'Mikrotik-Group',
            op: ':=',
            value: 'radius-default',
          },
        });
      }
    } catch (dbError) {
      console.log('RADIUS DB sync skipped');
    }

    return NextResponse.json({
      success: true,
      message: 'Script RADIUS berhasil di-generate. Copy dan paste ke MikroTik Terminal.',
      script,
      config: {
        radiusServer: radiusServerIp,
        authPort: radiusAuthPort.toString(),
        acctPort: radiusAcctPort.toString(),
        coaPort: radiusCOAPort.toString(),
        radiusSecret: radiusSecret,
        connectionType: router.vpnClientId ? 'VPN' : 'Public IP',
      },
    });
  } catch (error: any) {
    console.error('Generate RADIUS script error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate RADIUS script',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
