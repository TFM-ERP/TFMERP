'use client';

import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, Search } from 'lucide-react';
import { auditApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const ACTION_CLS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700', UPDATE: 'bg-blue-50 text-blue-700', DELETE: 'bg-red-50 text-red-600', APPROVE: 'bg-amber-50 text-amber-700', EXPORT: 'bg-gray-100 text-gray-600',
};
const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuditLogPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');

  const load = () => {
    setLoading(true);
    auditApi.list({ entity: entity || undefined, action: action || undefined, limit: 200 })
      .then(r => { setItems(r.data.items || []); setTotal(r.data.total || 0); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [entity, action]); // eslint-disable-line

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><ScrollText size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Security</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Audit Log</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Every create, update and delete across the system — {total.toLocaleString()} entries.</p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Filter by module (e.g. production/budget, finance/invoices)…" value={entity} onChange={e => setEntity(e.target.value)} />
        </div>
        <select className="input w-40" value={action} onChange={e => setAction(e.target.value)}>
          <option value="">All actions</option><option value="Created">Created</option><option value="Updated">Updated</option><option value="Deleted">Deleted</option>
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          items.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No activity logged yet.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">When</th><th className="px-3 py-2.5 text-left">User</th>
                <th className="px-3 py-2.5 text-left">Action</th><th className="px-3 py-2.5 text-left">Module</th><th className="px-3 py-2.5 text-left">Record</th>
              </tr></thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmt(a.createdAt)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{a.user?.fullName || '—'}{a.user?.role ? <span className="text-[11px] text-gray-400"> · {a.user.role}</span> : ''}</td>
                    <td className="px-3 py-2.5"><span className={cn('badge text-[11px]', ACTION_CLS[a.action] || 'bg-gray-100 text-gray-600')}>{a.action}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{a.resource}</td>
                    <td className="px-3 py-2.5 text-gray