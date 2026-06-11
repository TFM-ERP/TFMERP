'use client';

import { useState, useEffect, useCallback } from 'react';
import { assessmentApi, productionApi, assetUrl } from '@/lib/api';
import { X, Save, Plus, ClipboardCheck, Star, BarChart3, Trophy, Trash2, FileText, ShieldAlert, Upload, Coins, Sparkles, Send, FolderArchive, CheckCircle2, AlertTriangle, FileSignature, Shield, Mail } from 'lucide-react';
import { SecurityTab, PaymentsTab, OpsAdapter } from './LocationOps';

// Project-scope adapter for the shared ops tabs (ledger-aware).
const projectOps = (lc: any): OpsAdapter => ({
  authorities: lc.authorities,
  listSecurity: lc.security, addSecurity: lc.addSecurity, updSecurity: lc.updSecurity, delSecurity: lc.delSecurity, postSecurity: lc.postSecurity,
  listPayments: lc.payments, paySummary: lc.paySummary, addPayment: lc.addPayment, updPayment: lc.updPayment, delPayment: lc.delPayment, payPayment: lc.payPayment,
});

// HOD-style recce taxonomy (SYS-07 V2 · Slice 5) + legacy departments kept for back-compat.
const DEPARTMENTS = ['DIRECTOR', 'FIRST_AD', 'DOP', 'GAFFER', 'GRIP', 'SOUND', 'SFX', 'STUNTS', 'ART_PD', 'COSTUME_MAKEUP', 'PRODUCER', 'LM', 'TRANSPORT', 'SAFETY', 'CAMERA', 'ELECTRIC', 'ART', 'CONSTRUCTION', 'SECURITY', 'VFX', 'LOCATIONS', 'OTHER'];
const DEPT_LABEL: Record<string, string> = { FIRST_AD: '1st AD', ART_PD: 'Art / PD', COSTUME_MAKEUP: 'Costume & Makeup', LM: 'Location Mgr', DOP: 'DoP' };
const deptLabel = (d: string) => DEPT_LABEL[d] || d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SEVERITIES: { key: string; label: string; cls: string }[] = [
  { key: 'INFO', label: 'Info', cls: 'bg-slate-100 text-slate-600' },
  { key: 'LOW', label: 'Low', cls: 'bg-sky-100 text-sky-700' },
  { key: 'MEDIUM', label: 'Medium', cls: 'bg-amber-100 text-amber-700' },
  { key: 'HIGH', label: 'High', cls: 'bg-orange-100 text-orange-700' },
  { key: 'BLOCKER', label: 'Blocker', cls: 'bg-rose-100 text-rose-700' },
];
const sevCls = (s: string) => SEVERITIES.find((x) => x.key === s)?.cls || SEVERITIES[0].cls;

// Department concern checklists — generic items + per-department prompts.
const CHECKLIST_GENERIC: [string, string][] = [
  ['access', 'Access & approach for unit/trucks'], ['parking', 'Parking & holding / basecamp'],
  ['hazards', 'Hazards & clearances'], ['hospital', 'Nearest hospital / medical'], ['restore', 'Set restoration / make-good'],
];
const CHECKLIST_BY_DEPT: Record<string, [string, string][]> = {
  DOP: [['light', 'Light direction & sun-path'], ['power', 'Power vs generator'], ['sightlines', 'Sightlines & camera positions']],
  GAFFER: [['power', 'Power vs generator + genny placement'], ['rig', 'Rig points & distribution'], ['light', 'Ambient / practical light']],
  GRIP: [['rig', 'Rig points & mounting'], ['craneTrack', 'Crane / track / dolly run']],
  SOUND: [['ambient', 'Ambient / background noise'], ['flightPath', 'Flight path / traffic / AC hum']],
  SFX: [['hazards', 'Pyro / atmos clearances'], ['water', 'Water / fire safety']],
  STUNTS: [['hazards', 'Stunt hazards & rigging'], ['safety', 'Safety perimeter & padding']],
  ART_PD: [['dressing', 'Set dressing scope'], ['restore', 'Restore / make-good']],
  FIRST_AD: [['holding', 'Holding / crowd / extras'], ['truckCount', 'Truck count & unit base']],
  TRANSPORT: [['truckCount', 'Truck count & turnaround'], ['parking', 'Parking & route']],
  SAFETY: [['hospital', 'Nearest hospital'], ['hazards', 'Hazard register'], ['fire', 'Fire / evac route']],
  LM: [['permit', 'Permit feasibility'], ['neighbours', 'Neighbours / noise window']],
};
const checklistFor = (dept: string): [string, string][] => [...CHECKLIST_GENERIC, ...(CHECKLIST_BY_DEPT[dept] || [])];

