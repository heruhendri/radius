'use client';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Calendar,
  Ticket,
  Zap,
  Check,
  X as CloseIcon,
  Wallet,
  Plus,
  RefreshCcw,
  Copy,
} from 'lucide-react';

interface AgentData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  balance: number;
  minBalance: number;
  lastLogin?: string | null;
  voucherStock?: number;
}
interface Deposit {
  id: string;
  amount: number;
  status: string;
  paymentGateway: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
}
interface Deposit {
  id: string;
  amount: number;
  status: string;
  paymentGateway: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
}

interface Profile {
  id: string;
  name: string;
  costPrice: number;
  resellerFee: number;
  sellingPrice: number;
  downloadSpeed: number;
  uploadSpeed: number;
  validityValue: number;
  validityUnit: string;
}

interface Voucher {
  id: string;
  code: string;
  batchCode: string;
  status: string;
  profileName: string;
  sellingPrice: number;
  resellerFee: number;
  routerName: string | null;
  firstLoginAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function AgentDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [stats, setStats] = useState({
    currentMonth: { total: 0, count: 0, income: 0 },
    allTime: { total: 0, count: 0, income: 0 },
    today: { total: 0, count: 0, income: 0 },
    generated: 0,
    waiting: 0,
    sold: 0,
    used: 0,
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [generatedVouchers, setGeneratedVouchers] = useState<Voucher[]>([]);
  const [showVouchersModal, setShowVouchersModal] = useState(false);

  // Deposit functionality
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositGateway, setDepositGateway] = useState('');
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState<{ provider: string; name: string }[]>([]);

  // WhatsApp functionality
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Filter & Pagination
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  useEffect(() => {
    const agentDataStr = localStorage.getItem('agentData');
    if (!agentDataStr) {
      router.push('/agent');
      return;
    }

    const agentData = JSON.parse(agentDataStr);
    setAgent(agentData);
    loadDashboard(agentData.id);
  }, [router]);

  const loadDashboard = async (agentId: string, page = 1, status = '', profileId = '', search = '') => {
    try {
      const params = new URLSearchParams({
        agentId,
        page: page.toString(),
        limit: '20',
      });
      if (status) params.append('status', status);
      if (profileId) params.append('profileId', profileId);
      if (search) params.append('search', search);

      const res = await fetch(`/api/agent/dashboard?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setAgent(data.agent);
        setStats(data.stats || {
          currentMonth: { total: 0, count: 0, income: 0 },
          allTime: { total: 0, count: 0, income: 0 },
          today: { total: 0, count: 0, income: 0 },
          generated: 0,
          waiting: 0,
          sold: 0,
          used: 0,
        });
        setProfiles(data.profiles || []);
        setVouchers(data.vouchers || []);
        setDeposits(data.deposits || []);
        setPaymentGateways(data.paymentGateways || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        if (data.paymentGateways && data.paymentGateways.length > 0) {
          setDepositGateway(data.paymentGateways[0].provider);
        }
        if (data.profiles && data.profiles.length > 0 && !selectedProfile) {
          setSelectedProfile(data.profiles[0].id);
        }
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setCurrentPage(1);
    if (agent) {
      loadDashboard(agent.id, 1, filterStatus, filterProfile, searchCode);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (agent) {
      loadDashboard(agent.id, newPage, filterStatus, filterProfile, searchCode);
    }
  };

  const handleClearFilter = () => {
    setFilterStatus('');
    setFilterProfile('');
    setSearchCode('');
    setCurrentPage(1);
    if (agent) {
      loadDashboard(agent.id, 1, '', '', '');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('agentData');
    router.push('/agent');
  };

  const handleSelectVoucher = (voucherId: string) => {
    setSelectedVouchers(prev =>
      prev.includes(voucherId)
        ? prev.filter(id => id !== voucherId)
        : [...prev, voucherId]
    );
  };

  const handleSelectAll = () => {
    const waitingVouchers = vouchers.filter(v => v.status === 'WAITING').map(v => v.id);
    setSelectedVouchers(waitingVouchers.length === selectedVouchers.length ? [] : waitingVouchers);
  };

  const handleSendWhatsApp = async () => {
    if (selectedVouchers.length === 0) {
      await showError('Pilih voucher terlebih dahulu');
      return;
    }
    setShowWhatsAppDialog(true);
  };

  const handleWhatsAppSubmit = async () => {
    if (!whatsappPhone) {
      await showError('Masukkan nomor WhatsApp');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const vouchersToSend = vouchers.filter(v => selectedVouchers.includes(v.id));

      const vouchersData = vouchersToSend.map(v => {
        const profile = profiles.find(p => p.name === v.profileName);
        return {
          code: v.code,
          profileName: v.profileName,
          price: profile?.sellingPrice || 0,
          validity: profile ? `${profile.validityValue} ${profile.validityUnit.toLowerCase()}` : '-'
        };
      });

      const res = await fetch('/api/hotspot/voucher/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappPhone,
          vouchers: vouchersData
        })
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess(t('agent.portal.whatsappSentSuccess', { phone: whatsappPhone }));
        setShowWhatsAppDialog(false);
        setWhatsappPhone('');
        setSelectedVouchers([]);
      } else {
        await showError(t('common.error') + ': ' + data.error);
      }
    } catch (error) {
      console.error('Send WhatsApp error:', error);
      await showError(t('agent.portal.whatsappSentError'));
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleGenerate = async () => {
    if (!agent || !selectedProfile) return;

    const profile = profiles.find(p => p.id === selectedProfile);
    if (!profile) return;

    const totalCost = profile.costPrice * quantity;

    if (agent.balance < totalCost) {
      const deficit = totalCost - agent.balance;
      const result = await showConfirm(
        t('agent.portal.insufficientBalanceMessage', {
          current: formatCurrency(agent.balance),
          required: formatCurrency(totalCost),
          deficit: formatCurrency(deficit)
        }),
        t('agent.portal.insufficientBalanceTitle')
      );
      if (result) {
        setShowDepositModal(true);
        setDepositAmount(Math.ceil(deficit / 10000) * 10000 + '');
      }
      return;
    }

    const confirmed = await showConfirm(
      t('agent.portal.generateVoucherConfirm', {
        quantity: quantity.toString(),
        profile: profile.name,
        cost: formatCurrency(totalCost),
        balance: formatCurrency(agent.balance),
        after: formatCurrency(agent.balance - totalCost)
      }),
      t('agent.portal.generateVoucherTitle')
    );

    if (!confirmed) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/agent/generate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          profileId: selectedProfile,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setGeneratedVouchers(data.vouchers);
        setShowVouchersModal(true);
        if (data.newBalance !== undefined && agent) {
          setAgent({ ...agent, balance: data.newBalance });
        }
        loadDashboard(agent.id);
        await showSuccess(t('agent.portal.vouchersGeneratedSuccess', {
          count: data.vouchers.length.toString(),
          balance: formatCurrency(data.newBalance || 0)
        }));
      } else {
        if (data.error === 'Insufficient balance') {
          const deficit = data.deficit || 0;
          const result = await showConfirm(
            t('agent.portal.insufficientBalanceMessage', {
              current: formatCurrency(data.current || 0),
              required: formatCurrency(data.required || 0),
              deficit: formatCurrency(deficit)
            }),
            t('agent.portal.insufficientBalanceTitle')
          );
          if (result) {
            setShowDepositModal(true);
            setDepositAmount(Math.ceil(deficit / 10000) * 10000 + '');
          }
        } else {
          await showError(t('common.error') + ': ' + data.error);
        }
      }
    } catch (error) {
      console.error('Generate error:', error);
      await showError(t('agent.portal.voucherGenerateError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateDeposit = async () => {
    if (!agent) return;

    if (paymentGateways.length === 0) {
      await showError(t('agent.portal.paymentGatewayNotConfigured'));
      return;
    }

    const amount = parseInt(depositAmount);
    if (isNaN(amount) || amount < 10000) {
      await showError(t('agent.portal.minimumDeposit'));
      return;
    }

    if (!depositGateway) {
      await showError(t('agent.portal.selectPaymentMethod'));
      return;
    }

    setCreatingDeposit(true);
    try {
      const res = await fetch('/api/agent/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          amount,
          gateway: depositGateway,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.deposit.paymentUrl) {
          window.open(data.deposit.paymentUrl, '_blank');
          await showSuccess(t('agent.portal.paymentLinkOpened'));
          setShowDepositModal(false);
          setDepositAmount('');
          setTimeout(() => loadDashboard(agent.id), 3000);
        }
      } else {
        await showError(t('common.error') + ': ' + data.error);
      }
    } catch (error) {
      console.error('Create deposit error:', error);
      await showError(t('agent.portal.depositCreateError'));
    } finally {
      setCreatingDeposit(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const selectedProfileData = profiles.find(p => p.id === selectedProfile);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center relative z-10">
          <div className="w-10 h-10 border-4 border-[#00f7ff] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_20px_rgba(0,247,255,0.5)]"></div>
          <p className="text-[#e0d0ff]/70">{t('agent.portal.loading')}</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Balance Card - Desktop: smaller, Mobile: full */}
      <div className="bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] rounded-2xl shadow-[0_0_40px_rgba(188,19,254,0.3)] p-4 lg:p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs lg:text-sm opacity-90 uppercase tracking-wider">{t('agent.portal.yourBalance')}</p>
            <p className="text-2xl lg:text-3xl font-bold mt-1 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">{formatCurrency(agent.balance || 0)}</p>
            {agent.minBalance > 0 && (
              <p className="text-[10px] lg:text-xs opacity-75 mt-1">{t('agent.portal.minBalance')}: {formatCurrency(agent.minBalance)}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDepositModal(true)}
              className="flex items-center px-3 lg:px-4 py-2 bg-white hover:bg-white/90 text-[#bc13fe] rounded-xl text-xs lg:text-sm font-bold transition shadow-lg hover:shadow-xl"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t('agent.portal.deposit')}
            </button>
            <button
              onClick={() => agent && loadDashboard(agent.id)}
              className="flex items-center justify-center px-3 py-2 bg-white hover:bg-white/90 text-[#bc13fe] rounded-xl transition shadow-lg hover:shadow-xl min-w-[40px]"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-[#0a0520]/80 backdrop-blur-xl rounded-xl border-2 border-[#00ff88]/30 p-3 lg:p-4 shadow-[0_0_20px_rgba(0,255,136,0.1)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] lg:text-xs text-[#e0d0ff]/70">{t('agent.portal.commissionThisMonth')}</p>
              <p className="text-base lg:text-lg font-bold mt-0.5 text-[#00ff88]">
                {formatCurrency(stats.currentMonth?.total || 0)}
              </p>
            </div>
            <TrendingUp className="h-5 lg:h-6 w-5 lg:w-6 text-[#00ff88] drop-shadow-[0_0_10px_rgba(0,255,136,0.5)]" />
          </div>
        </div>

        <div className="bg-[#0a0520]/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 lg:p-4 shadow-[0_0_20px_rgba(188,19,254,0.1)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] lg:text-xs text-[#e0d0ff]/70">{t('agent.portal.totalCommission')}</p>
              <p className="text-base lg:text-lg font-bold mt-0.5 text-[#bc13fe]">
                {formatCurrency(stats.allTime?.total || 0)}
              </p>
            </div>
            <Calendar className="h-5 lg:h-6 w-5 lg:w-6 text-[#bc13fe] drop-shadow-[0_0_10px_rgba(188,19,254,0.5)]" />
          </div>
        </div>

        <div className="bg-[#0a0520]/80 backdrop-blur-xl rounded-xl border-2 border-[#00f7ff]/30 p-3 lg:p-4 shadow-[0_0_20px_rgba(0,247,255,0.1)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] lg:text-xs text-[#e0d0ff]/70">{t('agent.portal.availableVouchers')}</p>
              <p className="text-base lg:text-lg font-bold mt-0.5 text-white">{stats.waiting || 0}</p>
            </div>
            <Ticket className="h-5 lg:h-6 w-5 lg:w-6 text-[#00f7ff] drop-shadow-[0_0_10px_rgba(0,247,255,0.5)]" />
          </div>
        </div>

        <div className="bg-[#0a0520]/80 backdrop-blur-xl rounded-xl border-2 border-[#ff44cc]/30 p-3 lg:p-4 shadow-[0_0_20px_rgba(255,68,204,0.1)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] lg:text-xs text-[#e0d0ff]/70">{t('agent.portal.usedVouchers')}</p>
              <p className="text-base lg:text-lg font-bold mt-0.5 text-white">{stats.used || 0}</p>
            </div>
            <Check className="h-5 lg:h-6 w-5 lg:w-6 text-[#ff44cc] drop-shadow-[0_0_10px_rgba(255,68,204,0.5)]" />
          </div>
        </div>

        <div className="bg-[#0a0520]/80 backdrop-blur-xl rounded-xl border-2 border-[#00f7ff]/30 p-3 lg:p-4 shadow-[0_0_20px_rgba(0,247,255,0.1)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] lg:text-xs text-[#e0d0ff]/70">{t('agent.portal.todaySales')}</p>
              <p className="text-base lg:text-lg font-bold mt-0.5 text-[#00f7ff]">
                {formatCurrency(stats.today?.total || 0)}
              </p>
              <p className="text-[9px] lg:text-[10px] text-[#e0d0ff]/50 mt-0.5">{stats.today?.count || 0} {t('agent.portal.voucher').toLowerCase()}</p>
            </div>
            <Zap className="h-5 lg:h-6 w-5 lg:w-6 text-[#00f7ff] drop-shadow-[0_0_10px_rgba(0,247,255,0.5)]" />
          </div>
        </div>
      </div>

      {/* Quick Generate */}
      <div className="bg-[#0a0520]/80 backdrop-blur-xl rounded-2xl border-2 border-[#bc13fe]/30 p-4 lg:p-5 shadow-[0_0_30px_rgba(188,19,254,0.15)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-[#ff44cc]/20 rounded-lg border border-[#ff44cc]/30">
              <Zap className="h-5 w-5 text-[#ff44cc] drop-shadow-[0_0_10px_rgba(255,68,204,0.6)]" />
            </div>
            <h2 className="text-base font-bold text-white">{t('agent.portal.generateVoucher')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#e0d0ff]/80 mb-1.5">{t('agent.portal.selectPackage')}</label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-xl text-white focus:border-[#00f7ff] outline-none"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id} className="bg-[#0a0520]">
                    {profile.name} - {formatCurrency(profile.sellingPrice)} - {profile.downloadSpeed}/{profile.uploadSpeed} Mbps
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#e0d0ff]/80 mb-1.5">{t('agent.portal.quantity')}</label>
              <input
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 text-sm bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-xl text-white focus:border-[#00f7ff] outline-none"
              />
            </div>
          </div>

          {selectedProfileData && (
            <div className="mt-3 p-4 bg-gradient-to-br from-[#bc13fe]/10 to-[#00f7ff]/10 rounded-xl border border-[#bc13fe]/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#e0d0ff]/60">{t('agent.portal.costPrice')}</p>
                  <p className="font-semibold text-white">{formatCurrency(selectedProfileData.costPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#e0d0ff]/60">{t('agent.portal.profitPerPiece')}</p>
                  <p className="font-semibold text-[#00ff88]">{formatCurrency(selectedProfileData.resellerFee)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#e0d0ff]/60">{t('agent.portal.speed')}</p>
                  <p className="font-semibold text-white">{selectedProfileData.downloadSpeed}/{selectedProfileData.uploadSpeed} Mbps</p>
                </div>
                <div>
                  <p className="text-xs text-[#e0d0ff]/60">{t('agent.portal.totalPayment')}</p>
                  <p className="font-semibold text-[#00f7ff]">{formatCurrency(selectedProfileData.costPrice * quantity)}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !selectedProfile}
            className="mt-4 w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] hover:from-[#a010e0] hover:to-[#00d4dd] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_25px_rgba(188,19,254,0.4)] hover:shadow-[0_0_35px_rgba(188,19,254,0.6)]"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                {t('agent.portal.generating')}...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {t('agent.portal.generateVoucher')}
              </>
            )}
          </button>
        </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a0f35] border-2 border-[#bc13fe]/50 rounded-2xl shadow-[0_0_50px_rgba(188,19,254,0.3)] max-w-sm w-full">
            <div className="px-5 py-4 border-b border-[#bc13fe]/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#00f7ff]" />
                {t('agent.portal.topUpBalance')}
              </h2>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#e0d0ff] mb-1.5">{t('agent.portal.depositAmount')}</label>
                <input
                  type="number"
                  placeholder={t('agent.portal.minimumDeposit')}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-xl text-white focus:border-[#00f7ff] outline-none"
                  min="10000"
                  step="10000"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#e0d0ff] mb-1.5">{t('agent.portal.paymentMethod')}</label>
                {paymentGateways.length > 0 ? (
                  <select
                    value={depositGateway}
                    onChange={(e) => setDepositGateway(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-xl text-white focus:border-[#00f7ff] outline-none"
                  >
                    {paymentGateways.map((gw) => (
                      <option key={gw.provider} value={gw.provider} className="bg-[#0a0520]">{gw.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-[#ff6b8a] p-3 bg-[#ff4466]/10 rounded-xl border border-[#ff4466]/30">
                    {t('agent.portal.noPaymentGateway')}
                  </div>
                )}
              </div>

              {depositAmount && parseInt(depositAmount) >= 10000 && (
                <div className="bg-gradient-to-br from-[#bc13fe]/20 to-[#00f7ff]/20 p-4 rounded-xl border border-[#bc13fe]/30">
                  <p className="text-sm text-white">
                    {t('agent.portal.totalAmount')}: <span className="font-bold text-[#00f7ff]">{formatCurrency(parseInt(depositAmount))}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[#bc13fe]/20 flex gap-2 justify-end">
              <button
                onClick={() => { setShowDepositModal(false); setDepositAmount(''); }}
                className="px-4 py-2 text-sm text-[#e0d0ff]/70 hover:bg-[#bc13fe]/10 rounded-xl transition"
                disabled={creatingDeposit}
              >
                {t('agent.portal.cancel')}
              </button>
              <button
                onClick={handleCreateDeposit}
                disabled={creatingDeposit || !depositAmount || parseInt(depositAmount) < 10000 || paymentGateways.length === 0}
                className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] hover:from-[#a010e0] hover:to-[#00d4dd] text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingDeposit ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2"></div>{t('agent.portal.processing')}...</>
                ) : (
                  t('agent.portal.payNow')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
