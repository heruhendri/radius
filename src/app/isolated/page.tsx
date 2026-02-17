'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
  CreditCard,
  Phone,
  Mail,
  RefreshCw,
  User,
  Shield,
  Calendar,
  DollarSign,
  Wifi,
} from 'lucide-react';

interface CompanyInfo {
  name: string;
  phone: string;
  email: string;
  logo: string;
  isolationMessage: string;
}

interface UserInfo {
  username: string;
  name: string;
  phone: string;
  email: string;
  expiredAt: string;
  unpaidInvoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    paymentLink: string;
  }>;
}

function IsolatedContent() {
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const ip = searchParams.get('ip');

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetchData();
  }, [username, ip]);

  const fetchData = async () => {
    try {
      const companyRes = await fetch('/api/company/info');
      const companyData = await companyRes.json();

      if (companyData.success) {
        setCompany(companyData.data);
      }

      // Fetch user info by username or IP
      if (username || ip) {
        const params = new URLSearchParams();
        if (username) params.set('username', username);
        if (ip) params.set('ip', ip);
        
        const userRes = await fetch(`/api/pppoe/users/check-isolation?${params.toString()}`);
        const userData = await userRes.json();

        if (userData.success && userData.data) {
          setUserInfo(userData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff4466]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="text-center relative z-10">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-3 text-[#ff44cc] drop-shadow-[0_0_20px_rgba(255,68,204,0.6)]" />
          <p className="text-sm text-[#e0d0ff]/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#ff4466]/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#ff44cc]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#bc13fe]/15 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,68,102,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,68,102,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Company Logo */}
          {company?.logo && (
            <div className="text-center mb-6">
              <img
                src={company.logo}
                alt={company.name}
                className="h-12 md:h-16 mx-auto object-contain"
              />
            </div>
          )}

          {/* Main Alert Card */}
          <div className="bg-[#1a0f35]/80 backdrop-blur-xl rounded-2xl border-2 border-[#ff4466]/50 overflow-hidden shadow-[0_0_50px_rgba(255,68,102,0.2)]">
            {/* Alert Header */}
            <div className="bg-gradient-to-r from-[#ff4466] to-[#ff44cc] p-4 md:p-6">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="bg-white/20 p-3 rounded-full">
                  <Shield className="w-8 h-8 md:w-10 md:h-10 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                </div>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white text-center mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                Akun Anda Diisolir
              </h1>
              <p className="text-white/90 text-center text-xs md:text-sm">
                Layanan Internet Anda Telah Dibatasi
              </p>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6">
              {/* Alert Message */}
              <div className="bg-[#ff44cc]/10 border-l-4 border-[#ff44cc] p-4 mb-5 rounded-r-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#ff44cc] flex-shrink-0 mt-0.5 drop-shadow-[0_0_10px_rgba(255,68,204,0.5)]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#ff44cc] mb-1">
                      Pemberitahuan Penting
                    </h3>
                    <p className="text-xs text-[#e0d0ff]/80">
                      {company?.isolationMessage ||
                        'Akun Anda telah diisolir karena masa berlangganan habis. Silakan lakukan pembayaran untuk mengaktifkan kembali layanan.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Info */}
              {userInfo && (
                <div className="bg-[#0a0520]/50 rounded-xl p-4 mb-5 border border-[#bc13fe]/20">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#00f7ff]" />
                    Informasi Akun
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-[#e0d0ff]/60 uppercase tracking-wider">Username</p>
                      <p className="text-sm font-medium text-white font-mono">{userInfo.username}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[#e0d0ff]/60 uppercase tracking-wider">Nama</p>
                      <p className="text-sm font-medium text-white">{userInfo.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[#e0d0ff]/60 flex items-center gap-1 uppercase tracking-wider">
                        <Calendar className="w-3 h-3 text-[#ff4466]" />
                        Expired Date
                      </p>
                      <p className="text-sm font-medium text-[#ff6b8a]">
                        {formatDate(userInfo.expiredAt)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[#e0d0ff]/60 flex items-center gap-1 uppercase tracking-wider">
                        <Phone className="w-3 h-3 text-[#00f7ff]" />
                        No. Telepon
                      </p>
                      <p className="text-sm font-medium text-white">{userInfo.phone}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Unpaid Invoices */}
              {userInfo && userInfo.unpaidInvoices.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#ff44cc]" />
                    Tagihan Belum Dibayar
                  </h3>
                  <div className="space-y-3">
                    {userInfo.unpaidInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="bg-[#0a0520]/50 border-2 border-[#ff4466]/30 rounded-xl p-4 hover:border-[#ff44cc]/50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-[10px] text-[#e0d0ff]/60 uppercase tracking-wider">No. Invoice</p>
                            <p className="text-sm font-bold text-white">
                              {invoice.invoiceNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-[#e0d0ff]/60 uppercase tracking-wider">Total</p>
                            <p className="text-xl font-bold text-[#ff6b8a] drop-shadow-[0_0_10px_rgba(255,68,138,0.5)]">
                              {formatCurrency(invoice.amount)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs mb-3">
                          <span className="text-[#e0d0ff]/60">Jatuh Tempo:</span>
                          <span className="font-medium text-white">
                            {formatDate(invoice.dueDate)}
                          </span>
                        </div>
                        <a
                          href={invoice.paymentLink}
                          className="block w-full bg-gradient-to-r from-[#00ff88] to-[#00f7ff] hover:from-[#00dd77] hover:to-[#00d4dd] text-black font-bold py-3 px-4 rounded-xl transition-all text-center text-sm shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_30px_rgba(0,255,136,0.5)]"
                        >
                          <DollarSign className="w-4 h-4 inline mr-1.5" />
                          Bayar Sekarang
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What You Can Do */}
              <div className="bg-gradient-to-br from-[#00f7ff]/10 to-[#00ff88]/10 rounded-xl p-4 mb-5 border border-[#00f7ff]/20">
                <h3 className="text-sm font-bold text-[#00f7ff] mb-3">
                  Apa yang bisa Anda lakukan?
                </h3>
                <ol className="space-y-2 text-xs text-[#e0d0ff]/80">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#00f7ff]/20 rounded-full flex items-center justify-center text-[#00f7ff] font-bold flex-shrink-0">1</span>
                    <span className="pt-1">Lakukan pembayaran tagihan yang belum dibayar</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#00f7ff]/20 rounded-full flex items-center justify-center text-[#00f7ff] font-bold flex-shrink-0">2</span>
                    <span className="pt-1">Hubungi customer service jika ada kendala pembayaran</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#00ff88]/20 rounded-full flex items-center justify-center text-[#00ff88] font-bold flex-shrink-0">3</span>
                    <span className="pt-1">Setelah pembayaran berhasil, layanan akan aktif otomatis dalam 5-10 menit</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#00ff88]/20 rounded-full flex items-center justify-center text-[#00ff88] font-bold flex-shrink-0">4</span>
                    <span className="pt-1">Logout dan login ulang PPPoE Anda untuk mendapatkan akses penuh</span>
                  </li>
                </ol>
              </div>

              {/* Contact Support */}
              {company && (
                <div className="border-t border-[#bc13fe]/20 pt-5">
                  <h3 className="text-sm font-bold text-white mb-4 text-center">
                    Butuh Bantuan?
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {company.phone && (
                      <a
                        href={`https://wa.me/${company.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 bg-[#00ff88] hover:bg-[#00dd77] text-black font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-[0_0_20px_rgba(0,255,136,0.3)]"
                      >
                        <Phone className="w-4 h-4" />
                        <span>WhatsApp: {company.phone}</span>
                      </a>
                    )}
                    {company.email && (
                      <a
                        href={`mailto:${company.email}`}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] text-white font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-[0_0_20px_rgba(188,19,254,0.3)]"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Email: {company.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#0a0520]/50 px-4 py-3 text-center border-t border-[#bc13fe]/20">
              <p className="text-xs text-[#e0d0ff]/50">
                {company?.name || 'SALFANET RADIUS'} © {new Date().getFullYear()}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-5 text-center">
            <p className="text-xs text-[#e0d0ff]/50 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00f7ff]" />
              Halaman ini akan diperbarui otomatis setelah pembayaran berhasil
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IsolatedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#1a0f35] flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-3 text-[#ff44cc] drop-shadow-[0_0_20px_rgba(255,68,204,0.6)]" />
          <p className="text-sm text-[#e0d0ff]/70">Loading...</p>
        </div>
      </div>
    }>
      <IsolatedContent />
    </Suspense>
  );
}
