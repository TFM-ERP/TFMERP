'use client';

import { useState, useEffect, useCallback } from 'react';
import { contractsApi } from '@/lib/api';
import { ContractDrawer } from '@/components/production/ContractsPanel';
import { FileSignature, FilePlus2, X, Loader2, Building2, Send, AlarmClock } from 'lucide-react';

const money = (n: any, c = 'AED') => (n == null || n === '' ? '—' : `${c} ${Number(n).toLocaleString()}`);
const STATUS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', PENDING_APPROVAL: 'bg-amber-100 text-amber-700', APPROVED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-indigo-100 text-indigo-700', PARTIALLY_SIGNED: 'bg-violet-100 text-violet-700', SIGNED: 'bg-emerald-100 text-emerald-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700', COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-rose-100 text-rose-700',
};
const projLabel = (c: any) => (c.project ? (c.project.isHouse ? 'House / Corporate' : c.project.title) : 'Standalone');

export default function ContractsMaster() {
  const [dash, setDash] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [scope, setScope] = useState<'all' | 'standalone'>('all');
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);

  const load = useCallback(() => {
    contractsApi.dashboard().then((r) => setDash(r.data)).catch(() => {});
    contractsApi.list(scope === 'standalone' ? { scope: 'standalone' } : {}).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [scope]);
  useEffect(() => { load(); contractsApi.templates().then((r) => setTemplates(r.data || [])).catch(() => {}); }, [load]);

  const total = (g: any[] = []) => g.reduce((a, x) => a + (x._count || 0), 0);
  const byStatus = (g: any[] = [], ks: string[]) => g.filter((x) => ks.includes(x.status)).reduce((a, x) => a + (x._count || 0), 0);

  return (
    <div className="font-sans p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><FileSignature className="text-[#0f172a]" /> Contracts</h1>
          <p className="text-sm text-slate-500 mt-0.5">All contracts across projects, plus standalone corporate agreements.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800"><FilePlus2 size={16} /> New standalone contract</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={<FileSignature size={16} />} label="Total" value={total(dash?.byStatus)} />
        <Stat icon={<Send size={16} />} label="Awaiting signature" value={byStatus(dash?.byStatus, ['SENT', 'PARTIALLY_SIGNED'])} tone="indigo" />
        <Stat icon={<FileSignature size={16} />} label="Active" value={byStatus(dash?.byStatus, ['ACTIVE'])} tone="emerald" />
        <Stat icon={<Building2 size={16} />} label="Standalone" value={dash?.standalone ?? 0} tone="slate" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card title="Awaiting signature" icon={<Send size={15} />}>
          {(dash?.awaitingSignature || []).length === 0 ? <Empty>None out for signature.</Empty> : dash.awaitingSignature.map((c: any) => (
            <button key={c.id} onClick={() => contractsApi.get(c.id).then((r) => setView(r.data))} className="w-full text-left"><Row left={c.contractNumber} sub={`${c.title} · ${projLabel(c)}`} right={c.status.replace(/_/g, ' ')} /></button>
          ))}
        </Card>
        <Card title="Expiring within 30 days" icon={<AlarmClock size={15} />}>
          {(dash?.expiringSoon || []).length === 0 ? <Empty>None expiring soon.</Empty> : dash.expiringSoon.map((c: any) => (
            <button key={c.id} onClick={() => contractsApi.get(c.id).then((r) => setView(r.data))} className="w-full text-left"><Row left={c.contractNumber} sub={`${c.title} · ${projLabel(c)}`} right={c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'} /></button>
          ))}
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Toggle active={scope === 'all'} onClick={() => setScope('all')}>All projects</Toggle>
        <Toggle active={scope === 'standalone'} onClick={() => setScope('standalone')}>Standalone only</Toggle>
      </div>
      <div className="grid gap-2.5">
        {rows.length === 0 ? <Empty>No contracts.</Empty> : rows.map((c) => (
          <button key={c.id} onClick={() => contractsApi.get(c.id).then((r) => setView(r.data))} className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-900">{c.contractNumber}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS[c.status] || 'bg-slate-100'}`}>{c.status.replace(/_/g, ' ')}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${c.project ? (c.project.isHouse ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700') : 'bg-amber-50 text-amber-700'}`}><Building2 size={11} /> {projLabel(c)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{c.title}</p>
            </div>
            <span className="text-sm font-semibold text-slate-800 shrink-0">{money(c.contractValue, c.currency)}</span>
          </button>
        ))}
      </div>

      {open && <StandaloneContractModal templates={templates} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
      {view && <ContractDrawer contract={view} onClose={() => setView(null)} onRefresh={() => contractsApi.get(view.id).then((r) => setView(r.data))} onListRefresh={load} />}
    </div>
  );
}

function StandaloneContractModal({ templates, onClose, onDone }: any) {
  const [f, setF] = useState<any>({ templateId: '', title: '', counterpartyName: '', counterpartyEmail: '', contractValue: '', currency: 'AED', startDate: '', endDate: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const submit = async () => {
    if (!f.templateId || !f.counterpartyName) return;
    setBusy(true);
    try {
      await contractsApi.generate({
        templateId: f.templateId, // no projectId → standalone / corporate
        title: f.title || undefined, counterpartyName: f.counterpartyName, counterpartyEmail: f.counterpartyEmail || undefined,
        counterpartyRole: 'CONTRACTOR', contractValue: f.contractValue === '' ? undefined : Number(f.contractValue),
        currency: f.currency, startDate: f.startDate || undefined, endDate: f.endDate || undefined,
      });
      onDone();
    } finally { setBusy(false); }
  };
  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New standalone contract</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 space-y-3">
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">No project — this posts to the House/Corporate ledger on full signature.</p>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Template *</span><select className={inp} value={f.templateId} onChange={(e) => set('templateId', e.target.value)}><option value="">Select…</option>{templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Counterparty *</span><input className={inp} value={f.counterpartyName} onChange={(e) => set('counterpartyName', e.target.value)} /></label>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Counterparty email</span><input className={inp} value={f.counterpartyEmail} onChange={(e) => set('counterpartyEmail', e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm"><span className="block text-xs font-medium text-slate-500 mb-1">Value</span><input type="number" className={inp} value={f.contractValue} onChange={(e) => set('contractValue', e.target.value)} /></label>
            <label className="text-sm"><span className="block text-xs font-medium text-slate-500 mb-1">Currency</span><input className={inp} value={f.currency} onChange={(e) => set('currency', e.target.value)} /></label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !f.templateId || !f.counterpartyName} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Draft</button>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = { default: 'text-slate-900', indigo: 'text-indigo-600', emerald: 'text-emerald-600', slate: 'text-slate-500' };
function Stat({ icon, label, value, tone = 'default' }: any) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-1.5 text-slate-400 text-xs">{icon}{label}</div><div className={`text-2xl font-semibold mt-1 ${TONE[tone]}`}>{value}</div></div>;
}
function Card({ title, icon, children }: any) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">{icon}{title}</p><div className="space-y-1">{children}</div></div>;
}
function Row({ left, sub, right }: any) {
  return <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"><div className="min-w-0"><div className="text-sm text-slate-800 truncate">{left}</div><div className="text-[11px] text-slate-400 truncate">{sub}</div></div><span className="text-xs text-slate-500 shrink-0 ml-2">{right}</span></div>;
}
function Empty({ children }: any) { return <p className="text-xs text-slate-400 py-2">{children}</p>; }
function Toggle({ active, onClick, children }: any) {
  return <button onClick={onClick} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{children}</button>;
}
