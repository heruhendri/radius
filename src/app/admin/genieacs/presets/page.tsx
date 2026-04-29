'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Trash2, Save, RefreshCw } from 'lucide-react';

interface Preset {
  _id: string;
  weight?: number;
  channel?: string;
  schedule?: string;
  precondition?: string;
  events?: Record<string, boolean>;
  configurations?: unknown[];
}

const empty: Preset = {
  _id: '',
  weight: 0,
  channel: 'default',
  precondition: '',
  configurations: [],
};

export default function GenieACSPresetsPage() {
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [editJson, setEditJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/genieacs/presets', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setItems(json.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (p: Preset | null) => {
    const target = p ?? empty;
    setEditing(target);
    setEditJson(JSON.stringify(target, null, 2));
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      let body: Preset;
      try {
        body = JSON.parse(editJson);
      } catch {
        throw new Error('Invalid JSON');
      }
      if (!body._id) throw new Error('_id is required');
      const isNew = !items.find((x) => x._id === body._id);
      const url = isNew
        ? '/api/genieacs/presets'
        : `/api/genieacs/presets/${encodeURIComponent(body._id)}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete preset "${id}"?`)) return;
    try {
      const res = await fetch(`/api/genieacs/presets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Delete failed');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">GenieACS Presets</h1>
          <p className="text-sm text-slate-500">Kelola preset provisioning di NBI server</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-2 text-sm border rounded-md flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => startEdit(null)}
            className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Preset
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Channel</th>
              <th className="text-left px-3 py-2">Weight</th>
              <th className="text-left px-3 py-2">Precondition</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-6">
                  <Loader2 className="w-5 h-5 inline animate-spin" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-slate-500">
                  No presets
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p._id} className="border-t">
                  <td className="px-3 py-2 font-mono">{p._id}</td>
                  <td className="px-3 py-2">{p.channel ?? '-'}</td>
                  <td className="px-3 py-2">{p.weight ?? 0}</td>
                  <td className="px-3 py-2 truncate max-w-[300px]" title={p.precondition}>
                    {p.precondition || '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(p)}
                      className="px-2 py-1 text-xs border rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(p._id)}
                      className="ml-2 px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Edit Preset</h2>
              <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2">
              <label className="text-xs text-slate-500">Preset JSON</label>
              <textarea
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                rows={16}
                className="w-full font-mono text-xs border rounded-md p-2 bg-slate-50 dark:bg-slate-800"
              />
              <p className="text-xs text-slate-500">
                Field _id wajib. Configurations bisa berisi array preset GenieACS standar.
              </p>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-2 text-sm border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
