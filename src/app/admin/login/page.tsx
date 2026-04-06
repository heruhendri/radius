'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Shield, Smartphone, User, Lock, Clock, LogIn, ArrowLeft, KeyRound } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

type Step = 'credentials' | 'twoFactor';

if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme');
  if (!savedTheme) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { t } = useTranslation();

  // ── UI state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('credentials');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [idleLogout, setIdleLogout] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [footerText, setFooterText] = useState('');
  const [brandLoaded, setBrandLoaded] = useState(false);

  // ── Form data ─────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [tfaToken, setTfaToken] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const tfaInputRef = useRef<HTMLInputElement>(null);

  // Check idle logout
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'idle') {
      setIdleLogout(true);
      setTimeout(() => {
        window.history.replaceState({}, '', '/admin/login');
      }, 100);
    }
  }, [searchParams]);

  // Load company branding
  useEffect(() => {
    fetch('/api/public/company')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.company.name) setCompanyName(data.company.name);
        if (data.success && data.company.logo) setCompanyLogo(data.company.logo);
        if (data.success && data.company.footerAdmin) {
          setFooterText(data.company.footerAdmin);
        } else if (data.success && data.company.poweredBy) {
          setFooterText(`Powered by ${data.company.poweredBy}`);
        }
      })
      .catch(() => {})
      .finally(() => setBrandLoaded(true));
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/admin');
    }
  }, [status, router]);

  // Focus 2FA input when switching to that step
  useEffect(() => {
    if (step === 'twoFactor') {
      setTimeout(() => tfaInputRef.current?.focus(), 100);
    }
  }, [step]);

  // ── Step 1: Check credentials + 2FA requirement ───────────────────────
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Use pre-login API because NextAuth v4 sanitizes authorize() errors
      // to "CredentialsSignin" — custom error messages never reach the client.
      const res = await fetch('/api/admin/auth/pre-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.loginFailed'));
        return;
      }

      if (data.requires2FA && data.token) {
        // Show 2FA step inline — no page redirect, no race conditions
        setTfaToken(data.token);
        setStep('twoFactor');
        return;
      }

      // No 2FA — proceed with NextAuth
      const result = await signIn('credentials', {
        username: formData.username,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError(t('auth.loginFailed'));
      } else if (result?.ok) {
        const callbackUrl = searchParams.get('callbackUrl') || '/admin';
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Submit 2FA TOTP code ──────────────────────────────────────
  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = tfaCode.replace(/\s/g, '');
    if (cleanCode.length < 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        tfaToken,
        tfaCode: cleanCode,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid authenticator code. Please try again.');
        setTfaCode('');
        tfaInputRef.current?.focus();
      } else if (result?.ok) {
        const callbackUrl = searchParams.get('callbackUrl') || '/admin';
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Auto-format 2FA code as "000 000"
  const handleTfaCodeChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    const formatted = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
    setTfaCode(formatted);
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setTfaToken('');
    setTfaCode('');
    setError('');
  };

  if (!brandLoaded) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/50 dark:bg-blue-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/50 dark:bg-indigo-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            {companyLogo ? (
              <div className="inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm flex-shrink-0">
                <Image unoptimized src={companyLogo} alt={companyName} width={100} height={40} className="max-h-10 max-w-[100px] w-auto h-auto object-contain" />
              </div>
            ) : (
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl flex-shrink-0 transition-all duration-300 ${
                step === 'twoFactor'
                  ? 'bg-indigo-600 shadow-lg shadow-indigo-500/25'
                  : 'bg-blue-600 shadow-lg shadow-blue-500/25'
              }`}>
                {step === 'twoFactor'
                  ? <Smartphone className="w-6 h-6 text-white" />
                  : <Shield className="w-6 h-6 text-white" />
                }
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight text-left max-w-[200px]">
              {companyName}
            </h1>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
            {step === 'twoFactor' ? 'Autentikasi 2 Faktor' : t('auth.adminControlPanel')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-8">

          {/* Idle Logout Notice */}
          {idleLogout && step === 'credentials' && (
            <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t('auth.sessionExpired')}</p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">{t('auth.sessionExpiredDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          {/* ── STEP 1: Username + Password ── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <User className="w-4 h-4" />
                  {t('auth.username')}
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm"
                  placeholder={t('auth.enterUsername')}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <Lock className="w-4 h-4" />
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all pr-12 text-sm"
                    placeholder={t('auth.enterPassword')}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-blue-500/20 hover:shadow-md flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />{t('auth.signingIn')}</>
                ) : (
                  <><LogIn className="w-5 h-5" />{t('auth.signIn')}</>
                )}
              </button>
            </form>
          )}

          {/* ── STEP 2: 2FA Code ── */}
          {step === 'twoFactor' && (
            <form onSubmit={handleTwoFactorSubmit} className="space-y-5">
              {/* Info banner */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Kode Autentikator Diperlukan</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Buka aplikasi autentikator Anda (Google Authenticator, Authy, dll.) dan masukkan kode 6 digit.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <KeyRound className="w-4 h-4" />
                  Kode Autentikator
                </label>
                <input
                  ref={tfaInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={tfaCode}
                  onChange={(e) => handleTfaCodeChange(e.target.value)}
                  className="login-input-2fa w-full px-4 py-4 bg-slate-900 border-2 border-indigo-500/40 rounded-xl text-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  placeholder="000 000"
                  disabled={loading}
                  maxLength={7}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">Sesi ini berakhir dalam 10 menit</p>
              </div>

              <button
                type="submit"
                disabled={loading || tfaCode.replace(/\s/g, '').length < 6}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-indigo-500/20 hover:shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Memverifikasi...</>
                ) : (
                  <><KeyRound className="w-5 h-5" />Verifikasi Kode</>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToCredentials}
                disabled={loading}
                className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2 pt-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Login
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
          {footerText}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
