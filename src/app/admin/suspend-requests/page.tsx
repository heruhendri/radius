'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PauseCircle, CheckCircle2, XCircle, Clock, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/sweetalert';

interface SuspendUser {
  id: string;
  name: string;
  username: string;
  customerId: string | null;
  phone: string;
  status: string;
}

interface SuspendRequest {
  id: string;
  status: string;
  reason: string | null;
  startDate: string;
  endDate: string;
  adminNotes: string | null;
  requestedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  user: SuspendUser;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:   { label: 'Pending',    className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  APPROVED:  { label: 'Approved',   className: 'bg-green-100  text-green-800  border-green-300'  },
  REJECTED:  { label: 'Rejected',   className: 'bg-red-100    text-red-800    border-red-300'    },
  CANCELLED: { label: 'Cancelled',  className: 'bg-gray-100   text-gray-600   border-gray-300'   },
  COMPLETED: { label: 'Completed',  className: 'bg-blue-100   text-blue-800   border-blue-300'   },
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export default function AdminSuspendRequestsPage() {
  const [filter, setFilter] = useState('PENDING');
  const [rows, setRows] = useState<SuspendRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SuspendRequest | null>(null);
  const [action, setAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/suspend-requests?status=${filter}&limit=200`);
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch {
      showError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAction = (row: SuspendRequest, act: 'APPROVE' | 'REJECT') => {
    setSelected(row);
    setAction(act);
    setAdminNotes('');
  };

  const handleProcess = async () => {
    if (!selected || !action) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/suspend-requests/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Gagal memproses'); return; }

      showSuccess(
        action === 'APPROVE'
          ? `Permintaan suspend ${selected.user.name} disetujui`
          : `Permintaan suspend ${selected.user.name} ditolak`
      );
      setSelected(null);
      setAction(null);
      await fetchData();
    } catch {
      showError('Terjadi kesalahan jaringan');
    } finally {
      setProcessing(false);
    }
  };

  const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'all'];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PauseCircle className="w-7 h-7 text-[#bc13fe]" />
          <div>
            <h1 className="text-2xl font-bold">Suspend Requests</h1>
            <p className="text-sm text-gray-500">Kelola permintaan suspend sementara dari pelanggan</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filter === s
                ? 'bg-[#bc13fe] text-white border-[#bc13fe]'
                : 'border-gray-300 text-gray-600 hover:border-[#bc13fe]/60'
            }`}
          >
            {s === 'all' ? 'Semua' : STATUS_CONFIG[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#bc13fe]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <AlertCircle className="w-10 h-10 mb-2" />
            <p>Tidak ada permintaan suspend</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Periode Suspend</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Diajukan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const sc = STATUS_CONFIG[row.status];
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.user.name}</p>
                        <p className="text-xs text-muted-foreground">{row.user.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.user.username}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{fmt(row.startDate)}</p>
                        <p className="text-gray-400">→ {fmt(row.endDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          ({Math.ceil((new Date(row.endDate).getTime() - new Date(row.startDate).getTime()) / 86400000)} hari)
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <p className="text-sm text-gray-600 truncate">{row.reason || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${sc?.className || ''} text-xs`}>
                        {sc?.label || row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{fmt(row.requestedAt)}</TableCell>
                    <TableCell className="text-right">
                      {row.status === 'PENDING' && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => openAction(row, 'APPROVE')}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => openAction(row, 'REJECT')}
                          >
                            <XCircle className="w-3 h-3 mr-1" />Tolak
                          </Button>
                        </div>
                      )}
                      {row.status !== 'PENDING' && row.adminNotes && (
                        <p className="text-xs text-muted-foreground italic max-w-[120px] truncate">{row.adminNotes}</p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="px-4 py-2 border-t text-sm text-gray-400">
          Total: {total} permintaan
        </div>
      </div>

      {/* Approve/Reject Dialog */}
      <Dialog open={!!selected && !!action} onOpenChange={() => { setSelected(null); setAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {action === 'APPROVE'
                ? <><CheckCircle2 className="w-5 h-5 text-green-600" /> Setujui Suspend</>
                : <><XCircle className="w-5 h-5 text-red-600" /> Tolak Suspend</>}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p><strong>Pelanggan:</strong> {selected.user.name} ({selected.user.username})</p>
                <p><strong>Periode:</strong> {fmt(selected.startDate)} – {fmt(selected.endDate)}</p>
                {selected.reason && <p><strong>Alasan:</strong> {selected.reason}</p>}
              </div>

              {action === 'APPROVE' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Menyetujui akan mengubah status pelanggan menjadi <strong>stopped</strong> pada tanggal mulai.
                    Layanan otomatis aktif kembali pada tanggal selesai.
                  </span>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Catatan Admin {action === 'REJECT' ? '(wajib jelaskan alasan)' : '(opsional)'}
                </label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder={action === 'APPROVE' ? 'Contoh: Disetujui, selamat menikmati masa libur.' : 'Contoh: Tidak dapat diproses karena ada tagihan belum lunas.'}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#bc13fe]/40 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); }}>Batal</Button>
            <Button
              onClick={handleProcess}
              disabled={processing || (action === 'REJECT' && !adminNotes.trim())}
              className={action === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {action === 'APPROVE' ? 'Setujui' : 'Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
