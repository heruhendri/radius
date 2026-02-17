'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Server, RefreshCw, Wifi, WifiOff, Search, Loader2, Power, Trash2, Eye, Settings2, CheckCircle, XCircle, RotateCcw, X, Globe, Network, Activity, Smartphone, Monitor, Radio, Edit, Save, Lock, Signal, Thermometer, Info, Shield } from 'lucide-react';
import Swal from 'sweetalert2';
import {
  SimpleModal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalInput,
  ModalSelect,
  ModalLabel,
  ModalButton,
} from '@/components/cyberpunk';

interface GenieACSDevice {
  _id: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  pppoeUsername: string;
  pppoeIP: string;
  tr069IP: string;
  rxPower: string;
  ponMode: string;
  uptime: string;
  status: string;
  lastInform: string | null;
}

interface WLANConfig {
  index: number;
  ssid: string;
  enabled: boolean;
  channel: string;
  standard: string;
  security: string;
  password: string;
  band: string;
  totalAssociations: number;
}

interface ConnectedHost {
  hostName: string;
  ipAddress: string;
  macAddress: string;
  interfaceType: string;
  active: boolean;
  layer2Interface: string;
  ssidIndex: number;
  rssi?: number;
  mode?: string;
  ssidName?: string;
}

interface DeviceDetail {
  _id: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  oui: string;
  pppoeUsername: string;
  pppoeIP: string;
  tr069IP: string;
  rxPower: string;
  txPower: string;
  ponMode: string;
  uptime: string;
  status: string;
  lastInform: string | null;
  macAddress: string;
  softwareVersion: string;
  hardwareVersion: string;
  temp: string;
  voltage: string;
  biasCurrent: string;
  lanIP: string;
  lanSubnet: string;
  dhcpEnabled: string;
  dhcpStart: string;
  dhcpEnd: string;
  dns1: string;
  memoryFree: string;
  memoryTotal: string;
  cpuUsage: string;
  wlanConfigs: WLANConfig[];
  connectedDevices: ConnectedHost[];
  totalConnected: number;
  isDualBand: boolean;
  tags: string[];
}

