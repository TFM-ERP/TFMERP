'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Wallet, TrendingUp, RefreshCw, ArrowDownLeft, ArrowUpRight, Lock, CloudOff, ScanLine, Loader2 } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useOfflineSync } from '@/lib/useOfflineSync';
import OfflineSyncBar from './OfflineSyncBar';

const wk = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

export default function CashPanel({ projectId, currency = 'AED', accounts = [] }:
  { projectId: string; currency?: string; accounts?: { code: string; title: string }[] }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [view, setView] = useState<'forecast' | 'petty'>('forecast');

  // forecast
  const [cf, setCf] = useState<any>(null);
  // petty
  const [floats, setFloats] = useState<any[]>([]);
  const [selFloat, setSelFloat] = useState<string | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFloat, setAddingFloat] = useState(false);
  const [float, setFloat] = useState<any>({ holder: '', openingAmount: '', notes: '' });
  const [entry, setEntry] = useState<any>({ type: 'SPEND', date: new Date().toISOString().slice(0, 10), description: '', costCenterCode: '', amount: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productionApi.costing.cashflow(projectId), productionApi.costing.floats(projectId)])
      .then(([c, f]) => { setCf(c.data); setFloats(f.data || []); }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  const refreshTxns = useCallback(() => { if (selFloat) productionApi.costing.pettyTxns(selFloat).then(r => setTxns(r.data || [])).catch(() => {}); }, [selFloat]);
  // Offline queue (Petty Cash works with no connection; spends sync on reconnection)
  const sync = useOfflineSync(() => { load(); refreshTxns(); });
  useEffect(() => { load(); }, [load]);
  useEffect(() => { refreshTxns(); }, [refreshTxns]);

  const saveFloat = async () => {
    if (!float.holder) return;
    await productionApi.costing.createFloat({ projectId, currency, holder: float.holder, openingAmount: Number(float.openingAmount) || 0, notes: float.notes });
    setAddingFloat(false); setFloat({ holder: '', openingAmount: '', notes: '' }); load();
  };
  const addEntry = async () => {
    if (!selFloat || !entry.amount) return;
    const acct = accounts.find(a => a.code === entry.costCenterCode);
    const data = { ...entry, amount: Number(entry.amount), costCenterTitle: acct?.title };
    const reset = () => setEntry({ type: 'SPEND', date: new Date().toISOString().slice(0, 10), description: '', costCenterCode: '', amount: '' });

    if (!sync.online) {
      // Offline: persist to the device queue + show optimistically; syncs on reconnection.
      const id = await sync.queuePetty(selFloat, data, `Petty ${data.type.toLowerCase()} ${money(data.amount)}${data.description ? ` · ${data.description}` : ''}`);
      setTxns(t => [{ id, ...data, _offline: true }, ...t]);
      reset();
      return;
    }
    try {
      await productionApi.costing.addPettyTxn(selFloat, data);
      reset(); refreshTxns(); load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not record this entry.');
    }
  };

  // V1.2: scan a receipt → AI pre-fills the SPEND form for review (never auto-posts).
  const [scanning, setScanning] = useState(false);
  const scanReceipt = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !selFloat) return;
    setScanning(true);
    try {
      const r = await productionApi.costing.scanReceipt(selFloat, file);
      const d = r.data?.draft || {};
      setEntry((f: any) => ({
        ...f, type: 'SPEND', amount: d.amount ? String(d.amount) : f.amount,
        description: d.description || f.description, date: d.date || f.date,
      }));
      const conf = Math.round((d.confidence || 0) * 100);
      alert(`Receipt read (confidence ${conf}%). Review the pre-filled amount & description, set a cost center, then Record.`);
    } catch (err: any) { alert(err?.response?.data?.message || 'Receipt scan failed.'); }
    finally { setScanning(false); }
  };
  const delEntry = async (id: string) => { await productionApi.costing.removePettyTxn(id); if (selFloat) productionApi.costing.pettyTxns(selFloat).then(r => setTxns(r.data || [])); load(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setView('forecast')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'forecast' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Cash Flow</button>
          <button onClick={() => setView('petty')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'petty' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Petty Cash</button>
        </div>
        <button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {/* ── Cash Flow forecast ── */}
      {view === 'forecast' && (
        <>
          {cf && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card"><p className="text-xs text-gray-400">Inflow (actual)</p><p className="text-lg font-bold text-green-600">{money(cf.totals.inflow)}</p></div>
              <div className="card"><p className="text-xs text-gray-400">Outflow (actual)</p><p className="text-lg font-bold text-amber-600">{money(cf.totals.outflow)}</p></div>
              <div className="card"><p className="text-xs text-gray-400">Forecast out (open POs)</p><p className="text-lg font-bold text-blue-600">{money(cf.totals.forecastOut)}</p></div>
              <div className="card"><p className="text-xs text-gray-400 flex items-center gap-1"><Wallet size={11} /> Closing cash</p><p className={cn('text-lg font-bold', cf.closingCash >= 0 ? 'text-gray-900' : 'text-red-600')}>{money(cf.closingCash)}</p></div>
            </div>
          )}
          <div className="card overflow-hidden p-0">
            {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
              !cf || cf.rows.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No cash movements yet.</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left">Week of</th><th className="px-3 py-2.5 text-right">Inflow</th>
                    <th className="px-3 py-2.5 text-right">Outflow</th><th className="px-3 py-2.5 text-right">Forecast out</th>
                    <th className="px-3 py-2.5 text-right">Net</th><th className="px-3 py-2.5 text-right">Cumulative</th>
                  </tr></thead>
                  <tbody>
                    {cf.rows.map((r: any) => (
                      <tr key={r.week} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-gray-600">{wk(r.week)}</td>
                        <td className="px-3 py-2 text-right text-green-600">{r.inflow ? money(r.inflow) : '—'}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{r.outflow ? money(r.outflow) : '—'}</td>
                        <td className="px-3 py-2 text-right text-blue-600">{r.forecastOut ? money(r.forecastOut) : '—'}</td>
                        <td className={cn('px-3 py-2 text-right font-medium', r.net >= 0 ? 'text-gray-800' : 'text-red-600')}>{money(r.net)}</td>
                        <td className={cn('px-3 py-2 text-right font-semibold', r.cumulative >= 0 ? 'text-gray-900' : 'text-red-600')}>{money(r.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
          <p className="text-[11px] text-gray-400">Inflow/outflow are recognised income &amp; costs by week; forecast‑out is remaining open purchase‑order commitments at their expected date.</p>
        </>
      )}

      {/* ── Petty Cash ── */}
      {view === 'petty' && (
        <div className="space-y-3">
        <OfflineSyncBar sync={sync} />
        <div className="grid md:grid-cols-[260px_1fr] gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-600 uppercase">Floats</h4>
              <button onClick={() => setAddingFloat(a => !a)} className="text-xs text-brand-600 flex items-center gap-1"><Plus size={11} /> New</button>
            </div>
            {addingFloat && (
              <div className="card p-3 mb-2">
                <input className="input text-sm h-8 w-full mb-2" placeholder="Holder name" value={float.holder} onChange={e => setFloat((f: any) => ({ ...f, holder: e.target.value }))} />
                <input type="number" className="input text-sm h-8 w-full mb-2" placeholder={`Opening (${currency})`} value={float.openingAmount} onChange={e => setFloat((f: any) => ({ ...f, openingAmount: e.target.value }))} />
                <button onClick={saveFloat} className="btn btn-primary text-xs py-1.5 w-full">Create float</button>
              </div>
            )}
            <div className="space-y-1.5">
              {floats.map(f => (
                <button key={f.id} onClick={() => setSelFloat(f.id)} className={cn('w-full text-left px-3 py-2 rounded-lg border', selFloat === f.id ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50')}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 text-sm">{f.holder}</span>
                    {f.status === 'CLOSED' && <Lock size={11} className="text-gray-400" />}
                  </div>
                  <div className="text-[11px] text-gray-400">Balance: <span className={cn('font-semibold', f.balance < 0 ? 'text-red-600' : 'text-gray-700')}>{money(f.balance)}</span></div>
                </button>
              ))}
              {floats.length === 0 && <p className="text-xs text-gray-400 px-2">No floats yet.</p>}
            </div>
          </div>

          <div>
            {!selFloat ? (
              <div className="card p-10 text-center text-gray-400 text-sm"><Wallet size={24} className="mx-auto mb-2 opacity-30" />Select a float to record top‑ups and spends.</div>
            ) : (
              <>
                <div className="card mb-3">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div><label className="label text-xs">Type</label>
                      <select className="input text-sm h-9 w-full" value={entry.type} onChange={e => setEntry((f: any) => ({ ...f, type: e.target.value }))}>
                        <option value="SPEND">Spend</option><option value="TOPUP">Top-up</option>
                      </select>
                    </div>
                    <div className="md:col-span-2"><label className="label text-xs">Description</label><input className="input text-sm h-9 w-full" value={entry.description} onChange={e => setEntry((f: any) => ({ ...f, description: e.target.value }))} /></div>
                    {entry.type === 'SPEND' && (
                      <div><label className="label text-xs">Cost center</label>
                        <select className="input text-sm h-9 w-full" value={entry.costCenterCode} onChange={e => setEntry((f: any) => ({ ...f, costCenterCode: e.target.value }))}>
                          <option value="">—</option>{accounts.map(a => <option key={a.code} value={a.code}>{a.code}</option>)}
                        </select>
                      </div>
                    )}
                    <div><label className="label text-xs">Amount</label><input type="number" className="input text-sm h-9 w-full" value={entry.amount} onChange={e => setEntry((f: any) => ({ ...f, amount: e.target.value }))} /></div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={addEntry} className="btn btn-primary text-xs py-1.5">Record</button>
                    <label className={cn('btn btn-secondary text-xs py-1.5 cursor-pointer', scanning && 'opacity-60')}>
                      {scanning ? <><Loader2 size={13} className="mr-1 animate-spin" /> Reading…</> : <><ScanLine size={13} className="mr-1" /> Scan receipt</>}
                      <input type="file" accept=".pdf,image/*" className="hidden" disabled={scanning} onChange={scanReceipt} />
                    </label>
                    <span className="text-[11px] text-gray-400">Spends post to the project ledger as a cost. Scan pre-fills the form — review before recording.</span>
                  </div>
                </div>
                <div className="card overflow-hidden p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">CC</th><th className="px-3 py-2 text-right">Amount</th><th></th>
                    </tr></thead>
                    <tbody>
                      {txns.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-sm">No entries.</td></tr> :
                        txns.map(t => (
                          <tr key={t.id} className={cn('border-b border-gray-50', t._offline && 'bg-amber-50/40')}>
                            <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(t.date)}</td>
                            <td className="px-3 py-2"><span className={cn('inline-flex items-center gap-1', t.type === 'TOPUP' ? 'text-green-600' : 'text-gray-800')}>{t.type === 'TOPUP' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}{t.description}{t._offline && <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded px-1 py-0.5"><CloudOff size={9} /> queued</span>}</span></td>
                            <td className="px-3 py-2 text-gray-400 text-xs">{t.costCenterCode || '—'}</td>
                            <td className={cn('px-3 py-2 text-right font-medium', t.type === 'TOPUP' ? 'text-green-600' : 'text-gray-800')}>{t.type === 'TOPUP' ? '+' : '−'}{money(Number(t.amount))}</td>
                            <td className="px-3 py-2 text-right">{!t._offline && <button onClick={() => delEntry(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
