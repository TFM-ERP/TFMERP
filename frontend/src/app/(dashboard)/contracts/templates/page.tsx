'use client';

import { useState, useEffect, useCallback } from 'react';
import { contractsApi } from '@/lib/api';
import { ScrollText, Plus, X, Loader2, FileText } from 'lucide-react';

const TYPES = ['DEAL_MEMO', 'CREW_AGREEMENT', 'TALENT_AGREEMENT', 'SERVICE_AGREEMENT', 'NDA', 'LOCATION_AGREEMENT', 'VENDOR_AGREEMENT', 'RELEASE_FORM', 'OTHER'];

export default function TemplatesDirectory() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);
  const load = useCallback(() => { contractsApi.templates().then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="font-sans p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><ScrollText className="text-[#0f172a]" /> Contract Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">Master template library — used by drafting and the casting deal-memo handoff.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800"><Plus size={16} /> New template</button>
      </div>

      <div className="grid gap-2">
        {rows.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No templates. Seed the default with prisma/seed-deal-memo-template.js.</p> : rows.map((t) => (
          <button key={t.id} onClick={() => contractsApi.template(t.id).then((r) => setView(r.data))} className="text-left rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between hover:shadow-md transition">
            <div><div className="font-medium text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.type?.replace(/_/g, ' ')} · {t._count?.projectContracts ?? 0} contracts · {t.clauses?.length ?? 0} clauses</div></div>
            <FileText size={16} className="text-slate-300" />
          </button>
        ))}
      </div>

      {open && <NewTemplateModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
      {view && <ViewTemplate t={view} onClose={() => setView(null)} />}
    </div>
  );
}

function NewTemplateModal({ onClose, onDone }: any) {
  const [f, setF] = useState<any>({ name: '', type: 'DEAL_MEMO', governingLaw: 'UAE Federal Law', jurisdiction: 'Abu Dhabi Courts', bodyMarkdown: '# {{project_title}}\n\nBetween {{company_name}} and {{counterparty_name}} for the role of {{role}} at {{daily_rate}}/day.' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const submit = async () => { if (!f.name || !f.bodyMarkdown) return; setBusy(true); try { await contractsApi.addTemplate(f); onDone(); } finally { setBusy(false); } };
  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New template</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm"><span className="block text-xs font-medium text-slate-500 mb-1">Name *</span><input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label className="text-sm"><span className="block text-xs font-medium text-slate-500 mb-1">Type</span><select className={inp} value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></label>
          </div>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Body (markdown, supports {'{{variables}}'})</span><textarea rows={8} className={`${inp} font-mono text-[12px]`} value={f.bodyMarkdown} onChange={(e) => set('bodyMarkdown', e.target.value)} /></label>
          <p className="text-[11px] text-slate-400">Variables: {'{{project_title}}, {{company_name}}, {{counterparty_name}}, {{role}}, {{daily_rate}}, {{weekly_rate}}, {{contract_value}}, {{start_date}}, {{governing_law}}'}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !f.name} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}

function ViewTemplate({ t, onClose }: any) {
  const html = (t.bodyMarkdown || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/^## (.*)$/gm, '<h4 class="font-semibold mt-3">$1</h4>').replace(/^# (.*)$/gm, '<h3 class="font-bold mt-2">$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 glass-bar"><div><div className="font-semibold text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.type?.replace(/_/g, ' ')}</div></div><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5">
          <article className="rounded-xl border border-slate-200 p-5 text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
          {(t.clauses || []).length > 0 && <div className="mt-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Clauses</p>{t.clauses.map((c: any) => <div key={c.id} className="text-sm text-slate-700 border-b border-slate-50 py-2"><b>{c.title}</b>{c.isMandatory ? ' (mandatory)' : ''}<div className="text-xs text-slate-500">{c.bodyMarkdown}</div></div>)}</div>}
        </div>
      </div>
    </div>
  );
}
