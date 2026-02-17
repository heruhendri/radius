'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Wifi,
  Receipt,
  TrendingUp,
  Activity,
  Clock,
  DollarSign,
  Loader2,
  Server,
  Database,
  Zap,
  CheckCircle2,
  XCircle,
  RotateCw,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { formatWIB, getTimezoneInfo } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';
import {
  RevenueLineChart,
  CategoryBarChart,
  UserStatusPieChart,
  UserGrowthChart,
  VoucherSalesChart,
  VoucherStatusPieChart,
  SessionsChart,
  BandwidthChart,
  IncomeExpenseChart,
  TopRevenueSources,
  ChartCard,
} from '@/components/charts';
import TrafficMonitor from '@/components/TrafficMonitor';
import TrafficChartMonitor from '@/components/TrafficChartMonitor';
import AlertWidget from '@/components/dashboard/AlertWidget';

interface StatCard {
  title: string;
  value: string | number;
  change?: string | null;
  icon: React.ReactNode;
  color: string;
}

interface DashboardData {
  stats: {
    totalUsers: { value: number; change: string };
    pppoeUsers?: { value: number; change: string | null };
    hotspotVouchers?: { value: number; active: number; change: string | null };
    activeSessions: { value: number; pppoe?: number; hotspot?: number; change: string | null };
    pendingInvoices: { value: number; change: string };
    revenue: { value: string; change: string };
  };
  network: {
    pppoeUsers: number;
    hotspotSessions: number;
    bandwidth: string;
  };
  activities: RecentActivity[];
  systemStatus?: {
    radius: boolean;
    database: boolean;
    api: boolean;
  };
}

interface RadiusStatus {
  status: 'running' | 'stopped';
  uptime: string;
}

interface RecentActivity {
  id: string;
  user: string;
  action: string;
  time: string;
  status: 'success' | 'warning' | 'error';
}

