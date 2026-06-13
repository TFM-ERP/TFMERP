'use client';

import { useEffect, useState, useCallback } from 'react';
import { rentalApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { Plus, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const INCIDENT_TYPES = [
  'VEHICLE_BREAKDOWN', 'TRAILER_ISSUE', 'GENERATOR_FAILURE', 'ACCIDENT',
  'DELAY', 'SITE_ACCESS_ISSUE', 'EQUIPMENT_DAMAGE', 'OTHER',
];

const URGENCY_STYLE: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const URGENCY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function IncidentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showResolveId, setShowResolveId] = useState<string | null>(null);
  const [resolveForm, setResolveForm] = useState({ resolutionNotes: '', resolutionCost: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [drivers, setDrivers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');

  const [form, setForm] = useState({
    incidentType: 'VEHICLE_BREAKDOWN',
    urgency: 'MEDIUM',
    title: '',
    description: '',
    location: '',
    driverId: '',
    assetId: '',
    occurredAt: new Date().toISOString().slice(0, 16),
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      rentalApi.incidents.list({
        status: statusFilter || undefined,
        incidentType: typeFilter || undefined,
        urgency: urgencyFilter || undefined,
      }),
      rentalApi.incidents.summary(),
    ])
      .then(([ir, sr]) => {
        setItems(ir.data.items || []);
        setTotal(ir.data.total || 0);
        setSummary(sr.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, urgencyFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      rentalApi.drivers.list({ isActive: 'true', limit: 100 }),
      rentalApi.assets.list({ isActive: 'true', limit: 200 }),
    ]).then(([dr, ar]) => {
      setDrivers(dr.data.items || []);
      setAssets(ar.data.items || []);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.title || !form.description) { setError('Title and description are required'); return; }
    setSaving(true); setError('');
    try {
      await rentalApi.incidents.create({
        ...form,
        driverId: form.driverId || undefined,
        assetId: form.assetId || undefined,
      });
      setShowForm(false);
      setForm({ incidentType: 'VEHICLE_BREAKDOWN', urgency: 'MEDIUM', title: '', description: '', location: '', driverId: '', assetId: '', occurredAt: new Date().toISOString().slice(0, 16) });
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to log incident');
    } finally { setSaving(false); }
  };

  const handleResolve = async () => {
    if (!showResolveId || !resolveForm.resolutionNotes) return;
    setSaving(true);
    try {
      await rentalApi.incidents.resolve(showResolveId, {
        resolutionNotes: resolveForm.resolutionNotes,
        resolutionCost: resolveForm.resolutionCost ? Number(resolveForm.resolutionCost) : undefined,
      });
      setShowResolveId(null);
      setResolveForm({ resolutionNotes: '', resolutionCost: '' });
      load();
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await rentalApi.incidents.updateStatus(id, status);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Safety</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Incident Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{total} records</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> Log Incident
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card border-l-4 border-red-400">
            <p className="text-xs text-gray-400 mb-1">Open Incidents</p>
            <p className="text-2xl font-bold text-red-600">{summary.openCount}</p>
          </div>
          {(summary.byUrgency || [])
            .sort((a: any, b: any) => (URGENCY_ORDER[a.urgency as keyof typeof URGENCY_ORDER] ?? 9) - (URGENCY_ORDER[b.urgency as keyof typeof URGENCY_ORDER] ?? 9))
            .map((u: any) => (
              <div key={u.urgency} className="card">
                <p className="text-xs text-gray-400 mb-1">{u.urgency} (open)</p>
                <p className="text-lg font-bold text-gray-900">{u._count.id}</p>
              </div>
            ))}
        </div>
      )}

      {/* New Incident Form */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Log New Incident</h3>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Incident Type</label>
              <select className="input w-full" value={form.incidentType} onChange={e => setForm(f => ({ ...f, incidentType: e.target.value }))}>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Urgency</label>
              <select className="input w-full" value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date & Time</label>
              <input type="datetime-local" className="input w-full" value={form.occurredAt} onChange={e => setForm(f => ({ ...f, occurredAt: e.target.value }))} />
            </div>
            <div className="col-span-3">
              <label className="label">Title *</label>
              <input className="input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief incident title" />
            </div>
            <div className="col-span-3">
              <label className="label">Description *</label>
              <textarea className="input w-full" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed description of what happened..." />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input w-full" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Site / address" />
            </div>
            <div>
              <label className="label">Driver (if involved)</label>
              <select className="input w-full" value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                <option value="">— None —</option>
                {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Asset (if involved)</label>
              <select className="input w-full" value={form.assetId} onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}>
                <option value="">— None —</option>
                {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}{a.plateNumber ? ` (${a.plateNumber})` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Log Incident'}</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {showResolveId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Resolve Incident</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Resolution Notes *</label>
                <textarea className="input w-full" rows={3} value={resolveForm.resolutionNotes}
                  onChange={e => setResolveForm(f => ({ ...f, resolutionNotes: e.target.value }))}
                  placeholder="What was done to resolve the incident?" />
              </div>
              <div>
                <label className="label">Resolution Cost (AED)</label>
                <input type="number" className="input w-full" value={resolveForm.resolutionCost}
                  onChange={e => setResolveForm(f => ({ ...f, resolutionCost: e.target.value }))}
                  placeholder="0.00" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleResolve} disabled={saving || !resolveForm.resolutionNotes} className="btn btn-primary disabled:opacity-50">
                {saving ? 'Resolving...' : 'Mark Resolved'}
              </button>
              <button onClick={() => { setShowResolveId(null); setResolveForm({ resolutionNotes: '', resolutionCost: '' }); }} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input" value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}>
          <option value="">All Urgencies</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Ref</th>
              <th className="table-th">Date</th>
              <th className="table-th">Type</th>
              <th className="table-th">Title</th>
              <th className="table-th">Driver</th>
              <th className="table-th">Asset</th>
              <th className="table-th">Location</th>
              <th className="table-th">Urgency</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inc: any) => (
              <tr key={inc.id} className="table-row">
                <td className="table-td font-mono text-xs text-gray-400">{inc.incidentNumber}</td>
                <td className="table-td text-xs text-gray-500">{formatDate(inc.occurredAt)}</td>
                <td className="table-td">
                  <span className="badge bg-gray-100 text-gray-600 text-xs">{inc.incidentType.replace(/_/g, ' ')}</span>
                </td>
                <td className="table-td text-sm text-gray-800 max-w-xs truncate">{inc.title}</td>
                <td className="table-td text-xs text-gray-600">
                  {inc.driver ? (
                    <Link href={`/rental/drivers/${inc.driver.id}`} className="hover:text-brand-600 font-medium">
                      {inc.driver.fullName}
                    </Link>
                  ) : '—'}
                </td>
                <td className="table-td text-xs text-gray-600">
                  {inc.asset ? `${inc.asset.name}${inc.asset.plateNumber ? ` (${inc.asset.plateNumber})` : ''}` : '—'}
                </td>
                <td className="table-td text-xs text-gray-500 max-w-[120px] truncate">{inc.location || '—'}</td>
                <td className="table-td">
                  <span className={cn('badge text-xs', URGENCY_STYLE[inc.urgency] || 'bg-gray-100 text-gray-500')}>
                    {inc.urgency}
                  </span>
                </td>
                <td className="table-td">
                  <span className={cn('badge text-xs', STATUS_STYLE[inc.status] || 'bg-gray-100 text-gray-500')}>
                    {inc.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex gap-1 items-center flex-wrap">
                    {inc.status === 'OPEN' && (
                      <>
                        <button onClick={() => handleStatusChange(inc.id, 'IN_PROGRESS')}
                          className="text-yellow-600 hover:text-yellow-700 text-xs font-medium">Start</button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => { setShowResolveId(inc.id); }}
                          className="text-green-600 hover:text-green-700 text-xs font-medium">Resolve</button>
                      </>
                    )}
                    {inc.status === 'IN_PROGRESS' && (
                      <button onClick={() => { setShowResolveId(inc.id); }}
                        className="text-green-600 hover:text-green-700 text-xs font-medium">Resolve</button>
                    )}
                    {inc.status === 'RESOLVED' && (
                      <button onClick={() => handleStatusChange(inc.id, 'CLOSED')}
                        className="text-gray-500 hover:text-gray-700 text-xs font-medium">Close</button>
                    )}
                    {inc.status === 'CLOSED' && <span className="text-xs text-gray-300">—</span>}
                    {inc.resolutionCost && (
                      <span className="text-xs text-gray-400 ml-1">({formatCurrency(inc.resolutionCost)})</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">No incident reports found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
