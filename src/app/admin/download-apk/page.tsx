'use client';

import { useState } from 'react';
import { Smartphone, Download, ExternalLink, Github, Terminal, Shield, Wifi, Users, UserCheck, ChevronRight, Info } from 'lucide-react';

const ROLES = [
  {
    key: 'admin',
    label: 'Admin Panel',
    description: 'Akses penuh manajemen billing, pelanggan, keuangan, dan konfigurasi sistem.',
    icon: <Shield className="w-6 h-6" />,
    color: 'from-blue-600 to-blue-800',
    borderColor: 'border-blue-500/30',
    iconBg: 'bg-blue-500/20 text-blue-400',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    pathSuffix: '/admin',
  },
  {
    key: 'customer',
    label: 'Portal Pelanggan',
    description: 'Aplikasi untuk pelanggan melihat tagihan, riwayat pembayaran, dan profil langganan.',
    icon: <Users className="w-6 h-6" />,
    color: 'from-cyan-600 to-cyan-800',
    borderColor: 'border-cyan-500/30',
    iconBg: 'bg-cyan-500/20 text-cyan-400',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
    pathSuffix: '/customer',
  },
  {
    key: 'technician',
    label: 'Portal Teknisi',
    description: 'Aplikasi untuk teknisi lapangan mengelola instalasi, tiket, dan jadwal kunjungan.',
    icon: <Wifi className="w-6 h-6" />,
    color: 'from-emerald-600 to-emerald-800',
    borderColor: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    pathSuffix: '/technician',
  },
  {
    key: 'agent',
    label: 'Portal Agen',
    description: 'Aplikasi untuk agen marketing mengelola referral, komisi, dan monitoring downline.',
    icon: <UserCheck className="w-6 h-6" />,
    color: 'from-violet-600 to-violet-800',
    borderColor: 'border-violet-500/30',
    iconBg: 'bg-violet-500/20 text-violet-400',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    pathSuffix: '/agent',
  },
] as const;

type RoleKey = typeof ROLES[number]['key'];

export default function DownloadApkPage() {
  const [loading, setLoading] = useState<RoleKey | null>(null);

  async function handleDownload(roleKey: RoleKey) {
    setLoading(roleKey);
    try {
      const res = await fetch(`/api/admin/download-apk?role=${roleKey}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download gagal' }));
        alert(err.error || 'Download gagal');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `salfanet-${roleKey}-android.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Terjadi kesalahan saat download. Coba lagi.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <Smartphone className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Download Aplikasi Android</h1>
            <p className="text-sm text-slate-400 mt-1">
              Download project Android (WebView) untuk setiap portal. Build APK menggunakan GitHub Actions atau Android Studio.
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Cara Kerja</p>
          <p className="text-amber-200/80">
            ZIP yang didownload berisi project Android Kotlin siap build. URL portal dan nama aplikasi
            sudah otomatis disesuaikan dengan konfigurasi server. Upload ke GitHub lalu jalankan Actions
            untuk mendapatkan file APK, tanpa perlu install Android Studio.
          </p>
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ROLES.map((role) => (
          <div
            key={role.key}
            className={`relative overflow-hidden rounded-xl border ${role.borderColor} bg-slate-900/60 backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300 group`}
          >
            {/* Gradient top bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${role.color}`} />

            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${role.iconBg} flex items-center justify-center border ${role.borderColor}`}>
                  {role.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white tracking-wide">{role.label}</h3>
                  <span className={`inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded ${role.badgeColor}`}>
                    ...{role.pathSuffix}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">{role.description}</p>

              <button
                onClick={() => handleDownload(role.key)}
                disabled={loading !== null}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold tracking-wider transition-all duration-300 bg-gradient-to-r ${role.color} text-white hover:opacity-90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === role.key ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyiapkan...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download Project ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Build Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GitHub Actions */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Github className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold text-white">Build via GitHub Actions</h3>
            <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-semibold">GRATIS</span>
          </div>
          <ol className="space-y-2.5 text-xs text-slate-400">
            {[
              'Download ZIP, extract ke folder',
              'Buat repository baru di github.com',
              'Upload semua file ke repository',
              'Buka tab Actions → Run workflow',
              'Tunggu ~5 menit → download APK dari Artifacts',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a
            href="https://github.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            Buat Repository Baru
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>

        {/* Android Studio */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold text-white">Build via Android Studio</h3>
            <span className="ml-auto text-[10px] bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded font-semibold">LOKAL</span>
          </div>
          <ol className="space-y-2.5 text-xs text-slate-400">
            {[
              'Download dan install Android Studio',
              'Extract ZIP, buka foldernya di Android Studio',
              'Tunggu Gradle sync selesai (~5 menit pertama kali)',
              'Menu Build → Build APK(s)',
              'APK ada di app/build/outputs/apk/',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a
            href="https://developer.android.com/studio"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            Download Android Studio
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Note */}
      <p className="text-center text-xs text-slate-500">
        APK yang dihasilkan adalah WebView wrapper — membuka portal web di dalam aplikasi native Android.
        Ikon aplikasi menggunakan placeholder; ganti file icon di folder <code className="font-mono text-slate-400">app/src/main/res/mipmap-*/</code> sebelum build.
      </p>
    </div>
  );
}
