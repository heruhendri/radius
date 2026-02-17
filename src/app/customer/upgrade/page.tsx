'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Loader2, CheckCircle, Zap, AlertCircle, CreditCard } from 'lucide-react';
import Swal from 'sweetalert2';
import { CyberCard, CyberButton } from '@/components/cyberpunk';
import { useTranslation } from '@/hooks/useTranslation';

interface InternetPackage {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  price: number;
  description: string | null;
}

interface CurrentPackage {
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  expiredAt: string;
}

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

export default function UpgradePackagePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<InternetPackage[]>([]);
  const [currentPackage, setCurrentPackage] = useState<CurrentPackage | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, [router]);

  // Debug logging
  useEffect(() => {
    console.log('[Upgrade Page] selectedPackage:', selectedPackage);
  }, [selectedPackage]);

  useEffect(() => {
    console.log('[Upgrade Page] selectedGateway:', selectedGateway);
  }, [selectedGateway]);

  const loadData = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      // Load current user info
      const userRes = await fetch('/api/customer/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setCurrentPackage({
          name: userData.user.profile?.name || 'Unknown',
          downloadSpeed: userData.user.profile?.downloadSpeed || 0,
          uploadSpeed: userData.user.profile?.uploadSpeed || 0,
          expiredAt: userData.user.expiredAt
        });
      }

      // Load available packages
      const packagesRes = await fetch('/api/public/profiles');
      const packagesData = await packagesRes.json();
      if (packagesData.success) {
        setPackages(packagesData.profiles || []);
      }

      // Load payment gateways
      const gatewaysRes = await fetch('/api/public/payment-gateways');
      const gatewaysData = await gatewaysRes.json();
      if (gatewaysData.success) {
        const gateways = gatewaysData.gateways || [];
        console.log('[Upgrade Page] Loaded gateways:', gateways);
        setPaymentGateways(gateways);
        // Auto select first gateway
        if (gateways.length > 0) {
          console.log('[Upgrade Page] Auto-selecting gateway:', gateways[0].provider);
          setSelectedGateway(gateways[0].provider);
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
      setError(t('customer.failedLoadPackages'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedPackage || !selectedGateway) {
      setError(t('customer.selectPackageAndPayment'));
      return;
    }

    setUpgrading(true);
    setError('');
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newProfileId: selectedPackage,
          gateway: selectedGateway
        })
      });
      const data = await res.json();

      if (data.success) {
        // Show success message with payment link
        await Swal.fire({
          icon: 'success',
          title: t('customer.invoiceCreated'),
          html: `
            <p class="mb-2 text-white">${t('customer.upgradeInvoiceCreated')}</p>
            <p class="text-sm text-gray-300">${t('customer.invoiceNo')}: <strong class="text-[#00f7ff]">${data.invoiceNumber}</strong></p>
            <p class="text-sm text-gray-300 mb-3">${t('customer.total')}: <strong class="text-[#00f7ff]">${formatCurrency(data.amount)}</strong></p>
            ${data.paymentUrl ? `<p class="text-sm text-green-400">${t('customer.redirectingPayment')}</p>` : `<p class="text-sm text-yellow-400">${t('customer.contactAdminPayment')}</p>`}
          `,
          confirmButtonText: 'OK',
          confirmButtonColor: '#00f7ff',
          background: '#0f0624',
          color: '#fff'
        });

        // Redirect to payment or customer page
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          router.push('/customer');
        }
      } else {
        setError(data.error || 'Gagal membuat invoice upgrade');
      }
    } catch (error) {
      setError('Gagal menghubungi server');
    } finally {
      setUpgrading(false);
    }
  };

  const formatSpeed = (mbps: number) => {
    if (mbps >= 1000) return `${mbps / 1000} Gbps`;
    return `${mbps} Mbps`;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);

  // Debug render
  console.log('[Upgrade Page] Rendering with:', {
    selectedPackage,
    selectedGateway,
    packagesCount: packages.length,
    gatewaysCount: paymentGateways.length,
    shouldShowButton: !!selectedPackage
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#bc13fe]/15 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#00f7ff]/15 rounded-full blur-[100px] animate-pulse delay-700"></div>
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[400px] bg-[#ff44cc]/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-[#bc13fe]/20 to-[#00f7ff]/20 backdrop-blur-xl border-b-2 border-[#bc13fe]/30 shadow-[0_0_30px_rgba(188,19,254,0.2)]">
        <div className="max-w-3xl mx-auto px-3 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/customer')}
            className="p-2 bg-slate-800/50 border border-[#bc13fe]/40 text-[#00f7ff] rounded-xl hover:bg-[#bc13fe]/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{t('customer.upgradePackage')}</h1>
            <p className="text-xs text-[#e0d0ff]/70">{t('customer.selectPackagePaymentMethod')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-6 space-y-5 pb-8 relative z-10">
        {/* Current Package */}
        {currentPackage && (
          <CyberCard className="p-5 bg-card/80 backdrop-blur-xl border-2 border-[#bc13fe]/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#bc13fe]/20 rounded-lg border border-[#bc13fe]/30 shadow-[0_0_10px_rgba(188,19,254,0.3)]">
                <Package className="w-5 h-5 text-[#bc13fe] drop-shadow-[0_0_5px_rgba(188,19,254,0.8)]" />
              </div>
              <span className="text-xs text-[#e0d0ff]/60 uppercase tracking-wider">{t('customer.currentPackage')}</span>
            </div>
            <h3 className="font-bold text-xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{currentPackage.name}</h3>
            <p className="text-sm text-[#e0d0ff]/70 mt-1">
              {formatSpeed(currentPackage.downloadSpeed)} / {formatSpeed(currentPackage.uploadSpeed)}
            </p>
          </CyberCard>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Available Packages */}
        <CyberCard className="p-5 bg-card/80 backdrop-blur-xl border-2 border-[#00f7ff]/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">{t('customer.selectNewPackage')}</h2>
          </div>

          <div className="space-y-3">
            {packages.map((pkg) => {
              const isCurrentPackage = currentPackage?.name === pkg.name;
              const isSelected = selectedPackage === pkg.id;

              return (
                <button
                  key={pkg.id}
                  onClick={() => !isCurrentPackage && setSelectedPackage(pkg.id)}
                  disabled={isCurrentPackage}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isCurrentPackage
                    ? 'border-slate-600/30 bg-slate-800/30 opacity-50 cursor-not-allowed'
                    : isSelected
                      ? 'border-[#00f7ff] bg-[#00f7ff]/10 shadow-[0_0_20px_rgba(0,247,255,0.3)]'
                      : 'border-[#bc13fe]/30 bg-slate-900/50 hover:border-[#00f7ff]/50 hover:shadow-[0_0_15px_rgba(0,247,255,0.15)]'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-white">{pkg.name}</h3>
                    {isCurrentPackage && (
                      <span className="text-[10px] px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-full border border-slate-600/50">{t('customer.currentPackageBadge')}</span>
                    )}
                    {isSelected && !isCurrentPackage && (
                      <CheckCircle className="w-6 h-6 text-[#00f7ff] drop-shadow-[0_0_8px_rgba(0,247,255,0.8)]" />
                    )}
                  </div>
                  <p className="text-sm text-[#e0d0ff]/70 mb-2">
                    {formatSpeed(pkg.downloadSpeed)} / {formatSpeed(pkg.uploadSpeed)}
                  </p>
                  <p className="text-xl font-bold text-[#00f7ff] drop-shadow-[0_0_8px_rgba(0,247,255,0.5)]">
                    {formatCurrency(pkg.price)}<span className="text-xs font-normal text-[#e0d0ff]/50">/{t('common.month')}</span>
                  </p>
                  {pkg.description && (
                    <p className="text-xs text-[#e0d0ff]/50 mt-2">{pkg.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        </CyberCard>

        {/* Payment Gateway Selection */}
        {selectedPackage && paymentGateways.length > 0 && (
          <CyberCard className="p-5 bg-card/80 backdrop-blur-xl border-2 border-[#ff44cc]/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#ff44cc]/20 rounded-lg border border-[#ff44cc]/30">
                <CreditCard className="w-5 h-5 text-[#ff44cc]" />
              </div>
              <h2 className="text-sm font-bold text-[#ff44cc] uppercase tracking-wider">{t('customer.paymentMethod')}</h2>
            </div>

            <div className="space-y-3">
              {paymentGateways.map((gateway) => (
                <button
                  key={gateway.id}
                  onClick={() => setSelectedGateway(gateway.provider)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedGateway === gateway.provider
                    ? 'border-[#00f7ff] bg-[#00f7ff]/10 shadow-[0_0_20px_rgba(0,247,255,0.3)]'
                    : 'border-[#bc13fe]/30 bg-slate-900/50 hover:border-[#00f7ff]/50'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-800/80 border border-[#bc13fe]/30 rounded-lg">
                        <CreditCard className="w-5 h-5 text-[#00f7ff]" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{gateway.name}</p>
                        <p className="text-xs text-[#e0d0ff]/60 capitalize">{gateway.provider}</p>
                      </div>
                    </div>
                    {selectedGateway === gateway.provider && (
                      <CheckCircle className="w-6 h-6 text-[#00f7ff] drop-shadow-[0_0_8px_rgba(0,247,255,0.8)]" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Payment Button - Inline after gateway selection */}
            {selectedGateway && (
              <CyberButton
                onClick={handleUpgrade}
                disabled={upgrading || !selectedGateway}
                className="w-full mt-4"
                variant="cyan"
                size="lg"
              >
                {upgrading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    {t('customer.payNow')}
                  </>
                )}
              </CyberButton>
            )}

            <p className="text-xs text-[#e0d0ff]/50 text-center mt-3">
              {t('customer.paymentRedirectInfo')}
            </p>
          </CyberCard>
        )}
      </main>
    </div>
  );
}
