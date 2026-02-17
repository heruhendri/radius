'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Plus, Pencil, Trash2, Server, MapPin, Map, X, RefreshCcw, Router as RouterIcon,
  Activity, Box, Network,
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';
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

interface OLT {
  id: string;
  name: string;
  ipAddress: string;
  latitude: number;
  longitude: number;
  status: string;
  followRoad: boolean;
  createdAt: string;
  routers: Array<{
    id: string;
    priority: number;
    isActive: boolean;
    router: {
      id: string;
      name: string;
      nasname: string;
      ipAddress: string;
    };
  }>;
  _count: {
    odps: number;
  };
}

interface Router {
  id: string;
  name: string;
  nasname: string;
  ipAddress: string;
}

export default function OLTsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [olts, setOlts] = useState<OLT[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOlt, setEditingOlt] = useState<OLT | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    latitude: '',
    longitude: '',
    status: 'active',
    followRoad: false,
    routerIds: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [oltsRes, routersRes] = await Promise.all([
        fetch('/api/network/olts'),
        fetch('/api/network/routers'),
      ]);
      const [oltsData, routersData] = await Promise.all([oltsRes.json(), routersRes.json()]);
      setOlts(oltsData.olts || []);
      setRouters(routersData.routers || []);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ipAddress: '',
      latitude: '',
      longitude: '',
      status: 'active',
      followRoad: false,
      routerIds: [],
    });
  };

  const handleEdit = (olt: OLT) => {
    setEditingOlt(olt);
    setFormData({
      name: olt.name,
      ipAddress: olt.ipAddress,
      latitude: olt.latitude.toString(),
      longitude: olt.longitude.toString(),
      status: olt.status,
      followRoad: olt.followRoad,
      routerIds: olt.routers.map(r => r.router.id),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingOlt ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        ...(editingOlt && { id: editingOlt.id }),
      };

      const res = await fetch('/api/network/olts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        await showSuccess(editingOlt ? t('common.updated') : t('common.created'));
        setIsDialogOpen(false);
        setEditingOlt(null);
        resetForm();
        loadData();
      } else {
        await showError(result.error || t('common.failedSaveOlt'));
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError(t('common.failedSaveOlt'));
    }
  };

  const handleDelete = async (olt: OLT) => {
    const confirmed = await showConfirm(
      'Delete OLT',
      `Are you sure you want to delete "${olt.name}"? This will also delete all associated ODCs and ODPs.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/network/olts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: olt.id }),
      });

      const result = await res.json();
      if (result.success) {
        await showSuccess(t('common.oltDeleted'));
        loadData();
      } else {
        await showError(result.error || t('common.failedDeleteOlt'));
      }
    } catch (error) {
      await showError(t('common.failedDeleteOlt'));
    }
  };

  const toggleRouter = (routerId: string) => {
    setFormData(prev => ({
      ...prev,
      routerIds: prev.routerIds.includes(routerId)
        ? prev.routerIds.filter(id => id !== routerId)
        : [...prev.routerIds, routerId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a0f35] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <RefreshCcw className="h-12 w-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* Neon Cyberpunk Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)] flex items-center gap-3">
              <Server className="h-6 w-6 text-[#00f7ff] drop-shadow-[0_0_15px_rgba(0,247,255,0.6)]" />
              OLT Management
            </h1>
            <p className="text-sm text-[#e0d0ff]/80 mt-2">
              Manage Optical Line Terminals (OLT) for FTTH network
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingOlt(null); setIsDialogOpen(true); }}
            className="inline-flex items-center px-4 py-2.5 text-sm font-bold bg-[#00f7ff] text-black rounded-lg hover:bg-[#00f7ff]/90 transition-all shadow-[0_0_20px_rgba(0,247,255,0.4)] uppercase tracking-wide"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add OLT
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Total OLTs</p>
                <p className="text-base font-bold text-primary">{olts.length}</p>
              </div>
              <Server className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Active</p>
                <p className="text-base font-bold text-success">
                  {olts.filter(o => o.status === 'active').length}
                </p>
              </div>
              <Activity className="h-5 w-5 text-success" />
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Total ODPs</p>
                <p className="text-base font-bold text-primary">
                  {olts.reduce((sum, o) => sum + (o._count?.odps || 0), 0)}
                </p>
              </div>
              <Box className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs font-medium">OLT List</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">Name</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">IP Address</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden md:table-cell">Location</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden sm:table-cell">Routers</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">ODPs</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {olts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-xs">
                      No OLTs found. Click "Add OLT" to create one.
                    </td>
                  </tr>
                ) : (
                  olts.map((olt) => (
                    <tr key={olt.id} className="hover:bg-muted">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium">{olt.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                        {olt.ipAddress}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                        <a
                          href={`https://www.google.com/maps?q=${olt.latitude},${olt.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          {olt.latitude.toFixed(6)}, {olt.longitude.toFixed(6)}
                        </a>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {olt.routers.map((r, idx) => (
                            <span
                              key={r.id}
                              className={`px-1.5 py-0.5 text-[9px] rounded ${idx === 0
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground'
                                }`}
                            >
                              {r.router.name}
                            </span>
                          ))}
                          {olt.routers.length === 0 && (
                            <span className="text-[10px] text-muted-foreground">No router</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent dark:bg-purple-900/30 rounded">
                          {olt._count?.odps || 0} ODPs
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${olt.status === 'active'
                            ? 'bg-success/10 text-success'
                            : 'bg-destructive/10 text-destructive'
                            }`}
                        >
                          {olt.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(olt)}
                            className="p-1 text-muted-foreground hover:bg-muted rounded"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(olt)}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded"
                          >
                            <Trash2 className="h-3 w-3" />
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

        {/* Add/Edit Dialog */}
        <SimpleModal isOpen={isDialogOpen} onClose={() => { setIsDialogOpen(false); setEditingOlt(null); resetForm(); }} size="lg">
          <ModalHeader>
            <ModalTitle>{editingOlt ? 'Edit OLT' : 'Add OLT'}</ModalTitle>
            <ModalDescription>Configure Optical Line Terminal</ModalDescription>
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <ModalLabel required>Name</ModalLabel>
                  <ModalInput type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="OLT-01" />
                </div>
                <div>
                  <ModalLabel required>IP Address</ModalLabel>
                  <ModalInput type="text" value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} required placeholder="192.168.1.1" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <ModalLabel required>GPS Location</ModalLabel>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setShowMapPicker(true)} className="inline-flex items-center px-2 py-0.5 text-[10px] bg-[#00f7ff] text-black font-bold rounded shadow-[0_0_10px_rgba(0,247,255,0.3)]">
                      <Map className="h-2.5 w-2.5 mr-1" /> Open Map
                    </button>
                    <button type="button" onClick={() => { if (!navigator.geolocation) { showError(t('common.gpsNotAvailableInBrowser')); return; } navigator.geolocation.getCurrentPosition((p) => { setFormData({ ...formData, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }); showSuccess(t('common.gpsSuccess')); }, (err) => { console.error('GPS Error:', err); if (err.code === 1) { showError(t('common.gpsPermissionDenied')); } else if (err.code === 2) { showError(t('common.gpsNotAvailable')); } else if (err.code === 3) { showError(t('common.gpsTimeout')); } else { showError(t('common.gpsFailedGet')); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); }} className="inline-flex items-center px-2 py-0.5 text-[10px] bg-[#00ff88] text-black font-bold rounded shadow-[0_0_10px_rgba(0,255,136,0.3)]">
                      <MapPin className="h-2.5 w-2.5 mr-1" /> Auto GPS
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ModalInput type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} required placeholder="Latitude" />
                  <ModalInput type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} required placeholder="Longitude" />
                </div>
              </div>
              <div>
                <ModalLabel>Status</ModalLabel>
                <ModalSelect value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  <option value="active" className="bg-[#0a0520]">Active</option>
                  <option value="inactive" className="bg-[#0a0520]">Inactive</option>
                  <option value="maintenance" className="bg-[#0a0520]">Maintenance</option>
                </ModalSelect>
              </div>
              <div>
                <ModalLabel>Connected Routers (Uplinks)</ModalLabel>
                <div className="border border-[#bc13fe]/30 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1 bg-[#0a0520]/50">
                  {routers.length === 0 ? (
                    <p className="text-[10px] text-[#e0d0ff]/50">No routers available</p>
                  ) : (
                    routers.map((router) => (
                      <label key={router.id} className="flex items-center gap-2 p-1 hover:bg-[#bc13fe]/10 rounded cursor-pointer">
                        <input type="checkbox" checked={formData.routerIds.includes(router.id)} onChange={() => toggleRouter(router.id)} className="w-3 h-3 rounded border-[#bc13fe]/50 bg-[#0a0520] text-[#00f7ff] focus:ring-[#00f7ff]" />
                        <RouterIcon className="h-3 w-3 text-[#00f7ff]" />
                        <span className="text-xs text-[#e0d0ff]">{router.name}</span>
                        <span className="text-[10px] text-[#e0d0ff]/50">({router.ipAddress})</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-[9px] text-[#e0d0ff]/50 mt-1">First selected = Primary uplink</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="followRoad" checked={formData.followRoad} onChange={(e) => setFormData({ ...formData, followRoad: e.target.checked })} className="w-3 h-3 rounded border-[#bc13fe]/50 bg-[#0a0520] text-[#00f7ff] focus:ring-[#00f7ff]" />
                <label htmlFor="followRoad" className="text-xs text-[#e0d0ff]">Follow road path on map</label>
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton type="button" variant="secondary" onClick={() => { setIsDialogOpen(false); setEditingOlt(null); resetForm(); }}>Cancel</ModalButton>
              <ModalButton type="submit" variant="primary">{editingOlt ? 'Update' : 'Create'}</ModalButton>
            </ModalFooter>
          </form>
        </SimpleModal>

        {/* Map Picker */}
        <MapPicker
          isOpen={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          onSelect={(lat, lng) => {
            setFormData({
              ...formData,
              latitude: lat.toFixed(6),
              longitude: lng.toFixed(6),
            });
          }}
          initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
          initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
        />
      </div>
    </div>
  );
}
