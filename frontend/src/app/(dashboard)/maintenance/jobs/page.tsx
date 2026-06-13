'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { maintenanceApi, rentalApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Search, RefreshCw, Plus, Cog, AlertTriangle } from 'lucide-react';
import { CinematicHeader } from '@/components/CinematicHeader';

const STATUSES = ['PENDING','APPROVED','IN_PROGRESS','WAITING_FOR_PARTS','COMPLETED','CANCELLED'];

const PRIORITIES = ['LOW','NORMAL','HIGH','URGENT'];
const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-400', NORMAL: 'text-blue-500', HIGH: 'text-amber-500', URGENT: 'text-red-500',
};

const EMPTY_FORM = {
  vendorId: '', assetId: '', priority: 'NORMAL', category: '',
  problemDescription: '', estimatedCompletion: '', currentOdometer: '', internalNotes: '',
};

export default function MaintenanceJobsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [vendorIdFilter, setVendorIdFilter] = useState(searchParams.get('vendorId') || '');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [vendors, setVendors] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    maintenanceApi.jobs.list({
      search: search || undefined, status: status || undefined,
      priority: priority || undefined, vendorId: vendorIdFilter || undefined, page, limit: 25,
    }).then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, status, priority, vendorIdFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    maintenanceApi.jobs.summary().then(r => setSummary(r.data)).catch(() => {});
    maintenanceApi.vendors.list({ limit: 100 }).then(r => setVendors(r.data.items)).catch(() => {});
    rentalApi.assets.list({ limit: 100 }).then(r => setAssets(r.data.items)).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.vendorId || !form.problemDescription) {
      setError('Vendor and problem description are required'); return;
    }
    setSaving(true); setError('');
    try {
      const created = await maintenanceApi.jobs.create({
        ...form,
        currentOdometer: form.currentOdometer ? Number(form.currentOdometer) : undefined,
        estimatedCompletion: form.estimatedCompletion || undefined,
        assetId: form.assetId || undefined,
      });
      setShowForm(false); setForm({ ...EMPTY_FORM }); load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create job');
    } finally { setSaving(false); }
  };

  const activeJobs = summary?.byStatus?.filter((s: any) => !['COMPLETED','CANCELLED'].includes(s.status))
    .reduce((a: number, s: any) => a + s._count, 0) || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CinematicHeader kicker="Maintenance · Workshop" title="Maintenance Jobs" count={`${total} total · ${activeJobs} active`}>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> New Job
        </button>
      </CinematicHeader>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-6 gap-3 mb-5">
          {summary.byStatus?.map((s: any) => (
            <button key={s.status} onClick={() => { setStatus(s.status); setPage(1); }}
              className={cn('card text-center py-3 cursor-pointer hover:border-brand-200 transition-all', status === s.status ? 'border-brand-400 bg-brand-50' : '')}>
              <p className="text-xl font-bold text-gray-800">{s._count}</p>
              <div className="mt-1 flex justify-center">
                <StatusBadge module="Maintenance" status={s.status} size="sm" showIcon={false} showDot />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add Job Form */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Maintenance Job</h3>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Vendor / Workshop *</label>
              <select className="input w-full" value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Asset</label>
              <select className="input w-full" value={form.assetId} onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}>
                <option value="">Select asset...</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.plateNumber ? ` (${a.plateNumber})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input w-full" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Engine, AC, Tyres, Electrical" />
            </div>
            <div>
              <label className="label">Estimated Completion</label>
              <input type="date" className="input w-full" value={form.estimatedCompletion} onChange={e => setForm(f => ({ ...f, estimatedCompletion: e.target.value }))} />
            </div>
            <div>
              <label className="label">Current Odometer (km)</label>
              <input type="number" className="input w-full" value={form.currentOdometer} onChange={e => setForm(f => ({ ...f, currentOdometer: e.target.value }))} />
            </div>
            <div className="col-span-3">
              <label className="label">Problem Description *</label>
              <textarea className="input w-full" rows={3} value={form.problemDescription}
                onChange={e => setForm(f => ({ ...f, problemDescription: e.target.value }))}
                placeholder="Describe the problem, symptoms, what repairs are needed..." />
            </div>
            <div className="col-span-3">
              <label className="label">Internal Notes</label>
              <textarea className="input w-full" rows={2} value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Create Job'}</button>
            <button onClick={() => { setShowForm(false); setError(''); }} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search jobs..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-36" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <select className="input w-32" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-48" value={vendorIdFilter} onChange={e => { setVendorIdFilter(e.target.value); setPage(1); }}>
          <option value="">All Vendors</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead><tr>
            <th className="table-th">Job No.</th>
            <th className="table-th">Asset</th>
            <th className="table-th">Vendor</th>
            <th className="table-th">Category</th>
            <th className="table-th">Priority</th>
            <th className="table-th">Opened</th>
            <th className="table-th">Est. Completion</th>
            <th className="table-th">Status</th>
            <th className="table-th text-right">Cost</th>
          </tr></thead>
          <tbody>
            {items.map(job => (
              <tr key={job.id} className="table-row">
                <td className="table-td">
                  <Link href={`/maintenance/jobs/${job.id}`} className="font-mono text-xs text-brand-600 hover:underline font-semibold">{job.jobNumber}</Link>
                </td>
                <td className="table-td text-sm">{job.asset?.name || <span className="text-gray-300">—</span>}</td>
                <td className="table-td text-sm text-gray-700">{job.vendor?.name}</td>
                <td className="table-td text-xs text-gray-500">{job.category || '—'}</td>
                <td className="table-td">
                  <span className={cn('text-xs font-semibold', PRIORITY_COLORS[job.priority])}>{job.priority}</span>
                </td>
                <td className="table-td text-xs text-gray-500">{formatDate(job.openedAt)}</td>
                <td className="table-td text-xs text-gray-500">
                  {job.estimatedCompletion ? formatDate(job.estimatedCompletion) : <span className="text-gray-300">—</span>}
                </td>
                <td className="table-td"><StatusBadge module="Maintenance" status={job.status} size="sm" showIcon={false} showDot /></td>
                <td className="table-td text-right text-sm">{job.totalCost ? formatCurrency(job.totalCost) : <span className="text-gray-300">—</span>}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">No maintenance jobs found.</td></tr>
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
