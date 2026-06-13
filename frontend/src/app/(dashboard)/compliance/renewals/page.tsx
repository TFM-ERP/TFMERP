'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, RefreshCw, Search, AlertTriangle, ArrowRight, Building2, Truck, Users } from 'lucide-react';
import { complianceApi } from '@/lib/api';

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  expired:  { label: 'Expired',     bg: 'bg-red-50',    text: 'text-red-700',    dot: '#dc2626' },
  critical: { label: '≤ 30 days',   bg: 'bg-orange-50', text: 'text-orange-700', dot: '#ea580c' },
  warning:  { label: '≤ 60 days',   bg: 'bg-amber-50',  text: 'text-amber-700',  dot: '#d97706' },
  upcoming: { label: '≤ 90 days',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: '#2563eb' },
  ok:       { label: 'Valid',       bg: 'bg-gray-50',   text: 'text-gray-500',   dot: '#9ca3af' },
};
const CAT_ICON: Record<string, any> = { Company: Building2, Fleet: Truck, HR: Users };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RenewalsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('attention'); // attention = not ok

  const load = () => {
    setLoading(true);
    complianceApi.renewals().then(r => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const items = data?.items || [];
  const summary = data?.summary || {};

  const filtered = useMemo(() => {
    return items.filter((it: any) => {
      if (statusFilter === 'attention' && it.status === 'ok') return false;
      if (statusFilter !== 'attention' && statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (cat && it.category !== cat) return false;
      if (q) {
        const s = `${it.entityName} ${it.documentType} ${it.reference || ''}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, statusFilter, cat, q]);

  const tiles = [
    { key: 'expired', n: summary.expired || 0 },
    { key: 'critical', n: summary.critical || 0 },
    { key: 'warning', n: summary.warning || 0 },
    { key: 'upcoming', n: summary.upcoming || 0 },
  ];

  return (
    <div className="p-6 max-w-[1700px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><ShieldCheck size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Compliance · Expiry</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Renewals &amp; Document Expiry</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Trade licence, vehicle registration, insurance, visas, Emirates ID, passports — all in one place.</p>
          </div>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {/* Status tiles (clickable filters) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(t => {
          const m = STATUS_META[t.key];
          const on = statusFilter === t.key;
          return (
            <button key={t.key} onClick={() => setStatusFilter(on ? 'attention' : t.key)}
              className={`text-left rounded-xl p-4 border transition-all ${on ? 'border-brand-300 ring-1 ring-brand-200' : 'border-gray-200'} ${m.bg}`}>
              <div className={`text-2xl font-bold ${m.text}`}>{t.n}</div>
              <div className={`text-xs font-medium ${m.text}`}>{m.label}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search by name, document, reference…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-44" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All categories</option>
          <option value="Company">Company</option>
          <option value="Fleet">Fleet</option>
          <option value="HR">Employees</option>
          <option value="Crew">Crew</option>
        </select>
        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="attention">Needs attention</option>
          <option value="all">Show all</option>
          <option value="expired">Expired only</option>
          <option value="critical">≤ 30 days</option>
          <option value="warning">≤ 60 days</option>
          <option value="upcoming">≤ 90 days</option>
        </select>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <ShieldCheck size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nothing needs attention here. You're all up to date.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Document</th>
                <th className="px-3 py-2.5 text-left">Belongs to</th>
                <th className="px-3 py-2.5 text-left">Expiry</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-5 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it: any) => {
                const m = STATUS_META[it.status];
                const Icon = CAT_ICON[it.category] || Building2;
                return (
                  <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{it.documentType}</div>
                      {it.reference && <div className="text-xs text-gray-400">{it.reference}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Icon size={13} className="text-gray-400" /> {it.entityName}
                      </div>
                      <div className="text-[11px] text-gray-400">{it.category}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {fmtDate(it.expiryDate)}
                      <div className="text-[11px] text-gray-400">
                        {it.daysLeft < 0 ? `${Math.abs(it.daysLeft)} days ago` : `in ${it.daysLeft} days`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full ${m.bg} ${m.text}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} /> {m.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {it.link && <Link href={it.link} className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-xs">Open <ArrowRight size={12} /></Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <AlertTriangle size={12} /> Items are pulled live from company documents, fleet registrations, insurance policies and staff records.
      </p>
    </div>
  );
}
