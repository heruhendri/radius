'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Download, RefreshCw, Filter } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface RekapVoucher {
  batchCode: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
    phone: string;
  } | null;
  profile: {
    id: string;
    name: string;
  };
  totalQty: number;
  stock: number; // WAITING
  sold: number;  // ACTIVE + EXPIRED
}

export default function RekapVoucherPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [rekap, setRekap] = useState<RekapVoucher[]>([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterAgent, filterProfile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAgent && filterAgent !== 'all') params.set('agentId', filterAgent);
      if (filterProfile && filterProfile !== 'all') params.set('profileId', filterProfile);

      const res = await fetch(`/api/hotspot/rekap-voucher?${params}`);
      const data = await res.json();
      setRekap(data.rekap || []);
      setAgents(data.agents || []);
      setProfiles(data.profiles || []);
    } catch (error) {
      console.error('Failed to fetch rekap:', error);
    }
    setLoading(false);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAgent && filterAgent !== 'all') params.set('agentId', filterAgent);
      if (filterProfile && filterProfile !== 'all') params.set('profileId', filterProfile);
      
      const res = await fetch(`/api/hotspot/rekap-voucher/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap-Voucher-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const filteredRekap = rekap.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.batchCode.toLowerCase().includes(search) ||
      item.agent?.name.toLowerCase().includes(search) ||
      item.profile.name.toLowerCase().includes(search)
    );
  });

  const totalQty = filteredRekap.reduce((sum, item) => sum + item.totalQty, 0);
  const totalStock = filteredRekap.reduce((sum, item) => sum + item.stock, 0);
  const totalSold = filteredRekap.reduce((sum, item) => sum + item.sold, 0);

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
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
            <BarChart3 className="w-5 h-5 text-[#00f7ff]" />
            {t('hotspot.rekapVoucherTitle')}
          </h1>
          <p className="text-sm text-[#e0d0ff]/80 mt-1">
            {t('hotspot.rekapVoucherSubtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border-2 border-primary/30 rounded-lg hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent/90 text-black font-bold rounded-lg shadow-[0_0_15px_rgba(0,247,255,0.3)] hover:shadow-[0_0_20px_rgba(0,247,255,0.5)] transition-all border border-accent/50"
          >
            <Download className="w-3.5 h-3.5" />
            {t('common.export')}
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              <Filter className="w-3 h-3 inline mr-1" />
              {t('agent.title').split(' ')[0]}
            </label>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-card"
            >
              <option value="">{t('hotspot.allAgents')}</option>
              <option value="all">{t('hotspot.allAgents')}</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              <Filter className="w-3 h-3 inline mr-1" />
              {t('hotspot.profile')}
            </label>
            <select
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-card"
            >
              <option value="">{t('hotspot.allProfiles')}</option>
              <option value="all">{t('hotspot.allProfiles')}</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-foreground mb-1.5">
              {t('hotspot.searchBatchAgentProfile')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('hotspot.typeToSearch')}
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-card"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg border-2 border-primary/30 shadow-[0_0_15px_rgba(188,19,254,0.1)]">
          <div className="text-xs text-primary font-bold uppercase mb-1">{t('hotspot.totalQty')}</div>
          <div className="text-2xl font-bold text-primary drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]">{totalQty.toLocaleString()}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border-2 border-success/30 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
          <div className="text-xs text-success font-bold uppercase mb-1">{t('hotspot.stock')}</div>
          <div className="text-2xl font-bold text-success drop-shadow-[0_0_5px_rgba(0,255,136,0.5)]">{totalStock.toLocaleString()}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border-2 border-warning/30 shadow-[0_0_15px_rgba(255,170,0,0.1)]">
          <div className="text-xs text-warning font-bold uppercase mb-1">{t('hotspot.sold')}</div>
          <div className="text-2xl font-bold text-warning drop-shadow-[0_0_5px_rgba(255,170,0,0.5)]">{totalSold.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.batchCode')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.creationDate')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.partnerAgent')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.profile')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.qty')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.stock')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase">{t('hotspot.sold')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-xs">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : filteredRekap.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-xs">
                    {t('hotspot.noRekapData')}
                  </td>
                </tr>
              ) : (
                filteredRekap.map((item, index) => (
                  <tr key={item.batchCode} className="hover:bg-muted">
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2 text-[10px] font-mono text-foreground">
                      {item.batchCode}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">
                      {item.agent ? (
                        <div>
                          <div className="font-medium text-foreground">{item.agent.name}</div>
                          <div className="text-muted-foreground">{item.agent.phone}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">{t('hotspot.admin')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">
                      {item.profile.name}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-right font-medium text-primary">
                      {item.totalQty}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-right font-medium text-success">
                      {item.stock}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-right font-medium text-orange-600">
                      {item.sold}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRekap.length > 0 && (
              <tfoot className="bg-muted border-t border-border">
                <tr className="font-bold">
                  <td colSpan={5} className="px-3 py-2 text-xs text-foreground text-right">
                    {t('common.total')}:
                  </td>
                  <td className="px-3 py-2 text-xs text-right text-primary">
                    {totalQty.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-right text-success">
                    {totalStock.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-right text-orange-600">
                    {totalSold.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Info Footer */}
      <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">ℹ️</div>
          <div>
            <div className="font-medium mb-1">{t('hotspot.notes')}:</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>{t('hotspot.qty')}:</strong> {t('hotspot.qtyDesc')}</li>
              <li><strong>{t('hotspot.stock')}:</strong> {t('hotspot.stockDesc')}</li>
              <li><strong>{t('hotspot.sold')}:</strong> {t('hotspot.soldDesc')}</li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
