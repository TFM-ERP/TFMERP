'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, RefreshCw, ArrowDownLeft, ArrowUpRight, Paperclip, Lock, Unlock, FileDown, ChevronDown, ChevronRight, Banknote, ScanLine, Loader2, GitBranch } from 'lucide-react';
import { productionApi, uploadFile, assetUrl } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { StatRow, Btn, Chip, inputCls } from './ui';

const STATUS_BY_KIND: Record<string, string[]> = {
  INCOME: ['DRAFT', 'INVOICED', 'RECEIVED', 'VOID'],
  COST: ['DRAFT', 'APPROVED', 'PAID', 'VOID'],
};
const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', APPROVED: 'bg-amber-100 text-amber-700',
  INVOICED: 'bg-blue-100 text-blue-700', PAID: 'bg-emerald-100 text-emerald-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700', VOID: 'bg-rose-100 text-rose-700',
};
const thisMonth = () => new Date().toISOString().slice(0, 7);
const csv = (rows: any[][], name: string) => {
  const s = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};

export default function AccountingPanel({ projectId, currency = 'AED', accounts = [] }:
  { projectId: string; currency?: string; accounts?: { code: string; title: string }[] }) {
  const money = (n: any) => formatCurrency(n, currency);
  const [view, setView] = useState<'ledger' | 'payables' | 'paid' | 'payroll' | 'reports'>('ledger');
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [docsByTxn, setDocsByTxn] = useState<Record<string, number>>({});
  const [periods, setPeriods] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'COST'>('ALL');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<null | 'INCOME' | 'COST'>(null);
  const [form, setForm] = useState<any>({ date: new Date().toISOString().slice(0, 10), description: '', party: '', invoiceNumber: '', dueDate: '', accountCode: '', amount: '', taxAmount: '', status: 'DRAFT' });
  const [periodMonth, setPeriodMonth] = useState(thisMonth());

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      productionApi.ledger.summary(projectId),
      productionApi.ledger.list(projectId, filter === 'ALL' ? {} : { kind: filter }),
      productionApi.documents.list(projectId, { entityType: 'TRANSACTION' }).catch(() => ({ data: [] })),
      productionApi.ledger.periods(projectId).catch(() => ({ data: [] })),
    ]).then(([s, l, d, p]) => {
      setSummary(s.data); setRows(l.data || []);
      const map: Record<string, number> = {};
      for (const doc of (d.data || [])) if (doc.entityId) map[doc.entityId] = (map[doc.entityId] || 0) + 1;
      setDocsByTxn(map); setPeriods(p.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId, filter]);
  useEffect(() => { load(); }, [load]);

  const openAdd = (kind: 'INCOME' | 'COST') => {
    setAdding(kind);
    setForm({ date: new Date().toISOString().slice(0, 10), description: '', party: '', invoiceNumber: '', dueDate: '', accountCode: '', amount: '', taxAmount: '', status: kind === 'INCOME' ? 'INVOICED' : 'APPROVED' });
  };

  const save = async () => {
    if (!form.description || !form.amount) return;
    if (adding === 'COST' && !form.accountCode) { alert('Every cost must be coded to a budget account.'); return; }
    const acct = accounts.find(a => a.code === form.accountCode);
    try {
      await productionApi.ledger.create({
        projectId, kind: adding, currency,
        date: form.date, description: form.description, party: form.party || undefined,
        invoiceNumber: form.invoiceNumber || undefined, dueDate: form.dueDate || undefined,
        accountCode: form.accountCode || undefined, accountTitle: acct?.title || undefined,
        amount: Number(form.amount), taxAmount: Number(form.taxAmount) || 0, status: form.status,
      });
      setAdding(null); load();
    } catch (e: any) { alert(e.response?.data?.message || 'Could not save.'); }
  };

  const setStatus = async (id: string, status: string) => { try { await productionApi.ledger.setStatus(id, status); load(); } catch (e: any) { alert(e.response?.data?.message || 'Failed.'); } };
  const submitApproval = async (id: string) => { try { await productionApi.ledger.submitApproval(id); alert('Submitted to the approval workflow — approvers act in Production → My Approvals; it becomes an actual once every step approves.'); load(); } catch (e: any) { alert(e.response?.data?.message || 'Could not submit.'); } };
  const remove = async (id: string) => { if (confirm('Delete this entry?')) { try { await productionApi.ledger.remove(id); load(); } catch (e: any) { alert(e.response?.data?.message || 'Failed.'); } } };

  const attach = async (txnId: string, file: File) => {
    try {
      const up = await uploadFile(file);
      await productionApi.documents.create({ projectId, name: up.originalName, url: up.url, provider: 'UPLOAD', category: 'Receipt', entityType: 'TRANSACTION', entityId: txnId });
      load();
    } catch (e: any) { alert(e.response?.data?.message || 'Upload failed.'); }
  };

  const closedSet = new Set(periods.filter(p => p.status === 'CLOSED').map(p => p.period));
  const togglePeriod = async () => {
    const isClosed = closedSet.has(periodMonth);
    if (!confirm(isClosed ? `Reopen period ${periodMonth}?` : `Close period ${periodMonth}? Entries dated in this month can't be added or edited until reopened.`)) return;
    try { await productionApi.ledger.setPeriod(projectId, periodMonth, isClosed ? 'OPEN' : 'CLOSED'); load(); } catch (e: any) { alert(e.response?.data?.message || 'Failed.'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {(['ledger', 'payables', 'paid', 'payroll', 'reports'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={cn('text-xs px-3 py-1.5 rounded-lg capitalize', view === v ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>{v === 'paid' ? 'Paid invoices' : v}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {view === 'ledger' && <>
            <Btn variant="secondary" onClick={() => openAdd('INCOME')}><ArrowDownLeft size={13} className="text-green-600" /> Add income</Btn>
            <Btn variant="primary" onClick={() => openAdd('COST')}><ArrowUpRight size={13} /> Add cost</Btn>
          </>}
          <Btn variant="secondary" onClick={load}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></Btn>
        </div>
      </div>

      {/* P&L tiles */}
      {summary && (
        <StatRow stats={[
          ['Revenue', <span className="text-green-600">{money(summary.income)}</span>],
          ['Costs', <span className="text-amber-600">{money(summary.cost)}</span>],
          [`Net P&L · ${summary.marginPct}% margin`,
            <span className={cn('flex items-center gap-1', summary.net >= 0 ? 'text-green-600' : 'text-red-600')}>
              {summary.net >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{money(Math.abs(summary.net))}
            </span>],
          [`Budget · ${summary.spentPct}% spent`, money(summary.budget)],
          ['Cash', <span className={summary.cashPosition >= 0 ? '' : 'text-red-600'}>{money(summary.cashPosition)}</span>],
        ]} />
      )}

      {view === 'ledger' && <LedgerView {...{ rows, accounts, currency, money, adding, form, setForm, save, setAdding, openAdd, setStatus, remove, attach, docsByTxn, filter, setFilter, loading, periodMonth, setPeriodMonth, togglePeriod, closedSet, submitApproval }} />}
      {view === 'payables' && <PayablesView projectId={projectId} currency={currency} reload={load} />}
      {view === 'paid' && <PaidInvoicesView projectId={projectId} currency={currency} />}
      {view === 'payroll' && <PayrollView projectId={projectId} currency={currency} accounts={accounts} reload={load} />}
      {view === 'reports' && <ReportsView projectId={projectId} currency={currency} summary={summary} />}
    </div>
  );
}

// ── Ledger view ────────────────────────────────────────────────────────────────────
function LedgerView(p: any) {
  const { rows, accounts, currency, money, adding, form, setForm, save, setAdding, setStatus, remove, attach, docsByTxn, filter, setFilter, loading, periodMonth, setPeriodMonth, togglePeriod, closedSet, submitApproval } = p;
  const isClosed = closedSet.has(periodMonth);
  return (
    <>
      {/* Period close */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase">Period close</span>
        <input type="month" className={cn(inputCls, 'w-40')} value={periodMonth} onChange={e => setPeriodMonth(e.target.value)} />
        <Chip tone={isClosed ? 'risk' : 'money'}>{isClosed ? 'CLOSED' : 'OPEN'}</Chip>
        <Btn variant="secondary" onClick={togglePeriod}>{isClosed ? <><Unlock size={12} /> Reopen</> : <><Lock size={12} /> Close month</>}</Btn>
        <span className="text-[11px] text-gray-400">Closing locks entries dated in that month from edits — for a true cost-report snapshot.</span>
      </div>

      {/* Add form */}
      {adding && (
        <div className={cn('rounded-2xl border p-4', adding === 'INCOME' ? 'bg-green-50/40 border-green-100' : 'bg-amber-50/40 border-amber-100')}>
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">{adding === 'INCOME' ? 'New income' : 'New cost / vendor invoice'}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label text-xs">Date</label><input type="date" className={inputCls} value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
            <div className="md:col-span-2"><label className="label text-xs">Description *</label><input className={inputCls} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
            <div><label className="label text-xs">{adding === 'INCOME' ? 'Client' : 'Vendor'}</label><input className={inputCls} value={form.party} onChange={e => setForm((f: any) => ({ ...f, party: e.target.value }))} /></div>
            {adding === 'COST' && <>
              <div><label className="label text-xs">Invoice #</label><input className={inputCls} value={form.invoiceNumber} onChange={e => setForm((f: any) => ({ ...f, invoiceNumber: e.target.value }))} /></div>
              <div><label className="label text-xs">Due date</label><input type="date" className={inputCls} value={form.dueDate} onChange={e => setForm((f: any) => ({ ...f, dueDate: e.target.value }))} /></div>
              <div><label className="label text-xs">Budget account *</label>
                <select className={cn(inputCls, !form.accountCode && 'border-amber-300')} value={form.accountCode} onChange={e => setForm((f: any) => ({ ...f, accountCode: e.target.value }))}>
                  <option value="">— Select —</option>
                  {accounts.map((a: any) => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}
                </select>
              </div>
            </>}
            {adding === 'INCOME' && (
              <div><label className="label text-xs">Account (optional)</label>
                <select className={inputCls} value={form.accountCode} onChange={e => setForm((f: any) => ({ ...f, accountCode: e.target.value }))}>
                  <option value="">— None —</option>{accounts.map((a: any) => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}
                </select>
              </div>
            )}
            <div><label className="label text-xs">Amount ({currency})</label><input type="number" className={inputCls} value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="label text-xs">Tax / VAT</label><input type="number" className={inputCls} value={form.taxAmount} onChange={e => setForm((f: any) => ({ ...f, taxAmount: e.target.value }))} /></div>
            <div><label className="label text-xs">Status</label>
              <select className={inputCls} value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                {STATUS_BY_KIND[adding].map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Btn variant="primary" onClick={save}>Save</Btn>
            <Btn variant="secondary" onClick={() => setAdding(null)}>Cancel</Btn>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        {(['ALL', 'INCOME', 'COST'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn('text-xs px-3 py-1.5 rounded-lg', filter === f ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>{f === 'ALL' ? 'All' : f === 'INCOME' ? 'Income' : 'Costs'}</button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          rows.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No transactions yet.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-2.5 text-left">Date</th><th className="px-3 py-2.5 text-left">Description</th>
                <th className="px-3 py-2.5 text-left">Account / Party</th><th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-left">Status</th><th className="px-3 py-2.5 text-center">Doc</th><th className="px-3 py-2.5"></th>
              </tr></thead>
              <tbody>
                {rows.map((t: any) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(t.date)}{t.dueDate && <span className="block text-[10px] text-gray-400">due {formatDate(t.dueDate)}</span>}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', t.kind === 'INCOME' ? 'bg-green-500' : 'bg-amber-500')} />
                      <span className="text-gray-800">{t.description}</span>{t.invoiceNumber && <span className="ml-1.5 text-[10px] text-gray-400">#{t.invoiceNumber}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{t.accountCode ? `${t.accountCode} · ${t.accountTitle || ''}` : (t.party || t.category || <span className="text-amber-500">uncoded</span>)}</td>
                    <td className={cn('px-3 py-2.5 text-right font-medium', t.kind === 'INCOME' ? 'text-green-600' : 'text-gray-800')}>{t.kind === 'INCOME' ? '+' : '−'}{money(Number(t.total))}</td>
                    <td className="px-3 py-2.5">
                      <select value={t.status} onChange={e => setStatus(t.id, e.target.value)} className={cn('text-[11px] rounded-full px-2 py-0.5 border-0 cursor-pointer', STATUS_CLS[t.status])}>
                        {STATUS_BY_KIND[t.kind].map((s: string) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <label className="cursor-pointer inline-flex items-center gap-0.5 text-gray-400 hover:text-brand-600" title="Attach receipt / invoice">
                        <Paperclip size={13} />{docsByTxn[t.id] ? <span className="text-[10px]">{docsByTxn[t.id]}</span> : null}
                        <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) attach(t.id, f); e.currentTarget.value = ''; }} />
                      </label>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {t.kind === 'COST' && t.status === 'DRAFT' && (
                        <button onClick={() => submitApproval(t.id)} title="Submit for approval" className="text-brand-600 hover:text-brand-700 mr-2"><GitBranch size={13} /></button>
                      )}
                      <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  );
}

// ── Paid invoices (disbursements register) ────────────────────────────────────────────
function PaidInvoicesView({ projectId, currency }: { projectId: string; currency: string }) {
  const money = (n: any) => formatCurrency(n, currency);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const load = useCallback(() => {
    setLoading(true);
    productionApi.ledger.paidRegister(projectId, { from: range.from || undefined, to: range.to || undefined })
      .then((r: any) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [projectId, range.from, range.to]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data?.rows?.length) return;
    const head = ['Paid date', 'Vendor', 'Invoice #', 'PO ref', 'Account', 'Description', 'Amount', 'Currency', 'Approved by', 'Released by', 'Documents'];
    const lines = data.rows.map((r: any) => [
      r.paidDate ? new Date(r.paidDate).toLocaleDateString('en-GB') : '', r.vendor || '', r.invoiceNumber || '', r.reference || '',
      `${r.accountCode || ''} ${r.accountTitle || ''}`.trim(), r.description || '', r.amount, r.currency, r.approvedBy || '', r.releasedBy || '',
      (r.documents || []).map((d: any) => d.name).join(' | '),
    ]);
    const csvStr = [head, ...lines].map(row => row.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csvStr], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `paid-invoices-${projectId}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 flex-wrap border-b border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-gray-700">Paid invoices · disbursements</h4>
          <p className="text-[11px] text-gray-400">{data ? `${data.count} payment(s) · ${money(data.total)} released` : '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className={cn(inputCls, 'w-auto')} value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} title="From" />
          <span className="text-gray-300">→</span>
          <input type="date" className={cn(inputCls, 'w-auto')} value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} title="To" />
          <Btn variant="secondary" onClick={exportCsv}><FileDown size={13} /> CSV</Btn>
          <Btn variant="secondary" onClick={load}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></Btn>
        </div>
      </div>
      {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading…</div> : !data?.rows?.length ? (
        <div className="p-8 text-center text-gray-400 text-sm">No paid invoices yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
            <th className="px-4 py-2 text-left">Paid</th><th className="px-3 py-2 text-left">Vendor / invoice</th><th className="px-3 py-2 text-left">Account</th>
            <th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Approved / released by</th><th className="px-3 py-2 text-left">Invoice doc</th>
          </tr></thead>
          <tbody>
            {data.rows.map((r: any) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                <td className="px-4 py-2.5 text-gray-500 text-xs">{r.paidDate ? formatDate(r.paidDate) : '—'}</td>
                <td className="px-3 py-2.5"><span className="text-gray-800">{r.vendor || '—'}</span>{r.invoiceNumber && <span className="block text-[10px] text-gray-400">#{r.invoiceNumber}{r.reference ? ` · ${r.reference}` : ''}</span>}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.accountCode ? `${r.accountCode} · ${r.accountTitle || ''}` : <span className="text-amber-500">uncoded</span>}</td>
                <td className="px-3 py-2.5 text-right font-medium text-gray-800">{money(r.amount)}</td>
                <td className="px-3 py-2.5 text-[11px] text-gray-500">{r.approvedBy || '—'}<span className="block text-gray-400">↳ {r.releasedBy || '—'}</span></td>
                <td className="px-3 py-2.5">
                  {r.documents?.length ? r.documents.map((d: any, i: number) => (
                    <a key={i} href={assetUrl(d.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs mr-2"><Paperclip size={11} /> {d.name?.slice(0, 18) || 'View'}</a>
                  )) : <span className="text-[10px] text-red-400">no doc</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="bg-gray-50/60"><td colSpan={3} className="px-4 py-2 text-right font-semibold text-gray-700">Total released</td><td className="px-3 py-2 text-right font-bold text-gray-900">{money(data.total)}</td><td colSpan={2} /></tr></tfoot>
        </table>
      )}
    </div>
  );
}

// ── Payables view ───────────────────────────────────────────────────────────────────
function PayablesView({ projectId, currency, reload }: { projectId: string; currency: string; reload: () => void }) {
  const money = (n: any) => formatCurrency(n, currency);
  const [data, setData] = useState<any>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { productionApi.ledger.apAging(projectId).then(r => setData(r.data)).catch(() => setData(null)); }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pay = async () => {
    if (!sel.size) return;
    if (!confirm(`Mark ${sel.size} invoice(s) as paid?`)) return;
    setBusy(true);
    try { const r = await productionApi.ledger.pay(projectId, [...sel]); alert(`Paid ${r.data.paid} invoice(s): ${money(r.data.totalPaid)}.`); setSel(new Set()); load(); reload(); }
    catch (e: any) { alert(e.response?.data?.message || 'Payment failed.'); }
    finally { setBusy(false); }
  };
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-gray-400 text-sm">Loading payables…</div>;
  const B = data.buckets || {};
  const selTotal = (data.rows || []).filter((r: any) => sel.has(r.id)).reduce((s: number, r: any) => s + r.outstanding, 0);

  return (
    <>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[['Current', B.current], ['1–30', B.d1_30], ['31–60', B.d31_60], ['61–90', B.d61_90], ['90+', B.d90], ['Total open', data.totalOpen]].map(([l, v]: any, i) => (
          <div key={l} className={cn('rounded-2xl border border-slate-200 bg-white p-3.5', i === 5 && 'bg-brand-50')}><p className="text-[10px] text-gray-400 uppercase font-semibold">{l}</p><p className={cn('text-base font-bold', i >= 2 && i <= 4 && Number(v) > 0 ? 'text-red-600' : 'text-gray-900')}>{money(v || 0)}</p></div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{data.count} open invoice(s). Tick and pay to run a payment.</p>
        <Btn variant="primary" onClick={pay} disabled={busy || !sel.size}><Banknote size={13} /> Pay selected{sel.size ? ` (${money(selTotal)})` : ''}</Btn>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {!data.rows?.length ? <div className="p-10 text-center text-gray-400 text-sm">No open payables. Add costs with status APPROVED + a due date.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
              <th className="px-3 py-2.5 w-8"></th><th className="px-3 py-2.5 text-left">Due</th><th className="px-3 py-2.5 text-left">Vendor / Invoice</th>
              <th className="px-3 py-2.5 text-left">Account</th><th className="px-3 py-2.5 text-right">Outstanding</th><th className="px-3 py-2.5 text-left">Age</th>
            </tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                  <td className="px-3 py-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
                  <td className="px-3 py-2"><span className="text-gray-800">{r.vendor || '—'}</span>{r.invoiceNumber && <span className="ml-1.5 text-[10px] text-gray-400">#{r.invoiceNumber}</span>}<span className="block text-[10px] text-gray-400">{r.description}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.accountCode ? `${r.accountCode}` : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">{money(r.outstanding)}</td>
                  <td className="px-3 py-2">{r.overdueDays > 0 ? <span className="text-[10px] bg-rose-100 text-rose-700 rounded-full px-2 py-0.5">{r.overdueDays}d overdue</span> : <span className="text-[10px] text-gray-400">current</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Payroll view ────────────────────────────────────────────────────────────────────
const CLASS_CODES = ['PERFORMER', 'BG', 'STUNT', 'DIRECTOR', 'ADSM', 'WRITER', 'IATSE-CREW', 'CREW', 'DRIVER'];
function PayrollView({ projectId, currency, accounts, reload }: { projectId: string; currency: string; accounts: any[]; reload: () => void }) {
  const money = (n: any) => formatCurrency(n, currency);
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { name: '', role: '', classificationCode: '', accountCode: '', weekEnding: '', days: '', dailyRate: '', otHours: '', otRate: '', boxRental: '', kitRental: '', perDiemDays: '', perDiemRate: '' };
  const [f, setF] = useState<any>(blank);
  const [pv, setPv] = useState<any>(null);

  const load = useCallback(() => { productionApi.payroll.list(projectId).then(r => setRows(r.data || [])).catch(() => setRows([])); }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // live preview when adding
  useEffect(() => {
    if (!adding) { setPv(null); return; }
    const t = setTimeout(() => { productionApi.payroll.preview(projectId, f).then(r => setPv(r.data)).catch(() => setPv(null)); }, 350);
    return () => clearTimeout(t);
  }, [adding, projectId, f.classificationCode, f.days, f.dailyRate, f.otHours, f.otRate, f.boxRental, f.kitRental, f.perDiemDays, f.perDiemRate]);

  const save = async () => {
    if (!f.name) { alert('Name required.'); return; }
    if (!f.accountCode) { alert('Assign a budget account.'); return; }
    setBusy(true);
    try {
      const acct = accounts.find((a: any) => a.code === f.accountCode);
      await productionApi.payroll.create(projectId, { ...f, accountTitle: acct?.title, currency });
      setAdding(false); setF(blank); load();
    } catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); } finally { setBusy(false); }
  };
  const act = async (fn: Promise<any>, ok?: string) => { try { await fn; if (ok) {/* noop */ } load(); reload(); } catch (e: any) { alert(e.response?.data?.message || 'Failed.'); } };

  // V1.2: scan a timesheet → AI pre-fills the timecard form for review (never auto-posts).
  const [scanning, setScanning] = useState(false);
  const scanTimesheet = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setScanning(true); setAdding(true);
    try {
      const r = await productionApi.costing.scanTimesheet(projectId, file);
      const d = r.data?.draft || {};
      setF((x: any) => ({ ...x, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === 0 ? '' : String(v ?? '')])) }));
      const conf = Math.round((d.confidence || 0) * 100);
      alert(`Timesheet read (confidence ${conf}%). Review the figures, set the budget account & classification, then save.`);
    } catch (err: any) { alert(err?.response?.data?.message || 'Timesheet scan failed.'); }
    finally { setScanning(false); }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Timecards compute gross + the project's frozen fringes + box/kit + per diem, then post a coded cost.</p>
        <div className="flex gap-2">
          <label className={cn('text-xs inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 border border-slate-200 text-slate-600 hover:border-slate-900 transition-colors cursor-pointer', scanning && 'opacity-60')}>
            {scanning ? <><Loader2 size={13} className="animate-spin" /> Reading…</> : <><ScanLine size={13} /> Scan timesheet</>}
            <input type="file" accept=".pdf,image/*" className="hidden" disabled={scanning} onChange={scanTimesheet} />
          </label>
          <Btn variant="primary" onClick={() => setAdding(a => !a)}><Plus size={13} /> New timecard</Btn>
        </div>
      </div>

      {adding && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><label className="label text-xs">Name *</label><input className={inputCls} value={f.name} onChange={e => setF((x: any) => ({ ...x, name: e.target.value }))} /></div>
            <div><label className="label text-xs">Role</label><input className={inputCls} value={f.role} onChange={e => setF((x: any) => ({ ...x, role: e.target.value }))} /></div>
            <div><label className="label text-xs">Classification</label><input list="pr-class" className={cn(inputCls, 'font-mono')} value={f.classificationCode} onChange={e => setF((x: any) => ({ ...x, classificationCode: e.target.value.toUpperCase() }))} placeholder="for fringes" /><datalist id="pr-class">{CLASS_CODES.map(c => <option key={c} value={c} />)}</datalist></div>
            <div><label className="label text-xs">Budget account *</label><select className={inputCls} value={f.accountCode} onChange={e => setF((x: any) => ({ ...x, accountCode: e.target.value }))}><option value="">—</option>{accounts.map((a: any) => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}</select></div>
            <div><label className="label text-xs">Week ending</label><input type="date" className={inputCls} value={f.weekEnding} onChange={e => setF((x: any) => ({ ...x, weekEnding: e.target.value }))} /></div>
            <div><label className="label text-xs">Days</label><input type="number" className={inputCls} value={f.days} onChange={e => setF((x: any) => ({ ...x, days: e.target.value }))} /></div>
            <div><label className="label text-xs">Daily rate</label><input type="number" className={inputCls} value={f.dailyRate} onChange={e => setF((x: any) => ({ ...x, dailyRate: e.target.value }))} /></div>
            <div><label className="label text-xs">OT hours</label><input type="number" className={inputCls} value={f.otHours} onChange={e => setF((x: any) => ({ ...x, otHours: e.target.value }))} /></div>
            <div><label className="label text-xs">OT rate/hr</label><input type="number" className={inputCls} value={f.otRate} onChange={e => setF((x: any) => ({ ...x, otRate: e.target.value }))} /></div>
            <div><label className="label text-xs">Box rental</label><input type="number" className={inputCls} value={f.boxRental} onChange={e => setF((x: any) => ({ ...x, boxRental: e.target.value }))} /></div>
            <div><label className="label text-xs">Kit rental</label><input type="number" className={inputCls} value={f.kitRental} onChange={e => setF((x: any) => ({ ...x, kitRental: e.target.value }))} /></div>
            <div><label className="label text-xs">Per-diem days</label><input type="number" className={inputCls} value={f.perDiemDays} onChange={e => setF((x: any) => ({ ...x, perDiemDays: e.target.value }))} /></div>
            <div><label className="label text-xs">Per-diem rate</label><input type="number" className={inputCls} value={f.perDiemRate} onChange={e => setF((x: any) => ({ ...x, perDiemRate: e.target.value }))} /></div>
          </div>
          {pv && (
            <div className="flex gap-4 mt-3 text-sm flex-wrap">
              <span className="text-gray-500">Gross <b className="text-gray-800">{money(pv.gross)}</b></span>
              <span className="text-gray-500">+ Fringe <b className="text-amber-700">{money(pv.fringe)}</b></span>
              <span className="text-gray-500">+ Box/Kit/PD <b className="text-gray-800">{money(pv.reimb)}</b></span>
              <span className="text-gray-700">= Total <b className="text-brand-700">{money(pv.total)}</b></span>
            </div>
          )}
          <div className="flex gap-2 mt-3"><Btn variant="primary" onClick={save} disabled={busy}>Save timecard</Btn><Btn variant="secondary" onClick={() => setAdding(false)}>Cancel</Btn></div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {!rows.length ? <div className="p-10 text-center text-gray-400 text-sm">No timecards yet.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
              <th className="px-4 py-2.5 text-left">Name</th><th className="px-3 py-2.5 text-left">Account</th><th className="px-3 py-2.5 text-right">Gross</th>
              <th className="px-3 py-2.5 text-right">Fringe</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-3 py-2.5 text-left">Status</th><th className="px-3 py-2.5"></th>
            </tr></thead>
            <tbody>
              {rows.map((t: any) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5"><span className="text-gray-800">{t.name}</span>{t.classificationCode && <span className="ml-1.5 text-[10px] bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-mono">{t.classificationCode}</span>}<span className="block text-[10px] text-gray-400">{t.role || ''}{t.weekEnding ? ` · w/e ${formatDate(t.weekEnding)}` : ''}</span></td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{t.accountCode || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{money(t.gross)}</td>
                  <td className="px-3 py-2.5 text-right text-amber-700">{money(t.fringe)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{money(t.total)}</td>
                  <td className="px-3 py-2.5"><Chip tone={t.status === 'POSTED' ? 'money' : t.status === 'APPROVED' ? 'need' : 'slate'}>{t.status}</Chip></td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {t.status !== 'POSTED'
                      ? <button onClick={() => act(productionApi.payroll.post(t.id))} className="text-[11px] text-brand-600 hover:text-brand-700 mr-2">Post</button>
                      : <button onClick={() => { if (confirm('Reverse the posted cost?')) act(productionApi.payroll.reverse(t.id)); }} className="text-[11px] text-amber-600 hover:text-amber-700 mr-2">Reverse</button>}
                    <button onClick={() => { if (confirm('Delete timecard?')) act(productionApi.payroll.remove(t.id)); }} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Reports view ────────────────────────────────────────────────────────────────────
function ReportsView({ projectId, currency, summary }: { projectId: string; currency: string; summary: any }) {
  const money = (n: any) => formatCurrency(n, currency);
  const [gl, setGl] = useState<any>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => { productionApi.ledger.gl(projectId).then(r => setGl(r.data)).catch(() => setGl(null)); }, [projectId]);
  const toggle = (k: string) => setOpen(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const exportGl = () => {
    const rows: any[][] = [['Account', 'Title', 'Debit (cost)', 'Credit (income)']];
    for (const a of (gl?.accounts || [])) rows.push([a.code || '—', a.title || '', a.debit, a.credit]);
    csv(rows, 'gl-by-account.csv');
  };

  return (
    <div className="space-y-4">
      {/* P&L */}
      {summary && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 max-w-md">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Profit &amp; Loss</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-gray-500">Revenue</td><td className="py-1 text-right font-medium text-green-600">{money(summary.income)}</td></tr>
              <tr><td className="py-1 text-gray-500">Costs</td><td className="py-1 text-right font-medium text-amber-600">({money(summary.cost)})</td></tr>
              <tr className="border-t border-gray-200"><td className="py-1.5 font-semibold text-gray-800">Net P&amp;L</td><td className={cn('py-1.5 text-right font-bold', summary.net >= 0 ? 'text-green-600' : 'text-red-600')}>{money(summary.net)}</td></tr>
              <tr><td className="py-1 text-gray-400 text-xs">Margin</td><td className="py-1 text-right text-xs text-gray-400">{summary.marginPct}%</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* GL by account */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">General Ledger — by account</h4>
          <Btn variant="secondary" onClick={exportGl}><FileDown size={12} /> CSV</Btn>
        </div>
        {!gl ? <p className="text-xs text-gray-400">Loading…</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
              <th className="py-2 text-left">Account</th><th className="py-2 text-right">Debit (cost)</th><th className="py-2 text-right">Credit (income)</th><th className="py-2"></th>
            </tr></thead>
            <tbody>
              {(gl.accounts || []).map((a: any) => {
                const k = a.code || a.title;
                const isOpen = open.has(k);
                return (
                  <Fragment key={k}>
                    <tr className="border-b border-slate-100 cursor-pointer hover:bg-gray-50" onClick={() => toggle(k)}>
                      <td className="py-2 text-gray-800">{isOpen ? <ChevronDown size={12} className="inline mr-1 text-gray-400" /> : <ChevronRight size={12} className="inline mr-1 text-gray-400" />}{a.code ? `${a.code} · ` : ''}{a.title}</td>
                      <td className="py-2 text-right text-gray-700">{a.debit ? money(a.debit) : '—'}</td>
                      <td className="py-2 text-right text-gray-700">{a.credit ? money(a.credit) : '—'}</td>
                      <td className="py-2 text-right text-[10px] text-gray-400">{a.lines.length} lines</td>
                    </tr>
                    {isOpen && a.lines.map((l: any, i: number) => (
                      <tr key={i} className="text-xs text-gray-500 bg-gray-50/50">
                        <td className="py-1 pl-6">{formatDate(l.date)} · {l.description}{l.party ? ` · ${l.party}` : ''}</td>
                        <td className="py-1 text-right">{l.kind === 'COST' ? money(l.total) : ''}</td>
                        <td className="py-1 text-right">{l.kind === 'INCOME' ? money(l.total) : ''}</td>
                        <td className="py-1 text-right pr-2">{l.status}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}      </div>
    </div>
  );
}
