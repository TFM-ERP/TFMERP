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

// Token-bound KPI tile (theme-aware in all 8 themes), with hover lift.
function Kpi({ icon: Icon, label, value, fg }: { icon: any; label: string; value: string; fg?: string }) {
  return (
    <div className="rounded-xl p-4 transition-all" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.07)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: fg || 'var(--text-3)' }} />
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
      </div>
      <p className="text-lg font-bold" style={{ color: fg || 'var(--text-1)' }}>{value}</p>
    </div>
  );
}

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

  const th = 'px-3 py-2.5';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Production · Overview</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Production Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{data?.totalProjects ?? 0} projects · combined &amp; per-project financials.</p>
        </div>
        <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {/* Role view selector */}
      <div className="flex flex-wrap gap-1 mb-5">
        {ROLE_VIEWS.map(v => {
          const on = role === v.key;
          return (
            <button key={v.key} onClick={() => setRole(v.key)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent-soft-text)' : 'var(--text-3)' }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Role-specific operational widgets */}
      {role && roleData?.view === 'finance' && <FinanceOpsWidget finance={roleData.finance} />}
      {role && roleData?.view === 'coordination' && <CoordinationWidget coordination={roleData.coordination} />}

      {/* Combined KPIs — 2-up phone, 3-up tablet, 5-up desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Kpi icon={Layers} label="Total Budget" value={fmt(c.budget)} />
        <Kpi icon={DollarSign} label="Revenue" value={fmt(c.income)} fg="var(--ok)" />
        <Kpi icon={TrendingDown} label="Costs" value={fmt(c.cost)} fg="var(--warn)" />
        <Kpi icon={c.net >= 0 ? TrendingUp : TrendingDown} label="Net P&L" value={fmt(Math.abs(c.net))} fg={c.net >= 0 ? 'var(--ok)' : 'var(--danger)'} />
        <Kpi icon={Wallet} label="Cash Position" value={fmt(c.cash)} fg={c.cash >= 0 ? undefined : 'var(--danger)'} />
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
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-1)' }}><h3 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Projects</h3></div>
        {loading ? <div className="p-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading…</div> :
          projects.length === 0 ? <div className="p-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>No projects yet.</div> : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead><tr className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border-1)' }}>
                <th className="px-5 py-2.5 text-start">Project</th><th className={th + ' text-start'}>Status</th>
                <th className={th + ' text-end'}>Budget</th><th className={th + ' text-end'}>Revenue</th>
                <th className={th + ' text-end'}>Cost</th><th className={th + ' text-end'}>Net</th>
                <th className={th + ' text-start w-28'}>Spent</th><th className="px-5 py-2.5"></th>
              </tr></thead>
              <tbody>
                {projects.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-1)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <td className="px-5 py-3">
                      <Link href={`/production/projects/${p.id}`} className="font-medium" style={{ color: 'var(--text-1)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-1)'; }}>{p.title}</Link>
                      <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{p.projectNumber}{p.client ? ` · ${p.client}` : ''}</div>
                    </td>
                    <td className="px-3 py-3"><span className={cn('badge text-[11px]', STATUS_CLS[p.status] || 'bg-gray-100 text-gray-600')}>{p.status.replace(/_/g, ' ')}</span></td>
                    <td className="px-3 py-3 text-end" style={{ color: 'var(--text-2)' }}>{fmt(p.budget, p.currency)}</td>
                    <td className="px-3 py-3 text-end" style={{ color: 'var(--ok)' }}>{fmt(p.income, p.currency)}</td>
                    <td className="px-3 py-3 text-end" style={{ color: 'var(--warn)' }}>{fmt(p.cost, p.currency)}</td>
                    <td className="px-3 py-3 text-end font-medium" style={{ color: p.net >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(p.net, p.currency)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(p.spentPct, 100)}%`, background: p.spentPct > 100 ? 'var(--danger)' : p.spentPct > 85 ? 'var(--warn)' : 'var(--ok)' }} />
                        </div>
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>{p.spentPct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-end"><Link href={`/production/projects/${p.id}`} className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>Open <ArrowRight size={12} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
      </div>
      <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>Combined totals may span multiple currencies; per-project figures use each project's currency.</p>
    </div>
  );
}
