'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Phone, Loader2, Shield, Ticket, MessageCircle } from 'lucide-react';
import { showError } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';

export default function AgentLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [poweredBy, setPoweredBy] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [brandLoaded, setBrandLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/public/company')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.company) {
          if (data.company.logo) setCompanyLogo(data.company.logo);
          if (data.company.name) setCompanyName(data.company.name);
          if (data.company.footerAgent) {
            setPoweredBy(data.company.footerAgent);
          }
          if (data.company.phone) {
            let formattedPhone = data.company.phone.replace(/[^0-9]/g, '');
            if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.slice(1);
            if (!formattedPhone.startsWith('62')) formattedPhone = '62' + formattedPhone;
            setCompanyPhone(formattedPhone);
          }
        }
      })
      .catch(() => {})
      .finally(() => setBrandLoaded(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('agentData', JSON.stringify(data.agent));
        localStorage.setItem('agentToken', data.token);
        router.push('/agent/dashboard');
      } else {
        setError(data.error || t('agent.portal.errors.loginFailed'));
        await showError(data.error || t('agent.portal.errors.loginFailed'));
      }
    } catch (error) {
      setError(t('agent.portal.errors.tryAgain'));
      await showError(t('agent.portal.errors.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  if (!brandLoaded) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/50 dark:bg-blue-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/50 dark:bg-indigo-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-sm w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          {companyLogo ? (
            <div className="inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm mb-4">
              <img src={companyLogo} alt={companyName} className="max-h-12 max-w-[120px] w-auto h-auto object-contain" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/25 mb-4">
              <Ticket className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('agent.portal.title')}
          </h1>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-1">{t('agent.portal.loginSubtitle')}</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <Phone className="w-4 h-4" />
                {t('agent.portal.phoneNumber')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08123456789"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-sm"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0" />{error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-indigo-500/20 hover:shadow-md flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t('agent.portal.loggingIn')}...</>
              ) : (
                <><LogIn className="w-4 h-4" />{t('agent.portal.login')}</>
              )}
            </button>
          </form>

          {/* Divider */}
          {companyPhone && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('agent.portal.or')}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('agent.portal.notRegistered')}</p>
                <a
                  href={`https://wa.me/${companyPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t('agent.portal.contactAdmin')}
                </a>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
          {poweredBy}
        </p>
      </div>
    </div>
  );
}
