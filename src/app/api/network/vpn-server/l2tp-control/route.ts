import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Function to execute SSH command using Node.js SSH2 library would be more secure
// But for simplicity and compatibility, we'll use sshpass
// IMPORTANT: Make sure sshpass is installed on the server: apt-get install sshpass

export async function POST(request: NextRequest) {
  try {
    const { 
      action, 
      host, 
      username, 
      password, 
      port = 22,
      // L2TP connection config
      vpnServerIp,
      l2tpUsername,
      l2tpPassword,
      ipsecPsk
    } = await request.json();

    if (!action || !host || !username || !password) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: action, host, username, password'
      }, { status: 400 });
    }

    let command = '';
    let description = '';

    switch (action) {
      case 'configure':
        // Configure L2TP client connection
        if (!vpnServerIp || !l2tpUsername || !l2tpPassword || !ipsecPsk) {
          return NextResponse.json({
            success: false,
            message: 'Missing L2TP config: vpnServerIp, l2tpUsername, l2tpPassword, ipsecPsk required'
          }, { status: 400 });
        }
        
        command = `
# Check and create /dev/ppp if needed (for VPS/Proxmox)
if [ ! -c /dev/ppp ]; then
  echo "Creating /dev/ppp device..."
  sudo mknod /dev/ppp c 108 0 2>/dev/null || echo "Cannot create /dev/ppp, will try to load module"
  sudo chmod 600 /dev/ppp 2>/dev/null
fi &&

# Load PPP kernel modules
sudo modprobe ppp_generic 2>/dev/null || echo "ppp_generic module not available or already loaded" &&
sudo modprobe ppp_async 2>/dev/null || true &&
sudo modprobe ppp_deflate 2>/dev/null || true &&
sudo modprobe ppp_mppe 2>/dev/null || true &&

# Configure IPSec (MikroTik-compatible encryption)
sudo bash -c "cat > /etc/ipsec.conf << 'EOF'
config setup
    uniqueids=never

conn %default
    ikelifetime=60m
    keylife=20m
    rekeymargin=3m
    keyingtries=%forever
    authby=secret

conn L2TP-PSK
    keyexchange=ikev1
    authby=secret
    left=%defaultroute
    auto=start
    right=${vpnServerIp}
    type=transport
    leftprotoport=17/1701
    rightprotoport=17/1701
    ike=3des-sha1-modp1024,aes256-sha1-modp1024,aes128-sha1-modp1024
    esp=3des-sha1,aes256-sha1,aes128-sha1
EOF
" && 

# Configure IPSec secrets
sudo bash -c "cat > /etc/ipsec.secrets << 'EOF'
%any %any : PSK \\"${ipsecPsk}\\"
EOF
" && 
sudo chmod 600 /etc/ipsec.secrets &&

# Configure xl2tpd
sudo bash -c "cat > /etc/xl2tpd/xl2tpd.conf << 'EOF'
[global]
port = 1701
access control = no

[lac vpn-server]
lns = ${vpnServerIp}
require chap = yes
refuse pap = yes
require authentication = yes
name = ${l2tpUsername}
ppp debug = yes
pppoptfile = /etc/ppp/options.l2tpd.client
length bit = yes
autodial = yes
redial = yes
redial timeout = 15
EOF
" &&

# IMPORTANT: Configure CHAP secrets for authentication
# This file must contain the username and password for CHAP authentication
sudo bash -c "cat > /etc/ppp/chap-secrets << 'EOF'
# Secrets for authentication using CHAP
# client        server  secret                  IP addresses
${l2tpUsername} * ${l2tpPassword} *
EOF
" &&
sudo chmod 600 /etc/ppp/chap-secrets &&

# Configure PPP options
# NOTE: Do NOT include 'name', 'password', or 'plugin pppol2tp.so' here
# These settings are already handled by xl2tpd.conf and would cause conflicts
sudo bash -c "cat > /etc/ppp/options.l2tpd.client << 'EOF'
ipcp-accept-local
ipcp-accept-remote
refuse-eap
require-mschap-v2
noccp
noauth
nodefaultroute
usepeerdns
debug
connect-delay 5000
EOF
" &&
sudo chmod 600 /etc/ppp/options.l2tpd.client &&

# Stop services first
sudo systemctl stop xl2tpd 2>/dev/null || true &&
sudo systemctl stop strongswan-starter 2>/dev/null || true &&
sleep 1 &&

# Start IPSec first
sudo systemctl start strongswan-starter &&
sudo ipsec restart 2>/dev/null || true &&
sleep 3 &&

# Start xl2tpd
sudo systemctl start xl2tpd &&
sleep 2 &&

# Initiate L2TP connection
echo 'c vpn-server' | sudo tee /var/run/xl2tpd/l2tp-control &&
sleep 8 &&

# Check connection status
echo "=== Connection Status ===" &&
echo "Checking PPP interfaces..." &&
ip addr show | grep -A3 "ppp" || echo "No PPP interface up yet" &&
echo "" &&
echo "Checking IPSec connection..." &&
sudo ipsec statusall 2>/dev/null | grep -A5 "L2TP-PSK" || echo "IPSec not connected" &&
echo "" &&
echo "Recent logs:" &&
sudo journalctl -u xl2tpd -n 15 --no-pager | tail -10 &&
echo "" &&
echo "If PPP interface is up, connection is successful!" &&
echo "If not, check: sudo journalctl -u xl2tpd -n 30"
`;
        description = 'Configuring and connecting L2TP client';
        break;
      case 'start':
        command = 'sudo systemctl start strongswan-starter && sleep 1 && sudo systemctl start xl2tpd && sleep 2 && echo "c vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control && echo "Services started and L2TP connection initiated"';
        description = 'Starting L2TP/IPSec services and initiating connection';
        break;
      case 'stop':
        command = 'echo "d vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control 2>/dev/null; sudo systemctl stop xl2tpd && sudo systemctl stop strongswan-starter && echo "L2TP disconnected and services stopped"';
        description = 'Disconnecting L2TP and stopping services';
        break;
      case 'restart':
        command = 'echo "d vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control 2>/dev/null; sudo systemctl restart strongswan-starter && sleep 2 && sudo systemctl restart xl2tpd && sleep 2 && echo "c vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control && echo "Services restarted and L2TP reconnected"';
        description = 'Restarting L2TP/IPSec and reconnecting';
        break;
      case 'status':
        command = 'systemctl is-active strongswan-starter 2>/dev/null || echo "inactive"; systemctl is-active xl2tpd 2>/dev/null || echo "inactive"; ip addr show | grep -A2 "ppp.*UP" | grep "inet " | head -1 || echo "Not connected"';
        description = 'Checking L2TP/IPSec status';
        break;
      case 'enable':
        command = 'sudo systemctl enable strongswan-starter && sudo systemctl enable xl2tpd && sudo systemctl start strongswan-starter && sleep 1 && sudo systemctl start xl2tpd && sleep 2 && echo "c vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control && echo "Services enabled, started, and L2TP connected"';
        description = 'Enabling, starting, and connecting L2TP/IPSec';
        break;
      case 'disable':
        command = 'echo "d vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control 2>/dev/null; sudo systemctl disable strongswan-starter && sudo systemctl disable xl2tpd && sudo systemctl stop strongswan-starter && sudo systemctl stop xl2tpd && echo "L2TP disconnected, services disabled and stopped"';
        description = 'Disconnecting, disabling and stopping L2TP/IPSec';
        break;
      case 'logs':
        command = 'sudo journalctl -u strongswan-starter -u xl2tpd --no-pager -n 50 --reverse 2>/dev/null; echo "---PPP Logs---"; sudo tail -50 /var/log/syslog 2>/dev/null | grep -E "pppd|xl2tpd|charon" || echo "No recent L2TP/PPP logs"';
        description = 'Fetching L2TP/IPSec logs';
        break;
      case 'connections':
        command = 'sudo ipsec statusall 2>/dev/null; echo "---L2TP Connections---"; ip addr show | grep -A3 "ppp.*UP" || echo "No PPP interface up"; echo "---Active Sessions---"; sudo ss -tnp | grep -E "xl2tpd|pluto|1701" || echo "No active L2TP sessions"';
        description = 'Listing active VPN connections';
        break;
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Supported: configure, start, stop, restart, status, enable, disable, logs, connections'
        }, { status: 400 });
    }

    // Execute SSH command with proper escaping
    // Use base64 encoding for password to avoid escaping issues
    const passwordBase64 = Buffer.from(password).toString('base64');
    
    // Escape command properly - use single quotes for the entire command
    const escapedCommand = command.replace(/'/g, "'\"'\"'");
    
    // Build SSH command with base64-encoded password
    const sshCommand = `echo '${passwordBase64}' | base64 -d | sshpass ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -p ${port} ${username}@${host} '${escapedCommand}'`;
    
    console.log('[L2TP Control] Executing action:', action);
    console.log('[L2TP Control] Target:', `${username}@${host}:${port}`);
    
    try {
      const { stdout, stderr } = await execPromise(sshCommand, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
        shell: '/bin/bash'
      });

      // Parse status output if it's a status check
      let parsedResult: any = {
        output: stdout || stderr || 'Command executed successfully',
        rawOutput: stdout,
        rawError: stderr
      };

      if (action === 'status') {
        const lines = stdout.trim().split('\n');
        parsedResult = {
          xl2tpd: lines[1]?.trim() === 'active' ? { active: true, status: 'running' } : { active: false, status: 'stopped' },
          ipsec: lines[0]?.trim() === 'active' ? { active: true, status: 'running' } : { active: false, status: 'stopped' },
          connection: lines[2]?.includes('inet') ? lines[2].trim() : 'Not connected',
          isRunning: lines[0]?.trim() === 'active' && lines[1]?.trim() === 'active'
        };
      } else if (action === 'connections') {
        parsedResult.connections = stdout.trim() || 'No active connections';
      } else if (action === 'logs') {
        const logLines = stdout.split('\n').filter(line => line.trim());
        parsedResult.logs = logLines.length > 0 ? logLines : ['No logs available'];
      }

      return NextResponse.json({
        success: true,
        message: `${description} - Success`,
        action,
        result: parsedResult
      });

    } catch (execError: any) {
      console.error('SSH Command Error:', execError);
      
      // Check if it's a connection error
      if (execError.message.includes('Connection refused') || execError.message.includes('Connection timed out')) {
        return NextResponse.json({
          success: false,
          message: `Cannot connect to ${host}:${port}. Check SSH service and firewall.`,
          error: 'Connection failed'
        }, { status: 500 });
      }

      // Check if it's authentication error
      if (execError.message.includes('Permission denied') || execError.message.includes('Authentication failed')) {
        return NextResponse.json({
          success: false,
          message: 'Authentication failed. Check username and password.',
          error: 'Authentication failed'
        }, { status: 401 });
      }

      // Check if sshpass is not installed
      if (execError.message.includes('sshpass: command not found')) {
        return NextResponse.json({
          success: false,
          message: 'SSH client (sshpass) not installed on server. Please install: apt-get install sshpass',
          error: 'Missing dependency'
        }, { status: 500 });
      }
      
      return NextResponse.json({
        success: false,
        message: `${description} - Failed: ${execError.message}`,
        error: execError.message,
        output: execError.stdout,
        errorOutput: execError.stderr
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('L2TP Control Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error.message
    }, { status: 500 });
  }
}
