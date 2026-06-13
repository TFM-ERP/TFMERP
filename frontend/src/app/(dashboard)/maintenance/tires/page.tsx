'use client';

import { useEffect, useState, useCallback } from 'react';
import { maintenanceApi, rentalApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { Search, RefreshCw, Plus, AlertTriangle, CircleDot } from 'lucide-react';
import Link from 'next/link';

const POSITIONS = ['FL', 'FR', 'RL', 'RR', 'SPARE', 'DUAL_RL', 'DUAL_RR'];
const POSITION_LABELS: Record<string, string> = {
  FL: 'Front Left', FR: 'Front Right', RL: 'Rear Left', RR: 'Rear Right',
  SPARE: 'Spare', DUAL_RL: 'Dual Rear Left', DUAL_RR: 'Dual Rear Right',
};

const EMPTY_FORM = {
  assetId: '', vendorId: '', position: 'FL', manufacturer: '', model: '', size: '',
  purchaseDate: '', purchasePrice: '', installationDate: '',
  warrantyStart: '', warrantyEnd: '', expectedLifespanKm: '', expectedLifespanYears: '',
  odometerAtInstall: '', notes: '',
};

export default function TiresPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [assetFilter, setAssetFilter] = useState('');
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
    maintenanceApi.tires.list({ assetId: assetFilter || undefined, page, limit: 25 })
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assetFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    maintenanceApi.tires.warrantyAlerts().then(r => setWarrantyAlerts(r.data)).catch(() => {});
    maintenanceApi.vendors.list({ limit: 100 }).then(r => setVendors(r.data.items)).catch(() => {});
    rentalApi.assets.list({ limit: 100 }).then(r => setAssets(r.data.items)).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.assetId) { setError('Asset is required'); return; }
    setSaving(true); setError('');
    try {
      await maintenanceApi.tires.create({
        ...form,
        vendorId: form.vendorId || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        installationDate: form.installationDate || undefined,
        warrantyStart: form.warrantyStart || undefined,
        warrantyEnd: form.warrantyEnd || undefined,
        expectedLifespanKm: form.expectedLifespanKm ? Number(form.expectedLifespanKm) : undefined,
        expectedLifespanYears: form.expectedLifespanYears ? Number(form.expectedLifespanYears) : undefined,
        odometerAtInstall: form.odometerAtInstall ? Number(form.odometerAtInstall) : undefined,
      });
      setShowForm(false); setForm({ ...EMPTY_FORM }); load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create tire record');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Maintenance · Inventory</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Tire Records</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{total} tire records tracked</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> Add Tire Record
        </button>
      </div>

      {warrantyAlerts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">{warrantyAlerts.length} tire(s)</span> have warranty expiring within 60 days.
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Tire Record</h3>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tire Details</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Asset *</label>
                  <select className="input w-full" value={form.assetId} onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}>
                    <option value="">Select asset...</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.plateNumber ? ` (${a.plateNumber})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Position</label>
                  <select className="input w-full" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                    {POSITIONS.map(p => <option key={p} value={p}>{POSITION_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tire Size</label>
                  <input className="input w-full font-mono" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. 275/70R22.5" />
                </div>
                <div>
                  <label className="label">Manufacturer</label>
                  <input className="input w-full" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder="Michelin, Bridgestone..." />
                </div>
                <div>
                  <label className="label">Model</label>
                  <input className="input w-full" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Supplier / Vendor</label>
                  <select className="input w-full" value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}>
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                <div><label className="label">Odometer at Install (km)</label><input type="number" className="input w-full" value={form.odometerAtInstall} onChange={e => setForm(f => ({ ...f, odometerAtInstall: e.target.value }))} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Warranty & Expected Life</p>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label">Warranty Start</label><input type="date" className="input w-full" value={form.warrantyStart} onChange={e => setForm(f => ({ ...f, warrantyStart: e.target.value }))} /></div>
                <div><label className="label">Warranty End</label><input type="date" className="input w-full" value={form.warrantyEnd} onChange={e => setForm(f => ({ ...f, warrantyEnd: e.target.value }))} /></div>
                <div><label className="label">Expected Life (km)</label><input type="number" className="input w-full" value={form.expectedLifespanKm} onChange={e => setForm(f => ({ ...f, expectedLifespanKm: e.target.value }))} /></div>
                <div><label className="label">Expected Life (years)</label><input type="number" className="input w-full" value={form.expectedLifespanYears} onChange={e => setForm(f => ({ ...f, expectedLifespanYears: e.target.value }))} /></div>
              </div>
            </div>
            <div><label className="label">Notes</label><textarea className="input w-full" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save Tire Record'}</button>
            <button onClick={() => { setShowForm(false); setError(''); }} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input w-56" value={assetFilter} onChange={e => { setAssetFilter(e.target.value); setPage(1); }}>
          <option value="">All Assets</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead><tr>
            <th className="table-th">Asset</th>
            <th className="table-th">Position</th>
            <th className="table-th">Tire</th>
            <th className="table-th">Size</th>
            <th className="table-th">Installed</th>
            <th className="table-th">Warranty Until</th>
            <th className="table-th">Expected Life</th>
            <th className="table-th text-right">Price</th>
          </tr></thead>
          <tbody>
            {items.map(tire => {
              const warrantyExpired = tire.warrantyEnd && new Date(tire.warrantyEnd) < new Date();
              const warrantyWarn = tire.warrantyEnd && !warrantyExpired && new Date(tire.warrantyEnd) < new Date(Date.now() + 60 * 86400000);
              return (
                <tr key={tire.id} className="table-row">
                  <td className="table-td">
                    {tire.asset ? <Link href={`/rental/assets/${tire.asset.id}`} className="text-brand-600 hover:underline text-sm font-medium">{tire.asset.name}</Link> : '—'}
                    {tire.asset?.plateNumber && <p className="text-xs text-gray-400">{tire.asset.plateNumber}</p>}
                  </td>
                  <td className="table-td text-sm">{POSITION_LABELS[tire.position] || tire.position}</td>
                  <td className="table-td text-sm">
                    <p>{tire.manufacturer || '—'}</p>
                    {tire.model && <p className="text-xs text-gray-400">{tire.model}</p>}
                  </td>
                  <td className="table-td font-mono text-xs text-gray-700">{tire.size || '—'}</td>
                  <td className="table-td text-xs text-gray-500">{tire.installationDate ? formatDate(tire.installationDate) : '—'}</td>
                  <td className="table-td text-xs">
                    {tire.warrantyEnd ? (
                      <span className={cn(warrantyExpired ? 'text-red-600 font-semibold' : warrantyWarn ? 'text-amber-600' : 'text-gray-600')}>
                        {warrantyExpired && '⚠ '}{formatDate(tire.warrantyEnd)}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td text-xs text-gray-500">
                    {tire.expectedLifespanKm ? `${tire.expectedLifespanKm.toLocaleString()} km` : tire.expectedLifespanYears ? `${tire.expectedLifespanYears} yr` : '—'}
                  </td>
                  <td className="table-td text-right text-sm">{tire.purchasePrice ? formatCurrency(tire.purchasePrice) : '—'}</td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No tire records found.</td></tr>
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