const CRITERIA: { key: string; label: string; hint?: string }[] = [
  { key: 'visual', label: 'Visual / look' },
  { key: 'access', label: 'Access & parking' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'cost', label: 'Cost value' },
  { key: 'safety', label: 'Safety' },
  { key: 'productionValue', label: 'Production value' },
  { key: 'permitComplexity', label: 'Permit complexity', hint: 'higher = more complex (scored inversely)' },
  { key: 'feasibility', label: 'Feasibility' },
  { key: 'comfort', label: 'Cast/crew comfort' },
  { key: 'schedule', label: 'Schedule fit' },
];

const REC_CLS: Record<string, string> = {
  RECOMMENDED: 'bg-green-100 text-green-700', ACCEPTABLE: 'bg-amber-100 text-amber-700', NOT_RECOMMENDED: 'bg-red-100 text-red-700',
};

function previewScore(scores: Record<string, number>) {
  let total = 0, wsum = 0;
  for (const c of CRITERIA) {
    const raw = Number(scores[c.key]); if (!raw) continue;
    const s = c.key === 'permitComplexity' ? 6 - raw : raw;
    total += s; wsum += 1;
  }
  return wsum ? Math.round((total / wsum) * 100) / 100 : 0;
}

const STAGES = ['SOURCING', 'NOC_REQUESTED', 'AGREEMENT_SENT', 'PERMIT_APPLIED', 'INSURANCE_RECEIVED', 'CONFIRMED', 'WRAPPED'];
const stageLabel = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function AssessModal({ location, onClose }: { location: any; onClose: () => void }) {
  const [tab, setTab] = useState<'eval' | 'recce' | 'permits' | 'risk' | 'docs' | 'security' | 'payments'>('docs');
  const [stage, setStage] = useState<string>(location.pipelineStage || 'SOURCING');
  const [comp, setComp] = useState<any>(null);
  const ops = projectOps(productionApi.locations);
  const Tabs: [string, string][] = [['docs', 'Documents'], ['permits', 'Permits'], ['security', 'Security'], ['payments', 'Payments'], ['eval', 'Evaluation'], ['recce', 'Tech recce'], ['risk', 'Risk']];

  const loadComp = useCallback(() => { productionApi.locations.compliance(location.id).then((r) => setComp(r.data)).catch(() => {}); }, [location.id]);
  useEffect(() => { loadComp(); }, [loadComp]);
  const changeStage = async (s: string) => { setStage(s); await productionApi.locations.setStage(location.id, s).catch(() => {}); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2"><ClipboardCheck size={16} className="text-[#0f172a]" /> {location.name}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {/* Pipeline stage + compliance gate */}
        <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
          <label className="text-xs text-gray-500 flex items-center gap-2">Stage
            <select value={stage} onChange={(e) => changeStage(e.target.value)} className="border rounded-lg px-2 py-1 text-sm bg-white">
              {STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
            </select>
          </label>
          {comp && (
            <div className="flex items-center gap-2 text-[11px]">
              <Gate ok={comp.nocReady} label="NOC" />
              <Gate ok={comp.agreementSigned} label="Agreement" />
              <Gate ok={comp.insuranceValid} label="Insurance" />
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-medium ${comp.ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {comp.ready ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {comp.ready ? 'Clear to confirm' : 'Not clear'}
              </span>
            </div>
          )}
        </div>

        <div className="flex border-b text-sm">
          {Tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 ${tab === k ? 'border-b-2 border-[#0f172a] font-medium' : 'text-gray-500'}`}>{label}</button>
          ))}
        </div>
        <div className="overflow-y-auto p-5">
          {tab === 'docs' && <DocumentsTab location={location} onChanged={loadComp} />}
          {tab === 'permits' && <PermitsTab locationId={location.id} currency={location.currency} />}
          {tab === 'security' && <SecurityTab id={location.id} a={ops} currency={location.currency} />}
          {tab === 'payments' && <PaymentsTab id={location.id} a={ops} currency={location.currency} />}
          {tab === 'eval' && <EvaluationTab locationId={location.id} />}
          {tab === 'recce' && <RecceTab locationId={location.id} />}
          {tab === 'risk' && <RiskTab locationId={location.id} />}
        </div>
      </div>
    </div>
  );
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{ok ? <CheckCircle2 size={11} /> : <span className="w-2 h-2 rounded-full border border-gray-300" />}{label}</span>;
}

const DOC_CATS = ['NOC', 'LOCATION_AGREEMENT', 'RELEASE', 'INSURANCE', 'LOCATION_GUIDE', 'RISK_ASSESSMENT', 'METHOD_STATEMENT', 'ID_DOCUMENT', 'QUOTE', 'PERMIT_DOC', 'OTHER'];
const PERMIT_TYPES = ['GROUND_FILMING', 'DRONE_GCAA', 'ROAD_TRAFFIC', 'POLICE', 'AIRPORT', 'HERITAGE_DCT', 'PARKING', 'MARINE', 'PYRO_SFX', 'FIREARMS', 'OTHER'];
const ptLabel = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const DOC_STATUSES = ['DRAFT', 'REQUESTED', 'RECEIVED', 'SIGNED', 'ISSUED', 'EXPIRED', 'VOID'];
const DOC_STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', REQUESTED: 'bg-blue-100 text-blue-700', RECEIVED: 'bg-teal-100 text-teal-700',
  SIGNED: 'bg-green-100 text-green-700', ISSUED: 'bg-green-100 text-green-700', EXPIRED: 'bg-red-100 text-red-700', VOID: 'bg-gray-100 text-gray-400',
};
const catLabel = (c: string) => c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

function DocumentsTab({ location, onChanged }: { location: any; onChanged: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => { productionApi.locations.documents(location.id).then((r) => setRows(r.data || [])).then(onChanged); }, [location.id, onChanged]);
  useEffect(() => { load(); }, [load]);

  const blank = { category: 'NOC', title: '', status: 'REQUESTED', language: 'BILINGUAL', partyName: '', authority: '', refNumber: '', issueDate: '', signedDate: '', expiryDate: '', amount: '', notes: '', fileUrl: '' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    const p = { ...form }; if (p.amount === '') p.amount = null;
    if (form.id) await productionApi.locations.updateDoc(form.id, p); else await productionApi.locations.createDoc(location.id, p);
    setForm(null); load();
  };
  const upload = async (file: File, withOcr: boolean) => {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      fd.append('category', form?.category || 'OTHER'); fd.append('title', file.name);
      if (withOcr) fd.append('ocr', 'true');
      await productionApi.locations.uploadDoc(location.id, fd); setMsg('Uploaded.'); load();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Upload failed.'); } finally { setBusy(false); }
  };
  const genNoc = async () => {
    const { data } = await productionApi.locations.generateNoc(location.id, {});
    const w = window.open('', '_blank'); if (w) { w.document.write(data.html); w.document.close(); }
  };
  const importEmail = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await productionApi.locations.importEmail(location.id, fd);
      setMsg(`Imported "${data.subject || file.name}" — ${data.documents} document(s) filed${data.attachments ? ` from ${data.attachments} attachment(s)` : ''}.`);
      load(); onChanged();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Email import failed.'); } finally { setBusy(false); }
  };
  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';

  return (
    <div className="space-y-3">
      {msg && <div className="text-sm bg-blue-50 text-blue-700 rounded-lg px-3 py-2">{msg}</div>}
      {!form && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setForm({ ...blank })} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add document</button>
          <label className="text-sm inline-flex items-center gap-1 text-[#8a6d2f] cursor-pointer"><Upload size={14} /> {busy ? 'Uploading…' : 'Upload file'}
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], false)} /></label>
          <button onClick={genNoc} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><FileSignature size={14} /> Generate NOC letter (EN/AR)</button>
          <label className="text-sm inline-flex items-center gap-1 text-[#8a6d2f] cursor-pointer"><Mail size={14} /> Import email (.msg)
            <input type="file" className="hidden" accept=".msg,.eml" onChange={(e) => e.target.files?.[0] && importEmail(e.target.files[0])} /></label>
        </div>
      )}
      {form && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className={inp} value={form.category} onChange={(e) => set('category', e.target.value)}>{DOC_CATS.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</select>
            <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <input className={`${inp} col-span-2`} placeholder="Title" value={form.title} onChange={(e) => set('title', e.target.value)} />
            <input className={inp} placeholder="Party / owner" value={form.partyName} onChange={(e) => set('partyName', e.target.value)} />
            <input className={inp} placeholder="Authority (Aldar, twofour54…)" value={form.authority} onChange={(e) => set('authority', e.target.value)} />
            <input className={inp} placeholder="Reference #" value={form.refNumber} onChange={(e) => set('refNumber', e.target.value)} />
            <select className={inp} value={form.language} onChange={(e) => set('language', e.target.value)}><option value="EN">English</option><option value="AR">Arabic</option><option value="BILINGUAL">Bilingual</option></select>
            <label className="text-xs text-gray-500">Issued<input type="date" className={inp} value={form.issueDate?.slice?.(0, 10) || ''} onChange={(e) => set('issueDate', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Signed<input type="date" className={inp} value={form.signedDate?.slice?.(0, 10) || ''} onChange={(e) => set('signedDate', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Expires<input type="date" className={inp} value={form.expiryDate?.slice?.(0, 10) || ''} onChange={(e) => set('expiryDate', e.target.value)} /></label>
            <input className={inp} type="number" placeholder="Amount / coverage" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs inline-flex items-center gap-1 text-[#8a6d2f] cursor-pointer"><Sparkles size={13} /> Attach + OCR
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], true)} /></label>
            {form.fileUrl && <a href={assetUrl(form.fileUrl)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 inline-flex items-center gap-1"><FileText size={12} /> View file</a>}
          </div>
          <div className="flex gap-2"><button onClick={save} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={13} /> Save</button><button onClick={() => setForm(null)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {rows.map((d) => {
        const expired = d.expiryDate && new Date(d.expiryDate) <= new Date();
        const soon = d.expiryDate && !expired && (new Date(d.expiryDate).getTime() - Date.now()) < 30 * 864e5;
        return (
          <div key={d.id} className="border rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#0f172a]/15 text-[#8a6d2f]">{catLabel(d.category)}</span>
                  <span className="font-medium text-sm">{d.title}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${DOC_STATUS_CLS[d.status]}`}>{d.status}</span>
                  {d.language === 'BILINGUAL' && <span className="text-[10px] text-gray-400">EN/AR</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{[d.partyName, d.authority, d.refNumber].filter(Boolean).join(' · ')}</p>
                {d.expiryDate && <p className={`text-[11px] mt-0.5 ${expired ? 'text-red-600' : soon ? 'text-amber-600' : 'text-gray-400'}`}>{expired ? 'Expired' : soon ? 'Expiring' : 'Valid to'} {new Date(d.expiryDate).toLocaleDateString()}</p>}
              </div>
              <div className="flex items-center gap-2">
                {d.fileUrl && <a href={assetUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-gray-400"><FileText size={14} /></a>}
                <button onClick={() => setForm({ ...d })} className="text-gray-400">✎</button>
                <button onClick={async () => { await productionApi.locations.removeDoc(d.id); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && !form && <p className="text-sm text-gray-400 flex items-center gap-2"><FolderArchive size={15} /> No documents yet — add NOCs, agreements, insurance, guides…</p>}
    </div>
  );
}

const PERMIT_STATUSES = ['NOT_REQUIRED', 'DRAFT', 'APPLIED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'];
const PERMIT_STATUS_CLS: Record<string, string> = {
  NOT_REQUIRED: 'bg-gray-100 text-gray-500', DRAFT: 'bg-gray-100 text-gray-600', APPLIED: 'bg-blue-100 text-blue-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700', EXPIRED: 'bg-red-50 text-red-600',
};

function PermitsTab({ locationId, currency = 'AED' }: { locationId: string; currency?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [auths, setAuths] = useState<any[]>([]);
  const load = useCallback(() => { productionApi.locations.permits(locationId).then((r) => setRows(r.data || [])); }, [locationId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { productionApi.locations.authorities().then((r) => setAuths(r.data || [])).catch(() => {}); }, []);

  const blank = { permitType: 'GROUND_FILMING', type: '', authorityId: '', authority: '', jurisdiction: '', referenceNumber: '', status: 'DRAFT', applicationDate: '', approvalDate: '', expiryDate: '', fee: '', currency, conditions: '', docUrl: '', notes: '' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const pickAuthority = (id: string) => { const a = auths.find((x) => x.id === id); setForm((f: any) => ({ ...f, authorityId: id, authority: a?.name || f.authority, jurisdiction: f.jurisdiction || a?.jurisdiction || '' })); };

  const save = async () => {
    const p = { ...form }; if (p.fee === '') p.fee = null;
    if (form.id) await productionApi.locations.updatePermit(form.id, p);
    else await productionApi.locations.createPermit(locationId, p);
    setForm(null); load();
  };
  const ocr = async (file: File) => {
    setOcrBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await productionApi.locations.ocrPermit(fd);
      const s = data.suggestion || {};
      setForm({ ...blank, ...form, type: s.type || 'FILMING', authority: s.authority || '', jurisdiction: s.jurisdiction || '', referenceNumber: s.referenceNumber || '', applicationDate: s.applicationDate || '', approvalDate: s.approvalDate || '', expiryDate: s.expiryDate || '', fee: s.fee ?? '', currency: s.currency || currency, conditions: s.conditions || '', docUrl: data.url, status: 'APPLIED' });
      setMsg(`Scanned — review the fields (confidence ${(Number(s.confidence) * 100 || 0).toFixed(0)}%).`);
    } catch (e: any) { setMsg(e?.response?.data?.message || 'OCR failed.'); }
    finally { setOcrBusy(false); }
  };
  const postFee = async (p: any) => {
    if (!p.fee) return;
    await productionApi.locations.postCost(locationId, { amount: p.fee, description: `Permit fee — ${p.type} (${p.authority || ''})`, party: p.authority });
    setMsg('Permit fee posted to the project ledger.');
  };

  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
  return (
    <div className="space-y-3">
      {msg && <div className="text-sm bg-blue-50 text-blue-700 rounded-lg px-3 py-2">{msg}</div>}
      {!form && (
        <div className="flex items-center gap-2">
          <button onClick={() => setForm({ ...blank })} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add permit</button>
          <label className="text-sm inline-flex items-center gap-1 text-[#8a6d2f] cursor-pointer">
            <Sparkles size={14} /> {ocrBusy ? 'Scanning…' : 'Scan permit (OCR)'}
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => e.target.files?.[0] && ocr(e.target.files[0])} />
          </label>
        </div>
      )}
      {form && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className={inp} value={form.permitType} onChange={(e) => set('permitType', e.target.value)}>{PERMIT_TYPES.map((t) => <option key={t} value={t}>{ptLabel(t)}</option>)}</select>
            <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{PERMIT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <select className={inp} value={form.authorityId} onChange={(e) => pickAuthority(e.target.value)}>
              <option value="">Authority…</option>
              {auths.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input className={inp} placeholder="Jurisdiction" value={form.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} />
            <input className={inp} placeholder="Reference #" value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
            <input className={inp} type="number" placeholder="Fee" value={form.fee} onChange={(e) => set('fee', e.target.value)} />
            <label className="text-xs text-gray-500">Applied<input type="date" className={inp} value={form.applicationDate?.slice?.(0, 10) || ''} onChange={(e) => set('applicationDate', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Approved<input type="date" className={inp} value={form.approvalDate?.slice?.(0, 10) || ''} onChange={(e) => set('approvalDate', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Expires<input type="date" className={inp} value={form.expiryDate?.slice?.(0, 10) || ''} onChange={(e) => set('expiryDate', e.target.value)} /></label>
          </div>
          <textarea className={inp} rows={2} placeholder="Conditions / restrictions" value={form.conditions} onChange={(e) => set('conditions', e.target.value)} />
          {form.docUrl && <a href={assetUrl(form.docUrl)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 inline-flex items-center gap-1"><FileText size={12} /> View attached document</a>}
          <div className="flex gap-2"><button onClick={save} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={13} /> Save</button><button onClick={() => setForm(null)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {rows.map((p) => (
        <div key={p.id} className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2"><span className="font-medium text-sm">{p.permitType ? ptLabel(p.permitType) : (p.type || 'Permit')}</span><span className={`text-[11px] px-2 py-0.5 rounded ${PERMIT_STATUS_CLS[p.status]}`}>{p.status.replace('_', ' ')}</span></div>
              <p className="text-xs text-gray-500 mt-0.5">{[p.authority, p.jurisdiction, p.referenceNumber].filter(Boolean).join(' · ')}</p>
              <div className="text-[11px] text-gray-400 mt-1 flex gap-3 flex-wrap">
                {p.expiryDate && <span>Expires {new Date(p.expiryDate).toLocaleDateString()}</span>}
                {p.fee && <span>{p.currency} {Number(p.fee).toLocaleString()}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {p.docUrl && <a href={assetUrl(p.docUrl)} target="_blank" rel="noreferrer" className="text-gray-400"><FileText size={14} /></a>}
              {p.fee && <button onClick={() => postFee(p)} title="Post fee to budget" className="text-[#8a6d2f]"><Coins size={14} /></button>}
              <button onClick={() => setForm({ ...p })} className="text-gray-400">✎</button>
              <button onClick={async () => { await productionApi.locations.removePermit(p.id); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
          {['DRAFT', 'NOT_REQUIRED'].includes(p.status) && (
            <button onClick={async () => { await productionApi.locations.submitPermit(p.id); setMsg('Submitted for approval — routes Location Manager → UPM → Producer.'); load(); }}
              className="mt-2 text-xs inline-flex items-center gap-1 text-[#8a6d2f]"><Send size={12} /> Submit for approval</button>
          )}
          {p.status === 'IN_REVIEW' && <p className="mt-2 text-[11px] text-amber-600 inline-flex items-center gap-1"><Send size={11} /> In approval — see My Approvals</p>}
        </div>
      ))}
      {rows.length === 0 && !form && <p className="text-sm text-gray-400">No permits tracked yet.</p>}
    </div>
  );
}

const RISK_STATUSES = ['OPEN', 'MITIGATED', 'CLOSED'];
function riskCls(score: number) { return score >= 15 ? 'bg-red-100 text-red-700' : score >= 8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'; }

function RiskTab({ locationId }: { locationId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const load = useCallback(() => { productionApi.locations.risks(locationId).then((r) => setRows(r.data || [])); }, [locationId]);
  useEffect(() => { load(); }, [load]);

  const blank = { category: 'FIRE', hazard: '', likelihood: 1, impact: 1, mitigation: '', owner: '', emergencyProcedure: '', nearestMedical: '', evacuationNotes: '', status: 'OPEN' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    if (form.id) await productionApi.locations.updateRisk(form.id, form);
    else await productionApi.locations.createRisk(locationId, form);
    setForm(null); load();
  };
  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
  const previewScore = form ? Number(form.likelihood) * Number(form.impact) : 0;

  return (
    <div className="space-y-3">
      {!form && <button onClick={() => setForm({ ...blank })} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add risk</button>}
      {form && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} placeholder="Category (FIRE, WATER…)" value={form.category} onChange={(e) => set('category', e.target.value)} />
            <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{RISK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <input className={inp} placeholder="Hazard" value={form.hazard} onChange={(e) => set('hazard', e.target.value)} />
          <div className="flex items-center gap-4">
            <label className="text-xs text-gray-500">Likelihood
              <select className={inp} value={form.likelihood} onChange={(e) => set('likelihood', Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="text-xs text-gray-500">Impact
              <select className={inp} value={form.impact} onChange={(e) => set('impact', Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
            <div className="text-sm">Score <span className={`px-2 py-0.5 rounded ${riskCls(previewScore)}`}>{previewScore}</span></div>
          </div>
          <textarea className={inp} rows={2} placeholder="Mitigation" value={form.mitigation} onChange={(e) => set('mitigation', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} placeholder="Owner" value={form.owner} onChange={(e) => set('owner', e.target.value)} />
            <input className={inp} placeholder="Nearest medical" value={form.nearestMedical} onChange={(e) => set('nearestMedical', e.target.value)} />
          </div>
          <textarea className={inp} rows={2} placeholder="Emergency / evacuation procedure" value={form.emergencyProcedure} onChange={(e) => set('emergencyProcedure', e.target.value)} />
          <div className="flex gap-2"><button onClick={save} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={13} /> Save</button><button onClick={() => setForm(null)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2"><ShieldAlert size={14} className="text-gray-400" /><span className="font-medium text-sm">{r.category}</span><span className={`text-[11px] px-2 py-0.5 rounded ${riskCls(r.riskScore)}`}>score {r.riskScore}</span><span className="text-[11px] text-gray-400">{r.status}</span></div>
              <p className="text-sm text-gray-600 mt-1">{r.hazard}</p>
              {r.mitigation && <p className="text-xs text-gray-400 mt-0.5">Mitigation: {r.mitigation}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setForm({ ...r })} className="text-gray-400">✎</button>
              <button onClick={async () => { await productionApi.locations.removeRisk(r.id); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ))}
      {rows.length === 0 && !form && <p className="text-sm text-gray-400">No risks logged yet.</p>}
    </div>
  );
}

function EvaluationTab({ locationId }: { locationId: string }) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [evaluatedByName, setBy] = useState('');
  const [past, setPast] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { assessmentApi.evaluations(locationId).then((r) => setPast(r.data || [])); }, [locationId]);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: number) => setScores((s) => ({ ...s, [k]: v }));
  const preview = previewScore(scores);
  const save = async () => {
    setSaving(true);
    try { await assessmentApi.upsertEval(locationId, { scores, notes, evaluatedByName }); setScores({}); setNotes(''); load(); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {CRITERIA.map((c) => (
          <div key={c.key} className="flex items-center gap-3">
            <div className="w-40 text-sm">{c.label}{c.hint && <span className="block text-[10px] text-gray-400">{c.hint}</span>}</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => set(c.key, n)} className={`w-7 h-7 rounded text-xs ${scores[c.key] >= n ? 'bg-[#0f172a] text-white' : 'bg-gray-100 text-gray-400'}`}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="text-sm text-gray-500">Weighted score (preview)</div>
        <div className="text-2xl font-semibold text-[#8a6d2f]">{preview.toFixed(2)}<span className="text-sm text-gray-400"> / 5</span></div>
      </div>
      <input value={evaluatedByName} onChange={(e) => setBy(e.target.value)} placeholder="Evaluated by" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
      <button onClick={save} disabled={saving || Object.keys(scores).length === 0} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#0f172a] text-white rounded-lg disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Save evaluation'}</button>

      {past.length > 0 && (
        <div className="pt-2 border-t">
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Past evaluations</h4>
          <div className="space-y-1">
            {past.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                <span>{e.evaluatedByName || 'Anon'} · {new Date(e.createdAt).toLocaleDateString()}</span>
                <span className="flex items-center gap-2"><span className={`text-[11px] px-2 py-0.5 rounded ${REC_CLS[e.recommendation]}`}>{e.recommendation.replace('_', ' ')}</span><b>{Number(e.weightedScore).toFixed(2)}</b></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecceTab({ locationId }: { locationId: string }) {
  const [recces, setRecces] = useState<any[]>([]);
  const [rollup, setRollup] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ reccedAt: '', conductedBy: '', attendees: '', summary: '', status: 'PLANNED' });

  const load = useCallback(() => {
    assessmentApi.recces(locationId).then((r) => setRecces(r.data || []));
    assessmentApi.rollup(locationId).then((r) => setRollup(r.data)).catch(() => setRollup(null));
  }, [locationId]);
  useEffect(() => { load(); }, [load]);

  const createRecce = async () => { await assessmentApi.createRecce(locationId, form); setForm({ reccedAt: '', conductedBy: '', attendees: '', summary: '', status: 'PLANNED' }); setCreating(false); load(); };

  const READY_TONE: Record<string, string> = { READY: 'bg-emerald-100 text-emerald-700', OUTSTANDING: 'bg-amber-100 text-amber-700', BLOCKED: 'bg-rose-100 text-rose-700' };

  return (
    <div className="space-y-4">
      {/* Readiness rollup across all recce notes */}
      {rollup && rollup.noteCount > 0 && (
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2"><ClipboardCheck size={15} /> Department rollup
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${READY_TONE[rollup.readiness] || ''}`}>{rollup.readiness}</span>
            </span>
            <span className="text-xs text-gray-400">{rollup.noteCount} notes · {rollup.departments.length} depts</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SEVERITIES.map((s) => (rollup.severityTally[s.key] ? <span key={s.key} className={`text-[11px] px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}: {rollup.severityTally[s.key]}</span> : null))}
          </div>
          {rollup.blockers.length > 0 && (
            <div className="mb-1.5">
              <p className="text-[11px] uppercase tracking-wide text-rose-500 font-semibold mb-1">Blockers</p>
              {rollup.blockers.map((b: any) => <div key={b.id} className="text-xs text-gray-700 flex items-center gap-1.5"><AlertTriangle size={12} className="text-rose-500" /> <b>{deptLabel(b.department)}</b>: {b.note || b.actionItem || '—'}</div>)}
            </div>
          )}
          {rollup.openActions.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-amber-600 font-semibold mb-1">Open action items</p>
              {rollup.openActions.map((a: any) => <div key={a.id} className="text-xs text-gray-700">• <b>{deptLabel(a.department)}</b>: {a.actionItem}</div>)}
            </div>
          )}
          {rollup.blockers.length === 0 && rollup.openActions.length === 0 && <p className="text-xs text-emerald-600">All department concerns resolved — location is recce-ready.</p>}
        </div>
      )}

      {!creating && <button onClick={() => setCreating(true)} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> New recce</button>}
      {creating && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className="border rounded-lg px-3 py-1.5 text-sm" value={form.reccedAt} onChange={(e) => setForm({ ...form, reccedAt: e.target.value })} />
            <select className="border rounded-lg px-3 py-1.5 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{['PLANNED', 'DONE', 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}</select>
            <input className="border rounded-lg px-3 py-1.5 text-sm" placeholder="Conducted by" value={form.conductedBy} onChange={(e) => setForm({ ...form, conductedBy: e.target.value })} />
            <input className="border rounded-lg px-3 py-1.5 text-sm" placeholder="Attendees" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
          </div>
          <textarea className="w-full border rounded-lg px-3 py-1.5 text-sm" rows={2} placeholder="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <div className="flex gap-2"><button onClick={createRecce} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg">Create</button><button onClick={() => setCreating(false)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {recces.map((r) => <RecceCard key={r.id} recce={r} onChanged={load} />)}
      {recces.length === 0 && !creating && <p className="text-sm text-gray-400">No recces yet.</p>}
    </div>
  );
}

function RecceCard({ recce, onChanged }: { recce: any; onChanged: () => void }) {
  const [dept, setDept] = useState('DOP');
  const existing = (recce.notes || []).find((n: any) => n.department === dept);
  const [note, setNote] = useState<any>({});
  useEffect(() => { setNote(existing || {}); }, [dept, recce.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = async () => { await assessmentApi.upsertNote(recce.id, { department: dept, ...note }); onChanged(); };
  const setN = (k: string, v: any) => setNote((x: any) => ({ ...x, [k]: v }));
  const checklist = note.checklist || {};
  const toggleCheck = (k: string) => setNote((x: any) => ({ ...x, checklist: { ...(x.checklist || {}), [k]: !(x.checklist || {})[k] } }));
  const toggleResolved = async (n: any) => { await assessmentApi.toggleNote(n.id, !n.resolved); onChanged(); };

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{recce.reccedAt ? new Date(recce.reccedAt).toLocaleDateString() : 'Recce'} · {recce.status}</span>
        <span className="text-xs text-gray-400">{recce.conductedBy}{recce.notes?.length ? ` · ${recce.notes.length} dept notes` : ''}</span>
      </div>
      {recce.summary && <p className="text-sm text-gray-600 mb-2">{recce.summary}</p>}

      {/* Existing department notes — chips with severity + resolve toggle */}
      {(recce.notes || []).length > 0 && (
        <div className="space-y-1 mb-2">
          {recce.notes.map((n: any) => (
            <div key={n.id} className={`flex items-center gap-2 text-xs rounded-lg border px-2 py-1.5 ${n.resolved ? 'opacity-60' : ''}`}>
              <span className="font-medium w-28 shrink-0">{deptLabel(n.department)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sevCls(n.severity || 'INFO')}`}>{(n.severity || 'INFO')}</span>
              <span className="flex-1 truncate text-gray-600">{n.note || n.actionItem || n.risks || '—'}</span>
              {n.actionItem && <button onClick={() => toggleResolved(n)} title="Toggle resolved" className={`shrink-0 ${n.resolved ? 'text-emerald-600' : 'text-gray-300 hover:text-emerald-600'}`}><CheckCircle2 size={14} /></button>}
              <button onClick={() => setDept(n.department)} className="shrink-0 text-gray-400 hover:text-gray-700">Edit</button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-2">
        <div className="flex items-center gap-2 mb-2">
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">{DEPARTMENTS.map((d) => <option key={d} value={d}>{deptLabel(d)}</option>)}</select>
          <select value={note.severity || 'INFO'} onChange={(e) => setN('severity', e.target.value)} className="border rounded-lg px-2 py-1 text-sm">{SEVERITIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          {existing && <span className="text-[11px] text-gray-400">editing existing note</span>}
        </div>
        <textarea className="w-full border rounded-lg px-2 py-1 text-xs mb-2" rows={2} placeholder={`${deptLabel(dept)} concern / observation`} value={note.note || ''} onChange={(e) => setN('note', e.target.value)} />

        {/* Department checklist */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
          {checklistFor(dept).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <input type="checkbox" checked={!!checklist[k]} onChange={() => toggleCheck(k)} /> {label}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <textarea className="border rounded-lg px-2 py-1 text-xs" rows={2} placeholder="Risks" value={note.risks || ''} onChange={(e) => setN('risks', e.target.value)} />
          <textarea className="border rounded-lg px-2 py-1 text-xs" rows={2} placeholder="Equipment needs" value={note.equipmentNeeds || ''} onChange={(e) => setN('equipmentNeeds', e.target.value)} />
          <textarea className="border rounded-lg px-2 py-1 text-xs" rows={2} placeholder="Crew needs" value={note.crewNeeds || ''} onChange={(e) => setN('crewNeeds', e.target.value)} />
          <textarea className="border rounded-lg px-2 py-1 text-xs" rows={2} placeholder="Access / power" value={note.accessNotes || ''} onChange={(e) => setN('accessNotes', e.target.value)} />
          <input className="border rounded-lg px-2 py-1 text-xs col-span-2" placeholder="Action item (what must happen before shoot)" value={note.actionItem || ''} onChange={(e) => setN('actionItem', e.target.value)} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={saveNote} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={12} /> Save {deptLabel(dept)} note</button>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600"><input type="checkbox" checked={!!note.resolved} onChange={(e) => setN('resolved', e.target.checked)} /> Resolved</label>
        </div>
      </div>
    </div>
  );
}

export function CompareModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { assessmentApi.compare(projectId).then((r) => setData(r.data)); }, [projectId]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between sticky top-0 glass-bar">
          <h2 className="font-semibold text-sm flex items-center gap-2"><BarChart3 size={16} className="text-[#0f172a]" /> Compare locations</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">
          {!data ? <p className="text-sm text-gray-400">Loading…</p>
            : data.rows.length === 0 ? <p className="text-sm text-gray-400">No locations in this project yet.</p>
            : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400 border-b">
                  <th className="py-2">#</th><th>Location</th><th>Recces</th><th>Recommendation</th><th className="text-right">Score</th>
                </tr></thead>
                <tbody>
                  {data.rows.map((r: any, i: number) => (
                    <tr key={r.locationId} className="border-b">
                      <td className="py-2">{i === 0 && r.evaluated ? <Trophy size={14} className="text-[#0f172a]" /> : i + 1}</td>
                      <td className="font-medium">{r.name}<span className="block text-[11px] text-gray-400">{r.scenes ? `Sc. ${r.scenes}` : ''}{r.status ? ` · ${r.status}` : ''}</span></td>
                      <td>{r.recceCount}</td>
                      <td>{r.recommendation ? <span className={`text-[11px] px-2 py-0.5 rounded ${REC_CLS[r.recommendation]}`}>{r.recommendation.replace('_', ' ')}</span> : <span className="text-xs text-gray-300">not evaluated</span>}</td>
                      <td className="text-right font-semibold">{r.weightedScore != null ? r.weightedScore.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}
