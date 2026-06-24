'use client';

import { useEffect, useState } from 'react';
import { financeApi } from '@/lib/api';
import { Percent, Plus, X, Check, Loader2, Star } from 'lucide-react';

const VAT_TYPES = ['STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE'];
const TYPE_LABEL: Record<string, string> = {
  STANDARD: 'Standard', ZERO_RATED: 'Zero-rated', EXEMPT: 'Exempt', OUT_OF_SCOPE: 'Out of scope',
};
const EMPTY = { name: '', rate: '', vatType: 'STANDARD', description: '', isDefault: false, isActive: true };

export default function VatRatesPage() {
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null); // null = closed; object = create/edit
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    financeApi.vat.list().then(r => setRates(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(),
      rate: Number(form.rate) || 0,
      vatType: form.vatType,
      description: form.description || undefined,
      isDefault: !!form.isDefault,
      isActive: !!form.isActive,
    };
    try {
      if (form.id) await financeApi.vat.update(form.id, payload);
      else await financeApi.vat.create(payload);
      setForm(null); load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save tax rate');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Percent size={22} /> VAT / Tax Rates</h1>
          <p className="text-gray-500 text-sm mt-0.5">Rates applied to invoice & quotation line items</p>
        </div>
        <button onClick={() => { setError(''); setForm({ ...EMPTY }); }} className="btn btn-primary">
          <Plus size={14} className="me-1" /> New Rate
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">Type</th>
              <th className="table-th text-end">Rate</th>
              <th className="table-th">Default</th>
              <th className="table-th">Status</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
            ) : rates.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No tax rates yet — create one or seed the UAE defaults.</td></tr>
            ) : rates.map(r => (
              <tr key={r.id} className="table-row cursor-pointer" onClick={() => { setError(''); setForm({ ...r, rate: String(r.rate ?? '') }); }}>
                <td className="table-td font-medium text-gray-900">{r.name}</td>
                <td className="table-td text-sm text-gray-600">{TYPE_LABEL[r.vatType] || r.vatType}</td>
                <td className="table-td text-end tabular-nums">{Number(r.rate)}%</td>
                <td className="table-td">{r.isDefault && <Star size={14} className="text-amber-500 fill-amber-400" />}</td>
                <td className="table-td">
                  {r.isActive
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Active</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><X size={12} /> Inactive</span>}
                </td>
                <td className="table-td text-end text-xs text-brand-600">Edit</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">{form.id ? 'Edit Tax Rate' : 'New Tax Rate'}</h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div>
                <label className="label">Name *</label>
                <input className="input w-full" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. UAE VAT 5%" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rate (%)</label>
                  <input type="number" step="0.01" min="0" className="input w-full" value={form.rate} onChange={e => setForm((f: any) => ({ ...f, rate: e.target.value }))} placeholder="5" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input w-full" value={form.vatType} onChange={e => setForm((f: any) => ({ ...f, vatType: e.target.value }))}>
                    {VAT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input w-full" value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.isDefault} onChange={e => setForm((f: any) => ({ ...f, isDefault: e.target.checked }))} /><span className="text-sm text-gray-600">Default rate</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.isActive} onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))} /><span className="text-sm text-gray-600">Active</span></label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
