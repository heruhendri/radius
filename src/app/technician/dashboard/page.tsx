'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { showError, showSuccess } from '@/lib/sweetalert';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  LogOut,
  User,
  Phone,
  Filter,
  RefreshCcw,
  Loader2,
  PlayCircle,
  XCircle,
  Wrench,
} from 'lucide-react';

interface Technician {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
}

interface WorkOrder {
  id: string;
  technicianId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueType: string;
  description: string;
  priority: string;
  status: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  technician?: {
    id: string;
    name: string;
    phoneNumber: string;
  };
}

export default function TechnicianDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showMyTasks, setShowMyTasks] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (technician) {
      loadWorkOrders();
    }
  }, [technician, filterStatus, filterPriority, showMyTasks]);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/technician/auth/session');
      if (res.ok) {
        const data = await res.json();
        setTechnician(data.technician);
      } else {
        router.push('/technician/login');
      }
    } catch (error) {
      router.push('/technician/login');
    }
  };

  const loadWorkOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      if (showMyTasks) params.append('mine', 'true');

      const res = await fetch(`/api/technician/work-orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data.workOrders);
      }
    } catch (error) {
      // Silent fail - will show empty list
    } finally {
      setLoading(false);
    }
  };

  const handleWorkOrderAction = async (workOrderId: string, action: string) => {
    setActionLoading(workOrderId);
    try {
      const res = await fetch('/api/technician/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId, action }),
      });

      if (res.ok) {
        loadWorkOrders();
        await showSuccess('Action completed successfully');
      } else {
        const data = await res.json();
        await showError(data.error || 'Action failed');
      }
    } catch (error) {
      await showError('Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/technician/auth/logout', { method: 'POST' });
    } catch (error) {
      // Silent fail
    } finally {
      router.push('/technician/login');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'IN_PROGRESS':
        return 'bg-[#00f7ff]/20 text-[#00f7ff] border-[#00f7ff]/40';
      case 'ASSIGNED':
        return 'bg-[#bc13fe]/20 text-[#bc13fe] border-[#bc13fe]/40';
      case 'CANCELLED':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    }
  };

  const stats = {
    total: workOrders.length,
    open: workOrders.filter((w) => w.status === 'OPEN').length,
    assigned: workOrders.filter(
      (w) => w.status === 'ASSIGNED' || w.status === 'IN_PROGRESS'
    ).length,
    completed: workOrders.filter((w) => w.status === 'COMPLETED').length,
  };

  if (!technician) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a0f35] to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#bc13fe]/15 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#00f7ff]/15 rounded-full blur-[100px] animate-pulse delay-700"></div>
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[400px] bg-[#ff44cc]/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-[#bc13fe]/20 to-[#00f7ff]/20 backdrop-blur-xl border-b-2 border-[#bc13fe]/30 shadow-[0_0_30px_rgba(188,19,254,0.2)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-[#bc13fe] to-[#00f7ff] rounded-xl shadow-[0_0_20px_rgba(188,19,254,0.4)]">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                  {technician.name}
                </h1>
                <p className="text-xs text-[#e0d0ff]/70 flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-[#00f7ff]" />
                  {technician.phoneNumber}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl hover:bg-red-500/30 transition-all"
            >
              <LogOut className="h-4 w-4" />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#bc13fe]/30 p-5 hover:border-[#bc13fe]/50 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('technician.totalTasks')}</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="p-3 bg-[#bc13fe]/20 rounded-xl group-hover:bg-[#bc13fe]/30 transition-colors">
                <ClipboardList className="w-6 h-6 text-[#bc13fe]" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-amber-500/30 p-5 hover:border-amber-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('technician.openTasks')}</p>
                <p className="text-3xl font-bold text-amber-400">{stats.open}</p>
              </div>
              <div className="p-3 bg-amber-500/20 rounded-xl group-hover:bg-amber-500/30 transition-colors">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#00f7ff]/30 p-5 hover:border-[#00f7ff]/50 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('technician.activeTasks')}</p>
                <p className="text-3xl font-bold text-[#00f7ff]">{stats.assigned}</p>
              </div>
              <div className="p-3 bg-[#00f7ff]/20 rounded-xl group-hover:bg-[#00f7ff]/30 transition-colors">
                <AlertTriangle className="w-6 h-6 text-[#00f7ff]" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-green-500/30 p-5 hover:border-green-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#e0d0ff]/60 text-sm mb-1">{t('technician.completedTasks')}</p>
                <p className="text-3xl font-bold text-green-400">{stats.completed}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-[#bc13fe]/30 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-5 w-5 text-[#00f7ff]" />

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-sm text-white focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
            >
              <option value="">{t('technician.allStatus')}</option>
              <option value="OPEN">{t('technician.statusOpen')}</option>
              <option value="ASSIGNED">{t('technician.statusAssigned')}</option>
              <option value="IN_PROGRESS">{t('technician.statusInProgress')}</option>
              <option value="COMPLETED">{t('technician.statusCompleted')}</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 bg-slate-900/80 border border-[#bc13fe]/40 rounded-xl text-sm text-white focus:border-[#00f7ff] focus:ring-2 focus:ring-[#00f7ff]/30 transition-all"
            >
              <option value="">{t('technician.allPriority')}</option>
              <option value="URGENT">{t('technician.priorityUrgent')}</option>
              <option value="HIGH">{t('technician.priorityHigh')}</option>
              <option value="MEDIUM">{t('technician.priorityMedium')}</option>
              <option value="LOW">{t('technician.priorityLow')}</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showMyTasks}
                onChange={(e) => setShowMyTasks(e.target.checked)}
                className="w-4 h-4 rounded border-[#bc13fe]/50 bg-slate-900 text-[#00f7ff] focus:ring-[#00f7ff]/50"
              />
              <span className="text-sm text-[#e0d0ff]">
                {t('technician.myTasksOnly')}
              </span>
            </label>

            <button
              onClick={loadWorkOrders}
              className="ml-auto p-2 bg-[#00f7ff]/20 border border-[#00f7ff]/40 text-[#00f7ff] rounded-xl hover:bg-[#00f7ff]/30 transition-all"
            >
              <RefreshCcw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Work Orders List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
            </div>
          ) : workOrders.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-[#bc13fe]/40 p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#bc13fe]/20 to-[#00f7ff]/20 rounded-2xl flex items-center justify-center">
                <ClipboardList className="w-10 h-10 text-[#bc13fe]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('technician.noTasks')}</h3>
              <p className="text-[#e0d0ff]/60">Tidak ada tugas yang perlu dikerjakan saat ini.</p>
            </div>
          ) : (
            workOrders.map((order) => (
              <div
                key={order.id}
                className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-[#bc13fe]/30 rounded-2xl p-5 hover:border-[#00f7ff]/50 hover:shadow-[0_0_30px_rgba(0,247,255,0.15)] transition-all"
              >
                <div className="flex flex-wrap gap-3 justify-between items-start mb-4">
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {order.customerName}
                    </h3>
                    <p className="text-sm text-[#00f7ff] flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      {order.customerPhone}
                    </p>
                    <p className="text-sm text-[#e0d0ff]/60 mt-1">
                      {order.customerAddress}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${getPriorityColor(order.priority)}`}>
                      {t(`technician.priority${order.priority.charAt(0) + order.priority.slice(1).toLowerCase()}`)}
                    </span>
                    <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${getStatusColor(order.status)}`}>
                      {t(`technician.status${order.status.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join('')}`)}
                    </span>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-slate-950/50 rounded-xl border border-[#bc13fe]/20">
                  <p className="text-sm font-medium text-[#00f7ff] mb-1">
                    {t('technician.issueType')}: {order.issueType}
                  </p>
                  <p className="text-sm text-[#e0d0ff]/70">
                    {order.description}
                  </p>
                </div>

                {order.technician && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-[#e0d0ff]/70">
                    <User className="h-4 w-4 text-[#bc13fe]" />
                    {t('technician.assignedTo')}: <strong className="text-white">{order.technician.name}</strong>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {order.status === 'OPEN' && !order.technicianId && (
                    <button
                      onClick={() => handleWorkOrderAction(order.id, 'ASSIGN')}
                      disabled={actionLoading === order.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#00f7ff] to-[#00d4e6] text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,247,255,0.4)] transition-all disabled:opacity-50"
                    >
                      {actionLoading === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {t('technician.takeTask')}
                    </button>
                  )}

                  {order.status === 'ASSIGNED' && order.technicianId === technician.id && (
                    <>
                      <button
                        onClick={() => handleWorkOrderAction(order.id, 'START')}
                        disabled={actionLoading === order.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#bc13fe] to-[#ff44cc] text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] transition-all disabled:opacity-50"
                      >
                        {actionLoading === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                        {t('technician.startTask')}
                      </button>
                      <button
                        onClick={() => handleWorkOrderAction(order.id, 'CANCEL')}
                        disabled={actionLoading === order.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 text-white font-medium rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        {t('technician.cancelTask')}
                      </button>
                    </>
                  )}

                  {order.status === 'IN_PROGRESS' && order.technicianId === technician.id && (
                    <button
                      onClick={() => handleWorkOrderAction(order.id, 'COMPLETE')}
                      disabled={actionLoading === order.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all disabled:opacity-50"
                    >
                      {actionLoading === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {t('technician.completeTask')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
