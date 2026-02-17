'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, MessageSquare, User, Receipt, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Force all customer pages to be dynamic
export const dynamic = 'force-dynamic';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('SALFANET RADIUS');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const res = await fetch('/api/public/company');
      const data = await res.json();
      if (data.name) setCompanyName(data.name);
      if (data.logo) setCompanyLogo(data.logo);
    } catch (error) {
      console.error('Load company info error:', error);
    }
  };

  const menuItems = [
    {
      name: 'Beranda',
      href: '/customer',
      icon: Home,
      badge: null,
    },
    {
      name: 'Riwayat',
      href: '/customer/history',
      icon: Receipt,
      badge: null,
    },
    {
      name: 'Tiket',
      href: '/customer/tickets',
      icon: MessageSquare,
      badge: null,
    },
    {
      name: 'Akun',
      href: '/customer/profile',
      icon: User,
      badge: null,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/customer') {
      return pathname === '/customer';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background pb-24 relative overflow-hidden">
      {/* Cyberpunk Background Effects - Cyan-Pink Theme */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-cyan-500/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-blue-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[50%] h-[50%] bg-sky-400/10 rounded-full blur-[150px]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Top Header - Fixed */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/30 blur-md rounded-lg" />
              {companyLogo ? (
                <div className="relative w-10 h-10 rounded-lg bg-card border border-cyan-400/30 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <img src={companyLogo} alt={companyName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="relative w-10 h-10 rounded-lg bg-card border border-cyan-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Shield className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                {companyName}
              </h1>
              <p className="text-[10px] text-accent/70 tracking-widest capitalize font-bold">Customer Portal</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto relative z-10 p-4">
        {children}
      </main>

      {/* Bottom Navigation - Fixed */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 max-w-3xl mx-auto">
        <div className="bg-card/90 backdrop-blur-xl border-2 border-cyan-500/20 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.2)] p-2">
          <div className="grid grid-cols-4 gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-2 rounded-xl transition-all duration-300",
                    active 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-accent"
                  )}
                >
                  {active && (
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 to-blue-500/15 rounded-xl shadow-[0_0_12px_rgba(6,182,212,0.25)] border border-cyan-400/25" />
                  )}
                  <Icon className={cn(
                    "w-5 h-5 mb-1 transition-all duration-300 relative z-10",
                    active && "drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] scale-110"
                  )} />
                  <span className={cn(
                    "text-[10px] font-bold transition-all duration-300 relative z-10",
                    active && "text-cyan-400 drop-shadow-[0_0_3px_rgba(6,182,212,0.6)]"
                  )}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
