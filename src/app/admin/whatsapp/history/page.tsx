'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showError } from '@/lib/sweetalert';
import Swal from 'sweetalert2';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface HistoryItem {
  id: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed';
  response: string;
  providerName?: string;
  providerType?: string;
  sentAt: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  last24Hours: number;
}

const getProviderColor = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'mpwa': return 'bg-primary/20 text-primary dark:text-primary';
    case 'waha': return 'bg-success/20 text-success dark:bg-green-900/30 dark:text-success';
    case 'fonnte': return 'bg-accent/20 text-accent dark:bg-purple-900/30 dark:text-purple-400';
    case 'wablas': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default: return 'bg-gray-100 text-foreground dark:bg-inputdark:text-muted-foreground';
  }
};

export default function WhatsAppHistoryPage() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, last24Hours: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/whatsapp/history?${params}`);
      const data = await res.json();

      if (data.success) {
        setHistory(data.data);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        showError(t('whatsapp.failedLoadHistory'));
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      showError(t('whatsapp.failedLoadHistory'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchHistory();
  };

  const showDetail = (item: HistoryItem) => {
    let responseData;
    try {
      responseData = JSON.parse(item.response);
    } catch {
      responseData = item.response;
    }

    Swal.fire({
      title: t('whatsapp.messageDetail'),
      html: `
        <div class="text-left space-y-3 text-sm">
          <div class="flex gap-2">
            <span class="font-semibold text-gray-400 min-w-[80px]">${t('whatsapp.numberLabel')}:</span>
            <span class="text-gray-200">${item.phone}</span>
          </div>
          <div class="flex gap-2">
            <span class="font-semibold text-gray-400 min-w-[80px]">${t('whatsapp.statusLabel')}:</span>
            <span>${item.status === 'sent' ? `<span class="text-green-400">✅ ${t('whatsapp.sentStatus')}</span>` : `<span class="text-red-400">❌ ${t('whatsapp.failedStatus')}</span>`}</span>
          </div>
          ${item.providerName ? `
          <div class="flex gap-2">
            <span class="font-semibold text-gray-400 min-w-[80px]">${t('whatsapp.providerLabel')}:</span>
            <span class="text-gray-200">${item.providerName} <span class="text-purple-400">(${item.providerType?.toUpperCase()})</span></span>
          </div>` : ''}
          <div class="flex gap-2">
            <span class="font-semibold text-gray-400 min-w-[80px]">${t('whatsapp.timeLabel')}:</span>
            <span class="text-gray-200">${new Date(item.sentAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</span>
          </div>
          <div class="mt-4">
            <div class="font-semibold text-gray-400 mb-2">${t('whatsapp.messageLabel')}:</div>
            <div class="whitespace-pre-wrap bg-gray-800 border border-gray-700 p-3 rounded text-xs max-h-32 overflow-auto text-gray-200">${item.message}</div>
          </div>
          <div class="mt-4">
            <div class="font-semibold text-gray-400 mb-2">${t('whatsapp.responseLabel')}:</div>
            <pre class="text-xs bg-gray-800 border border-gray-700 p-3 rounded max-h-40 overflow-auto text-gray-300 font-mono">${JSON.stringify(responseData, null, 2)}</pre>
          </div>
        </div>
      `,
      width: 600,
      background: '#1e1b2e',
      color: '#e0d0ff',
      confirmButtonText: t('common.close'),
      confirmButtonColor: '#00f7ff',
      customClass: {
        popup: 'border border-[#bc13fe]/30',
        title: 'text-xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent',
        confirmButton: 'px-6 py-2.5 text-sm font-bold rounded-lg shadow-[0_0_20px_rgba(0,247,255,0.4)] hover:shadow-[0_0_30px_rgba(0,247,255,0.6)] transition-all'
      }
    });
  };

  if (loading && history.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted dark:bg-gray-950">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground dark:text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      <div className="relative z-10 space-y-6">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)] flex items-center gap-2">
              <svg className="w-6 h-6 text-[#00f7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('whatsapp.historyTitle')}
            </h1>
            <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('whatsapp.historySubtitle')}</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-card rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/20 dark:bg-blue-900/30 rounded">
                  <svg className="w-3.5 h-3.5 text-primary dark:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('whatsapp.totalMessages')}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-success/20 dark:bg-green-900/30 rounded">
                  <svg className="w-3.5 h-3.5 text-success dark:text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-success">{stats.sent}</p>
                  <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('whatsapp.sentToday')}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-destructive/20 dark:bg-red-900/30 rounded">
                  <svg className="w-3.5 h-3.5 text-destructive dark:text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-destructive">{stats.failed}</p>
                  <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('whatsapp.failedToday')}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-accent/20 dark:bg-purple-900/30 rounded">
                  <svg className="w-3.5 h-3.5 text-accent dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-accent">{stats.last24Hours}</p>
                  <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('whatsapp.activityToday')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {['all', 'sent', 'failed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => { setStatusFilter(status); setPage(1); }}
                    className={`h-7 px-2.5 text-[10px] font-medium rounded transition-colors ${statusFilter === status
                        ? status === 'sent' ? 'bg-success text-white' : status === 'failed' ? 'bg-destructive text-destructive-foreground' : 'bg-teal-600 text-white'
                        : 'bg-muted text-foreground hover:bg-muted'
                      }`}
                  >
                    {status === 'all' ? t('common.all') : status === 'sent' ? `✓ ${t('whatsapp.sent')}` : `✗ ${t('whatsapp.failed')}`}
                  </button>
                ))}
              </div>
              <div className="flex-1 flex gap-1.5 min-w-[200px]">
                <input
                  type="text"
                  placeholder={t('whatsapp.searchPhoneMessage')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 h-7 px-2.5 text-xs bg-card border border-border rounded-md focus:ring-1 focus:ring-primary focus:border-teal-500 text-foreground"
                />
                <button
                  onClick={handleSearch}
                  className="h-7 px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-white text-xs rounded transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs">{t('whatsapp.noHistory')}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-background/50">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">{t('common.time')}</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">{t('whatsapp.number')}</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider hidden md:table-cell">{t('whatsapp.message')}</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('whatsapp.provider')}</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">{t('common.status')}</th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">{t('common.action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/50/50 transition-colors">
                          <td className="px-3 py-1.5">
                            <div className="text-xs text-foreground">
                              {formatDistanceToNow(new Date(item.sentAt), {
                                addSuffix: true,
                                locale: localeId,
                              })}
                            </div>
                            <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                              {new Date(item.sentAt).toLocaleString('id-ID', {
                                timeZone: 'Asia/Jakarta',
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs font-mono text-foreground">{item.phone}</span>
                          </td>
                          <td className="px-3 py-1.5 hidden md:table-cell">
                            <div className="max-w-xs truncate text-xs text-muted-foreground dark:text-muted-foreground">
                              {item.message}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 hidden sm:table-cell">
                            {item.providerName ? (
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${getProviderColor(item.providerType)}`}>
                                {item.providerName}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {item.status === 'sent' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success/20 dark:bg-green-900/30 text-success text-[10px] font-medium rounded">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {t('whatsapp.sent')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-destructive/20 dark:bg-red-900/30 text-destructive text-[10px] font-medium rounded">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {t('whatsapp.failed')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button
                              onClick={() => showDetail(item)}
                              className="p-1 text-primary hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                              title="Detail"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-border">
                  <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    {t('whatsapp.page')} {page} {t('table.of')} {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1 || loading}
                      className="h-6 px-2 text-[10px] font-medium text-foreground bg-card border border-border rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      {t('whatsapp.prev')}
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages || loading}
                      className="h-6 px-2 text-[10px] font-medium text-foreground bg-card border border-border rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {t('whatsapp.next')}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
