'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Smartphone, Lock, ArrowRight, Loader2, ChevronLeft, Wifi } from 'lucide-react';
import { CyberCard } from '@/components/cyberpunk';
import { CyberButton } from '@/components/cyberpunk';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState(''); // Add phone state for OTP verification
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresIn, setExpiresIn] = useState(5);
  const [companyName, setCompanyName] = useState('SALFANET RADIUS');
  const [footerText, setFooterText] = useState('Powered by SALFANET RADIUS');
  const [otpSendFailed, setOtpSendFailed] = useState(false);
  const [userDataForBypass, setUserDataForBypass] = useState<any>(null);

  useEffect(() => {
    fetch('/api/public/company')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.company.name) {
          setCompanyName(data.company.name);
        }
        if (data.success && data.company.footerCustomer) {
          setFooterText(data.company.footerCustomer);
        } else if (data.success && data.company.poweredBy) {
          setFooterText(`Powered by ${data.company.poweredBy}`);
        }
      })
      .catch(err => console.error('Load company name error:', err));
  }, []);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const checkRes = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });

      const checkData = await checkRes.json();
      console.log('Login check response:', checkData);

      if (!checkData.success) {
        setError(checkData.error || 'Nomor tidak terdaftar');
        setLoading(false);
        return;
      }

      if (!checkData.requireOTP) {
        localStorage.setItem('customer_token', checkData.token);
        localStorage.setItem('customer_user', JSON.stringify(checkData.user));
        router.push('/customer');
        return;
      }

      // Get user phone from checkData for OTP sending
      const userPhone = checkData.user?.phone || identifier;
      
      // Store user data for potential bypass login
      setUserDataForBypass({ phone: userPhone, user: checkData.user });

      const res = await fetch('/api/customer/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: userPhone }),
      });

      const data = await res.json();
      console.log('Send OTP response:', data);

      if (data.success) {
        setPhone(userPhone); // Store phone for OTP verification
        setExpiresIn(data.expiresIn || 5);
        setStep('otp');
        setOtpSendFailed(false);
      } else {
        setError(data.error || 'Gagal mengirim OTP. Layanan WhatsApp mungkin sedang tidak tersedia.');
        setOtpSendFailed(true);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/customer/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otpCode: otp }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('customer_token', data.token);
        localStorage.setItem('customer_user', JSON.stringify(data.user));
        router.push('/customer');
      } else {
        setError(data.error || 'Kode OTP salah');
      }
    } catch (err: any) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#1a0f35] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cyberpunk Background Effects - Neon Purple Theme */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#bc13fe]/35 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ff44cc]/25 rounded-full blur-[100px]" />
        <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[60%] h-[60%] bg-[#00f7ff]/15 rounded-full blur-[150px]" />
        {/* Grid pattern - Purple tint */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#281441]/80 backdrop-blur-md border-2 border-[#bc13fe]/50 rounded-2xl shadow-[0_0_40px_rgba(188,19,254,0.5)] mb-6 group">
            <Shield className="w-10 h-10 text-[#bc13fe] group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_15px_rgba(188,19,254,0.9)]" />
          </div>
          <h1 className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] drop-shadow-[0_0_25px_rgba(188,19,254,0.6)]">
            {companyName}
          </h1>
          <p className="text-sm text-[#e0d0ff]/80 mt-2 tracking-[0.3em] uppercase font-medium">
            Secure Access Terminal
          </p>
        </div>

        {/* Login Form */}
        <CyberCard className="p-8 bg-[#281441]/90 backdrop-blur-xl border-2 border-[#bc13fe]/30 shadow-[0_0_50px_rgba(188,19,254,0.2)]">
          {error && (
            <div className="mb-6 p-4 bg-[#ff3366]/10 border border-[#ff3366]/50 rounded-lg shadow-[0_0_20px_rgba(255,51,102,0.3)]">
              <p className="text-sm text-[#ff3366] font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff3366] animate-pulse" />
                {error}
              </p>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-[#00f7ff] mb-2 uppercase tracking-wider drop-shadow-[0_0_8px_rgba(0,247,255,0.6)]">
                  <Smartphone className="w-4 h-4" />
                  Identity / Phone
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-[#1f1040]/80 border-2 border-[#bc13fe]/30 rounded-lg text-white placeholder:text-[#e0d0ff]/50 focus:border-[#bc13fe] focus:ring-2 focus:ring-[#bc13fe]/30 focus:shadow-[0_0_25px_rgba(188,19,254,0.4)] transition-all duration-300 outline-none"
                    placeholder="08123456789 or ID"
                    disabled={loading}
                  />
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#bc13fe]/10 to-[#ff44cc]/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
                </div>
                <p className="text-xs text-[#e0d0ff]/60">
                  Enter registered WhatsApp number or 8-digit Customer ID
                </p>
              </div>

              <CyberButton
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Initialize Login
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </CyberButton>

              {/* Bypass login if OTP send failed */}
              {otpSendFailed && userDataForBypass && (
                <CyberButton
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Create session without OTP
                      const bypassRes = await fetch('/api/customer/auth/bypass-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: userDataForBypass.phone }),
                      });
                      
                      const bypassData = await bypassRes.json();
                      if (bypassData.success) {
                        localStorage.setItem('customer_token', bypassData.token);
                        localStorage.setItem('customer_user', JSON.stringify(bypassData.user));
                        router.push('/customer');
                      } else {
                        setError(bypassData.error || 'Login gagal');
                      }
                    } catch (err) {
                      setError('Terjadi kesalahan saat login');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full mt-4"
                >
                  Emergency Bypass (No OTP)
                </CyberButton>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-[#00f7ff] mb-2 uppercase tracking-wider drop-shadow-[0_0_8px_rgba(0,247,255,0.6)]">
                  <Lock className="w-4 h-4" />
                  Security Code
                </label>
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  className="w-full px-4 py-3 text-2xl text-center font-mono tracking-[0.5em] bg-[#1f1040]/80 border-2 border-[#bc13fe]/30 rounded-lg text-[#00f7ff] focus:border-[#bc13fe] focus:ring-2 focus:ring-[#bc13fe]/30 focus:shadow-[0_0_30px_rgba(188,19,254,0.5)] transition-all duration-300 outline-none"
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-[#e0d0ff]/60 text-center">
                  Code sent to <strong className="text-[#00f7ff]">{identifier}</strong>
                  <br />
                  Expires in {expiresIn} minutes
                </p>
              </div>

              <div className="flex gap-3">
                <CyberButton
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </CyberButton>
                <CyberButton
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="flex-[2]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Authenticate'
                  )}
                </CyberButton>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                disabled={loading}
                className="w-full text-xs text-[#bc13fe]/70 hover:text-[#ff44cc] hover:underline transition-all"
              >
                Resend Authentication Code
              </button>
            </form>
          )}

          {/* Register Buttons */}
          {step === 'phone' && (
            <div className="mt-8 pt-6 border-t border-[#bc13fe]/20">
              <p className="text-xs text-[#e0d0ff]/60 mb-4 text-center uppercase tracking-[0.2em] font-medium">
                New Connection Request
              </p>
              <div className="grid grid-cols-2 gap-3">
                <CyberButton
                  variant="outline"
                  onClick={() => router.push('/daftar')}
                  className="text-xs px-2"
                >
                  Register User
                </CyberButton>
                <CyberButton
                  variant="outline"
                  onClick={() => router.push('/agent')}
                  className="text-xs px-2"
                >
                  Register Agent
                </CyberButton>
              </div>
            </div>
          )}

          {/* Buy Voucher Button */}
          {step === 'phone' && (
            <div className="mt-4">
              <CyberButton
                variant="glass"
                onClick={() => router.push('/evoucher')}
                className="w-full text-xs"
              >
                <Wifi className="w-4 h-4" />
                Purchase WiFi Access
              </CyberButton>
            </div>
          )}
        </CyberCard>

        {/* Footer */}
        <p className="text-center text-xs text-[#bc13fe]/40 mt-8 font-mono tracking-wider">
          {footerText}
        </p>
      </div>
    </div>
  );
}
