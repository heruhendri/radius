'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Ticket,
  LogOut,
  Menu,
  X,
  User,
  Wifi,
  Globe,
  Sun,
  Moon,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentNotificationDropdown from '@/components/agent/NotificationDropdown';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { CyberToastProvider, useToast } from '@/components/cyberpunk/CyberToast';
import { registerGlobalToast, registerGlobalConfirm } from '@/lib/sweetalert';

interface MenuItem {
  titleKey: string;
  icon: React.ReactNode;
  href: string;
}

const menuItems: MenuItem[] = [
  {
    titleKey: 'agent.portal.dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    href: '/agent/dashboard',
  },
  {
    titleKey: 'agent.portal.vouchers',
    icon: <Ticket className="w-4 h-4" />,
    href: '/agent/vouchers',
  },
  {
    titleKey: 'agent.portal.sessions',
    icon: <Wifi className="w-4 h-4" />,
    href: '/agent/sessions',
  },
  {
    titleKey: 'agent.portal.support',
    icon: <LifeBuoy className="w-4 h-4" />,
    href: '/agent/tickets',
  },
];

interface AgentData {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

function AgentSidebar({ 
  agent, 
  sidebarOpen, 
  setSidebarOpen,
  onLogout 
}: { 
  agent: AgentData | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full z-50 transition-all duration-300 ease-in-out',
        'w-64 bg-white dark:bg-[#0a0520]/95 backdrop-blur-xl border-r border-purple-200 dark:border-[#bc13fe]/20',
        'shadow-[5px_0_15px_rgba(0,0,0,0.08)] dark:shadow-[5px_0_30px_rgba(188,19,254,0.15)]',
        'flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0' // Always visible on desktop
      )}>
        {/* Logo */}
        <div className="flex-shrink-0 p-4 border-b border-purple-200 dark:border-[#bc13fe]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-xl shadow-[0_0_20px_rgba(188,19,254,0.5)]">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-purple-700 dark:text-transparent dark:bg-gradient-to-r dark:from-[#00f7ff] dark:to-[#bc13fe] dark:bg-clip-text">
                  {t('agent.portal.title')}
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-[#e0d0ff]/60">{t('agent.portal.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 hover:bg-[#bc13fe]/20 rounded-lg lg:hidden"
            >
              <X className="w-4 h-4 text-[#e0d0ff]" />
            </button>
          </div>
        </div>

        {/* Balance Card */}
        {agent && (
          <div className="flex-shrink-0 p-4">
            <div className="bg-gradient-to-br from-[#bc13fe]/20 to-[#00f7ff]/20 dark:from-[#bc13fe]/30 dark:to-[#00f7ff]/30 rounded-xl p-3 border border-cyan-200 dark:border-[#00f7ff]/30">
              <p className="text-[10px] text-slate-500 dark:text-[#e0d0ff]/70 uppercase tracking-wider">{t('agent.portal.yourBalance')}</p>
              <p className="text-lg font-bold text-[#00f7ff] drop-shadow-[0_0_10px_rgba(0,247,255,0.5)]">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(agent.balance || 0)}
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1 min-h-0 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 group',
                pathname === item.href
                  ? 'text-[#00f7ff] bg-cyan-50 dark:bg-[#00f7ff]/10 border border-cyan-300 dark:border-[#00f7ff]/30 shadow-sm dark:shadow-[0_0_15px_rgba(0,247,255,0.15)]'
                  : 'text-slate-600 dark:text-[#e0d0ff]/70 hover:text-slate-900 dark:hover:text-white hover:bg-purple-50 dark:hover:bg-[#bc13fe]/10 border border-transparent hover:border-purple-200 dark:hover:border-[#bc13fe]/20',
              )}
            >
              <span className={cn(
                'p-1.5 rounded-lg transition-all duration-300',
                pathname === item.href 
                  ? 'text-[#00f7ff] bg-cyan-50 dark:bg-[#00f7ff]/10' 
                  : 'text-slate-400 dark:text-[#e0d0ff]/60 group-hover:text-[#00f7ff]'
              )}>
                {item.icon}
              </span>
              <span className="tracking-wide">{t(item.titleKey)}</span>
            </Link>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="flex-shrink-0 p-4 border-t border-purple-200 dark:border-[#bc13fe]/20 bg-slate-50/80 dark:bg-[#0a0520]/50">
          {agent && (
            <div className="mb-3">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-purple-50 dark:bg-[#bc13fe]/10 border border-purple-200 dark:border-[#bc13fe]/20">
                <div className="p-2 bg-gradient-to-br from-[#bc13fe] to-[#ff44cc] rounded-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{agent.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-[#e0d0ff]/60 truncate">{agent.phone}</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-[#ff6b8a] hover:text-white bg-[#ff4466]/10 hover:bg-[#ff4466]/20 border border-[#ff4466]/30 rounded-xl transition-all duration-300"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('agent.portal.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function AgentLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [mounted, setMounted] = useState(false);
  const { t, locale, setLocale } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  // Check if on login page
  const isLoginPage = pathname === '/agent';

  useEffect(() => {
    setMounted(true);
    
    // Set sidebar open by default on desktop
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isLoginPage) {
      const agentDataStr = localStorage.getItem('agentData');
      if (agentDataStr) {
        const localAgent = JSON.parse(agentDataStr);
        setAgent(localAgent);
        // Fetch fresh balance from API
        fetch(`/api/agent/dashboard?agentId=${localAgent.id}&limit=1`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.agent) {
              const updated = { ...localAgent, balance: data.agent.balance };
              setAgent(updated);
              localStorage.setItem('agentData', JSON.stringify(updated));
            }
          })
          .catch(() => {});
      }
    }
  }, [isLoginPage, pathname]);

  const handleLogout = () => {
    localStorage.removeItem('agentData');
    router.push('/agent');
  };

  // Login page - no layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Desktop layout with sidebar
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0520]">
      {/* Background Effects - dark only */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden dark:block">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden lg:block">
        <AgentSidebar 
          agent={agent} 
          sidebarOpen={true}
          setSidebarOpen={() => {}}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        <AgentSidebar 
          agent={agent} 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Content Area */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Desktop Header */}
        <header className="hidden lg:block sticky top-0 z-20 bg-white/80 dark:bg-[#0a0520]/80 backdrop-blur-xl border-b border-slate-200 dark:border-[#bc13fe]/20 shadow-sm dark:shadow-none">
          <div className="px-6 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('agent.portal.welcome')}</h2>
              <p className="text-xs text-slate-500 dark:text-[#e0d0ff]/60">{agent?.name || 'Agent'}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#bc13fe]/10 hover:bg-slate-200 dark:hover:bg-[#bc13fe]/20 border border-slate-200 dark:border-[#bc13fe]/30 transition-all"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>
              {/* Language Switcher */}
              <button
                onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-[#bc13fe]/10 hover:bg-slate-200 dark:hover:bg-[#bc13fe]/20 text-slate-700 dark:text-[#e0d0ff] border border-slate-200 dark:border-[#bc13fe]/30 rounded-lg transition-all"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="uppercase">{locale}</span>
              </button>
              {agent && <AgentNotificationDropdown agentId={agent.id} />}
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-gradient-to-r from-[#12072f] via-[#1f0f52] to-[#00bcd4] shadow-[0_6px_30px_rgba(0,188,212,0.45)] backdrop-blur-xl border-b border-[#00f7ff]/20">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-white/10 rounded-xl transition"
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-base font-bold text-white">{t('agent.portal.title')}</h1>
                <p className="text-[10px] text-white/70">{agent?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/20"
              >
                {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-white" />}
              </button>
              {/* Language Switcher */}
              <button
                onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/20"
              >
                <Globe className="w-4 h-4 text-white" />
              </button>
              {agent && <AgentNotificationDropdown agentId={agent.id} />}
              <button
                onClick={handleLogout}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/20"
              >
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function AgentToastBridge() {
  const { addToast, confirm } = useToast();
  useEffect(() => {
    registerGlobalToast(addToast);
    registerGlobalConfirm(confirm);
  }, [addToast, confirm]);
  return null;
}

export default function AgentLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <CyberToastProvider>
      <AgentToastBridge />
      <AgentLayoutInner>{children}</AgentLayoutInner>
    </CyberToastProvider>
  );
}
