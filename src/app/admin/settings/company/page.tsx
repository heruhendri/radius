'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Building2, Mail, Phone, MapPin, Globe, Save, Loader2, RotateCcw, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { setCurrentTimezone } from '@/lib/timezone';
import Swal from 'sweetalert2';

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface CompanySettings {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  baseUrl: string;
  timezone: string;
  bankAccounts: BankAccount[];
  poweredBy: string;
  footerAdmin: string;
  footerCustomer: string;
  footerTechnician: string;
  footerCoordinator: string;
  invoiceGenerateDays: number;
}

export default function CompanySettingsPage() {
  const { t } = useTranslation();
  const { setCompany } = useAppStore();
  const [settings, setSettings] = useState<CompanySettings>({
    name: '',
    email: '',
    phone: '',
    address: '',
    baseUrl: '',
    timezone: 'Asia/Jakarta',
    bankAccounts: [],
    poweredBy: 'SALFANET RADIUS',
    footerAdmin: 'Powered by SALFANET RADIUS',
    footerCustomer: 'Powered by SALFANET RADIUS',
    footerTechnician: 'Powered by SALFANET RADIUS',
    footerCoordinator: 'Powered by SALFANET RADIUS',
    invoiceGenerateDays: 7
  });
  const [numBankAccounts, setNumBankAccounts] = useState(0);
  const [initialTimezone, setInitialTimezone] = useState('Asia/Jakarta');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/company');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          const bankAccounts = data.bankAccounts || [];
          setSettings({
            id: data.id || '',
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
            baseUrl: data.baseUrl || '',
            timezone: data.timezone || 'Asia/Jakarta',
            bankAccounts: bankAccounts,
            poweredBy: data.poweredBy || 'SALFANET RADIUS',
            footerAdmin: data.footerAdmin || 'Powered by SALFANET RADIUS',
            footerCustomer: data.footerCustomer || 'Powered by SALFANET RADIUS',
            footerTechnician: data.footerTechnician || 'Powered by SALFANET RADIUS',
            footerCoordinator: data.footerCoordinator || 'Powered by SALFANET RADIUS',
            invoiceGenerateDays: data.invoiceGenerateDays || 7,
          });
          setNumBankAccounts(bankAccounts.length);
          setInitialTimezone(data.timezone || 'Asia/Jakarta');
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if timezone has changed
  const timezoneChanged = settings.timezone !== initialTimezone;

  // Handle restart services
  const handleRestartServices = async () => {
    setRestarting(true);
    try {
      Swal.fire({
        title: 'Memproses...',
        html: `
          <div class="text-left">
            <p class="mb-2">Menyimpan dan menerapkan perubahan timezone...</p>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const restartResponse = await fetch('/api/settings/restart-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: 'all', delay: 2000 })
      });

      const restartResult = await restartResponse.json();

      if (restartResult.success) {
        if (restartResult.autoRestarted) {
          // Linux production - services will restart
          Swal.fire({
            icon: 'success',
            title: 'Services Restarting',
            html: `
              <div class="text-left">
                <p class="mb-2">✅ Settings tersimpan!</p>
                <p class="mb-2">🔄 Timezone diupdate di semua komponen:</p>
                <ul class="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>✅ System Timezone (timedatectl)</li>
                  <li>✅ MySQL Timezone (NOW(), datetime functions)</li>
                  <li>✅ Node.js/PM2 Environment (TZ)</li>
                  <li>✅ Application Config (.env, ecosystem)</li>
                  <li>🔄 PM2 sedang restart...</li>
                  <li>🔄 FreeRADIUS sedang restart...</li>
                </ul>
                <p class="mt-3 text-xs text-muted-foreground">Halaman akan reload dalam 5 detik...</p>
              </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            timer: 5000,
          });
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        } else {
          // Development mode (Windows/Mac) - no restart needed
          Swal.fire({
            icon: 'success',
            title: 'Timezone Updated! ✅',
            html: `
              <div class="text-left">
                <p class="mb-3 text-success font-medium">Perubahan timezone berhasil diterapkan!</p>
                <div class="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3">
                  <p class="text-sm text-blue-800">
                    <strong>Development Mode:</strong> Timezone sudah langsung aktif di frontend.
                  </p>
                  <p class="text-xs text-muted-foreground mt-2">
                    💡 Di production (Linux), MySQL timezone dan system timezone juga akan diupdate.
                  </p>
                </div>
                ${restartResult.note ? `<p class="text-xs text-muted-foreground mt-2">💡 ${restartResult.note}</p>` : ''}
              </div>
            `,
            confirmButtonText: 'OK',
            confirmButtonColor: '#14b8a6',
          }).then(() => {
            window.location.reload();
          });
        }
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Auto Restart Not Available',
          html: `
            <p class="mb-2">${restartResult.message}</p>
            <p class="text-sm text-muted-foreground">Silakan restart manual dengan command:</p>
            <div class="mt-3 p-3 bg-gray-900 text-gray-100 rounded text-xs font-mono text-left">
              pm2 restart all --update-env<br/>
              sudo systemctl restart freeradius
            </div>
          `,
        });
      }
    } catch (error) {
      console.error('Restart error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Restart Failed',
        html: `
          <p class="mb-2">Gagal restart services otomatis.</p>
          <p class="text-sm text-muted-foreground">Silakan restart manual:</p>
          <div class="mt-3 p-3 bg-gray-900 text-gray-100 rounded text-xs font-mono text-left">
            pm2 restart all --update-env<br/>
            sudo systemctl restart freeradius
          </div>
        `,
      });
    } finally {
      setRestarting(false);
    }
  };

  // Handle save and restart
  const handleSaveAndRestart = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setCompany({
          name: settings.name,
          email: settings.email,
          phone: settings.phone,
          address: settings.address,
          baseUrl: settings.baseUrl,
          timezone: settings.timezone,
          poweredBy: settings.poweredBy,
        });
        setCurrentTimezone(settings.timezone);
        setInitialTimezone(settings.timezone);

        setSaving(false);
        await handleRestartServices();
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      setSaving(false);
      Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: t('settings.saveSettingsFailed')
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        // Update global store with new settings (including timezone)
        setCompany({
          name: settings.name,
          email: settings.email,
          phone: settings.phone,
          address: settings.address,
          baseUrl: settings.baseUrl,
          timezone: settings.timezone,
          poweredBy: settings.poweredBy,
        });

        // Update timezone library
        setCurrentTimezone(settings.timezone);
        setInitialTimezone(settings.timezone);

        Swal.fire({
          icon: 'success',
          title: t('common.success'),
          text: t('settings.companySaved'),
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(t('common.saveFailed'));
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: t('settings.saveSettingsFailed')
      });
    } finally {
      setSaving(false);
    }
  };

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
              <Building2 className="w-6 h-6 text-[#00f7ff]" />
              <span>{t('settings.companySettings')}</span>
            </h1>
            <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('settings.manageCompanyInfo')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-border p-3">
            <div className="space-y-3">
              {/* Nama Perusahaan */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                  <Building2 className="w-3 h-3" />
                  {t('settings.companyName')}
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                  placeholder="Nama perusahaan Anda"
                  required
                />
              </div>

              {/* Email & Phone - 2 columns on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                    placeholder="email@perusahaan.com"
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                    <Phone className="w-3 h-3" />
                    {t('settings.phone')}
                  </label>
                  <input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                    placeholder="08xxxxxxxxxx"
                    required
                  />
                </div>
              </div>

              {/* Alamat */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                  <MapPin className="w-3 h-3" />
                  {t('settings.address')}
                </label>
                <textarea
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                  rows={2}
                  placeholder="Alamat lengkap perusahaan"
                  required
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                  <Globe className="w-3 h-3" />
                  Base URL
                </label>
                <input
                  type="url"
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                  placeholder="https://billing.domain.com"
                  required
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{t('settings.baseUrlHelp')}</p>
              </div>

              {/* Invoice Generate Days */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                  📅 {t('settings.invoiceGenerateDays')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.invoiceGenerateDays}
                  onChange={(e) => setSettings({ ...settings, invoiceGenerateDays: parseInt(e.target.value) || 7 })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                  placeholder="7"
                  required
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{t('settings.invoiceGenerateDaysHelp')}</p>
              </div>

              {/* Bank Accounts */}
              <div className="border-t border-border pt-3">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-2">
                  🏦 {t('settings.bankAccountsTitle')}
                </label>
                <div className="mb-3">
                  <label className="text-[10px] text-muted-foreground mb-1 block">{t('settings.numberOfAccounts')}</label>
                  <select
                    value={numBankAccounts}
                    onChange={(e) => {
                      const count = parseInt(e.target.value);
                      setNumBankAccounts(count);
                      const newAccounts = Array.from({ length: count }, (_, i) =>
                        settings.bankAccounts[i] || { bankName: '', accountNumber: '', accountName: '' }
                      );
                      setSettings({ ...settings, bankAccounts: newAccounts });
                    }}
                    className="w-32 px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card"
                  >
                    <option value="0">{t('settings.noAccounts')}</option>
                    <option value="1">1 {t('settings.accountsCount').replace('{count}', '1')}</option>
                    <option value="2">2 {t('settings.accountsCount').replace('{count}', '2')}</option>
                    <option value="3">3 {t('settings.accountsCount').replace('{count}', '3')}</option>
                    <option value="4">4 {t('settings.accountsCount').replace('{count}', '4')}</option>
                    <option value="5">5 {t('settings.accountsCount').replace('{count}', '5')}</option>
                  </select>
                </div>

                {numBankAccounts > 0 && (
                  <div className="space-y-3">
                    {settings.bankAccounts.map((account, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg border border-border">
                        <h4 className="text-xs font-medium text-foreground mb-2">{t('settings.accountNumber')}{index + 1}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">{t('settings.bankName')}</label>
                            <input
                              type="text"
                              value={account.bankName}
                              onChange={(e) => {
                                const newAccounts = [...settings.bankAccounts];
                                newAccounts[index].bankName = e.target.value;
                                setSettings({ ...settings, bankAccounts: newAccounts });
                              }}
                              className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
                              placeholder={t('settings.bankNamePlaceholder')}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">{t('settings.accountNo')}</label>
                            <input
                              type="text"
                              value={account.accountNumber}
                              onChange={(e) => {
                                const newAccounts = [...settings.bankAccounts];
                                newAccounts[index].accountNumber = e.target.value;
                                setSettings({ ...settings, bankAccounts: newAccounts });
                              }}
                              className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
                              placeholder="1234567890"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">{t('settings.ownerName')}</label>
                            <input
                              type="text"
                              value={account.accountName}
                              onChange={(e) => {
                                const newAccounts = [...settings.bankAccounts];
                                newAccounts[index].accountName = e.target.value;
                                setSettings({ ...settings, bankAccounts: newAccounts });
                              }}
                              className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
                              placeholder={t('settings.ownerNamePlaceholder')}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-muted-foreground">{t('settings.bankAccountsHelp')}</p>
              </div>

              {/* Powered By */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                  <Zap className="w-3 h-3" />
                  {t('settings.poweredBy')}
                </label>
                <input
                  type="text"
                  value={settings.poweredBy}
                  onChange={(e) => setSettings({ ...settings, poweredBy: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                  placeholder="SALFANET RADIUS"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{t('settings.poweredByHelp')}</p>
              </div>

              {/* Footer Settings Section */}
              <div className="col-span-2 border-t border-border pt-4 mt-2">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  Pengaturan Footer
                </h3>
                <p className="text-[10px] text-muted-foreground mb-4">
                  Atur teks footer yang ditampilkan di halaman login untuk setiap portal
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Admin Footer */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                      🔒 Footer Admin
                    </label>
                    <input
                      type="text"
                      value={settings.footerAdmin}
                      onChange={(e) => setSettings({ ...settings, footerAdmin: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                      placeholder="Powered by SALFANET RADIUS"
                    />
                  </div>

                  {/* Customer Footer */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                      👤 Footer Customer
                    </label>
                    <input
                      type="text"
                      value={settings.footerCustomer}
                      onChange={(e) => setSettings({ ...settings, footerCustomer: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                      placeholder="Powered by SALFANET RADIUS"
                    />
                  </div>

                  {/* Technician Footer */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                      🔧 Footer Teknisi
                    </label>
                    <input
                      type="text"
                      value={settings.footerTechnician}
                      onChange={(e) => setSettings({ ...settings, footerTechnician: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                      placeholder="Powered by SALFANET RADIUS"
                    />
                  </div>

                  {/* Coordinator Footer */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                      📊 Footer Koordinator
                    </label>
                    <input
                      type="text"
                      value={settings.footerCoordinator}
                      onChange={(e) => setSettings({ ...settings, footerCoordinator: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                      placeholder="Powered by SALFANET RADIUS"
                    />
                  </div>
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground mb-1">
                  🌍 Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-card focus:ring-1 focus:ring-ring focus:border-primary"
                  required
                >
                  <optgroup label="Indonesia">
                    <option value="Asia/Jakarta">WIB - Jakarta, Sumatera, Jawa, Kalimantan Barat/Tengah (UTC+7)</option>
                    <option value="Asia/Makassar">WITA - Bali, NTB, NTT, Sulawesi, Kalimantan Selatan/Timur (UTC+8)</option>
                    <option value="Asia/Jayapura">WIT - Maluku, Papua (UTC+9)</option>
                  </optgroup>
                  <optgroup label="Asia Tenggara">
                    <option value="Asia/Singapore">Singapore (SGT - UTC+8)</option>
                    <option value="Asia/Kuala_Lumpur">Malaysia (MYT - UTC+8)</option>
                    <option value="Asia/Bangkok">Thailand (ICT - UTC+7)</option>
                    <option value="Asia/Manila">Philippines (PHT - UTC+8)</option>
                    <option value="Asia/Ho_Chi_Minh">Vietnam (ICT - UTC+7)</option>
                  </optgroup>
                  <optgroup label="Asia Lainnya">
                    <option value="Asia/Dubai">UAE (GST - UTC+4)</option>
                    <option value="Asia/Riyadh">Saudi Arabia (AST - UTC+3)</option>
                    <option value="Asia/Tokyo">Japan (JST - UTC+9)</option>
                    <option value="Asia/Seoul">South Korea (KST - UTC+9)</option>
                    <option value="Asia/Hong_Kong">Hong Kong (HKT - UTC+8)</option>
                  </optgroup>
                  <optgroup label="Australia & Pacific">
                    <option value="Australia/Sydney">Australia Sydney (AEDT - UTC+11)</option>
                    <option value="Australia/Melbourne">Australia Melbourne (AEDT - UTC+11)</option>
                    <option value="Pacific/Auckland">New Zealand (NZDT - UTC+13)</option>
                  </optgroup>
                </select>
                <div className="mt-1.5 p-2 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-[10px] text-warning">
                    ⚠️ <strong>{t('settings.timezoneWarningTitle')}</strong> {t('settings.timezoneWarning1')}
                  </p>
                  <ul className="mt-1 ml-4 text-[10px] text-warning/80 list-disc space-y-0.5">
                    <li>{t('settings.timezoneWarning1')}</li>
                    <li>{t('settings.timezoneWarning2')}</li>
                    <li>{t('settings.timezoneWarning3')}</li>
                    <li>{t('settings.timezoneWarning4')}</li>
                    <li>{t('settings.timezoneWarning5')}</li>
                  </ul>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={saving || restarting}
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('settings.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      {t('settings.saveSettings')}
                    </>
                  )}
                </button>

                {/* Save & Restart Button - only show when timezone changed */}
                {timezoneChanged && (
                  <button
                    type="button"
                    onClick={handleSaveAndRestart}
                    disabled={saving || restarting}
                    className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {restarting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('settings.restarting')}
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3 h-3" />
                        {t('settings.saveAndRestart')}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Timezone change indicator */}
              {timezoneChanged && (
                <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-[10px] text-warning">
                    🔄 {t('settings.timezoneChangedNote')}
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
