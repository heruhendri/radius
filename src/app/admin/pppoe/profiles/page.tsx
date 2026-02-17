'use client';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
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

interface PPPoEProfile {
  id: string; name: string; description: string | null; price: number;
  downloadSpeed: number; uploadSpeed: number; groupName: string;
  rateLimit?: string; // Full MikroTik rate limit format
  validityValue: number; validityUnit: 'DAYS' | 'MONTHS';
  sharedUser: boolean; // Only one device per username
  isActive: boolean; syncedToRadius: boolean; createdAt: string;
}

export default function PPPoEProfilesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<PPPoEProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PPPoEProfile | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', downloadSpeed: '', uploadSpeed: '', rateLimit: '', groupName: '', validityValue: '1', validityUnit: 'MONTHS' as 'DAYS' | 'MONTHS', sharedUser: true });
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});



  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    try { const res = await fetch('/api/pppoe/profiles'); const data = await res.json(); setProfiles(data.profiles || []); }
    catch (error) { console.error('Load error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingProfile ? 'PUT' : 'POST';
      // If groupName not provided, generate from name (simple slug)
      const generatedGroupName = formData.groupName || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
      // Build payload: either rateLimit OR explicit speeds must be provided.
      const priceNum = parseInt(formData.price);
      const validityNum = parseInt(formData.validityValue);
      const dlNum = parseInt(formData.downloadSpeed) || 0;
      const ulNum = parseInt(formData.uploadSpeed) || 0;

      if (!formData.rateLimit.trim()) {
        setFieldErrors({ ...fieldErrors, rateLimit: true });
        await showError(`Error: ${t('pppoe.rateLimitRequired')}`);
        return;
      }

      const payload: any = {
        ...(editingProfile && { id: editingProfile.id }),
        name: formData.name,
        description: formData.description || undefined,
        groupName: generatedGroupName,
        price: priceNum,
        validityValue: validityNum,
        validityUnit: formData.validityUnit,
        sharedUser: formData.sharedUser,
      };
      // Speeds are mandatory; use rateLimit provided in form.
      payload.downloadSpeed = dlNum;
      payload.uploadSpeed = ulNum;
      payload.rateLimit = formData.rateLimit.trim() || `${dlNum}M/${ulNum}M`;
      const res = await fetch('/api/pppoe/profiles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (res.ok) {
        setIsDialogOpen(false);
        setEditingProfile(null);
        resetForm();
        loadProfiles();
        setFieldErrors({});
        await showSuccess(editingProfile ? t('pppoe.profileUpdated') : t('pppoe.profileCreated'));
      } else {
        const missing = Array.isArray(result.details) ? result.details : [];
        const errMap: Record<string, boolean> = {};
        missing.forEach((key: string) => { errMap[key] = true; });
        // Map combined key to two inputs
        if (errMap['downloadSpeed/uploadSpeed or rateLimit']) {
          errMap['downloadSpeed'] = true;
          errMap['uploadSpeed'] = true;
          errMap['rateLimit'] = true;
        }
        setFieldErrors(errMap);
        const details = missing.length ? `\nMissing: ${missing.join(', ')}` : '';
        await showError(`Error: ${result.error || t('common.failed')}${details}`);
      }
    } catch (error) { console.error('Submit error:', error); await showError(t('common.failed')); }
  };

  const handleEdit = (profile: PPPoEProfile) => {
    setEditingProfile(profile);
    setFormData({ name: profile.name, description: profile.description || '', price: profile.price.toString(), downloadSpeed: profile.downloadSpeed.toString(), uploadSpeed: profile.uploadSpeed.toString(), rateLimit: profile.rateLimit || `${profile.downloadSpeed}M/${profile.uploadSpeed}M`, groupName: profile.groupName, validityValue: profile.validityValue.toString(), validityUnit: profile.validityUnit, sharedUser: profile.sharedUser });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteProfileId) return;
    const confirmed = await showConfirm(t('pppoe.deleteProfileConfirmMsg'));
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/pppoe/profiles?id=${deleteProfileId}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) { await showSuccess(t('pppoe.profileDeleted')); loadProfiles(); }
      else { await showError(result.error || t('common.failed')); }
    } catch (error) { console.error('Delete error:', error); await showError(t('common.failed')); }
    finally { setDeleteProfileId(null); }
  };

  const resetForm = () => { setFormData({ name: '', description: '', price: '', downloadSpeed: '', uploadSpeed: '', rateLimit: '', groupName: 'salfanetradius', validityValue: '1', validityUnit: 'MONTHS', sharedUser: true }); setFieldErrors({}); };

  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-[#1a0f35] relative overflow-hidden"><div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div><div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div></div><RefreshCw className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" /></div>; }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div><div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div><div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div><div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div></div>
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">{t('pppoe.profilesTitle')}</h1>
            <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('pppoe.profilesSubtitle')}</p>
          </div>
          <button onClick={() => { resetForm(); setEditingProfile(null); setIsDialogOpen(true); }} className="inline-flex items-center px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded"><Plus className="h-3 w-3 mr-1" />{t('pppoe.addProfile')}</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('common.total')}</p><p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{profiles.length}</p></div>
              <FileText className="h-7 w-7 text-[#00f7ff] drop-shadow-[0_0_15px_rgba(0,247,255,0.6)]" />
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('pppoe.active')}</p><p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{profiles.filter(p => p.isActive).length}</p></div>
              <CheckCircle2 className="h-7 w-7 text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.6)]" />
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] text-muted-foreground uppercase">{t('pppoe.synced')}</p><p className="text-base font-bold text-primary">{profiles.filter(p => p.syncedToRadius).length}</p></div>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs font-medium">{t('pppoe.profilesList')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('common.name')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden md:table-cell">Group</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.price')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden sm:table-cell">{t('hotspot.speed')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden lg:table-cell">{t('pppoe.validity')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('common.status')}</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-xs">{t('pppoe.noProfiles')}</td></tr>
                ) : (
                  profiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2"><p className="font-medium text-xs">{profile.name}</p>{profile.description && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{profile.description}</p>}</td>
                      <td className="px-3 py-2 font-mono text-xs hidden md:table-cell">{profile.groupName}</td>
                      <td className="px-3 py-2 text-xs">Rp {profile.price.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 font-mono text-xs hidden sm:table-cell">{profile.downloadSpeed}M/{profile.uploadSpeed}M</td>
                      <td className="px-3 py-2 text-xs hidden lg:table-cell">{profile.validityValue} {profile.validityUnit === 'MONTHS' ? 'Mo' : 'D'}</td>
                      <td className="px-3 py-2">
                        {profile.syncedToRadius ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-success/10 text-success"><CheckCircle2 className="h-2 w-2 mr-0.5" />{t('pppoe.synced')}</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-warning/10 text-warning"><XCircle className="h-2 w-2 mr-0.5" />{t('pppoe.pending')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => handleEdit(profile)} className="p-1 text-muted-foreground hover:bg-muted rounded"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => setDeleteProfileId(profile.id)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-3 w-3" /></button>
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
        <SimpleModal isOpen={isDialogOpen} onClose={() => { setIsDialogOpen(false); setEditingProfile(null); resetForm(); }} size="lg">
          <ModalHeader>
            <ModalTitle>{editingProfile ? t('pppoe.editProfile') : t('pppoe.addProfile')}</ModalTitle>
            <ModalDescription>{editingProfile ? t('pppoe.updateConfig') : t('pppoe.createProfile')}</ModalDescription>
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <ModalLabel required>{t('common.name')}</ModalLabel>
                  <ModalInput type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className={fieldErrors['name'] ? 'border-[#ff4466]' : ''} />
                </div>
                <div>
                  <ModalLabel required>{t('pppoe.radiusGroup')}</ModalLabel>
                  <ModalInput type="text" value={formData.groupName} onChange={(e) => setFormData({ ...formData, groupName: e.target.value })} required className={fieldErrors['groupName'] ? 'border-[#ff4466]' : ''} />
                  <p className="text-[9px] text-[#e0d0ff]/60 mt-1">{t('pppoe.matchMikrotik')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <ModalLabel required>{t('pppoe.priceIdr')}</ModalLabel>
                  <ModalInput type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required className={fieldErrors['price'] ? 'border-[#ff4466]' : ''} />
                </div>
                <div>
                  <ModalLabel required>{t('pppoe.validity')}</ModalLabel>
                  <div className="flex gap-2">
                    <ModalInput type="number" min="1" value={formData.validityValue} onChange={(e) => setFormData({ ...formData, validityValue: e.target.value })} required className={`w-20 ${fieldErrors['validityValue'] ? 'border-[#ff4466]' : ''}`} />
                    <ModalSelect value={formData.validityUnit} onChange={(e) => setFormData({ ...formData, validityUnit: e.target.value as 'DAYS' | 'MONTHS' })} className={fieldErrors['validityUnit'] ? 'border-[#ff4466]' : ''}>
                      <option value="DAYS" className="bg-[#0a0520]">{t('pppoe.days')}</option>
                      <option value="MONTHS" className="bg-[#0a0520]">{t('pppoe.months')}</option>
                    </ModalSelect>
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-4 border border-[#bc13fe]/20 rounded-lg bg-[#0a0520]/20">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <ModalLabel className="mb-0">Rate Limit MikroTik</ModalLabel>
                    <label className="flex items-center gap-1.5 text-[10px] text-[#00f7ff] cursor-pointer hover:underline" onClick={() => {
                      const dl = formData.downloadSpeed || '10';
                      const ul = formData.uploadSpeed || '5';
                      setFormData({ ...formData, rateLimit: `${dl}M/${ul}M 0/0 0/0 8 0/0` });
                    }}>
                      <span>Gunakan Format Burst</span>
                    </label>
                  </div>
                  <ModalInput
                    type="text"
                    value={formData.rateLimit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => {
                        const newData = { ...prev, rateLimit: val };
                        // Try to extract download/upload from first part
                        const speedPart = val.trim().split(/\s+/)[0];
                        if (speedPart && speedPart.includes('/')) {
                          const parts = speedPart.split('/');
                          const dl = parts[0]?.replace(/[^0-9]/g, '');
                          const ul = parts[1]?.replace(/[^0-9]/g, '');
                          if (dl) newData.downloadSpeed = dl;
                          if (ul) newData.uploadSpeed = ul;
                        }
                        return newData;
                      });
                    }}
                    placeholder="10M/5M atau 10M/5M 0/0 0/0 8 0/0"
                    className="font-mono text-center text-lg border-[#00f7ff]/50 focus:border-[#00f7ff]"
                    required
                  />
                  <p className="text-[9px] text-[#e0d0ff]/50 mt-1">
                    Format: download/upload [burst-rates] [thresholds] [burst-time] [priority] [min-rates]
                  </p>
                </div>

              </div>
              <div>
                <label className="flex items-center gap-2 text-xs text-[#e0d0ff] cursor-pointer">
                  <input type="checkbox" checked={formData.sharedUser} onChange={(e) => setFormData({ ...formData, sharedUser: e.target.checked })} className="rounded border-[#bc13fe]/50 bg-[#0a0520] text-[#00f7ff] focus:ring-[#00f7ff]" />
                  <span>Shared User (Only One Device)</span>
                </label>
                <p className="text-[9px] text-[#e0d0ff]/50 mt-1">Jika diaktifkan, username hanya bisa login di 1 device. Login ke-2 akan disconnect session pertama.</p>
              </div>
              <div>
                <ModalLabel>{t('common.description')}</ModalLabel>
                <ModalInput type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton type="button" variant="secondary" onClick={() => { setIsDialogOpen(false); setEditingProfile(null); resetForm(); }}>{t('common.cancel')}</ModalButton>
              <ModalButton type="submit" variant="primary">{editingProfile ? t('common.update') : t('common.create')}</ModalButton>
            </ModalFooter>
          </form>
        </SimpleModal>

        {/* Delete Dialog */}
        <SimpleModal isOpen={!!deleteProfileId} onClose={() => setDeleteProfileId(null)} size="sm">
          <ModalBody className="text-center py-6">
            <div className="w-14 h-14 bg-[#ff4466]/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#ff4466]/50">
              <Trash2 className="w-7 h-7 text-[#ff6b8a]" />
            </div>
            <h2 className="text-base font-bold text-white mb-2">{t('pppoe.deleteProfile')}</h2>
            <p className="text-xs text-[#e0d0ff]/70">{t('pppoe.deleteProfileConfirm')}</p>
          </ModalBody>
          <ModalFooter className="justify-center">
            <ModalButton variant="secondary" onClick={() => setDeleteProfileId(null)}>{t('common.cancel')}</ModalButton>
            <ModalButton variant="danger" onClick={handleDelete}>{t('common.delete')}</ModalButton>
          </ModalFooter>
        </SimpleModal>
      </div>
    </div>
  );
}
