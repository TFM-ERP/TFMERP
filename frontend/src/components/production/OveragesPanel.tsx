'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, XCircle, Zap } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-600' },
};

export default function OveragesPanel({ projectId, activeVersionId, currency = 'AED' }: { projectId: string; activeVersionId?: string; currency?: string }) {
  const money = (n: any) => formatCurrency(n, currency);
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ all: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [detected, setDetected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ accountCode: '', accountTitle: '', description: '', amount: '', reason: '' });

  const load = useCallback(() => {
    setLoading(true);
    productionApi.overages.list(projectId).then(r => { setItems(r.data.items || []); setTotals(r.data.totals || {}); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // Detect overspent accounts from the cost report — EFC vs revised budget (after transfers)
  useEffect(() => {
    productionApi.costing.overspend(projectId).then(r => {
      setDetected((r.data.rows || []).map((d: any) => ({ code: d.code, title: d.title, budget: d.revisedBudget, actual: d.efc, overBy: d.overBy })));
    }).catch(() => {});
  }, [projectId, loading]);

  const raiseFromDetected = (d: any) => {
    setForm({ accountCode: d.code, accountTitle: d.title, description: `Overrun on ${d.code} · ${d.title}`, amount: String(Math.round(d.overBy * 100) / 100), reason: 'EFC exceeds revised budget' });
    setAdding(true);
  };

  const add = async () => {
    if (!form.description) return;
    await productionApi.overages.create({
      projectId, accountCode: form.accountCode || undefined, accountTitle: form.accountTitle || undefined,
      description: form.description, amount: form.amount ? Number(form.amount) : 0, reason: form.reason || undefined,
    });
    setAdding(false);
    setForm({ accountCode: '', accountTitle: '', description: '', amount: '', reason: '' });
    load();
  };

  const setStatus = async (id: string, status: string) => { await productionApi.overages.setStatus(id, status); load(); };
  const remove = async (id: string) => { if (confirm('Delete this overage?')) { await productionApi.overages.remove(id); load(); } };

  const alreadyRaised = (code: string) => items.some(i => i.accountCode === code && i.status !== 'REJECTED');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Overages ({items.length})</h3>
          <p className="text-xs text-gray-400">Log cost overruns and route for approval. Approved overages lift that cost center's budget in the Cost Report.</p>
        </div>
        <button onClick={() => setAdding(a => !a)} className="btn btn-primary text-xs py-1.5 px-3"><Plus size={13} className="mr-1" /> Log overage</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><p className="text-xs text-gray-400">Total logged</p><p className="text-lg font-bold text-gray-900">{money(totals.all || 0)}</p></div>
        <div className="card"><p className="text-xs text-gray-400">Pending</p><p className="text-lg font-bold text-amber-600">{money(totals.PENDING || 0)}</p></div>
        <div className="card"><p className="text-xs text-gray-400">Approved</p><p className="text-lg font-bold text-green-600">{money(totals.APPROVED || 0)}</p></div>
        <div className="card"><p className="text-xs text-gray-400">Rejected</p><p className="text-lg font-bold text-red-500">{money(totals.REJECTED || 0)}</p></div>
      </div>

      {/* Detected over-budget accounts */}
      {detected.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/40">
          <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Zap size={12} /> Overspent vs revised budget (EFC)</h4>
          <div className="space-y-1.5">
            {detected.map(d => (
              <div key={d.code} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-amber-100">
                <span className="text-gray-700">{d.code} · {d.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{money(d.actual)} / {money(d.budget)}</span>
                  <span className="text-red-600 font-semibold text-xs">+{money(d.overBy)}</span>
                  {alreadyRaised(d.code)
                    ? <span className="text-[11px] text-gray-400">raised</span>
                    : <button onClick={() => raiseFromDetected(d)} className="text-xs text-brand-600 hover:text-brand-700">Raise →</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adding && (
        <div className="card bg-blue-50/40 border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label text-xs">Account code</label><input className="input text-sm h-9 w-full font-mono" value={form.accountCode} onChange={e => setForm((f: any) => ({ ...f, accountCode: e.target.value }))} placeholder="2200" /></div>
            <div className="md:col-span-3"><label className="label text-xs">Description *</label><input className="input text-sm h-9 w-full" value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
            <div><label className="label text-xs">Amount (AED)</label><input type="number" className="input text-sm h-9 w-full" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
            <div className="md:col-span-3"><label className="label text-xs">Reason</label><input className="input text-sm h-9 w-full" value={form.reason} onChange={e => setForm((f: any) => ({ ...f, reason: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={add} className="btn btn-primary text-xs py-1.5">Log overage</button>
            <button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          items.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm"><AlertTriangle size={24} className="mx-auto mb-2 opacity-30" />No overages logged.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2.5 text-left">Account</th><th className="px-3 py-2.5 text-left">Description</th>
                <th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Raised</th><th className="px-3 py-2.5 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {items.map(o => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{o.accountCode ? `${o.accountCode}` : '—'}{o.accountTitle ? ` · ${o.accountTitle}` : ''}</td>
                    <td className="px-3 py-2.5"><div className="text-gray-800">{o.description}</div>{o.reason && <div className="text-[11px] text-gray-400">{o.reason}</div>}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{money(Number(o.amount))}</td>
                    <td className="px-3 py-2.5"><span className={cn('badge text-[11px]', STATUS_META[o.status].cls)}>{STATUS_META[o.status].label}</span></td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {o.status === 'PENDING' && (
                        <>
                          <button onClick={() => setStatus(o.id, 'APPROVED')} title="Approve" className="text-green-500 hover:text-green-700 mr-2"><CheckCircle size={15} /></button>
                          <button onClick={() => setStatus(o.id, 'REJECTED')} title="Reject" className="text-red-400 hover:text-red-600 mr-2"><XCircle size={15} /></button>
                        </>
                      )}
                      <button onClick={() => remove(o.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
