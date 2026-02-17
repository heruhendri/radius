import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MikroTikConnection } from '@/lib/mikrotik/routeros'

// POST - Auto setup VPN server (from credentials, not from DB)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { host, username, password, apiPort, subnet, name, serverId } = await request.json()

    console.log('Setup VPN request received:', {
      host,
      username,
      passwordLength: password?.length || 0,
      apiPort,
      subnet,
      name,
      serverId
    })

    // Connect and setup VPN
    const mtik = new MikroTikConnection({
      host,
      username,
      password,
      port: parseInt(apiPort) || 8728,
    })

    const result = await mtik.autoSetupVPN(subnet || '10.20.30.0/24')

    if (!result.success) {
      return NextResponse.json(result)
    }

    // Update existing VPN server status (not create new one)
    let vpnServer
    if (serverId) {
      vpnServer = await prisma.vpnServer.update({
        where: { id: serverId },
        data: {
          l2tpEnabled: result.l2tp,
          sstpEnabled: result.sstp,
          pptpEnabled: result.pptp,
        },
      })
    } else {
      // Fallback: create new if serverId not provided (for backward compatibility)
      vpnServer = await prisma.vpnServer.create({
        data: {
          name,
          host,
          username,
          password,
          apiPort: parseInt(apiPort) || 8728,
          subnet: subnet || '10.20.30.0/24',
          l2tpEnabled: result.l2tp,
          sstpEnabled: result.sstp,
          pptpEnabled: result.pptp,
        },
      })
    }

    return NextResponse.json({
      ...result,
      server: vpnServer,
    })
  } catch (error) {
    console.error('VPN setup error:', error)
    return NextResponse.json({
      success: false,
      l2tp: false,
      sstp: false,
      pptp: false,
      message: `Setup failed: ${error}`,
    }, { status: 500 })
  }
}
