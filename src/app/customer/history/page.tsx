'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Receipt, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  CreditCard,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { CyberCard, CyberButton } from '@/components/cyberpunk';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Hardcoded Indonesian translations
const translations: Record<string, string> = {
  'invoices.paid': 'Lunas',
  'invoices.pending': 'Menunggu',
  'invoices.overdue': 'Terlambat',
  'invoices.dueDate': 'Jatuh Tempo',
  'invoices.payNow': 'Bayar Sekarang',
  'invoices.paidOn': 'Dibayar pada',
  'invoices.unpaid': 'Belum Bayar',
  'common.created': 'Dibuat',
  'customer.paymentHistory': 'Riwayat Pembayaran',
  'customer.viewInvoiceStatus': 'Lihat status invoice Anda',
  'customer.noPaymentHistory': 'Belum ada riwayat pembayaran',
  'customer.noInvoices': 'Tidak Ada Tagihan',
  'customer.noInvoiceHistory': 'Belum ada tagihan yang dicatat',
  'customerNav.home': 'Beranda',
  'customerNav.history': 'Riwayat',
  'customerNav.support': 'Tiket',
  'customerNav.profile': 'Akun',
};

const t = (key: string) => translations[key] || key;

interface PaymentHistory {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentToken: string | null;
  createdAt: string;
  paymentLink: string | null;
}

