'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { Smartphone, Lock, Loader2, Wrench, ArrowLeft, Send, Shield } from 'lucide-react';

export default function TechnicianLoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('AI-BILL RADIUS');
  const [footerText, setFooterText] = useState('Powered by AI-BILL RADIUS');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  // Fetch company name on mount
  useEffect(() => {
    fetch('/api/settings/company')
      .then(res => res.json())
      .then(data => {
        if (data.company?.name) {
          setCompanyName(data.company.name);
        }
        if (data.company?.logo) {
          setCompanyLogo(data.company.logo);
        }
        if (data.company?.footerTechnician) {
          setFooterText(data.company.footerTechnician);
        } else if (data.company?.poweredBy) {
          setFooterText(`Powered by ${data.company.poweredBy}`);
        }
      })
      .catch(() => {
        // Silent fail - use defaults
      });
  }, []);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/technician/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();

      if (res.ok) {
        // Check if OTP is required
        if (data.requireOtp === false) {
          // Login without OTP - create session directly
          const loginRes = await fetch('/api/technician/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, skipOtp: true }),
          });

          if (loginRes.ok) {
            router.push('/technician/dashboard');
            return;
          }
        }

        // OTP required - proceed to OTP step
        setStep('otp');
      } else {
        setError(data.error || t('technician.otpFailed'));
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
      const res = await fetch('/api/technician/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otpCode }),
      });

      const data = await res.json();

      if (res.ok) {
        // Redirect to technician dashboard
        router.push('/technician/dashboard');
      } else {
        setError(data.error || t('technician.invalidOtp'));
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 relative overflow-hidden p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#bc13fe]/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#00f7ff]/20 rounded-full blur-[100px] animate-pulse delay-700"></div>
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[400px] bg-[#ff44cc]/15 rounded-full blur-[150px] animate-pulse delay-1000"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            {companyLogo ? (
              <div className="inline-flex items-center justify-center rounded-xl p-0.5 flex-shrink-0 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] shadow-[0_0_30px_rgba(188,19,254,0.5)]">
                <div className="rounded-[10px] bg-white px-3 py-2">
                  <img src={companyLogo} alt={companyName} className="max-h-10 max-w-[100px] w-auto h-auto object-contain" />
                </div>
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-xl flex-shrink-0 shadow-[0_0_30px_rgba(188,19,254,0.5)]">
                <Wrench className="h-6 w-6 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold leading-tight text-left text-transparent bg-clip-text bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] drop-shadow-[0_0_20px_rgba(0,247,255,0.5)] max-w-[200px]">
              {t('technician.login')}
            </h1>
          </div>
          <p className="text-sm text-[#e0d0ff]/70">
            {step === 'phone'
              ? t('technician.loginDesc')
              : t('technician.otpSent')}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-3xl border-2 border-[#bc13fe]/30 shadow-[0_0_50px_rgba(188,19,254,0.2)] p-8">
          {/* Phone Number Step */}
          {step === 'phone' && (
            <form onSubmit={handleRequestOtp}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-[#00f7ff] mb-3 uppercase tracking-wider">
                  {t('technician.phoneNumber')}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1.5 bg-[#bc13fe]/20 rounded-lg">
                    <Smartphone className="h-4 w-4 text-[#bc13fe]" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="08123456789 atau 628123456789"
                    className="w-full pl-14 pr-4 py-4 bg-slate-900/80 border-2 border-[#bc13fe]/40 rounded-xl text-white placeholder-[#e0d0ff]/40 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 focus:shadow-[0_0_20px_rgba(0,247,255,0.2)] transition-all text-sm"
                    required
                  />
                </div>
                <p className="text-xs text-[#e0d0ff]/50 mt-3">
                  {t('technician.phoneHelp')}
                </p>
              </div>

              {error && (
                <div className="mb-5 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] hover:shadow-[0_0_30px_rgba(0,247,255,0.5)] disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    {t('technician.sendOtp')}
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Verification Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-[#00f7ff] mb-3 uppercase tracking-wider">
                  {t('technician.otpCode')}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1.5 bg-[#bc13fe]/20 rounded-lg">
                    <Lock className="h-4 w-4 text-[#bc13fe]" />
                  </div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    placeholder="000000"
                    className="w-full pl-14 pr-4 py-4 bg-slate-900/80 border-2 border-[#bc13fe]/40 rounded-xl text-white placeholder-[#e0d0ff]/40 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 focus:shadow-[0_0_20px_rgba(0,247,255,0.2)] transition-all text-center text-2xl font-mono tracking-[0.5em]"
                    maxLength={6}
                    required
                  />
                </div>
                <p className="text-xs text-[#e0d0ff]/50 mt-3">
                  {t('technician.otpHelp')}
                </p>
              </div>

              {error && (
                <div className="mb-5 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-4 bg-slate-700/50 border border-slate-600/50 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('common.back')}
                </button>
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="flex-1 py-4 bg-gradient-to-r from-[#bc13fe] to-[#ff44cc] hover:shadow-[0_0_30px_rgba(188,19,254,0.5)] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      {t('technician.verify')}
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="w-full mt-5 py-3 text-sm text-[#00f7ff] hover:text-[#00f7ff]/80 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" />
                {t('technician.resendOtp')}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-[#e0d0ff]/50">
            {footerText}
          </p>
        </div>
      </div>
    </div>
  );
}
