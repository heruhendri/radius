'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Shield, User, Lock, Clock, LogIn } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

// Set default theme on login page
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme');
  if (!savedTheme) {
    // Default to dark mode for cyberpunk theme
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
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [idleLogout, setIdleLogout] = useState(false);
  const [companyName, setCompanyName] = useState('AI-BILL RADIUS');
  const [footerText, setFooterText] = useState('Powered by AI-BILL RADIUS');

  // Check if user was logged out due to idle
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'idle') {
      setIdleLogout(true);
      // Clear the URL param after showing the message
      setTimeout(() => {
        window.history.replaceState({}, '', '/admin/login');
      }, 100);
    }
  }, [searchParams]);

  // Load company name and footer
  useEffect(() => {
    fetch('/api/public/company')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.company.name) {
          setCompanyName(data.company.name);
        }
        if (data.success && data.company.footerAdmin) {
          setFooterText(data.company.footerAdmin);
        } else if (data.success && data.company.poweredBy) {
          setFooterText(`Powered by ${data.company.poweredBy}`);
        }
      })
      .catch(err => console.error('Load company name error:', err));
  }, []);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/admin');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        username: formData.username,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#bc13fe]/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#00f7ff]/20 rounded-full blur-[100px] animate-pulse delay-700"></div>
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[400px] bg-[#ff44cc]/15 rounded-full blur-[150px] animate-pulse delay-1000"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-2xl mb-5 shadow-[0_0_50px_rgba(188,19,254,0.5)] border-2 border-[#bc13fe]/40">
            <Shield className="w-10 h-10 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
          </div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] drop-shadow-[0_0_20px_rgba(0,247,255,0.5)]">
            {companyName}
          </h1>
          <p className="text-sm text-[#00f7ff] mt-2 font-mono uppercase tracking-widest">
            {t('auth.adminControlPanel')}
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-3xl border-2 border-[#bc13fe]/30 shadow-[0_0_50px_rgba(188,19,254,0.2)] p-8">
          {/* Idle Logout Notice */}
          {idleLogout && (
            <div className="mb-5 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                <div>
                  <p className="text-sm font-bold text-amber-400">
                    {t('auth.sessionExpired')}
                  </p>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    {t('auth.sessionExpiredDesc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border-2 border-red-500/40 rounded-xl">
              <p className="text-sm text-red-400 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#00f7ff] mb-3 uppercase tracking-wider">
                <User className="w-4 h-4" />
                {t('auth.username')}
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3.5 bg-slate-900/80 border-2 border-[#bc13fe]/40 rounded-xl text-white placeholder-[#e0d0ff]/40 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 focus:shadow-[0_0_20px_rgba(0,247,255,0.2)] transition-all text-sm"
                placeholder={t('auth.enterUsername')}
                disabled={loading}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#00f7ff] mb-3 uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3.5 bg-slate-900/80 border-2 border-[#bc13fe]/40 rounded-xl text-white placeholder-[#e0d0ff]/40 focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 focus:shadow-[0_0_20px_rgba(0,247,255,0.2)] transition-all pr-12 text-sm"
                  placeholder={t('auth.enterPassword')}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#e0d0ff]/60 hover:text-[#00f7ff] transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] hover:shadow-[0_0_40px_rgba(0,247,255,0.5)] disabled:opacity-50 disabled:shadow-none text-black text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-3 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('auth.signingIn')}
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('auth.signIn')}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#e0d0ff]/40 mt-8 font-mono uppercase tracking-widest">
          {footerText}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