export default function PaymentHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadPaymentHistory();
  }, [router]);

  const loadPaymentHistory = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await fetch('/api/customer/payment-history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error('Load payment history error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPaymentHistory();
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(amount);

  const formatDate = (dateStr: string) => 
    new Date(dateStr).toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });

  const formatDateTime = (dateStr: string) => 
    new Intl.DateTimeFormat('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateStr));

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PAID':
        return {
          icon: CheckCircle,
          text: t('invoices.paid'),
          bgColor: 'bg-success/20',
          textColor: 'text-success',
          borderColor: 'border-success/40 shadow-[0_0_5px_rgba(0,255,136,0.3)]'
        };
      case 'PENDING':
        return {
          icon: Clock,
          text: t('invoices.pending'),
          bgColor: 'bg-warning/20',
          textColor: 'text-warning',
          borderColor: 'border-warning/40 shadow-[0_0_5px_rgba(255,170,0,0.3)]'
        };
      case 'OVERDUE':
        return {
          icon: AlertCircle,
          text: t('invoices.overdue'),
          bgColor: 'bg-destructive/20',
          textColor: 'text-destructive',
          borderColor: 'border-destructive/40 shadow-[0_0_5px_rgba(255,51,102,0.3)]'
        };
      default:
        return {
          icon: Clock,
          text: status,
          bgColor: 'bg-muted/20',
          textColor: 'text-muted-foreground',
          borderColor: 'border-muted/40'
        };
    }
  };

  const handlePayNow = (payment: PaymentHistory) => {
    if (payment.paymentToken) {
      window.open(`/pay/${payment.paymentToken}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary shadow-[0_0_15px_rgba(188,19,254,0.5)]" />
      </div>
    );
  }

  const pendingPayments = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE');
  const paidPayments = payments.filter(p => p.status === 'PAID');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-xl border-b-2 border-primary/30 sticky top-0 z-10 shadow-[0_0_30px_rgba(188,19,254,0.2)]">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/customer')} className="p-1.5 hover:bg-primary/20 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-primary" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-primary drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]">{t('customer.paymentHistory')}</h1>
            <p className="text-[10px] text-accent">{t('customer.viewInvoiceStatus')}</p>
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="p-2 bg-primary/20 rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-50 border border-primary/30"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        {/* Pending Payments Section */}
        {pendingPayments.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-warning flex items-center gap-2 drop-shadow-[0_0_5px_rgba(255,170,0,0.5)]">
              <Clock className="w-4 h-4" />
              {t('invoices.unpaid')} ({pendingPayments.length})
            </h2>
            
            {pendingPayments.map((payment) => {
              const config = getStatusConfig(payment.status);
              const StatusIcon = config.icon;
              
              return (
                <CyberCard 
                  key={payment.id} 
                  className={`p-4 bg-card/80 backdrop-blur-xl border-2 ${config.borderColor}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium text-white">{payment.invoiceNumber}</p>
                      <p className="text-[10px] text-accent flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {t('invoices.dueDate')}: {formatDate(payment.dueDate)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.text}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{formatCurrency(payment.amount)}</span>
                    
                    {payment.paymentToken && (
                      <CyberButton
                        onClick={() => handlePayNow(payment)}
                        variant="cyan"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {t('invoices.payNow')}
                      </CyberButton>
                    )}
                  </div>
                </CyberCard>
              );
            })}
          </div>
        )}

        {/* Paid Payments Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-success flex items-center gap-2 drop-shadow-[0_0_5px_rgba(0,255,136,0.5)]">
            <CheckCircle className="w-4 h-4" />
            {t('invoices.paid')} ({paidPayments.length})
          </h2>
          
          {paidPayments.length === 0 ? (
            <CyberCard className="p-6 text-center bg-card/80 backdrop-blur-xl border-2 border-primary/30">
              <Receipt className="w-10 h-10 mx-auto mb-2 text-primary/50" />
              <p className="text-sm text-muted-foreground">{t('customer.noPaymentHistory')}</p>
            </CyberCard>
          ) : (
            paidPayments.map((payment) => (
              <CyberCard 
                key={payment.id} 
                className="p-4 bg-card/80 backdrop-blur-xl border-2 border-success/30 shadow-[0_0_20px_rgba(0,255,136,0.1)]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-medium text-white">{payment.invoiceNumber}</p>
                    <p className="text-[10px] text-accent mt-0.5">
                      {t('common.created')}: {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg border bg-success/20 text-success border-success/40 shadow-[0_0_5px_rgba(0,255,136,0.3)]">
                    <CheckCircle className="w-3 h-3" />
                    {t('invoices.paid')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{formatCurrency(payment.amount)}</span>
                  {payment.paidAt && (
                    <span className="text-[10px] text-success flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t('invoices.paidOn')} {formatDateTime(payment.paidAt)}
                    </span>
                  )}
                </div>
              </CyberCard>
            ))
          )}
        </div>

        {/* Empty State */}
        {payments.length === 0 && (
          <CyberCard className="p-8 text-center bg-card/80 backdrop-blur-xl border-2 border-primary/30">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-primary drop-shadow-[0_0_10px_rgba(188,19,254,0.5)]" />
            <h3 className="text-sm font-medium text-white mb-1">{t('customer.noInvoices')}</h3>
            <p className="text-xs text-muted-foreground">{t('customer.noInvoiceHistory')}</p>
          </CyberCard>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t-2 border-primary/30 safe-area-inset-bottom shadow-[0_-5px_30px_rgba(188,19,254,0.2)]">
        <div className="max-w-3xl mx-auto flex justify-around py-2">
          <button onClick={() => router.push('/customer')} className="flex flex-col items-center py-1.5 px-4 text-muted-foreground hover:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] mt-0.5">{t('customerNav.home')}</span>
          </button>
          <button className="flex flex-col items-center py-1.5 px-4 text-primary drop-shadow-[0_0_10px_rgba(188,19,254,0.8)]">
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-bold">{t('customerNav.history')}</span>
          </button>
          <button onClick={() => router.push('/customer/support')} className="flex flex-col items-center py-1.5 px-4 text-muted-foreground hover:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span className="text-[10px] mt-0.5">{t('customerNav.support')}</span>
          </button>
          <button onClick={() => router.push('/customer/profile')} className="flex flex-col items-center py-1.5 px-4 text-muted-foreground hover:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-[10px] mt-0.5">{t('customerNav.profile')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
