'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import Swal from 'sweetalert2';
import { Shield, Server, Plus, Pencil, Trash2, Zap, Activity, CheckCircle, XCircle, Settings, Terminal, RefreshCw } from 'lucide-react';

interface VpnServer {
  id: string
  name: string
  host: string
  username: string
  apiPort: number
  subnet: string
  l2tpEnabled: boolean
  sstpEnabled: boolean
  pptpEnabled: boolean
  isActive: boolean
}

export default function VpnServerPage() {
  const { t } = useTranslation();

  const [servers, setServers] = useState<VpnServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<VpnServer | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [settingUpId, setSettingUpId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    identity?: string;
  } | null>(null);

  // L2TP VPN Control States
  const [showL2tpControl, setShowL2tpControl] = useState(false);
  const [l2tpStatus, setL2tpStatus] = useState<any>(null);
  const [l2tpLoading, setL2tpLoading] = useState(false);
  const [l2tpLogs, setL2tpLogs] = useState<string[]>([]);
  const [l2tpConnections, setL2tpConnections] = useState<string>('');

  // Store SSH credentials and L2TP config
  const [savedSshCredentials, setSavedSshCredentials] = useState<{
    host: string;
    port: string;
    username: string;
    password: string;
  } | null>(null);

  const [l2tpConfig, setL2tpConfig] = useState({
    vpnServerIp: '',
    l2tpUsername: '',
    l2tpPassword: '',
    ipsecPsk: '',
  });

  const [formData, setFormData] = useState({
    name: '',
    host: '',
    username: 'admin',
    password: '',
    apiPort: '8728',
    subnet: '10.20.30.0/24',
  });

  useEffect(() => {
    loadServers();
  }, []);

  const handleL2tpAction = async (action: string, server: VpnServer) => {
    let formValues = savedSshCredentials;

    const servicesRunning = l2tpStatus?.xl2tpd?.active && l2tpStatus?.ipsec?.active;

    if (!savedSshCredentials || !servicesRunning) {
      const { value } = await Swal.fire({
        title: 'L2TP Client Control - VPS RADIUS Server',
        html: `
          <div class="space-y-4 text-left">
            <div class="bg-gradient-to-r from-[#bc13fe]/20 to-[#00f7ff]/20 border border-[#bc13fe]/50 rounded-lg p-3 mb-3" style="box-shadow: 0 0 15px rgba(188,19,254,0.2);">
              <p class="text-sm text-gray-200">
                <strong class="text-[#00f7ff]">ℹ️ Info:</strong> Control L2TP client di VPS RADIUS server yang connect ke VPN Server <strong class="text-[#bc13fe]">${server.name}</strong> (${server.host})
              </p>
            </div>
            
            <div class="border-t border-[#bc13fe]/30 pt-3">
              <h4 class="text-sm font-bold text-[#00f7ff] mb-3 flex items-center gap-2">
                <span class="text-[#bc13fe]">🔐</span> SSH Connection (VPS RADIUS Server)
              </h4>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-gray-300 mb-1">VPS IP/Hostname</label>
                  <input id="vps-host" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" placeholder="e.g., 103.67.244.131" value="${savedSshCredentials?.host || ''}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-300 mb-1">SSH Port</label>
                    <input id="vps-port" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" type="number" placeholder="22" value="${savedSshCredentials?.port || '22'}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-300 mb-1">SSH Username</label>
                    <input id="vps-username" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" placeholder="root" value="${savedSshCredentials?.username || 'root'}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-300 mb-1">SSH Password</label>
                  <input id="vps-password" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" type="password" placeholder="VPS password" value="${savedSshCredentials?.password || ''}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                </div>
              </div>
            </div>
            
            <div class="border-t border-[#bc13fe]/30 pt-3">
              <h4 class="text-sm font-bold text-[#00f7ff] mb-3 flex items-center gap-2">
                <span class="text-[#bc13fe]">🌐</span> L2TP Connection Details
              </h4>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-gray-300 mb-1">VPN Server IP</label>
                  <input id="vpn-server-ip" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" placeholder="${server.host}" value="${l2tpConfig.vpnServerIp || server.host}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-300 mb-1">L2TP Username</label>
                  <input id="l2tp-username" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" placeholder="L2TP user" value="${l2tpConfig.l2tpUsername}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-300 mb-1">L2TP Password</label>
                  <input id="l2tp-password" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" type="password" placeholder="L2TP password" value="${l2tpConfig.l2tpPassword}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-300 mb-1">IPSec Pre-Shared Key (PSK)</label>
                  <input id="ipsec-psk" class="w-full px-3 py-2 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all text-sm" type="password" placeholder="IPSec PSK" value="${l2tpConfig.ipsecPsk}" style="box-shadow: 0 0 8px rgba(188,19,254,0.15);">
                </div>
              </div>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Connect & Execute',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#00f7ff',
        cancelButtonColor: '#6b7280',
        background: '#0f0624',
        color: '#fff',
        customClass: {
          popup: 'border border-[#bc13fe]/50 shadow-[0_0_30px_rgba(188,19,254,0.3)]',
          title: 'text-[#00f7ff]',
          htmlContainer: 'overflow-auto max-h-[70vh]',
          confirmButton: 'bg-[#00f7ff] hover:bg-[#00d4e6] text-black font-semibold px-6 py-2.5 rounded-lg shadow-[0_0_20px_rgba(0,247,255,0.4)] hover:shadow-[0_0_30px_rgba(0,247,255,0.6)] transition-all',
          cancelButton: 'bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-all',
        },
        preConfirm: () => {
          const host = (document.getElementById('vps-host') as HTMLInputElement)?.value;
          const port = (document.getElementById('vps-port') as HTMLInputElement)?.value;
          const username = (document.getElementById('vps-username') as HTMLInputElement)?.value;
          const password = (document.getElementById('vps-password') as HTMLInputElement)?.value;
          const vpnServerIp = (document.getElementById('vpn-server-ip') as HTMLInputElement)?.value;
          const l2tpUsername = (document.getElementById('l2tp-username') as HTMLInputElement)?.value;
          const l2tpPassword = (document.getElementById('l2tp-password') as HTMLInputElement)?.value;
          const ipsecPsk = (document.getElementById('ipsec-psk') as HTMLInputElement)?.value;

          if (!host || !username || !password) {
            Swal.showValidationMessage('SSH credentials are required');
            return false;
          }

          if (!vpnServerIp || !l2tpUsername || !l2tpPassword || !ipsecPsk) {
            Swal.showValidationMessage('All L2TP connection details are required');
            return false;
          }

          return { host, port: port || '22', username, password, vpnServerIp, l2tpUsername, l2tpPassword, ipsecPsk };
        }
      });

      if (!value) return;

      setSavedSshCredentials({ host: value.host, port: value.port, username: value.username, password: value.password });
      setL2tpConfig({ vpnServerIp: value.vpnServerIp, l2tpUsername: value.l2tpUsername, l2tpPassword: value.l2tpPassword, ipsecPsk: value.ipsecPsk });

      formValues = { host: value.host, port: value.port, username: value.username, password: value.password };

      if (action !== 'status' && action !== 'logs' && action !== 'connections') {
        setL2tpLoading(true);
        try {
          const configResponse = await fetch('/api/network/vpn-server/l2tp-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'configure',
              host: formValues.host,
              username: formValues.username,
              password: formValues.password,
              port: parseInt(formValues.port) || 22,
              vpnServerIp: value.vpnServerIp,
              l2tpUsername: value.l2tpUsername,
              l2tpPassword: value.l2tpPassword,
              ipsecPsk: value.ipsecPsk,
            }),
          });

          const configResult = await configResponse.json();

          if (configResult.success) {
            showSuccess(t('network.l2tpConfigApplied'));
            setTimeout(() => handleL2tpAction('status', server), 2000);
          } else {
            showError(configResult.message || t('network.configurationFailed'));
          }
        } catch (error: any) {
          showError(t('network.failedConfigureL2tp') + ': ' + error.message);
        } finally {
          setL2tpLoading(false);
        }
        return;
      }
    }

    if (!formValues) return;

    setL2tpLoading(true);

    try {
      const response = await fetch('/api/network/vpn-server/l2tp-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          host: formValues.host,
          username: formValues.username,
          password: formValues.password,
          port: parseInt(formValues.port) || 22,
          vpnServerIp: l2tpConfig.vpnServerIp,
          l2tpUsername: l2tpConfig.l2tpUsername,
          l2tpPassword: l2tpConfig.l2tpPassword,
          ipsecPsk: l2tpConfig.ipsecPsk,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (action === 'status') {
          setL2tpStatus(result.result);
        } else if (action === 'logs') {
          setL2tpLogs(result.result.logs || []);
        } else if (action === 'connections') {
          setL2tpConnections(result.result.connections || '');
        }
        showSuccess(result.message);

        if (action !== 'status' && action !== 'logs' && action !== 'connections') {
          setTimeout(() => handleL2tpAction('status', server), 1000);
        }
      } else {
        showError(result.message || t('network.operationFailed'));
      }
    } catch (error: any) {
      showError(t('network.failedExecuteL2tpCommand') + ': ' + error.message);
    } finally {
      setL2tpLoading(false);
    }
  };

  const loadServers = async () => {
    try {
      const response = await fetch('/api/network/vpn-server');
      const data = await response.json();
      setServers(data.servers || []);
    } catch (error) {
      console.error('Load servers error:', error);
      showError(t('error.loadFailed') || 'Failed to load VPN servers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingServer(null);
    setTestResult(null);
    setFormData({ name: '', host: '', username: 'admin', password: '', apiPort: '8728', subnet: '10.20.30.0/24' });
    setShowModal(true);
  }

  const handleEdit = (server: VpnServer) => {
    setEditingServer(server)
    setTestResult(null)
    setFormData({ name: server.name, host: server.host, username: server.username, password: '', apiPort: server.apiPort.toString(), subnet: server.subnet })
    setShowModal(true)
  }

  const handleTestInModal = async () => {
    if (!formData.host || !formData.username || !formData.password) {
      showError(t('network.fillHostUsernamePassword'))
      return
    }

    setTestingId('modal')
    setTestResult(null)

    try {
      const response = await fetch('/api/network/vpn-server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: formData.host, username: formData.username, password: formData.password, apiPort: parseInt(formData.apiPort) || 8728 }),
      })

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        showSuccess(`Router Identity: ${result.identity}\n${result.message}`, t('network.connectionSuccess'));
      } else {
        showError(result.message, t('network.connectionFailed'));
      }
    } catch (error) {
      const errorResult = { success: false, message: t('network.failedTestConnection') }
      setTestResult(errorResult);
      showError(errorResult.message);
    } finally {
      setTestingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingServer && !testResult?.success) {
      showError(t('network.testConnectionRequired'), t('network.testConnectionRequired'));
      return;
    }

    try {
      if (!editingServer) {
        const setupResponse = await fetch('/api/network/vpn-server/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.name, host: formData.host, username: formData.username, password: formData.password, apiPort: formData.apiPort, subnet: formData.subnet }),
        })

        const setupResult = await setupResponse.json()

        if (setupResult.success) {
          const protocols = [];
          if (setupResult.l2tp) protocols.push('L2TP/IPSec');
          if (setupResult.sstp) protocols.push('SSTP');
          if (setupResult.pptp) protocols.push('PPTP');
          showSuccess(t('network.vpnServerConfigured') + '\n\n' + t('network.protocolsEnabled').replace('{protocols}', protocols.join(', ')), t('network.vpnServerConfigured'));
          setShowModal(false)
          loadServers()
        } else {
          showError(setupResult.message, t('network.setupComplete'));
        }
      } else {
        const response = await fetch('/api/network/vpn-server', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, id: editingServer.id }),
        })

        if (response.ok) {
          showSuccess(t('network.vpnServerUpdated'));
          setShowModal(false)
          loadServers()
        } else {
          showError(t('network.failedUpdateVpnServer'));
        }
      }
    } catch (error) {
      showError(t('common.error'));
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm(t('network.deleteConfirm').replace('{name}', name), t('network.deleteVpnServer'));

    if (confirmed) {
      try {
        const response = await fetch(`/api/network/vpn-server?id=${id}`, { method: 'DELETE' })

        if (response.ok) {
          showSuccess(t('network.vpnServerDeleted'), t('common.deleted'));
          loadServers();
        }
      } catch (error) {
        showError(t('network.failedDeleteVpnServer'));
      }
    }
  }

  const handleTest = async (server: VpnServer) => {
    const { value: password } = await Swal.fire({
      title: t('network.enterPassword'),
      input: 'password',
      inputLabel: `${t('network.mikrotikPassword')} - ${server.name}`,
      inputPlaceholder: t('network.mikrotikPassword'),
      showCancelButton: true,
      background: '#0f0624',
      color: '#fff',
      confirmButtonColor: '#00f7ff',
      inputValidator: (value) => { if (!value) { return t('network.passwordRequired') } }
    })

    if (!password) return

    setTestingId(server.id)

    try {
      const response = await fetch('/api/network/vpn-server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: server.host, username: server.username, password: password, apiPort: server.apiPort }),
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`Router Identity: ${result.identity}\n${result.message}`, t('network.connectionSuccess'));
      } else {
        showError(result.message, t('network.connectionFailed'));
      }
    } catch (error) {
      showError(t('network.failedTestConnection'));
    } finally {
      setTestingId(null)
    }
  }

  const handleSetup = async (server: VpnServer) => {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Auto-Setup VPN Server?',
      html: `
        <div class="text-left text-sm">
          <p class="mb-3 text-gray-300">This will configure:</p>
          <ul class="list-none space-y-2 mb-4">
            <li class="flex items-center gap-2 text-[#00f7ff]"><span class="text-[#bc13fe]">▸</span> L2TP/IPSec Server</li>
            <li class="flex items-center gap-2 text-[#00f7ff]"><span class="text-[#bc13fe]">▸</span> SSTP Server</li>
            <li class="flex items-center gap-2 text-[#00f7ff]"><span class="text-[#bc13fe]">▸</span> PPTP Server</li>
            <li class="flex items-center gap-2 text-[#00f7ff]"><span class="text-[#bc13fe]">▸</span> IP Pool (${server.subnet})</li>
            <li class="flex items-center gap-2 text-[#00f7ff]"><span class="text-[#bc13fe]">▸</span> PPP Profile with DNS</li>
            <li class="flex items-center gap-2 text-[#00f7ff]"><span class="text-[#bc13fe]">▸</span> NAT Masquerade</li>
          </ul>
          <div class="mt-4 pt-4 border-t border-[#bc13fe]/30">
            <label class="block text-sm font-medium text-[#00f7ff] mb-2">MikroTik Password:</label>
            <input id="swal-password-input" type="password" class="w-full px-4 py-2.5 bg-[#1a0f35] border border-[#bc13fe]/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all" placeholder="Enter password..." style="box-shadow: 0 0 10px rgba(188, 19, 254, 0.2);"/>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: t('network.yesSetupNow'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#00f7ff',
      cancelButtonColor: '#6b7280',
      background: '#0f0624',
      color: '#fff',
      customClass: {
        popup: 'border border-[#bc13fe]/50 shadow-[0_0_30px_rgba(188,19,254,0.3)]',
        title: 'text-[#00f7ff]',
        confirmButton: 'bg-[#00f7ff] hover:bg-[#00d4e6] text-black font-semibold px-6 py-2.5 rounded-lg shadow-[0_0_20px_rgba(0,247,255,0.4)] hover:shadow-[0_0_30px_rgba(0,247,255,0.6)] transition-all',
        cancelButton: 'bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-all',
      },
      preConfirm: () => {
        const password = (document.getElementById('swal-password-input') as HTMLInputElement)?.value
        if (!password) { Swal.showValidationMessage(t('network.passwordRequired')); return false }
        return password
      }
    });

    if (result.isConfirmed && result.value) {
      setSettingUpId(server.id)

      try {
        const response = await fetch('/api/network/vpn-server/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serverId: server.id, host: server.host, username: server.username, password: result.value, apiPort: server.apiPort.toString(), subnet: server.subnet, name: server.name }),
        })

        const setupResult = await response.json()

        if (setupResult.success) {
          const protocols = [];
          if (setupResult.l2tp) protocols.push('L2TP/IPSec');
          if (setupResult.sstp) protocols.push('SSTP');
          if (setupResult.pptp) protocols.push('PPTP');
          showSuccess(t('network.vpnServerConfigured') + '\n\n' + t('network.protocolsEnabled').replace('{protocols}', protocols.join(', ')), t('network.setupComplete'));
          loadServers();
        } else {
          showError(setupResult.message, t('network.connectionFailed'));
        }
      } catch (error) {
        showError(t('network.failedSetupVpnServer'));
      } finally {
        setSettingUpId(null)
      }
    }
  }

  // Stats calculations
  const totalServers = servers.length;
  const activeServers = servers.filter(s => s.l2tpEnabled || s.sstpEnabled || s.pptpEnabled).length;
  const l2tpServers = servers.filter(s => s.l2tpEnabled).length;
  const sstpServers = servers.filter(s => s.sstpEnabled).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#00f7ff] border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(0,247,255,0.5)]"></div>
          <p className="text-[#00f7ff] font-medium animate-pulse">{t('network.loadingVpnServers')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#bc13fe]/15 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#00f7ff]/15 rounded-full blur-[100px] animate-pulse delay-700"></div>
          <div className="absolute bottom-0 left-1/2 w-[600px] h-[400px] bg-[#ff44cc]/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 p-6 lg:p-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-xl shadow-[0_0_20px_rgba(188,19,254,0.4)]">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent">
                    {t('network.vpnServerManagement')}
                  </h1>
                </div>
                <p className="text-[#e0d0ff]/70 ml-14">
                  {t('network.vpnServerManagementDesc')}
                </p>
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                {t('network.addVpnServer')}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#bc13fe]/30 p-5 hover:border-[#bc13fe]/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('common.totalServers')}</p>
                  <p className="text-3xl font-bold text-white">{totalServers}</p>
                </div>
                <div className="p-3 bg-[#bc13fe]/20 rounded-xl group-hover:bg-[#bc13fe]/30 transition-colors">
                  <Server className="w-6 h-6 text-[#bc13fe]" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-green-500/30 p-5 hover:border-green-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('network.configured')}</p>
                  <p className="text-3xl font-bold text-green-400">{activeServers}</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#00f7ff]/30 p-5 hover:border-[#00f7ff]/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('network.l2tpEnabled')}</p>
                  <p className="text-3xl font-bold text-[#00f7ff]">{l2tpServers}</p>
                </div>
                <div className="p-3 bg-[#00f7ff]/20 rounded-xl group-hover:bg-[#00f7ff]/30 transition-colors">
                  <Shield className="w-6 h-6 text-[#00f7ff]" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-5 hover:border-purple-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('network.sstpEnabled')}</p>
                  <p className="text-3xl font-bold text-purple-400">{sstpServers}</p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                  <Activity className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Server List */}
          {servers.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-[#bc13fe]/40 p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#bc13fe]/20 to-[#00f7ff]/20 rounded-2xl flex items-center justify-center">
                <Shield className="w-10 h-10 text-[#bc13fe]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('network.noVpnServersYet')}</h3>
              <p className="text-[#e0d0ff]/60 mb-8 max-w-md mx-auto">
                {t('network.noVpnServersDesc')}
              </p>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                {t('network.addFirstVpnServer')}
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#bc13fe]/30 overflow-hidden hover:border-[#00f7ff]/50 hover:shadow-[0_0_40px_rgba(0,247,255,0.15)] transition-all duration-300 group"
                >
                  {/* Server Header */}
                  <div className="p-6 border-b border-[#bc13fe]/20">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-[#bc13fe]/30 to-[#00f7ff]/30 rounded-xl group-hover:from-[#bc13fe]/40 group-hover:to-[#00f7ff]/40 transition-colors">
                          <Server className="w-7 h-7 text-[#00f7ff]" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-[#00f7ff] transition-colors">{server.name}</h3>
                          <p className="text-[#e0d0ff]/60 text-sm mt-0.5">{server.host}:{server.apiPort}</p>
                        </div>
                      </div>

                      {/* Protocol Badges */}
                      <div className="flex flex-wrap gap-2">
                        {server.l2tpEnabled && (
                          <span className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/40 text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                            L2TP/IPSec
                          </span>
                        )}
                        {server.sstpEnabled && (
                          <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                            SSTP
                          </span>
                        )}
                        {server.pptpEnabled && (
                          <span className="px-3 py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/40 text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                            PPTP
                          </span>
                        )}
                        {!server.l2tpEnabled && !server.sstpEnabled && !server.pptpEnabled && (
                          <span className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-bold rounded-lg">
                            {t('network.notConfigured')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Server Details */}
                  <div className="p-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      <div>
                        <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.hostAddress')}</p>
                        <p className="font-mono text-white">{server.host}</p>
                      </div>
                      <div>
                        <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.username')}</p>
                        <p className="font-mono text-white">{server.username}</p>
                      </div>
                      <div>
                        <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.apiPort')}</p>
                        <p className="font-mono text-white">{server.apiPort}</p>
                      </div>
                      <div>
                        <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.vpnSubnet')}</p>
                        <p className="font-mono text-white text-sm">{server.subnet}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleTest(server)}
                        disabled={testingId === server.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 hover:border-[#00f7ff]/50 transition-all disabled:opacity-50"
                      >
                        {testingId === server.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-[#00f7ff]" />
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">{testingId === server.id ? t('network.testing') : t('network.testConnection')}</span>
                      </button>

                      <button
                        onClick={() => handleSetup(server)}
                        disabled={settingUpId === server.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,247,255,0.4)] transition-all disabled:opacity-50"
                      >
                        {settingUpId === server.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        <span className="text-sm">{settingUpId === server.id ? t('network.settingUp') : t('network.autoSetup')}</span>
                      </button>

                      {server.l2tpEnabled && (
                        <button
                          onClick={() => {
                            setShowL2tpControl(true);
                            setEditingServer(server);
                            handleL2tpAction('status', server);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[#bc13fe]/20 border border-[#bc13fe]/50 text-[#bc13fe] rounded-xl hover:bg-[#bc13fe]/30 transition-all"
                        >
                          <Terminal className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('network.l2tpControl')}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleEdit(server)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 hover:border-amber-500/50 transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('common.edit')}</span>
                      </button>

                      <button
                        onClick={() => handleDelete(server.id, server.name)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 hover:border-red-500/50 transition-all ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('common.delete')}</span>
                      </button>
                    </div>
                  </div>
                </div >
              ))
              }
            </div >
          )}
        </div >

        {/* Add/Edit Modal */}
        {
          showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-[#bc13fe]/50 rounded-2xl max-w-lg w-full p-6 shadow-[0_0_50px_rgba(188,19,254,0.3)] max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-lg">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    {editingServer ? t('network.editVpnServer') : t('network.addNewVpnServer')}
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.serverName')}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                      placeholder={t('network.mainVpnServerPlaceholder')}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.hostIp')}</label>
                      <input
                        type="text"
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                        placeholder={t('network.ipAddressPlaceholder')}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.apiPort')}</label>
                      <input
                        type="number"
                        value={formData.apiPort}
                        onChange={(e) => setFormData({ ...formData, apiPort: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                        placeholder={t('network.apiPortPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.username')}</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                        placeholder={t('network.adminPlaceholder')}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.password')}</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                        placeholder={t('network.passwordPlaceholder')}
                        required={!editingServer}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.vpnSubnet')}</label>
                    <input
                      type="text"
                      value={formData.subnet}
                      onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all font-mono"
                      placeholder={t('network.vpnSubnetPlaceholder')}
                      required
                    />
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <div className={`p-4 rounded-xl border ${testResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className={testResult.success ? 'text-green-400' : 'text-red-400'}>
                          {testResult.success ? `Connected: ${testResult.identity}` : testResult.message}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleTestInModal}
                      disabled={testingId === 'modal'}
                      className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 transition-all font-medium disabled:opacity-50"
                    >
                      {testingId === 'modal' ? t('network.testing') : t('network.testConnection')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 transition-all font-medium"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,247,255,0.4)] transition-all"
                    >
                      {editingServer ? t('common.update') : t('common.save')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        }

        {/* L2TP Control Modal */}
        {
          showL2tpControl && editingServer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-[#bc13fe]/50 rounded-2xl max-w-2xl w-full p-6 shadow-[0_0_50px_rgba(188,19,254,0.3)] max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-lg">
                      <Terminal className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">L2TP Control - {editingServer.name}</h2>
                  </div>
                  <button
                    onClick={() => setShowL2tpControl(false)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* L2TP Status */}
                {l2tpStatus && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-slate-900/80 rounded-xl border border-[#bc13fe]/30">
                      <p className="text-[#00f7ff] text-xs uppercase mb-2">{t('network.xl2tpdService')}</p>
                      <div className="flex items-center gap-2">
                        {l2tpStatus.xl2tpd?.active ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className={l2tpStatus.xl2tpd?.active ? 'text-green-400' : 'text-red-400'}>
                          {l2tpStatus.xl2tpd?.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/80 rounded-xl border border-[#bc13fe]/30">
                      <p className="text-[#00f7ff] text-xs uppercase mb-2">{t('network.ipsecService')}</p>
                      <div className="flex items-center gap-2">
                        {l2tpStatus.ipsec?.active ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className={l2tpStatus.ipsec?.active ? 'text-green-400' : 'text-red-400'}>
                          {l2tpStatus.ipsec?.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <button
                    onClick={() => handleL2tpAction('status', editingServer)}
                    disabled={l2tpLoading}
                    className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    {l2tpLoading ? 'Loading...' : 'Refresh Status'}
                  </button>
                  <button
                    onClick={() => handleL2tpAction('start', editingServer)}
                    disabled={l2tpLoading}
                    className="px-4 py-2 bg-green-500/20 border border-green-500/40 text-green-400 rounded-xl hover:bg-green-500/30 transition-all disabled:opacity-50"
                  >
                    Start Services
                  </button>
                  <button
                    onClick={() => handleL2tpAction('stop', editingServer)}
                    disabled={l2tpLoading}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-50"
                  >
                    Stop Services
                  </button>
                  <button
                    onClick={() => handleL2tpAction('restart', editingServer)}
                    disabled={l2tpLoading}
                    className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-all disabled:opacity-50"
                  >
                    Restart
                  </button>
                </div>

                {/* Logs */}
                {l2tpLogs.length > 0 && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-[#bc13fe]/30 max-h-60 overflow-y-auto">
                    <p className="text-[#00f7ff] text-xs uppercase mb-2">{t('network.recentLogs')}</p>
                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                      {l2tpLogs.join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )
        }
      </main >
    </>
  );
}
