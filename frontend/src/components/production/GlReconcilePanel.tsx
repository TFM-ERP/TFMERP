'use client';
import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { BookCheck, RefreshCw, ArrowRightLeft } from 'lucide-react';

export default function GlReconcilePanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [d, setD] = useState<any>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState(false); const [syncing, setSyncing] = useState(false);
  const load = useCallback(() => { setLoading(true); productionApi.gl.reconcile(projectId).then(r => { setD(r.data); setErr(false); }).catch(() => setErr(true)).finally(() => setLoading(false)); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const sync = async () => { setSyncing(true); try { await productionApi.gl.sync(projectId); await load(); } catch { alert('Could not sync to GL. If the schema isn’t migrated yet, run npm run db:push, then Sync.'); } finally { setSyncing(false); } };
  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><BookCheck size={12} /> General-Ledger Reconciliation</h4>
        <div className="flex gap-2"><button onClick={sync} disabled={syncing} className="btn btn-secondary text-xs py-1.5 px-2"><ArrowRightLeft size={12} className="me-1" />{syncing ? 'Syncing…' : 'Sync to GL'}</button><button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} /></button></div>
      </div>
      {err ? <p className="text-xs text-gray-400">GL bridge not active yet — run <code>npm run db:push</code> to enable, then Sync.</p> :
        !d ? <p className="text-xs text-gray-400">Loading…</p> : (<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p className="text-[10px] text-gray-400 uppercase">Ledger cost (actual)</p><p className="text-base font-bold text-gray-900">{money(d.ledgerCost)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Ledger income</p><p className="text-base font-bold text-gray-900">{money(d.ledgerIncome)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Posted to GL</p><p className="text-base font-bold text-green-600">{d.postedCount}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Unposted</p><p className={cn('text-base font-bold', d.unpostedCount ? 'text-amber-600' : 'text-gray-400')}>{d.unpostedCount} · {money(d.unpostedAmount)}</p></div>
          </div>
          <div className="mt-2">{d.inBalance ? <span className="badge bg-green-100 text-green-700 text-[11px]">✓ Project ledger ties to the GL</span> : <span className="badge bg-amber-50 text-amber-700 text-[11px]">{d.unpostedCount} actual(s) not yet mirrored — click Sync to GL</span>}</div>
        </>)}
    </div>
  );
}
