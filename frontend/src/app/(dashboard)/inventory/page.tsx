'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Search, Plus, AlertTriangle, RefreshCw, Boxes, DollarSign } from 'lucide-react';
import { inventoryApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const UNITS = ['each', 'roll', 'box', 'pack', 'set', 'metre', 'litre', 'kg', 'pair'];

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', category: '', unit: 'each', unitCost: '', quantity: '', reorderLevel: '', location: '', supplierName: '', notes: '' });

  const load = () => {
    setLoading(true);
    inventoryApi.list({ search: q || undefined, category: cat || undefined, lowStock: lowOnly ? 'true' : undefined })
      .then(r => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [q, cat, lowOnly]); // eslint-disable-line
  useEffect(() => {
    inventoryApi.summary().then(r => setSummary(r.data)).catch(() => {});
    inventoryApi.categories().then(r => setCats(r.data || [])).catch(() => {});
  }, []);

  const refreshAll = () => { load(); inventoryApi.summary().then(r => setSummary(r.data)).catch(() => {}); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await inventoryApi.create({
        ...form,
        unitCost: form.unitCost ? Number(form.unitCost) : 0,
        quantity: form.quantity ? Number(form.quantity) : 0,
        reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : 0,
      });
      setShowForm(false);
      setForm({ name: '', sku: '', category: '', unit: 'each', unitCost: '', quantity: '', reorderLevel: '', location: '', supplierName: '', notes: '' });
      refreshAll();
      inventoryApi.categories().then(r => setCats(r.data || [])).catch(() => {});
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Package size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Operations · Stock</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Inventory &amp; Consumables</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Track expendables, stock levels and reorder points.</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn btn-primary"><Plus size={14} /> Add item</button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Boxes size={16} className="text-blue-600" /></div>
          <div><p className="text-xs text-gray-400">Active items</p><p className="text-lg font-bold text-gray-900">{summary?.totalItems ?? '—'}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center"><DollarSign size={16} className="text-green-600" /></div>
          <div><p className="text-xs text-gray-400">Stock value</p><p className="text-lg font-bold text-gray-900">{summary ? formatCurrency(summary.totalValue) : '—'}</p></div>
        </div>
        <button onClick={() => setLowOnly(v => !v)} className={`card flex items-center gap-3 text-left transition-all ${lowOnly ? 'ring-1 ring-amber-300' : ''}`}>
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><AlertTriangle size={16} className="text-amber-600" /></div>
          <div><p className="text-xs text-gray-400">Low stock</p><p className="text-lg font-bold text-amber-600">{summary?.lowStockCount ?? '—'}</p></div>
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card mb-5 bg-blue-50/40 border-blue-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">New inventory item</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2"><label className="label">Name *</label><input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gaffer tape 50mm black" /></div>
            <div><label className="label">SKU</label><input className="input w-full font-mono" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
            <div><label className="label">Category</label><input className="input w-full" list="inv-cats" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Expendables" /><datalist id="inv-cats">{cats.map(c => <option key={c} value={c} />)}</datalist></div>
            <div><label className="label">Unit</label><select className="input w-full" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
            <div><label className="label">Unit cost (AED)</label><input type="number" className="input w-full" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
            <div><label className="label">Opening qty</label><input type="number" className="input w-full" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div><label className="label">Reorder level</label><input type="number" className="input w-full" value={form.reorderLevel} onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))} /></div>
            <div><label className="label">Location</label><input className="input w-full" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Store / shelf" /></div>
            <div><label className="label">Supplier</label><input className="input w-full" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} /></div>
            <div className="md:col-span-4"><label className="label">Notes</label><input className="input w-full" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={saving || !form.name} className="btn btn-primary text-sm">{saving ? 'Saving…' : 'Add item'}</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search name, SKU, category…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-44" value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
        <button onClick={refreshAll} className="btn btn-secondary p-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          items.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No items{lowOnly ? ' below reorder level' : ''} yet.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Item</th><th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-right">On hand</th><th className="px-3 py-2.5 text-right">Reorder</th>
                <th className="px-3 py-2.5 text-right">Unit cost</th><th className="px-3 py-2.5 text-right">Value</th>
                <th className="px-3 py-2.5 text-left">Location</th>
              </tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/inventory/${i.id}`} className="font-medium text-gray-800 hover:text-brand-600">{i.name}</Link>
                      {i.sku && <span className="text-xs text-gray-400 ml-2 font-mono">{i.sku}</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{i.category || '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`font-semibold ${i.low ? 'text-amber-600' : 'text-gray-800'}`}>{Number(i.quantity)}</span>
                      <span className="text-xs text-gray-400 ml-1">{i.unit}</span>
                      {i.low && <AlertTriangle size={11} className="inline ml-1 text-amber-500" />}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500">{Number(i.reorderLevel)}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{formatCurrency(Number(i.unitCost))}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800">{formatCurrency(i.value)}</td>
                  