interface AnalyticsData {
  revenue?: {
    monthly: { month: string; revenue: number }[];
    byCategory: { category: string; amount: number }[];
  };
  users?: {
    byStatus: { name: string; value: number }[];
    growth: { month: string; newUsers: number; totalUsers: number }[];
  };
  hotspot?: {
    salesByProfile: { profile: string; sold: number }[];
    byStatus: { name: string; value: number }[];
  };
  sessions?: {
    hourly: { time: string; pppoe: number; hotspot: number }[];
    bandwidth: { time: string; upload: number; download: number }[];
  };
  financial?: {
    incomeExpense: { month: string; income: number; expense: number }[];
    topSources: { source: string; amount: number }[];
  };
}

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const tzInfo = getTimezoneInfo();
  const [currentTime, setCurrentTime] = useState('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [radiusStatus, setRadiusStatus] = useState<RadiusStatus | null>(null);
  const [restarting, setRestarting] = useState(false);
  const { t } = useTranslation();

  // System alerts example data
  const [systemAlerts] = useState([
    {
      id: '1',
      type: 'success' as const,
      title: 'System Healthy',
      message: 'All services running normally',
      timestamp: new Date(),
    },
    {
      id: '2',
      type: 'info' as const,
      title: 'Update Available',
      message: 'SALFANET RADIUS v2.10.0 is available',
      timestamp: new Date(),
    },
  ]);

  const loadDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const res = await fetch('/api/dashboard/analytics?type=all');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadRadiusStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/radius');
      const data = await res.json();
      if (data.success) {
        setRadiusStatus(data);
      }
    } catch (error) {
      console.error('Failed to load RADIUS status:', error);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
    loadRadiusStatus();
    loadAnalyticsData();
    setCurrentTime(formatWIB(new Date(), 'HH:mm:ss'));
    
    const timeInterval = setInterval(() => {
      setCurrentTime(formatWIB(new Date(), 'HH:mm:ss'));
    }, 1000);

    const dataInterval = setInterval(() => {
      loadDashboardData();
      loadRadiusStatus();
    }, 30000);

    // Analytics refresh every 5 minutes
    const analyticsInterval = setInterval(() => {
      loadAnalyticsData();
    }, 300000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(dataInterval);
      clearInterval(analyticsInterval);
    };
  }, [loadDashboardData, loadRadiusStatus, loadAnalyticsData]);

  const handleRestartRadius = async () => {
    const result = await Swal.fire({
      title: t('system.restartRadius'),
      text: t('system.restartRadiusWarning'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.yes') + ', ' + t('system.restart'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    setRestarting(true);
    try {
      const res = await fetch('/api/system/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await res.json();
      if (data.success) {
        Swal.fire(t('notifications.success'), t('notifications.radiusRestarted'), 'success');
        loadRadiusStatus();
        loadDashboardData();
      } else {
        Swal.fire(t('notifications.error'), data.error || t('errors.restartFailed'), 'error');
      }
    } catch (error) {
      Swal.fire(t('notifications.error'), t('errors.restartFailed'), 'error');
    } finally {
      setRestarting(false);
    }
  };

  const getStats = (): StatCard[] => {
    const placeholder = { value: '-', change: null };
    const data = dashboardData?.stats || {
      totalUsers: placeholder,
      pppoeUsers: placeholder,
      hotspotVouchers: { value: '-', active: '-', change: null },
      activeSessions: placeholder,
      pendingInvoices: placeholder,
      revenue: placeholder,
    };

    const cards: StatCard[] = [
      {
        title: t('dashboard.pppoeUsers'),
        value: typeof data.pppoeUsers?.value === 'number' ? data.pppoeUsers.value.toLocaleString() : '-',
        change: data.pppoeUsers?.change,
        icon: <Users className="w-4 h-4" />,
        color: 'text-primary bg-primary/10',
      },
      {
        title: t('dashboard.hotspotVouchers'),
        value: typeof data.hotspotVouchers?.value === 'number' 
          ? `${data.hotspotVouchers.value.toLocaleString()} (${data.hotspotVouchers.active} ${t('dashboard.active')})` 
          : '-',
        change: data.hotspotVouchers?.change,
        icon: <Wifi className="w-4 h-4" />,
        color: 'text-accent bg-accent/10',
      },
      {
        title: t('dashboard.activeSessions'),
        value: typeof data.activeSessions.value === 'number' 
          ? `${data.activeSessions.value.toLocaleString()} (PPPoE: ${'pppoe' in data.activeSessions ? data.activeSessions.pppoe || 0 : 0}, Hotspot: ${'hotspot' in data.activeSessions ? data.activeSessions.hotspot || 0 : 0})` 
          : '-',
        change: data.activeSessions.change,
        icon: <Activity className="w-4 h-4" />,
        color: 'text-success bg-success/10',
      },
      {
        title: t('dashboard.pendingInvoices'),
        value: typeof data.pendingInvoices.value === 'number' ? data.pendingInvoices.value.toLocaleString() : '-',
        change: data.pendingInvoices.change,
        icon: <Receipt className="w-4 h-4" />,
        color: 'text-warning bg-warning/10',
      },
      {
        title: t('dashboard.revenue'),
        value: data.revenue.value || '-',
        change: data.revenue.change,
        icon: <DollarSign className="w-4 h-4" />,
        color: 'text-info bg-info/10',
      },
    ];

    return cards;
  };

  const handleRefreshAnalytics = () => {
    loadAnalyticsData();
  };

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
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">{t('dashboard.title')}</h1>
          <p className="text-sm text-[#e0d0ff]/80 flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
            {tzInfo.name} • {currentTime}
          </p>
        </div>
        <button
          onClick={handleRefreshAnalytics}
          disabled={analyticsLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00f7ff]/10 border-2 border-[#00f7ff]/30 text-[#00f7ff] rounded-lg hover:bg-[#00f7ff]/20 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(0,247,255,0.2)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats Grid - 5 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
          </div>
        ) : (
          getStats().map((stat) => (
            <div
              key={stat.title}
              className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 hover:border-[#bc13fe]/50 hover:shadow-[0_0_30px_rgba(188,19,254,0.3)] transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#00f7ff] uppercase tracking-wide truncate">
                    {stat.title}
                  </p>
                  <p className="text-xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">
                    {stat.value}
                  </p>
                  {stat.change && (
                    <p className={`text-xs font-medium mt-1 ${
                      stat.change.startsWith('+') ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stat.change}
                    </p>
                  )}
                </div>
                <div className={`p-2 rounded-lg ${stat.color} shadow-lg`}>
                  {stat.icon}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* System Alerts Widget */}
      {systemAlerts.length > 0 && (
        <div className="mb-3">
          <AlertWidget alerts={systemAlerts} maxAlerts={3} />
        </div>
      )}

      {/* Traffic Monitor Section - Moved below stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <TrafficChartMonitor />
        </div>
        
        {/* Recent Activities */}
        <div className="bg-card rounded-lg border border-border p-3">
          <h2 className="text-sm font-semibold text-card-foreground mb-3">{t('dashboard.recentActivities')}</h2>
          <div className="space-y-2">
            {!dashboardData || dashboardData.activities.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Activity className="h-5 w-5 mx-auto mb-1 opacity-50" />
                <p className="text-xs">{t('dashboard.noRecentActivities')}</p>
              </div>
            ) : (
              dashboardData.activities.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-card-foreground truncate">
                      {activity.user}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {activity.action}
                    </p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-[10px] text-muted-foreground">{formatWIB(activity.time, 'HH:mm')}</p>
                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-medium rounded ${
                      activity.status === 'success'
                        ? 'bg-success/10 text-success'
                        : activity.status === 'warning'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 1: Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <ChartCard 
            title={t('dashboard.monthlyRevenue')} 
            subtitle={t('dashboard.last12Months')}
            action={<LineChartIcon className="w-4 h-4 text-muted-foreground" />}
          >
            <RevenueLineChart 
              data={analyticsData?.revenue?.monthly || []} 
              loading={analyticsLoading}
              height={220}
            />
          </ChartCard>
        </div>
        <ChartCard 
          title={t('dashboard.revenueByCategory')} 
          subtitle={t('dashboard.thisMonth')}
          action={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
        >
          <CategoryBarChart 
            data={analyticsData?.revenue?.byCategory || []} 
            loading={analyticsLoading}
            height={220}
          />
        </ChartCard>
      </div>

      {/* Charts Row 2: Users & Hotspot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ChartCard 
          title={t('dashboard.userByStatus')} 
          subtitle={t('dashboard.pppoeUsers')}
          action={<PieChartIcon className="w-4 h-4 text-muted-foreground" />}
        >
          <UserStatusPieChart 
            data={analyticsData?.users?.byStatus || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.userGrowth')} 
          subtitle={t('dashboard.last12Months')}
          action={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
        >
          <UserGrowthChart 
            data={analyticsData?.users?.growth || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.voucherSales')} 
          subtitle={t('dashboard.perProfileThisMonth')}
          action={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
        >
          <VoucherSalesChart 
            data={analyticsData?.hotspot?.salesByProfile || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.voucherStatus')} 
          subtitle={t('dashboard.allVouchers')}
          action={<PieChartIcon className="w-4 h-4 text-muted-foreground" />}
        >
          <VoucherStatusPieChart 
            data={analyticsData?.hotspot?.byStatus || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>
      </div>

      {/* Charts Row 3: Sessions & Financial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard 
          title={t('dashboard.activeSessions')} 
          subtitle={t('dashboard.last24Hours')}
          action={<Activity className="w-4 h-4 text-muted-foreground" />}
        >
          <SessionsChart 
            data={analyticsData?.sessions?.hourly || []} 
            loading={analyticsLoading}
            height={200}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.bandwidthUsage')} 
          subtitle={t('dashboard.last7Days')}
          action={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
        >
          <BandwidthChart 
            data={analyticsData?.sessions?.bandwidth || []} 
            loading={analyticsLoading}
            height={200}
          />
        </ChartCard>
      </div>

      {/* Charts Row 4: Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <ChartCard 
            title={t('dashboard.incomeVsExpense')} 
            subtitle={t('dashboard.last6Months')}
            action={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
          >
            <IncomeExpenseChart 
              data={analyticsData?.financial?.incomeExpense || []} 
              loading={analyticsLoading}
              height={200}
            />
          </ChartCard>
        </div>
        <ChartCard 
          title={t('dashboard.topRevenueSources')} 
          subtitle={t('dashboard.thisMonth')}
          action={<DollarSign className="w-4 h-4 text-muted-foreground" />}
        >
          <TopRevenueSources 
            data={analyticsData?.financial?.topSources || []} 
            loading={analyticsLoading}
            height={200}
          />
        </ChartCard>
      </div>

      {/* Network Overview - Full Width */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <h2 className="text-sm font-semibold text-foreground mb-3">{t('dashboard.networkOverview')}</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-teal-50 dark:bg-teal-900/20 rounded-md flex items-center justify-center">
                  <Wifi className="w-3.5 h-3.5 text-primary dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{t('dashboard.pppoeUsers')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('dashboard.activeConnections')}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {dashboardData?.network.pppoeUsers.toLocaleString() || '-'}
              </p>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-50 dark:bg-emerald-900/20 rounded-md flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{t('dashboard.hotspotSessions')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('dashboard.activeVouchers')}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {dashboardData?.network.hotspotSessions.toLocaleString() || '-'}
              </p>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-violet-50 dark:bg-violet-900/20 rounded-md flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{t('dashboard.bandwidth')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('dashboard.allTimeUsage')}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {dashboardData?.network.bandwidth || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-card rounded-lg border border-border p-3">
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('dashboard.systemStatus')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* RADIUS Server */}
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              radiusStatus?.status === 'running'
                ? 'bg-success/10'
                : 'bg-destructive/10'
            }`}>
              <Server className={`w-3.5 h-3.5 ${
                radiusStatus?.status === 'running'
                  ? 'text-success'
                  : 'text-destructive'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">{t('system.radius')}</p>
              <div className="flex items-center gap-1">
                {radiusStatus?.status === 'running' ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-success" />
                    <span className="text-[10px] text-success truncate">{radiusStatus.uptime}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-2.5 h-2.5 text-destructive" />
                    <span className="text-[10px] text-destructive">{t('system.offline')}</span>
                  </>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRestartRadius}
              disabled={restarting}
              className="h-6 w-6 p-0"
            >
              {restarting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {/* Database */}
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              dashboardData?.systemStatus?.database
                ? 'bg-success/10'
                : 'bg-destructive/10'
            }`}>
              <Database className={`w-3.5 h-3.5 ${
                dashboardData?.systemStatus?.database
                  ? 'text-success'
                  : 'text-destructive'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">{t('system.database')}</p>
              <div className="flex items-center gap-1">
                {dashboardData?.systemStatus?.database ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-success" />
                    <span className="text-[10px] text-success">{t('system.connected')}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-2.5 h-2.5 text-destructive" />
                    <span className="text-[10px] text-destructive">{t('system.disconnected')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* API */}
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              dashboardData?.systemStatus?.api
                ? 'bg-success/10'
                : 'bg-destructive/10'
            }`}>
              <Zap className={`w-3.5 h-3.5 ${
                dashboardData?.systemStatus?.api
                  ? 'text-success'
                  : 'text-destructive'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">{t('system.api')}</p>
              <div className="flex items-center gap-1">
                {dashboardData?.systemStatus?.api ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-success" />
                    <span className="text-[10px] text-success">{t('system.running')}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-2.5 h-2.5 text-destructive" />
                    <span className="text-[10px] text-destructive">{t('system.stopped')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
