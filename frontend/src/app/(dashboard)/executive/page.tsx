'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, RefreshCw, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Film, Users, Package, Truck, CheckSquare, ArrowRight, Landmark } from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

const m = (n: any) => formatCurrency(n || 0);

export default function ExecutivePage() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); dashboardApi.executive().then(r => setD(r.data)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const fin = d?.finance, prod = d?.production, ppl = d?.people, inv = d?.inventory, rent = d?.rentals, ops = d?.ops;

  const Tile = ({ label, value, sub, icon: Icon, color, href }: any) => {
    const inner = (
      <div className="card h-full">
        <div className="flex items-center gap-2 mb-1"><Icon size={15} className={color || 'text-gray-400'} /><p className="text-xs text-gray-400">{label}</p></div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    );
    return href ? <Link href={href} className="block hover:opacity-90">{inner}</Link> : inner;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><LayoutDashboard size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Workspace · Leadership</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Executive Dashboard</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Company‑wide snapshot across finance, production, people and operations.</p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {loading && !d ? <div className="card p-12 text-center text-gray-400 text-sm">Loading…</div> : (
        <div className="space-y-6">
          {/* Finance */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Finance</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Tile label="Revenue YTD" value={m(fin?.revenueYtd)} icon={DollarSign} color="text-green-500" />
              <Tile label="AR Outstanding" value={m(fin?.arOutstanding)} icon={Landmark} href="/finance/invoices" />
              <Tile label="Overdue" value={m(fin?.overdueAmount)} sub={`${fin?.overdueCount || 0} invoices`} icon={AlertTriangle} color="text-red-500" href="/finance/collections" />
              <Tile label="Payments (30d)" value={m(fin?.paymentsLast30)} icon={TrendingUp} color="text-green-500" />
              <Tile label="Expenses (MTD)" value={m(fin?.expensesMtd)} icon={TrendingDown} color="text-amber-500" href="/finance/expenses" />
            </div>
          </div>

          {/* Production */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Production</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Tile label="Active projects" value={prod?.activeProjects ?? 0} sub={`${prod?.totalProjects || 0} total`} icon={Film} href="/production/dashboard" />
              <Tile label="Total budget" value={m(prod?.totalBudget)} icon={DollarSign} />
              <Tile label="Revenue" value={m(prod?.revenue)} icon={TrendingUp} color="text-green-500" />
              <Tile label="Cost" value={m(prod?.cost)} icon={TrendingDown} color="text-amber-500" />
              <Tile label="Net P&L" value={m(prod?.net)} icon={prod?.net >= 0 ? TrendingUp : TrendingDown} color={prod?.net >= 0 ? 'text-green-500' : 'text-red-500'} />
            </div>
          </div>

          {/* Operations */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Operations &amp; People</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Tile label="Pending approvals" value={ops?.pendingApprovals ?? 0} icon={CheckSquare} color="text-amber-500" href="/finance/approvals" />
              <Tile label="Employees" value={ppl?.headcount ?? 0} icon={Users} href="/hr/employees" />
              <Tile label="Crew" value={ppl?.crew ?? 0} icon={Users} href="/production/crew" />
              <Tile label="Fleet assets" value={rent?.assets ?? 0} icon={Truck} href="/rental/assets" />
              <Tile label="Stock value" value={m(inv?.stockValue)} sub={`${inv?.items || 0} items`} icon={Package} href="/inventory" />
              <Tile label="Low stock" value={inv?.lowStock ?? 0} icon={AlertTriangle} color={inv?.lowStock ? 'text-amber-500' : 'text-gray-400'} href="/inventory" />
            </div>
          </div>

          {/* Top debtors */}
          {d?.topDebtors?.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Top outstanding clients</h2>
                <Link href="/finance/collections" className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">Collections <ArrowRight size={12} /></Link>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {d.topDebtors.map((t: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{t.client}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{m(t.due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
