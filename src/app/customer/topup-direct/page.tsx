'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Loader2, CreditCard, CheckCircle, AlertCircle, Upload, Zap } from 'lucide-react';
import Swal from 'sweetalert2';
import { CyberCard, CyberButton } from '@/components/cyberpunk';
import { useTranslation } from '@/hooks/useTranslation';

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

interface User {
  username: string;
  name: string;
  email: string | null;
  phone: string;
  balance: number;
}

export default function TopUpDirectPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Preset amounts
  const presetAmounts = [50000, 100000, 200000, 500000, 1000000];

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      console.log('[Top-Up Direct] Loading data...');

      // Load user info
      const userRes = await fetch('/api/customer/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();
      console.log('[Top-Up Direct] User data:', userData);

      if (userData.success && userData.user) {
        setUser(userData.user);
      }

      // Load payment gateways
      console.log('[Top-Up Direct] Fetching payment gateways from /api/public/payment-gateways');
      const gatewaysRes = await fetch('/api/public/payment-gateways');
      console.log('[Top-Up Direct] Gateway response status:', gatewaysRes.status);

      const gatewaysData = await gatewaysRes.json();
      console.log('[Top-Up Direct] Payment gateways response:', gatewaysData);

      if (gatewaysData.success) {
        const gateways = gatewaysData.gateways || [];
        console.log('[Top-Up Direct] Gateways found:', gateways.length, gateways);
        setPaymentGateways(gateways);

        // Auto select first gateway
        if (gateways.length > 0) {
          console.log('[Top-Up Direct] Auto-selecting gateway:', gateways[0].provider);
          setSelectedGateway(gateways[0].provider);
        } else {
          console.warn('[Top-Up Direct] No payment gateways available!');
        }
      } else {
        console.error('[Top-Up Direct] Failed to load gateways:', gatewaysData.error);
      }
    } catch (error) {
      console.error('[Top-Up Direct] Load data error:', error);
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    const topupAmount = parseInt(amount);

    if (!topupAmount || topupAmount < 10000) {
      setError(t('customer.minimumTopupLabel'));
      return;
    }

    if (!selectedGateway) {
      setError(t('customer.selectPaymentFirst'));
      return;
    }

    setProcessing(true);
    setError('');
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/topup-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: topupAmount,
          gateway: selectedGateway
        })
      });

      const data = await res.json();

      console.log('[Top-Up Direct Frontend] Response status:', res.status);
      console.log('[Top-Up Direct Frontend] Response data:', data);

      if (!res.ok || data.error || !data.success) {
        // Show error with details
        const errorMsg = data.error || data.details || data.message || t('customer.invoiceCreationError');
        console.error('[Top-Up Direct Frontend] Error:', errorMsg);

        await Swal.fire({
          icon: 'error',
          title: t('customer.paymentCreationFailed'),
          html: `
            <div class="text-left">
              <p class="text-sm text-red-400 mb-2">${errorMsg}</p>
              ${data.gateway ? `<p class="text-xs text-gray-400">Gateway: ${data.gateway}</p>` : ''}
            </div>
          `,
          confirmButtonText: 'OK',
          confirmButtonColor: '#00f7ff',
          background: '#0f0624',
          color: '#fff'
        });
        setError(errorMsg);
        return;
      }

      if (data.success && data.paymentUrl) {
        // Success - redirect to payment
        console.log('[Top-Up Direct Frontend] Redirecting to:', data.paymentUrl);

        await Swal.fire({
          icon: 'success',
          title: t('common.success'),
          html: `
            <p class="mb-2 text-white">${t('customer.topupInvoiceCreated')}</p>
            <p class="text-sm text-gray-300">${t('customer.invoiceNo')}: <strong class="text-[#00f7ff]">${data.invoiceNumber}</strong></p>
            <p class="text-sm text-gray-300 mb-3">${t('customer.total')}: <strong class="text-[#00f7ff]">${formatCurrency(data.amount)}</strong></p>
            <p class="text-sm font-semibold text-green-400">${t('customer.redirectingToPayment')}</p>
          `,
          timer: 1500,
          timerProgressBar: true,
          showConfirmButton: false,
          background: '#0f0624',
          color: '#fff'
        });

        // Redirect to payment gateway
        setTimeout(() => {
          window.location.href = data.paymentUrl;
        }, 1500);
      } else {
        // Success but no payment URL (shouldn't happen with new code)
        console.warn('[Top-Up Direct Frontend] No payment URL in response');

        await Swal.fire({
          icon: 'warning',
          title: t('common.attention'),
          html: `
            <p class="mb-2 text-white">${t('customer.invoiceCreatedNoLink')}</p>
            <p class="text-sm text-gray-300">${t('customer.invoiceNo')}: <strong class="text-[#00f7ff]">${data.invoiceNumber}</strong></p>
            <p class="text-sm text-yellow-400 mt-2">${t('customer.contactAdmin')}</p>
          `,
          confirmButtonText: t('nav.backToDashboard'),
          confirmButtonColor: '#00f7ff',
          background: '#0f0624',
          color: '#fff'
        });

        router.push('/customer');
      }
    } catch (error: any) {
      console.error('[Top-Up Direct Frontend] Fetch error:', error);

      await Swal.fire({
        icon: 'error',
        title: t('customer.connectionError'),
        text: t('customer.failedContactServer'),
        confirmButtonText: 'OK',
        confirmButtonColor: '#00f7ff',
        background: '#0f0624',
        color: '#fff'
      });

      setError(t('customer.serverConnectionFailed'));
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);

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
      <header className="relative z-10 bg-gradient-to-r from-[#00f7ff]/20 to-[#bc13fe]/20 backdrop-blur-xl border-b-2 border-[#00f7ff]/30 shadow-[0_0_30px_rgba(0,247,255,0.2)]">
        <div className="max-w-3xl mx-auto px-3 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/customer')}
            className="p-2 bg-slate-800/50 border border-[#bc13fe]/40 text-[#00f7ff] rounded-xl hover:bg-[#bc13fe]/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{t('customer.directTopup')}</h1>
            <p className="text-xs text-[#e0d0ff]/70">{t('customer.directTopupDesc')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-6 space-y-5 pb-32 relative z-10">
        {/* Current Balance */}
        {user && (
          <CyberCard className="p-5 bg-card/80 backdrop-blur-xl border-2 border-[#00f7ff]/30 shadow-[0_0_30px_rgba(0,247,255,0.15)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#00f7ff]/20 rounded-lg border border-[#00f7ff]/30 shadow-[0_0_10px_rgba(0,247,255,0.3)]">
                <Wallet className="w-5 h-5 text-[#00f7ff] drop-shadow-[0_0_5px_rgba(0,247,255,0.8)]" />
              </div>
              <span className="text-sm text-[#e0d0ff]/70 uppercase tracking-wider">{t('customer.currentBalance')}</span>
            </div>
            <h3 className="text-3xl font-bold text-[#00f7ff] drop-shadow-[0_0_15px_rgba(0,247,255,0.6)]">
              {formatCurrency(user.balance || 0)}
            </h3>
          </CyberCard>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Amount Selection */}
        <CyberCard className="p-5 bg-card/80 backdrop-blur-xl border-2 border-[#bc13fe]/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#bc13fe]/20 rounded-lg border border-[#bc13fe]/30">
              <Zap className="w-5 h-5 text-[#bc13fe]" />
            </div>
            <h2 className="text-sm font-bold text-[#bc13fe] uppercase tracking-wider">{t('customer.selectTopupAmount')}</h2>
          </div>

          {/* Preset Amounts */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset.toString())}
                className={`p-4 rounded-xl border-2 transition-all text-left ${amount === preset.toString()
                    ? 'border-[#00f7ff] bg-[#00f7ff]/10 shadow-[0_0_20px_rgba(0,247,255,0.3)]'
                    : 'border-[#bc13fe]/30 bg-slate-900/50 hover:border-[#00f7ff]/50 hover:shadow-[0_0_15px_rgba(0,247,255,0.15)]'
                  }`}
              >
                <p className="text-xs text-[#e0d0ff]/60 mb-1 uppercase tracking-wide">Top-Up</p>
                <p className="font-bold text-[#00f7ff] drop-shadow-[0_0_8px_rgba(0,247,255,0.5)]">{formatCurrency(preset)}</p>
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div>
            <label className="block text-xs font-medium text-[#00f7ff] mb-2 uppercase tracking-wide">{t('customer.orEnterOtherAmount')}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#e0d0ff]/60">Rp</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('customer.minimumAmount')}
                className="w-full pl-12 pr-4 py-3 border-2 border-[#bc13fe]/40 rounded-xl bg-slate-900/80 text-white placeholder-[#e0d0ff]/40 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 focus:shadow-[0_0_15px_rgba(0,247,255,0.2)] transition-all"
                min="10000"
                step="10000"
              />
            </div>
            <p className="text-xs text-[#e0d0ff]/50 mt-2">
              {t('customer.minimumTopupLabel')}
            </p>
          </div>
        </CyberCard>

        {/* Payment Gateway Selection */}
        {amount && parseInt(amount) >= 10000 && (
          <CyberCard className="p-5 bg-card/80 backdrop-blur-xl border-2 border-[#ff44cc]/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#ff44cc]/20 rounded-lg border border-[#ff44cc]/30">
                <CreditCard className="w-5 h-5 text-[#ff44cc]" />
              </div>
              <h2 className="text-sm font-bold text-[#ff44cc] uppercase tracking-wider">{t('customer.paymentMethod')}</h2>
            </div>

            {paymentGateways.length === 0 ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl">
                  <p className="text-sm text-amber-400 mb-2">
                    ⚠️ {t('customer.noActiveGateway')}
                  </p>
                  <p className="text-xs text-amber-300/70">
                    {t('customer.contactAdminOrManualRequest')}
                  </p>
                </div>

                {/* Alternative Actions */}
                <div className="space-y-3">
                  <CyberButton
                    onClick={() => router.push('/customer/topup-request')}
                    className="w-full"
                    variant="purple"
                  >
                    <Upload className="w-4 h-4" />
                    {t('customer.manualRequest')}
                  </CyberButton>

                  <button
                    onClick={() => {
                      const whatsappNumber = '6281234567890'; // Ganti dengan nomor admin
                      const message = `Halo Admin, saya ingin top-up saldo sebesar Rp ${parseInt(amount).toLocaleString('id-ID')} tapi payment gateway tidak aktif. Mohon bantuan.`;
                      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="w-full py-3 bg-green-500/20 border-2 border-green-500/40 text-green-400 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-500/30 transition-all"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    {t('customer.contactAdminWhatsApp')}
                  </button>

                  <button
                    onClick={() => router.push('/customer')}
                    className="w-full py-3 bg-slate-700/50 border border-slate-600/50 text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t('nav.backToDashboard')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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

                {/* Payment Button */}
                {selectedGateway && (
                  <CyberButton
                    onClick={handleTopUp}
                    disabled={processing}
                    className="w-full"
                    variant="cyan"
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('customer.processingPayment')}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        {t('customer.pay')} {formatCurrency(parseInt(amount))}
                      </>
                    )}
                  </CyberButton>
                )}

                <p className="text-xs text-[#e0d0ff]/50 text-center">
                  {t('customer.paymentRedirectInfo')}
                </p>
              </div>
            )}
          </CyberCard>
        )}
      </main>
    </div>
  );
}
