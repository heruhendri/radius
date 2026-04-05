'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { UserCheck, LogOut, Loader2, MapPin, Users, ClipboardList, Phone, Mail, User } from 'lucide-react';

interface Coordinator {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
}

export default function CoordinatorDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/coordinator/auth/session');
      if (res.ok) {
        const data = await res.json();
        setCoordinator(data.coordinator);
        loadStats();
      } else {
        router.push('/coordinator/login');
      }
    } catch (error) {
      router.push('/coordinator/login');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/coordinator/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/coordinator/auth/logout', { method: 'POST' });
      router.push('/coordinator/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <Loader2 className="h-10 w-10 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" />
      </div>
    );
  }

  if (!coordinator) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/15 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 bg-[#1a0f35]/80 backdrop-blur-xl border-b border-[#bc13fe]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-xl shadow-[0_0_20px_rgba(188,19,254,0.4)] flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-[#00f7ff] to-[#bc13fe] bg-clip-text text-transparent">
                  {t('coordinator.dashboard')}
                </h1>
                <p className="text-sm text-[#e0d0ff]/70">
                  {coordinator.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/coordinator/tasks')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] text-white rounded-xl font-medium text-sm shadow-[0_0_20px_rgba(188,19,254,0.3)] hover:shadow-[0_0_30px_rgba(188,19,254,0.5)] transition-all"
              >
                <ClipboardList className="h-4 w-4" />
                {t('task.createTask')}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-[#ff6b8a] hover:bg-[#ff4466]/10 rounded-xl transition-colors text-sm font-medium"
              >
                <LogOut className="h-4 w-4" />
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-[#bc13fe] to-[#00f7ff] rounded-2xl shadow-[0_0_40px_rgba(188,19,254,0.3)] p-6 text-white mb-8">
          <h2 className="text-2xl font-bold mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            {t('coordinator.welcome')}, {coordinator.name}!
          </h2>
          <p className="text-white/80">
            {t('coordinator.welcomeDesc')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1a0f35]/80 backdrop-blur-xl rounded-2xl border-2 border-[#00f7ff]/30 p-6 shadow-[0_0_30px_rgba(0,247,255,0.1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#e0d0ff]/70">
                  {t('coordinator.activeTickets')}
                </p>
                <p className="text-3xl font-bold text-white mt-2">
                  0
                </p>
              </div>
              <div className="p-3 bg-[#00f7ff]/20 rounded-xl border border-[#00f7ff]/30 flex items-center justify-center">
                <ClipboardList className="h-10 w-10 text-[#00f7ff] drop-shadow-[0_0_10px_rgba(0,247,255,0.5)]" />
              </div>
            </div>
          </div>

          <div className="bg-[#1a0f35]/80 backdrop-blur-xl rounded-2xl border-2 border-[#00ff88]/30 p-6 shadow-[0_0_30px_rgba(0,255,136,0.1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#e0d0ff]/70">
                  {t('coordinator.activeTechnicians')}
                </p>
                <p className="text-3xl font-bold text-white mt-2">
                  0
                </p>
              </div>
              <div className="p-3 bg-[#00ff88]/20 rounded-xl border border-[#00ff88]/30 flex items-center justify-center">
                <Users className="h-10 w-10 text-[#00ff88] drop-shadow-[0_0_10px_rgba(0,255,136,0.5)]" />
              </div>
            </div>
          </div>

          <div className="bg-[#1a0f35]/80 backdrop-blur-xl rounded-2xl border-2 border-[#bc13fe]/30 p-6 shadow-[0_0_30px_rgba(188,19,254,0.1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#e0d0ff]/70">
                  {t('coordinator.areas')}
                </p>
                <p className="text-3xl font-bold text-white mt-2">
                  0
                </p>
              </div>
              <div className="p-3 bg-[#bc13fe]/20 rounded-xl border border-[#bc13fe]/30 flex items-center justify-center">
                <MapPin className="h-10 w-10 text-[#bc13fe] drop-shadow-[0_0_10px_rgba(188,19,254,0.5)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-[#1a0f35]/80 backdrop-blur-xl rounded-2xl border-2 border-[#bc13fe]/30 p-6 shadow-[0_0_30px_rgba(188,19,254,0.1)]">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-[#00f7ff]" />
            {t('coordinator.systemInfo')}
          </h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center p-3 bg-[#0a0520]/50 rounded-xl border border-[#bc13fe]/10">
              <span className="text-[#e0d0ff]/70 flex items-center gap-2">
                <User className="h-4 w-4 text-[#bc13fe]" />
                {t('common.name')}:
              </span>
              <span className="font-medium text-white">{coordinator.name}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#0a0520]/50 rounded-xl border border-[#bc13fe]/10">
              <span className="text-[#e0d0ff]/70 flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#00f7ff]" />
                {t('common.phone')}:
              </span>
              <span className="font-medium text-white">{coordinator.phoneNumber}</span>
            </div>
            {coordinator.email && (
              <div className="flex justify-between items-center p-3 bg-[#0a0520]/50 rounded-xl border border-[#bc13fe]/10">
                <span className="text-[#e0d0ff]/70 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#ff44cc]" />
                  {t('common.email')}:
                </span>
                <span className="font-medium text-white">{coordinator.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
