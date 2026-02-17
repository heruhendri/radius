import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MikroTikConnection } from '@/lib/mikrotik/routeros'

// Helper: Generate random password
function generatePassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Helper: Get next available IP from pool (per server)
async function getNextAvailableIP(vpnServerId: string, subnet: string): Promise<string> {
  const [network] = subnet.split('/')
  const parts = network.split('.')
  const baseNetwork = `${parts[0]}.${parts[1]}.${parts[2]}`

  // Get all used IPs for THIS server only
  const clients = await prisma.vpnClient.findMany({
    where: { vpnServerId },
    select: { vpnIp: true },
  })
  const usedIPs = new Set(clients.map((c: { vpnIp: string }) => c.vpnIp))

  // Find first available IP (starting from .10)
  for (let i = 10; i <= 254; i++) {
    const ip = `${baseNetwork}.${i}`
    if (!usedIPs.has(ip)) {
      return ip
    }
  }

  throw new Error('No available IP in pool')
}

// Helper: Get next available Winbox port (sequential in limited range for Docker port mapping)
async function getNextWinboxPort(vpnServerId: string): Promise<number> {
  const MIN_PORT = 10000
  const MAX_PORT = 10100  // Limited range for easier Docker port mapping
  
  const clients = await prisma.vpnClient.findMany({
    where: { vpnServerId },
    select: { winboxPort: true },
  })

  const usedPorts = new Set(clients.map((c: { winboxPort: number | null }) => c.winboxPort).filter((p: number | null) => p !== null) as number[])
  
  // Find first available port in range
  for (let port = MIN_PORT; port <= MAX_PORT; port++) {
    if (!usedPorts.has(port)) {
      return port
    }
  }

  throw new Error(`No available ports in range ${MIN_PORT}-${MAX_PORT}. Please expand Docker port mapping.`)
}

// GET - Load all VPN clients
export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const clients = await prisma.vpnClient.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const vpnServers = await prisma.vpnServer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      clients,
      vpnServers,
    })
  } catch (error) {
    console.error('Load clients error:', error)
    return NextResponse.json({
      error: 'Failed to load clients',
      clients: [],
      vpnServers: [],
    }, { status: 500 })
  }
}

// POST - Create new VPN client
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { name, description, vpnServerId } = await request.json()

    // Validate VPN server ID
    if (!vpnServerId) {
      return NextResponse.json(
        { error: 'VPN Server selection is required' },
        { status: 400 }
      )
    }

    // Get VPN server config
    const vpnServer = await prisma.vpnServer.findUnique({
      where: { id: vpnServerId },
    })

    if (!vpnServer) {
      return NextResponse.json(
        { error: 'Selected VPN Server not found' },
        { status: 404 }
      )
    }

    // Generate credentials
    const username = `vpn-${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`
    const password = generatePassword(12)
    const apiUsername = `api-${name.toLowerCase().replace(/\s+/g, '-')}`
    const apiPassword = generatePassword(16)
    
    // Get available IP and port FOR THIS SERVER
    const vpnIp = await getNextAvailableIP(vpnServerId, vpnServer.subnet)
    const winboxPort = await getNextWinboxPort(vpnServerId)

    console.log('Creating VPN client:', { username, vpnIp, winboxPort })

    // Connect to CHR
    const mtik = new MikroTikConnection({
      host: vpnServer.host,
      username: vpnServer.username,
      password: vpnServer.password,
      port: vpnServer.apiPort,
    })

    await mtik.connect()

    // 1. Add PPP secret
    await mtik.execute('/ppp/secret/add', [
      `=name=${username}`,
      `=password=${password}`,
      '=service=any',
      '=profile=vpn-profile',
      `=remote-address=${vpnIp}`,
      `=comment=AIBILL-${name}`,
    ])

    console.log('PPP secret created')

    // 2. Add NAT dst-nat for Winbox remote
    await mtik.execute('/ip/firewall/nat/add', [
      '=chain=dstnat',
      '=protocol=tcp',
      `=dst-port=${winboxPort}`,
      '=action=dst-nat',
      `=to-addresses=${vpnIp}`,
      '=to-ports=8291',
      `=comment=Winbox-${name}`,
    ])

    console.log('Winbox NAT created:', winboxPort)

    await mtik.disconnect()

    // Save to database
    const client = await prisma.vpnClient.create({
      data: {
        name,
        vpnServerId,
        vpnIp,
        username,
        password,
        description: description || null,
        vpnType: 'L2TP',
        winboxPort,
        apiUsername,
        apiPassword,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      client,
      credentials: {
        server: vpnServer.host,
        username,
        password,
        ipsecSecret: 'aibill-vpn-secret',
        vpnIp,
        winboxPort,
        winboxRemote: `${vpnServer.host}:${winboxPort}`,
        apiUsername,
        apiPassword,
      },
    })
  } catch (error: any) {
    console.error('Create client error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create client' },
      { status: 500 }
    )
  }
}

// PUT - Update VPN client (toggle RADIUS server)
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id, isRadiusServer } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
    }

    // If setting as RADIUS server, unset others first
    if (isRadiusServer) {
      await prisma.vpnClient.updateMany({
        where: { isRadiusServer: true },
        data: { isRadiusServer: false },
      })
    }

    // Update client
    const client = await prisma.vpnClient.update({
      where: { id },
      data: { isRadiusServer },
    })

    return NextResponse.json({ success: true, client })
  } catch (error: any) {
    console.error('Update client error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove VPN client
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
    }

    // Get client info
    const client = await prisma.vpnClient.findUnique({ where: { id } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get VPN server config (from client's server)
    const vpnServer = await prisma.vpnServer.findUnique({
      where: { id: client.vpnServerId },
    })

    if (vpnServer) {
      try {
        const mtik = new MikroTikConnection({
          host: vpnServer.host,
          username: vpnServer.username,
          password: vpnServer.password,
          port: vpnServer.apiPort,
        })

        await mtik.connect()

        // 1. Remove PPP secret
        const secrets = await mtik.execute('/ppp/secret/print', [
          `?name=${client.username}`,
        ])

        if (secrets.length > 0) {
          await mtik.execute('/ppp/secret/remove', [
            `=.id=${secrets[0]['.id']}`,
          ])
          console.log('PPP secret removed')
        }

        // 2. Remove NAT rule
        if (client.winboxPort) {
          const natRules = await mtik.execute('/ip/firewall/nat/print', [
            '?chain=dstnat',
            `?dst-port=${client.winboxPort}`,
          ])

          if (natRules.length > 0) {
            await mtik.execute('/ip/firewall/nat/remove', [
              `=.id=${natRules[0]['.id']}`,
            ])
            console.log('NAT rule removed')
          }
        }

        await mtik.disconnect()
      } catch (error) {
        console.error('CHR delete error:', error)
        // Continue to delete from DB even if CHR fails
      }
    }

    // Delete from database
    await prisma.vpnClient.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete client error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
