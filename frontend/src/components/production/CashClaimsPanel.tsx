'use client';
import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Plus, RefreshCw, Trash2, CheckCircle, XCircle, Send, ArrowRight, Banknote, CreditCard, Receipt } from 'lucide-react';

type Tab = 'advances' | 'cards' | 'claims';
export default function CashClaimsPanel({ projectId, currency = 'AED', accounts = [] }: { projectId: string; currency?: string; accounts?: { code: string; title: string }[] }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [tab, setTab] = useState<Tab>('advances');
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState(false);
  const [f, setF] = useState<any>({});
  const apiFor = (t: Tab): any => t === 'advances' ? productionApi.cashAdvances : t === 'cards' ? productionApi.cardTxns : productionApi.expenseClaims;
  const load = useCallback(() => { setLoading(true); apiFor(tab).list(projectId).then((r: any) => { setRows(r.data || []); setErr(false); }).catch(() => setErr(true)).finally(() => setLoading(false)); }, [projectId, tab]);
  useEffect(() => { setF({}); load(); }, [load]);
  const cc = (<select className="input text-sm h-9" value={f.costCenterCode || ''} onChange={e => setF((x: any) => ({ ...x, costCenterCode: e.target.value, costCenterTitle: accounts.find(a => a.code === e.target.value)?.title }))}><option value="">Cost center…</option>{accounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}</select>);
  const add = async () => {
    try {
      if (tab === 'advances') { if (!f.holderName || !f.amount) return; await productionApi.cashAdvances.create({ projectId, holderName: f.holderName, purpose: f.purpose, amount: Number(f.amount), costCenterCode: f.costCenterCode, costCenterTitle: f.costCenterTitle }); }
      else if (tab === 'cards') { if (!f.merchant || !f.amount) return; await productionApi.cardTxns.create({ projectId, merchant: f.merchant, cardholderName: f.cardholderName, amount: Number(f.amount), costCenterCode: f.costCenterCode, costCenterTitle: f.costCenterTitle }); }
      else { if (!f.claimantName || !f.amount) return; await productionApi.expenseClaims.create({ projectId, claimantName: f.claimantName, description: f.description, amount: Number(f.amount), costCenterCode: f.costCenterCode, costCenterTitle: f.costCenterTitle }); }
      setF({}); load();
    } catch (e: any) { alert(e?.response?.data?.message || 'Could not save.'); }
  };
  const tone = (s: string) => /PAID|CLEARED|APPROVED|REIMBURSED|POSTED/.test(s) ? 'bg-green-100 text-green-700' : /REJECT|RETURN|DISPUT/.test(s) ? 'bg-red-50 text-red-600' : /SUBMIT|PARTIAL|CODED/.test(s) ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600';
  const act = async (pr: Promise<any>) => { try { await pr; load(); } catch (e: any) { alert(e?.response?.data?.message || 'Action failed.'); } };
  const TABS: [Tab, string, any][] = [['advances', 'Cash advances', Banknote], ['cards', 'Card transactions', CreditCard], ['claims', 'Expense claims', Receipt]];
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1">{TABS.map(([k, lbl, Icon]) => (<button key={k} onClick={() => setTab(k)} className={cn('text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5', tab === k ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-gray-500 hover:bg-gray-50 border border-transparent')}><Icon size={13} /> {lbl}</button>))}</div>
        <button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} /></button>
      </div>
      {err ? <p className="text-xs text-gray-400">Not active yet — run <code>npm run db:push</code> to enable.</p> : (<>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          {tab === 'advances' && <><input className="input text-sm h-9" placeholder="Holder" value={f.holderName || ''} onChange={e => setF((x: any) => ({ ...x, holderName: e.target.value }))} /><input className="input text-sm h-9" placeholder="Purpose" value={f.purpose || ''} onChange={e => setF((x: any) => ({ ...x, purpose: e.target.value }))} /></>}
          {tab === 'cards' && <><input className="input text-sm h-9" placeholder="Merchant" value={f.merchant || ''} onChange={e => setF((x: any) => ({ ...x, merchant: e.target.value }))} /><input className="input text-sm h-9" placeholder="Cardholder" value={f.cardholderName || ''} onChange={e => setF((x: any) => ({ ...x, cardholderName: e.target.value }))} /></>}
          {tab === 'claims' && <><input className="input text-sm h-9" placeholder="Claimant" value={f.claimantName || ''} onChange={e => setF((x: any) => ({ ...x, claimantName: e.target.value }))} /><input className="input text-sm h-9" placeholder="Description" value={f.description || ''} onChange={e => setF((x: any) => ({ ...x, description: e.target.value }))} /></>}
          {cc}
          <input type="number" className="input text-sm h-9" placeholder="Amount" value={f.amount || ''} onChange={e => setF((x: any) => ({ ...x, amount: e.target.value }))} />
          <button onClick={add} className="btn btn-primary"><Plus size={14} className="me-1" />Add</button>
        </div>
        {loading ? <p className="text-xs text-gray-400">Loading…</p> : rows.length === 0 ? <p className="text-xs text-gray-400">None yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>
            {rows.map(r => (<tr key={r.id} className="border-t border-gray-50">
              <td className="py-1.5 text-xs text-gray-700">
                {tab === 'advances' && <><b>{r.holderName}</b>{r.purpose ? <span className="text-gray-400"> · {r.purpose}</span> : ''}</>}
                {tab === 'cards' && <><b>{r.merchant || '—'}</b>{r.cardholderName ? <span className="text-gray-400"> · {r.cardholderName}</span> : ''}{r.costCenterCode ? <span className="text-gray-400"> · {r.costCenterCode}</span> : ''}</>}
                {tab === 'claims' && <><b>{r.claimNumber}</b> <span className="text-gray-600">{r.claimantName}</span></>}
              </td>
              <td className="py-1.5 text-end font-medium">{money(r.amount)}{tab === 'advances' && (Number(r.clearedAmount) > 0 || Number(r.returnedAmount) > 0) ? <span className="text-[10px] text-gray-400"> · bal {money(Number(r.amount) - Number(r.clearedAmount) - Number(r.returnedAmount))}</span> : ''}</td>
              <td className="py-1.5 ps-3"><span className={cn('badge text-[11px]', tone(r.status))}>{r.status}</span></td>
              <td className="py-1.5 text-end whitespace-nowrap">
                {tab === 'advances' && <>
                  <button title="Clear (post spend)" onClick={() => { const a = prompt('Amount cleared (posts as an actual cost):'); if (a) act(productionApi.cashAdvances.clear(r.id, { amount: Number(a), post: true })); }} className="text-green-600 hover:text-green-800 me-2"><CheckCircle size={14} /></button>
                  <button title="Return funds" onClick={() => { const a = prompt('Amount returned:'); if (a) act(productionApi.cashAdvances.returnFunds(r.id, { amount: Number(a) })); }} className="text-blue-500 hover:text-blue-700 me-2"><ArrowRight size={14} /></button>
                </>}
                {tab === 'cards' && r.status !== 'POSTED' && <button title="Post to actuals" onClick={() => act(productionApi.cardTxns.post(r.id))} className="text-green-600 hover:text-green-800 me-2"><CheckCircle size={14} /></button>}
                {tab === 'claims' && <>
                  {r.status === 'DRAFT' && <button title="Submit" onClick={() => act(productionApi.expenseClaims.setStatus(r.id, 'SUBMITTED'))} className="text-amber-500 hover:text-amber-700 me-2"><Send size={13} /></button>}
                  {(r.status === 'DRAFT' || r.status === 'SUBMITTED') && <button title="Approve" onClick={() => act(productionApi.expenseClaims.setStatus(r.id, 'APPROVED'))} className="text-green-500 hover:text-green-700 me-2"><CheckCircle size={14} /></button>}
                  {r.status === 'APPROVED' && <button title="Reimburse (post)" onClick={() => act(productionApi.expenseClaims.reimburse(r.id))} className="text-green-600 hover:text-green-800 me-2"><ArrowRight size={14} /></button>}
                  {r.status !== 'REIMBURSED' && r.status !== 'REJECTED' && <button title="Reject" onClick={() => act(productionApi.expenseClaims.setStatus(r.id, 'REJECTED'))} className="text-red-400 hover:text-red-600 me-2"><XCircle size={14} /></button>}
                </>}
                <button title="Delete" onClick={() => act(apiFor(tab).remove(r.id))} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
              </td></tr>))}
          </tbody></table></div>
        )}
      </>)}
    </div>
  );
}
