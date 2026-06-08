'use client';

import { useEffect, useState, useCallback } from 'react';
import { Landmark, Save, ChevronDown, ChevronRight, CheckCircle2, Circle, MinusCircle, Info, FileText, Upload, Clock, AlertTriangle } from 'lucide-react';
import { laborApi, productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

const STAGE_STATUS = ['PENDING', 'DONE', 'NA'];

// Required supporting documents (ADFC Guidelines, Appendix 2A/2B) — matched against the vault.
const REQUIRED_DOCS = [
  { key: 'budget', label: 'Itemised production budget + ADQPE worksheet', kw: ['budget', 'adqpe', 'cost report'] },
  { key: 'financier', label: 'Executed financier / financing agreement(s)', kw: ['financ', 'investor', 'loan'] },
  { key: 'services', label: 'Production services agreement', kw: ['service agreement', 'production service', 'services'] },
  { key: 'insurance', label: 'Production insurance binder', kw: ['insurance', 'binder'] },
  { key: 'bank', label: 'Single-purpose Abu Dhabi bank account confirmation', kw: ['bank'] },
  { key: 'content', label: 'Content / Media Council script approval', kw: ['content approval', 'media council', 'script approval', 'cma'] },
  { key: 'auditor', label: 'Approved-auditor expenditure statement', kw: ['audit'] },
  { key: 'interim', label: 'Interim Certificate', kw: ['interim'] },
  { key: 'final', label: 'Final Certificate', kw: ['final certificate', 'final cert'] },
];

const addDays = (d: any, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysLeft = (due: Date) => Math.ceil((due.getTime() - Date.now()) / 86400000);

function enhancedPct(points: number): number {
  if (points >= 85) return 0.15;
  if (points >= 70) return 0.10;
  if (points >= 40) return 0.075;
  if (points >= 15) return 0.05;
  if (points >= 10) return 0.025;
  return 0;
}

export default function AdRebateTracker({ projectId, onNavigate }: { projectId: string; onNavigate?: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<any>(null); // working state (claim or scaffold)
  const [docs, setDocs] = useState<any[]>([]);
  const [wrapDate, setWrapDate] = useState<string | null>(null);
  const [bank, setBank] = useState<any>(null); // dedicated-account compliance (ADFC)

  const load = useCallback(() => {
    laborApi.getClaim(projectId).then((r) => {
      const base = r.data.claim || r.data.scaffold;
      setS({
        programName: base.programName, currency: base.currency || 'AED',
        criteria: base.criteria || [], adqpe: base.adqpe ?? '', capAmount: base.capAmount ?? '',
        stages: base.stages || [], notes: base.notes || '',
      });
      setLoaded(true);
    }).catch(() => setLoaded(true));
    productionApi.documents.list(projectId).then((r) => setDocs(r.data || r.data?.items || [])).catch(() => {});
    productionApi.projects.get(projectId).then((r) => setWrapDate(r.data?.shootEndDate || null)).catch(() => {});
    productionApi.projects.bank(projectId).then((r) => setBank(r.data)).catch(() => {});
  }, [projectId]);
  useEffect(() => { if (open && !loaded) load(); }, [open, loaded, load]);

  const money = (n: any) => formatCurrency(n || 0, s?.currency || 'AED');

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="card w-full flex items-center justify-between hover:border-brand-300 transition-colors">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Landmark size={15} className="text-brand-600" /> Abu Dhabi Rebate Tracker</span>
        <ChevronRight size={16} className="text-gray-400" />
      </button>
    );
  }
  if (!s) return <div className="card text-sm text-gray-400">Loading…</div>;

  // ADFC audit chain: dedicated bank account is a hard prerequisite for the claim.
  const bankBlocked = bank && !bank.compliant && (bank.requiredByPrograms || []).length > 0;

  const points = (s.criteria || []).filter((c: any) => c.selected).reduce((t: number, c: any) => t + (Number(c.points) || 0), 0);
  const enh = enhancedPct(points);
  const total = 0.35 + enh;
  const adqpe = Number(s.adqpe) || 0;
  const cap = s.capAmount === '' || s.capAmount == null ? null : Number(s.capAmount);
  let estimate = adqpe * total;
  const capped = cap != null && estimate > cap;
  if (capped) estimate = cap;

  const toggleCrit = (i: number) => setS((x: any) => ({ ...x, criteria: x.criteria.map((c: any, j: number) => j === i ? { ...c, selected: !c.selected } : c) }));
  const setPoints = (i: number, v: string) => setS((x: any) => ({ ...x, criteria: x.criteria.map((c: any, j: number) => j === i ? { ...c, points: Number(v) || 0 } : c) }));
  const setStage = (i: number, patch: any) => setS((x: any) => ({ ...x, stages: x.stages.map((st: any, j: number) => j === i ? { ...st, ...patch } : st) }));

  const save = async () => {
    setBusy(true);
    try { await laborApi.saveClaim(projectId, { ...s, adqpe: s.adqpe === '' ? null : Number(s.adqpe), capAmount: s.capAmount === '' ? null : Number(s.capAmount) }); alert('Abu Dhabi rebate claim saved.'); }
    catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  const StageIcon = ({ status }: { status: string }) => status === 'DONE'
    ? <CheckCircle2 size={15} className="text-green-500" />
    : status === 'NA' ? <MinusCircle size={15} className="text-gray-300" /> : <Circle size={15} className="text-gray-300" />;

  // ── derived statutory deadlines ──
  const stageDate = (k: string) => (s.stages.find((x: any) => x.key === k) || {}).date || null;
  const interimDate = stageDate('interim_certificate');
  const finalDate = stageDate('final_certificate');
  const ppStart = stageDate('principal_photography');
  const deadlines: Record<string, Date | null> = {
    principal_photography: interimDate ? addDays(interimDate, 90) : null, // within 90 days of interim cert
    audited_statement: (wrapDate || ppStart) ? addDays(wrapDate || ppStart, 180) : null, // within 180 days of wrap
    payment: finalDate ? addDays(finalDate, 30) : null, // ~30 business days of final cert
  };
  const DeadlineChip = ({ due, done }: { due: Date | null; done: boolean }) => {
    if (!due || done) return null;
    const n = daysLeft(due);
    const over = n < 0;
    return (
      <span className={cn('text-[10px] rounded px-1 py-0.5 inline-flex items-center gap-0.5', over ? 'bg-red-100 text-red-700' : n <= 14 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500')}>
        {over ? <AlertTriangle size={9} /> : <Clock size={9} />}
        {over ? `overdue ${Math.abs(n)}d` : `due in ${n}d`} · {due.toLocaleDateString()}
      </span>
    );
  };

  // ── document checklist (matched against the vault) ──
  const hay = (d: any) => `${d.name || ''} ${d.category || ''}`.toLowerCase();
  const docPresent = (kw: string[]) => docs.some((d) => kw.some((k) => hay(d).includes(k)));

  return (
    <div className="card space-y-4">
      <button onClick={() => setOpen(false)} className="w-full flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Landmark size={15} className="text-brand-600" /> Abu Dhabi Rebate Tracker</span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {/* ADFC prerequisite: dedicated production bank account (audit chain) */}
      {bankBlocked && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2">
          <b>Dedicated production bank account not linked.</b> ADFC's audit traces every qualifying dirham
          bank statement → books → ADQPE — the claim cannot advance without it. Link both halves in
          Project Settings ▸ Dedicated production bank account.
        </div>
      )}
      {bank?.compliant && bank?.requiredByPrograms?.length > 0 && (
        <div className="text-[11px] bg-green-50 border border-green-100 text-green-700 rounded-lg px-3 py-1.5">
          Dedicated account linked{bank.lastReconciliation ? ` · last reconciliation ${new Date(bank.lastReconciliation.statementDate).toLocaleDateString('en-GB')} (${bank.lastReconciliation.status})` : ' · no reconciliation run yet'}.
        </div>
      )}

      {/* Rate summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg bg-gray-50 p-3"><p className="text-[10px] uppercase text-gray-400 font-semibold">Standard</p><p className="text-lg font-bold text-gray-900">35%</p></div>
        <div className="rounded-lg bg-gray-50 p-3"><p className="text-[10px] uppercase text-gray-400 font-semibold">Enhanced ({points} pts)</p><p className="text-lg font-bold text-gray-900">+{(enh * 100).toFixed(1)}%</p></div>
        <div className="rounded-lg bg-brand-50 p-3"><p className="text-[10px] uppercase text-brand-500 font-semibold">Total Rebate</p><p className="text-lg font-bold text-brand-700">{(total * 100).toFixed(1)}%</p></div>
        <div className="rounded-lg bg-green-50 p-3"><p className="text-[10px] uppercase text-green-600 font-semibold">Est. Rebate{capped ? ' (capped)' : ''}</p><p className="text-lg font-bold text-green-700">{money(estimate)}</p></div>
      </div>

      {/* ADQPE + cap */}
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div><label className="label text-xs">ADQPE (qualifying spend, {s.currency})</label>
          <input type="number" className="input w-full" value={s.adqpe} onChange={(e) => setS((x: any) => ({ ...x, adqpe: e.target.value }))} placeholder="Abu Dhabi qualifying spend only" /></div>
        <div><label className="label text-xs">Cap ({s.currency})</label>
          <input type="number" className="input w-full" value={s.capAmount} onChange={(e) => setS((x: any) => ({ ...x, capAmount: e.target.value }))} /></div>
      </div>

      {/* Enhanced criteria / points */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Enhanced Rebate criteria (points)</h4>
        <p className="text-[11px] text-gray-400 mb-2">Bands: 10–14→2.5% · 15–39→5% · 40–69→7.5% · 70–84→10% · 85+→15%. Enhanced applies to narrative/animated features, IMAX, TV programmes/series & HETV drama only. ADFC awards points at its discretion.</p>
        <div className="space-y-1">
          {(s.criteria || []).map((c: any, i: number) => (
            <label key={c.key} className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer', c.selected ? 'border-brand-300 bg-brand-50' : 'border-gray-200')}>
              <input type="checkbox" checked={!!c.selected} onChange={() => toggleCrit(i)} />
              <span className="flex-1 text-sm text-gray-700">{c.label}{!c.confirmed && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 rounded px-1">indicative</span>}</span>
              <input type="number" className="input text-xs w-16 h-7 text-right" value={c.points} onChange={(e) => setPoints(i, e.target.value)} />
              <span className="text-[10px] text-gray-400">pts</span>
            </label>
          ))}
        </div>
      </div>

      {/* Certificate / audit stages */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Certificate & audit process</h4>
        <div className="space-y-1.5">
          {(s.stages || []).map((st: any, i: number) => (
            <div key={st.key} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
              <StageIcon status={st.status} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-sm', st.status === 'DONE' ? 'text-gray-500' : 'text-gray-800')}>{i + 1}. {st.label}</span>
                  <select className="input text-[11px] h-6 py-0" value={st.status} onChange={(e) => setStage(i, { status: e.target.value })}>
                    {STAGE_STATUS.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
                  </select>
                  <input type="date" className="input text-[11px] h-6 py-0 w-32" value={st.date || ''} onChange={(e) => setStage(i, { date: e.target.value })} />
                  <DeadlineChip due={deadlines[st.key] || null} done={st.status === 'DONE' || st.status === 'NA'} />
                </div>
                {st.note && <p className="text-[10px] text-gray-400 mt-0.5">{st.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Required documents checklist (matched against the vault) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required documents</h4>
          {onNavigate && <button onClick={() => onNavigate('documents')} className="text-[11px] text-brand-600 inline-flex items-center gap-1"><Upload size={11} /> Open document vault</button>}
        </div>
        <div className="grid md:grid-cols-2 gap-1">
          {REQUIRED_DOCS.map((rd) => {
            const present = docPresent(rd.kw);
            return (
              <div key={rd.key} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg">
                {present ? <CheckCircle2 size={14} className="text-green-500 shrink-0" /> : <FileText size={14} className="text-gray-300 shrink-0" />}
                <span className={cn('flex-1', present ? 'text-gray-600' : 'text-gray-500')}>{rd.label}</span>
                <span className={cn('text-[10px] rounded px-1', present ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')}>{present ? 'on file' : 'missing'}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Detected by matching document names/categories in the project vault. Name uploads clearly (e.g. "ADQPE worksheet", "Production services agreement") so they're recognised.</p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="btn btn-primary text-xs"><Save size={13} className="mr-1" /> {busy ? 'Saving…' : 'Save claim'}</button>
        <span className="text-[11px] text-gray-400 flex items-center gap-1"><Info size={11} /> Estimate only — not tax advice. Confirm ADQPE, points & caps with ADFC (rebates@film.gov.ae).</span>
      </div>
    </div>
  );
}
