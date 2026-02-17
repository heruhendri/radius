'use client';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Users, CheckCircle2, MapPin, Map, MoreVertical,
  Shield, ShieldOff, Ban, Download, Upload, Search, Filter, X, Eye, EyeOff, RefreshCcw, DollarSign, Loader2, Zap,
  UserPlus, RefreshCw, Clock, Bell, Send, Mail, ArrowUpDown, Wallet,
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import UserDetailModal from '@/components/UserDetailModal';
import { formatWIB, isExpiredWIB as isExpired, endOfDayWIBtoUTC } from '@/lib/timezone';
import {
  SimpleModal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalInput,
  ModalSelect,
  ModalTextarea,
  ModalLabel,
  ModalButton,
} from '@/components/cyberpunk';

interface PppoeUser {
  id: string; username: string; name: string; phone: string; email: string | null;
  address: string | null; latitude: number | null; longitude: number | null;
  status: string; ipAddress: string | null; expiredAt: string | null;
  customerId: string | null;
  syncedToRadius: boolean; createdAt: string; updatedAt: string;
  subscriptionType?: 'PREPAID' | 'POSTPAID';
  billingDay?: number | null;
  profile: { id: string; name: string; groupName: string };
  router?: { id: string; name: string; nasname: string; ipAddress: string } | null;
  routerId?: string | null;
  areaId?: string | null;
  area?: { id: string; name: string } | null;
}

interface Profile { id: string; name: string; groupName: string; price: number; }
interface Router { id: string; name: string; nasname: string; ipAddress: string; }
interface Area { id: string; name: string; }

