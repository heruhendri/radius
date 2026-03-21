import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { RouterOSAPI } from 'node-routeros';

// GET - List all active routers (for picker UI)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nasname: true, ipAddress: true, shortname: true, description: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ routers });
  } catch (error) {
    console.error('Get routers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, routerId, ipPoolName, localAddress } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const profile = await prisma.pppoeProfile.findUnique({ where: { id } }) as any;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const rateLimit = profile.rateLimit || `${profile.downloadSpeed}M/${profile.uploadSpeed}M`;
    const resolvedMikrotikProfileName = String(profile.groupName || profile.name).trim();
    const resolvedIpPoolName = typeof ipPoolName === 'string' ? ipPoolName.trim() : (profile.ipPoolName || '');
    const resolvedLocalAddress = typeof localAddress === 'string' ? localAddress.trim() : '';

    if (!resolvedMikrotikProfileName) {
      return NextResponse.json({ error: 'Nama PPP Profile MikroTik wajib diisi' }, { status: 400 });
    }

    // Get router — use specified router or first active router
    const router = routerId
      ? await prisma.router.findUnique({ where: { id: routerId } })
      : await prisma.router.findFirst({ where: { isActive: true } });

    if (!router) {
      return NextResponse.json({ error: 'Tidak ada router aktif ditemukan. Tambahkan router di menu NAS/Router terlebih dahulu.' }, { status: 404 });
    }

    const api = new RouterOSAPI({
      host: router.ipAddress || router.nasname,
      port: router.port || 8728,
      user: router.username,
      password: router.password,
      timeout: 15,
    });

    try {
      // Hard connection timeout — node-routeros "timeout" is idle-only, won't catch unreachable hosts
      await Promise.race([
        api.connect(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection timed out (15s)')), 15000)),
      ]);

      // Fetch all profiles and filter in JS — avoids RouterOS query syntax ambiguity
      const allProfiles = await api.write('/ppp/profile/print');
      const existingProfile = allProfiles.find((p: any) => p['name'] === resolvedMikrotikProfileName);

      const sharedUserLimit = profile.sharedUser ? 'no' : 'yes';

      if (existingProfile) {
        // Update existing profile
        const profileId = existingProfile['.id'];
        const updateParams: string[] = [
          `=.id=${profileId}`,
          `=rate-limit=${rateLimit}`,
          `=only-one=${sharedUserLimit}`,
        ];
        if (resolvedIpPoolName) {
          updateParams.push(`=remote-address=${resolvedIpPoolName}`);
        }
        if (resolvedLocalAddress) {
          updateParams.push(`=local-address=${resolvedLocalAddress}`);
        }
        await api.write('/ppp/profile/set', updateParams);
      } else {
        // Create new PPP profile
        const createParams: string[] = [
          `=name=${resolvedMikrotikProfileName}`,
          `=rate-limit=${rateLimit}`,
          `=only-one=${sharedUserLimit}`,
          '=use-encryption=default',
          '=change-tcp-mss=default',
        ];
        if (resolvedIpPoolName) {
          createParams.push(`=remote-address=${resolvedIpPoolName}`);
        }
        if (resolvedLocalAddress) {
          createParams.push(`=local-address=${resolvedLocalAddress}`);
        }
        await api.write('/ppp/profile/add', createParams);
      }

      await api.close();

      // Save sync config to DB for 1-click re-sync (non-critical — don't fail sync if DB update fails)
      try {
        await prisma.pppoeProfile.update({
          where: { id },
          data: {
            mikrotikProfileName: resolvedMikrotikProfileName,
            ipPoolName: resolvedIpPoolName || null,
            localAddress: resolvedLocalAddress || null,
            lastRouterId: router.id,
          },
        } as any);
      } catch (dbErr: any) {
        console.warn('[SyncMikroTik] DB update gagal (mungkin migrasi belum dijalankan):', dbErr?.message);
      }

      return NextResponse.json({
        success: true,
        message: `Profile "${profile.name}" berhasil re-sync ke MikroTik ${router.ipAddress || router.nasname} dengan PPP Profile "${resolvedMikrotikProfileName}"${resolvedIpPoolName ? ` dan IP Pool "${resolvedIpPoolName}"` : ''}${resolvedLocalAddress ? ` serta Local IP "${resolvedLocalAddress}"` : ''}`,
        router: { id: router.id, name: router.name || router.nasname, ip: router.ipAddress || router.nasname },
      });
    } catch (mkError: any) {
      try { await api.close(); } catch { /* ignore */ }
      const errMsg = mkError?.message || String(mkError);
      console.error('MikroTik API error:', errMsg);
      return NextResponse.json({
        error: `Gagal ke MikroTik (${router.ipAddress || router.nasname}): ${errMsg}`,
        router: { name: router.name || router.nasname, ip: router.ipAddress || router.nasname },
      }, { status: 502 });
    }
  } catch (error) {
    console.error('Sync MikroTik error:', error);
    return NextResponse.json({ error: 'Gagal sinkronisasi ke MikroTik' }, { status: 500 });
  }
}
