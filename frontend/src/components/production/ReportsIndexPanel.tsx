'use client';
import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { FileBarChart, ChevronDown, ChevronRight, Download, Banknote } from 'lucide-react';

const downloadText = (name: string, content: string, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};
const csvEsc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const rowsToCsv = (data: any) => {
  const rows: any[] = data?.rows || []; if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvEsc(r[c])).join(','))].join('\n');
};

function GenericReport({ data, money, name }: { data: any; money: (n: any) => string; name: string }) {
  if (!data) return <p className="text-xs text-gray-400 py-2">—</p>;
  if (data.error) return <p className="text-xs text-gray-400 py-2">Report unavailable (restart backend / db:push).</p>;
  const rows: any[] = data.rows || []; const totals = data.totals || {};
  if (rows.length === 0) return <p className="text-xs text-gray-400 py-2">No data.</p>;
  const cols = Object.keys(rows[0]);
  const isMoney = (k: string) => /total|amount|gross|fringe|paid|approved|balance|opening|topups|spends|invoiced|remaining|committed|dailyRate|budget|actual|efc|ctc|overage|variance|debit|credit|subtotal|costToDate/i.test(k);
  return (
    <div>
      <div className="flex justify-end mt-2"><button onClick={() => downloadText(`${name.replace(/[^a-z0-9]+/gi, '-')}.csv`, rowsToCsv(data), 'text/csv;charset=utf-8')} className="text-[10px] text-brand-600 inline-flex items-center gap-1"><Download size={11} /> CSV</button></div>
      <div className="overflow-x-auto mt-1"><table className="w-full text-xs">
        <thead><tr className="text-[10px] text-gray-400 uppercase">{cols.map(c => <th key={c} className={isMoney(c) ? 'text-end px-1.5 py-1' : 'text-start px-1.5 py-1'}>{c}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 80).map((r, i) => (<tr key={i} className="border-t border-gray-50">{cols.map(c => <td key={c} className={isMoney(c) ? 'text-end px-1.5 py-1' : 'text-start px-1.5 py-1'}>{isMoney(c) ? money(r[c]) : (r[c] == null ? '—' : String(r[c]).slice(0, 40))}</td>)}</tr>))}</tbody>
        {Object.keys(totals).length > 0 && <tfoot><tr className="border-t-2 border-gray-200 font-semibold text-gray-700">{cols.map((c, i) => <td key={c} className={isMoney(c) ? 'text-end px-1.5 py-1.5' : 'text-start px-1.5 py-1.5'}>{i === 0 ? 'TOTAL' : (totals[c] != null ? (isMoney(c) ? money(totals[c]) : String(totals[c])) : '')}</td>)}</tr></tfoot>}
      </table></div>
    </div>
  );
}

function PaymentsBatch({ projectId, money }: { projectId: string; money: (n: any) => string }) {
  const [data, setData] = useState<any>(null); const [busy, setBusy] = useState(true);
  const [form, setForm] = useState<any>({ odfiRouting: '', companyName: '', companyId: '', effectiveDate: '' });
  useEffect(() => { productionApi.reports.paymentsEligible(projectId).then((r: any) => setData(r.data)).catch(() => setData({ error: true })).finally(() => setBusy(false)); }, [projectId]);
  const dlAch = async () => {
    try { const r = await productionApi.reports.paymentsAch(projectId, form); if (!r.data?.content) { alert('No ACH-eligible payees (need US routing + account). Use the CSV batch.'); return; } downloadText(r.data.fileName || 'ach.ach', r.data.content); alert(`NACHA file: ${r.data.included} entries · ${money(r.data.totalAmount)}. Excluded ${r.data.excluded?.length || 0}.`); }
    catch { alert('ACH export needs a backend restart + db:push.'); }
  };
  const dlCsv = async () => {
    try { const r = await productionApi.reports.paymentsCsv(projectId); if (!r.data?.content) { alert('No bankable payees.'); return; } downloadText(r.data.fileName || 'payments.csv', r.data.content, 'text/csv;charset=utf-8'); }
    catch { alert('CSV export needs a backend restart.'); }
  };
  if (busy) return <p className="text-xs text-gray-400 py-2">Loading eligible payments…</p>;
  if (!data || data.error) return <p className="text-xs text-gray-400 py-2">Unavailable (restart backend / db:push).</p>;
  const rows: any[] = data.rows || [];
  return (
    <div className="space-y-2 mt-2">
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-600">{data.totals?.payees || 0} payees · {money(data.totals?.amount)}</span>
        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{data.totals?.achEligible || 0} ACH-eligible</span>
        {data.totals?.missingBank > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">{data.totals.missingBank} missing bank details</span>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-start px-1.5 py-1">Payee</th><th className="text-start px-1.5 py-1">Bank</th><th className="text-end px-1.5 py-1">Amount</th><th className="text-start px-1.5 py-1">Method</th></tr></thead>
          <tbody>{rows.slice(0, 60).map((r, i) => (<tr key={i} className="border-t border-gray-50"><td className="px-1.5 py-1">{r.payee}</td><td className="px-1.5 py-1 text-gray-500">{r.bankName || '—'}</td><td className="px-1.5 py-1 text-end">{money(r.amount)}</td><td className="px-1.5 py-1">{r.achEligible ? <span className="text-emerald-600">ACH</span> : r.bankable ? <span className="text-sky-600">CSV/IBAN</span> : <span className="text-amber-600">no bank</span>}</td></tr>))}</tbody>
        </table></div>
      )}
      <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-2">
        <input className="input text-xs h-8" placeholder="ODFI routing # (your bank)" value={form.odfiRouting} onChange={(e) => setForm((f: any) => ({ ...f, odfiRouting: e.target.value }))} />
        <input className="input text-xs h-8" placeholder="Company name" value={form.companyName} onChange={(e) => setForm((f: any) => ({ ...f, companyName: e.target.value }))} />
        <input className="input text-xs h-8" placeholder="Company ID" value={form.companyId} onChange={(e) => setForm((f: any) => ({ ...f, companyId: e.target.value }))} />
        <input type="date" className="input text-xs h-8" value={form.effectiveDate} onChange={(e) => setForm((f: any) => ({ ...f, effectiveDate: e.target.value }))} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={dlAch} className="btn btn-primary text-xs py-1.5"><Banknote size={13} className="me-1" /> Download NACHA (ACH)</button>
        <button onClick={dlCsv} className="btn btn-secondary text-xs py-1.5"><Download size={13} className="me-1" /> CSV batch (IBAN)</button>
        <span className="text-[10px] text-gray-400">Export only — upload to your bank. TFM never moves money.</span>
      </div>
    </div>
  );
}

