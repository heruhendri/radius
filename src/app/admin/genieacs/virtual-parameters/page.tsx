"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, Pencil, Trash2, ToggleLeft, ToggleRight, Code2, Cpu } from "lucide-react";
import Swal from "sweetalert2";
import { useTranslation } from "@/hooks/useTranslation";

interface VirtualParameter {
  id: string;
  name: string;
  parameter: string;
  expression: string;
  displayType?: string;
  displayOrder?: number;
  icon?: string | null;
  color?: string | null;
  category?: string | null;
  unit?: string | null;
  showInSummary?: boolean;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function VirtualParametersPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<VirtualParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VirtualParameter | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'display'>('basic');
  const [form, setForm] = useState({
    name: "",
    parameter: "",
    expression: "",
    displayType: "card",
    displayOrder: 0,
    icon: "",
    color: "purple",
    category: "",
    unit: "",
    showInSummary: true,
    description: "",
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/genieacs/virtual-parameters", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
      }
    } catch (error) {
      console.error("Failed to load virtual parameters", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ 
      name: "", 
      parameter: "", 
      expression: "", 
      displayType: "card",
      displayOrder: 0,
      icon: "",
      color: "purple",
      category: "",
      unit: "",
      showInSummary: true,
      description: "", 
      isActive: true 
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (vp: VirtualParameter) => {
    setEditing(vp);
    setForm({
      name: vp.name,
      parameter: vp.parameter,
      expression: vp.expression,
      displayType: vp.displayType || "card",
      displayOrder: vp.displayOrder || 0,
      icon: vp.icon || "",
      color: vp.color || "purple",
      category: vp.category || "",
      unit: vp.unit || "",
      showInSummary: vp.showInSummary !== false,
      description: vp.description || "",
      isActive: vp.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        parameter: form.parameter.trim(),
        expression: form.expression.trim(),
        description: form.description.trim() || null,
        isActive: form.isActive,
        displayType: form.displayType && form.displayType.trim() ? form.displayType.trim() : "card",
        displayOrder: typeof form.displayOrder === 'number' ? form.displayOrder : 0,
        icon: form.icon && form.icon.trim() ? form.icon.trim() : null,
        color: form.color && form.color.trim() ? form.color.trim() : null,
        category: form.category && form.category.trim() ? form.category.trim() : null,
        unit: form.unit && form.unit.trim() ? form.unit.trim() : null,
        showInSummary: typeof form.showInSummary === 'boolean' ? form.showInSummary : true,
      };

      const endpoint = editing
        ? `/api/settings/genieacs/virtual-parameters/${editing.id}`
        : "/api/settings/genieacs/virtual-parameters";
      const method = editing ? "PUT" : "POST";

      console.log('Submitting virtual parameter:', payload);

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      console.log('Response:', data);

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.details || t('genieacs.failedSaveParam'));
      }

      setShowForm(false);
      resetForm();
      fetchData();
      Swal.fire({ icon: "success", title: t('common.success'), text: t('genieacs.paramSaved') });
    } catch (error: any) {
      console.error('Error submitting:', error);
      Swal.fire({ icon: "error", title: t('common.error'), text: error?.message || t('genieacs.failedSaveParam') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vp: VirtualParameter) => {
    const confirmed = await Swal.fire({
      icon: "warning",
      title: t('genieacs.deleteParamConfirm'),
      text: t('genieacs.deleteParamWarning').replace('{name}', vp.name),
      showCancelButton: true,
      confirmButtonText: t('genieacs.yesDeleteIt'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: "#e11d48",
    });
    if (!confirmed.isConfirmed) return;

    setDeletingId(vp.id);
    try {
      const res = await fetch(`/api/settings/genieacs/virtual-parameters/${vp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('genieacs.failedDeleteParam'));
      setItems((prev) => prev.filter((item) => item.id !== vp.id));
    } catch (error: any) {
      Swal.fire({ icon: "error", title: t('common.error'), text: error?.message || t('genieacs.failedDeleteParam') });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStatus = async (vp: VirtualParameter) => {
    try {
      const res = await fetch(`/api/settings/genieacs/virtual-parameters/${vp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vp.name,
          parameter: vp.parameter,
          expression: vp.expression,
          description: vp.description || null,
          isActive: !vp.isActive,
          displayType: vp.displayType && vp.displayType.trim() ? vp.displayType.trim() : "card",
          displayOrder: typeof vp.displayOrder === 'number' ? vp.displayOrder : 0,
          icon: vp.icon && vp.icon.trim ? vp.icon.trim() : null,
          color: vp.color && vp.color.trim ? vp.color.trim() : null,
          category: vp.category && vp.category.trim ? vp.category.trim() : null,
          unit: vp.unit && vp.unit.trim ? vp.unit.trim() : null,
          showInSummary: typeof vp.showInSummary === 'boolean' ? vp.showInSummary : true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('genieacs.failedChangeStatus'));
      setItems((prev) => prev.map((item) => (item.id === vp.id ? { ...item, isActive: !item.isActive } : item)));
    } catch (error: any) {
      Swal.fire({ icon: "error", title: t('common.error'), text: error?.message || t('genieacs.failedChangeStatus') });
    }
  };

  return (
    <div className="min-h-screen bg-[#1a0f35] relative overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div><div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div><div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div><div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div></div>
      <div className="relative z-10 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)] flex items-center gap-2">
              <Cpu className="w-6 h-6 text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
              {t('genieacs.virtualParamsTitle')}
            </h1>
            <p className="text-sm text-[#e0d0ff]/80 mt-1">
              {t('genieacs.virtualParamsSubtitle')}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 shadow"
          >
            <Plus className="w-4 h-4" />
            {t('genieacs.addVirtualParam')}
          </button>
        </div>

        {/* Help Banner */}
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Code2 className="w-5 h-5 text-primary dark:text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                {t('genieacs.whatIsVirtualParams')}
              </h3>
              <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                {t('genieacs.virtualParamsDesc')}
              </p>
              <details className="text-xs text-blue-700 dark:text-blue-300">
                <summary className="cursor-pointer font-medium hover:text-blue-900 dark:hover:text-blue-100">
                  {t('genieacs.viewExamples')}
                </summary>
                <div className="mt-2 space-y-2 pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                  <div>
                    <p className="font-mono text-[11px] text-blue-900 dark:text-blue-100">VirtualParameters.uptime</p>
                    <p className="text-[11px] text-primary dark:text-primary">→ {t('genieacs.calcUptimeDesc')}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-blue-900 dark:text-blue-100">VirtualParameters.redaman</p>
                    <p className="text-[11px] text-primary dark:text-primary">→ {t('genieacs.getSignalDesc')}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-blue-900 dark:text-blue-100">VirtualParameters.pppUsername</p>
                    <p className="text-[11px] text-primary dark:text-primary">→ {t('genieacs.getPppoeDesc')}</p>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground dark:text-gray-100">{t('genieacs.parameterList')}</p>
              <p className="text-xs text-muted-foreground">
                {items.length} {t('genieacs.parameters')} · {items.filter(i => i.isActive).length} {t('genieacs.activeCount')} · {items.filter(i => !i.isActive).length} {t('genieacs.inactiveCount')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href="https://docs.genieacs.com/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground dark:text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                title={t('common.docs')}
              >
                <Code2 className="w-3 h-3" />
                {t('common.docs')}
              </a>
              <button onClick={fetchData} className="text-xs text-primary hover:underline">{t('common.refresh')}</button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)]" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <Code2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">{t('genieacs.noVirtualParams')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t('genieacs.createFirstParam')}</p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                {t('genieacs.addFirstParam')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {items.map((vp) => (
                <div key={vp.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{vp.name}</span>
                      <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${vp.isActive ? "bg-success/20 text-success dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-muted-foreground dark:bg-inputdark:text-gray-300"}`}>
                        {vp.isActive ? t('genieacs.activeCount').charAt(0).toUpperCase() + t('genieacs.activeCount').slice(1) : t('genieacs.inactiveCount').charAt(0).toUpperCase() + t('genieacs.inactiveCount').slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground break-all font-mono">{vp.parameter}</p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground line-clamp-2">{vp.expression}</p>
                    {vp.description && <p className="text-[11px] text-muted-foreground">{vp.description}</p>}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => toggleStatus(vp)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-foreground dark:text-gray-200 hover:bg-muted/50"
                    >
                      {vp.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {vp.isActive ? t('genieacs.deactivate') : t('genieacs.activate')}
                    </button>
                    <button
                      onClick={() => openEdit(vp)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-primary hover:bg-primary/10 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(vp)}
                      disabled={deletingId === vp.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {deletingId === vp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{editing ? t('genieacs.editVirtualParam') : t('genieacs.addVirtualParamTitle')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('genieacs.fillPathExpression')}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-gray-700">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'basic' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-gray-700'}`}
              >
                {t('genieacs.basicSettings')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('display')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'display' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-gray-700'}`}
              >
                {t('genieacs.displaySettings')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {activeTab === 'basic' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.paramNameLabel')}</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card"
                      placeholder={t('genieacs.paramNamePlaceholder')}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">{t('genieacs.paramNameHint')}</p>
                  </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.parameterPath')}</label>
                <input
                  value={form.parameter}
                  onChange={(e) => setForm({ ...form, parameter: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card font-mono"
                  placeholder="VirtualParameters.signalStrength"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t('genieacs.parameterPathHint')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.expression')}</label>
                <textarea
                  value={form.expression}
                  onChange={(e) => setForm({ ...form, expression: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-card"
                  rows={6}
                  placeholder="let uptime = declare(&quot;Device.DeviceInfo.UpTime&quot;, {value: Date.now()}).value[0];&#10;return Math.floor((Date.now() - Date.parse(uptime)) / 1000);"
                  required
                />
                <div className="mt-1 space-y-1">
                  <p className="text-[11px] text-muted-foreground">{t('genieacs.expressionHint')}</p>
                  <details className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    <summary className="cursor-pointer text-primary hover:underline">{t('genieacs.viewExpressionExamples')}</summary>
                    <div className="mt-2 p-2 bg-muted rounded border border-border space-y-2">
                      <div>
                        <p className="font-semibold">1. Uptime (detik):</p>
                        <pre className="text-[10px] overflow-x-auto">{`let uptime = declare("Device.DeviceInfo.UpTime", {value: Date.now()}).value[0];
return Math.floor((Date.now() - Date.parse(uptime)) / 1000);`}</pre>
                      </div>
                      <div>
                        <p className="font-semibold">2. Signal Strength:</p>
                        <pre className="text-[10px] overflow-x-auto">{`let rx = declare("Device.X_HW_WebPonInfo.RxPower", {value: 0}).value[0];
return parseFloat(rx) || 0;`}</pre>
                      </div>
                      <div>
                        <p className="font-semibold">3. PPPoE Username:</p>
                        <pre className="text-[10px] overflow-x-auto">{`let user = declare("Device.PPP.Interface.1.Username", {value: ""}).value[0];
return user || "N/A";`}</pre>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.descriptionOptional')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-card"
                  rows={2}
                  placeholder={t('genieacs.descriptionPlaceholder')}
                />
              </div>

                  <label className="inline-flex items-center gap-2 text-sm text-foreground dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    {t('genieacs.activateThisParam')}
                  </label>

                  {/* Tips Section */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-2">💡 {t('genieacs.tips')}</p>
                    <ul className="text-[11px] text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                      <li>{t('genieacs.tipDeclare')}</li>
                      <li>{t('genieacs.tipDefault')}</li>
                      <li>{t('genieacs.tipTest')}</li>
                      <li>{t('genieacs.tipDescription')}</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {/* Display Settings Tab */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.displayType')}</label>
                      <select
                        value={form.displayType}
                        onChange={(e) => setForm({ ...form, displayType: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card"
                      >
                        <option value="card">Card</option>
                        <option value="badge">Badge</option>
                        <option value="meter">Meter</option>
                        <option value="list">List</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.displayOrderLabel')}</label>
                      <input
                        type="number"
                        value={form.displayOrder}
                        onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card"
                        placeholder="0"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('genieacs.displayOrderHint')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.color')}</label>
                      <select
                        value={form.color}
                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card"
                      >
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="purple">Purple</option>
                        <option value="red">Red</option>
                        <option value="orange">Orange</option>
                        <option value="teal">Teal</option>
                        <option value="pink">Pink</option>
                        <option value="indigo">Indigo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.unitOptional')}</label>
                      <input
                        type="text"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card"
                        placeholder="dBm, °C, MB, etc"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.categoryOptional')}</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card"
                      placeholder="Network, System, Performance, etc"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('genieacs.categoryHint')}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">{t('genieacs.iconOptional')}</label>
                    <input
                      type="text"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card font-mono"
                      placeholder="Signal, Wifi, Activity, etc"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('genieacs.iconHint')}</p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-foreground dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={form.showInSummary}
                      onChange={(e) => setForm({ ...form, showInSummary: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    {t('genieacs.showInSummary')}
                  </label>

                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">🎨 {t('genieacs.displayOptions')}</p>
                    <ul className="text-[10px] text-blue-800 dark:text-blue-200 space-y-0.5">
                      <li><strong>Card:</strong> {t('genieacs.cardDesc')}</li>
                      <li><strong>Badge:</strong> {t('genieacs.badgeDesc')}</li>
                      <li><strong>Meter:</strong> {t('genieacs.meterDesc')}</li>
                      <li><strong>List:</strong> {t('genieacs.listDesc')}</li>
                    </ul>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-border text-foreground dark:text-gray-200 hover:bg-muted/50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editing ? t('genieacs.saveChanges') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}


