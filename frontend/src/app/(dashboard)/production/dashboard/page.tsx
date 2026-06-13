'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Film, RefreshCw, TrendingUp, TrendingDown, Wallet, DollarSign, Layers, ArrowRight } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import FinanceOpsWidget from '@/components/production/FinanceOpsWidget';
import CoordinationWidget from '@/components/production/CoordinationWidget';

const ROLE_VIEWS = [
  { key: '', label: 'Overview' },
  { key: 'LINE_PRODUCER', label: 'Line Producer / Finance' },
  { key: 'PRODUCTION_COORDINATOR', label: '2nd AD / Coordinator' },
];

const STATUS_CLS: Record<string, string> = {
  DEVELOPMENT: 'bg-gray-100 text-gray-600', PRE_PRODUCTION: 'bg-blue-100 text-blue-700',
  PRODUCTION: 'bg-yellow-100 text-yellow-700', POST_PRODUCTION: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-600',
};

// Combined figures may mix currencies; show in AED-style grouping without forcing a symbol per row.
const fmt = (n: number, cur = 'USD') => formatCurrency(n || 0, cur);

export default function ProductionDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [roleData, setRoleData] = useState<any>(null);

  const load = () => {
    setLoading(true);
    productionApi.ledger.portfolio().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  // Role-specific operational view (finance EFC/transfers, or AD paperwork/call sheet)
  useEffect(() => {
    if (!role) { setRoleData(null); return; }
    productionApi.dashboard(role).then(r => setRoleData(r.data)).catch(() => setRoleData(null));
  }, [role]);

  const c = data?.combined || { budget: 0, income: 0, cost: 0, net: 0, cash: 0 };
  const projects = data?.projects || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Film size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Production · Overview</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Production Dashboard</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>{data?.totalProjects ?? 0} projects · combined &amp; per-project financials.</p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {/* Role view selector */}
      <div className="flex gap-1 mb-5">
        {ROLE_VIEWS.map(v => (
          <button key={v.key} onClick={() => setRole(v.key)}
            className={cn('text-xs px-3 py-1.5 rounded-lg', role === v.key ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-500 hover:bg-gray-50')}>{v.label}</button>
        ))}
      </div>

      {/* Role-specific operational widgets */}
      {role && roleData?.view === 'finance' && <FinanceOpsWidget finance={roleData.finance} />}
      {role && roleData?.view === 'coordination' && <CoordinationWidget coordination={roleData.coordination} />}

      {/* Combined KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="card"><div className="flex items-center gap-2 mb-1"><Layers size={14} className="text-gray-400" /><p className="text-xs text-gray-400">Total Budget</p></div><p className="text-lg font-bold text-gray-900">{fmt(c.budget)}</p></div>
        <div className="card"><div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-green-500" /><p className="text-xs text-gray-400">Revenue</p></div><p className="text-lg font-bold text-green-600">{fmt(c.income)}</p></div>
        <div className="card"><div className="flex items-center gap-2 mb-1"><TrendingDown size={14} className="text-amber-500" /><p className="text-xs text-gray-400">Costs</p></div><p className="text-lg font-bold text-amber-600">{fmt(c.cost)}</p></div>
        <div className="card"><div className="flex items-center gap-2 mb-1">{c.net >= 0 ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}<p className="text-xs text-gray-400">Net P&amp;L</p></div><p className={cn('text-lg font-bold', c.net >= 0 ? 'text-green-600' : 'text-red-600')}>{fmt(Math.abs(c.net))}</p></div>
        <div className="card"><div className="flex items-center gap-2 mb-1"><Wallet size={14} className="text-gray-400" /><p className="text-xs text-gray-400">Cash Position</p></div><p className={cn('text-lg font-bold', c.cash >= 0 ? 'text-gray-900' : 'text-red-600')}>{fmt(c.cash)}</p></div>
      </div>

      {/* Status chips */}
      {data?.byStatus && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(data.byStatus).map(([s, n]: any) => (
            <span key={s} className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STATUS_CLS[s] || 'bg-gray-100 text-gray-600')}>{s.replace(/_/g, ' ')}: {n}</span>
          ))}
        </div>
      )}

      {/* Per-project table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Projects</h3></div>
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          projects.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No projects yet.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Project</th><th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-right">Budget</th><th className="px-3 py-2.5 text-right">Revenue</th>
                <th className="px-3 py-2.5 text-right">Cost</th><th className="px-3 py-2.5 text-right">Net</th>
                <th className="px-3 py-2.5 text-left w-28">Spent</th><th className="px-5 py-2.5"></th>
              </tr></thead>
              <tbody>
                {projects.map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/production/projects/${p.id}`} className="font-medium text-gray-800 hover:text-brand-600">{p.title}</Link>
                      <div className="text-[11px] text-gray-400">{p.projectNumber}{p.client ? ` · ${p.client}` : ''}</div>
                    </td>
                    <td className="px-3 py-3"><span className={cn('badge text-[11px]', STATUS_CLS[p.status] || 'bg-gray-100 text-gray-600')}>{p.status.replace(/_/g, ' ')}</span></td>
                    <td className="px-3 py-3 text-right text-gray-700">{fmt(p.budget, p.currency)}</td>
                    <td className="px-3 py-3 text-right text-green-600">{fmt(p.income, p.currency)}</td>
                    <td className="px-3 py-3 text-right text-amber-600">{fmt(p.cost, p.currency)}</td>
                    <td className={cn('px-3 py-3 text-right font-medium', p.net >= 0 ? 'text-green-600' : 'text-red-600')}>{fmt(p.net, p.currency)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', p.spentPct > 100 ? 'bg-red-500' : p.spentPct > 85 ? 'bg-amber-500' : 'bg-green-500')} style={{ width: `${Math.min(p.spentPct, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 tabular-nums">{p.spentPct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right"><Link href={`/production/projects/${p.id}`} className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-xs">Open <ArrowRight size={12} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">Combined totals may span multiple currencies; per-project figures use each project's currency.</p>
    </div>
  );
}
