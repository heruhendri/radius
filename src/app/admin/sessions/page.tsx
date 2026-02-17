'use client';

import { useEffect, useState } from 'react';
import { Activity, Filter, Power, RefreshCw, Wifi, WifiOff, Search, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import { useTranslation } from '@/hooks/useTranslation';

interface Session {
  id: string;
  username: string;
  sessionId: string;
  type: 'pppoe' | 'hotspot';
  nasIpAddress: string;
  framedIpAddress: string;
  macAddress: string;
  startTime: string;
  lastUpdate: string | null;
  duration: number;
  durationFormatted: string;
  uploadFormatted: string;
  downloadFormatted: string;
  totalFormatted: string;
  router: { id: string; name: string } | null;
  user: { id: string; name: string; phone: string; profile: string } | null;
  voucher: { 
    id: string; 
    status: string; 
    profile: string;
    batchCode?: string;
    agent?: { id: string; name: string } | null;
  } | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Stats {
  total: number;
  pppoe: number;
  hotspot: number;
  totalBandwidthFormatted: string;
}

interface AllTimeStats {
  totalSessions: number;
  totalBandwidthFormatted: string;
  totalDurationFormatted: string;
}

interface Router {
  id: string;
  name: string;
}

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null);
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [disconnecting, setDisconnecting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [routerFilter, setRouterFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const fetchSessions = async (page: number = 1) => {
    try {
      // Pastikan page adalah number
      const pageNum = typeof page === 'number' ? page : 1;
      setLoading(true);
      const params = new URLSearchParams();
      // Full RADIUS mode dengan pagination
      params.set('page', pageNum.toString());
      params.set('limit', pageSize.toString());
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await fetch(`/api/sessions?${params}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setStats(data.stats);
      setAllTimeStats(data.allTimeStats);
      if (data.pagination) {
        setPagination(data.pagination);
        setCurrentPage(data.pagination.page);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format date helper
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/network/routers');
      const data = await res.json();
      setRouters(data.routers || []);
    } catch (error) {
      console.error('Failed to fetch routers:', error);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  useEffect(() => {
    fetchSessions(1);
    // Auto-refresh setiap 30 detik - gunakan currentPage state
    const interval = setInterval(() => {
      fetchSessions(currentPage);
    }, 30000);
    return () => clearInterval(interval);
  }, [typeFilter, routerFilter, searchFilter, pageSize, currentPage]);

  // Export functions
  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      params.set('mode', 'active');
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      if (searchFilter) params.set('username', searchFilter);
      const res = await fetch(`/api/sessions/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Sessions-Active-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await Swal.fire('Error', t('sessions.exportFailed'), 'error'); }
  };

  const handleExportHistoryExcel = async () => {
    const { value: dateRange } = await Swal.fire({
      title: t('sessions.exportHistory'),
      html: `
        <div class="text-left text-sm">
          <label class="block mb-1 font-medium">${t('time.from')}</label>
          <input id="startDate" type="date" class="w-full px-3 py-2 border rounded mb-3" value="${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
          <label class="block mb-1 font-medium">${t('time.to')}</label>
          <input id="endDate" type="date" class="w-full px-3 py-2 border rounded" value="${new Date().toISOString().split('T')[0]}">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: t('common.export'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#0d9488',
      preConfirm: () => ({
        startDate: (document.getElementById('startDate') as HTMLInputElement).value,
        endDate: (document.getElementById('endDate') as HTMLInputElement).value
      })
    });
    
    if (!dateRange) return;
    
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      params.set('mode', 'history');
      params.set('startDate', dateRange.startDate);
      params.set('endDate', dateRange.endDate);
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      const res = await fetch(`/api/sessions/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Sessions-History-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await Swal.fire('Error', t('sessions.exportFailed'), 'error'); }
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'pdf');
      params.set('mode', 'active');
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      const res = await fetch(`/api/sessions/export?${params}`);
      const data = await res.json();
      if (data.pdfData) {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14); doc.text(data.pdfData.title, 14, 15);
        doc.setFontSize(8); doc.text(`Generated: ${data.pdfData.generatedAt}`, 14, 21);
        autoTable(doc, { head: [data.pdfData.headers], body: data.pdfData.rows, startY: 26, styles: { fontSize: 7 }, headStyles: { fillColor: [13, 148, 136] } });
        if (data.pdfData.summary) {
          const finalY = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          data.pdfData.summary.forEach((s: any, i: number) => { doc.text(`${s.label}: ${s.value}`, 14, finalY + (i * 5)); });
        }
        doc.save(`Sessions-Active-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) { console.error('PDF error:', error); await Swal.fire('Error', t('sessions.pdfExportFailed'), 'error'); }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sessions.map(s => s.sessionId)));
    } else {
      setSelectedSessions(new Set());
    }
  };

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSessions);
    if (checked) {
      newSelected.add(sessionId);
    } else {
      newSelected.delete(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleDisconnect = async (sessionIds: string[]) => {
    const result = await Swal.fire({
      title: t('sessions.disconnect') + '?',
      text: `${t('sessions.disconnect')} ${sessionIds.length} ${t('sessions.title').toLowerCase()}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: t('sessions.disconnect'),
      cancelButtonText: t('common.cancel')
    });

    if (!result.isConfirmed) return;

    setDisconnecting(true);
    try {
      const res = await fetch('/api/sessions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds }),
      });

      const data = await res.json();
      
      if (data.success) {
        await Swal.fire({
          title: t('notifications.success'),
          html: `${t('sessions.disconnect')}: <strong>${data.summary.successful}</strong>`,
          icon: 'success',
          confirmButtonColor: '#0d9488'
        });
        setSelectedSessions(new Set());
        await fetchSessions();
      } else {
        await Swal.fire(t('notifications.error'), t('notifications.failed'), 'error');
      }
    } catch (error) {
      await Swal.fire(t('notifications.error'), t('notifications.failed'), 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleBulkDisconnect = () => {
    const sessionIds = Array.from(selectedSessions);
    handleDisconnect(sessionIds);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a0f35] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <RefreshCw className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* Neon Cyberpunk Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      
      <div className="relative z-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)] flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#00f7ff]" />
            {t('sessions.title')}
          </h1>
          <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('sessions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-success text-white rounded-md hover:bg-success/90"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportHistoryExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Download className="w-3.5 h-3.5" />
            {t('sessions.history')}
          </button>
          <button
            onClick={() => fetchSessions(currentPage)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-muted/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('sessions.active')}</div>
            <div className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.total}</div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="text-xs text-[#00f7ff] uppercase tracking-wide flex items-center gap-1">
              <Wifi className="w-4 h-4" /> PPPoE
            </div>
            <div className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.pppoe}</div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="text-xs text-[#00f7ff] uppercase tracking-wide flex items-center gap-1">
              <WifiOff className="w-4 h-4" /> Hotspot
            </div>
            <div className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.hotspot}</div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('dashboard.bandwidth')}</div>
            <div className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.totalBandwidthFormatted}</div>
          </div>
        </div>
      )}

      {/* All-Time Stats */}
      {allTimeStats && (
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
          <h2 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            {t('sessions.allTimeStatistics')}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('sessions.totalSessionsLabel')}</div>
              <div className="text-base font-bold text-foreground">{allTimeStats.totalSessions.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('sessions.bandwidthUsed')}</div>
              <div className="text-base font-bold text-primary">{allTimeStats.totalBandwidthFormatted}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('sessions.totalDuration')}</div>
              <div className="text-base font-bold text-cyan-600">{allTimeStats.totalDurationFormatted}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card p-3 rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">{t('common.filter')}:</span>
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 border border-border bg-muted rounded-md text-xs"
            >
              <option value="">{t('common.all')} {t('common.type')}</option>
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </select>

            <select
              value={routerFilter}
              onChange={(e) => setRouterFilter(e.target.value)}
              className="px-2 py-1.5 border border-border bg-muted rounded-md text-xs"
            >
              <option value="">{t('common.all')} Router</option>
              {routers.map(router => (
                <option key={router.id} value={router.id}>{router.name}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-7 pr-3 py-1.5 border border-border bg-muted rounded-md text-xs w-40"
              />
            </div>
          </div>

          {selectedSessions.size > 0 && (
            <button
              onClick={handleBulkDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 text-xs"
            >
              <Power className="w-3.5 h-3.5" />
              {t('sessions.disconnect')} ({selectedSessions.size})
            </button>
          )}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {/* Pagination Header */}
        <div className="px-3 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground">
            <span>{t('sessions.show')}</span>
            <select 
              value={pageSize} 
              onChange={(e) => { setPageSize(Number(e.target.value)); }}
              className="px-2 py-1 border border-border rounded text-xs bg-card"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>{t('sessions.entries')}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('sessions.showing')} {((pagination.page - 1) * pageSize) + 1} {t('sessions.to')} {Math.min(pagination.page * pageSize, pagination.total)} {t('sessions.of')} {pagination.total} {t('sessions.entries')}
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-xs">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : t('common.noData')}
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="p-3 hover:bg-muted/50/50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.sessionId)}
                      onChange={(e) => handleSelectSession(session.sessionId, e.target.checked)}
                      className="rounded border-gray-300 w-3.5 h-3.5"
                    />
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      session.type === 'pppoe' 
                        ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {session.type === 'pppoe' ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                      {session.type.toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDisconnect([session.sessionId])}
                    disabled={disconnecting}
                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded disabled:opacity-50"
                    title={t('sessions.disconnect')}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.username')}:</span>
                    <span className="font-mono font-medium text-foreground">{session.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.profile')}:</span>
                    <span className="text-foreground">{session.user?.profile || session.voucher?.profile || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.startTime')}:</span>
                    <span className="text-muted-foreground dark:text-muted-foreground">{formatDateTime(session.startTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.duration')}:</span>
                    <span className="font-medium text-primary dark:text-primary">{session.durationFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.uploadDownload')}:</span>
                    <span>
                      <span className="text-success">↑{session.uploadFormatted}</span>
                      {' / '}
                      <span className="text-accent">↓{session.downloadFormatted}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.router')}:</span>
                    <span className="text-muted-foreground dark:text-muted-foreground">{session.router?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.ipAddress')}:</span>
                    <span className="font-mono text-muted-foreground dark:text-muted-foreground">{session.framedIpAddress || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sessions.macAddress')}:</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{session.macAddress || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedSessions.size === sessions.length && sessions.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 w-3.5 h-3.5"
                  />
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('common.type')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('sessions.username')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden md:table-cell">{t('sessions.profile')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden xl:table-cell">{t('sessions.startTime')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden xl:table-cell">{t('sessions.lastUpdate')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('sessions.duration')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden lg:table-cell">↑ {t('sessions.upload')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden lg:table-cell">↓ {t('sessions.download')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden sm:table-cell">{t('sessions.router')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden sm:table-cell">{t('sessions.ipAddress')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden 2xl:table-cell">{t('sessions.macAddress')}</th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground text-xs">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : t('common.noData')}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-muted/50/50">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.sessionId)}
                        onChange={(e) => handleSelectSession(session.sessionId, e.target.checked)}
                        className="rounded border-gray-300 w-3.5 h-3.5"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        session.type === 'pppoe' 
                          ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {session.type === 'pppoe' ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        {session.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px] text-foreground">{session.username}</td>
                    <td className="px-2 py-2 text-[10px] hidden md:table-cell">
                      {session.user?.profile || session.voucher?.profile || '-'}
                    </td>
                    <td className="px-2 py-2 text-[10px] text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                      {formatDateTime(session.startTime)}
                    </td>
                    <td className="px-2 py-2 text-[10px] text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                      {formatDateTime(session.lastUpdate)}
                    </td>
                    <td className="px-2 py-2 text-[10px] font-medium text-primary dark:text-primary">
                      {session.durationFormatted}
                    </td>
                    <td className="px-2 py-2 text-[10px] text-success hidden lg:table-cell">{session.uploadFormatted}</td>
                    <td className="px-2 py-2 text-[10px] text-accent hidden lg:table-cell">{session.downloadFormatted}</td>
                    <td className="px-2 py-2 text-[10px] text-muted-foreground dark:text-muted-foreground hidden sm:table-cell">
                      {session.router?.name || '-'}
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground dark:text-muted-foreground hidden sm:table-cell">
                      {session.framedIpAddress || '-'}
                    </td>
                    <td className="px-2 py-2 font-mono text-[9px] text-muted-foreground hidden 2xl:table-cell">
                      {session.macAddress || '-'}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleDisconnect([session.sessionId])}
                        disabled={disconnecting}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded disabled:opacity-50"
                        title={t('sessions.disconnect')}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-muted/50">
            <div className="text-xs text-muted-foreground">
              {t('common.page')} {pagination.page} {t('sessions.of')} {pagination.totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchSessions(1)}
                disabled={pagination.page === 1}
                className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-muted"
              >
                {t('common.first')}
              </button>
              <button
                onClick={() => fetchSessions(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-muted"
              >
                {t('common.prev')}
              </button>
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum = pagination.page - 2 + i;
                if (pageNum < 1) pageNum = i + 1;
                if (pageNum > pagination.totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => fetchSessions(pageNum)}
                    className={`px-2.5 py-1 text-xs border rounded ${
                      pageNum === pagination.page 
                        ? 'bg-teal-600 text-white border-teal-600' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => fetchSessions(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-muted"
              >
                {t('common.next')}
              </button>
              <button
                onClick={() => fetchSessions(pagination.totalPages)}
                disabled={pagination.page === pagination.totalPages}
                className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-muted"
              >
                {t('common.last')}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
