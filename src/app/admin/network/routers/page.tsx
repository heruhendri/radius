'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import { Server, Plus, Trash2, Edit, CheckCircle, XCircle, Copy, Loader2, Shield, Radio, Wifi, Activity, RefreshCw, Settings } from 'lucide-react';
import Swal from 'sweetalert2';

interface Router {
  id: string
  name: string
  nasname: string
  shortname: string
  type: string
  ipAddress: string
  username: string
  password: string
  port: number
  apiPort: number
  secret: string
  ports: number
  server?: string
  community?: string
  description?: string
  vpnClientId?: string
  vpnClient?: {
    id: string
    name: string
    vpnIp: string
  }
  isActive: boolean
  createdAt: string
}

interface RouterStatus {
  online: boolean
  identity?: string
  uptime?: string
}

interface VpnClient {
  id: string
  name: string
  vpnIp: string
  isRadiusServer: boolean
}

export default function RouterPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [routers, setRouters] = useState<Router[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, RouterStatus>>({})
  const [vpnClients, setVpnClients] = useState<VpnClient[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingRouter, setEditingRouter] = useState<Router | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    nasname: '',
    shortname: '',
    type: 'mikrotik',
    ipAddress: '',
    username: '',
    password: '',
    port: '8728',
    apiPort: '8729',
    secret: 'secret123',
    ports: '1812',
    server: '',
    community: '',
    description: '',
    vpnClientId: '',
  })
  const [useVpnClient, setUseVpnClient] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    identity?: string
  } | null>(null)
  const [testing, setTesting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [settingUpIsolir, setSettingUpIsolir] = useState<string | null>(null)
  const [settingUpRadius, setSettingUpRadius] = useState<string | null>(null)

  useEffect(() => {
    loadRouters()
  }, [])

  const loadRouters = async () => {
    try {
      const response = await fetch('/api/network/routers')
      const data = await response.json()
      setRouters(data.routers || [])
      setVpnClients(data.vpnClients || [])

      if (data.routers && data.routers.length > 0) {
        checkRoutersStatus(data.routers.map((r: Router) => r.id))
      }
    } catch (error) {
      console.error('Failed to load routers:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkRoutersStatus = async (routerIds: string[]) => {
    try {
      const response = await fetch('/api/network/routers/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerIds }),
      })

      if (response.ok) {
        const data = await response.json()
        setStatusMap(data.statusMap || {})
      }
    } catch (error) {
      console.error('Check status error:', error)
    }
  }

  const handleVpnClientChange = (vpnClientId: string) => {
    setFormData({ ...formData, vpnClientId })

    if (vpnClientId) {
      const vpnClient = vpnClients.find(v => v.id === vpnClientId)
      if (vpnClient) {
        setFormData(prev => ({
          ...prev,
          vpnClientId,
          ipAddress: vpnClient.vpnIp,
          nasname: vpnClient.vpnIp,
        }))
      }
    }
  }

  const handleTestConnection = async () => {
    const isGateway = formData.type === 'gateway' || formData.name.toLowerCase().includes('gateway')

    if (!isGateway && (!formData.ipAddress || !formData.username || !formData.password)) {
      showError(t('network.fillIpUsernamePassword'))
      return
    }

    if (isGateway && !formData.ipAddress) {
      showError(t('network.fillIpAddress'))
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      if (isGateway) {
        const response = await fetch('/api/network/routers/test-gateway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ipAddress: formData.ipAddress }),
        })

        const result = await response.json()
        setTestResult(result)

        if (result.success) {
          showSuccess(t('network.gatewayReachableMsg').replace('{message}', result.message))
        } else {
          showError(result.message)
        }
        return
      }

      const response = await fetch('/api/network/routers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: formData.ipAddress,
          username: formData.username,
          password: formData.password,
          port: parseInt(formData.port) || 8728,
        }),
      })

      const result = await response.json()
      setTestResult(result)

      if (result.success) {
        showSuccess(t('network.connectionSuccessfulTo').replace('{identity}', result.identity))
      } else {
        showError(result.message)
      }
    } catch (error: any) {
      showError(error.message || t('network.failedTestConnection'))
      setTestResult({ success: false, message: error.message || t('network.failedTestConnection') })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingRouter && !testResult?.success) {
      showError(t('network.testConnectionFirst'))
      return
    }

    setCreating(true)

    try {
      const url = '/api/network/routers'
      const method = editingRouter ? 'PUT' : 'POST'
      const body = editingRouter ? { ...formData, id: editingRouter.id } : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess(editingRouter ? 'Router Updated!' : 'Router Created!')
        setShowModal(false)
        setEditingRouter(null)
        resetForm()
        loadRouters()
      } else {
        showError(data.error || 'Failed to save router')
      }
    } catch (error: any) {
      showError(error.message || 'Failed to save router')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', nasname: '', shortname: '', type: 'mikrotik', ipAddress: '', username: '', password: '',
      port: '8728', apiPort: '8729', secret: 'secret123', ports: '1812', server: '', community: '', description: '', vpnClientId: '',
    })
    setTestResult(null)
    setUseVpnClient(false)
  }

  const handleEdit = (routerData: Router) => {
    setEditingRouter(routerData)
    setFormData({
      name: routerData.name, nasname: routerData.nasname, shortname: routerData.shortname, type: routerData.type,
      ipAddress: routerData.ipAddress, username: routerData.username, password: routerData.password,
      port: routerData.port.toString(), apiPort: routerData.apiPort.toString(), secret: routerData.secret,
      ports: routerData.ports.toString(), server: routerData.server || '', community: routerData.community || '',
      description: routerData.description || '', vpnClientId: routerData.vpnClientId || '',
    })
    setUseVpnClient(!!routerData.vpnClientId)
    setTestResult(null)
    setShowModal(true)
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm(`Are you sure you want to delete "${name}"?`, 'Delete Router?')

    if (!confirmed) return

    try {
      const response = await fetch(`/api/network/routers?id=${id}`, { method: 'DELETE' })

      if (response.ok) {
        showSuccess(t('network.routerDeleted'))
        loadRouters()
      } else {
        showError(t('network.failedDeleteRouter'))
      }
    } catch (error) {
      showError(t('network.failedDeleteRouter'))
    }
  }

  const handleSetupIsolir = async (routerId: string) => {
    setSettingUpIsolir(routerId)

    try {
      const response = await fetch(`/api/network/routers/${routerId}/setup-isolir`, { method: 'POST' })
      const result = await response.json()

      if (response.ok) {
        showSuccess(t('network.isolirSetupCompleteMsg').replace('{message}', result.message) + '\n\n' + t('network.isolirConfig').replace('{profile}', result.config.profile).replace('{rateLimit}', result.config.rateLimit).replace('{poolRange}', result.config.poolRange))
      } else {
        showError(result.error + (result.details ? '\n' + result.details : ''))
      }
    } catch (error) {
      console.error('Setup isolir error:', error)
      showError(t('network.failedSetupIsolir'))
    } finally {
      setSettingUpIsolir(null)
    }
  }

  const handleSetupRadius = async (routerId: string) => {
    setSettingUpRadius(routerId)

    try {
      const response = await fetch(`/api/network/routers/${routerId}/setup-radius`, { method: 'POST' })
      const result = await response.json()

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: t('network.radiusScriptGenerated'),
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 12px; color: #a0aec0;">${t('network.copyScriptBelow')}</p>
              <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0; max-height: 300px; overflow-y: auto; border: 1px solid #334155;">
                <pre id="radius-script" style="color: #10b981; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: monospace;">${result.script}</pre>
              </div>
              <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
                <div style="font-weight: 600; margin-bottom: 8px; color: #00f7ff;">${t('network.configuration')}:</div>
                <div style="font-size: 13px; color: #a0aec0;">
                  <div>${t('network.server')}: <b style="color: #fff;">${result.config.radiusServer}</b> (${result.config.connectionType})</div>
                  <div>${t('network.authAcct')}: <b style="color: #fff;">${result.config.authPort}/${result.config.acctPort}</b></div>
                  <div>${t('network.coa')}: <b style="color: #fff;">${result.config.coaPort}</b></div>
                  <div>${t('network.secret')}: <b style="color: #fff;">${result.config.radiusSecret}</b></div>
                </div>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonColor: '#00f7ff',
          cancelButtonColor: '#6b7280',
          confirmButtonText: t('network.copyScript'),
          cancelButtonText: t('network.close'),
          background: '#0f0624',
          color: '#fff',
          width: '600px',
        }).then((swalResult) => {
          if (swalResult.isConfirmed) {
            navigator.clipboard.writeText(result.script)
            Swal.fire({ icon: 'success', title: t('network.scriptCopied'), text: t('network.pasteToTerminal'), timer: 2000, showConfirmButton: false, background: '#0f0624', color: '#fff' })
          }
        })
      } else {
        showError(result.error + (result.details ? '\n' + result.details : ''))
      }
    } catch (error) {
      console.error('Setup RADIUS error:', error)
      showError(t('network.failedGenerateRadiusScript'))
    } finally {
      setSettingUpRadius(null)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showSuccess(t('network.copiedToClipboard').replace('{label}', label))
  }

  // Stats
  const totalRouters = routers.length;
  const onlineRouters = Object.values(statusMap).filter(s => s.online).length;
  const mikrotikRouters = routers.filter(r => r.type === 'mikrotik').length;
  const vpnRouters = routers.filter(r => r.vpnClientId).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
          <p className="text-[#00f7ff] font-medium animate-pulse">{t('network.loadingRouters')}</p>
        </div>
      </div>
    )
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
                    <Server className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent">
                    {t('network.routerManagement')}
                  </h1>
                </div>
                <p className="text-[#e0d0ff]/70 ml-14">
                  {t('network.routerManagementDesc')}
                </p>
              </div>
              <button
                onClick={() => { setEditingRouter(null); resetForm(); setShowModal(true) }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                {t('network.addRouter')}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#bc13fe]/30 p-5 hover:border-[#bc13fe]/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('common.totalRouters')}</p>
                  <p className="text-3xl font-bold text-white">{totalRouters}</p>
                </div>
                <div className="p-3 bg-[#bc13fe]/20 rounded-xl group-hover:bg-[#bc13fe]/30 transition-colors">
                  <Server className="w-6 h-6 text-[#bc13fe]" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-green-500/30 p-5 hover:border-green-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('network.online')}</p>
                  <p className="text-3xl font-bold text-green-400">{onlineRouters}</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
                  <Wifi className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#00f7ff]/30 p-5 hover:border-[#00f7ff]/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">MikroTik</p>
                  <p className="text-3xl font-bold text-[#00f7ff]">{mikrotikRouters}</p>
                </div>
                <div className="p-3 bg-[#00f7ff]/20 rounded-xl group-hover:bg-[#00f7ff]/30 transition-colors">
                  <Activity className="w-6 h-6 text-[#00f7ff]" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-5 hover:border-purple-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('common.viaVpn')}</p>
                  <p className="text-3xl font-bold text-purple-400">{vpnRouters}</p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Router List */}
          {routers.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-[#bc13fe]/40 p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#bc13fe]/20 to-[#00f7ff]/20 rounded-2xl flex items-center justify-center">
                <Server className="w-10 h-10 text-[#bc13fe]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('network.noRoutersYet')}</h3>
              <p className="text-[#e0d0ff]/60 mb-8 max-w-md mx-auto">
                {t('network.noRoutersDesc')}
              </p>
              <button
                onClick={() => { setEditingRouter(null); resetForm(); setShowModal(true) }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                {t('network.addFirstRouter')}
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {routers.map((routerData) => {
                const status = statusMap[routerData.id]
                return (
                  <div
                    key={routerData.id}
                    className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-[#bc13fe]/30 rounded-2xl overflow-hidden hover:border-[#00f7ff]/50 hover:shadow-[0_0_40px_rgba(0,247,255,0.15)] transition-all duration-300 group"
                  >
                    {/* Router Header */}
                    <div className="p-6 border-b border-[#bc13fe]/20">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-[#bc13fe]/30 to-[#00f7ff]/30 rounded-xl group-hover:from-[#bc13fe]/40 group-hover:to-[#00f7ff]/40 transition-colors">
                            <Server className="w-7 h-7 text-[#00f7ff]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-bold text-white group-hover:text-[#00f7ff] transition-colors">{routerData.name}</h3>
                              {status?.online ? (
                                <span className="px-3 py-1 text-xs font-bold rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                                  {t('network.online')}
                                </span>
                              ) : (
                                <span className="px-3 py-1 text-xs font-bold rounded-lg bg-red-500/20 border border-red-500/40 text-red-400">
                                  {t('network.offline')}
                                </span>
                              )}
                              {routerData.vpnClient && (
                                <span className="px-3 py-1 text-xs font-bold rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400">
                                  via VPN: {routerData.vpnClient.name}
                                </span>
                              )}
                            </div>
                            <p className="text-[#e0d0ff]/60 text-sm mt-0.5">{routerData.type} • {routerData.nasname}</p>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSetupIsolir(routerData.id)}
                            disabled={settingUpIsolir === routerData.id}
                            className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl hover:bg-amber-500/20 transition-all disabled:opacity-50"
                            title="Setup Isolir Profile"
                          >
                            <Shield className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleSetupRadius(routerData.id)}
                            disabled={settingUpRadius === routerData.id}
                            className="p-2.5 bg-[#00f7ff]/10 border border-[#00f7ff]/30 text-[#00f7ff] rounded-xl hover:bg-[#00f7ff]/20 transition-all disabled:opacity-50"
                            title="Setup RADIUS Client"
                          >
                            <Radio className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(routerData)}
                            className="p-2.5 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 transition-all"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(routerData.id, routerData.name)}
                            className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Router Details */}
                    <div className="p-6">
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        <div>
                          <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.nasName')}</p>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm text-white">{routerData.nasname}</code>
                            <button
                              onClick={() => copyToClipboard(routerData.nasname, 'NAS Name')}
                              className="text-[#e0d0ff]/40 hover:text-[#00f7ff] transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.shortName')}</p>
                          <p className="font-mono text-sm text-white">{routerData.shortname}</p>
                        </div>
                        <div>
                          <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('common.type')}</p>
                          <p className="font-mono text-sm text-white">{routerData.type}</p>
                        </div>
                        <div>
                          <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.apiPort')}</p>
                          <p className="font-mono text-sm text-white">{routerData.port}</p>
                        </div>
                        <div>
                          <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.radiusPort')}</p>
                          <p className="font-mono text-sm text-white">{routerData.ports}</p>
                        </div>
                        <div>
                          <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.radiusSecret')}</p>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm text-white">{'•'.repeat(8)}</code>
                            <button
                              onClick={() => copyToClipboard(routerData.secret, 'RADIUS Secret')}
                              className="text-[#e0d0ff]/40 hover:text-[#00f7ff] transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Status Info */}
                      {status && (status.identity || status.uptime) && (
                        <div className="mt-4 pt-4 border-t border-[#bc13fe]/20 grid grid-cols-2 gap-4">
                          {status.identity && (
                            <div>
                              <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.routerIdentityLabel')}</p>
                              <p className="font-mono text-sm text-white">{status.identity}</p>
                            </div>
                          )}
                          {status.uptime && (
                            <div>
                              <p className="text-[#00f7ff] text-xs uppercase tracking-wider mb-1">{t('network.uptimeLabel')}</p>
                              <p className="font-mono text-sm text-white">{status.uptime}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {routerData.description && (
                        <p className="text-sm text-[#e0d0ff]/60 mt-4">{routerData.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-[#bc13fe]/50 rounded-2xl max-w-lg w-full p-6 shadow-[0_0_50px_rgba(188,19,254,0.3)] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-[#00f7ff] to-[#bc13fe] rounded-lg">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {editingRouter ? t('network.editRouter') : t('network.addNewRouter')}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Router Name */}
                <div>
                  <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.routerName')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                    placeholder={t('network.mainRouterPlaceholder')}
                    required
                  />
                </div>

                {/* Router Type */}
                <div>
                  <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.routerType')} *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                    required
                  >
                    <option value="mikrotik" className="bg-slate-800">{t('network.mikrotikRouter')}</option>
                    <option value="gateway" className="bg-slate-800">{t('network.gatewayVps')}</option>
                    <option value="other" className="bg-slate-800">{t('network.other')}</option>
                  </select>
                </div>

                {/* VPN Client Toggle */}
                <div className="p-4 bg-[#00f7ff]/10 border border-[#00f7ff]/30 rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useVpnClient}
                      onChange={(e) => {
                        setUseVpnClient(e.target.checked)
                        if (!e.target.checked) setFormData({ ...formData, vpnClientId: '' })
                      }}
                      className="w-5 h-5 rounded border-[#bc13fe]/50 bg-slate-900 text-[#00f7ff]"
                    />
                    <div>
                      <span className="text-sm font-medium text-white">{t('network.connectViaVpn')}</span>
                      <p className="text-xs text-[#e0d0ff]/60 mt-0.5">{t('network.useVpnClientIp')}</p>
                    </div>
                  </label>
                </div>

                {/* VPN Client Selector */}
                {useVpnClient && (
                  <div>
                    <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.vpnClient')} *</label>
                    <select
                      value={formData.vpnClientId}
                      onChange={(e) => handleVpnClientChange(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                      required={useVpnClient}
                    >
                      <option value="" className="bg-slate-800">{t('network.selectVpnClient')}</option>
                      {vpnClients.map((vpn) => (
                        <option key={vpn.id} value={vpn.id} className="bg-slate-800">
                          {vpn.name} ({vpn.vpnIp}) {vpn.isRadiusServer ? '★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* IP Address */}
                <div>
                  <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.ipAddress')} *</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value, nasname: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all disabled:opacity-50"
                    placeholder="192.168.88.1"
                    required
                    disabled={useVpnClient && !!formData.vpnClientId}
                  />
                </div>

                {/* Ports */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.apiPort')}</label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                      placeholder="8728"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.apiSslPortLabel')}</label>
                    <input
                      type="number"
                      value={formData.apiPort}
                      onChange={(e) => setFormData({ ...formData, apiPort: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                      placeholder="8729"
                    />
                  </div>
                </div>

                {/* Credentials */}
                {formData.type !== 'gateway' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.username')} *</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                        placeholder="admin"
                        required={formData.type !== 'gateway'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.password')} *</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                        placeholder="••••••••"
                        required={formData.type !== 'gateway' && !editingRouter}
                      />
                    </div>
                  </div>
                )}

                {/* RADIUS Secret */}
                <div>
                  <label className="block text-sm font-medium text-[#00f7ff] mb-2">{t('network.radiusSecret')} *</label>
                  <input
                    type="text"
                    value={formData.secret}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-white placeholder-gray-500 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
                    placeholder="secret123"
                    required
                  />
                </div>

                {/* Test Connection */}
                {!editingRouter && (
                  <div className="p-4 bg-[#bc13fe]/10 border border-[#bc13fe]/30 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white">{t('network.testConnection')}</span>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-lg hover:shadow-[0_0_15px_rgba(0,247,255,0.4)] transition-all disabled:opacity-50 text-sm"
                      >
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {testing ? t('network.testing') : t('common.test')}
                      </button>
                    </div>
                    {testResult && (
                      <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                        <div className="flex items-center gap-2">
                          {testResult.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                          <div>
                            <p className={`text-sm font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                              {testResult.message}
                            </p>
                            {testResult.identity && <p className="text-xs text-green-400 mt-1">{t('network.routerPrefix')}: {testResult.identity}</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingRouter(null); resetForm() }}
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-xl hover:bg-slate-700 transition-all font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,247,255,0.4)] transition-all disabled:opacity-50"
                  >
                    {creating ? t('common.saving') : (editingRouter ? t('network.updateRouter') : t('network.addRouter'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
