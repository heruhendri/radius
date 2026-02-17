'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Clock, Eye, EyeOff, MapPin, Map, DollarSign, Wallet, TrendingUp } from 'lucide-react';
import { formatWIB, formatLocalDate } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError, showWarning } from '@/lib/sweetalert';

interface User {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  profile: { id: string; name: string };
  router?: { id: string; name: string } | null;
  area?: { id: string; name: string } | null;
  ipAddress: string | null;
  expiredAt: string | null;
  latitude: number | null;
  longitude: number | null;
  subscriptionType?: 'PREPAID' | 'POSTPAID';
  billingDay?: number | null;
  balance?: number;
  autoRenewal?: boolean;
}

interface Session {
  id: string;
  sessionId: string;
  startTime: Date;
  stopTime: Date | null;
  durationFormatted: string;
  download: string;
  upload: string;
  total: string;
  nasIp: string;
  terminateCause: string;
  macAddress?: string;
  isOnline: boolean;
}

interface AuthLog {
  id: number;
  username: string;
  reply: string;
  authdate: Date;
  success: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
}

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (data: any) => Promise<void>;
  profiles: any[];
  routers: any[];
  areas?: any[];
  currentLatLng?: { lat: string; lng: string };
  onLatLngChange?: (lat: string, lng: string) => void;
}

