'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, DollarSign, FileText, CheckCircle, CheckCircle2, Clock, RefreshCw, Eye, AlertCircle, Copy, Check, ExternalLink, MessageCircle, Trash2, Search, Download, Printer } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerUsername: string | null;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentToken: string | null;
  paymentLink: string | null;
  createdAt: string;
  user: {
    customerId: string | null;  // ID Pelanggan
    name: string;
    phone: string;
    email: string | null;
    username: string;
    profile: {
      name: string;
    } | null;
    area: {  // Area
      id: string;
      name: string;
    } | null;
  } | null;
}

interface Stats {
  total: number;
  unpaid: number;
  paid: number;
  pending: number;
  overdue: number;
  totalUnpaidAmount: number;
  totalPaidAmount: number;
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    unpaid: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalUnpaidAmount: 0,
    totalPaidAmount: 0,
  });
  const [activeTab, setActiveTab] = useState('unpaid');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingWA, setSendingWA] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [activeTab]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const res = await fetch(`/api/invoices?status=${status}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Load invoices error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredInvoices = () => {
    if (!searchQuery) return invoices;
    const query = searchQuery.toLowerCase();
    return invoices.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(query) ||
      inv.customerName?.toLowerCase().includes(query) ||
      inv.customerUsername?.toLowerCase().includes(query) ||
      inv.customerPhone?.includes(query)
    );
  };

  const handleMarkAsPaid = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
  };

  const confirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedInvoice.id, status: 'PAID' }),
      });

      if (res.ok) {
        await showSuccess(t('invoices.markedAsPaid'));
        setIsPaymentDialogOpen(false);
        loadInvoices();
      } else {
        const data = await res.json();
        await showError(data.error || t('invoices.failedToMarkPaid'));
      }
    } catch (error) {
      await showError(t('invoices.failedToMarkPaid'));
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateInvoices = async () => {
    const confirmed = await showConfirm(t('invoices.generateConfirm'), t('invoices.generateInvoice'));
    if (!confirmed) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/invoices/generate', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message, t('invoices.invoicesGenerated'));
        loadInvoices();
      } else {
        await showError(data.message || t('invoices.failedToGenerate'));
      }
    } catch (error) {
      await showError(t('invoices.failedToGenerate'));
    } finally {
      setGenerating(false);
    }
  };

  const handleViewDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleCopyPaymentLink = async (invoice: Invoice) => {
    if (!invoice.paymentLink) return;
    try {
      await navigator.clipboard.writeText(invoice.paymentLink);
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast(t('invoices.paymentLinkCopied'), 'success');
    } catch (error) {
      showToast(t('common.failedToCopy'), 'error');
    }
  };

  const handleSendWhatsApp = async (invoice: Invoice) => {
    if (!invoice.customerPhone) {
      await showError(t('invoices.customerPhoneNotFound'));
      return;
    }

    const confirmed = await showConfirm(t('invoices.sendReminderTo', { name: invoice.customerName || invoice.customerUsername || '' }), t('invoices.sendWhatsApp'));
    if (!confirmed) return;

    setSendingWA(invoice.id);
    try {
      const res = await fetch('/api/invoices/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (data.success) {
        await showSuccess(t('invoices.whatsappReminderSent'));
      } else {
        await showError(data.error || t('invoices.failedToSend'));
      }
    } catch (error) {
      await showError(t('invoices.failedToSendWhatsApp'));
    } finally {
      setSendingWA(null);
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    const newSelection = new Set(selectedInvoices);
    if (newSelection.has(invoiceId)) {
      newSelection.delete(invoiceId);
    } else {
      newSelection.add(invoiceId);
    }
    setSelectedInvoices(newSelection);
  };

  const toggleSelectAll = () => {
    const filteredInvoices = getFilteredInvoices();
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const handleBroadcastInvoices = async () => {
    if (selectedInvoices.size === 0) {
      await showError(t('invoices.selectMinOneInvoice'));
      return;
    }

    const confirmed = await showConfirm(
      t('invoices.broadcastConfirm', { count: selectedInvoices.size }),
      'Broadcast Tagihan'
    );
    if (!confirmed) return;

    setBroadcasting(true);
    try {
      const res = await fetch('/api/whatsapp/broadcast-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: Array.from(selectedInvoices),
        }),
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess(`Broadcast ${t('common.success').toLowerCase()}!\n✅ ${t('whatsapp.sent')}: ${data.successCount}\n❌ ${t('whatsapp.failed')}: ${data.failCount}`);
        setSelectedInvoices(new Set());
      } else {
        await showError(data.error || t('whatsapp.broadcastFailed'));
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      await showError(t('common.failedSendBroadcast'));
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmed = await showConfirm(
      `Delete invoice ${invoice.invoiceNumber}?\n\n${invoice.customerName || invoice.customerUsername || 'Unknown'}\n${formatCurrency(Number(invoice.amount))}`,
      'Delete Invoice'
    );
    if (!confirmed) return;

    setDeleting(invoice.id);
    try {
      const res = await fetch(`/api/invoices?id=${invoice.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await showSuccess(t('invoices.invoiceDeleted'));
        loadInvoices();
      } else {
        await showError(data.error || t('common.failedDelete'));
      }
    } catch (error) {
      await showError(t('invoices.failedDeleteInvoice'));
    } finally {
      setDeleting(null);
    }
  };

  // Export functions
  const handleExportExcel = async () => {
    try {
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const res = await fetch(`/api/invoices/export?format=excel&status=${status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Invoices-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await showError(t('invoices.exportFailed')); }
  };

  const handleExportPDF = async () => {
    try {
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const res = await fetch(`/api/invoices/export?format=pdf&status=${status}`);
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
        doc.save(`Invoices-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) { console.error('PDF error:', error); await showError(t('invoices.pdfExportFailed')); }
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      const data = await res.json();
      if (!data.success || !data.data) { await showError(t('invoices.failedGetInvoiceData')); return; }
      const inv = data.data;

      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();

      // Header
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(inv.company.name, 105, 20, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      if (inv.company.address) doc.text(inv.company.address, 105, 26, { align: 'center' });
      if (inv.company.phone) doc.text(`Tel: ${inv.company.phone}`, 105, 31, { align: 'center' });

      // Invoice title
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', 105, 45, { align: 'center' });

      // Invoice details
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`No: ${inv.invoice.number}`, 14, 55);
      doc.text(`Date: ${inv.invoice.date}`, 14, 61);
      doc.text(`Due: ${inv.invoice.dueDate}`, 14, 67);
      doc.text(`Status: ${inv.invoice.status}`, 14, 73);

      // Customer
      doc.setFont('helvetica', 'bold'); doc.text('Bill To:', 130, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(inv.customer.name, 130, 61);
      if (inv.customer.phone) doc.text(inv.customer.phone, 130, 67);
      if (inv.customer.username) doc.text(`Username: ${inv.customer.username}`, 130, 73);

      // Items table
      const autoTable = (await import('jspdf-autotable')).default;
      autoTable(doc, {
        head: [['Description', 'Qty', 'Price', 'Total']],
        body: inv.items.map((item: any) => [item.description, item.quantity, formatCurrency(item.price), formatCurrency(item.total)]),
        startY: 85,
        headStyles: { fillColor: [13, 148, 136] },
        styles: { fontSize: 10 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text(`Total: ${inv.amountFormatted}`, 196, finalY, { align: 'right' });

      if (inv.invoice.paidAt) {
        doc.setFontSize(14); doc.setTextColor(0, 128, 0);
        doc.text('PAID', 105, finalY + 15, { align: 'center' });
        doc.setFontSize(9); doc.text(`Paid on: ${inv.invoice.paidAt}`, 105, finalY + 21, { align: 'center' });
      }

      doc.save(`Invoice-${inv.invoice.number}.pdf`);
    } catch (error) { console.error('Print error:', error); await showError(t('invoices.failedPrintInvoice')); }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => formatWIB(new Date(dateStr), 'd MMM yyyy');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0.5">{t('invoices.paid')}</Badge>;
      case 'PENDING':
        return <Badge className="bg-warning/10 text-warning text-[10px] px-1.5 py-0.5">{t('invoices.pending')}</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0.5">{t('invoices.overdue')}</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5">{t('invoices.cancelled')}</Badge>;
      default:
        return <Badge className="text-[10px] px-1.5 py-0.5">{status}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.user?.name?.toLowerCase().includes(q) ||
      inv.customerName?.toLowerCase().includes(q) ||
      inv.user?.phone?.includes(q) ||
      inv.customerPhone?.includes(q)
    );
  });

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a0f35] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <Loader2 className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">{t('invoices.title')}</h1>
            <p className="text-sm text-[#e0d0ff]/80 mt-1">{t('invoices.monthlyBilling')}</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {selectedInvoices.size > 0 && (
              <button
                onClick={handleBroadcastInvoices}
                disabled={broadcasting}
                className="inline-flex items-center px-2 py-1.5 text-xs bg-accent text-accent-foreground rounded hover:bg-accent/90 disabled:opacity-50"
              >
                {broadcasting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MessageCircle className="h-3 w-3 mr-1" />}
                {t('invoices.broadcast')} ({selectedInvoices.size})
              </button>
            )}
            <button onClick={handleExportExcel} className="inline-flex items-center px-2 py-1.5 text-xs border border-success text-success rounded hover:bg-success/10"><Download className="h-3 w-3 mr-1" />Excel</button>
            <button onClick={handleExportPDF} className="inline-flex items-center px-2 py-1.5 text-xs border border-destructive text-destructive rounded hover:bg-destructive/10"><Download className="h-3 w-3 mr-1" />PDF</button>
            <Button onClick={handleGenerateInvoices} disabled={generating} size="sm" className="h-8 text-xs">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              {t('invoices.generateInvoice')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('common.total')}</p>
                <p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.total}</p>
              </div>
              <div className="p-2 rounded-lg shadow-lg bg-[#bc13fe]/20">
                <FileText className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('invoices.pending')}</p>
                <p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.unpaid}</p>
                <p className="text-xs text-[#e0d0ff]/70 mt-1">{formatCurrency(Number(stats.totalUnpaidAmount))}</p>
              </div>
              <div className="p-2 rounded-lg shadow-lg bg-red-400/20">
                <Clock className="w-4 h-4 text-red-400" />
              </div>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('invoices.paid')}</p>
                <p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.paid}</p>
                <p className="text-xs text-[#e0d0ff]/70 mt-1">{formatCurrency(Number(stats.totalPaidAmount))}</p>
              </div>
              <div className="p-2 rounded-lg shadow-lg bg-green-400/20">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#00f7ff] uppercase tracking-wide">{t('invoices.overdue')}</p>
                <p className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-1">{stats.overdue}</p>
              </div>
              <div className="p-2 rounded-lg shadow-lg bg-amber-400/20">
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="bg-card rounded-lg border border-border">
          {/* Tabs & Search */}
          <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
            <div className="flex gap-1">
              {[
                { key: 'unpaid', label: `${t('invoices.pending')} (${stats.unpaid})` },
                { key: 'paid', label: `${t('invoices.paid')} (${stats.paid})` },
                { key: 'all', label: `${t('common.all')} (${stats.total})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-[10px]">
                  <TableHead className="text-[10px] py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.size === getFilteredInvoices().length && getFilteredInvoices().length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </TableHead>
                  <TableHead className="text-[10px] py-2">{t('invoices.invoiceNumber')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden xl:table-cell">{t('invoices.customerId')}</TableHead>
                  <TableHead className="text-[10px] py-2">{t('invoices.customer')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden lg:table-cell">{t('common.email')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden md:table-cell">{t('nav.profile')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden lg:table-cell">{t('common.area')}</TableHead>
                  <TableHead className="text-[10px] py-2 text-right">{t('invoices.amount')}</TableHead>
                  <TableHead className="text-[10px] py-2">{t('invoices.status')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden sm:table-cell">{t('invoices.dueDate')}</TableHead>
                  <TableHead className="text-[10px] py-2 text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      <AlertCircle className="h-5 w-5 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">{t('common.noData')}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="text-xs">
                      <TableCell className="py-2">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={() => toggleInvoiceSelection(invoice.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </TableCell>
                      <TableCell className="py-2 font-mono font-medium text-[10px]">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="py-2 hidden xl:table-cell text-[10px] text-muted-foreground">
                        {invoice.user?.customerId || '-'}
                      </TableCell>
                      <TableCell className="py-2 text-[10px]">
                        <div>
                          <div className="font-medium truncate max-w-[120px]">{invoice.user?.name || invoice.customerName || 'Deleted'}</div>
                          <div className="text-muted-foreground text-[9px] truncate max-w-[120px]">{invoice.user?.phone || invoice.customerPhone || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell text-[10px] text-muted-foreground truncate max-w-[150px]">{invoice.user?.email || invoice.customerEmail || '-'}</TableCell>
                      <TableCell className="py-2 hidden md:table-cell text-[10px] text-muted-foreground">{invoice.user?.profile?.name || '-'}</TableCell>
                      <TableCell className="py-2 hidden lg:table-cell text-[10px] text-muted-foreground">
                        {invoice.user?.area?.name || '-'}
                      </TableCell>
                      <TableCell className="py-2 text-right font-medium text-xs">{formatCurrency(Number(invoice.amount))}</TableCell>
                      <TableCell className="py-2">{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="py-2 hidden sm:table-cell text-[10px] text-muted-foreground">{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {invoice.paymentLink && (
                            <button onClick={() => handleCopyPaymentLink(invoice)} className="p-1 hover:bg-muted rounded" title="Copy Link">
                              {copiedId === invoice.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          )}
                          <button onClick={() => handlePrintInvoice(invoice)} className="p-1 hover:bg-muted rounded" title="Print PDF">
                            <Printer className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleViewDetail(invoice)} className="p-1 hover:bg-muted rounded" title="View">
                            <Eye className="h-3 w-3 text-muted-foreground" />
                          </button>
                          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && invoice.customerPhone && (
                            <button onClick={() => handleSendWhatsApp(invoice)} disabled={sendingWA === invoice.id} className="p-1 hover:bg-muted rounded" title="WhatsApp">
                              {sendingWA === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          )}
                          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                            <button onClick={() => handleMarkAsPaid(invoice)} className="px-1.5 py-0.5 text-[10px] font-medium bg-success text-success-foreground rounded hover:bg-success/90">
                              {t('invoices.markAsPaid')}
                            </button>
                          )}
                          <button onClick={() => handleDeleteInvoice(invoice)} disabled={deleting === invoice.id} className="p-1 hover:bg-destructive/10 rounded text-destructive" title="Delete">
                            {deleting === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{t('common.details')}</DialogTitle>
              <DialogDescription className="text-xs">{selectedInvoice?.invoiceNumber}</DialogDescription>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.invoiceNumber')}</p>
                    <p className="font-mono font-medium">{selectedInvoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.status')}</p>
                    <div className="mt-0.5">{getStatusBadge(selectedInvoice.status)}</div>
                  </div>
                </div>
                <div className="border-t pt-3 border-border">
                  <p className="text-[10px] text-muted-foreground">{t('invoices.customer')}</p>
                  <p className="font-medium">{selectedInvoice.user?.name || selectedInvoice.customerName || 'Deleted'}</p>
                  <p className="text-muted-foreground">{selectedInvoice.user?.phone || selectedInvoice.customerPhone || '-'}</p>
                  {(selectedInvoice.user?.email || selectedInvoice.customerEmail) && (
                    <p className="text-muted-foreground text-[10px]">📧 {selectedInvoice.user?.email || selectedInvoice.customerEmail}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('nav.profile')}</p>
                    <p>{selectedInvoice.user?.profile?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.amount')}</p>
                    <p className="text-base font-bold text-success">{formatCurrency(Number(selectedInvoice.amount))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.createdAt')}</p>
                    <p>{formatDate(selectedInvoice.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.dueDate')}</p>
                    <p>{formatDate(selectedInvoice.dueDate)}</p>
                  </div>
                </div>
                {selectedInvoice.paymentLink && (
                  <div className="border-t pt-3 border-border">
                    <p className="text-[10px] text-muted-foreground mb-1.5">{t('invoices.paymentLink')}</p>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={selectedInvoice.paymentLink}
                        readOnly
                        className="flex-1 px-2 py-1.5 text-[10px] bg-muted border border-border rounded font-mono truncate"
                      />
                      <button onClick={() => handleCopyPaymentLink(selectedInvoice)} className="p-1.5 hover:bg-muted rounded">
                        {copiedId === selectedInvoice.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => window.open(selectedInvoice.paymentLink!, '_blank')} className="p-1.5 hover:bg-muted rounded">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsDetailDialogOpen(false)} size="sm" className="h-8 text-xs">{t('common.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">{t('invoices.markAsPaid')}</DialogTitle>
              <DialogDescription className="text-xs">{selectedInvoice?.invoiceNumber}</DialogDescription>
            </DialogHeader>
            <form onSubmit={confirmPayment} className="space-y-3">
              <div className="text-xs">
                <p className="text-[10px] text-muted-foreground">{t('invoices.customer')}</p>
                <p className="font-medium">{selectedInvoice?.user?.name || selectedInvoice?.customerName || 'Deleted'}</p>
              </div>
              <div className="text-xs">
                <p className="text-[10px] text-muted-foreground">{t('invoices.amount')}</p>
                <p className="text-base font-bold">{formatCurrency(Number(selectedInvoice?.amount || 0))}</p>
              </div>
              <div className="bg-info/10 border border-info/20 rounded-md p-2.5">
                <p className="text-[10px] text-info">
                  ℹ️ {t('invoices.expiryExtendedNote')}
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={processing} size="sm" className="h-8 text-xs">
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={processing} size="sm" className="h-8 text-xs">
                  {processing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  {t('common.confirm')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
