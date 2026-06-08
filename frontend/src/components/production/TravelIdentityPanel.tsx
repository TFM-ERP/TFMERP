'use client';

import { useState, useEffect, useCallback } from 'react';
import { travelApi, uploadFile, assetUrl } from '@/lib/api';
import {
  X, ShieldCheck, AlertTriangle, CheckCircle2, Clock, Upload, Plus, Trash2, Users, Plane,
  CreditCard, FileText, Camera, Loader2, ChevronLeft, UserPlus, Printer,
} from 'lucide-react';

const VISA_STATUS = ['NOT_REQUIRED', 'REQUIRED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'];
const DOC_TYPES = ['PASSPORT', 'VISA', 'NATIONAL_ID', 'EMIRATES_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT', 'ENTRY_PERMIT', 'VACCINATION', 'INSURANCE', 'FLIGHT_ITINERARY', 'HOTEL_VOUCHER', 'INVITATION_LETTER', 'WORK_PERMIT', 'PERMIT_APPROVAL', 'CUSTOMS', 'OTHER'];
const FLAG_LABEL: Record<string, string> = { PASSPORT_MISSING: 'Passport missing', PASSPORT_EXPIRED: 'Passport expired', PASSPORT_UNDER_6_MONTHS: '< 6 months validity' };

