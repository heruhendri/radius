'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import { Shield, Plus, Trash2, Eye, Loader2, Users, Server, Copy, CheckCircle, XCircle, Wifi, Radio } from 'lucide-react';

interface VpnClient {
  id: string
  name: string
  vpnServerId: string
  vpnIp: string
  username: string
  password: string
  vpnType: string
  description?: string
  winboxPort?: number
  apiUsername?: string
  apiPassword?: string
  isActive: boolean
  isRadiusServer: boolean
  createdAt: string
  vpnServer?: VpnServer
}

interface VpnServer {
  id: string
  host: string
  name: string
}

interface Credentials {
  server: string
  username: string
  password: string
  ipsecSecret: string
  vpnIp: string
  winboxPort: number
  winboxRemote: string
  apiUsername: string
  apiPassword: string
}

export default function VpnClientPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<VpnClient[]>([]);
  const [vpnServers, setVpnServers] = useState<VpnServer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [selectedVpnType, setSelectedVpnType] = useState<'l2tp' | 'sstp' | 'pptp'>('l2tp');
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    vpnServerId: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await fetch('/api/network/vpn-client')
      const data = await response.json()
      setClients(data.clients || [])
      setVpnServers(data.vpnServers || [])
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const response = await fetch('/api/network/vpn-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        setCredentials(result.credentials);
        setShowCredentials(true);
        setShowModal(false);
        loadClients();

        showSuccess(t('network.clientCredentialsDisplayed'), t('network.vpnClientCreated'));
      } else {
        showError(result.error || t('network.failedCreateClient'));
      }
    } catch (error) {
      showError(t('network.anErrorOccurred'));
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      `This will remove "${name}" from CHR and database`,
      'Delete VPN Client?'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/network/vpn-client?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        showSuccess(t('network.deleted'));
        loadClients();
      } else {
        showError(t('network.failedDeleteClient'));
      }
    } catch (error) {
      showError(t('network.anErrorOccurred'));
    }
  }

  const handleToggleRadiusServer = async (clientId: string, isRadiusServer: boolean) => {
    try {
      const response = await fetch('/api/network/vpn-client', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clientId, isRadiusServer }),
      })

      if (response.ok) {
        showSuccess(isRadiusServer ? t('network.setAsRadiusServerSuccess') : t('network.unsetRadiusServerSuccess'));
        loadClients();
      } else {
        showError(t('network.failedUpdateClient'));
      }
    } catch (error) {
      showError(t('network.anErrorOccurred'));
    }
  }

  const viewCredentials = (client: VpnClient) => {
    const server = vpnServers.find(s => s.id === client.vpnServerId)
    if (!server) return

    setCredentials({
      server: server.host,
      username: client.username,
      password: client.password,
      ipsecSecret: 'aibill-vpn-secret',
      vpnIp: client.vpnIp,
      winboxPort: client.winboxPort || 0,
      winboxRemote: `${server.host}:${client.winboxPort}`,
      apiUsername: client.apiUsername || '',
      apiPassword: client.apiPassword || '',
    })
    setSelectedVpnType('l2tp')
    setShowCredentials(true)
  }

  const generateMikroTikScript = () => {
    if (!credentials) return ''

    const scripts: Record<'l2tp' | 'sstp' | 'pptp', string> = {
      l2tp: `# MikroTik VPN Client Configuration (L2TP/IPSec)
# Copy and paste this script to your MikroTik router

# 1. Create API User Group (limited permissions)
/user group add name=api-users policy=read,api,test comment="Limited API Access Group"

# 2. Create API User
/user add name=${credentials.apiUsername} group=api-users password=${credentials.apiPassword} comment="API User for Remote Access"

# 3. Add L2TP Client
/interface l2tp-client
add connect-to=${credentials.server} user=${credentials.username} password=${credentials.password} ipsec-secret=${credentials.ipsecSecret} disabled=no name=vpn-client use-ipsec=yes add-default-route=no allow=mschap2 comment="VPN Connection"

# 4. Assign IP Address (if needed)
# /ip address add address=${credentials.vpnIp}/32 interface=vpn-client

# Configuration Complete!
# Remote Winbox Access: ${credentials.winboxRemote}
# API Username: ${credentials.apiUsername}
# API Password: ${credentials.apiPassword}`,

      sstp: `# MikroTik VPN Client Configuration (SSTP)
# Copy and paste this script to your MikroTik router

# 1. Create API User Group (limited permissions)
/user group add name=api-users policy=read,api,test comment="Limited API Access Group"

# 2. Create API User
/user add name=${credentials.apiUsername} group=api-users password=${credentials.apiPassword} comment="API User for Remote Access"

# 3. Add SSTP Client
/interface sstp-client
add connect-to=${credentials.server} user=${credentials.username} password=${credentials.password} disabled=no name=vpn-client add-default-route=no authentication=mschap2 comment="VPN Connection"

# 4. Assign IP Address (if needed)
# /ip address add address=${credentials.vpnIp}/32 interface=vpn-client

# Configuration Complete!
# Remote Winbox Access: ${credentials.winboxRemote}
# API Username: ${credentials.apiUsername}
# API Password: ${credentials.apiPassword}`,

      pptp: `# MikroTik VPN Client Configuration (PPTP)
# Copy and paste this script to your MikroTik router

# 1. Create API User Group (limited permissions)
/user group add name=api-users policy=read,api,test comment="Limited API Access Group"

# 2. Create API User
/user add name=${credentials.apiUsername} group=api-users password=${credentials.apiPassword} comment="API User for Remote Access"

# 3. Add PPTP Client
/interface pptp-client
add connect-to=${credentials.server} user=${credentials.username} password=${credentials.password} disabled=no name=vpn-client add-default-route=no comment="VPN Connection"

# 4. Assign IP Address (if needed)
# /ip address add address=${credentials.vpnIp}/32 interface=vpn-client

# Configuration Complete!
# Remote Winbox Access: ${credentials.winboxRemote}
# API Username: ${credentials.apiUsername}
# API Password: ${credentials.apiPassword}`
    }

    return scripts[selectedVpnType]
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(t('network.copiedToClipboard'), t('network.copied'));
    } catch (error) {
      showError(t('network.failedCopy'), t('network.copyFailed'));
    }
  };

  // Stats
  const totalClients = clients.length;
  const radiusServers = clients.filter(c => c.isRadiusServer).length;
  const activeClients = clients.filter(c => c.isActive).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
          <p className="text-[#00f7ff] font-medium animate-pulse">{t('network.loadingVpnClients')}</p>
        </div>
      </div>
    );
  }

  if (!vpnServers || vpnServers.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 p-6 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#bc13fe]/15 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#00f7ff]/15 rounded-full blur-[100px]"></div>
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-2 border-amber-500/40 rounded-2xl p-10 text-center backdrop-blur-xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-amber-500/20 rounded-2xl flex items-center justify-center">
              <Shield className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">{t('network.vpnServerNotConfigured')}</h2>
            <p className="text-[#e0d0ff]/70 mb-8">
              {t('network.setupVpnServerFirst')}
            </p>
            <a
              href="/admin/network/vpn-server"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] transition-all duration-300 transform hover:scale-105"
            >
              {t('network.goToVpnServerSetup')}
            </a>
          </div>
        </div>
      </main>
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
                  <div className="p-2.5 bg-gradient-to-br from-[#00f7ff] to-[#bc13fe] rounded-xl shadow-[0_0_20px_rgba(0,247,255,0.4)]">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent">
                    {t('network.vpnClientManagement')}
                  </h1>
                </div>
                <p className="text-[#e0d0ff]/70 ml-14">
                  {t('network.vpnClientManagementDesc')}
                </p>
              </div>
              <button
                onClick={() => {
                  setFormData({ name: '', description: '', vpnServerId: '' })
                  setShowModal(true)
                }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                {t('network.addVpnClient')}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#bc13fe]/30 p-5 hover:border-[#bc13fe]/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('common.totalClients')}</p>
                  <p className="text-3xl font-bold text-white">{totalClients}</p>
                </div>
                <div className="p-3 bg-[#bc13fe]/20 rounded-xl group-hover:bg-[#bc13fe]/30 transition-colors">
                  <Users className="w-6 h-6 text-[#bc13fe]" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#00f7ff]/30 p-5 hover:border-[#00f7ff]/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('network.radiusServer')}</p>
                  <p className="text-3xl font-bold text-[#00f7ff]">{radiusServers}</p>
                </div>
                <div className="p-3 bg-[#00f7ff]/20 rounded-xl group-hover:bg-[#00f7ff]/30 transition-colors">
                  <Radio className="w-6 h-6 text-[#00f7ff]" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-green-500/30 p-5 hover:border-green-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('common.activeClients')}</p>
                  <p className="text-3xl font-bold text-green-400">{activeClients}</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
                  <Wifi className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Clients List */}
          {clients.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-[#bc13fe]/40 p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#bc13fe]/20 to-[#00f7ff]/20 rounded-2xl flex items-center justify-center">
                <Shield className="w-10 h-10 text-[#bc13fe]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('network.noVpnClientsYet')}</h3>
              <p className="text-[#e0d0ff]/60 mb-8 max-w-md mx-auto">
                {t('network.noVpnClientsDesc')}
              </p>
              <button
                onClick={() => {
                  setFormData({ name: '', description: '', vpnServerId: '' })
                  setShowModal(true)
                }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                {t('network.addFirstVpnClient')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-[#bc13fe]/30 rounded-2xl overflow-hidden hover:border-[#00f7ff]/50 hover:shadow-[0_0_30px_rgba(0,247,255,0.15)] transition-all duration-300 group"
                >
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-gradient-to-br from-[#00f7ff]/30 to-[#bc13fe]/30 rounded-lg">
                            <Shield className="w-5 h-5 text-[#00f7ff]" />
                          </div>
                          <h3 className="font-bold text-lg text-white group-hover:text-[#00f7ff] transition-colors">{client.name}</h3>
                          {client.isRadiusServer && (
                            <span className="px-3 py-1 text-xs font-bold rounded-lg bg-[#00f7ff]/20 text-[#00f7ff] border border-[#00f7ff]/50 shadow-[0_0_10px_rgba(0,247,255,0.3)]">
                              {t('network.radiusServer')}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.vpnServer')}</p>
                            <p className="font-medium text-white text-sm">
                              {vpnServers.find(s => s.id === client.vpnServerId)?.name || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.vpnIp')}</p>
                            <p className="font-mono text-white text-sm">{client.vpnIp}</p>
                          </div>
                          <div>
                            <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.username')}</p>
                            <p className="font-mono text-white text-sm">{client.username}</p>
                          </div>
                          {client.winboxPort && (
                            <div>
                              <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.winboxRemote')}</p>
                              <p className="font-mono text-[#00f7ff] text-sm drop-shadow-[0_0_6px_rgba(0,247,255,0.6)]">
                                {vpnServers.find(s => s.id === client.vpnServerId)?.host}:{client.winboxPort}
                              </p>
                            </div>
                          )}
                        </div>

                        {client.description && (
                          <p className="text-sm text-[#e0d0ff]/60 mt-3">{client.description}</p>
                        )}

                        {/* RADIUS Toggle */}
                        <div className="mt-4 pt-4 border-t border-[#bc13fe]/20">
                          <label className="flex items-center gap-3 cursor-pointer w-fit">
                            <input
                              type="checkbox"
                              checked={client.isRadiusServer || false}
                              onChange={(e) => handleToggleRadiusServer(client.id, e.target.checked)}
                              className="w-5 h-5 rounded border-[#bc13fe]/50 bg-slate-900 text-[#00f7ff] focus:ring-[#00f7ff]/50 focus:ring-offset-0"
                            />
                            <span className="text-sm text-[#e0d0ff]/80">
                              {client.isRadiusServer ? t('network.defaultRadiusServer') : t('network.setAsRadiusServer')}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewCredentials(client)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[#00f7ff]/20 border border-[#00f7ff]/40 text-[#00f7ff] rounded-xl hover:bg-[#00f7ff]/30 transition-all"
                          title="View Credentials"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('common.view')}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(client.id, client.name)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('common.delete')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-[#bc13fe]/50 rounded-2xl max-w-lg w-full p-6 shadow-[0_0_50px_rgba(188,19,254,0.3)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-[#00f7ff] to-[#bc13fe] rounded-lg">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{t('network.addVpnClient')}</h2>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#00f7ff] mb-2">
                    {t('network.vpnServer')} <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.vpnServerId}
                    onChange={(e) => setFormData({ ...formData, vpnServerId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                    required
                  >
                    <option value="" className="bg-slate-800">{t('network.selectVpnClient')}</option>
                    {vpnServers.map((server) => (
                      <option key={server.id} value={server.id} className="bg-slate-800">
                        {server.name} ({server.host})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#00f7ff] mb-2">
                    {t('network.clientName')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                    placeholder="e.g., Branch Office A"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#00f7ff] mb-2">
                    {t('network.descriptionOptional')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all resize-none"
                    placeholder={t('network.additionalNotes')}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 transition-all font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,247,255,0.4)] transition-all disabled:opacity-50"
                  >
                    {creating ? t('common.creating') : t('network.createClient')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Credentials Modal */}
        {showCredentials && credentials && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-[#bc13fe]/50 rounded-2xl max-w-4xl w-full p-6 shadow-[0_0_50px_rgba(188,19,254,0.3)] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-[#00f7ff] to-[#bc13fe] rounded-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{t('network.vpnClientCredentials')}</h2>
              </div>

              <div className="space-y-6">
                {/* Credentials Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-gradient-to-br from-[#bc13fe]/10 to-[#00f7ff]/10 border border-[#bc13fe]/30 rounded-xl">
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.vpnServer')}</p>
                    <p className="font-mono text-sm text-white">{credentials.server}</p>
                  </div>
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.vpnIp')}</p>
                    <p className="font-mono text-sm text-white">{credentials.vpnIp}</p>
                  </div>
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.username')}</p>
                    <p className="font-mono text-sm text-white">{credentials.username}</p>
                  </div>
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.password')}</p>
                    <p className="font-mono text-sm text-white">{credentials.password}</p>
                  </div>
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.ipsecSecret')}</p>
                    <p className="font-mono text-sm text-white">{credentials.ipsecSecret}</p>
                  </div>
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.winboxRemote')}</p>
                    <p className="font-mono text-sm text-[#00f7ff] drop-shadow-[0_0_6px_rgba(0,247,255,0.6)]">{credentials.winboxRemote}</p>
                  </div>
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.apiUsername')}</p>
                    <p className="font-mono text-sm text-green-400">{credentials.apiUsername}</p>
                  </div>
                  <div>
                    <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.apiPassword')}</p>
                    <p className="font-mono text-sm text-green-400">{credentials.apiPassword}</p>
                  </div>
                </div>

                {/* VPN Type Selector */}
                <div className="p-5 bg-[#00f7ff]/10 border border-[#00f7ff]/30 rounded-xl">
                  <p className="text-sm font-medium text-[#00f7ff] mb-3 uppercase tracking-wider">
                    {t('network.selectVpnType')}
                  </p>
                  <div className="flex gap-2">
                    {(['l2tp', 'sstp', 'pptp'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedVpnType(type)}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedVpnType === type
                          ? 'bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black shadow-[0_0_20px_rgba(0,247,255,0.4)]'
                          : 'bg-slate-800/60 border border-[#bc13fe]/30 text-[#e0d0ff] hover:bg-[#bc13fe]/20'
                          }`}
                      >
                        {type.toUpperCase()}{type === 'l2tp' && '/IPSec'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MikroTik Script */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-[#00f7ff] uppercase tracking-wider">
                      {t('network.mikrotikConfigScript')}
                    </p>
                    <button
                      onClick={() => copyToClipboard(generateMikroTikScript())}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#bc13fe] to-[#ff44cc] text-white font-bold rounded-lg hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] transition-all text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      {t('network.copyScript')}
                    </button>
                  </div>
                  <pre className="p-5 bg-slate-950 text-green-400 border border-[#bc13fe]/30 rounded-xl text-xs overflow-auto max-h-80 whitespace-pre font-mono">
                    {generateMikroTikScript()}
                  </pre>
                </div>

                {/* Important Notes */}
                <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <h4 className="text-sm font-bold text-amber-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <span>📋</span> {t('network.importantNotes')}
                  </h4>
                  <ul className="text-sm text-[#e0d0ff] space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong className="text-amber-300">{t('network.apiUserGroup')}:</strong> {t('network.limitedPermissions')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong className="text-amber-300">{t('network.vpnConnection')}:</strong> {t('network.noDefaultRoute')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong className="text-amber-300">{t('network.remoteAccess')}:</strong> {t('network.useWinboxVia')} <code className="px-1.5 py-0.5 bg-slate-800 border border-[#00f7ff]/30 rounded text-[#00f7ff]">{credentials.winboxRemote}</code></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span><strong className="text-amber-300">{t('network.apiCredentials')}:</strong> {t('network.forRemoteManagement')}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => setShowCredentials(false)}
                className="w-full mt-6 px-4 py-4 bg-gradient-to-r from-[#bc13fe] to-[#ff44cc] hover:from-[#bc13fe]/90 hover:to-[#ff44cc]/90 rounded-xl transition-all font-bold text-white shadow-[0_0_20px_rgba(188,19,254,0.4)]"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
