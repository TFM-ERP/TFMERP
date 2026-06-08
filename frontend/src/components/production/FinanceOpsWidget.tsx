'use client';

import Link from 'next/link';
import { TrendingDown, AlertTriangle, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

/**
 * Line Producer / Finance Manager widget: portfolio EFC variance + pending budget transfers.
 * Data from getDashboard(role) → finance.
 */
export default function FinanceOpsWidget({ finance }: { finance: any }) {
  if (!finance) return null;
  const t = finance.totals || { budget: 0, actual: 0, committed: 0, efc: 0, variance: 0 };
  const money = (n: number, cur = 'AED') => formatCurrency(n || 0, cur);
  const rows: any[] = finance.projects || [];
  const transfers: any[] = finance.pendingTransfers || [];

  return (
    <div className="space-y-4 mb-6">
      {/* EFC variance KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[['Budget', t.budget, 'text-gray-900'], ['Actual', t.actual, 'text-amber-600'], ['Committed', t.committed, 'text-blue-600'], ['Est. Final Cost', t.efc, 'text-gray-900']].map(([l, v, c]: any) => (
          <div key={l} className="card"><p className="text-xs text-gray-400">{l}</p><p className={cn('text-lg font-bold', c)}>{money(v)}</p></div>
        ))}
        <div className={cn('card', t.variance < 0 ? 'ring-1 ring-red-200' : '')}>
          <p className="text-xs text-gray-400">Variance (EFC)</p>
          <p className={cn('text-lg font-bold', t.variance < 0 ? 'text-red-600' : 'text-green-600')}>{t.variance < 0 ? '-' : ''}{money(Math.abs(t.variance))}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Projects by variance (worst first) */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5"><TrendingDown size={13} className="text-gray-400" /><h3 className="text-sm font-semibold text-gray-700">EFC variance by project</h3></div>
          {rows.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">No active budgets.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100"><th className="px-4 py-2 text-left">Project</th><th className="px-3 py-2 text-right">EFC</th><th className="px-3 py-2 text-right">Variance</th></tr></thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.id} className={cn('border-b border-gray-50', p.overBudget && 'bg-red-50/40')}>
                    <td className="px-4 py-2"><Link href={`/production/projects/${p.id}`} className="text-gray-800 hover:text-brand-600 font-medium">{p.title}</Link><div className="text-[10px] text-gray-400">{p.projectNumber}</div></td>
                    <td className="px-3 py-2 text-right text-gray-700">{money(p.efc, p.currency)}</td>
                    <td className={cn('px-3 py-2 text-right font-medium whitespace-nowrap', p.variance < 0 ? 'text-red-600' : 'text-gray-500')}>{p.overBudget && <AlertTriangle size={10} className="inline mr-0.5" />}{p.variance < 0 ? '-' : ''}{money(Math.abs(p.variance), p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending budget transfers */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5"><ArrowLeftRight size={13} className="text-gray-400" /><h3 className="text-sm font-semibold text-gray-700">Budget transfers awaiting approval{finance.pendingTransferCount > 0 ? ` (${finance.pendingTransferCount})` : ''}</h3></div>
          {transfers.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">Nothing waiting for approval.</div> : (
            <ul className="divide-y divide-gray-50">
              {transfers.map(tr => (
                <li key={tr.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="text-gray-800 truncate">{tr.fromCode} → {tr.toCode} <span className="font-medium">{money(Number(tr.amount))}</span></div>
                    <div className="text-[11px] text-gray-400 truncate">{tr.project?.title || ''} · {tr.reason || 'no reason given'}</div>
                  </div>
                  <Link href={`/production/projects/${tr.projectId}?tab=costreport`} className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-xs shrink-0 ml-2">Review <ArrowRight size={12} /></Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">EFC = Actual + ETC (manual override, else remaining PO commitments). Variance = Budget − EFC. Combined KPIs may span currencies.</p>
    </div>
  );
}