export default function UserDetailModal({
  isOpen,
  onClose,
  user,
  onSave,
  profiles,
  areas = [],
  routers,
  currentLatLng,
  onLatLngChange,
}: UserDetailModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('info');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [authLogs, setAuthLogs] = useState<AuthLog[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Balance management state
  const [balance, setBalance] = useState(0);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [depositNote, setDepositNote] = useState('');
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    profileId: '',
    areaId: '',
    routerId: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    ipAddress: '',
    expiredAt: '',
    billingDay: 1,
    latitude: '',
    longitude: '',
    subscriptionType: 'PREPAID' as 'PREPAID' | 'POSTPAID',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '',
        areaId: user.area?.id || '',
        profileId: user.profile.id,
        routerId: user.router?.id || '',
        name: user.name,
        phone: user.phone,
        email: user.email || '',
        address: user.address || '',
        ipAddress: user.ipAddress || '',
        expiredAt: user.expiredAt ? user.expiredAt.split('T')[0] : '',
        billingDay: user.billingDay || 1,
        latitude: user.latitude?.toString() || '',
        longitude: user.longitude?.toString() || '',
        subscriptionType: user.subscriptionType || 'PREPAID',
      });
      setBalance(user.balance || 0);
      setAutoRenewal(user.autoRenewal || false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab !== 'info') {
      loadTabData(activeTab);
    }
  }, [user, activeTab]);

  // Sync lat/lng from parent (for map picker)
  useEffect(() => {
    if (currentLatLng) {
      setFormData(prev => ({
        ...prev,
        latitude: currentLatLng.lat,
        longitude: currentLatLng.lng,
      }));
    }
  }, [currentLatLng]);

  const loadTabData = async (tab: string) => {
    if (!user) return;
    setLoading(true);
    try {
      if (tab === 'balance') {
        const res = await fetch(`/api/admin/pppoe/users/${user.id}/deposit`);
        const data = await res.json();
        if (res.ok) {
          setBalance(data.user?.balance || 0);
          setBalanceHistory(data.transactions || []);
        }
      } else {
        const res = await fetch(`/api/pppoe/users/${user.id}/activity?type=${tab === 'sessions' ? 'sessions' : tab === 'auth' ? 'auth' : 'invoices'}`);
        const data = await res.json();

        if (data.success) {
          if (tab === 'sessions') {
            setSessions(data.data);
          } else if (tab === 'auth') {
            setAuthLogs(data.data);
          } else if (tab === 'invoices') {
            setInvoices(data.data);
          }
        }
      }
    } catch (error) {
      console.error('Load tab data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...formData, id: user?.id });
    onClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm modal-overlay p-4" style={{ zIndex: 9999 }}>
      <div className="bg-gradient-to-br from-[#0a0520] to-[#1a0f35] rounded-xl shadow-[0_0_40px_rgba(188,19,254,0.3)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-[#bc13fe]/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#bc13fe]/30 bg-gradient-to-r from-[#bc13fe]/10 to-[#00f7ff]/10">
          <div>
            <h2 className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(0,247,255,0.5)]">
              User Details
            </h2>
            <p className="text-sm text-[#e0d0ff]/70 mt-1">
              {user.username}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#bc13fe]/20 rounded-lg transition-colors text-[#e0d0ff] hover:text-[#00f7ff]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#bc13fe]/30">
          <div className="flex px-6">
            {[
              { id: 'info', label: t('userModal.userInfo') },
              { id: 'balance', label: 'Balance & Deposit' },
              { id: 'sessions', label: t('userModal.sessions') },
              { id: 'auth', label: t('userModal.authLogs') },
              { id: 'invoices', label: t('userModal.invoices') },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id
                  ? 'border-[#00f7ff] text-[#00f7ff] bg-[#00f7ff]/10 shadow-[0_2px_10px_rgba(0,247,255,0.3)]'
                  : 'border-transparent text-[#e0d0ff]/60 hover:text-[#e0d0ff] hover:bg-[#bc13fe]/10'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.username')}</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.password')}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg pr-10 focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                      placeholder={t('userModal.passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.name')}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.phone')}</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.email')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.profile')}</label>
                  <select
                    value={formData.profileId}
                    onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    required
                  >
                    <option value="">{t('userModal.selectProfile')}</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.router')}</label>
                  <select
                    value={formData.routerId}
                    onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                  >
                    <option value="">{t('userModal.autoAssign')}</option>
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">Area</label>
                  <select
                    value={formData.areaId}
                    onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                  >
                    <option value="">Pilih Area</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.ipAddress')}</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    placeholder={t('userModal.ipPlaceholder')}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">{t('userModal.address')}</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    rows={2}
                  />
                </div>

                {/* GPS Location */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-[#e0d0ff]">{t('userModal.gpsLocation')}</label>
                    <div className="flex gap-2">
                      {onLatLngChange && (
                        <button
                          type="button"
                          onClick={() => {
                            // Notify parent to open map picker with current values
                            onLatLngChange(formData.latitude, formData.longitude);
                          }}
                          className="inline-flex items-center px-3 py-1 text-xs bg-[#00f7ff]/20 text-[#00f7ff] border border-[#00f7ff]/50 rounded hover:bg-[#00f7ff]/30 transition"
                        >
                          <Map className="h-3 w-3 mr-1" />
                          Pilih di Peta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          // Geolocation API requires HTTPS (except localhost)
                          const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

                          if (!isSecure) {
                            await showWarning('GPS Auto memerlukan koneksi HTTPS.\n\nUntuk menggunakan fitur ini:\n1. Akses aplikasi melalui HTTPS, atau\n2. Gunakan "Pilih di Peta" untuk memilih lokasi manual');
                            return;
                          }

                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                setFormData({
                                  ...formData,
                                  latitude: position.coords.latitude.toFixed(6),
                                  longitude: position.coords.longitude.toFixed(6),
                                });
                              },
                              async (error) => {
                                let errorMessage = 'Gagal mendapatkan lokasi: ';
                                switch (error.code) {
                                  case error.PERMISSION_DENIED:
                                    errorMessage += 'Akses lokasi ditolak. Silakan izinkan akses lokasi di browser Anda.';
                                    break;
                                  case error.POSITION_UNAVAILABLE:
                                    errorMessage += 'Informasi lokasi tidak tersedia.';
                                    break;
                                  case error.TIMEOUT:
                                    errorMessage += 'Waktu permintaan lokasi habis.';
                                    break;
                                  default:
                                    errorMessage += error.message;
                                }
                                await showError(errorMessage);
                              }
                            );
                          } else {
                            await showError('Geolocation tidak didukung oleh browser ini.');
                          }
                        }}
                        className="inline-flex items-center px-3 py-1 text-xs bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 rounded hover:bg-[#00ff88]/30 transition"
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS Auto
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="Latitude"
                      className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg text-sm focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    />
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="Longitude"
                      className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg text-sm focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    />
                  </div>
                  <p className="text-xs text-[#e0d0ff]/50 mt-1">
                    {t('userModal.gpsNote')}
                  </p>
                </div>

                {/* Subscription Type */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2 text-[#e0d0ff]">{t('userModal.subscriptionType')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${formData.subscriptionType === 'POSTPAID' ? 'border-[#00f7ff] bg-[#00f7ff]/10 shadow-[0_0_10px_rgba(0,247,255,0.3)]' : 'border-[#bc13fe]/30 hover:border-[#00f7ff]/50'}`}>
                      <input
                        type="radio"
                        name="subscriptionType"
                        value="POSTPAID"
                        checked={formData.subscriptionType === 'POSTPAID'}
                        onChange={(e) => setFormData({ ...formData, subscriptionType: e.target.value as 'POSTPAID' })}
                        className="w-4 h-4 accent-[#00f7ff] border-[#bc13fe]/50 focus:ring-[#00f7ff]"
                      />
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-[#e0d0ff]">📅 {t('userModal.postpaid')}</div>
                        <div className="text-xs text-[#e0d0ff]/50">Tagihan bulanan, tanggal tetap</div>
                      </div>
                    </label>
                    <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${formData.subscriptionType === 'PREPAID' ? 'border-[#bc13fe] bg-[#bc13fe]/10 shadow-[0_0_10px_rgba(188,19,254,0.3)]' : 'border-[#bc13fe]/30 hover:border-[#bc13fe]/50'}`}>
                      <input
                        type="radio"
                        name="subscriptionType"
                        value="PREPAID"
                        checked={formData.subscriptionType === 'PREPAID'}
                        onChange={(e) => setFormData({ ...formData, subscriptionType: e.target.value as 'PREPAID' })}
                        className="w-4 h-4 accent-[#bc13fe] border-[#bc13fe]/50 focus:ring-[#bc13fe]"
                      />
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-[#e0d0ff]">⏰ {t('userModal.prepaid')}</div>
                        <div className="text-xs text-[#e0d0ff]/50">Bayar dimuka, validitas terbatas</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Billing Day - POSTPAID Only */}
                {formData.subscriptionType === 'POSTPAID' && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">
                      📅 Tanggal Tagihan
                    </label>
                    <select
                      value={formData.billingDay}
                      onChange={(e) => setFormData({ ...formData, billingDay: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day} className="bg-[#0a0520]">
                          Tanggal {day}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-[#e0d0ff]/50 mt-1">
                      Tanggal jatuh tempo bulanan. expiredAt auto-calculated.
                    </p>
                  </div>
                )}

                {/* Expired At - Shows for both PREPAID and POSTPAID */}
                <div className={formData.subscriptionType === 'POSTPAID' ? '' : 'col-span-2'}>
                  <label className="block text-sm font-medium mb-1 text-[#e0d0ff]">
                    {formData.subscriptionType === 'POSTPAID' ? '⏰ Expired Saat Ini' : t('userModal.expiredAt')}
                  </label>
                  <input
                    type="date"
                    value={formData.expiredAt}
                    onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })}
                    className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all"
                  />
                  <p className="text-xs text-[#e0d0ff]/50 mt-1">
                    {formData.subscriptionType === 'POSTPAID' 
                      ? '📌 Untuk testing: expiredAt = tanggal tagihan bulan depan (auto calculated)' 
                      : 'Tanggal kadaluarsa paket. Kosongkan untuk auto dari profile.'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#bc13fe]/30">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[#e0d0ff] bg-[#bc13fe]/20 hover:bg-[#bc13fe]/30 border border-[#bc13fe]/50 rounded-lg transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-[#00f7ff] to-[#bc13fe] text-white hover:from-[#00f7ff]/80 hover:to-[#bc13fe]/80 rounded-lg shadow-[0_0_15px_rgba(0,247,255,0.4)] transition-all"
                >
                  {t('common.saveChanges')}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'balance' && (
            <div className="space-y-6">
              {/* Current Balance & Auto-Renewal */}
              <div className="bg-gradient-to-br from-[#00f7ff]/10 to-[#bc13fe]/10 rounded-xl p-6 border border-[#00f7ff]/40 shadow-[0_0_20px_rgba(0,247,255,0.2)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-[#00f7ff] font-medium flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Saldo Deposit
                    </p>
                    <p className="text-3xl font-bold text-white mt-1 drop-shadow-[0_0_10px_rgba(0,247,255,0.5)]">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(balance)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRenewal}
                        onChange={async (e) => {
                          const newValue = e.target.checked;
                          try {
                            const res = await fetch('/api/pppoe/users', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: user.id, autoRenewal: newValue })
                            });
                            if (res.ok) {
                              setAutoRenewal(newValue);
                              await showSuccess(`Auto-renewal ${newValue ? 'diaktifkan' : 'dinonaktifkan'}`);
                            } else {
                              await showError('Gagal update auto-renewal');
                            }
                          } catch (error) {
                            await showError('Gagal update auto-renewal');
                          }
                        }}
                        className="w-4 h-4 accent-[#00f7ff] border-[#bc13fe]/50 rounded focus:ring-[#00f7ff]"
                      />
                      <span className="text-sm font-medium text-[#e0d0ff]">Auto-Renewal</span>
                    </label>
                    {autoRenewal && (
                      <span className="text-xs text-[#00ff88] bg-[#00ff88]/20 px-2 py-1 rounded border border-[#00ff88]/30">
                        ✓ Aktif
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#e0d0ff]/70">
                  {autoRenewal
                    ? '✅ Tagihan akan dibayar otomatis dari saldo 3 hari sebelum expired'
                    : '⚠️ Aktifkan auto-renewal untuk perpanjangan otomatis dari saldo'}
                </p>
              </div>

              {/* Top-Up Form */}
              <div className="border border-[#00ff88]/40 rounded-lg p-6 bg-[#0a0520]/30">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#00ff88]">
                  <DollarSign className="w-5 h-5" />
                  Top-Up Saldo
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[#e0d0ff]">Jumlah (Rp)</label>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="100000"
                        min="0"
                        step="1000"
                        className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[#e0d0ff]">Metode Pembayaran</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                      >
                        <option value="CASH">Cash</option>
                        <option value="TRANSFER">Transfer Bank</option>
                        <option value="EWALLET">E-Wallet</option>
                        <option value="QRIS">QRIS</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#e0d0ff]">Catatan (Opsional)</label>
                    <textarea
                      value={depositNote}
                      onChange={(e) => setDepositNote(e.target.value)}
                      placeholder="Catatan tambahan..."
                      rows={2}
                      className="w-full px-3 py-2 border border-[#bc13fe]/40 bg-[#0a0520]/50 text-[#e0d0ff] rounded-lg focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff] focus:outline-none transition-all placeholder:text-[#e0d0ff]/30"
                    />
                  </div>
                  {depositAmount && !isNaN(parseInt(depositAmount)) && parseInt(depositAmount) > 0 && (
                    <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#00ff88]">Saldo Baru:</span>
                        <span className="font-bold text-white drop-shadow-[0_0_5px_rgba(0,255,136,0.5)]">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(balance + parseInt(depositAmount))}
                        </span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      if (!depositAmount || isNaN(parseInt(depositAmount)) || parseInt(depositAmount) <= 0) {
                        await showError('Masukkan jumlah yang valid');
                        return;
                      }
                      setIsTopUpLoading(true);
                      try {
                        const res = await fetch(`/api/admin/pppoe/users/${user.id}/deposit`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            amount: parseInt(depositAmount),
                            paymentMethod,
                            note: depositNote || undefined
                          })
                        });
                        const result = await res.json();
                        if (res.ok) {
                          setBalance(result.data.newBalance);
                          setDepositAmount('');
                          setDepositNote('');
                          await showSuccess(`Top-up berhasil! Saldo baru: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(result.data.newBalance)}`);
                          // Reload history
                          loadTabData('balance');
                        } else {
                          await showError(result.error || 'Gagal top-up saldo');
                        }
                      } catch (error) {
                        await showError('Gagal top-up saldo');
                      } finally {
                        setIsTopUpLoading(false);
                      }
                    }}
                    disabled={isTopUpLoading || !depositAmount || parseInt(depositAmount) <= 0}
                    className="w-full px-4 py-2 bg-gradient-to-r from-[#00ff88] to-[#00f7ff] hover:from-[#00ff88]/80 hover:to-[#00f7ff]/80 text-[#0a0520] font-semibold rounded-lg shadow-[0_0_15px_rgba(0,255,136,0.4)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    {isTopUpLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        Top-Up Saldo
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Balance History */}
              <div className="border border-[#bc13fe]/40 rounded-lg p-6 bg-[#0a0520]/30">
                <h3 className="text-lg font-semibold mb-4 text-[#e0d0ff]">Riwayat Deposit</h3>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#00f7ff]" />
                  </div>
                ) : balanceHistory.length === 0 ? (
                  <div className="text-center py-8 text-[#e0d0ff]/50">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Belum ada riwayat deposit</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {balanceHistory.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 border border-[#bc13fe]/30 rounded-lg hover:bg-[#bc13fe]/10 transition-all">
                        <div>
                          <p className="text-sm font-medium text-[#e0d0ff]">
                            {tx.category?.name || 'Deposit'}
                          </p>
                          <p className="text-xs text-[#e0d0ff]/50">
                            {formatWIB(tx.createdAt, 'dd MMM yyyy HH:mm')}
                          </p>
                          {tx.description && (
                            <p className="text-xs text-[#e0d0ff]/40 mt-1">{tx.description}</p>
                          )}
                          {tx.notes && (
                            <p className="text-xs text-[#00f7ff] mt-1">{tx.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#00ff88] drop-shadow-[0_0_5px_rgba(0,255,136,0.5)]">
                            +{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tx.amount)}
                          </p>
                          <span className="text-xs text-[#e0d0ff]/50">{tx.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#00f7ff]" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-[#e0d0ff]/50">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('userModal.noSessions')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border border-[#bc13fe]/30 rounded-lg bg-[#0a0520]/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {session.isOnline ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                {t('userModal.online')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {t('userModal.offline')}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {session.durationFormatted}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1">
                            {formatWIB(session.startTime, 'dd MMM yyyy HH:mm')}
                            {session.stopTime && (
                              <> - {formatWIB(session.stopTime, 'HH:mm')}</>
                            )}
                          </p>
                          {session.macAddress && session.macAddress !== '-' && (
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                              MAC: {session.macAddress}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <div>↓ {session.download}</div>
                          <div>↑ {session.upload}</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            Total: {session.total}
                          </div>
                        </div>
                      </div>
                      {session.terminateCause && !session.isOnline && (
                        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                          Terminate: {session.terminateCause}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'auth' && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#00f7ff]" />
                </div>
              ) : authLogs.length === 0 ? (
                <div className="text-center py-8 text-[#e0d0ff]/50">
                  <XCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('userModal.noAuthLogs')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {authLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {log.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{log.reply}</p>
                          <p className="text-xs text-gray-500">
                            {formatLocalDate(log.authdate, 'dd MMM yyyy HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${log.success
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                          }`}
                      >
                        {log.success ? t('userModal.success') : t('userModal.rejected')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#00f7ff]" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-[#e0d0ff]/50">
                  <p>{t('userModal.noInvoices')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="p-4 border border-[#bc13fe]/30 rounded-lg bg-[#0a0520]/30"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Due: {formatWIB(invoice.dueDate, 'dd MMM yyyy')}
                          </p>
                          {invoice.paidAt && (
                            <p className="text-xs text-green-600 mt-1">
                              Paid: {formatWIB(invoice.paidAt, 'dd MMM yyyy')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0,
                            }).format(invoice.amount)}
                          </p>
                          <span
                            className={`inline-block text-xs px-2 py-1 rounded mt-1 ${invoice.status === 'PAID'
                              ? 'bg-green-50 text-green-700'
                              : invoice.status === 'PENDING'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-red-50 text-red-700'
                              }`}
                          >
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
