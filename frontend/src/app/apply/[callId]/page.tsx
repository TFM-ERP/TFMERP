'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { castingApi } from '@/lib/api';
import {
  Clapperboard, ShieldCheck, X, CheckCircle2, Loader2, Lock, Trash2, Film, AlertTriangle,
} from 'lucide-react';

export default function TalentPortal() {
  const { callId } = useParams<{ callId: string }>();
  const [call, setCall] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [f, setF] = useState<any>({
    fullName: '', stageName: '', email: '', phone: '', baseCity: '', nationality: '', dateOfBirth: '',
    languages: '', skills: '', laborBodyId: '', headshotUrl: '', reelUrl: '', coverNote: '', proposedRate: '',
    isMinor: false, guardianName: '', guardianEmail: '',
  });
  const [unions, setUnions] = useState<any[]>([]);
  const [gdpr, setGdpr] = useState(false);     // GDPR Auto-Window open
  const [done, setDone] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!callId) return;
    castingApi.publicCall(callId).then((r) => setCall(r.data)).catch(() => setNotFound(true));
    castingApi.unions().then((r) => setUnions(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [callId]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const valid = f.fullName.trim() && f.email.trim() && (!f.isMinor || (f.guardianName && f.guardianEmail));

  const submit = async (consent: any) => {
    setBusy(true);
    try {
      const r = await castingApi.publicSubmit({
        castingCallId: callId,
        talent: {
          fullName: f.fullName, stageName: f.stageName || undefined, email: f.email, phone: f.phone || undefined,
          baseCity: f.baseCity || undefined, nationality: f.nationality || undefined,
          dateOfBirth: f.dateOfBirth || undefined, isMinor: f.isMinor,
          guardianName: f.guardianName || undefined, guardianEmail: f.guardianEmail || undefined,
          laborBodyId: f.laborBodyId || undefined,
          unionStatus: (unions.find((u) => u.id === f.laborBodyId)?.shortName) || (f.laborBodyId ? undefined : 'Non-union'),
          languages: f.languages ? f.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
          skills: f.skills ? f.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
          headshotUrls: f.headshotUrl ? [f.headshotUrl] : undefined,
          reelUrls: f.reelUrl ? [f.reelUrl] : undefined,
        },
        coverNote: f.coverNote || undefined,
        proposedRate: f.proposedRate === '' ? undefined : Number(f.proposedRate),
        consent,
      });
      setDone(r.data); setGdpr(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Submission failed. Please try again.');
    } finally { setBusy(false); }
  };

  if (notFound) return <Centered><p className="text-slate-500">This casting call is no longer available.</p></Centered>;
  if (!call) return <Centered><Loader2 className="animate-spin text-slate-300" /></Centered>;

  if (done) return (
    <Centered>
      <div className="text-center max-w-md">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="text-emerald-600" size={28} /></div>
        <h2 className="text-xl font-semibold text-slate-900 mt-4">Application received</h2>
        <p className="text-slate-500 mt-2 text-sm">Thank you for applying for <b>{call.roleName}</b>. The casting team will be in touch if you're shortlisted. Your consent has been recorded and you may request erasure at any time.</p>
      </div>
    </Centered>
  );

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  return (
    <div className="font-sans min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center gap-2 mb-1"><Clapperboard className="text-[#0f172a]" size={22} /><span className="text-sm font-medium text-slate-400">The Film Makers — Casting</span></div>
        <h1 className="text-2xl font-bold text-slate-900">{call.roleName}</h1>
        <p className="text-slate-600 mt-1">{call.characterDescription || 'We are casting for this role. Submit your profile below.'}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {call.roleType && <Tag>{call.roleType.replace(/_/g, ' ')}</Tag>}
          {(call.ageMin || call.ageMax) && <Tag>Age {call.ageMin || '?'}–{call.ageMax || '?'}</Tag>}
          {call.gender && <Tag>{call.gender}</Tag>}
          {call.unionRequirement && <Tag>{call.unionRequirement}</Tag>}
          {(call.specialSkills || []).slice(0, 4).map((s: string) => <Tag key={s}>{s}</Tag>)}
        </div>

        <div className="mt-7 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-6 grid grid-cols-2 gap-3">
          <Field label="Full name *" full><input className={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
          <Field label="Stage name"><input className={inp} value={f.stageName} onChange={(e) => set('stageName', e.target.value)} /></Field>
          <Field label="Email *"><input type="email" className={inp} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Phone"><input className={inp} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Based in"><input className={inp} value={f.baseCity} onChange={(e) => set('baseCity', e.target.value)} placeholder="Abu Dhabi" /></Field>
          <Field label="Nationality"><input className={inp} value={f.nationality} onChange={(e) => set('nationality', e.target.value)} /></Field>
          <Field label="Date of birth"><input type="date" className={inp} value={f.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></Field>
          <Field label="Union / Guild"><select className={inp} value={f.laborBodyId} onChange={(e) => set('laborBodyId', e.target.value)}><option value="">None / Non-union</option>{unions.map((u) => <option key={u.id} value={u.id}>{u.name}{u.country?.name ? ` (${u.country.name})` : ''}</option>)}</select></Field>
          <Field label="Languages (comma-sep)" full><input className={inp} value={f.languages} onChange={(e) => set('languages', e.target.value)} placeholder="Arabic, English" /></Field>
          <Field label="Skills (comma-sep)" full><input className={inp} value={f.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Horse riding, Stage combat" /></Field>
          <Field label="Headshot URL"><input className={inp} value={f.headshotUrl} onChange={(e) => set('headshotUrl', e.target.value)} placeholder="https://" /></Field>
          <Field label="Reel URL"><input className={inp} value={f.reelUrl} onChange={(e) => set('reelUrl', e.target.value)} placeholder="https://" /></Field>
          <Field label="Cover note" full><textarea rows={3} className={inp} value={f.coverNote} onChange={(e) => set('coverNote', e.target.value)} /></Field>
          <Field label="Desired rate (optional)"><input type="number" className={inp} value={f.proposedRate} onChange={(e) => set('proposedRate', e.target.value)} /></Field>

          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600 mt-1">
            <input type="checkbox" checked={f.isMinor} onChange={(e) => set('isMinor', e.target.checked)} className="rounded" /> I am under 18 (a parent/guardian must consent)
          </label>
          {f.isMinor && (
            <>
              <Field label="Guardian name *"><input className={inp} value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} /></Field>
              <Field label="Guardian email *"><input type="email" className={inp} value={f.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} /></Field>
            </>
          )}
        </div>

        <button onClick={() => valid && setGdpr(true)} disabled={!valid}
          className="mt-5 w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2">
          <ShieldCheck size={16} /> Continue to consent
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1"><Lock size={11} /> Your data is handled under GDPR. You can withdraw consent and request erasure at any time.</p>
      </div>

      {gdpr && <GdprWindow call={call} isMinor={f.isMinor} busy={busy} onClose={() => setGdpr(false)} onConsent={submit} />}
    </div>
  );
}

// ── GDPR Auto-Window: mandatory consent before submission ────────────────────
function GdprWindow({ call, isMinor, busy, onClose, onConsent }: any) {
  const [dp, setDp] = useState(false);       // data processing — mandatory
  const [img, setImg] = useState(false);     // image/likeness — mandatory for casting media
  const [rtbf, setRtbf] = useState(false);   // acknowledge right to be forgotten — mandatory
  const [guardian, setGuardian] = useState(false);
  const ready = dp && img && rtbf && (!isMinor || guardian);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#1f2937] to-[#374151] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#0f172a]" /><h3 className="font-semibold">Data consent — required to submit</h3></div>
          <button onClick={onClose} className="text-slate-300 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto text-sm">
          <p className="text-slate-600 text-[13px]">The Film Makers FZ LLC will process the personal data you provide to evaluate your application for <b>{call.roleName}</b>. Please confirm the following before submitting.</p>

          <Consent checked={dp} on={setDp} title="Data processing consent" req>
            I consent to The Film Makers storing and processing my personal data (contact details, profile, and any media I provide) for the purpose of this casting and related production planning. Lawful basis: consent (GDPR Art. 6(1)(a)).
          </Consent>
          <Consent checked={img} on={setImg} icon={<Film size={14} />} title="Image & likeness" req>
            I consent to my headshots, reel and any audition recordings being used internally for casting evaluation by the production team.
          </Consent>
          <Consent checked={rtbf} on={setRtbf} icon={<Trash2 size={14} />} title="Right to be forgotten" req>
            I understand I may withdraw consent and request erasure of my data at any time by contacting the casting team, and that my data will be retained only as long as necessary for this casting.
          </Consent>
          {isMinor && (
            <Consent checked={guardian} on={setGuardian} icon={<AlertTriangle size={14} />} title="Guardian consent" req>
              I confirm I am the parent/legal guardian of this applicant and I consent on their behalf to the above.
            </Consent>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
          <span className="text-[11px] text-slate-500">All boxes are required.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
            <button disabled={!ready || busy}
              onClick={() => onConsent({ dataProcessing: dp, imageLikeness: img, rightToBeForgotten: rtbf, guardian, method: 'WEB_FORM', version: 'v1' })}
              className="rounded-xl px-4 py-2 text-sm bg-[#0f172a] text-white disabled:opacity-40 inline-flex items-center gap-1.5">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Agree & submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Consent({ checked, on, title, icon, req, children }: any) {
  return (
    <label className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => on(e.target.checked)} className="mt-0.5 rounded" />
      <span>
        <span className="font-medium text-slate-800 text-[13px] flex items-center gap-1.5">{icon}{title}{req && <span className="text-rose-500">*</span>}</span>
        <span className="block text-[12px] text-slate-500 mt-0.5 leading-relaxed">{children}</span>
      </span>
    </label>
  );
}

const Centered = ({ children }: any) => <div className="font-sans min-h-screen flex items-center justify-center bg-slate-50 p-6">{children}</div>;
const Tag = ({ children }: any) => <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{children}</span>;
function Field({ label, full, children }: any) {
  return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;
}
