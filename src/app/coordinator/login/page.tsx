'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { Smartphone, Lock, Loader2, UserCheck, ArrowLeft, RefreshCcw } from 'lucide-react';

export default function CoordinatorLoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(true);
  const [footerText, setFooterText] = useState('Powered by AI-BILL RADIUS');

  // Fetch company settings on mount
  useEffect(() => {
    fetch('/api/settings/company')
      .then(res => res.json())
      .then(data => {
        if (data.company?.footerCoordinator) {
          setFooterText(data.company.footerCoordinator);
        } else if (data.company?.poweredBy) {
          setFooterText(`Powered by ${data.company.poweredBy}`);
        }
      })
      .catch(err => console.error('Failed to fetch company settings:', err));
  }, []);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/coordinator/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.requireOtp === false) {
          const loginRes = await fetch('/api/coordinator/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, skipOtp: true }),
          });

          if (loginRes.ok) {
            router.push('/coordinator/dashboard');
            return;
          }
        }

        setRequiresOtp(true);
        setStep('otp');
        if (data.otpCode) {
          setDevOtp(data.otpCode);
        }
      } else {
        setError(data.error || t('coordinator.otpFailed'));
      }
    } catch (error) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/coordinator/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otpCode }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/coordinator/dashboard');
      } else {
        setError(data.error || t('coordinator.invalidOtp'));
      }
    } catch (error) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtpCode('');
    setError('');
    setDevOtp('');
  };

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-2xl shadow-[0_0_50px_rgba(188,19,254,0.5)] mb-4">
            <UserCheck className="h-8 w-8 sm:h-10 sm:w-10 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">
            {t('coordinator.login')}
          </h1>
          <p className="text-sm text-[#e0d0ff]/80 mt-2">
            {step === 'phone'
              ? t('coordinator.loginDesc')
              : t('coordinator.otpSent')}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1a0f35]/80 backdrop-blur-xl rounded-2xl border-2 border-[#bc13fe]/30 p-6 sm:p-8 shadow-[0_0_50px_rgba(188,19,254,0.2)]">
          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-[#e0d0ff] mb-2">
                  <Smartphone className="w-4 h-4 text-[#00f7ff]" />
                  {t('coordinator.phoneNumber')}
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="08123456789"
                  className="w-full px-4 py-3 text-sm bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-xl text-white placeholder-[#e0d0ff]/40 focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff]/50 focus:shadow-[0_0_20px_rgba(0,247,255,0.3)] transition-all outline-none"
                  required
                  autoFocus
                />
                <p className="text-xs text-[#e0d0ff]/60 mt-2">
                  {t('coordinator.phoneHelp')}
                </p>
              </div>

              {error && (
                <div className="bg-[#ff4466]/10 border border-[#ff4466]/30 text-[#ff6b8a] px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] hover:from-[#a010e0] hover:to-[#00d4dd] text-white rounded-xl transition-all shadow-[0_0_25px_rgba(188,19,254,0.4)] hover:shadow-[0_0_35px_rgba(188,19,254,0.6)] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('coordinator.sending')}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    {t('coordinator.continue')}
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-[#e0d0ff] mb-2">
                  <Lock className="w-4 h-4 text-[#00f7ff]" />
                  {t('coordinator.otpCode')}
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full px-4 py-4 bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-xl text-white text-center text-xl sm:text-2xl tracking-[0.5em] font-mono focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff]/50 focus:shadow-[0_0_20px_rgba(0,247,255,0.3)] transition-all outline-none"
                  required
                  autoFocus
                />
                <p className="text-xs text-[#e0d0ff]/60 mt-2">
                  {t('coordinator.otpHelp')}
                </p>
              </div>

              {/* Dev mode OTP display */}
              {devOtp && process.env.NODE_ENV === 'development' && (
                <div className="bg-[#ff44cc]/20 border border-[#ff44cc]/30 rounded-xl p-4">
                  <p className="text-xs text-[#ff44cc] font-medium mb-1">
                    Development Mode - OTP Code:
                  </p>
                  <p className="text-2xl font-bold text-[#ff44cc] tracking-widest font-mono">
                    {devOtp}
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-[#ff4466]/10 border border-[#ff4466]/30 text-[#ff6b8a] px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] hover:from-[#a010e0] hover:to-[#00d4dd] text-white rounded-xl transition-all shadow-[0_0_25px_rgba(188,19,254,0.4)] hover:shadow-[0_0_35px_rgba(188,19,254,0.6)] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('coordinator.verifying')}
                    </>
                  ) : (
                    t('coordinator.verify')
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-[#0a0520] border-2 border-[#bc13fe]/30 text-[#e0d0ff] hover:border-[#00f7ff] rounded-xl transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('common.back')}
                </button>

                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 text-sm text-[#00f7ff] hover:text-[#00d4dd] font-medium"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {t('coordinator.resendOtp')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs sm:text-sm text-[#e0d0ff]/50">
            {footerText}
          </p>
        </div>
      </div>
    </div>
  );
}