export default function TravelIdentityPanel({ travelerId, onClose }: { travelerId: string; onClose?: () => void }) {
  const [stack, setStack] = useState<string[]>([travelerId]);
  const id = stack[stack.length - 1];
  const [t, setT] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [sheet, setSheet] = useState<any | null>(null);

  const load = useCallback(() => { travelApi.traveler(id).then((r) => setT(r.data)).catch(() => setT(null)); }, [id]);
  useEffect(() => { setT(null); load(); }, [load]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const planTravel = async () => {
    setBusy('plan');
    try { const r = await travelApi.request({ travelerId: id, purpose: 'Production travel' }); flash(`Travel record created — open the Travel module to add the itinerary.`); load(); }
    catch { flash('Could not create travel record.'); } finally { setBusy(''); }
  };
  const openSheet = async () => { setBusy('sheet'); try { const r = await travelApi.arrivalSheet(id); setSheet(r.data); } finally { setBusy(''); } };

  const save = async (patch: any) => { setBusy('save'); try { await travelApi.updTraveler(id, patch); load(); } finally { setBusy(''); } };
  const uploadTo = async (field: string, file: File) => { setBusy(field); try { const up = await uploadFile(file); await travelApi.updTraveler(id, { [field]: up.url }); load(); } finally { setBusy(''); } };

  if (!t) return <div className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></div>;

  const r = t.readiness || { score: 0, items: [], flags: [] };
  const flags: string[] = t.validation || r.flags || [];
  const restricted = t._access === 'RESTRICTED';

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {stack.length > 1 && <button onClick={() => setStack((s) => s.slice(0, -1))} className="text-slate-400 hover:text-slate-700"><ChevronLeft size={18} /></button>}
          <Avatar t={t} size={52} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{t.preferredName || t.fullName}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.personType}</span>
              {t.relationship && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{t.relationship}</span>}
            </div>
            <p className="text-xs text-slate-500">{[t.legalName && t.legalName !== t.fullName ? t.legalName : null, t.nationality, t.email].filter(Boolean).join(' · ') || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={openSheet} disabled={busy === 'sheet'} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2.5 py-1.5 hover:border-[#0f172a] disabled:opacity-40">{busy === 'sheet' ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Arrival sheet</button>
          <button onClick={planTravel} disabled={busy === 'plan'} className="text-xs inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-2.5 py-1.5 disabled:opacity-40">{busy === 'plan' ? <Loader2 size={13} className="animate-spin" /> : <Plane size={13} />} Plan travel</button>
          {onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>}
        </div>
      </div>
      {toast && <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">{toast}</div>}
      {restricted && <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Restricted view — passport, visa and ID documents are hidden for your role.</div>}

      {/* Readiness */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1"><Plane size={12} /> Travel readiness</span>
          <span className={`text-lg font-bold ${r.score >= 90 ? 'text-emerald-600' : r.score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{r.score}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3"><div className={`h-full ${r.score >= 90 ? 'bg-emerald-500' : r.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${r.score}%` }} /></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {r.items.map((it: any) => (
            <div key={it.key} className="text-center rounded-lg bg-slate-50 py-2">
              {it.ok ? <CheckCircle2 size={15} className="mx-auto text-emerald-600" /> : <Clock size={15} className="mx-auto text-amber-500" />}
              <div className="text-[11px] text-slate-700 mt-0.5">{it.key}</div>
              <div className="text-[10px] text-slate-400">{String(it.status).replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
        {flags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{flags.map((f) => <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 inline-flex items-center gap-1"><AlertTriangle size={11} /> {FLAG_LABEL[f] || f}</span>)}</div>}
      </div>

      {/* Travel requirements (computed — local talent needs no travel/visa/hotel) */}
      <RequirementsSection traveler={t} onChange={load} />

      {/* Photos — headshot always; passport/ID photos only for privileged roles */}
      <Section icon={<Camera size={13} />} title="Photos">
        <div className="grid grid-cols-3 gap-3">
          {([['headshotUrl', 'Headshot'], ...(restricted ? [] : [['passportPhotoUrl', 'Passport-style'], ['additionalIdPhotoUrl', 'Additional ID']])] as any[]).map(([field, label]) => (
            <PhotoTile key={field} url={t[field]} label={label} busy={busy === field} onUpload={(f: File) => uploadTo(field, f)} />
          ))}
        </div>
      </Section>

      {!restricted && (
        <>
          {/* Personal + passport (editable) */}
          <IdentityForm t={t} busy={busy === 'save'} onSave={save} uploadTo={uploadTo} uploadBusy={busy} flags={flags} />
          {/* Standing visas */}
          <VisasSection traveler={t} onChange={load} />
          {/* Documents repository */}
          <DocsSection traveler={t} onChange={load} />
        </>
      )}

      {/* Accompanying persons */}
      <CompanionsSection traveler={t} onOpen={(cid: string) => setStack((s) => [...s, cid])} onChange={load} />

      {/* Meet & greet */}
      <ArrivalSection traveler={t} onChange={load} />

      {sheet && <ArrivalSheetModal data={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

// Auto-generated Arrival Photo Sheet — drivers & reps identify arrivals at a glance.
function ArrivalSheetModal({ data, onClose }: any) {
  const card = (p: any, sub?: string) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white break-inside-avoid">
      <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center">
        {p.photoUrl ? <img src={assetUrl(p.photoUrl)} alt={p.name} className="w-full h-full object-cover" /> : <Users size={40} className="text-slate-300" />}
      </div>
      <div className="p-2 text-center">
        <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
        {sub && <div className="text-[11px] text-violet-700">{sub}</div>}
        <div className="text-[11px] text-slate-500">{[p.flight, p.arrivalTime ? new Date(p.arrivalTime).toLocaleString() : null].filter(Boolean).join(' · ') || 'Flight TBC'}</div>
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 print:bg-white print:p-0" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden print:shadow-none print:max-w-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 print:hidden">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Plane size={16} className="text-[#0f172a]" /> Arrival Photo Sheet</h3>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="text-xs inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-1.5"><Printer size={13} /> Print / PDF</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Talent</p>
          <div className="grid grid-cols-3 gap-3 mb-5">{card(data.host)}</div>
          {(data.companions || []).length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Accompanying persons</p>
              <div className="grid grid-cols-3 gap-3">{data.companions.map((c: any, i: number) => <div key={i}>{card(c, c.relationship)}</div>)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ t, size = 40 }: any) {
  const url = t.headshotUrl || t.passportPhotoUrl;
  return url
    ? <img src={assetUrl(url)} alt="" className="rounded-full object-cover ring-1 ring-slate-200" style={{ width: size, height: size }} />
    : <div className="rounded-full bg-slate-100 flex items-center justify-center text-slate-400" style={{ width: size, height: size }}><Users size={size * 0.45} /></div>;
}

function PhotoTile({ url, label, busy, onUpload }: any) {
  return (
    <label className="block cursor-pointer">
      <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 hover:border-[#0f172a]">
        {url ? <img src={assetUrl(url)} alt={label} className="w-full h-full object-cover" /> : busy ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Camera size={20} className="text-slate-300" />}
      </div>
      <div className="text-[11px] text-slate-500 text-center mt-1">{label}</div>
      <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
    </label>
  );
}

function Section({ icon, title, children, right }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">{icon}{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

const inp = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
function F({ label, children, full }: any) { return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-[11px] font-medium text-slate-500 mb-0.5">{label}</span>{children}</label>; }

function IdentityForm({ t, busy, onSave, uploadTo, uploadBusy, flags }: any) {
  const [f, setF] = useState<any>({});
  useEffect(() => { setF({
    fullName: t.fullName || '', legalName: t.legalName || '', preferredName: t.preferredName || '', gender: t.gender || '',
    email: t.email || '', phone: t.phone || '', nationality: t.nationality || '', countryOfResidence: t.countryOfResidence || '',
    dateOfBirth: t.dateOfBirth ? t.dateOfBirth.slice(0, 10) : '', passportNumber: t.passportNumber || '', nationalId: t.nationalId || '',
    passportPlaceOfIssue: t.passportPlaceOfIssue || '', passportIssueDate: t.passportIssueDate ? t.passportIssueDate.slice(0, 10) : '',
    passportExpiry: t.passportExpiry ? t.passportExpiry.slice(0, 10) : '',
    emergencyContactName: t.emergencyContactName || '', emergencyContactPhone: t.emergencyContactPhone || '',
  }); }, [t]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  return (
    <Section icon={<CreditCard size={13} />} title="Identity & passport" right={<button onClick={() => onSave(f)} disabled={busy} className="text-xs inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-2.5 py-1 disabled:opacity-40">{busy && <Loader2 size={12} className="animate-spin" />} Save</button>}>
      <div className="grid grid-cols-2 gap-2.5">
        <F label="Full legal name (per passport)" full><input className={inp} value={f.legalName} onChange={(e) => set('legalName', e.target.value)} /></F>
        <F label="Display name"><input className={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></F>
        <F label="Preferred name"><input className={inp} value={f.preferredName} onChange={(e) => set('preferredName', e.target.value)} /></F>
        <F label="Gender"><input className={inp} value={f.gender} onChange={(e) => set('gender', e.target.value)} /></F>
        <F label="Date of birth"><input type="date" className={inp} value={f.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></F>
        <F label="Nationality"><input className={inp} value={f.nationality} onChange={(e) => set('nationality', e.target.value)} /></F>
        <F label="Country of residence"><input className={inp} value={f.countryOfResidence} onChange={(e) => set('countryOfResidence', e.target.value)} /></F>
        <F label="Mobile"><input className={inp} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></F>
        <F label="Email"><input className={inp} value={f.email} onChange={(e) => set('email', e.target.value)} /></F>
        <div className="col-span-2 border-t border-slate-100 my-1" />
        <F label="Passport number"><input className={inp} value={f.passportNumber} onChange={(e) => set('passportNumber', e.target.value)} /></F>
        <F label="Place of issue"><input className={inp} value={f.passportPlaceOfIssue} onChange={(e) => set('passportPlaceOfIssue', e.target.value)} /></F>
        <F label="Issue date"><input type="date" className={inp} value={f.passportIssueDate} onChange={(e) => set('passportIssueDate', e.target.value)} /></F>
        <F label="Expiry date"><input type="date" className={inp} value={f.passportExpiry} onChange={(e) => set('passportExpiry', e.target.value)} /></F>
        <F label="National / Emirates ID"><input className={inp} value={f.nationalId} onChange={(e) => set('nationalId', e.target.value)} /></F>
        <F label="Emergency contact"><input className={inp} value={f.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} placeholder="Name" /></F>
        <F label="Emergency phone"><input className={inp} value={f.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></F>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        {[['passportFrontUrl', 'Front page'], ['passportInfoUrl', 'Info page'], ['passportAdditionalUrl', 'Additional pages'], ['passportPdfUrl', 'Full PDF']].map(([field, label]) => (
          <DocUploadTile key={field} url={t[field]} label={label} busy={uploadBusy === field} onUpload={(file: File) => uploadTo(field, file)} />
        ))}
      </div>
    </Section>
  );
}

function DocUploadTile({ url, label, busy, onUpload }: any) {
  return (
    <label className={`flex items-center justify-between gap-1 rounded-lg border px-2.5 py-2 text-xs cursor-pointer ${url ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 hover:border-[#0f172a]'}`}>
      <span className="inline-flex items-center gap-1.5 text-slate-700 truncate">{url ? <CheckCircle2 size={13} className="text-emerald-600" /> : <FileText size={13} className="text-slate-400" />}{label}</span>
      {url ? <a href={assetUrl(url)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-emerald-700 underline shrink-0">view</a> : busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} className="text-slate-400 shrink-0" />}
      <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
    </label>
  );
}

function VisasSection({ traveler, onChange }: any) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<any>({ visaType: '', country: '', issueDate: '', expiryDate: '', entriesAllowed: 'MULTIPLE', sponsor: '', status: 'REQUIRED' });
  const [busy, setBusy] = useState(false);
  const add = async () => { setBusy(true); try { await travelApi.addVisaRec(traveler.id, f); setAdding(false); setF({ visaType: '', country: '', issueDate: '', expiryDate: '', entriesAllowed: 'MULTIPLE', sponsor: '', status: 'REQUIRED' }); onChange(); } finally { setBusy(false); } };
  const VS: Record<string, string> = { APPROVED: 'bg-emerald-100 text-emerald-700', REJECTED: 'bg-rose-100 text-rose-700', NOT_REQUIRED: 'bg-slate-100 text-slate-500' };
  return (
    <Section icon={<ShieldCheck size={13} />} title={`Visas & permits (${traveler.travelerVisas?.length || 0})`} right={<button onClick={() => setAdding(!adding)} className="text-xs inline-flex items-center gap-1 text-slate-600"><Plus size={13} /> Add</button>}>
      {adding && (
        <div className="rounded-xl bg-slate-50 p-3 mb-3 grid grid-cols-2 gap-2">
          <F label="Visa type"><input className={inp} value={f.visaType} onChange={(e) => setF({ ...f, visaType: e.target.value })} /></F>
          <F label="Country"><input className={inp} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></F>
          <F label="Issue date"><input type="date" className={inp} value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} /></F>
          <F label="Expiry date"><input type="date" className={inp} value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} /></F>
          <F label="Entries"><select className={inp} value={f.entriesAllowed} onChange={(e) => setF({ ...f, entriesAllowed: e.target.value })}>{['SINGLE', 'DOUBLE', 'MULTIPLE'].map((x) => <option key={x}>{x}</option>)}</select></F>
          <F label="Status"><select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{VISA_STATUS.map((x) => <option key={x}>{x.replace(/_/g, ' ')}</option>)}</select></F>
          <F label="Sponsor" full><input className={inp} value={f.sponsor} onChange={(e) => setF({ ...f, sponsor: e.target.value })} /></F>
          <div className="col-span-2 flex justify-end"><button onClick={add} disabled={busy} className="text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40">{busy ? 'Saving…' : 'Save visa'}</button></div>
        </div>
      )}
      {(traveler.travelerVisas || []).length === 0 ? <p className="text-xs text-slate-400">No visas recorded.</p> : (
        <div className="space-y-1.5">
          {traveler.travelerVisas.map((v: any) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div><div className="text-sm text-slate-800">{v.visaType || 'Visa'}{v.country ? ` · ${v.country}` : ''}</div><div className="text-[11px] text-slate-400">{v.entriesAllowed || ''}{v.expiryDate ? ` · exp ${new Date(v.expiryDate).toLocaleDateString()}` : ''}{v.sponsor ? ` · ${v.sponsor}` : ''}</div></div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${VS[v.status] || 'bg-amber-100 text-amber-700'}`}>{v.status.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function DocsSection({ traveler, onChange }: any) {
  const [type, setType] = useState('PASSPORT');
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => { setBusy(true); try { const up = await uploadFile(file); await travelApi.addDoc(traveler.id, { type, fileUrl: up.url, label: file.name }); onChange(); } finally { setBusy(false); } };
  return (
    <Section icon={<FileText size={13} />} title={`Documents repository (${traveler.documents?.length || 0})`} right={
      <label className="text-xs inline-flex items-center gap-1 text-slate-600 cursor-pointer">
        <select className="text-[11px] rounded border border-slate-200 px-1 py-0.5 mr-1" value={type} onChange={(e) => setType(e.target.value)} onClick={(e) => e.stopPropagation()}>{DOC_TYPES.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
        <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
    }>
      {(traveler.documents || []).length === 0 ? <p className="text-xs text-slate-400">No documents uploaded.</p> : (
        <div className="space-y-1.5">
          {traveler.documents.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700 inline-flex items-center gap-2"><FileText size={13} className="text-slate-400" /> <span className="text-[10px] font-mono bg-slate-200 text-slate-600 rounded px-1">{d.type.replace(/_/g, ' ')}</span> {d.label || 'Document'}</span>
              <div className="flex items-center gap-2">
                <a href={assetUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">view</a>
                <button onClick={async () => { await travelApi.delDoc(d.id); onChange(); }} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function CompanionsSection({ traveler, onOpen, onChange }: any) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<any>({ fullName: '', relationship: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => { if (!f.fullName) return; setBusy(true); try { await travelApi.addCompanion(traveler.id, f); setAdding(false); setF({ fullName: '', relationship: '' }); onChange(); } finally { setBusy(false); } };
  if (traveler.personType === 'ACCOMPANYING') return null; // companions don't have companions
  return (
    <Section icon={<UserPlus size={13} />} title={`Accompanying persons (${traveler.companions?.length || 0})`} right={<button onClick={() => setAdding(!adding)} className="text-xs inline-flex items-center gap-1 text-slate-600"><Plus size={13} /> Add</button>}>
      {adding && (
        <div className="rounded-xl bg-slate-50 p-3 mb-3 flex items-end gap-2">
          <F label="Full name"><input className={inp} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></F>
          <F label="Relationship"><input className={inp} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })} placeholder="Spouse / PA / Stylist" /></F>
          <button onClick={add} disabled={busy} className="text-xs rounded-lg bg-slate-900 text-white px-3 py-2 disabled:opacity-40">{busy ? '…' : 'Add'}</button>
        </div>
      )}
      {(traveler.companions || []).length === 0 ? <p className="text-xs text-slate-400">No accompanying persons. Each becomes a full linked travel identity.</p> : (
        <div className="space-y-1.5">
          {traveler.companions.map((c: any) => (
            <button key={c.id} onClick={() => onOpen(c.id)} className="w-full flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100 text-left">
              <span className="inline-flex items-center gap-2"><Avatar t={c} size={28} /><span><span className="text-sm text-slate-800">{c.preferredName || c.fullName}</span>{c.relationship ? <span className="text-[11px] text-slate-400 ml-1">· {c.relationship}</span> : ''}</span></span>
              <span className="text-[11px] text-slate-400">{(c._count?.documents ?? 0)} docs · open →</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function ArrivalSection({ traveler, onChange }: any) {
  const a = (traveler.arrivals || [])[0] || {};
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF({ id: a.id, airport: a.airport || '', flightNumber: a.flightNumber || '', arrivalTime: a.arrivalTime ? a.arrivalTime.slice(0, 16) : '', terminal: a.terminal || '', driverAssigned: a.driverAssigned || '', coordinatorAssigned: a.coordinatorAssigned || '' }); }, [traveler]);
  const save = async () => { setBusy(true); try { await travelApi.upsertArrival(traveler.id, f); onChange(); } finally { setBusy(false); } };
  return (
    <Section icon={<Plane size={13} />} title="Meet & greet / arrival" right={<button onClick={save} disabled={busy} className="text-xs inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-2.5 py-1 disabled:opacity-40">{busy && <Loader2 size={12} className="animate-spin" />} Save</button>}>
      <div className="grid grid-cols-2 gap-2.5">
        <F label="Airport"><input className={inp} value={f.airport} onChange={(e) => setF({ ...f, airport: e.target.value })} placeholder="AUH" /></F>
        <F label="Flight number"><input className={inp} value={f.flightNumber} onChange={(e) => setF({ ...f, flightNumber: e.target.value })} /></F>
        <F label="Arrival time"><input type="datetime-local" className={inp} value={f.arrivalTime} onChange={(e) => setF({ ...f, arrivalTime: e.target.value })} /></F>
        <F label="Terminal"><input className={inp} value={f.terminal} onChange={(e) => setF({ ...f, terminal: e.target.value })} /></F>
        <F label="Driver assigned"><input className={inp} value={f.driverAssigned} onChange={(e) => setF({ ...f, driverAssigned: e.target.value })} /></F>
        <F label="Coordinator"><input className={inp} value={f.coordinatorAssigned} onChange={(e) => setF({ ...f, coordinatorAssigned: e.target.value })} /></F>
      </div>
    </Section>
  );
}

function RequirementsSection({ traveler, onChange }: any) {
  const [home, setHome] = useState({ country: '', city: '' });
  const [dest, setDest] = useState({ country: '', city: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setHome({ country: traveler.homeCountry || '', city: traveler.homeCity || '' }); setDest({ country: traveler.workRegion || '', city: '' }); }, [traveler]);
  const compute = async () => {
    setBusy(true);
    try {
      await travelApi.updTraveler(traveler.id, { homeCountry: home.country || null, homeCity: home.city || null });
      await travelApi.requirements(traveler.id, { destinationCountry: dest.country || undefined, destinationCity: dest.city || undefined });
      onChange();
    } finally { setBusy(false); }
  };
  const Flag = ({ label, on }: any) => (
    <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${on ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
      {on ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />} {label}: {on ? 'Required' : 'No'}
    </span>
  );
  return (
    <Section icon={<Plane size={13} />} title="Travel requirements"
      right={<button onClick={compute} disabled={busy} className="text-xs inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-2.5 py-1 disabled:opacity-40">{busy && <Loader2 size={12} className="animate-spin" />} Compute</button>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
        <F label="Home country"><input className={inp} value={home.country} onChange={(e) => setHome({ ...home, country: e.target.value })} placeholder="AE / GB" /></F>
        <F label="Home city"><input className={inp} value={home.city} onChange={(e) => setHome({ ...home, city: e.target.value })} placeholder="Abu Dhabi" /></F>
        <F label="Shoot country"><input className={inp} value={dest.country} onChange={(e) => setDest({ ...dest, country: e.target.value })} placeholder="AE / GB" /></F>
        <F label="Shoot city"><input className={inp} value={dest.city} onChange={(e) => setDest({ ...dest, city: e.target.value })} /></F>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${traveler.isLocalTalent ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>{traveler.isLocalTalent ? 'Local talent' : 'Travelling'}</span>
        <Flag label="Travel" on={traveler.travelRequired} />
        <Flag label="Visa" on={traveler.visaRequired} />
        <Flag label="Hotel" on={traveler.accommodationRequired} />
        <Flag label="Ground transport" on={traveler.groundTransportRequired} />
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Local talent need no travel/visa/hotel — those items are excluded from readiness.</p>
    </Section>
  );
}
