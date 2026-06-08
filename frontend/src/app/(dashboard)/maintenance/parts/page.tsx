'use client';

import { useEffect, useState, useCallback } from 'react';
import { maintenanceApi, rentalApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { Search, RefreshCw, Plus, Package, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'WORN'];
const CONDITION_COLORS: Record<string, string> = {
  NEW: 'bg-green-100 text-green-700',
  GOOD: 'bg-blue-100 text-blue-700',
  FAIR: 'bg-amber-100 text-amber-700',
  WORN: 'bg-red-100 text-red-600',
};

const EMPTY_FORM = {
  name: '', partNumber: '', manufacturer: '', assetId: '', vendorId: '',
  purchaseDate: '', purchasePrice: '', installationDate: '',
  warrantyStart: '', warrantyEnd: '', expectedLifespanYears: '',
  expectedLifespanKm: '', condition: 'NEW', notes: '',
};

export default function SparePartsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [warrantyAlerts, setWarrantyAlerts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [vendors, setVendors] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    maintenanceApi.parts.list({ search: search || undefined, page, limit: 25 })
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    maintenanceApi.parts.warrantyAlerts().then(r => setWarrantyAlerts(r.data)).catch(() => {});
    maintenanceApi.vendors.list({ limit: 100 }).then(r => setVendors(r.data.items)).catch(() => {});
    rentalApi.assets.list({ limit: 100 }).then(r => setAssets(r.data.items)).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.name) { setError('Part name is required'); return; }
    setSaving(true); setError('');
    try {
      await maintenanceApi.parts.create({
        ...form,
        assetId: form.assetId || undefined,
        vendorId: form.vendorId || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        installationDate: form.installationDate || undefined,
        warrantyStart: form.warrantyStart || undefined,
        warrantyEnd: form.warrantyEnd || undefined,
        expectedLifespanYears: form.expectedLifespanYears ? Number(form.expectedLifespanYears) : undefined,
        expectedLifespanKm: form.expectedLifespanKm ? Number(form.expectedLifespanKm) : undefined,
      });
      setShowForm(false); setForm({ ...EMPTY_FORM }); load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create part');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={22} className="text-brand-600" /> Spare Parts
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} parts tracked</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> Add Part
        </button>
      </div>

      {warrantyAlerts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">{warrantyAlerts.length} part(s)</span> have warranty expiring within 60 days.
            {warrantyAlerts.slice(0,3).map((p: any) => (
              <span key={p.id} className="ml-1 text-xs">· {p.name} ({p.asset?.name})</span>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Spare Part</h3>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Part Information</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Part Name *</label><input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Part Number / SKU</label><input className="input w-full font-mono" value={form.partNumber} onChange={e => setForm(f => ({ ...f, partNumber: e.target.value }))} /></div>
                <div><label className="label">Manufacturer</label><input className="input w-full" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} /></div>
                <div>
                  <label className="label">Installed On (Asset)</label>
                  <select className="input w-full" value={form.assetId} onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}>
                    <option value="">Select asset...</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Supplier / Vendor</label>
                  <select className="input w-full" value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}>
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Condition</label>
                  <select className="input w-full" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Purchase & Installation</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Purchase Date</label><input type="date" className="input w-full" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} /></div>
                <div><label className="label">Purchase Price (AED)</label><input type="number" className="input w-full" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} /></div>
                <div><label className="label">Installation Date</label><input type="date" className="input w-full" value={form.installationDate} onChange={e => setForm(f => ({ ...f, installationDate: e.target.value }))} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Warranty & Lifespan</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Warranty Start</label><input type="date" className="input w-full" value={form.warrantyStart} onChange={e => setForm(f => ({ ...f, warrantyStart: e.target.value }))} /></div>
                <div><label className="label">Warranty End</label><input type="date" className="input w-full" value={form.warrantyEnd} onChange={e => setForm(f => ({ ...f, warrantyEnd: e.target.value }))} /></div>
                <div><label className="label">Expected Lifespan (years)</label><input type="number" className="input w-full" value={form.expectedLifespanYears} onChange={e => setForm(f => ({ ...f, expectedLifespanYears: e.target.value }))} /></div>
                <div><label className="label">Expected Lifespan (km)</label><input type="number" className="input w-full" value={form.expectedLifespanKm} onChange={e => setForm(f => ({ ...f, expectedLifespanKm: e.target.value }))} /></div>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input w-full" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save Part'}</button>
            <button onClick={() => { setShowForm(false); setError(''); }} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search parts..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead><tr>
            <th className="table-th">Part</th>
            <th className="table-th">Asset</th>
            <th className="table-th">Vendor</th>
            <th className="table-th">Installed</th>
            <th className="table-th">Warranty</th>
            <th className="table-th">Condition</th>
            <th className="table-th text-right">Price</th>
          </tr></thead>
          <tbody>
            {items.map(part => {
              const warrantyExpired = part.warrantyEnd && new Date(part.warrantyEnd) < new Date();
              const warrantyWarn = part.warrantyEnd && !warrantyExpired && new Date(part.warrantyEnd) < new Date(Date.now() + 60 * 86400000);
              return (
                <tr key={part.id} className="table-row">
                  <td className="table-td">
                    <p className="font-medium text-sm text-gray-900">{part.name}</p>
                    {part.partNumber && <p className="font-mono text-[10px] text-gray-400">{part.partNumber}</p>}
                    {part.manufacturer && <p className="text-xs text-gray-400">{part.manufacturer}</p>}
                  </td>
                  <td className="table-td text-sm">
                    {part.asset ? <Link href={`/rental/assets/${part.asset.id}`} className="text-brand-600 hover:underline">{part.asset.name}</Link> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td text-sm text-gray-600">
                    {part.vendor ? <Link href={`/maintenance/vendors/${part.vendor.id}`} className="hover:underline">{part.vendor.name}</Link> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td text-xs text-gray-500">{part.installationDate ? formatDate(part.installationDate) : '—'}</td>
                  <td className="table-td text-xs">
                    {part.warrantyEnd ? (
                      <span className={cn(warrantyExpired ? 'text-red-600 font-semibold' : warrantyWarn ? 'text-amber-600' : 'text-gray-600')}>
                        {warrantyExpired && '⚠ '}{formatDate(part.warrantyEnd)}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td">
                    <span className={cn('badge', CONDITION_COLORS[part.condition] || 'bg-gray-100 text-gray-600')}>
                      {part.condition || 'N/A'}
                    </span>
                  </td>
                  <td className="table-td text-right text-sm">{part.purchasePrice ? formatCurrency(part.purchasePrice) : '—'}</td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No spare parts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
