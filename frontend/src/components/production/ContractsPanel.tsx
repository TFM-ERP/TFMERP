'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { contractsApi, productionApi, laborApi } from '@/lib/api';
import { FileSignature, FilePlus2, Send, PenLine, CheckCircle2, X, Loader2, Coins, Users, Sparkles } from 'lucide-react';
import { PanelHeader, Chip, Btn, EmptyState, SectionLabel, inputCls } from './ui';
import EmailInput from '@/components/EmailInput';

const money = (n: any, c = 'AED') => (n == null || n === '' ? '—' : `${c} ${Number(n).toLocaleString()}`);
const STATUS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', PENDING_APPROVAL: 'bg-amber-100 text-amber-700', APPROVED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-indigo-100 text-indigo-700', PARTIALLY_SIGNED: 'bg-violet-100 text-violet-700', SIGNED: 'bg-emerald-100 text-emerald-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700', COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-rose-100 text-rose-700',
};
const STATUS_TONE: Record<string, string> = {
  DRAFT: 'slate', PENDING_APPROVAL: 'need', APPROVED: 'money', SENT: 'link', PARTIALLY_SIGNED: 'cast',
  SIGNED: 'money', ACTIVE: 'money', COMPLETED: 'money', CANCELLED: 'risk',
};
const md = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/^## (.*)$/gm, '<h4 class="font-semibold mt-3 mb-1 text-slate-800">$1</h4>')
  .replace(/^# (.*)$/gm, '<h3 class="font-bold mt-2 mb-2">$1</h3>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

export default function ContractsPanel({ projectId }: { projectId: string }) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);

  const load = useCallback(() => {
    contractsApi.list(projectId).then((r) => setContracts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [projectId]);
  useEffect(() => { load(); contractsApi.templates().then((r) => setTemplates(r.data || [])).catch(() => {}); }, [load]);

  return (
    <div className="font-sans">
      <PanelHeader
        icon={FileSignature}
        title="Contracts & Deal Memos"
        subtitle="Contracts for this project. Full signature encumbers the budget."
        actions={<Btn variant="primary" onClick={() => setOpen(true)}><FilePlus2 size={15} /> New contract</Btn>}
      />

      {contracts.length === 0 ? (
        <EmptyState icon={FileSignature}>No contracts for this project yet.</EmptyState>
      ) : (
        <div className="grid gap-2.5">
          {contracts.map((c) => (
            <button key={c.id} onClick={() => contractsApi.get(c.id).then((r) => setView(r.data))} className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-medium text-slate-900">{c.contractNumber}</span><Chip tone={STATUS_TONE[c.status] || 'slate'}>{c.status.replace(/_/g, ' ')}</Chip></div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{c.title}</p>
                </div>
                <span className="text-sm font-semibold text-slate-800 shrink-0">{money(c.contractValue, c.currency)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && <NewContractModal projectId={projectId} templates={templates} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
      {view && <ContractDrawer contract={view} onClose={() => setView(null)} onRefresh={() => contractsApi.get(view.id).then((r) => setView(r.data))} onListRefresh={load} />}
    </div>
  );
}

function NewContractModal({ projectId, templates, onClose, onDone }: any) {
  const [crew, setCrew] = useState<any[]>([]);
  const [f, setF] = useState<any>({ templateId: '', productionCrewId: '', counterpartyEmail: '', contractValue: '', startDate: '', endDate: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { productionApi.crew.list(projectId).then((r) => setCrew(Array.isArray(r.data) ? r.data : (r.data?.items || []))).catch(() => {}); }, [projectId]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const member = useMemo(() => crew.find((c) => c.id === f.productionCrewId), [crew, f.productionCrewId]);

  const submit = async () => {
    if (!f.templateId || (!f.productionCrewId && !f.counterpartyEmail)) return;
    setBusy(true);
    try {
      await contractsApi.generate({
        templateId: f.templateId, projectId, productionCrewId: f.productionCrewId || undefined,
        counterpartyEmail: f.counterpartyEmail || undefined, contractValue: f.contractValue === '' ? undefined : Number(f.contractValue),
        startDate: f.startDate || undefined, endDate: f.endDate || undefined,
      });
      onDone();
    } finally { setBusy(false); }
  };
  const inp = inputCls;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New contract</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 space-y-3">
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Template *</span>
            <select className={inp} value={f.templateId} onChange={(e) => set('templateId', e.target.value)}><option value="">Select…</option>{templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Crew member (pulls frozen rate)</span>
            <select className={inp} value={f.productionCrewId} onChange={(e) => set('productionCrewId', e.target.value)}><option value="">— select crew —</option>{crew.map((c) => <option key={c.id} value={c.id}>{c.name}{c.roleTitle || c.role ? ` · ${c.roleTitle || c.role}` : ''}</option>)}</select></label>
          {member && (
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 text-xs">
              <p className="font-medium text-slate-700 inline-flex items-center gap-1.5 mb-1"><Sparkles size={12} className="text-[#0f172a]" /> Frozen rate snapshot</p>
              <div className="flex items-center justify-between text-slate-600"><span className="inline-flex items-center gap-1"><Coins size={11} /> Daily</span><b>{money(member.dailyRate, member.currency)}</b></div>
              <div className="flex items-center justify-between text-slate-600"><span className="inline-flex items-center gap-1"><Coins size={11} /> Weekly</span><b>{money(member.weeklyRate, member.currency)}</b></div>
            </div>
          )}
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Counterparty email (for e-sign)</span><EmailInput className={inp} value={f.counterpartyEmail} onChange={(e) => set('counterpartyEmail', e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm"><span className="block text-xs font-medium text-slate-500 mb-1">Contract value</span><input type="number" className={inp} value={f.contractValue} onChange={(e) => set('contractValue', e.target.value)} placeholder="auto from rate" /></label>
            <label className="text-sm"><span className="block text-xs font-medium text-slate-500 mb-1">Start</span><input type="date" className={inp} value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || !f.templateId}>{busy && <Loader2 size={14} className="animate-spin" />} Draft</Btn>
        </div>
      </div>
    </div>
  );
}

export function ContractDrawer({ contract: c, onClose, onRefresh, onListRefresh }: any) {
  const [busy, setBusy] = useState('');
  const act = async (label: string, fn: () => Promise<any>) => { setBusy(label); try { await fn(); await onRefresh(); onListRefresh(); } finally { setBusy(''); } };
  const sendable = ['DRAFT', 'APPROVED', 'PENDING_APPROVAL'].includes(c.status);
  const signable = ['SENT', 'PARTIALLY_SIGNED'].includes(c.status);
  const simulate = (p: any) => act(p.id, () => contractsApi.simulateSign({ envelopeId: c.esignEnvelopeId, status: 'signed', signerEmail: p.email, providerEventId: `sim-${p.id}-${Date.now()}`, ip: '127.0.0.1', documentHash: 'simulated' }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{c.contractNumber}</span><Chip tone={STATUS_TONE[c.status] || 'slate'}>{c.status.replace(/_/g, ' ')}</Chip></div>
          <div className="flex items-center gap-2">
            {sendable && <Btn variant="primary" onClick={() => act('send', () => contractsApi.send(c.id))} disabled={!!busy}>{busy === 'send' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send</Btn>}
            {signable && <Btn variant="secondary" onClick={() => act('wet', () => contractsApi.markSigned(c.id))} disabled={!!busy}>{busy === 'wet' ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />} Wet-sign</Btn>}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5">
          {c.purchaseOrder && <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800"><CheckCircle2 size={14} /> Executed — {c.purchaseOrder.poNumber} ({money(c.purchaseOrder.total, c.currency)}){c.purchaseOrder.costCenterCode ? ` · cost center ${c.purchaseOrder.costCenterCode}` : ''}.</div>}
          <SectionLabel icon={Users}>Signatories</SectionLabel>
          <div className="space-y-2 mb-5">
            {(c.parties || []).map((p: any) => (
              <div key={p.id} className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-2.5 flex items-center justify-between">
                <div><div className="text-sm font-medium text-slate-800">{p.name}</div><div className="text-[11px] text-slate-400">{p.role} · {p.signatureStatus}{p.email ? ` · ${p.email}` : ''}</div></div>
                {signable && p.signatureStatus !== 'SIGNED' && <button onClick={() => simulate(p)} disabled={!!busy} className="text-[11px] inline-flex items-center gap-1 text-indigo-600 hover:underline disabled:opacity-40">{busy === p.id ? <Loader2 size={11} className="animate-spin" /> : <PenLine size={11} />} Simulate</button>}
              </div>
            ))}
          </div>
          <article className="rounded-xl border border-slate-200 p-5 text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: md(c.bodyMarkdown || '_No body._') }} />
        </div>
      </div>
    </div>
  );
}
