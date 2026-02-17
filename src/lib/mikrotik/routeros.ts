import { RouterOSAPI } from 'node-routeros'

export interface MikroTikConfig {
  host: string
  username: string
  password: string
  port?: number
  timeout?: number
}

export class MikroTikConnection {
  private config: MikroTikConfig
  private conn: RouterOSAPI | null = null

  constructor(config: MikroTikConfig) {
    this.config = {
      ...config,
      port: config.port || 8728,
      timeout: config.timeout || 10000,
    }
  }

  async connect(): Promise<void> {
    const connectionConfig = {
      host: this.config.host,
      user: this.config.username,
      password: this.config.password,
      port: this.config.port,
      timeout: this.config.timeout,
    }
    
    console.log('Connecting to MikroTik with config:', {
      host: connectionConfig.host,
      user: connectionConfig.user,
      port: connectionConfig.port,
      timeout: connectionConfig.timeout,
    })
    
    this.conn = new RouterOSAPI(connectionConfig)

    try {
      await this.conn.connect()
      console.log('MikroTik connection successful!')
    } catch (error) {
      console.error('MikroTik connection error:', error)
      throw new Error(`Failed to connect to MikroTik: ${error}`)
    }
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      await this.conn.close()
      this.conn = null
    }
  }

  // Public method to execute RouterOS commands
  async execute(command: string, params?: string[]): Promise<any> {
    if (!this.conn) {
      throw new Error('Not connected to MikroTik')
    }
    return await this.conn.write(command, params || [])
  }

  async testConnection(): Promise<{ success: boolean; identity?: string; message: string }> {
    try {
      await this.connect()
      
      // Get router identity
      const identity = await this.conn!.write('/system/identity/print')
      const identityName = identity[0]?.name || 'Unknown'

      await this.disconnect()

      return {
        success: true,
        identity: identityName,
        message: 'Connection successful!',
      }
    } catch (error) {
      await this.disconnect()
      return {
        success: false,
        message: `Connection failed: ${error}`,
      }
    }
  }

  async setupL2TPServer(subnet: string): Promise<boolean> {
    try {
      if (!this.conn) await this.connect()

      // Parse subnet to get IP range
      const [network] = subnet.split('/')
      const parts = network.split('.')
      const baseNetwork = `${parts[0]}.${parts[1]}.${parts[2]}`
      const poolRange = `${baseNetwork}.10-${baseNetwork}.254`
      const localAddress = `${baseNetwork}.1`

      console.log('Setting up L2TP with:', { poolRange, localAddress, subnet })

      // Create or update IP Pool
      try {
        await this.conn!.write('/ip/pool/add', [
          '=name=vpn-pool',
          `=ranges=${poolRange}`,
        ])
      } catch (error: any) {
        // If already exists, update it
        const errorMsg = error.message || ''
        if (errorMsg.includes('already exists') || errorMsg.includes('with such name exists')) {
          const pools = await this.conn!.write('/ip/pool/print', ['?name=vpn-pool'])
          if (pools.length > 0) {
            await this.conn!.write('/ip/pool/set', [
              `=.id=${pools[0]['.id']}`,
              `=ranges=${poolRange}`,
            ])
          }
        } else {
          throw error
        }
      }

      // Create or update PPP Profile
      try {
        await this.conn!.write('/ppp/profile/add', [
          '=name=vpn-profile',
          `=local-address=${localAddress}`,
          '=remote-address=vpn-pool',
          '=dns-server=8.8.8.8,8.8.4.4',
        ])
      } catch (error: any) {
        // If already exists, update it
        const errorMsg = error.message || ''
        if (errorMsg.includes('already exists') || errorMsg.includes('with the same name already exists')) {
          const profiles = await this.conn!.write('/ppp/profile/print', ['?name=vpn-profile'])
          if (profiles.length > 0) {
            await this.conn!.write('/ppp/profile/set', [
              `=.id=${profiles[0]['.id']}`,
              `=local-address=${localAddress}`,
              '=remote-address=vpn-pool',
              '=dns-server=8.8.8.8,8.8.4.4',
            ])
          }
        } else {
          throw error
        }
      }

      // Enable L2TP Server (always set, no create needed)
      await this.conn!.write('/interface/l2tp-server/server/set', [
        '=enabled=yes',
        '=default-profile=vpn-profile',
        '=authentication=mschap2',
        '=use-ipsec=yes',
        '=ipsec-secret=aibill-vpn-secret',
      ])

      return true
    } catch (error) {
      console.error('L2TP setup error:', error)
      return false
    }
  }

  async setupSSTPServer(): Promise<boolean> {
    try {
      if (!this.conn) await this.connect()

      // Enable SSTP Server
      await this.conn!.write('/interface/sstp-server/server/set', [
        '=enabled=yes',
        '=default-profile=vpn-profile',
        '=authentication=mschap2',
      ])

      return true
    } catch (error) {
      console.error('SSTP setup error:', error)
      return false
    }
  }

  async setupPPTPServer(): Promise<boolean> {
    try {
      if (!this.conn) await this.connect()

      // Enable PPTP Server
      await this.conn!.write('/interface/pptp-server/server/set', [
        '=enabled=yes',
        '=default-profile=vpn-profile',
        '=authentication=mschap2',
      ])

      return true
    } catch (error) {
      console.error('PPTP setup error:', error)
      return false
    }
  }

  async setupNAT(): Promise<boolean> {
    try {
      if (!this.conn) await this.connect()

      // Add NAT Masquerade
      await this.conn!.write('/ip/firewall/nat/add', [
        '=chain=srcnat',
        '=action=masquerade',
        '=comment=VPN NAT',
      ])

      return true
    } catch (error) {
      console.error('NAT setup error:', error)
      return false
    }
  }

  async autoSetupVPN(subnet: string): Promise<{
    success: boolean
    l2tp: boolean
    sstp: boolean
    pptp: boolean
    message: string
  }> {
    try {
      await this.connect()

      const l2tp = await this.setupL2TPServer(subnet)
      const sstp = await this.setupSSTPServer()
      const pptp = await this.setupPPTPServer()
      await this.setupNAT()

      await this.disconnect()

      return {
        success: l2tp || sstp || pptp,
        l2tp,
        sstp,
        pptp,
        message: 'VPN Server configured successfully!',
      }
    } catch (error) {
      await this.disconnect()
      return {
        success: false,
        l2tp: false,
        sstp: false,
        pptp: false,
        message: `Setup failed: ${error}`,
      }
    }
  }
}
