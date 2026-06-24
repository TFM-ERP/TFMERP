'use client';
import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Plus, RefreshCw, Trash2, CheckCircle, XCircle, ArrowRight, Send } from 'lucide-react';

export default function PurchaseRequestsPanel({ projectId, currency = 'AED', accounts = [] }: { projectId: string; currency?: string; accounts?: { code: string; title: string }[] }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState(false);
  const [f, setF] = useState<any>({ description: '', costCenterCode: '', vendorName: '', amount: '' });
  const load = useCallback(() => { setLoading(true); productionApi.purchaseRequests.list(projectId).then(r => { setRows(r.data || []); setErr(false); }).catch(() => setErr(true)).finally(() => setLoading(false)); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!f.description || !f.amount) return; const acc = accounts.find(a => a.code === f.costCenterCode); await productionApi.purchaseRequests.create({ projectId, description: f.description, costCenterCode: f.costCenterCode || undefined, costCenterTitle: acc?.title, vendorName: f.vendorName || undefined, amount: Number(f.amount) }); setF({ description: '', costCenterCode: '', vendorName: '', amount: '' }); load(); };
  const st = async (id: string, status: string) => { await productionApi.purchaseRequests.setStatus(id, status); load(); };
  const convert = async (id: string) => { if (!confirm('Approve & convert this request into a Purchase Order?')) return; try { await productionApi.purchaseRequests.convert(id); alert('Converted to a Purchase Order.'); load(); } catch (e: any) { alert(e?.response?.data?.message || 'Could not convert.'); } };
  const del = async (id: string) => { if (confirm('Delete this request?')) { await productionApi.purchaseRequests.remove(id); load(); } };
  const tone = (s: string) => s === 'APPROVED' ? 'bg-green-100 text-green-700' : s === 'CONVERTED' ? 'bg-blue-100 text-blue-700' : s === 'REJECTED' ? 'bg-red-50 text-red-600' : s === 'SUBMITTED' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Requests (requisitions)</h4><button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} /></button></div>
      {err ? <p className="text-xs text-gray-400">Purchase Requests not active yet — run <code>npm run db:push</code> to enable.</p> : (<>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <input className="input text-sm h-9 md:col-span-2" placeholder="What's needed" value={f.description} onChange={e => setF((x: any) => ({ ...x, description: e.target.value }))} />
          <select className="input text-sm h-9" value={f.costCenterCode} onChange={e => setF((x: any) => ({ ...x, costCenterCode: e.target.value }))}><option value="">Cost center…</option>{accounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}</select>
          <input className="input text-sm h-9" placeholder="Vendor" value={f.vendorName} onChange={e => setF((x: any) => ({ ...x, vendorName: e.target.value }))} />
          <div className="flex gap-1"><input type="number" className="input text-sm h-9 w-full" placeholder="Amount" value={f.amount} onChange={e => setF((x: any) => ({ ...x, amount: e.target.value }))} /><button onClick={add} className="btn btn-primary px-2" title="Add request"><Plus size={14} /></button></div>
        </div>
        {loading ? <p className="text-xs text-gray-400">Loading…</p> : rows.length === 0 ? <p className="text-xs text-gray-400">No requests yet. Add one above — approve to convert into a PO.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-start py-1">PR #</th><th className="text-start">Description</th><th className="text-start">Cost center</th><th className="text-end">Amount</th><th className="text-start ps-3">Status</th><th className="text-end">Actions</th></tr></thead>
            <tbody>{rows.map(r => (<tr key={r.id} className="border-t border-gray-50">
              <td className="py-1.5 text-xs text-gray-500">{r.prNumber}</td>
              <td className="py-1.5 text-gray-700 text-xs">{r.description}</td>
              <td className="py-1.5 text-gray-500 text-xs">{r.costCenterCode || '—'}</td>
              <td className="py-1.5 text-end font-medium">{money(r.amount)}</td>
              <td className="py-1.5 ps-3"><span className={cn('badge text-[11px]', tone(r.status))}>{r.status}</span></td>
              <td className="py-1.5 text-end whitespace-nowrap">
                {r.status === 'DRAFT' && <button onClick={() => st(r.id, 'SUBMITTED')} title="Submit" className="text-amber-500 hover:text-amber-700 me-2"><Send size={13} /></button>}
                {(r.status === 'DRAFT' || r.status === 'SUBMITTED') && <button onClick={() => st(r.id, 'APPROVED')} title="Approve" className="text-green-500 hover:text-green-700 me-2"><CheckCircle size={14} /></button>}
                {r.status !== 'CONVERTED' && r.status !== 'REJECTED' && <button onClick={() => st(r.id, 'REJECTED')} title="Reject" className="text-red-400 hover:text-red-600 me-2"><XCircle size={14} /></button>}
                {r.status !== 'CONVERTED' && <button onClick={() => convert(r.id)} title="Convert to PO" className="text-blue-500 hover:text-blue-700 me-2"><ArrowRight size={14} /></button>}
                <button onClick={() => del(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
              </td></tr>))}</tbody></table></div>
        )}
      </>)}
    </div>
  );
}
