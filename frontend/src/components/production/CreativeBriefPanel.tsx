'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { productionApi, uploadFile } from '@/lib/api';
import { FileText, Plus, Trash2, Save, Compass, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const asArr = (v: any) => Array.isArray(v) ? v : [];
const toText = (v: any) => asArr(v).join(', ');
const fromText = (s: string) => String(s || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);

/**
 * TVC P0 — the creative brief, the level before the script. Paste the client/agency brief,
 * let AI structure it, then edit. The on-brief compass (P1) measures the script against this.
 */
export default function CreativeBriefPanel({ projectId }: { projectId: string }) {
  const [list, setList] = useState<any[]>([]); const [sel, setSel] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ title: '', sourceText: '' });
  const [draft, setDraft] = useState<any>(null);
  const [align, setAlign] = useState<any>(null); const [aligning, setAligning] = useState(false);
  const [prog, setProg] = useState(0); const progRef = useRef<any>(null);
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg(p => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 220); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };

  const load = useCallback(() => { productionApi.brief.list(projectId).then((r: any) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraft(sel ? { ...sel, mandatories: toText(sel.mandatories), durations: toText(sel.durations), aspectRatios: toText(sel.aspectRatios), channels: toText(sel.channels), treatmentDraft: sel.treatmentDraft ?? sel.extracted?.treatmentDraft ?? '', scriptDraft: sel.scriptDraft ?? sel.extracted?.scriptDraft ?? '' } : null); }, [sel]);

  const create = async () => {
    if (!form.title && !form.sourceText) return;
    setBusy(true);
    try { const r = await productionApi.brief.create(projectId, form); setCreating(false); setForm({ title: '', sourceText: '' }); load(); setSel(r.data); }
    catch { alert('Brief needs db:push + a backend restart.'); }
    finally { setBusy(false); }
  };
  const extract = async () => {
    if (!sel) return; setBusy(true); startProg();
    try { const r = await productionApi.brief.extract(sel.id); setSel(r.data); load(); endProg(true); }
    catch (e: any) { endProg(false); const m = e?.response?.data?.message, st = e?.response?.status; alert(m || (st === 404 ? 'Extract endpoint not found — rebuild & restart the backend.' : st === 401 ? 'Anthropic rejected the API key (HTTP 401) — check ANTHROPIC_API_KEY.' : st ? `Extract failed (HTTP ${st}).` : 'Extract failed — is the backend running? Check ANTHROPIC_API_KEY, then restart.')); }
    finally { setBusy(false); }
  };
  const scaffold = async () => {
    if (!sel) return; setBusy(true); startProg();
    try { const r = await productionApi.brief.scaffold(sel.id); setSel(r.data); load(); endProg(true); }
    catch (e: any) { endProg(false); const m = e?.response?.data?.message, st = e?.response?.status; alert(m || (st === 404 ? 'Scaffold endpoint not found — rebuild & restart the backend.' : st === 401 ? 'Anthropic rejected the API key (HTTP 401) — check ANTHROPIC_API_KEY.' : st ? `Scaffold failed (HTTP ${st}).` : 'Scaffold failed — is the backend running? Check ANTHROPIC_API_KEY, then restart.')); }
    finally { setBusy(false); }
  };
  const runAlign = async () => { setAligning(true); try { const r = await productionApi.brief.alignment(projectId); setAlign(r.data); } catch { setAlign(null); } finally { setAligning(false); } };
  const save = async () => {
    if (!draft || !sel) return; setBusy(true);
    try {
      const body = { title: draft.title, sourceText: draft.sourceText, objective: draft.objective, keyMessage: draft.keyMessage, audience: draft.audience, tone: draft.tone, budgetTier: draft.budgetTier, mandatories: fromText(draft.mandatories), durations: fromText(draft.durations).map(Number).filter(Boolean), aspectRatios: fromText(draft.aspectRatios), channels: fromText(draft.channels), treatmentDraft: draft.treatmentDraft, scriptDraft: draft.scriptDraft, status: 'REVIEWED' };
      const r = await productionApi.brief.update(sel.id, body); setSel(r.data); load();
    } catch { alert('Save failed.'); }
    finally { setBusy(false); }
  };
  const remove = async (b: any) => { if (!confirm(`Delete brief "${b.title || 'untitled'}"?`)) return; await productionApi.brief.remove(b.id); if (sel?.id === b.id) setSel(null); load(); };
  const fileRef = useRef<HTMLInputElement>(null);
  const onFiles = async (e: any) => {
    const files = Array.from(e.target.files || []) as File[]; e.target.value = '';
    if (!files.length || !sel) return; setBusy(true);
    try {
      const up: any[] = [];
      for (const f of files) { const u = await uploadFile(f); up.push({ name: u.originalName || f.name, url: u.url, ext: (f.name.split('.').pop() || '').toLowerCase() }); }
      const next = [...asArr(sel.sourceFiles), ...up];
      const r = await productionApi.brief.update(sel.id, { sourceFiles: next }); setSel(r.data); load();
    } catch { alert('Upload failed — needs db:push + a backend restart.'); } finally { setBusy(false); }
  };
  const removeFile = async (i: number) => { if (!sel) return; const next = asArr(sel.sourceFiles).filter((_: any, ix: number) => ix !== i); const r = await productionApi.brief.update(sel.id, { sourceFiles: next }); setSel(r.data); load(); };

  return (
    <div className="son-card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2"><FileText size={15} className="text-brand-600" /><div><div className="text-sm font-semibold text-slate-900">Creative brief</div><div className="son-faint" style={{ fontSize: 11 }}>The level before the script — AI structures it; downstream work should stay on-brief.</div></div></div>
        <button onClick={() => setCreating(c => !c)} className="btn btn-secondary text-xs py-1.5"><Plus size={13} className="me-1" />New brief</button>
      </div>

      {creating && (
        <div className="border border-slate-100 rounded-lg p-2 mb-2 space-y-2">
          <input className="input text-sm h-8 w-full" placeholder="Brief title (e.g. Ramadan 2026 — Hero spot)" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} />
          <textarea className="input text-xs w-full" rows={4} placeholder="Paste the client / agency brief text here…" value={form.sourceText} onChange={e => setForm((f: any) => ({ ...f, sourceText: e.target.value }))} />
          <div className="flex gap-2"><button onClick={create} disabled={busy} className="btn btn-primary text-xs py-1.5">Create</button><button onClick={() => setCreating(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button></div>
        </div>
      )}

      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {list.map(b => (<button key={b.id} onClick={() => setSel(b)} className={cn('text-[11px] px-2 py-1 rounded-lg border', sel?.id === b.id ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-slate-600 border-slate-200')}>{b.title || 'Untitled'}{(b.status === 'STRUCTURED' || b.status === 'REVIEWED') ? ' · ✓' : ''}</button>))}
        </div>
      )}

      {!sel ? <p className="son-faint" style={{ fontSize: 11 }}>{list.length ? 'Select a brief above.' : 'No brief yet — add the client brief to start the creative spine.'}</p> : draft && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">{sel.title || 'Untitled brief'} <span className="son-faint">· {sel.status}</span></span>
            <div className="flex gap-1.5">
              <button onClick={extract} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200">Extract with AI</button>
              <button onClick={scaffold} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-lg border bg-violet-50 text-violet-700 border-violet-200">Scaffold</button>
              <button onClick={save} disabled={busy} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border bg-white text-slate-600 border-slate-200"><Save size={11} /> Save</button>
              <button onClick={() => remove(sel)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={12} /></button>
            </div>
          </div>
          {prog > 0 && (
            <div>
              <div style={{ height: 4, background: '#2a2e35', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${prog}%`, background: '#7c3aed', transition: 'width .25s' }} /></div>
              <div className="son-faint" style={{ fontSize: 10, marginTop: 3 }}>{prog < 100 ? `Working… ${prog}%` : 'Done'}</div>
            </div>
          )}
          <textarea className="input text-xs w-full" rows={3} placeholder="Brief text…" value={draft.sourceText || ''} onChange={e => setDraft((d: any) => ({ ...d, sourceText: e.target.value }))} />
          <div className="flex items-center gap-1.5 flex-wrap">
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.pages,.txt,.rtf,.md" className="hidden" onChange={onFiles} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border bg-white text-slate-600 border-slate-200"><Paperclip size={11} /> Attach brief files</button>
            {asArr(sel.sourceFiles).map((f: any, i: number) => (<span key={i} title={f.name} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">{String(f.name || 'file').slice(0, 26)}<button onClick={() => removeFile(i)} className="text-slate-300 hover:text-rose-500"><X size={10} /></button></span>))}
          </div>
          {asArr(sel.sourceFiles).some((f: any) => ['pages', 'key'].includes(String(f.ext || '').toLowerCase())) && <p className="son-faint" style={{ fontSize: 10 }}>Pages/Keynote are read from their built-in preview; if extraction looks thin, export to PDF.</p>}
          <div className="grid grid-cols-2 gap-2">
            {([['objective', 'Objective'], ['keyMessage', 'Key message (SMP)'], ['audience', 'Audience'], ['tone', 'Tone'], ['budgetTier', 'Budget tier']] as any[]).map(([k, label]: any) => (
              <label key={k} className="text-[11px]"><span className="son-faint">{label}</span><input className="input text-xs h-8 w-full" value={draft[k] || ''} onChange={e => setDraft((d: any) => ({ ...d, [k]: e.target.value }))} /></label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([['mandatories', 'Mandatories'], ['durations', 'Durations (s)'], ['aspectRatios', 'Aspect ratios'], ['channels', 'Channels']] as any[]).map(([k, label]: any) => (
              <label key={k} className="text-[11px]"><span className="son-faint">{label} <span className="text-slate-300">comma-sep</span></span><input className="input text-xs h-8 w-full" value={draft[k] || ''} onChange={e => setDraft((d: any) => ({ ...d, [k]: e.target.value }))} /></label>
            ))}
          </div>
          <label className="text-[11px] block"><span className="son-faint">Treatment (AI draft)</span><textarea className="input text-xs w-full" rows={4} placeholder="Scaffold to draft, or write your own…" value={draft.treatmentDraft || ''} onChange={e => setDraft((d: any) => ({ ...d, treatmentDraft: e.target.value }))} /></label>
          <label className="text-[11px] block"><span className="son-faint">Script beats (AI draft)</span><textarea className="input text-xs w-full" rows={6} value={draft.scriptDraft || ''} onChange={e => setDraft((d: any) => ({ ...d, scriptDraft: e.target.value }))} /></label>
          <div className="border-t border-slate-100 pt-2 mt-1">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Compass size={12} /> On-brief compass</span><button onClick={runAlign} disabled={aligning} className="text-[11px] text-indigo-600">{aligning ? 'Checking…' : 'Run check'}</button></div>
            {align?.hasBrief ? (
              <div className="mt-1.5">
                <div className="flex items-center gap-2 mb-1"><span className={cn('text-lg font-bold', (align.pct ?? 0) >= 80 ? 'text-emerald-600' : (align.pct ?? 0) >= 50 ? 'text-amber-600' : 'text-rose-600')}>{align.pct == null ? '—' : `${align.pct}%`}</span><span className="son-faint" style={{ fontSize: 11 }}>{align.covered}/{align.total} on-brief{!align.hasScript ? ' · no script/treatment yet' : ''}</span></div>
                <div className="flex flex-wrap gap-1">{(align.items || []).map((it: any, i: number) => (<span key={i} title={it.note || ''} className={cn('text-[10px] px-1.5 py-0.5 rounded border', it.status === 'covered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : it.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : it.status === 'missing' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-50 text-gray-400 border-gray-200')}>{String(it.label).length > 30 ? String(it.label).slice(0, 30) + '…' : it.label}</span>))}</div>
              </div>
            ) : align ? <p className="son-faint" style={{ fontSize: 11 }}>No structured brief yet.</p> : <p className="son-faint" style={{ fontSize: 11 }}>Run the check to see mandatories / key-message coverage across the treatment, script &amp; board.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
