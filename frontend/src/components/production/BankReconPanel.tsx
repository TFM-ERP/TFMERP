'use client';
import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Plus, RefreshCw, Landmark, CheckSquare, Square, Lock } from 'lucide-react';
export default function BankReconPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [list, setList] = useState<any[]>([]); const [sel, setSel] = useState<any>(null); const [err, setErr] = useState(false);
  const [nf, setNf] = useState<any>({ statementBalance: '', openingBalance: '' });
  const loadList = useCallback(() => { productionApi.bankRecon.list(projectId).then(r => { setList(r.data || []); setErr(false); }).catch(() => setErr(true)); }, [projectId]);
  useEffect(() => { loadList(); }, [loadList]);
  const open = async (id: string) => { const r = await productionApi.bankRecon.get(id); setSel(r.data); };
  const create = async () => { if (nf.statementBalance === '') return; const r = await productionApi.bankRecon.create({ projectId, statementBalance: Number(nf.statementBalance), openingBalance: Number(nf.openingBalance || 0) }); setNf({ statementBalance: '', openingBalance: '' }); loadList(); open(r.data.id); };
  const toggle = async (txnId: string) => { if (!sel) return; await productionApi.bankRecon.toggle(sel.id, txnId); open(sel.id); };
  const finalize = async () => { if (!sel) return; await productionApi.bankRecon.finalize(sel.id); open(sel.id); loadList(); };
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Landmark size={12} /> Bank Reconciliation (project)</h4><button onClick={loadList} className="btn btn-secondary p-1.5"><RefreshCw size={13} /></button></div>
      {err ? <p className="text-xs text-gray-400">Not active yet — run <code>npm run db:push</code> to enable.</p> : (<>
        {!sel ? (<>
          <div className="grid grid-cols-3 gap-2 mb-3"><input type="number" className="input text-sm h-9" placeholder="Statement balance" value={nf.statementBalance} onChange={e => setNf((x: any) => ({ ...x, statementBalance: e.target.value }))} /><input type="number" className="input text-sm h-9" placeholder="Opening balance" value={nf.openingBalance} onChange={e => setNf((x: any) => ({ ...x, openingBalance: e.target.value }))} /><button onClick={create} className="btn btn-primary"><Plus size={14} className="me-1" />New rec</button></div>
          {list.length === 0 ? <p className="text-xs text-gray-400">No reconciliations yet.</p> : <div className="space-y-1">{list.map(r => (<button key={r.id} onClick={() => open(r.id)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 text-sm"><span className="text-gray-700">{r.statementDate ? new Date(r.statementDate).toLocaleDateString('en-GB') : '—'} · stmt {money(r.statementBalance)}</span><span className={cn('badge text-[11px]', r.status === 'RECONCILED' ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700')}>{r.status}</span></button>))}</div>}
        </>) : (<>
          <button onClick={() => setSel(null)} className="text-xs text-brand-600 mb-2">← All reconciliations</button>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            <div><p className="text-[10px] text-gray-400 uppercase">Statement</p><p className="text-base font-bold">{money(sel.statementBalance)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Cleared</p><p className="text-base font-bold">{money(sel.clearedTotal)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Book balance</p><p className="text-base font-bold">{money(sel.bookBalance)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Difference</p><p className={cn('text-base font-bold', sel.reconciled ? 'text-green-600' : 'text-amber-600')}>{money(sel.difference)}</p></div>
          </div>
          <div className="mb-2">{sel.reconciled ? <span className="badge bg-green-100 text-green-700 text-[11px]">✓ Reconciled</span> : <button onClick={finalize} className="btn btn-secondary text-xs py-1 px-2"><Lock size={11} className="me-1" />Mark reconciled</button>}</div>
          {(sel.rows || []).length === 0 ? <p className="text-xs text-gray-400">No PAID disbursements to clear.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{sel.rows.map((t: any) => (<tr key={t.id} className="border-t border-gray-50"><td className="py-1.5"><button onClick={() => toggle(t.id)} className={t.cleared ? 'text-green-600' : 'text-gray-300'}>{t.cleared ? <CheckSquare size={15} /> : <Square size={15} />}</button></td><td className="py-1.5 text-xs text-gray-500">{t.date ? new Date(t.date).toLocaleDateString('en-GB') : ''}</td><td className="py-1.5 text-xs text-gray-700">{t.party || t.description || '—'}</td><td className="py-1.5 text-end font-medium">{money(t.total)}</td></tr>))}</tbody></table></div>
          )}
        </>)}
      </>)}
    </div>
  );
}
