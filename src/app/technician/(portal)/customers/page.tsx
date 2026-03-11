'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  RefreshCcw,
  Loader2,
  User,
  Phone,
  Package,
  MapPin,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useTranslation } from '@/hooks/useTranslation';

interface Customer {
  id: string;
  username: string;
  customerId: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  subscriptionType: string;
  expiredAt: string | null;
  createdAt: string;
  profile: {
    id: string;
    name: string;
    price: number;
    downloadSpeed: number;
    uploadSpeed: number;
  } | null;
  area: { id: string; name: string } | null;
  router: { id: string; name: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  active:
    'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/40',
  isolated:
    'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/40',
  stopped:
    'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600/40',
  blocked:
    'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40',
  expired:
    'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40',
};



const STATUS_ICON: Record<string, React.ReactNode> = {
  active: <Wifi className="w-3 h-3" />,
  isolated: <WifiOff className="w-3 h-3" />,
  stopped: <AlertTriangle className="w-3 h-3" />,
  blocked: <AlertTriangle className="w-3 h-3" />,
  expired: <Clock className="w-3 h-3" />,
};

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TechnicianCustomersPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const STATUS_LABEL: Record<string, string> = {
    active: t('techPortal.active'),
    isolated: t('techPortal.isolated'),
    stopped: t('techPortal.stopped'),
    blocked: t('techPortal.blocked'),
    expired: t('techPortal.expired'),
  };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const LIMIT = 30;

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) p.set('search', search);
      if (filterStatus) p.set('status', filterStatus);
      const res = await fetch(`/api/technician/customers?${p}`);
      if (!res.ok) throw new Error(t('techPortal.failedLoadCustomers'));
      const data = await res.json();
      setCustomers(data.users ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {
      addToast({ type: 'error', title: t('techPortal.failedLoadCustomers') });
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, addToast]);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#bc13fe]" />
            {t('techPortal.customers')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#e0d0ff]/60 mt-0.5">
            {total.toLocaleString('id-ID')} {t('techPortal.customersSubtitle')}
          </p>
        </div>
        <button
          onClick={loadCustomers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-[#bc13fe]/10 hover:bg-slate-200 dark:hover:bg-[#bc13fe]/20 text-slate-700 dark:text-[#e0d0ff] border border-slate-200 dark:border-[#bc13fe]/30 rounded-xl transition-all"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('techPortal.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-[#bc13fe] flex-shrink-0" />
          <div className="flex-1 min-w-56 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('techPortal.searchCustomer')}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#bc13fe]/60 focus:ring-1 focus:ring-[#bc13fe]/30"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#bc13fe]/60"
          >
            <option value="">{t('techPortal.allStatus')}</option>
            <option value="active">{t('techPortal.active')}</option>
            <option value="isolated">{t('techPortal.isolated')}</option>
            <option value="stopped">{t('techPortal.stopped')}</option>
            <option value="blocked">{t('techPortal.blocked')}</option>
          </select>
        </div>
      </div>

      {/* Customer cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#bc13fe]" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-[#e0d0ff]/50">{t('techPortal.noData')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customers.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-[#bc13fe]/30 dark:hover:border-[#bc13fe]/40 transition-all"
              >
                {/* Customer header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#bc13fe]/20 to-[#00f7ff]/20 flex items-center justify-center border border-[#bc13fe]/20 flex-shrink-0">
                      <User className="w-4 h-4 text-[#bc13fe]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {c.name}
                      </p>
                      {c.customerId && (
                        <p className="text-[10px] text-[#bc13fe] font-mono"># {c.customerId}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border flex-shrink-0 ${STATUS_STYLE[c.status] ?? STATUS_STYLE.active}`}
                  >
                    {STATUS_ICON[c.status]}
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-semibold text-[#00f7ff]">{c.username}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-[10px] text-slate-400">{c.subscriptionType}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                  {c.address && (
                    <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">{c.address}</span>
                    </div>
                  )}
                </div>

                {/* Bottom row */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 min-w-0">
                    {c.profile && (
                      <>
                        <Package className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{c.profile.name}</span>
                        <span className="text-slate-300 dark:text-slate-600 flex-shrink-0">·</span>
                        <span className="flex-shrink-0">{formatIDR(c.profile.price)}</span>
                      </>
                    )}
                  </div>
                  {c.expiredAt && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 flex-shrink-0">
                      <CalendarDays className="w-3 h-3" />
                      <span>{formatDate(c.expiredAt)}</span>
                    </div>
                  )}
                </div>

                {c.area && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <MapPin className="w-2.5 h-2.5" />
                    <span>{c.area.name}</span>
                    {c.router && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <Wifi className="w-2.5 h-2.5" />
                        <span>{c.router.name}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500 dark:text-[#e0d0ff]/60">
                {t('techPortal.page')} {page} / {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
