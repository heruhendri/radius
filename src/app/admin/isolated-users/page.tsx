'use client';

import { useEffect, useState } from 'react';
import { 
  Shield, 
  Users, 
  Wifi, 
  WifiOff, 
  DollarSign, 
  Clock,
  RefreshCw,
  Search,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  Activity,
} from 'lucide-react';

interface IsolatedUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  expiredAt: string;
  profileName: string;
  profilePrice: number;
  unpaidInvoicesCount: number;
  totalUnpaid: number;
  isOnline: boolean;
  ipAddress: string | null;
  loginTime: string | null;
  nasIp: string | null;
  unpaidInvoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
  }>;
}

interface Stats {
  totalIsolated: number;
  totalOnline: number;
  totalOffline: number;
  totalUnpaidAmount: number;
  totalUnpaidInvoices: number;
}

export default function IsolatedUsersMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<IsolatedUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      
      const res = await fetch('/api/admin/isolated-users');
      const data = await res.json();

      if (data.success) {
        setUsers(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch isolated users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ISOLATED': return 'text-[#ff44cc] bg-[#ff44cc]/10 border-[#ff44cc]/30';
      case 'SUSPENDED': return 'text-[#ff4466] bg-[#ff4466]/10 border-[#ff4466]/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery);

    // Status filter
    const matchesStatus = 
      filterStatus === 'all' ? true :
      filterStatus === 'online' ? user.isOnline :
      !user.isOnline;

    return matchesSearch && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = ['Username', 'Name', 'Phone', 'Status', 'Expired', 'Online', 'IP', 'Unpaid Invoices', 'Total Unpaid'];
    const rows = filteredUsers.map(user => [
      user.username,
      user.name,
      user.phone || '-',
      user.status,
      formatDate(user.expiredAt),
      user.isOnline ? 'Online' : 'Offline',
      user.ipAddress || '-',
      user.unpaidInvoicesCount,
      user.totalUnpaid,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isolated-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse"></div>
        </div>
        <div className="text-center relative z-10">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] mb-3" />
          <p className="text-sm text-[#e0d0ff]/70">Loading isolated users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#ff4466] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,68,102,0.5)]">
                <Shield className="w-6 h-6 text-[#ff4466] drop-shadow-[0_0_20px_rgba(255,68,102,0.6)] inline mr-2" />
                Isolated Users Monitor
              </h1>
              <p className="text-sm text-[#e0d0ff]/70 mt-1">
                Real-time monitoring user yang diisolir
              </p>
            </div>
            <button
              onClick={() => fetchData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[#00f7ff]/10 border border-[#00f7ff]/30 rounded-lg hover:bg-[#00f7ff]/20 transition-all text-sm text-[#00f7ff]"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {/* Total Isolated */}
            <div className="bg-gradient-to-br from-[#ff4466]/10 to-[#ff44cc]/10 border border-[#ff4466]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-[#ff6b8a]" />
                <TrendingUp className="w-4 h-4 text-[#ff6b8a]/50" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalIsolated}</div>
              <div className="text-xs text-[#e0d0ff]/70">Total Isolated</div>
            </div>

            {/* Online */}
            <div className="bg-gradient-to-br from-[#00ff88]/10 to-[#00f7ff]/10 border border-[#00ff88]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Wifi className="w-5 h-5 text-[#00ff88]" />
                <Activity className="w-4 h-4 text-[#00ff88]/50" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalOnline}</div>
              <div className="text-xs text-[#e0d0ff]/70">Online</div>
            </div>

            {/* Offline */}
            <div className="bg-gradient-to-br from-gray-500/10 to-gray-600/10 border border-gray-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <WifiOff className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalOffline}</div>
              <div className="text-xs text-[#e0d0ff]/70">Offline</div>
            </div>

            {/* Unpaid Invoices */}
            <div className="bg-gradient-to-br from-[#ff44cc]/10 to-[#bc13fe]/10 border border-[#ff44cc]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-5 h-5 text-[#ff44cc]" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalUnpaidInvoices}</div>
              <div className="text-xs text-[#e0d0ff]/70">Unpaid Invoices</div>
            </div>

            {/* Total Unpaid Amount */}
            <div className="bg-gradient-to-br from-[#00f7ff]/10 to-[#bc13fe]/10 border border-[#00f7ff]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-[#00f7ff]" />
              </div>
              <div className="text-lg font-bold text-white">{formatCurrency(stats.totalUnpaidAmount)}</div>
              <div className="text-xs text-[#e0d0ff]/70">Total Unpaid</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#1a0f35]/80 backdrop-blur-xl border border-[#bc13fe]/20 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e0d0ff]/50" />
              <input
                type="text"
                placeholder="Search username, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0a0520] border border-[#bc13fe]/30 rounded-lg text-sm text-white placeholder-[#e0d0ff]/50 focus:outline-none focus:border-[#00f7ff]/50"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-[#bc13fe]/20 text-[#bc13fe] border border-[#bc13fe]/50'
                    : 'bg-[#0a0520] text-[#e0d0ff]/70 border border-[#bc13fe]/20 hover:border-[#bc13fe]/40'
                }`}
              >
                All ({users.length})
              </button>
              <button
                onClick={() => setFilterStatus('online')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'online'
                    ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50'
                    : 'bg-[#0a0520] text-[#e0d0ff]/70 border border-[#bc13fe]/20 hover:border-[#bc13fe]/40'
                }`}
              >
                Online ({stats?.totalOnline || 0})
              </button>
              <button
                onClick={() => setFilterStatus('offline')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'offline'
                    ? 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                    : 'bg-[#0a0520] text-[#e0d0ff]/70 border border-[#bc13fe]/20 hover:border-[#bc13fe]/40'
                }`}
              >
                Offline ({stats?.totalOffline || 0})
              </button>
            </div>

            {/* Export */}
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-[#00f7ff]/10 border border-[#00f7ff]/30 rounded-lg hover:bg-[#00f7ff]/20 transition-all text-sm text-[#00f7ff] flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#1a0f35]/80 backdrop-blur-xl border border-[#bc13fe]/20 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#bc13fe]/20 bg-[#0a0520]/50">
                  <th className="text-left p-4 text-xs font-semibold text-[#e0d0ff]/70">Status</th>
                  <th className="text-left p-4 text-xs font-semibold text-[#e0d0ff]/70">User</th>
                  <th className="text-left p-4 text-xs font-semibold text-[#e0d0ff]/70">Profile</th>
                  <th className="text-left p-4 text-xs font-semibold text-[#e0d0ff]/70">Expired</th>
                  <th className="text-left p-4 text-xs font-semibold text-[#e0d0ff]/70">Connection</th>
                  <th className="text-left p-4 text-xs font-semibold text-[#e0d0ff]/70">Unpaid</th>
                  <th className="text-left p-4 text-xs font-semibold text-[#e0d0ff]/70">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-[#e0d0ff]/50">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#00ff88]/50" />
                      <p>No isolated users found</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-[#bc13fe]/10 hover:bg-[#bc13fe]/5 transition-colors">
                      {/* Status */}
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg border ${getStatusColor(user.status)}`}>
                            <XCircle className="w-3 h-3" />
                            {user.status}
                          </span>
                          {user.isOnline ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg border text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30">
                              <Wifi className="w-3 h-3" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg border text-gray-400 bg-gray-400/10 border-gray-400/30">
                              <WifiOff className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                        </div>
                      </td>

                      {/* User Info */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-white">{user.username}</div>
                          <div className="text-sm text-[#e0d0ff]/70">{user.name}</div>
                          {user.phone && (
                            <div className="text-xs text-[#e0d0ff]/50 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Profile */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm text-white">{user.profileName}</div>
                          <div className="text-xs text-[#00f7ff]">{formatCurrency(user.profilePrice)}</div>
                        </div>
                      </td>

                      {/* Expired */}
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-sm text-[#ff6b8a]">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.expiredAt)}
                        </div>
                      </td>

                      {/* Connection */}
                      <td className="p-4">
                        {user.isOnline ? (
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="text-white font-mono">{user.ipAddress}</div>
                            <div className="text-[#e0d0ff]/50">Since {formatDateTime(user.loginTime!)}</div>
                            <div className="text-[#e0d0ff]/50">NAS: {user.nasIp}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-[#e0d0ff]/50">Not connected</div>
                        )}
                      </td>

                      {/* Unpaid */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-semibold text-[#ff44cc]">
                            {user.unpaidInvoicesCount} invoice(s)
                          </div>
                          <div className="text-xs text-white">
                            {formatCurrency(user.totalUnpaid)}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex gap-2">
                          <a
                            href={`/admin/pppoe/users/${user.id}`}
                            className="px-3 py-1 bg-[#00f7ff]/10 border border-[#00f7ff]/30 rounded text-xs text-[#00f7ff] hover:bg-[#00f7ff]/20 transition-all"
                          >
                            View
                          </a>
                          <a
                            href={`/isolated?username=${user.username}`}
                            target="_blank"
                            className="px-3 py-1 bg-[#ff44cc]/10 border border-[#ff44cc]/30 rounded text-xs text-[#ff44cc] hover:bg-[#ff44cc]/20 transition-all"
                          >
                            Preview
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 text-center text-xs text-[#e0d0ff]/50">
          Last updated: {new Date().toLocaleTimeString('id-ID')} • Auto-refresh every 30s
        </div>
      </div>
    </div>
  );
}
