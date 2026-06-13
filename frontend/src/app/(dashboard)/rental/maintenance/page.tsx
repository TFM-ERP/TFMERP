'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { rentalApi, maintenanceApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  RefreshCw, Wrench, Plus, X, Save, CheckCircle2, PlayCircle,
  XCircle, AlertTriangle, ChevronDown, Search, Loader2,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-gray-100 text-gray-500',
};

const TYPE_LABELS: Record<string, string> = {
  PREVENTIVE:  'Preventive',
  CORRECTIVE:  'Corrective',
  INSPECTION:  'Inspection',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(item: any) {
  return (item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS')
    && new Date(item.scheduledDate) < new Date();
}

// ── Schedule Form Modal ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  assetId:        '',
  maintenanceType:'PREVENTIVE',
  scheduledDate:  '',
  description:    '',
  vendorName:     '',
  cost:           '',
  notes:          '',
  nextServiceDate:'',
  nextServiceKm:  '',
  downTimeDays:   '',
};

function ScheduleModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: any;        // if set → editing
  onClose: () => void;
  onSaved: (item: any) => void;
}) {
  const editing = !!initial;
  const [form, setForm] = useState(initial ? {
    assetId:         initial.assetId         ?? '',
    maintenanceType: initial.maintenanceType ?? 'PREVENTIVE',
    scheduledDate:   initial.scheduledDate   ? initial.scheduledDate.slice(0, 10) : '',
    description:     initial.description     ?? '',
    vendorName:      initial.vendorName      ?? '',
    cost:            initial.cost            ?? '',
    notes:           initial.technicianNotes ?? '',
    nextServiceDate: initial.nextServiceDate ? initial.nextServiceDate.slice(0, 10) : '',
    nextServiceKm:   initial.nextServiceKm   ?? '',
    downTimeDays:    initial.downTimeDays    ?? '',
  } : { ...EMPTY_FORM });

  const [assets,  setAssets]  = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  // tracks whether "Other (type manually)" is the selected dropdown option
  const [vendorIsOther, setVendorIsOther] = useState(false);

  useEffect(() => {
    rentalApi.assets.list({ limit: 200 })
      .then(r => setAssets(r.data.items || []))
      .catch(() => {});
    maintenanceApi.vendors.list({ limit: 200, isActive: true })
      .then(r => {
        const list = r.data.items || r.data || [];
        setVendors(list);
        // If editing and the saved vendorName isn't in the vendor list, switch to "Other" mode
        if (editing && initial?.vendorName) {
          const found = list.some((v: any) => v.name === initial.vendorName);
          if (!found) setVendorIsOther(true);
        }
      })
      .catch(() => {});
  }, []);

  const f = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetId)      return setError('Select an asset');
    if (!form.scheduledDate) return setError('Scheduled date is required');
    if (!form.description)  return setError('Description is required');
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        cost: form.cost !== '' ? Number(form.cost) : undefined,
        nextServiceKm:  form.nextServiceKm  !== '' ? Number(form.nextServiceKm)  : undefined,
        downTimeDays:   form.downTimeDays   !== '' ? Number(form.downTimeDays)   : undefined,
      };
      const res = editing
        ? await rentalApi.maintenance.update(initial.id, payload)
        : await rentalApi.maintenance.create(payload);
      onSaved(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 glass-bar z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? 'Edit Maintenance Record' : 'Schedule Maintenance'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Asset */}
          <div>
            <label className="label">Asset *</label>
            <select className="input w-full" required value={form.assetId}
              onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}
              disabled={editing}
            >
              <option value="">— Select asset —</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.plateNumber ? ` · ${a.plateNumber}` : ''} [{a.assetType.replace(/_/g,' ')}]
                </option>
              ))}
            </select>
          </div>

          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Maintenance Type *</label>
              <select className="input w-full" {...f('maintenanceType')}>
                <option value="PREVENTIVE">Preventive</option>
                <option value="CORRECTIVE">Corrective</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </div>
            <div>
              <label className="label">Scheduled Date *</label>
              <input type="date" className="input w-full" required {...f('scheduledDate')} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description / Work Required *</label>
            <textarea className="input w-full" rows={3} required {...f('description')}
              placeholder="Describe the maintenance work to be carried out…" />
          </div>

          {/* Vendor + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vendor / Workshop</label>
              <select
                className="input w-full"
                value={vendorIsOther ? '__other__' : form.vendorName}
                onChange={e => {
                  if (e.target.value === '__other__') {
                    setVendorIsOther(true);
                    setForm(f => ({ ...f, vendorName: '' }));
                  } else {
                    setVendorIsOther(false);
                    setForm(f => ({ ...f, vendorName: e.target.value }));
                  }
                }}
              >
                <option value="">— No vendor —</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.name}>
                    {v.name}{v.vendorType ? ` · ${v.vendorType.replace(/_/g, ' ')}` : ''}
                  </option>
                ))}
                <option value="__other__">Other (type manually)</option>
              </select>
              {vendorIsOther && (
                <input
                  className="input w-full mt-1.5"
                  placeholder="Enter vendor / workshop name"
                  value={form.vendorName}
                  onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))}
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="label">Estimated Cost (AED)</label>
              <input type="number" className="input w-full" {...f('cost')} min={0} step={0.01} placeholder="0.00" />
            </div>
          </div>

          {/* Down time + Next service */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Expected Down Time (days)</label>
              <input type="number" className="input w-full" {...f('downTimeDays')} min={0} placeholder="1" />
            </div>
            <div>
              <label className="label">Next Service Date</label>
              <input type="date" className="input w-full" {...f('nextServiceDate')} />
            </div>
          </div>
          <div>
            <label className="label">Next Service KM</label>
            <input type="number" className="input w-full" {...f('nextServiceKm')} min={0} placeholder="e.g. 160000" />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Technician Notes / Instructions</label>
            <textarea className="input w-full" rows={2} {...f('notes')} placeholder="Any special instructions…" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Complete Modal ────────────────────────────────────────────────────────────

function CompleteModal({
  item,
  onClose,
  onDone,
}: { item: any; onClose: () => void; onDone: (updated: any) => void }) {
  const [form, setForm] = useState({
    actualCost:     item.cost ?? '',
    notes:          item.technicianNotes ?? '',
    invoiceRef:     item.invoiceRef ?? '',
    partsReplaced:  item.partsReplaced ?? '',
    nextServiceDate: item.nextServiceDate ? item.nextServiceDate.slice(0, 10) : '',
    downTimeDays:   item.downTimeDays ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const f = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [key]: e.target.value })),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await rentalApi.maintenance.complete(item.id, {
        actualCost:      form.actualCost !== '' ? Number(form.actualCost) : undefined,
        notes:           form.notes       || undefined,
        invoiceRef:      form.invoiceRef  || undefined,
        partsReplaced:   form.partsReplaced || undefined,
        nextServiceDate: form.nextServiceDate || undefined,
        downTimeDays:    form.downTimeDays !== '' ? Number(form.downTimeDays) : undefined,
      });
      onDone(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Mark as Completed</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <strong className="text-gray-800">{item.asset?.name}</strong> — {item.description}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Actual Cost (AED)</label>
              <input type="number" className="input w-full" {...f('actualCost')} min={0} step={0.01} />
            </div>
            <div>
              <label className="label">Down Time (days)</label>
              <input type="number" className="input w-full" {...f('downTimeDays')} min={0} />
            </div>
          </div>
          <div>
            <label className="label">Vendor Invoice Ref</label>
            <input className="input w-full" {...f('invoiceRef')} placeholder="e.g. VIN-2024-001" />
          </div>
          <div>
            <label className="label">Parts Replaced</label>
            <textarea className="input w-full" rows={2} {...f('partsReplaced')} placeholder="List parts replaced…" />
          </div>
          <div>
            <label className="label">Next Service Date</label>
            <input type="date" className="input w-full" {...f('nextServiceDate')} />
          </div>
          <div>
            <label className="label">Technician Notes</label>
            <textarea className="input w-full" rows={2} {...f('notes')} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Saving…' : 'Mark Completed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const [items,    setItems]    = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [status,   setStatus]   = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [view, setView] = useState<'list' | 'tiles'>(() =>
    (typeof window !== 'undefined' && window.localStorage.getItem('maint-view') as any) || 'list');
  const switchView = (v: 'list' | 'tiles') => { setView(v); try { window.localStorage.setItem('maint-view', v); } catch {} };
  const [listError, setListError] = useState('');

  const [showSchedule, setShowSchedule] = useState(false);
  const [editItem,     setEditItem]     = useState<any | null>(null);
  const [completeItem, setCompleteItem] = useState<any | null>(null);

  const load = useCallback(() => {
    setLoading(true); setListError('');
    rentalApi.maintenance.list({
      status:          status         || undefined,
      maintenanceType: typeFilter     || undefined,
      search:          search.trim()  || undefined,
      page,
      limit: 25,
    })
      .then(r => {
        setItems(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
        setPages(r.data.pages ?? 1);
      })
      .catch(err => setListError(err?.response?.data?.message || 'Failed to load maintenance records'))
      .finally(() => setLoading(false));
  }, [status, typeFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (item: any) => {
    setShowSchedule(false); setEditItem(null);
    load();
  };

  const handleCompleted = (updated: any) => {
    setCompleteItem(null);
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  const handleStart = async (item: any) => {
    try {
      const res = await rentalApi.maintenance.start(item.id);
      setItems(prev => prev.map(i => i.id === item.id ? res.data : i));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to start maintenance');
    }
  };

  const handleCancel = async (item: any) => {
    const reason = window.prompt('Reason for cancellation (optional):');
    if (reason === null) return; // user pressed Cancel
    try {
      const res = await rentalApi.maintenance.cancel(item.id, reason || undefined);
      setItems(prev => prev.map(i => i.id === item.id ? res.data : i));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to cancel');
    }
  };

  const overdueCount = items.filter(isOverdue).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Maintenance · Records</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Maintenance</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {total} record{total !== 1 ? 's' : ''}
            {overdueCount > 0 && <span className="ml-2 font-medium" style={{ color: 'var(--danger)' }}>· {overdueCount} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => switchView('list')} className={cn('px-3 py-2 text-xs font-medium', view === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:text-gray-900')}>List</button>
            <button onClick={() => switchView('tiles')} className={cn('px-3 py-2 text-xs font-medium', view === 'tiles' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:text-gray-900')}>Tiles</button>
          </div>
          <button onClick={() => setShowSchedule(true)} className="btn btn-primary flex items-center gap-1.5">
            <Plus size={16} /> Schedule Maintenance
          </button>
        </div>
      </div>

      {listError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {listError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 w-56"
            placeholder="Search asset, vendor…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className="input w-44" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="PREVENTIVE">Preventive</option>
          <option value="CORRECTIVE">Corrective</option>
          <option value="INSPECTION">Inspection</option>
        </select>
        <button onClick={load} className="btn btn-secondary p-2" title="Refresh">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Tiles view — info-rich cards (no photo), surfacing what the list shows */}
      {view === 'tiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const over = isOverdue(item);
            return (
              <div key={item.id} className={cn('relative rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-all', over ? 'border-red-200' : 'border-gray-200')}
                style={{ background: 'var(--surface-1)', borderColor: over ? undefined : 'var(--border-1)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--gold)' }}>{TYPE_LABELS[item.maintenanceType] ?? item.maintenanceType}</div>
                    <Link href={`/rental/assets/${item.asset?.id}`} className="font-bold text-[14px] leading-tight hover:underline" style={{ color: 'var(--text-1)' }}>{item.asset?.name}</Link>
                    <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{item.asset?.assetType?.replace(/_/g, ' ')}{item.asset?.plateNumber && ` · ${item.asset.plateNumber}`}</div>
                  </div>
                  <span className={cn('badge text-[10.5px] shrink-0', STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600')}>{item.status.replace('_', ' ')}</span>
                </div>
                <p className="text-[12.5px] mt-2.5 line-clamp-2" style={{ color: 'var(--text-2)' }} title={item.description}>{item.description}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-1)' }}>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                    <div className="flex items-center gap-1">{formatDate(item.scheduledDate)}{over && <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--danger)' }}><AlertTriangle size={10} /> Overdue</span>}</div>
                    {item.vendorName && <div className="truncate max-w-[160px]">{item.vendorName}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Cost</div>
                    <div className="font-bold text-[13px]" style={{ color: 'var(--text-1)' }}>{item.cost != null ? `AED ${Number(item.cost).toLocaleString()}` : '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 mt-2.5">
                  {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && <button onClick={() => setEditItem(item)} className="text-[11px] text-brand-600 hover:underline">Edit</button>}
                  {item.status === 'SCHEDULED' && <button onClick={() => handleStart(item)} className="text-[11px] text-amber-600 hover:underline flex items-center gap-0.5"><PlayCircle size={11} /> Start</button>}
                  {(item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS') && <button onClick={() => setCompleteItem(item)} className="text-[11px] text-green-600 hover:underline flex items-center gap-0.5"><CheckCircle2 size={11} /> Complete</button>}
                </div>
              </div>
            );
          })}
          {items.length === 0 && !loading && (
            <div className="col-span-3 text-center py-16" style={{ color: 'var(--text-3)' }}>
              <Wrench size={32} className="mx-auto mb-3 opacity-40" />No maintenance records found
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {view === 'list' && (
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Asset</th>
              <th className="table-th">Type</th>
              <th className="table-th">Description</th>
              <th className="table-th">Scheduled</th>
              <th className="table-th">Vendor</th>
              <th className="table-th">Status</th>
              <th className="table-th text-right">Cost (AED)</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={cn('table-row', isOverdue(item) && 'bg-red-50/40')}>
                {/* Asset */}
                <td className="table-td">
                  <Link href={`/rental/assets/${item.asset?.id}`}
                    className="font-medium text-gray-900 hover:text-brand-600 block">
                    {item.asset?.name}
                  </Link>
                  <div className="text-xs text-gray-400">
                    {item.asset?.assetType?.replace(/_/g, ' ')}
                    {item.asset?.plateNumber && ` · ${item.asset.plateNumber}`}
                  </div>
                </td>

                {/* Type */}
                <td className="table-td text-gray-600">
                  {TYPE_LABELS[item.maintenanceType] ?? item.maintenanceType}
                </td>

                {/* Description */}
                <td className="table-td max-w-xs">
                  <p className="text-gray-700 truncate" title={item.description}>{item.description}</p>
                  {item.technicianNotes && (
                    <p className="text-xs text-gray-400 truncate" title={item.technicianNotes}>{item.technicianNotes}</p>
                  )}
                </td>

                {/* Scheduled date */}
                <td className="table-td text-gray-600 whitespace-nowrap">
                  {formatDate(item.scheduledDate)}
                  {isOverdue(item) && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mt-0.5">
                      <AlertTriangle size={11} /> Overdue
                    </div>
                  )}
                  {item.completedDate && (
                    <div className="text-xs text-green-600">
                      Done: {formatDate(item.completedDate)}
                    </div>
                  )}
                </td>

                {/* Vendor */}
                <td className="table-td text-gray-600">
                  {item.vendorName || <span className="text-gray-400">—</span>}
                </td>

                {/* Status */}
                <td className="table-td">
                  <span className={cn('badge', STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600')}>
                    {item.status.replace('_', ' ')}
                  </span>
                </td>

                {/* Cost */}
                <td className="table-td text-right text-gray-600">
                  {item.cost != null
                    ? `${Number(item.cost).toLocaleString()}`
                    : <span className="text-gray-400">—</span>}
                </td>

                {/* Actions */}
                <td className="table-td whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {/* Edit — always available unless completed/cancelled */}
                    {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
                      <button onClick={() => setEditItem(item)}
                        className="text-xs text-brand-600 hover:underline">
                        Edit
                      </button>
                    )}
                    {/* Start */}
                    {item.status === 'SCHEDULED' && (
                      <button onClick={() => handleStart(item)}
                        className="text-xs text-amber-600 hover:underline flex items-center gap-0.5">
                        <PlayCircle size={12} /> Start
                      </button>
                    )}
                    {/* Complete */}
                    {(item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS') && (
                      <button onClick={() => setCompleteItem(item)}
                        className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                        <CheckCircle2 size={12} /> Complete
                      </button>
                    )}
                    {/* Cancel */}
                    {(item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS') && (
                      <button onClick={() => handleCancel(item)}
                        className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                        <XCircle size={12} /> Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <Wrench size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400">No maintenance records found</p>
                  <button onClick={() => setShowSchedule(true)}
                    className="mt-3 text-brand-600 text-sm hover:underline">
                    + Schedule your first maintenance
                  </button>
                </td>
              </tr>
            )}

            {loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  <Loader2 size={20} className="animate-spin mx-auto" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {pages} · {total} total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showSchedule && (
        <ScheduleModal onClose={() => setShowSchedule(false)} onSaved={handleSaved} />
      )}
      {editItem && (
        <ScheduleModal initial={editItem} onClose={() => setEditItem(null)} onSaved={handleSaved} />
      )}
      {completeItem && (
        <CompleteModal item={completeItem} onClose={() => setCompleteItem(null)} onDone={handleCompleted} />
      )}
    </div>
  );
}