export default function PppoeUsersPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PppoeUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PppoeUser | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [modalLatLng, setModalLatLng] = useState<{ lat: string; lng: string } | undefined>();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [filterRouter, setFilterRouter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProfileId, setImportProfileId] = useState('');
  const [importRouterId, setImportRouterId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Sync from MikroTik states
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncRouterId, setSyncRouterId] = useState('');
  const [syncProfileId, setSyncProfileId] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncPreview, setSyncPreview] = useState<any>(null);
  const [syncSelectedUsers, setSyncSelectedUsers] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [invoiceCounts, setInvoiceCounts] = useState<Record<string, number>>({});
  const [extending, setExtending] = useState<string | null>(null);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedUserForExtend, setSelectedUserForExtend] = useState<PppoeUser | null>(null);
  const [selectedProfileForExtend, setSelectedProfileForExtend] = useState('');

  // Broadcast notification states
  const [isBroadcastDialogOpen, setIsBroadcastDialogOpen] = useState(false);
  const [notificationType, setNotificationType] = useState<'outage' | 'invoice' | 'payment'>('outage');
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [broadcastData, setBroadcastData] = useState({
    issueType: 'Gangguan Jaringan',
    description: '',
    estimatedTime: '',
    affectedArea: '',
    status: 'in_progress',
    notificationMethod: 'both',
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const [formData, setFormData] = useState({
    username: '', password: '', profileId: '', routerId: '', areaId: '', name: '', phone: '',
    email: '', address: '', latitude: '', longitude: '', ipAddress: '', expiredAt: '',
    subscriptionType: 'POSTPAID' as 'POSTPAID' | 'PREPAID',
    billingDay: '1',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersRes, profilesRes, routersRes, areasRes] = await Promise.all([
        fetch('/api/pppoe/users'), fetch('/api/pppoe/profiles'), fetch('/api/network/routers'), fetch('/api/pppoe/areas'),
      ]);
      const [usersData, profilesData, routersData, areasData] = await Promise.all([usersRes.json(), profilesRes.json(), routersRes.json(), areasRes.json()]);
      const loadedUsers = usersData.users || [];
      setUsers(loadedUsers);
      setProfiles(profilesData.profiles || []);
      setRouters(routersData.routers || []);
      setAreas(areasData.areas || []);

      // Load invoice counts for all users
      if (loadedUsers.length > 0) {
        const userIds = loadedUsers.map((u: PppoeUser) => u.id).join(',');
        const invoiceRes = await fetch(`/api/invoices/counts?userIds=${userIds}`);
        const invoiceData = await invoiceRes.json();
        if (invoiceData.success) {
          setInvoiceCounts(invoiceData.counts || {});
        }
      }
    } catch (error) { console.error('Load data error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const payload = {
        ...formData, ...(editingUser && { id: editingUser.id }),
        ...(formData.expiredAt && { expiredAt: endOfDayWIBtoUTC(new Date(formData.expiredAt + 'T23:59:59')).toISOString() }),
      };
      const res = await fetch('/api/pppoe/users', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (res.ok) {
        setIsDialogOpen(false); setEditingUser(null); resetForm(); loadData();
        await showSuccess(editingUser ? t('management.userUpdated') : t('management.userCreated'));
      } else { await showError(result.error || t('common.failed')); }
    } catch (error) { console.error('Submit error:', error); await showError(t('management.failedSaveUser')); }
  };

  const handleSaveUser = async (data: any) => {
    try {
      const res = await fetch('/api/pppoe/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (res.ok) { loadData(); await showSuccess(t('management.userUpdated')); }
      else { await showError(result.error || t('common.failed')); throw new Error(result.error); }
    } catch (error) { console.error('Save user error:', error); await showError(t('management.failedSaveUser')); throw error; }
  };

  const handleEdit = (user: PppoeUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username, password: '', profileId: user.profile.id, routerId: user.routerId || '',
      areaId: user.areaId || '',
      name: user.name, phone: user.phone, email: user.email || '', address: user.address || '',
      latitude: user.latitude?.toString() || '', longitude: user.longitude?.toString() || '',
      ipAddress: user.ipAddress || '', expiredAt: user.expiredAt ? formatWIB(user.expiredAt, 'yyyy-MM-dd') : '',
      subscriptionType: (user as any).subscriptionType || 'POSTPAID',
      billingDay: ((user as any).billingDay || 1).toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      const res = await fetch(`/api/pppoe/users?id=${deleteUserId}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) { 
        await showSuccess(t('management.userDeleted')); 
        loadData(); 
      } else { 
        await showError(result.error || t('common.failed')); 
      }
    } catch (error) { 
      console.error('Delete error:', error); 
      await showError(t('common.failed')); 
    } finally { 
      setDeleteUserId(null); 
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/pppoe/users/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, status: newStatus }) });
      const result = await res.json();
      if (res.ok) { await showSuccess(`Status: ${newStatus}`); loadData(); setActionMenuOpen(null); }
      else { await showError(result.error || t('common.failed')); }
    } catch (error) { console.error('Status error:', error); await showError(t('common.failed')); }
  };

  const handleMarkAllPaid = async (userId: string, userName: string) => {
    const confirmed = await showConfirm(
      t('pppoe.markAllInvoicesPaid').replace('{name}', userName),
      t('pppoe.confirmPayment')
    );
    if (!confirmed) return;

    setMarkingPaid(userId);
    try {
      const res = await fetch(`/api/pppoe/users/${userId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();

      if (res.ok) {
        await showSuccess(
          t('pppoe.invoicesMarkedPaid').replace('{count}', result.invoicesCount).replace('{amount}', result.totalAmount.toLocaleString('id-ID')),
          t('common.success')
        );
        loadData();
      } else {
        await showError(result.error || t('pppoe.failedMarkPaid'));
      }
    } catch (error) {
      console.error('Mark paid error:', error);
      await showError(t('pppoe.failedMarkPaid'));
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleManualExtend = (user: PppoeUser) => {
    setSelectedUserForExtend(user);
    setSelectedProfileForExtend(user.profile.id);
    setIsExtendModalOpen(true);
  };

  const handleConfirmExtend = async () => {
    if (!selectedUserForExtend || !selectedProfileForExtend) return;

    setExtending(selectedUserForExtend.id);
    try {
      const res = await fetch(`/api/pppoe/users/${selectedUserForExtend.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfileForExtend }),
      });
      const result = await res.json();

      if (res.ok) {
        const profileChanged = result.profileChanged ? t('pppoe.profileChanged') : '';
        await showSuccess(
          `${t('pppoe.validityExtended').replace('{period}', result.extended)}${profileChanged}\n${t('pppoe.paymentRecorded').replace('{amount}', result.amount.toLocaleString('id-ID'))}`,
          t('common.success')
        );
        setIsExtendModalOpen(false);
        loadData();
      } else {
        await showError(result.error || t('pppoe.failedExtendValidity'));
      }
    } catch (error) {
      console.error('Extend error:', error);
      await showError(t('pppoe.failedExtendValidity'));
    } finally {
      setExtending(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedUsers.size === 0) return;
    const confirmed = await showConfirm(t('pppoe.updateConfirmUsers').replace('{count}', String(selectedUsers.size)).replace('{status}', newStatus));
    if (!confirmed) return;
    try {
      const res = await fetch('/api/pppoe/users/bulk-status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: Array.from(selectedUsers), status: newStatus }) });
      const result = await res.json();
      if (res.ok) { await showSuccess(t('pppoe.usersUpdated').replace('{count}', String(selectedUsers.size))); setSelectedUsers(new Set()); loadData(); }
      else { await showError(result.error || t('common.failed')); }
    } catch (error) { console.error('Bulk error:', error); await showError(t('common.failed')); }
  };

  const toggleSelectUser = (userId: string) => { const n = new Set(selectedUsers); n.has(userId) ? n.delete(userId) : n.add(userId); setSelectedUsers(n); };
  const toggleSelectAll = () => { selectedUsers.size === filteredUsers.length && filteredUsers.length > 0 ? setSelectedUsers(new Set()) : setSelectedUsers(new Set(filteredUsers.map(u => u.id))); };
  const resetForm = () => { setFormData({ username: '', password: '', profileId: '', routerId: '', areaId: '', name: '', phone: '', email: '', address: '', latitude: '', longitude: '', ipAddress: '', expiredAt: '', subscriptionType: 'POSTPAID', billingDay: '1' }); };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    const confirmed = await showConfirm(t('pppoe.deleteConfirmUsers').replace('{count}', String(selectedUsers.size)));
    if (!confirmed) return;
    try {
      await Promise.all(Array.from(selectedUsers).map(id => fetch(`/api/pppoe/users?id=${id}`, { method: 'DELETE' })));
      await showSuccess(t('pppoe.usersDeleted').replace('{count}', String(selectedUsers.size))); setSelectedUsers(new Set()); loadData();
    } catch (error) { console.error('Bulk delete error:', error); await showError(t('common.failed')); }
  };

  const handleOpenNotificationMenu = (type: 'outage' | 'invoice' | 'payment') => {
    if (selectedUsers.size === 0) {
      showError(t('pppoe.selectUserFirst'));
      return;
    }
    setNotificationType(type);
    setShowNotificationMenu(false);
    setIsBroadcastDialogOpen(true);
  };

  const handleSendBroadcast = async () => {
    // Validation based on notification type and status
    if (notificationType === 'outage') {
      if (broadcastData.status === 'resolved') {
        // For resolved status, only description is required
        if (!broadcastData.description) {
          await showError(t('pppoe.fillOutageInfo'));
          return;
        }
      } else {
        // For in_progress status, all fields are required
        if (!broadcastData.issueType || !broadcastData.description || !broadcastData.estimatedTime || !broadcastData.affectedArea) {
          await showError(t('pppoe.fillAllOutageFields'));
          return;
        }
      }
    }

    const selectedUsersList = users.filter(u => selectedUsers.has(u.id));

    // Confirmation message based on type
    const methodText = broadcastData.notificationMethod === 'both' ? 'WhatsApp & Email' : broadcastData.notificationMethod === 'whatsapp' ? 'WhatsApp' : 'Email';
    let confirmMessage = '';
    if (notificationType === 'outage') {
      confirmMessage = t('pppoe.sendOutageConfirm').replace('{count}', String(selectedUsersList.length)).replace('{method}', methodText);
    } else if (notificationType === 'invoice') {
      confirmMessage = t('pppoe.sendInvoiceConfirm').replace('{count}', String(selectedUsersList.length)).replace('{method}', methodText);
    } else if (notificationType === 'payment') {
      confirmMessage = t('pppoe.sendPaymentProofConfirm').replace('{count}', String(selectedUsersList.length)).replace('{method}', methodText);
    }

    const confirmed = await showConfirm(confirmMessage);
    if (!confirmed) return;

    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/pppoe/users/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          notificationType: notificationType,
          issueType: broadcastData.issueType,
          description: broadcastData.description,
          estimatedTime: broadcastData.estimatedTime,
          affectedArea: broadcastData.affectedArea,
          status: broadcastData.status,
          notificationMethod: broadcastData.notificationMethod,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await showSuccess(data.message || t('common.success'));
        setIsBroadcastDialogOpen(false);
        setBroadcastData({
          issueType: 'Gangguan Jaringan',
          description: '',
          estimatedTime: '',
          affectedArea: '',
          status: 'in_progress',
          notificationMethod: 'both',
        });
        setSelectedUsers(new Set());
      } else {
        await showError(data.error || t('pppoe.failedSend'));
      }
    } catch (error) {
      await showError(t('pppoe.failedSend'));
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedUsers.size === 0) return;
    try {
      const selectedUsersData = users.filter(u => selectedUsers.has(u.id));
      const usersWithPasswords = await Promise.all(selectedUsersData.map(async (u) => {
        try { const res = await fetch(`/api/pppoe/users/${u.id}`); const data = await res.json(); return { ...u, password: data.user?.password || '' }; }
        catch { return { ...u, password: '' }; }
      }));
      const csvContent = [['Username', 'Password', 'Name', 'Phone', 'Email', 'Address', 'IP', 'Profile', 'Router', 'Status', 'Expired'].join(','),
      ...usersWithPasswords.map(u => [u.username, u.password, u.name, u.phone, u.email || '', u.address || '', u.ipAddress || '', u.profile.name, u.router?.name || 'Global', u.status, u.expiredAt ? formatWIB(u.expiredAt) : ''].join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' }); const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `pppoe-users-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await showError(t('pppoe.exportFailed')); }
  };

  const handleDownloadTemplate = async (format: 'csv' | 'xlsx' = 'xlsx') => {
    try {
      const res = await fetch(`/api/pppoe/users/bulk?type=template&format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'xlsx' ? 'pppoe-template.xlsx' : 'pppoe-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Template error:', error);
      await showError(t('pppoe.downloadTemplateFailed'));
    }
  };
  const handleExportData = async () => { try { const res = await fetch('/api/pppoe/users/bulk?type=export'); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `pppoe-export-${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url); } catch (error) { console.error('Export error:', error); await showError(t('pppoe.exportFailed')); } };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      if (filterProfile) params.set('profileId', filterProfile);
      if (filterRouter) params.set('routerId', filterRouter);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/pppoe/users/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `PPPoE-Users-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await showError(t('pppoe.exportFailed')); }
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'pdf');
      if (filterProfile) params.set('profileId', filterProfile);
      if (filterRouter) params.set('routerId', filterRouter);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/pppoe/users/export?${params}`);
      const data = await res.json();
      if (data.pdfData) {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14); doc.text(data.pdfData.title, 14, 15);
        if (data.pdfData.subtitle) { doc.setFontSize(10); doc.text(data.pdfData.subtitle, 14, 21); }
        doc.setFontSize(8); doc.text(`Generated: ${data.pdfData.generatedAt}`, 14, 27);
        autoTable(doc, { head: [data.pdfData.headers], body: data.pdfData.rows, startY: 32, styles: { fontSize: 7 }, headStyles: { fillColor: [13, 148, 136] } });
        if (data.pdfData.summary) {
          const finalY = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          data.pdfData.summary.forEach((s: any, i: number) => { doc.text(`${s.label}: ${s.value}`, 14, finalY + (i * 5)); });
        }
        doc.save(`PPPoE-Users-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) { console.error('PDF error:', error); await showError(t('pppoe.pdfExportFailed')); }
  };

  // Sync from MikroTik functions
  const handleSyncPreview = async () => {
    if (!syncRouterId) { await showError(t('pppoe.selectRouterFirst')); return; }
    setSyncLoading(true); setSyncPreview(null); setSyncSelectedUsers(new Set()); setSyncResult(null);
    try {
      const res = await fetch(`/api/pppoe/users/sync-mikrotik?routerId=${syncRouterId}`);
      const data = await res.json();
      if (data.success) {
        setSyncPreview(data);
        // Auto-select all new users
        const newUsers = data.data.secrets.filter((s: any) => s.isNew && !s.disabled);
        setSyncSelectedUsers(new Set(newUsers.map((s: any) => s.username)));
      } else {
        await showError(data.error || t('pppoe.failedFetchMikrotik'));
      }
    } catch (error) { console.error('Sync preview error:', error); await showError(t('pppoe.failedConnectMikrotik')); }
    finally { setSyncLoading(false); }
  };

  const handleSyncImport = async () => {
    if (!syncRouterId || !syncProfileId || syncSelectedUsers.size === 0) {
      await showError(t('pppoe.selectRouterProfileUser'));
      return;
    }
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/pppoe/users/sync-mikrotik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: syncRouterId,
          profileId: syncProfileId,
          selectedUsernames: Array.from(syncSelectedUsers),
          syncToRadius: true,
          defaultPhone: '08',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data);
        loadData();
        if (data.stats.failed === 0) {
          await showSuccess(t('common.success'));
        }
      } else {
        await showError(data.error || t('pppoe.failedImportUsers'));
      }
    } catch (error) { console.error('Sync import error:', error); await showError(t('pppoe.failedImportUsers')); }
    finally { setSyncing(false); }
  };

  const toggleSyncSelectUser = (username: string) => {
    const newSelected = new Set(syncSelectedUsers);
    if (newSelected.has(username)) { newSelected.delete(username); }
    else { newSelected.add(username); }
    setSyncSelectedUsers(newSelected);
  };

  const toggleSyncSelectAll = (selectNew: boolean) => {
    if (!syncPreview?.data?.secrets) return;
    if (selectNew) {
      const newUsers = syncPreview.data.secrets.filter((s: any) => s.isNew && !s.disabled);
      setSyncSelectedUsers(new Set(newUsers.map((s: any) => s.username)));
    } else {
      setSyncSelectedUsers(new Set());
    }
  };

  const handleImport = async () => {
    if (!importFile || !importProfileId) { await showError(t('pppoe.selectFileAndProfile')); return; }
    setImporting(true); setImportResult(null);
    try {
      const formData = new FormData(); formData.append('file', importFile); formData.append('pppoeProfileId', importProfileId);
      if (importRouterId) formData.append('routerId', importRouterId);
      const res = await fetch('/api/pppoe/users/bulk', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) { setImportResult(data.results); loadData(); if (data.results.failed === 0) setTimeout(() => { setIsImportDialogOpen(false); setImportFile(null); setImportProfileId(''); setImportRouterId(''); setImportResult(null); }, 3000); }
      else { await showError(t('pppoe.importFailed') + ': ' + data.error); }
    } catch (error) { console.error('Import error:', error); await showError(t('pppoe.importFailed')); }
    finally { setImporting(false); }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = searchQuery === '' || user.username.toLowerCase().includes(searchQuery.toLowerCase()) || user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.phone.includes(searchQuery);
    const matchesProfile = filterProfile === '' || user.profile.id === filterProfile;
    const matchesRouter = filterRouter === '' || (filterRouter === 'global' ? !user.routerId : user.routerId === filterRouter);
    const matchesStatus = filterStatus === '' || user.status === filterStatus;
    return matchesSearch && matchesProfile && matchesRouter && matchesStatus;
  }).sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortBy) {
      case 'username':
        aVal = a.username.toLowerCase();
        bVal = b.username.toLowerCase();
        break;
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'customerId':
        aVal = a.customerId || '';
        bVal = b.customerId || '';
        break;
      case 'phone':
        aVal = a.phone;
        bVal = b.phone;
        break;
      case 'profile':
        aVal = a.profile.name.toLowerCase();
        bVal = b.profile.name.toLowerCase();
        break;
      case 'balance':
        aVal = (a as any).balance || 0;
        bVal = (b as any).balance || 0;
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        aVal = new Date(a.updatedAt).getTime();
        bVal = new Date(b.updatedAt).getTime();
        break;
      case 'expiredAt':
        aVal = a.expiredAt ? new Date(a.expiredAt).getTime() : 0;
        bVal = b.expiredAt ? new Date(b.expiredAt).getTime() : 0;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const registrationsThisMonth = users.filter((u) => new Date(u.createdAt) >= startOfMonth).length;
  const renewalsThisMonth = users.filter((u) => {
    const updated = new Date(u.updatedAt);
    const created = new Date(u.createdAt);
    return updated >= startOfMonth && updated.getTime() !== created.getTime();
  }).length;
  const isolatedExpired = users.filter((u) => u.status === 'isolated' || (u.expiredAt && isExpired(u.expiredAt))).length;
  const blockedUsers = users.filter((u) => u.status === 'blocked').length;

  const canView = hasPermission('customers.view');
  const canCreate = hasPermission('customers.create');

  if (!permLoading && !canView) {
    return (<div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Shield className="w-12 h-12 text-muted-foreground mb-3" /><h2 className="text-lg font-bold text-foreground mb-1">{t('pppoe.accessDenied')}</h2>
      <p className="text-xs text-muted-foreground">{t('pppoe.noPermission')}</p></div>);
  }

  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-[#1a0f35] relative overflow-hidden"><div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div><div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div></div><Loader2 className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" /></div>; }

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">{t('pppoe.title')}</h1>
              <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('pppoe.subtitle')}</p>
            </div>
            {/* Tombol Kirim Notifikasi di Header */}
            {selectedUsers.size > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowNotificationMenu(!showNotificationMenu)}
                  className="inline-flex items-center px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 gap-1.5"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {t('pppoe.sendNotification')}
                  <span className="bg-primary/100 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                    {selectedUsers.size}
                  </span>
                </button>
                {showNotificationMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded shadow-lg z-50 min-w-[180px]">
                    <button
                      onClick={() => handleOpenNotificationMenu('outage')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2"
                    >
                      <Bell className="h-3.5 w-3.5 text-destructive" />
                      <span>{t('pppoe.outageNotification')}</span>
                    </button>
                    <button
                      onClick={() => handleOpenNotificationMenu('invoice')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2 border-t border-border"
                    >
                      <DollarSign className="h-3.5 w-3.5 text-warning" />
                      <span>{t('pppoe.sendInvoice')}</span>
                    </button>
                    <button
                      onClick={() => handleOpenNotificationMenu('payment')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2 border-t border-border"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span>{t('pppoe.paymentReceipt')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => { setIsSyncDialogOpen(true); setSyncPreview(null); setSyncResult(null); setSyncRouterId(''); setSyncProfileId(''); }} className="inline-flex items-center px-2 py-1.5 text-xs border border-primary text-primary rounded hover:bg-primary/10"><RefreshCcw className="h-3 w-3 mr-1" />{t('pppoe.syncMikrotik')}</button>
            <button onClick={() => handleDownloadTemplate('xlsx')} className="inline-flex items-center px-2 py-1.5 text-xs border border-border rounded hover:bg-muted"><Download className="h-3 w-3 mr-1" />{t('pppoe.templateExcel')}</button>
            <button onClick={handleExportExcel} className="inline-flex items-center px-2 py-1.5 text-xs border border-success text-success rounded hover:bg-success/10"><Download className="h-3 w-3 mr-1" />Excel</button>
            <button onClick={handleExportPDF} className="inline-flex items-center px-2 py-1.5 text-xs border border-destructive text-destructive rounded hover:bg-destructive/10"><Download className="h-3 w-3 mr-1" />PDF</button>
            <button onClick={() => setIsImportDialogOpen(true)} className="inline-flex items-center px-2 py-1.5 text-xs border border-border rounded hover:bg-muted"><Upload className="h-3 w-3 mr-1" />{t('common.import')}</button>
            {canCreate && (<button onClick={() => { resetForm(); setEditingUser(null); setIsDialogOpen(true); }} className="inline-flex items-center px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded"><Plus className="h-3 w-3 mr-1" />{t('pppoe.addUser')}</button>)}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('pppoe.registrationsThisMonth')}</p><p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{registrationsThisMonth}</p></div>
              <UserPlus className="h-8 w-8 text-[#00f7ff] drop-shadow-[0_0_15px_rgba(0,247,255,0.6)]" />
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('pppoe.renewalsThisMonth')}</p><p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{renewalsThisMonth}</p></div>
              <RefreshCw className="h-8 w-8 text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.6)]" />
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('pppoe.isolatedExpired')}</p><p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{isolatedExpired}</p></div>
              <Clock className="h-8 w-8 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" />
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('pppoe.blockedUsers')}</p><p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{blockedUsers}</p></div>
              <Ban className="h-8 w-8 text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder={t('common.search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-7 pr-7 py-1.5 text-xs border border-border rounded bg-muted" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"><X className="h-3 w-3" /></button>}
            </div>
            <select value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)} className="px-2 py-1.5 text-xs border border-border rounded bg-muted">
              <option value="">{t('pppoe.allProfiles')}</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterRouter} onChange={(e) => setFilterRouter(e.target.value)} className="px-2 py-1.5 text-xs border border-border rounded bg-muted">
              <option value="">{t('pppoe.allNas')}</option><option value="global">{t('pppoe.global')}</option>
              {routers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Filter className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">{t('common.status')}:</span>
            {['', 'active', 'isolated', 'blocked'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-2 py-0.5 text-[10px] rounded-full transition ${filterStatus === s ? (s === '' ? 'bg-teal-600 text-white' : s === 'active' ? 'bg-success text-white' : s === 'isolated' ? 'bg-warning text-white' : 'bg-destructive text-destructive-foreground') : 'bg-gray-100 bg-muted text-muted-foreground'}`}>
                {s === '' ? t('common.all') : s === 'active' ? t('pppoe.active') : s === 'isolated' ? t('pppoe.isolir') : t('pppoe.block')}
              </button>
            ))}
            {(searchQuery || filterProfile || filterRouter || filterStatus) && <button onClick={() => { setSearchQuery(''); setFilterProfile(''); setFilterRouter(''); setFilterStatus(''); }} className="ml-auto text-[10px] text-primary hover:text-teal-700">{t('common.reset')}</button>}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">{t('table.showing')} {filteredUsers.length} {t('table.of')} {users.length}</div>
        </div>

        {/* Users Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium">{t('pppoe.usersList')}</span>
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{selectedUsers.size} {t('pppoe.selected')}</span>
                <button onClick={() => handleBulkStatusChange('active')} className="px-1.5 py-0.5 text-[10px] bg-success text-white rounded flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" />{t('pppoe.active')}</button>
                <button onClick={() => handleBulkStatusChange('isolated')} className="px-1.5 py-0.5 text-[10px] bg-warning text-white rounded flex items-center gap-0.5"><ShieldOff className="h-2.5 w-2.5" />{t('pppoe.isolir')}</button>
                <button onClick={() => handleBulkStatusChange('blocked')} className="px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground rounded flex items-center gap-0.5"><Ban className="h-2.5 w-2.5" />{t('pppoe.block')}</button>
                <button onClick={handleExportSelected} className="px-1.5 py-0.5 text-[10px] bg-teal-600 text-white rounded flex items-center gap-0.5"><Download className="h-2.5 w-2.5" />{t('common.export')}</button>
                <button onClick={handleBulkDelete} className="px-1.5 py-0.5 text-[10px] bg-gray-600 text-white rounded flex items-center gap-0.5"><Trash2 className="h-2.5 w-2.5" />{t('common.delete')}</button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-center w-8"><input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 w-3 h-3" /></th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase cursor-pointer hover:bg-muted" onClick={() => handleSort('username')}>
                    <div className="flex items-center gap-1">{t('pppoe.username')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase cursor-pointer hover:bg-muted" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">{t('common.name')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden md:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('customerId')}>
                    <div className="flex items-center gap-1">{t('pppoe.customerId')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden md:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('phone')}>
                    <div className="flex items-center gap-1">{t('common.phone')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden lg:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('profile')}>
                    <div className="flex items-center gap-1">{t('pppoe.profile')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden lg:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('area')}>
                    <div className="flex items-center gap-1">{t('common.area')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden lg:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('balance')}>
                    <div className="flex items-center gap-1">{t('pppoe.balance')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden xl:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">{t('pppoe.registeredDate')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden xl:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('updatedAt')}>
                    <div className="flex items-center gap-1">{t('pppoe.renewedDate')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase hidden sm:table-cell cursor-pointer hover:bg-muted" onClick={() => handleSort('expiredAt')}>
                    <div className="flex items-center gap-1">{t('pppoe.expired')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase cursor-pointer hover:bg-muted" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">{t('pppoe.status')} <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground text-xs">{users.length === 0 ? t('pppoe.noUsers') : t('pppoe.noMatch')}</td></tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/50">
                      <td className="px-2 py-2 text-center"><input type="checkbox" checked={selectedUsers.has(user.id)} onChange={() => toggleSelectUser(user.id)} className="rounded border-gray-300 w-3 h-3" /></td>
                      <td className="px-3 py-2"><p className="font-medium text-xs">{user.username}</p>{user.ipAddress && <p className="text-[10px] text-muted-foreground">IP: {user.ipAddress}</p>}</td>
                      <td className="px-3 py-2"><p className="text-xs">{user.name}</p>{user.email && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{user.email}</p>}</td>
                      <td className="px-3 py-2 text-xs hidden md:table-cell font-mono font-medium">{user.customerId || '-'}</td>
                      <td className="px-3 py-2 text-xs hidden md:table-cell">{user.phone}</td>
                      <td className="px-3 py-2 hidden lg:table-cell"><span className="text-xs font-medium">{user.profile.name}</span><br /><span className="text-[10px] text-muted-foreground font-mono">{user.profile.groupName}</span></td>
                      <td className="px-3 py-2 text-xs hidden lg:table-cell">{user.area?.name || '-'}</td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-primary">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format((user as any).balance || 0)}
                          </span>
                          {(user as any).autoRenewal && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 w-fit">
                              <Zap className="h-2 w-2 mr-0.5" />Auto
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground hidden xl:table-cell">{formatWIB(user.createdAt, 'dd/MM/yyyy HH:mm')}</td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground hidden xl:table-cell">{formatWIB(user.updatedAt, 'dd/MM/yyyy HH:mm')}</td>
                      <td className="px-3 py-2 text-xs hidden sm:table-cell">{user.expiredAt ? <span className={isExpired(user.expiredAt) ? 'text-destructive font-medium' : ''}>{formatWIB(user.expiredAt, 'dd/MM/yyyy')}</span> : '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${user.status === 'active' ? 'bg-success/20 text-success dark:bg-green-900/30' : user.status === 'isolated' ? 'bg-warning/20 text-warning dark:bg-yellow-900/30' : 'bg-destructive/20 text-destructive dark:bg-red-900/30'}`}>{user.status}</span>
                          {user.syncedToRadius && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent/20 text-accent dark:bg-purple-900/30"><CheckCircle2 className="h-2 w-2 mr-0.5" />{t('pppoe.synced')}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-0.5">
                          <div className="relative">
                            <button onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)} className="p-1 text-muted-foreground hover:bg-muted rounded"><MoreVertical className="h-3 w-3" /></button>
                            {actionMenuOpen === user.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setActionMenuOpen(null)}></div>
                                <div className="fixed right-4 mt-1 w-32 bg-card rounded shadow-2xl border border-border z-50" style={{ top: 'auto' }}>
                                  <button onClick={() => handleStatusChange(user.id, 'active')} className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-muted flex items-center gap-1.5 rounded-t"><Shield className="h-3 w-3 text-success" />{t('pppoe.active')}</button>
                                  <button onClick={() => handleStatusChange(user.id, 'isolated')} className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-muted flex items-center gap-1.5"><ShieldOff className="h-3 w-3 text-warning" />{t('pppoe.isolir')}</button>
                                  <button onClick={() => handleStatusChange(user.id, 'blocked')} className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-muted flex items-center gap-1.5"><Ban className="h-3 w-3 text-destructive" />{t('pppoe.block')}</button>
                                  <button onClick={() => handleStatusChange(user.id, 'stop')} className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-muted flex items-center gap-1.5 rounded-b"><X className="h-3 w-3 text-muted-foreground" />{t('pppoe.stop')}</button>
                                </div>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => window.location.href = `/admin/pppoe/users/${user.id}/balance`}
                            className="p-1 text-primary hover:bg-primary/10 rounded"
                            title={t('pppoe.manageBalance')}
                          >
                            <Wallet className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleEdit(user)} className="p-1 text-muted-foreground hover:bg-muted rounded"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => setDeleteUserId(user.id)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-3 w-3" /></button>
                          {invoiceCounts[user.id] > 0 ? (
                            <button
                              onClick={() => handleMarkAllPaid(user.id, user.name)}
                              disabled={markingPaid === user.id}
                              className="px-1.5 py-0.5 text-[10px] font-medium bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                              title={t('pppoe.markAllInvoicesPaid').replace('{name}', user.name)}
                            >
                              {markingPaid === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t('pppoe.markPaid')}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleManualExtend(user)}
                              disabled={extending === user.id}
                              className="p-1 text-warning hover:bg-warning/10 dark:hover:bg-yellow-900/20 rounded disabled:opacity-50"
                              title={t('pppoe.extendManual')}
                            >
                              {extending === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add New User Dialog */}
        <SimpleModal isOpen={isDialogOpen && !editingUser} onClose={() => { setIsDialogOpen(false); setEditingUser(null); resetForm(); }} size="lg">
          <ModalHeader>
            <ModalTitle>{t('pppoe.addUser')}</ModalTitle>
            <ModalDescription>{t('pppoe.createPppoe')}</ModalDescription>
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><ModalLabel required>{t('pppoe.username')}</ModalLabel><ModalInput type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required /></div>
                <div><ModalLabel required>{t('pppoe.password')}</ModalLabel>
                  <div className="relative"><ModalInput type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editingUser} className="pr-8" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#e0d0ff]/50 hover:text-[#00f7ff]">{showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
                  </div>
                </div>
              </div>
              <div><ModalLabel required>{t('pppoe.profile')}</ModalLabel><ModalSelect value={formData.profileId} onChange={(e) => setFormData({ ...formData, profileId: e.target.value })} required><option value="" className="bg-[#0a0520]">{t('common.select')}</option>{profiles.map((p) => <option key={p.id} value={p.id} className="bg-[#0a0520]">{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>)}</ModalSelect></div>
              <div><ModalLabel>NAS ({t('common.optional')})</ModalLabel><ModalSelect value={formData.routerId} onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}><option value="" className="bg-[#0a0520]">{t('pppoe.global')}</option>{routers.map((r) => <option key={r.id} value={r.id} className="bg-[#0a0520]">{r.name} ({r.ipAddress})</option>)}</ModalSelect></div>
              <div className="grid grid-cols-2 gap-3">
                <div><ModalLabel required>{t('common.name')}</ModalLabel><ModalInput type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                <div><ModalLabel required>{t('common.phone')}</ModalLabel><ModalInput type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required /></div>
              </div>
              <div><ModalLabel required>{t('common.email')}</ModalLabel><ModalInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></div>
              <div><ModalLabel>{t('common.address')}</ModalLabel><ModalInput type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div>
                <div className="flex items-center justify-between mb-1"><ModalLabel>{t('pppoe.gpsLocation')}</ModalLabel>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setShowMapPicker(true)} className="inline-flex items-center px-2 py-0.5 text-[10px] bg-[#00f7ff]/20 text-[#00f7ff] border border-[#00f7ff]/50 rounded hover:bg-[#00f7ff]/30"><Map className="h-2.5 w-2.5 mr-1" />{t('pppoe.openMap')}</button>
                    <button type="button" onClick={async () => { if (navigator.geolocation) { navigator.geolocation.getCurrentPosition((p) => { setFormData({ ...formData, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }); }, async () => { await showError(t('pppoe.gpsFailed')); }, { enableHighAccuracy: true, timeout: 10000 }); } }} className="inline-flex items-center px-2 py-0.5 text-[10px] bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 rounded hover:bg-[#00ff88]/30"><MapPin className="h-2.5 w-2.5 mr-1" />{t('pppoe.autoGps')}</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ModalInput type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder={t('pppoe.latitude')} />
                  <ModalInput type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder={t('pppoe.longitude')} />
                </div>
              </div>
              <div>
                <ModalLabel required>{t('pppoe.subscriptionType')}</ModalLabel>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center p-2 border-2 rounded-lg cursor-pointer transition-all ${formData.subscriptionType === 'POSTPAID' ? 'border-[#00f7ff] bg-[#00f7ff]/10 shadow-[0_0_10px_rgba(0,247,255,0.3)]' : 'border-[#bc13fe]/30 hover:border-[#00f7ff]/50'}`}>
                    <input type="radio" name="subscriptionType" value="POSTPAID" checked={formData.subscriptionType === 'POSTPAID'} onChange={(e) => setFormData({ ...formData, subscriptionType: e.target.value as 'POSTPAID' })} className="w-3 h-3 text-[#00f7ff] border-[#bc13fe]/50 focus:ring-[#00f7ff]" />
                    <div className="ml-2 flex-1"><div className="text-[10px] font-medium text-[#e0d0ff]">📅 {t('pppoe.postpaid')}</div><div className="text-[9px] text-[#e0d0ff]/50">{t('pppoe.fixedDueDate')}</div></div>
                  </label>
                  <label className={`flex items-center p-2 border-2 rounded-lg cursor-pointer transition-all ${formData.subscriptionType === 'PREPAID' ? 'border-[#bc13fe] bg-[#bc13fe]/10 shadow-[0_0_10px_rgba(188,19,254,0.3)]' : 'border-[#bc13fe]/30 hover:border-[#bc13fe]/50'}`}>
                    <input type="radio" name="subscriptionType" value="PREPAID" checked={formData.subscriptionType === 'PREPAID'} onChange={(e) => setFormData({ ...formData, subscriptionType: e.target.value as 'PREPAID' })} className="w-3 h-3 text-[#bc13fe] border-[#bc13fe]/50 focus:ring-[#bc13fe]" />
                    <div className="ml-2 flex-1"><div className="text-[10px] font-medium text-[#e0d0ff]">⏰ {t('pppoe.prepaid')}</div><div className="text-[9px] text-[#e0d0ff]/50">{t('pppoe.followsPayment')}</div></div>
                  </label>
                </div>
              </div>
              {formData.subscriptionType === 'POSTPAID' && (
                <div><ModalLabel>📅 {t('pppoe.billingDate')}</ModalLabel><ModalSelect value={formData.billingDay} onChange={(e) => setFormData({ ...formData, billingDay: e.target.value })}>{Array.from({ length: 31 }, (_, i) => i + 1).map(day => (<option key={day} value={day} className="bg-[#0a0520]">{t('pppoe.dayOf')} {day}</option>))}</ModalSelect><p className="text-[10px] text-[#e0d0ff]/50 mt-1">Tanggal jatuh tempo bulanan. expiredAt auto-calculated.</p></div>
              )}
              {formData.subscriptionType === 'PREPAID' && (
                <div>
                  <ModalLabel>{t('pppoe.expiredAt')} (opsional)</ModalLabel>
                  <ModalInput type="date" value={formData.expiredAt} onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })} />
                  <p className="text-[10px] text-[#e0d0ff]/50 mt-1">Kosongkan untuk auto dari validity profile</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><ModalLabel>{t('pppoe.staticIp')}</ModalLabel><ModalInput type="text" value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} placeholder="10.10.10.2" /></div>
                <div><ModalLabel>{t('pppoe.expiryDate')}</ModalLabel><ModalInput type="date" value={formData.expiredAt} onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })} /></div>
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton type="button" variant="secondary" onClick={() => { setIsDialogOpen(false); setEditingUser(null); resetForm(); }}>{t('common.cancel')}</ModalButton>
              <ModalButton type="submit" variant="primary">{t('common.create')}</ModalButton>
            </ModalFooter>
          </form>
        </SimpleModal>

        {/* Map Picker */}
        <MapPicker isOpen={showMapPicker} onClose={() => setShowMapPicker(false)} onSelect={(lat, lng) => { setFormData({ ...formData, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }); if (editingUser) setModalLatLng({ lat: lat.toFixed(6), lng: lng.toFixed(6) }); }} initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined} initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined} />

        {/* Import Dialog */}
        <SimpleModal isOpen={isImportDialogOpen} onClose={() => { setIsImportDialogOpen(false); setImportFile(null); setImportProfileId(''); setImportRouterId(''); setImportResult(null); }} size="md">
          <ModalHeader>
            <ModalTitle>{t('pppoe.importCsv')}</ModalTitle>
            <ModalDescription>Upload CSV atau Excel file (.xlsx)</ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <ModalLabel required>{t('pppoe.selectFile')}</ModalLabel>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 text-xs bg-[#0a0520] border border-[#bc13fe]/40 rounded-lg text-[#e0d0ff] file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#bc13fe]/30 file:text-[#e0d0ff] hover:file:bg-[#bc13fe]/50 focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff]/30 transition-all" />
              <p className="text-[9px] text-[#e0d0ff]/50 mt-1">Format: CSV atau Excel (.xlsx, .xls)</p>
            </div>
            <div>
              <ModalLabel required>{t('pppoe.profile')}</ModalLabel>
              <ModalSelect value={importProfileId} onChange={(e) => setImportProfileId(e.target.value)}>
                <option value="" className="bg-[#0a0520]">{t('common.select')}</option>
                {profiles.map((p) => <option key={p.id} value={p.id} className="bg-[#0a0520]">{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>)}
              </ModalSelect>
            </div>
            <div>
              <ModalLabel>NAS</ModalLabel>
              <ModalSelect value={importRouterId} onChange={(e) => setImportRouterId(e.target.value)}>
                <option value="" className="bg-[#0a0520]">{t('pppoe.global')}</option>
                {routers.map((r) => <option key={r.id} value={r.id} className="bg-[#0a0520]">{r.name}</option>)}
              </ModalSelect>
            </div>
            {importResult && (
              <div className="p-3 border border-[#bc13fe]/30 rounded-lg bg-[#0a0520]/50 text-xs max-h-60 overflow-y-auto">
                <div className="flex items-center gap-1 text-[#00ff88] mb-2"><CheckCircle2 className="h-3 w-3" />{importResult.success} {t('common.create')}</div>
                {importResult.failed > 0 && (
                  <div className="text-[#ff4466]">
                    <div className="font-medium mb-1">{importResult.failed} {t('notifications.failed')}</div>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="space-y-1 mt-2 text-[10px]">
                        {importResult.errors.map((error: any, idx: number) => (
                          <div key={idx} className="p-1.5 bg-[#ff4466]/10 rounded border border-[#ff4466]/30">
                            <div className="font-medium text-[#e0d0ff]">Baris {error.line}: {error.username || 'N/A'}</div>
                            <div className="text-[#ff4466]">{error.error}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <ModalButton variant="secondary" onClick={() => { setIsImportDialogOpen(false); setImportFile(null); setImportProfileId(''); setImportRouterId(''); setImportResult(null); }}>{t('common.cancel')}</ModalButton>
            <ModalButton variant="primary" onClick={handleImport} disabled={!importFile || !importProfileId || importing}>{importing ? t('notifications.processing') : t('common.import')}</ModalButton>
          </ModalFooter>
        </SimpleModal>

        {/* Edit User Modal */}
        <UserDetailModal isOpen={isDialogOpen && !!editingUser} onClose={() => { setIsDialogOpen(false); setEditingUser(null); resetForm(); setModalLatLng(undefined); }} user={editingUser} onSave={handleSaveUser} profiles={profiles} routers={routers} areas={areas} currentLatLng={modalLatLng} onLatLngChange={(lat, lng) => { setFormData({ ...formData, latitude: lat, longitude: lng }); setShowMapPicker(true); }} />

        {/* Delete Dialog */}
        <SimpleModal isOpen={!!deleteUserId} onClose={() => setDeleteUserId(null)} size="sm">
          <ModalBody className="text-center py-6">
            <div className="w-14 h-14 bg-[#ff4466]/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#ff4466]/50">
              <Trash2 className="w-7 h-7 text-[#ff6b8a]" />
            </div>
            <h2 className="text-base font-bold text-white mb-2">{t('pppoe.deleteUser')}</h2>
            <p className="text-xs text-[#e0d0ff]/70">{t('pppoe.deleteConfirm')}</p>
          </ModalBody>
          <ModalFooter className="justify-center">
            <ModalButton variant="secondary" onClick={() => setDeleteUserId(null)}>{t('common.cancel')}</ModalButton>
            <ModalButton variant="danger" onClick={handleDelete}>{t('common.delete')}</ModalButton>
          </ModalFooter>
        </SimpleModal>

        {/* Sync from MikroTik Dialog */}
        <SimpleModal isOpen={isSyncDialogOpen} onClose={() => { setIsSyncDialogOpen(false); setSyncPreview(null); setSyncResult(null); }} size="xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 text-[#00f7ff]" />Sync PPPoE dari MikroTik</ModalTitle>
            <ModalDescription>Import PPPoE secrets dari MikroTik ke database RADIUS</ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <ModalLabel required>Pilih Router</ModalLabel>
                <ModalSelect value={syncRouterId} onChange={(e) => { setSyncRouterId(e.target.value); setSyncPreview(null); setSyncResult(null); }}>
                  <option value="" className="bg-[#0a0520]">-- Pilih Router --</option>
                  {routers.map((r) => <option key={r.id} value={r.id} className="bg-[#0a0520]">{r.name} ({r.ipAddress})</option>)}
                </ModalSelect>
              </div>
              <div>
                <ModalLabel required>{t('pppoe.targetProfile')}</ModalLabel>
                <ModalSelect value={syncProfileId} onChange={(e) => setSyncProfileId(e.target.value)}>
                  <option value="" className="bg-[#0a0520]">{t('pppoe.selectProfile')}</option>
                  {profiles.map((p) => <option key={p.id} value={p.id} className="bg-[#0a0520]">{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>)}
                </ModalSelect>
              </div>
            </div>
            <button onClick={handleSyncPreview} disabled={!syncRouterId || syncLoading} className="w-full px-3 py-2 text-xs bg-gradient-to-r from-[#00f7ff] to-[#bc13fe] hover:from-[#00f7ff]/80 hover:to-[#bc13fe]/80 text-white rounded-lg shadow-[0_0_15px_rgba(0,247,255,0.4)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 transition-all">
              {syncLoading ? (<><RefreshCcw className="h-3 w-3 animate-spin" />{t('pppoe.fetchingFromMikrotik')}</>) : (<><Search className="h-3 w-3" />{t('pppoe.previewSecrets')}</>)}
            </button>
            {syncPreview && (
              <div className="border border-[#bc13fe]/40 rounded-lg overflow-hidden bg-[#0a0520]/50">
                <div className="px-3 py-2 bg-[#bc13fe]/10 border-b border-[#bc13fe]/30 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-medium text-[#e0d0ff]">{syncPreview.router?.name}</span>
                    <span className="text-[#e0d0ff]/60 ml-2">Total: {syncPreview.data?.total} | Baru: <span className="text-[#00ff88] font-medium">{syncPreview.data?.new}</span> | Sudah ada: <span className="text-[#ff8c00]">{syncPreview.data?.existing}</span></span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleSyncSelectAll(true)} className="text-[10px] text-[#00f7ff] hover:underline">{t('pppoe.selectAllNew')}</button>
                    <button onClick={() => toggleSyncSelectAll(false)} className="text-[10px] text-[#e0d0ff]/50 hover:underline">{t('pppoe.deselectAll')}</button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#0a0520] sticky top-0">
                      <tr><th className="px-2 py-1.5 w-8"></th><th className="px-2 py-1.5 text-left text-[#e0d0ff]">Username</th><th className="px-2 py-1.5 text-left text-[#e0d0ff]">Profile (MikroTik)</th><th className="px-2 py-1.5 text-left text-[#e0d0ff]">IP</th><th className="px-2 py-1.5 text-left text-[#e0d0ff]">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#bc13fe]/20">
                      {syncPreview.data?.secrets?.map((secret: any) => (
                        <tr key={secret.username} className={`${secret.isNew ? 'bg-[#00ff88]/5' : 'bg-[#bc13fe]/5'} ${secret.disabled ? 'opacity-50' : ''}`}>
                          <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={syncSelectedUsers.has(secret.username)} onChange={() => toggleSyncSelectUser(secret.username)} disabled={!secret.isNew || secret.disabled} className="w-3 h-3 rounded accent-[#00f7ff]" /></td>
                          <td className="px-2 py-1.5 font-mono text-[#e0d0ff]">{secret.username}</td>
                          <td className="px-2 py-1.5 text-[#e0d0ff]/60">{secret.profile}</td>
                          <td className="px-2 py-1.5 text-[#e0d0ff]/60">{secret.remoteAddress || '-'}</td>
                          <td className="px-2 py-1.5">
                            {secret.disabled ? (<span className="px-1.5 py-0.5 bg-[#e0d0ff]/10 text-[#e0d0ff]/50 rounded text-[9px]">Disabled</span>) : secret.isNew ? (<span className="px-1.5 py-0.5 bg-[#00ff88]/20 text-[#00ff88] rounded text-[9px]">{t('pppoe.new')}</span>) : (<span className="px-1.5 py-0.5 bg-[#ff8c00]/20 text-[#ff8c00] rounded text-[9px]">{t('pppoe.existing')}</span>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {syncSelectedUsers.size > 0 && (<div className="px-3 py-2 bg-[#00f7ff]/10 border-t border-[#00f7ff]/30 text-xs text-[#00f7ff]">✓ {syncSelectedUsers.size} {t('pppoe.usersSelectedToImport')}</div>)}
              </div>
            )}
            {syncResult && (
              <div className={`p-3 rounded-lg border ${syncResult.stats?.failed > 0 ? 'bg-[#ff8c00]/10 border-[#ff8c00]/30' : 'bg-[#00ff88]/10 border-[#00ff88]/30'}`}>
                <div className="text-xs space-y-1">
                  <div className="font-medium text-[#e0d0ff]">{syncResult.message}</div>
                  <div className="flex gap-4 text-[10px]">
                    <span className="text-[#00ff88]">✓ Imported: {syncResult.stats?.imported}</span>
                    <span className="text-[#ff8c00]">⊘ Skipped: {syncResult.stats?.skipped}</span>
                    <span className="text-[#ff4466]">✗ Failed: {syncResult.stats?.failed}</span>
                  </div>
                  {syncResult.errors?.length > 0 && (<div className="mt-2 text-[10px] text-[#ff4466]">Errors: {syncResult.errors.map((e: any) => `${e.username}: ${e.error}`).join(', ')}</div>)}
                </div>
              </div>
            )}
            <div className="p-3 bg-[#00f7ff]/10 border border-[#00f7ff]/30 rounded-lg text-[10px] text-[#00f7ff]">
              <p className="font-medium mb-1">ℹ️ {t('pppoe.infoTitle')}</p>
              <ul className="list-disc list-inside space-y-0.5 text-[#00f7ff]/80">
                <li>{t('pppoe.syncInfo1')}</li>
                <li>{t('pppoe.syncInfo2')}</li>
                <li>{t('pppoe.syncInfo3')}</li>
                <li>{t('pppoe.syncInfo4')}</li>
                <li>{t('pppoe.syncInfo5')}</li>
              </ul>
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalButton variant="secondary" onClick={() => { setIsSyncDialogOpen(false); setSyncPreview(null); setSyncResult(null); }}>{t('common.cancel')}</ModalButton>
            <ModalButton variant="primary" onClick={handleSyncImport} disabled={!syncProfileId || syncSelectedUsers.size === 0 || syncing}>
              {syncing ? (<><RefreshCcw className="h-3 w-3 animate-spin mr-1" />{t('pppoe.importing')}</>) : (<><Download className="h-3 w-3 mr-1" />{t('pppoe.importUsers')} {syncSelectedUsers.size}</>)}
            </ModalButton>
          </ModalFooter>
        </SimpleModal>

        {/* Extend Subscription Modal */}
        <SimpleModal isOpen={isExtendModalOpen && !!selectedUserForExtend} onClose={() => { setIsExtendModalOpen(false); setSelectedUserForExtend(null); setSelectedProfileForExtend(''); }} size="md">
          <ModalHeader>
            <ModalTitle>{t('pppoe.extendSubscription')}</ModalTitle>
            <ModalDescription>{selectedUserForExtend?.name} ({selectedUserForExtend?.username})</ModalDescription>
          </ModalHeader>
          {selectedUserForExtend && (
            <ModalBody className="space-y-4">
              <div className="bg-[#0a0520]/50 rounded-lg p-3 space-y-2 text-xs border border-[#bc13fe]/30">
                <div className="flex justify-between"><span className="text-[#e0d0ff]/60">{t('pppoe.currentPackage')}:</span><span className="font-medium text-[#e0d0ff]">{selectedUserForExtend.profile.name}</span></div>
                <div className="flex justify-between"><span className="text-[#e0d0ff]/60">{t('pppoe.activeUntil')}:</span><span className={selectedUserForExtend.expiredAt && isExpired(selectedUserForExtend.expiredAt) ? 'text-[#ff4466] font-medium' : 'text-[#e0d0ff]'}>{selectedUserForExtend.expiredAt ? formatWIB(selectedUserForExtend.expiredAt, 'dd/MM/yyyy HH:mm') : '-'}</span></div>
              </div>
              <div>
                <ModalLabel required>{t('pppoe.selectPackage')}</ModalLabel>
                <ModalSelect value={selectedProfileForExtend} onChange={(e) => setSelectedProfileForExtend(e.target.value)}>
                  {profiles.map((p) => (<option key={p.id} value={p.id} className="bg-[#0a0520]">{p.name} - Rp {p.price.toLocaleString('id-ID')}{p.id === selectedUserForExtend.profile.id ? ` ${t('pppoe.currentPackageLabel')}` : ''}</option>))}
                </ModalSelect>
                <p className="text-[10px] text-[#e0d0ff]/50 mt-1">{selectedProfileForExtend !== selectedUserForExtend.profile.id ? `⚠️ ${t('pppoe.packageWillChange')}` : t('pppoe.extendSamePackage')}</p>
              </div>
              <div className="bg-[#00f7ff]/10 border border-[#00f7ff]/30 rounded-lg p-3 text-xs"><p className="text-[#00f7ff]">ℹ️ {t('pppoe.extendPaymentInfo')}</p></div>
            </ModalBody>
          )}
          <ModalFooter>
            <ModalButton variant="secondary" onClick={() => { setIsExtendModalOpen(false); setSelectedUserForExtend(null); setSelectedProfileForExtend(''); }}>{t('common.cancel')}</ModalButton>
            <ModalButton variant="primary" onClick={handleConfirmExtend} disabled={!selectedProfileForExtend || Boolean(selectedUserForExtend && extending === selectedUserForExtend.id)}>
              {selectedUserForExtend && extending === selectedUserForExtend.id ? (<><Loader2 className="h-3 w-3 animate-spin mr-1" />{t('pppoe.processing')}</>) : (<><Zap className="h-3 w-3 mr-1" />{t('pppoe.extendNow')}</>)}
            </ModalButton>
          </ModalFooter>
        </SimpleModal>

        {/* Broadcast Notification Modal */}
        <SimpleModal isOpen={isBroadcastDialogOpen} onClose={() => setIsBroadcastDialogOpen(false)} size="lg">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#ff44cc]" />{t('pppoe.broadcastNotification')} {selectedUsers.size} User</ModalTitle>
            <ModalDescription>{t('pppoe.broadcastDesc')}</ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-4 max-h-[60vh] overflow-y-auto">
            {notificationType === 'outage' && (
              <>
                <div>
                  <ModalLabel required>Status</ModalLabel>
                  <ModalSelect value={broadcastData.status} onChange={(e) => setBroadcastData({ ...broadcastData, status: e.target.value })}>
                    <option value="in_progress" className="bg-[#0a0520]">🔧 {t('pppoe.outageInProgress')}</option>
                    <option value="resolved" className="bg-[#0a0520]">✅ {t('pppoe.outageResolved')}</option>
                  </ModalSelect>
                </div>
                {broadcastData.status === 'in_progress' ? (
                  <>
                    <div><ModalLabel required>{t('pppoe.issueType')}</ModalLabel><ModalInput type="text" value={broadcastData.issueType} onChange={(e) => setBroadcastData({ ...broadcastData, issueType: e.target.value })} placeholder={t('pppoe.issueTypePlaceholder')} /></div>
                    <div><ModalLabel required>{t('pppoe.issueDescription')}</ModalLabel><ModalTextarea value={broadcastData.description} onChange={(e) => setBroadcastData({ ...broadcastData, description: e.target.value })} placeholder={t('pppoe.issueDescPlaceholder')} rows={4} /></div>
                    <div><ModalLabel required>{t('pppoe.estimatedTime')}</ModalLabel><ModalInput type="text" value={broadcastData.estimatedTime} onChange={(e) => setBroadcastData({ ...broadcastData, estimatedTime: e.target.value })} placeholder={t('pppoe.estimatedTimePlaceholder')} /></div>
                    <div><ModalLabel required>{t('pppoe.affectedArea')}</ModalLabel><ModalInput type="text" value={broadcastData.affectedArea} onChange={(e) => setBroadcastData({ ...broadcastData, affectedArea: e.target.value })} placeholder={t('pppoe.affectedAreaPlaceholder')} /></div>
                  </>
                ) : (
                  <>
                    <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg p-3"><p className="text-xs text-[#00ff88]">✅ {t('pppoe.repairCompletedInfo').replace('{count}', String(selectedUsers.size))}</p></div>
                    <div><ModalLabel required>{t('pppoe.information')}</ModalLabel><ModalTextarea value={broadcastData.description} onChange={(e) => setBroadcastData({ ...broadcastData, description: e.target.value })} placeholder={t('pppoe.repairInfoPlaceholder')} rows={4} /></div>
                  </>
                )}
              </>
            )}
            {notificationType === 'invoice' && (
              <>
                <div className="bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded-lg p-3"><p className="text-xs text-[#ff8c00]">{t('pppoe.invoiceInfo').replace('{count}', String(selectedUsers.size))}</p></div>
                <div><ModalLabel>{t('pppoe.additionalMessage')}</ModalLabel><ModalTextarea value={broadcastData.description} onChange={(e) => setBroadcastData({ ...broadcastData, description: e.target.value })} placeholder={t('pppoe.additionalInvoicePlaceholder')} rows={3} /></div>
              </>
            )}
            {notificationType === 'payment' && (
              <>
                <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg p-3"><p className="text-xs text-[#00ff88]">{t('pppoe.paymentReceiptInfo').replace('{count}', String(selectedUsers.size))}</p></div>
                <div><ModalLabel>{t('pppoe.additionalMessage')}</ModalLabel><ModalTextarea value={broadcastData.description} onChange={(e) => setBroadcastData({ ...broadcastData, description: e.target.value })} placeholder={t('pppoe.additionalThankYouPlaceholder')} rows={3} /></div>
              </>
            )}
            <div>
              <ModalLabel className="flex items-center gap-1"><Bell className="h-3 w-3" />{t('pppoe.sendVia')}</ModalLabel>
              <div className="space-y-2 mt-2">
                <label className={`flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all ${broadcastData.notificationMethod === 'whatsapp' ? 'border-[#25D366] bg-[#25D366]/10 shadow-[0_0_10px_rgba(37,211,102,0.3)]' : 'border-[#bc13fe]/30 hover:border-[#25D366]/50'}`}>
                  <input type="radio" value="whatsapp" checked={broadcastData.notificationMethod === 'whatsapp'} onChange={(e) => setBroadcastData({ ...broadcastData, notificationMethod: e.target.value })} className="w-3.5 h-3.5 accent-[#25D366]" />
                  <span className="text-xs text-[#e0d0ff]">{t('pppoe.whatsappOnly')}</span>
                </label>
                <label className={`flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all ${broadcastData.notificationMethod === 'email' ? 'border-[#00f7ff] bg-[#00f7ff]/10 shadow-[0_0_10px_rgba(0,247,255,0.3)]' : 'border-[#bc13fe]/30 hover:border-[#00f7ff]/50'}`}>
                  <input type="radio" value="email" checked={broadcastData.notificationMethod === 'email'} onChange={(e) => setBroadcastData({ ...broadcastData, notificationMethod: e.target.value })} className="w-3.5 h-3.5 accent-[#00f7ff]" />
                  <span className="text-xs text-[#e0d0ff]">{t('pppoe.emailOnly')}</span>
                </label>
                <label className={`flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all ${broadcastData.notificationMethod === 'both' ? 'border-[#bc13fe] bg-[#bc13fe]/10 shadow-[0_0_10px_rgba(188,19,254,0.3)]' : 'border-[#bc13fe]/30 hover:border-[#bc13fe]/50'}`}>
                  <input type="radio" value="both" checked={broadcastData.notificationMethod === 'both'} onChange={(e) => setBroadcastData({ ...broadcastData, notificationMethod: e.target.value })} className="w-3.5 h-3.5 accent-[#bc13fe]" />
                  <span className="text-xs text-[#e0d0ff]">{t('pppoe.whatsappAndEmail')}</span>
                </label>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalButton variant="secondary" onClick={() => setIsBroadcastDialogOpen(false)}>{t('common.cancel')}</ModalButton>
            <ModalButton variant="primary" onClick={handleSendBroadcast} disabled={sendingBroadcast}>
              {sendingBroadcast ? (<><Loader2 className="h-3 w-3 animate-spin mr-1" />{t('pppoe.sending')}</>) : (<><Send className="h-3 w-3 mr-1" />{notificationType === 'outage' && t('pppoe.sendNotificationBtn')}{notificationType === 'invoice' && t('pppoe.sendInvoiceBtn')}{notificationType === 'payment' && t('pppoe.sendPaymentReceipt')}</>)}
            </ModalButton>
          </ModalFooter>
        </SimpleModal>
      </div>
    </div >
  );
}