export default function ReportsIndexPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [cat, setCat] = useState<any[]>([]); const [open, setOpen] = useState<string | null>(null); const [data, setData] = useState<any>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { productionApi.reports.catalog().then(r => setCat(r.data?.reports || [])).catch(() => { }); }, []);
  const fetchers: Record<string, () => Promise<any>> = {
    'po-log': () => productionApi.reports.poLog(projectId),
    'payroll-register': () => productionApi.reports.payrollRegister(projectId),
    'petty-cash': () => productionApi.reports.pettyCash(projectId),
    'vendor-ytd': () => productionApi.reports.vendorYtd(projectId),
    'cost-to-complete': () => productionApi.reports.costToComplete(projectId),
    'cost-overage': () => productionApi.reports.costOverage(projectId),
    'weekly-green': () => productionApi.reports.weeklyGreen(projectId),
    'check-register': () => productionApi.reports.checkRegister(projectId),
    'fringe-detail': () => productionApi.reports.fringeDetail(projectId),
    'box-1099': () => productionApi.reports.box1099(projectId),
    'trial-balance': () => productionApi.reports.trialBalance(projectId),
    'aicp-bid': () => productionApi.reports.aicpBid(projectId),
  };
  const custom = new Set(['payments-ach']); // rendered with a bespoke body
  const inlineKey = (k: string) => !!fetchers[k] || custom.has(k);
  const view = async (key: string) => {
    if (open === key) { setOpen(null); return; }
    setOpen(key); setData(null);
    const fn = fetchers[key]; if (!fn) return; // custom keys load their own data
    setBusy(true); try { const r = await fn(); setData(r.data); } catch { setData({ error: true }); } finally { setBusy(false); }
  };
  const groups = Array.from(new Set(cat.map(r => r.group)));
  return (
    <div className="card">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><FileBarChart size={12} /> Production Accounting Reports</h4>
      {cat.length === 0 ? <p className="text-xs text-gray-400">Report catalog unavailable — restart the backend.</p> : groups.map(g => (
        <div key={g} className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{g}</p>
          <div className="space-y-1">{cat.filter(r => r.group === g).map(r => { const inline = inlineKey(r.key); return (
            <div key={r.key} className="border border-gray-100 rounded-lg">
              <button onClick={() => inline ? view(r.key) : undefined} className={`w-full flex items-center justify-between px-3 py-2 text-sm ${inline ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}>
                <span className="text-gray-700">{r.name}</span>
                {inline ? (open === r.key ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-300" />) : <span className="text-[10px] text-gray-300">in module tab</span>}
              </button>
              {inline && open === r.key && <div className="px-3 pb-3 border-t border-gray-50">{custom.has(r.key) ? <PaymentsBatch projectId={projectId} money={money} /> : busy ? <p className="text-xs text-gray-400 py-2">Loading…</p> : <GenericReport data={data} money={money} name={r.name} />}</div>}
            </div>); })}</div>
        </div>
      ))}
    </div>
  );
}