export default function GenieACSDevicesPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<GenieACSDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit WiFi Modal
  const [showEditWifiModal, setShowEditWifiModal] = useState(false);
  const [editWifiData, setEditWifiData] = useState({
    deviceId: '',
    wlanIndex: 1,
    ssid: '',
    password: '',
    enabled: true
  });
  const [savingWifi, setSavingWifi] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const [devicesRes, settingsRes] = await Promise.all([
        fetch('/api/settings/genieacs/devices'),
        fetch('/api/settings/genieacs')
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setIsConfigured(!!data?.settings?.host);
      }

      if (devicesRes.ok) {
        const data = await devicesRes.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  const handleReboot = async (deviceId: string) => {
    const result = await Swal.fire({
      title: t('genieacs.rebootDevice'),
      text: t('genieacs.rebootWarning'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('genieacs.yesReboot'),
      confirmButtonColor: '#f97316',
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: t('common.sending'), text: t('genieacs.sendingReboot'), allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/reboot`, { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
          Swal.fire({ icon: 'success', title: t('common.success'), text: t('genieacs.rebootSent'), timer: 2000, showConfirmButton: false });
        } else {
          throw new Error(data.error || t('genieacs.failedSendCommand'));
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t('genieacs.failedSendCommand');
        Swal.fire({ icon: 'error', title: t('common.error'), text: msg });
      }
    }
  };

  // Force connection request to execute pending tasks
  const handleForceSync = async (deviceId: string) => {
    try {
      Swal.fire({
        title: t('genieacs.syncDevice'),
        text: t('genieacs.sendingConnectionRequest'),
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const response = await fetch(`/api/genieacs/devices/${encodeURIComponent(deviceId)}/connection-request`, {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok && data.success) {
        Swal.fire({
          icon: 'success',
          title: t('common.success'),
          html: `
            <div class="text-sm">
              <p>${t('genieacs.connectionRequestSent')}</p>
              <p class="text-muted-foreground mt-2">${t('genieacs.deviceWillProcess')}</p>
            </div>
          `,
          timer: 3000,
          showConfirmButton: false
        });
        // Refresh after a short delay
        setTimeout(() => handleRefresh(), 3000);
      } else {
        throw new Error(data.error || t('genieacs.failedSyncDevice'));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('genieacs.failedSyncDevice');
      Swal.fire({ icon: 'error', title: t('common.error'), text: msg });
    }
  };

  const handleDelete = async (deviceId: string) => {
    const result = await Swal.fire({
      title: t('genieacs.deleteDevice'),
      text: t('genieacs.deleteDeviceWarning'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.yesDelete'),
      confirmButtonColor: '#dc2626',
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
        if (response.ok) {
          setDevices(devices.filter(d => d._id !== deviceId));
          Swal.fire({ icon: 'success', title: t('common.success'), text: t('genieacs.deviceDeleted'), timer: 2000, showConfirmButton: false });
        } else {
          throw new Error(t('genieacs.failedDeleteDevice'));
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t('genieacs.failedDeleteDevice');
        Swal.fire({ icon: 'error', title: t('common.error'), text: msg });
      }
    }
  };

  const handleRefreshParameters = async (deviceId: string, serialNumber: string) => {
    const result = await Swal.fire({
      title: t('genieacs.refreshParameters'),
      text: t('genieacs.refreshParametersConfirm').replace('{serial}', serialNumber),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('common.yesRefresh'),
      confirmButtonColor: '#0d9488',
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: t('common.refreshing'), text: t('genieacs.sendingRefreshTask'), allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/refresh`, { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
          Swal.fire({ icon: 'success', title: t('common.success'), text: t('genieacs.refreshTaskSent'), timer: 2000, showConfirmButton: false });
          setTimeout(() => handleRefresh(), 2000);
        } else {
          throw new Error(data.error || t('genieacs.failedSendTask'));
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t('genieacs.failedSendRefresh');
        Swal.fire({ icon: 'error', title: t('common.error'), text: msg });
      }
    }
  };

  const handleViewDetail = async (deviceId: string) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/detail`);
      const data = await response.json();
      if (response.ok && data.success && data.device) {
        setSelectedDevice(data.device);
      } else {
        Swal.fire({ icon: 'error', title: t('common.error'), text: data.error || t('genieacs.failedGetDetail') });
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Error fetching device detail:', error);
      Swal.fire({ icon: 'error', title: t('common.error'), text: t('genieacs.failedGetDetail') });
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedDevice(null);
  };

  // Open Edit WiFi Modal
  const openEditWifiModal = (deviceId: string, wlan?: WLANConfig) => {
    setEditWifiData({
      deviceId,
      wlanIndex: wlan?.index || 1,
      ssid: wlan?.ssid || '',
      password: '',  // Always start empty for security
      enabled: wlan?.enabled ?? true
    });
    setShowEditWifiModal(true);
  };

  const closeEditWifiModal = () => {
    setShowEditWifiModal(false);
    setEditWifiData({
      deviceId: '',
      wlanIndex: 1,
      ssid: '',
      password: '',
      enabled: true
    });
  };

  // Handle WLAN Index Change - Load data untuk WLAN yang dipilih
  const handleWlanIndexChange = (newIndex: number) => {
    const wlan = selectedDevice?.wlanConfigs?.find(w => w.index === newIndex);
    if (wlan) {
      setEditWifiData({
        ...editWifiData,
        wlanIndex: newIndex,
        ssid: wlan.ssid || '',
        password: '', // Always clear password for security
        enabled: wlan.enabled ?? true
      });
    } else {
      // Fallback jika data WLAN tidak ditemukan
      setEditWifiData({
        ...editWifiData,
        wlanIndex: newIndex,
        ssid: '',
        password: '',
        enabled: true
      });
    }
  };

  // Save WiFi Config
  const handleSaveWifi = async () => {
    // Validation
    if (!editWifiData.ssid || editWifiData.ssid.length < 1 || editWifiData.ssid.length > 32) {
      Swal.fire({ icon: 'warning', title: t('genieacs.validationTitle'), text: t('genieacs.ssidLength') });
      return;
    }

    // Trim password untuk cek apakah benar-benar ada isinya
    const trimmedPassword = (editWifiData.password || '').trim();

    // Password validation HANYA jika user benar-benar mengisi password
    if (trimmedPassword.length > 0) {
      if (trimmedPassword.length < 8 || trimmedPassword.length > 63) {
        Swal.fire({
          icon: 'warning',
          title: t('genieacs.passwordValidation'),
          html: `
            <div class="text-left text-sm">
              <p>${t('genieacs.passwordLength')}</p>
              <p class="text-xs text-muted-foreground mt-2">${t('genieacs.currentPasswordLength').replace('{length}', String(trimmedPassword.length))}</p>
              <p class="text-xs text-primary mt-1">💡 ${t('genieacs.leaveEmptyTip')}</p>
            </div>
          `
        });
        return;
      }
    }

    const result = await Swal.fire({
      title: t('genieacs.updateWifiConfig'),
      html: `
        <div class="text-left text-sm">
          <p><strong>SSID:</strong> ${editWifiData.ssid}</p>
          <p><strong>WLAN Index:</strong> ${editWifiData.wlanIndex}</p>
          <p class="text-xs text-muted-foreground mt-2">💡 ${t('genieacs.securityModeNote')}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('common.yesUpdate'),
      confirmButtonColor: '#0d9488',
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      setSavingWifi(true);
      try {
        const response = await fetch(`/api/genieacs/devices/${encodeURIComponent(editWifiData.deviceId)}/wifi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wlanIndex: editWifiData.wlanIndex,
            ssid: editWifiData.ssid,
            password: trimmedPassword.length > 0 ? trimmedPassword : undefined, // Only send if not empty
            enabled: editWifiData.enabled
          })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          const isExecuted = data.taskStatus && data.taskStatus !== 'pending';

          Swal.fire({
            icon: isExecuted ? 'success' : 'info',
            title: isExecuted ? t('common.success') : t('genieacs.taskSent'),
            html: `
              <div class="text-left text-sm space-y-2">
                <p class="text-foreground">${data.message || t('genieacs.wifiConfigSent')}</p>
                ${data.info ? `<p class="${isExecuted ? 'text-success' : 'text-primary'} text-xs">${data.info}</p>` : ''}
                ${data.taskStatus === 'fault' ? `<p class="text-destructive text-xs">⚠️ ${t('genieacs.taskFailed')}</p>` : ''}
                ${data.taskId ? `<p class="text-muted-foreground text-xs font-mono mt-2">Task: ${data.taskId}</p>` : ''}
              </div>
            `,
            showConfirmButton: true,
            confirmButtonText: isExecuted ? 'OK' : t('genieacs.viewTasks'),
            showCancelButton: !isExecuted,
            cancelButtonText: t('common.close'),
            confirmButtonColor: '#0d9488',
            timer: isExecuted ? 3000 : undefined
          }).then((result) => {
            if (result.isConfirmed && !isExecuted) {
              window.location.href = '/admin/genieacs/tasks';
            }
          });
          closeEditWifiModal();
          // Refresh device detail to see changes
          if (selectedDevice) {
            setTimeout(() => handleViewDetail(selectedDevice._id), isExecuted ? 3000 : 5000);
          }
        } else {
          throw new Error(data.error || 'Gagal update WiFi config');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t('genieacs.failedUpdateWifi');
        Swal.fire({ icon: 'error', title: t('common.error'), text: msg });
      } finally {
        setSavingWifi(false);
      }
    }
  };

  const InfoRow = ({ label, value, highlight = false }: { label: string; value: string | null | undefined; highlight?: boolean }) => (
    <div className="flex justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-medium ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value || '-'}
      </span>
    </div>
  );

  const filteredDevices = devices.filter(d =>
    d.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
    d.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
    d.model?.toLowerCase().includes(search.toLowerCase()) ||
    d.pppoeUsername?.toLowerCase().includes(search.toLowerCase()) ||
    d.pppoeIP?.toLowerCase().includes(search.toLowerCase()) ||
    d.tr069IP?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = devices.filter(d => d.status === 'Online').length;
  const offlineCount = devices.filter(d => d.status === 'Offline').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a0f35] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <Loader2 className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        </div>
        <div className="relative z-10 space-y-6">
          <div className="space-y-4">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)] flex items-center gap-3">
                <Server className="w-6 h-6 text-[#00f7ff]" />
                <div>
                  <span>{t('genieacs.devicesTitle')}</span>
                </div>
              </h1>
              <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('genieacs.devicesSubtitle')}</p>
            </div>

            {/* Not Configured */}
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-warning/20 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <Info className="w-8 h-8 text-warning" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">{t('genieacs.notConfigured')}</h2>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
                {t('genieacs.configureFirst')}
              </p>
              <a
                href="/admin/settings/genieacs"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                {t('genieacs.openSettings')}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)] flex items-center gap-2">
              <Server className="w-6 h-6 text-[#00f7ff]" />
              <div>
                <span>{t('genieacs.devicesTitle')}</span>
              </div>
            </h1>
            <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('common.manageCpe')}</p>
            <div className="mt-2">
              <a
                href="/admin/settings/genieacs"
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                {t('genieacs.settings')}
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/20 dark:bg-blue-900/30">
                  <Server className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('common.total')}</p>
                  <p className="text-sm font-semibold">{devices.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-success/20 dark:bg-green-900/30">
                  <Wifi className="w-3 h-3 text-success" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('common.online')}</p>
                  <p className="text-sm font-semibold text-success">{onlineCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-destructive/20 dark:bg-red-900/30">
                  <WifiOff className="w-3 h-3 text-destructive" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('common.offline')}</p>
                  <p className="text-sm font-semibold text-destructive">{offlineCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Devices Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Search & Actions */}
            <div className="p-3 border-b border-border">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('genieacs.searchDevices')}
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-lg bg-card focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  {t('common.refresh')}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('genieacs.serialNumber')}</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('common.model')}</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('genieacs.ipTr069')}</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">PPPoE</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('genieacs.ponMode')}</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('genieacs.rxPower')}</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('common.uptime')}</th>
                    <th className="text-center py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('common.status')}</th>
                    <th className="text-center py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-muted-foreground">
                        <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">{t('genieacs.noDevices')}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('genieacs.devicesWillAppear')}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map((device) => (
                      <tr key={device._id} className="border-b border-border hover:bg-muted/50/50">
                        <td className="py-2 px-2">
                          <div>
                            <p className="font-medium text-foreground">{device.serialNumber || '-'}</p>
                            <p className="text-[10px] text-muted-foreground">{device.manufacturer || '-'}</p>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground dark:text-muted-foreground whitespace-nowrap">{device.model || '-'}</td>
                        <td className="py-2 px-2 font-mono text-[10px] text-muted-foreground dark:text-muted-foreground whitespace-nowrap">{device.tr069IP || '-'}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <div>
                            <p className="text-primary dark:text-primary">{device.pppoeUsername || '-'}</p>
                            {device.pppoeIP && device.pppoeIP !== '-' && (
                              <p className="text-[10px] text-muted-foreground">{device.pppoeIP}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {device.ponMode && device.ponMode !== '-' ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-info/10 text-info rounded">
                              {device.ponMode}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {device.rxPower && device.rxPower !== '-' ? (
                            <span className={`font-medium ${parseFloat(device.rxPower) > -25 ? 'text-success' : parseFloat(device.rxPower) > -28 ? 'text-warning' : 'text-destructive'}`}>
                              {device.rxPower} dBm
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground dark:text-muted-foreground whitespace-nowrap">{device.uptime || '-'}</td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${device.status === 'Online'
                            ? 'bg-success/20 text-success dark:bg-green-900/30 dark:text-success'
                            : 'bg-destructive/20 text-destructive dark:bg-red-900/30 dark:text-destructive'
                            }`}>
                            {device.status === 'Online' ? t('common.online') : t('common.offline')}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleViewDetail(device._id)}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                              title={t('common.details')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRefreshParameters(device._id, device.serialNumber)}
                              className="p-1.5 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded transition-colors"
                              title={t('genieacs.refreshParameters')}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleReboot(device._id)}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors"
                              title={t('common.reboot')}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(device._id)}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Device Detail Modal */}
          {showDetailModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-primary to-violet-500 p-3 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    <div>
                      <h2 className="text-sm font-semibold">{t('genieacs.deviceDetail')}</h2>
                      {selectedDevice && (
                        <p className="text-[10px] text-violet-200">{selectedDevice.serialNumber} - {selectedDevice.model}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDevice && (
                      <>
                        {selectedDevice.isDualBand && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-accent/100">
                            {t('genieacs.dualBand')}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${selectedDevice.status === 'Online' ? 'bg-success/100' : 'bg-destructive/100'}`}>
                          {selectedDevice.status === 'Online' ? t('common.online') : t('common.offline')}
                        </span>
                      </>
                    )}
                    <button onClick={closeDetailModal} className="p-1 hover:bg-white/10 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : selectedDevice ? (
                    <div className="space-y-4">
                      {/* Quick Actions */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleForceSync(selectedDevice._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-blue-600 hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t('genieacs.forceSync')}
                        </button>
                        <button
                          onClick={() => handleRefreshParameters(selectedDevice._id, selectedDevice.serialNumber)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t('genieacs.refreshParameters')}
                        </button>
                        <button
                          onClick={() => handleReboot(selectedDevice._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                        >
                          <Power className="w-3 h-3" />
                          {t('common.reboot')}
                        </button>
                        {selectedDevice.wlanConfigs && selectedDevice.wlanConfigs.length > 0 && (
                          <button
                            onClick={() => openEditWifiModal(selectedDevice._id, selectedDevice.wlanConfigs[0])}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                            {t('genieacs.editWifi')}
                          </button>
                        )}
                      </div>

                      {/* Main Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Device Information */}
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center gap-2 p-2 bg-muted border-b border-border">
                            <Server className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-foreground">{t('genieacs.deviceInformation')}</span>
                          </div>
                          <div className="p-3">
                            <InfoRow label={t('genieacs.serialNumber')} value={selectedDevice.serialNumber} />
                            <InfoRow label={t('genieacs.productClass')} value={selectedDevice.model} />
                            <InfoRow label={t('genieacs.oui')} value={selectedDevice.oui} />
                            <InfoRow label={t('genieacs.manufacturer')} value={selectedDevice.manufacturer} />
                            <InfoRow label={t('genieacs.hardwareVersion')} value={selectedDevice.hardwareVersion} />
                            <InfoRow label={t('genieacs.softwareVersion')} value={selectedDevice.softwareVersion} />
                            <InfoRow label={t('genieacs.macAddress')} value={selectedDevice.macAddress} />
                          </div>
                        </div>

                        {/* Connection Info */}
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center gap-2 p-2 bg-muted border-b border-border">
                            <Globe className="w-3.5 h-3.5 text-success" />
                            <span className="text-xs font-semibold text-foreground">{t('genieacs.connectionInfo')}</span>
                          </div>
                          <div className="p-3">
                            <InfoRow label={t('genieacs.pppoeUsername')} value={selectedDevice.pppoeUsername} highlight />
                            <InfoRow label={t('genieacs.pppoeIp')} value={selectedDevice.pppoeIP} highlight />
                            <InfoRow label={t('genieacs.tr069Ip')} value={selectedDevice.tr069IP} />
                            <InfoRow label={t('common.uptime')} value={selectedDevice.uptime} />
                            <InfoRow label={t('genieacs.lastInform')} value={selectedDevice.lastInform ? new Date(selectedDevice.lastInform).toLocaleString('id-ID') : '-'} />
                            <InfoRow label={t('genieacs.dns')} value={selectedDevice.dns1} />
                          </div>
                        </div>

                        {/* Optical Info */}
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center gap-2 p-2 bg-muted border-b border-border">
                            <Activity className="w-3.5 h-3.5 text-accent" />
                            <span className="text-xs font-semibold text-foreground">{t('genieacs.opticalInfo')}</span>
                          </div>
                          <div className="p-3">
                            <InfoRow label={t('genieacs.ponMode')} value={selectedDevice.ponMode} />
                            <div className="flex justify-between py-1.5 border-b border-border">
                              <span className="text-[11px] text-muted-foreground">{t('genieacs.rxPower')}</span>
                              <span className={`text-[11px] font-medium ${selectedDevice.rxPower && selectedDevice.rxPower !== '-'
                                ? parseFloat(selectedDevice.rxPower) > -25 ? 'text-success' : parseFloat(selectedDevice.rxPower) > -28 ? 'text-warning' : 'text-destructive'
                                : 'text-foreground'
                                }`}>
                                {selectedDevice.rxPower && selectedDevice.rxPower !== '-' ? `${selectedDevice.rxPower} dBm` : '-'}
                              </span>
                            </div>
                            <InfoRow label={t('genieacs.txPower')} value={selectedDevice.txPower && selectedDevice.txPower !== '-' ? `${selectedDevice.txPower} dBm` : '-'} />
                            <InfoRow label={t('genieacs.temperature')} value={selectedDevice.temp && selectedDevice.temp !== '-' ? `${selectedDevice.temp}°C` : '-'} />
                            <InfoRow label={t('genieacs.voltage')} value={selectedDevice.voltage && selectedDevice.voltage !== '-' ? `${selectedDevice.voltage} V` : '-'} />
                          </div>
                        </div>

                        {/* LAN Info */}
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center gap-2 p-2 bg-muted border-b border-border">
                            <Network className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-foreground">{t('genieacs.lanInfo')}</span>
                          </div>
                          <div className="p-3">
                            <InfoRow label={t('genieacs.lanIp')} value={selectedDevice.lanIP} />
                            <InfoRow label={t('genieacs.subnetMask')} value={selectedDevice.lanSubnet} />
                            <InfoRow label={t('genieacs.dhcpEnabled')} value={selectedDevice.dhcpEnabled === 'true' || selectedDevice.dhcpEnabled === '1' ? t('common.yes') : selectedDevice.dhcpEnabled === 'false' || selectedDevice.dhcpEnabled === '0' ? t('common.no') : '-'} />
                            <InfoRow label={t('genieacs.dhcpRange')} value={selectedDevice.dhcpStart && selectedDevice.dhcpEnd && selectedDevice.dhcpStart !== '-' ? `${selectedDevice.dhcpStart} - ${selectedDevice.dhcpEnd}` : '-'} />
                          </div>
                        </div>
                      </div>

                      {/* WiFi SSIDs */}
                      {selectedDevice.wlanConfigs && selectedDevice.wlanConfigs.length > 0 && (
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center justify-between p-2 bg-muted border-b border-border">
                            <div className="flex items-center gap-2">
                              <Radio className="w-3.5 h-3.5 text-info" />
                              <span className="text-xs font-semibold text-foreground">{t('genieacs.wifiNetworks')} ({selectedDevice.wlanConfigs.length})</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{selectedDevice.totalConnected} {t('genieacs.devicesConnected')}</span>
                          </div>
                          <div className="p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {selectedDevice.wlanConfigs.map((wlan, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${wlan.enabled ? 'bg-success/20 dark:bg-green-900/30' : 'bg-muted'}`}>
                                      <Wifi className={`w-3 h-3 ${wlan.enabled ? 'text-success' : 'text-muted-foreground'}`} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-foreground">{wlan.ssid || '-'}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {wlan.band} • Ch {wlan.channel !== '-' ? wlan.channel : t('common.auto')} • {wlan.security || t('common.open')}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${wlan.enabled ? 'bg-success/20 text-success dark:bg-green-900/30 dark:text-success' : 'bg-gray-200 text-muted-foreground dark:bg-inputdark:text-muted-foreground'}`}>
                                        {wlan.enabled ? t('common.on') : t('common.off')}
                                      </span>
                                      {wlan.totalAssociations > 0 && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{wlan.totalAssociations} {t('genieacs.connected')}</p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => openEditWifiModal(selectedDevice._id, wlan)}
                                      className="p-1 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded transition-colors"
                                      title={t('genieacs.editWifi')}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Connected Devices */}
                      {selectedDevice.connectedDevices && selectedDevice.connectedDevices.length > 0 && (
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center justify-between p-2 bg-muted border-b border-border">
                            <div className="flex items-center gap-2">
                              <Smartphone className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-semibold text-foreground">{t('genieacs.connectedDevices')} ({selectedDevice.connectedDevices.length})</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{selectedDevice.connectedDevices.filter(d => d.active).length} {t('common.online').toLowerCase()}</span>
                          </div>
                          <div className="p-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-muted-foreground">{t('genieacs.deviceName')}</th>
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-muted-foreground">{t('genieacs.ipAddress')}</th>
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-muted-foreground">{t('genieacs.macAddress')}</th>
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-muted-foreground">{t('genieacs.interface')}</th>
                                    <th className="text-center py-1.5 px-2 text-[10px] font-semibold text-muted-foreground">{t('genieacs.signal')}</th>
                                    <th className="text-center py-1.5 px-2 text-[10px] font-semibold text-muted-foreground">{t('common.status')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedDevice.connectedDevices.map((host, idx) => {
                                    const isWifi = host.ssidIndex > 0 || host.ssidName;
                                    return (
                                      <tr key={idx} className="border-b border-border last:border-0">
                                        <td className="py-1.5 px-2">
                                          <div className="flex items-center gap-1.5">
                                            {isWifi ? (
                                              <Wifi className="w-3 h-3 text-info" />
                                            ) : (
                                              <Monitor className="w-3 h-3 text-primary" />
                                            )}
                                            <span className="text-foreground">{host.hostName !== '-' ? host.hostName : t('common.unknown')}</span>
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-muted-foreground dark:text-muted-foreground">{host.ipAddress}</td>
                                        <td className="py-1.5 px-2 font-mono text-[10px] text-muted-foreground dark:text-muted-foreground">{host.macAddress}</td>
                                        <td className="py-1.5 px-2 text-muted-foreground dark:text-muted-foreground">
                                          {host.ssidName || (isWifi ? `${t('common.wifi')} ${host.ssidIndex}` : t('common.lan'))}
                                        </td>
                                        <td className="py-1.5 px-2 text-center">
                                          {host.rssi ? (
                                            <span className={`font-medium ${host.rssi >= -50 ? 'text-success' : host.rssi >= -70 ? 'text-warning' : 'text-destructive'}`}>
                                              {host.rssi} dBm
                                            </span>
                                          ) : '-'}
                                        </td>
                                        <td className="py-1.5 px-2 text-center">
                                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${host.active ? 'bg-success/20 text-success dark:bg-green-900/30 dark:text-success' : 'bg-gray-200 text-muted-foreground dark:bg-inputdark:text-muted-foreground'}`}>
                                            {host.active ? t('common.online') : t('common.offline')}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">{t('genieacs.deviceNotFound')}</p>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="border-t border-border p-3 flex justify-end">
                  <button
                    onClick={closeDetailModal}
                    className="px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50"
                  >
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit WiFi Modal */}
          <SimpleModal isOpen={showEditWifiModal} onClose={closeEditWifiModal} size="md">
            <ModalHeader>
              <ModalTitle className="flex items-center gap-2"><Wifi className="w-4 h-4" />{t('genieacs.editWifiConfiguration')}</ModalTitle>
              <ModalDescription>{t('genieacs.configureWlan')}</ModalDescription>
            </ModalHeader>
            <ModalBody className="space-y-4">
              <div>
                <ModalLabel>{t('genieacs.wlanIndex')}</ModalLabel>
                <ModalSelect value={editWifiData.wlanIndex} onChange={(e) => handleWlanIndexChange(parseInt(e.target.value))}>
                  {selectedDevice?.wlanConfigs?.map((wlan) => (<option key={wlan.index} value={wlan.index} className="bg-[#0a0520]">WLAN {wlan.index} - {wlan.ssid || t('genieacs.noSsid')} ({wlan.band})</option>)) || (<><option value={1} className="bg-[#0a0520]">WLAN 1 (2.4GHz)</option><option value={2} className="bg-[#0a0520]">WLAN 2</option><option value={3} className="bg-[#0a0520]">WLAN 3</option><option value={4} className="bg-[#0a0520]">WLAN 4</option><option value={5} className="bg-[#0a0520]">WLAN 5 (5GHz)</option></>)}
                </ModalSelect>
              </div>
              <div>
                <ModalLabel required>{t('genieacs.ssidName')}</ModalLabel>
                <ModalInput type="text" value={editWifiData.ssid} onChange={(e) => setEditWifiData({ ...editWifiData, ssid: e.target.value })} maxLength={32} placeholder={t('genieacs.wifiName')} autoComplete="off" />
                <p className="text-[10px] text-[#e0d0ff]/50 mt-1">1-32 {t('common.characters')}</p>
              </div>
              {(() => {
                const currentWlan = selectedDevice?.wlanConfigs?.find(w => w.index === editWifiData.wlanIndex);
                const currentSecurity = currentWlan?.security || t('common.unknown');
                const isOpenNetwork = currentSecurity.toLowerCase().includes('none') || currentSecurity.toLowerCase().includes('open') || currentSecurity === '';
                return (
                  <div className="p-3 bg-[#0a0520]/50 rounded-lg border border-[#bc13fe]/30">
                    <div className="flex items-center gap-2 text-xs">
                      <Shield className="w-3.5 h-3.5 text-[#e0d0ff]/60" />
                      <span className="font-medium text-[#e0d0ff]">{t('genieacs.currentSecurity')}</span>
                      <span className={`px-2 py-0.5 rounded ${isOpenNetwork ? 'bg-[#ff8c00]/20 text-[#ff8c00]' : 'bg-[#00ff88]/20 text-[#00ff88]'}`}>{currentSecurity}</span>
                    </div>
                    {isOpenNetwork && (<p className="text-[10px] text-[#e0d0ff]/50 mt-1">⚠️ {t('genieacs.openNetworkWarning')}</p>)}
                  </div>
                );
              })()}
              {(() => {
                const currentWlan = selectedDevice?.wlanConfigs?.find(w => w.index === editWifiData.wlanIndex);
                const currentSecurity = currentWlan?.security || '';
                const isOpenNetwork = currentSecurity.toLowerCase().includes('none') || currentSecurity.toLowerCase().includes('open') || currentSecurity === '';
                if (isOpenNetwork) return null;
                return (
                  <div>
                    <ModalLabel>{t('genieacs.wifiPassword')}</ModalLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e0d0ff]/40" />
                      <ModalInput type="text" value={editWifiData.password} onChange={(e) => setEditWifiData({ ...editWifiData, password: e.target.value })} maxLength={63} placeholder={t('genieacs.passwordPlaceholder')} autoComplete="off" className="pl-10" />
                    </div>
                    <p className="text-[10px] text-[#e0d0ff]/50 mt-1">💡 {t('genieacs.leaveEmptyNoChange')}</p>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between p-3 bg-[#0a0520]/50 border border-[#bc13fe]/30 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-[#e0d0ff]">{t('genieacs.wifiStatus')}</p>
                  <p className="text-[10px] text-[#e0d0ff]/50">{t('genieacs.enableDisableWifi')}</p>
                </div>
                <button type="button" onClick={() => setEditWifiData({ ...editWifiData, enabled: !editWifiData.enabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editWifiData.enabled ? 'bg-[#00f7ff] shadow-[0_0_10px_rgba(0,247,255,0.4)]' : 'bg-[#bc13fe]/30'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editWifiData.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton type="button" variant="secondary" onClick={closeEditWifiModal}>{t('common.cancel')}</ModalButton>
              <ModalButton type="button" variant="primary" onClick={handleSaveWifi} disabled={savingWifi}>
                {savingWifi ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                {t('common.save')}
              </ModalButton>
            </ModalFooter>
          </SimpleModal>\n    </div>
      </div >
    </div >
  );
}




