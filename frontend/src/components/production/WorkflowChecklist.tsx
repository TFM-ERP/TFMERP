'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Circle, Lock, ArrowRight, ListChecks, RefreshCw, Banknote, LockKeyhole } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { PanelHeader } from './ui';

export default function WorkflowChecklist({ projectId, onNavigate }: { projectId: string; onNavigate?: (tab: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.projects.workflow(projectId).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-gray-400">Loading workflow…</div>;
  if (!data) return null;

  const pct = data.total ? Math.round((data.completed / data.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <PanelHeader
        icon={ListChecks}
        title="Production Workflow"
        subtitle="The standard production order. Follow it top-to-bottom; steps unlock as their prerequisites are met."
        actions={<>
          <span className="text-xs text-gray-400">{data.completed}/{data.total} done</span>
          <button onClick={load} className="text-gray-300 hover:text-gray-500"><RefreshCw size={13} /></button>
        </>}
      />

      {/* progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ol className="space-y-1">
        {data.steps.map((s: any, i: number) => {
          const isNext = data.next === s.key;
          const Icon = s.done ? CheckCircle2 : !s.available ? Lock : Circle;
          return (
            <li key={s.key}>
              <button
                onClick={() => onNavigate?.(s.tab)}
                className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                  isNext ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-gray-50')}>
                <span className="text-[10px] font-mono text-gray-300 w-4 shrink-0">{i + 1}</span>
                <Icon size={16} className={cn('shrink-0', s.done ? 'text-green-500' : !s.available ? 'text-gray-300' : isNext ? 'text-brand-600' : 'text-gray-300')} />
                <span className={cn('flex-1 text-sm', s.done ? 'text-gray-500 line-through decoration-gray-300' : !s.available ? 'text-gray-400' : 'text-gray-800')}>
                  {s.label}
                  {s.hint && <span className="ml-2 text-[10px] text-gray-400">{s.hint}</span>}
                  {!s.available && s.blockedBy && <span className="ml-2 text-[10px] text-amber-600">needs: {s.blockedBy}</span>}
                </span>
                {isNext && <span className="text-[10px] font-semibold text-brand-600 inline-flex items-center gap-0.5 shrink-0">Next <ArrowRight size={11} /></span>}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Accounting status strip */}
      {data.accounting && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 flex-wrap text-xs">
          <button onClick={() => onNavigate?.('accounting')} className="inline-flex items-center gap-1.5 text-gray-600 hover:text-brand-600">
            <Banknote size={13} className={data.accounting.openPayables > 0 ? 'text-amber-500' : 'text-gray-400'} />
            <span>Open payables: <b className={data.accounting.openPayables > 0 ? 'text-amber-700' : 'text-gray-700'}>{formatCurrency(data.accounting.openPayables, data.accounting.currency)}</b></span>
            {data.accounting.openCount > 0 && <span className="text-gray-400">({data.accounting.openCount})</span>}
          </button>
          <span className="inline-flex items-center gap-1.5 text-gray-600">
            <LockKeyhole size={13} className={data.accounting.periodClosed ? 'text-red-500' : 'text-green-500'} />
            <span>Period {data.accounting.currentPeriod}: <b className={data.accounting.periodClosed ? 'text-red-600' : 'text-green-700'}>{data.accounting.periodClosed ? 'CLOSED' : 'OPEN'}</b></span>
          </span>
        </div>
      )}
    </div>
  );
}
