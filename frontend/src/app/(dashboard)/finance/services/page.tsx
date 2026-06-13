'use client';

import { useEffect, useState, useCallback } from 'react';
import { servicesApi, financeApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Search, Plus, X, Wrench, Loader2, Settings2 } from 'lucide-react';

const UNITS = ['Service', 'Day', 'Hour', 'Trip', 'Unit', 'Liter', 'Gallon', 'Ton', 'Km', 'Month', 'Week'];
const CATEGORIES = [
  'Personnel', 'Transportation', 'Fuel', 'Water', 'Waste', 'Generator Support',
  'Technical Support', 'Consumable', 'Other',
];

const EMPTY = {
  name: '', category: 'Personnel', unitOfMeasure: 'Service', unitPrice: '',
  taxRateId: '', costCenterId: '', description: '', isActive: true,
};

export default function ServiceCatalogPage() {
  const [items, setItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [showCC, setShowCC] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    servicesApi.list({ search: search || undefined, category: category || undefined })
      .then(r => setItems(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, category]);

  const loadRefs = useCallback(() => {
    financeApi.vat.list().then(r => setTaxRates(r.data || [])).catch(() => {});
    servicesApi.costCenters().then(r => setCostCenters(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { loadRefs(); }, [loadRefs]);

  const save = async () => {
    if (!form.name.trim()) { alert('Service name is required'); return; }
    const payload = { ...form, unitPrice: form.unitPrice ? Number(form.unitPrice) : 0 };
    if (form.id) await servicesApi.update(form.id, payload);
    else await servicesApi.create(payload);
    setForm(null); load();
  };
  const toggle = async (id: string) => { await servicesApi.toggleActive(id); load(); };

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Finance · Catalog</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Service Catalog</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>Billable services & consumables sold alongside rentals</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCC(true)} className="btn btn-secondary"><Settings2 size={14} className="mr-1" /> Cost Centers</button>
          <button onClick={() => setForm({ ...EMPTY })} className="btn btn-primary"><Plus size={14} className="mr-1" /> Add Service</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search services…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-48" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Service</th>
              <th className="table-th">Category</th>
              <th className="table-th">Unit</th>
              <th className="table-th text-right">Unit Price</th>
              <th className="table-th">Cost Center</th>
              <th className="table-th">Status</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No services yet. Click "Add Service".</td></tr>
            ) : items.map(s => (
              <tr key={s.id} className="table-row">
                <td className="table-td">
                  <button onClick={() => setForm({ ...s, taxRateId: s.taxRateId || '', costCenterId: s.costCenterId || '', unitPrice: s.unitPrice })}
                    className="font-medium text-gray-900 hover:text-brand-600 text-left">{s.name}</button>
                  {s.description && <div className="text-xs text-gray-400">{s.description}</div>}
                </td>
                <td className="table-td text-sm text-gray-600">{s.category || '—'}</td>
                <td className="table-td text-sm text-gray-600">{s.unitOfMeasure}</td>
                <td className="table-td text-right text-sm">{formatCurrency(Number(s.unitPrice || 0))}</td>
                <td className="table-td text-sm text-gray-600">{s.costCenter?.name || '—'}</td>
                <td className="table-td"><span className={cn('badge', s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="table-td text-right">
                  <button onClick={() => toggle(s.id)} className="text-xs text-gray-400 hover:text-gray-700">{s.isActive ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Service editor modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold">{form.id ? 'Edit' : 'Add'} Service</h2>
              <button onClick={() => setForm(null)} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Service Name *</label><input className="input w-full" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Base Camp Supervisor" /></div>
              <div>
                <label className="label">Category</label>
                <select className="input w-full" value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Unit of Measure</label>
                <select className="input w-full" value={form.unitOfMeasure} onChange={e => setForm({ ...form, unitOfMeasure: e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><label className="label">Unit Price (AED)</label><input type="number" className="input w-full" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} /></div>
              <div>
                <label className="label">Tax Rate</label>
                <select className="input w-full" value={form.taxRateId ?? ''} onChange={e => setForm({ ...form, taxRateId: e.target.value })}>
                  <option value="">No VAT</option>
                  {taxRates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Cost Center</label>
                <select className="input w-full" value={form.costCenterId ?? ''} onChange={e => setForm({ ...form, costCenterId: e.target.value })}>
                  <option value="">—</option>
                  {costCenters.filter((c: any) => c.isActive || c.id === form.costCenterId).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" checked={!!form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                <span className="text-sm text-gray-600">Active</span>
              </label>
              <div className="col-span-2"><label className="label">Description</label><textarea className="input w-full" rows={2} value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {showCC && <CostCentersModal costCenters={costCenters} onClose={() => setShowCC(false)} onChange={loadRefs} />}
    </div>
  );
}

function CostCentersModal({ costCenters, onClose, onChange }: { costCenters: any[]; onClose: () => void; onChange: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const add = async () => { if (!name.trim()) return; await servicesApi.createCostCenter({ name, code: code || undefined }); setName(''); setCode(''); onChange(); };
  const remove = async (id: string) => { if (confirm('Deactivate this cost center?')) { await servicesApi.deleteCostCenter(id); onChange(); } };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Cost Centers</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">
          <div className="flex gap-2 mb-4">
            <input className="input flex-1" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <input className="input w-24" placeholder="Code" value={code} onChange={e => setCode(e.target.value)} />
            <button onClick={add} className="btn btn-primary"><Plus size={14} /></button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {costCenters.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-2.5">
                <span className="text-sm text-gray-700">{c.name} {c.code && <span className="text-xs text-gray-400">({c.code})</span>} {!c.isActive && <span className="text-xs text-red-500">inactive</span>}</span>
                {c.isActive && <button onClick={() => remove(c.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>}
              </div>
            ))}
            {costCenters