'use client';

import { useEffect, useState, useCallback } from 'react';
import { Landmark, Plus, ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react';
import { accountingApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

export default function BankReconciliationPage() {
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [ws, setWs] = useState<any>(null);
  const [wsLoading, setWsLoading] = useState(false);

  // statement inputs
  const [stmtDate, setStmtDate] = useState(new Date().toISOString().slice(0, 10));
  const [stmtBalance, setStmtBalance] = useState('');

  // add bank account
  const [showAdd, setShowAdd] = useState(false);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [addForm, setAddForm] = useState({ name: '', bankName: '', accountNumber: '', glAccountId: '' });

  const loadBanks = useCallback(() => {
    setLoading(true);
    accountingApi.bankAccounts().then(r => setBanks(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadBanks(); }, [loadBanks]);
  useEffect(() => { accountingApi.accounts({ bank: 'true' }).then(r => setGlAccounts(r.data || [])).catch(() => {}); }, []);

  const openWorkspace = async (bank: any) => {
    setSelected(bank); setWsLoading(true);
    try { const r = await accountingApi.reconcileWorkspace(bank.id); setWs(r.data); }
    finally { setWsLoading(false); }
  };

  const refreshWs = async () => { if (selected) { const r = await accountingApi.reconcileWorkspace(selected.id); setWs(r.data); } };

  const toggle = async (lineId: string, reconciled: boolean) => {
    await accountingApi.toggleClear(lineId, reconciled);
    await refreshWs();
  };

  const addBank = async () => {
    if (!addForm.name || !addForm.glAccountId) return;
    await accountingApi.createBankAccount(addForm);
    setShowAdd(false); setAddForm({ name: '', bankName: '', accountNumber: '', glAccountId: '' });
    loadBanks();
  };

  const cleared = ws?.reconciledBalance ?? 0;
  const diff = (Number(stmtBalance) || 0) - cleared;
  const reconciled = stmtBalance !== '' && Math.round(diff * 100) === 0;

  const finish = async () => {
    if (!selected) return;
    await accountingApi.completeReconciliation({
      bankAccountId: selected.id, statementDate: stmtDate, statementBalance: Number(stmtBalance), clearedBalance: cleared,
    });
    alert('Reconciliation completed and saved.');
    setSelected(null); setWs(null); setStmtBalance(''); loadBanks();
  };

  // ── Workspace view ──
  if (selected && ws) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setSelected(null); setWs(null); }} className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Reconcile — {selected.name}</h1>
            <p className="text-sm text-gray-500">{selected.glAccount?.code} · {selected.glAccount?.name}</p>
          </div>
          <button onClick={refreshWs} className="btn btn-secondary p-2"><RefreshCw size={14} className={wsLoading ? 'animate-spin' : ''} /></button>
        </div>

        {/* Statement + difference */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="card"><label className="label text-xs">Statement date</label><input type="date" className="input w-full" value={stmtDate} onChange={e => setStmtDate(e.target.value)} /></div>
          <div className="card"><label className="label text-xs">Statement ending balance</label><input type="number" className="input w-full" value={stmtBalance} onChange={e => setStmtBalance(e.target.value)} placeholder="0.00" /></div>
          <div className="card"><p className="text-xs text-gray-400">Cleared balance</p><p className="text-lg font-bold text-gray-900">{formatCurrency(cleared)}</p></div>
          <div className={cn('card', reconciled ? 'ring-1 ring-green-300' : diff !== 0 && stmtBalance !== '' ? 'ring-1 ring-amber-300' : '')}>
            <p className="text-xs text-gray-400">Difference</p>
            <p className={cn('text-lg font-bold', reconciled ? 'text-green-600' : 'text-amber-600')}>{formatCurrency(Math.abs(diff))}</p>
          </div>
        </div>

        {reconciled && (
          <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="text-sm text-green-700 flex items-center gap-2"><CheckCircle size={16} /> Balanced — cleared transactions match the statement.</span>
            <button onClick={finish} className="btn btn-primary text-sm">Finish reconciliation</button>
          </div>
        )}

        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2.5 text-center w-12">Clear</th><th className="px-3 py-2.5 text-left">Date</th>
              <th className="px-3 py-2.5 text-left">Entry</th><th className="px-3 py-2.5 text-left">Memo</th><th className="px-3 py-2.5 text-right">Amount</th>
            </tr></thead>
            <tbody>
              {ws.lines.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-sm">No posted transactions on this account.</td></tr> :
                ws.lines.map((l: any) => (
                  <tr key={l.id} className={cn('border-b border-gray-50', l.reconciled && 'bg-green-50/40')}>
                    <td className="px-4 py-2.5 text-center"><input type="checkbox" checked={l.reconciled} onChange={e => toggle(l.id, e.target.checked)} /></td>
                    <td className="px-3 py-2.5 text-gray-500">{formatDate(l.date)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-500">{l.entryNumber}</td>
                    <td className="px-3 py-2.5 text-gray-700">{l.memo || '—'}</td>
                    <td className={cn('px-3 py-2.5 text-right font-medium', l.amount < 0 ? 'text-red-600' : 'text-gray-800')}>{formatCurrency(l.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">Tick each transaction that appears on your bank statement until the difference reaches zero, then finish.</p>
      </div>
    );
  }

  // ── Bank list view ──
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Landmark size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Bank Reconciliation</h1>
            <p className="text-sm text-gray-500">Match ledger transactions to your bank statements.</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="btn btn-primary"><Plus size={14} /> Add bank account</button>
      </div>

      {showAdd && (
        <div className="card mb-5 bg-blue-50/40 border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label">Name *</label><input className="input w-full" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Current Account" /></div>
            <div><label className="label">Bank</label><input className="input w-full" value={addForm.bankName} onChange={e => setAddForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Emirates NBD" /></div>
            <div><label className="label">Account no.</label><input className="input w-full" value={addForm.accountNumber} onChange={e => setAddForm(f => ({ ...f, accountNumber: e.target.value }))} /></div>
            <div><label className="label">GL account *</label>
              <select className="input w-full" value={addForm.glAccountId} onChange={e => setAddForm(f => ({ ...f, glAccountId: e.target.value }))}>
                <option value="">Select…</option>
                {glAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Bank/cash GL accounts only. Mark an account as "bank" in the Chart of Accounts to list it here.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={addBank} disabled={!addForm.name || !addForm.glAccountId} className="btn btn-primary text-sm">Add</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          banks.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No bank accounts yet. Add one to start reconciling.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Account</th><th className="px-3 py-2.5 text-left">GL</th>
                <th className="px-3 py-2.5 text-right">Ledger balance</th><th className="px-3 py-2.5 text-center">Uncleared</th><th className="px-3 py-2.5 text-right"></th>
              </tr></thead>
              <tbody>
                {banks.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-3"><div className="font-medium text-gray-800">{b.name}</div><div className="text-xs text-gray-400">{b.bankName} {b.accountNumber}</div></td>
                    <td className="px-3 py-3 text-gray-500 font-mono text-xs">{b.glAccount?.code}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800">{formatCurrency(b.glBalance)}</td>
                    <td className="px-3 py-3 text-center">{b.unclearedCount > 0 ? <span className="badge bg-amber-50 text-amber-700 text-xs">{b.unclearedCount}</span> : <span className="text-gray-300">0</span>}</td>
                    <td className="px-3 py-3 text-right"><button onClick={() => openWorkspace(b)} className="btn btn-secondary text-xs py-1 px-3">Reconcile</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
