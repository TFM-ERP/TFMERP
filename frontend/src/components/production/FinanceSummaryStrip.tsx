'use client';

import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

/**
 * Unified project-finance header band, shared across the finance tabs
 * (Budget vs Actual, Cost Report, Purchasing, Accounting, Cash, Overages).
 * One consistent read of Budget → Committed → Actual → EFC → Variance → Cash.
 * `refreshKey` lets a parent force a re-fetch after it changes data.
 */
export default function FinanceSummaryStrip({ projectId, currency = 'AED', refreshKey = 0 }:
  { projectId: string; currency?: string; refreshKey?: number }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    let live = true;
    productionApi.costing.financeSummary(projectId).then(r => { if (live) setS(r.data); }).catch(() => {});
    return () => { live = false; };
  }, [projectId, refreshKey]);

  if (!s) return null;
  const revised = Number(s.revisedBudget);
  const changed = Math.abs(revised - Number(s.budget)) > 0.01;

  const Cell = ({ label, value, tone, hint }: { label: string; value: any; tone?: string; hint?: string }) => (
    <div className="px-3 py-2 flex-1 min-w-[120px]">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('text-base font-bold', tone || 'text-gray-900')}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400 -mt-0.5">{hint}</p>}
    </div>
  );

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap divide-x divide-gray-100">
        <Cell label="Budget" value={money(s.budget)} hint={changed ? `revised ${money(revised)}` : undefined} />
        <Cell label="Committed" value={money(s.committed)} tone="text-blue-600" />
        <Cell label="Actual" value={money(s.actual)} tone="text-amber-600" />
        <Cell label="Est. Final Cost" value={money(s.efc)} />
        <Cell label="Variance" value={`${s.variance < 0 ? '-' : ''}${money(Math.abs(s.variance))}`} tone={s.variance < -0.01 ? 'text-red-600' : 'text-green-600'} hint="vs revised budget" />
        <Cell label="Cash position" value={money(s.cashPosition)} tone={Number(s.cashPosition) < 0 ? 'text-red-600' : 'text-gray-900'} hint="received − paid" />
      </div>
    </div>
  );
}
