'use client';

import { useState, useEffect, useCallback } from 'react';
import { castingApi, travelApi, assetUrl } from '@/lib/api';
import { RepresentationTab, CreditsTab, CrmTab } from '@/components/production/TalentV3Tabs';
import { Clapperboard, Wand2, Users, Star, CheckCircle2, Loader2, ChevronRight, Plus, X, BookOpen, Handshake, Film, Gavel, Gauge, CreditCard, Plane, AlertTriangle, Contact, Briefcase, Video, Trash2 } from 'lucide-react';

const SUB_STATUS: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-600', UNDER_REVIEW: 'bg-blue-100 text-blue-700', SHORTLISTED: 'bg-violet-100 text-violet-700',
  CALLBACK: 'bg-amber-100 text-amber-700', OFFERED: 'bg-emerald-100 text-emerald-700', CONFIRMED: 'bg-emerald-100 text-emerald-700',
  DECLINED: 'bg-rose-100 text-rose-700', WITHDRAWN: 'bg-slate-100 text-slate-400',
  DRAFT: 'bg-slate-100 text-slate-500', OPEN: 'bg-emerald-100 text-emerald-700', BOOKED: 'bg-emerald-100 text-emerald-700',
  ON_SET: 'bg-emerald-100 text-emerald-700', WRAPPED: 'bg-slate-100 text-slate-500', ARCHIVED: 'bg-slate-100 text-slate-400',
  NEGOTIATION: 'bg-amber-100 text-amber-700', DEAL_MEMO_SIGNED: 'bg-emerald-100 text-emerald-700',
};
// V3-G — full ordered casting pipeline (mirrors backend SUBMISSION_PIPELINE).
const PIPELINE = ['DRAFT', 'OPEN', 'PUBLIC', 'INVITED', 'SUBMITTED', 'UNDER_REVIEW', 'CASTING_ASSISTANT_REVIEW', 'CASTING_DIRECTOR_REVIEW', 'PRODUCER_REVIEW', 'DIRECTOR_REVIEW', 'STUDIO_REVIEW', 'SHORTLISTED', 'CALLBACK', 'CHEMISTRY_READ', 'NEGOTIATION', 'OFFERED', 'DEAL_MEMO_PENDING', 'DEAL_MEMO_SIGNED', 'TRAVEL_PENDING', 'VISA_PENDING', 'BOOKED', 'ON_SET', 'WRAPPED', 'ARCHIVED'];
const PIPELINE_PLUS = [...PIPELINE, 'DECLINED', 'WITHDRAWN'];
const CALL_STATUS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', OPEN: 'bg-emerald-100 text-emerald-700', IN_REVIEW: 'bg-blue-100 text-blue-700',
  CALLBACKS: 'bg-amber-100 text-amber-700', OFFER: 'bg-violet-100 text-violet-700', CAST: 'bg-emerald-100 text-emerald-700', CLOSED: 'bg-slate-100 text-slate-400',
};

export default function CastingPanel({ projectId }: { projectId: string }) {
  const [calls, setCalls] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [charCall, setCharCall] = useState<any | null>(null);
  const [boardCall, setBoardCall] = useState<any | null>(null);
  const [tapeCall, setTapeCall] = useState<any | null>(null);
  const [view, setView] = useState<'calls' | 'ops' | 'talent'>('talent');
  const [toast, setToast] = useState('');

  const load = useCallback(() => { castingApi.calls(projectId).then((r) => setCalls(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const genFromBreakdown = async () => {
    setBusy('gen');
    try { const r = await castingApi.fromBreakdown({ projectId }); flash(`${r.data?.created ?? 0} call(s) generated from breakdown`); load(); } finally { setBusy(''); }
  };

  return (
    <div className="font-sans">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2"><Clapperboard size={18} className="text-[#0f172a]" /> Casting</h3>
          <p className="text-xs text-slate-500 mt-0.5">Talent on this project — readiness, documents, reviews &amp; status, plus roles and submissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            <button onClick={() => setView('talent')} className={`px-3 py-1.5 rounded-md font-medium ${view === 'talent' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Talent</button>
            <button onClick={() => setView('calls')} className={`px-3 py-1.5 rounded-md font-medium ${view === 'calls' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Calls</button>
            <button onClick={() => setView('ops')} className={`px-3 py-1.5 rounded-md font-medium ${view === 'ops' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Operations</button>
          </div>
          {view === 'calls' && <button onClick={genFromBreakdown} disabled={busy === 'gen'} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 text-slate-600 px-3 py-2 text-sm disabled:opacity-40">
            {busy === 'gen' ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Generate from breakdown
          </button>}
        </div>
      </div>

      {view === 'talent' ? <TalentRoster projectId={projectId} /> : view === 'ops' ? <OperationsHub projectId={projectId} /> : calls.length === 0 ? (
        <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200"><Clapperboard className="mx-auto text-slate-300" size={36} /><p className="text-slate-500 mt-2 text-sm">No casting calls. Generate them from the script breakdown.</p></div>
      ) : (
        <div className="grid gap-2.5">
          {calls.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="w-full p-4 flex items-center justify-between gap-3">
                <button onClick={() => setOpenId(openId === c.id ? null : c.id)} className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium text-slate-900">{c.roleName}</span><span className={`text-[11px] px-2 py-0.5 rounded-full ${CALL_STATUS[c.status] || 'bg-slate-100'}`}>{c.status.replace(/_/g, ' ')}</span></div>
                  <p className="text-xs text-slate-500 mt-0.5">{c.roleType?.replace(/_/g, ' ')} · {c._count?.submissions ?? 0} submissions{c.breakdownElement ? ` · from “${c.breakdownElement.name}”` : ''}</p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setBoardCall(c)} title="Producer review board" className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Gavel size={13} /> Review</button>
                  <button onClick={() => setCharCall(c)} title="Character profile" className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><BookOpen size={13} /> Character</button>
                  <button onClick={() => setTapeCall(c)} title="Self-tape & audition package" className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Video size={13} /> Self-tape</button>
                  <button onClick={() => setOpenId(openId === c.id ? null : c.id)}><ChevronRight size={16} className={`text-slate-300 transition ${openId === c.id ? 'rotate-90' : ''}`} /></button>
                </div>
              </div>
              {openId === c.id && <CallSubmissions callId={c.id} onChange={load} flash={flash} />}
            </div>
          ))}
        </div>
      )}

      {toast && <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lg flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> {toast}</div>}
      {charCall && <CharacterEditor call={charCall} onClose={() => setCharCall(null)} onSaved={() => { setCharCall(null); load(); }} />}
      {boardCall && <ReviewBoard call={boardCall} onClose={() => setBoardCall(null)} onChange={load} />}
      {tapeCall && <SelfTapeDrawer call={tapeCall} onClose={() => setTapeCall(null)} />}
    </div>
  );
}

// Producer Review Board — role-centric candidate review.
const VERDICTS: [string, string, string][] = [
  ['APPROVED', 'Approve', 'bg-emerald-600'],
  ['MAYBE', 'Maybe', 'bg-amber-500'],
  ['PASS', 'Pass', 'bg-rose-500'],
  ['CALLBACK', 'Callback', 'bg-blue-600'],
  ['CHEMISTRY_READ', 'Chemistry', 'bg-violet-600'],
];
const VERDICT_CLS: Record<string, string> = { APPROVED: 'bg-emerald-100 text-emerald-700', MAYBE: 'bg-amber-100 text-amber-700', PASS: 'bg-rose-100 text-rose-700', CALLBACK: 'bg-blue-100 text-blue-700', CHEMISTRY_READ: 'bg-violet-100 text-violet-700' };

function ReviewBoard({ call, onClose, onChange }: any) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const load = () => castingApi.call(call.id).then((r) => setData(r.data)).catch(() => setData(false));
  useEffect(() => { load(); }, [call.id]);
  const setV = async (subId: string, verdict: string) => {
    setBusy(subId + verdict);
    try { await castingApi.setVerdict(subId, verdict); load(); onChange?.(); } finally { setBusy(''); }
  };
  const subs: any[] = data?.submissions || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div><h2 className="font-semibold text-slate-900 flex items-center gap-2"><Gavel size={16} className="text-[#0f172a]" /> Review Board — {call.roleName}</h2><p className="text-xs text-slate-500">{subs.length} candidate{subs.length === 1 ? '' : 's'}</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {data === null ? <p className="text-center text-slate-400 py-10"><Loader2 className="animate-spin mx-auto" /></p>
            : subs.length === 0 ? <p className="text-center text-slate-400 py-10 text-sm">No candidates yet.</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {subs.map((s) => {
                const t = s.talent || {};
                const aud = (s.auditions || [])[0];
                return (
                  <div key={s.id} className="rounded-2xl border border-slate-200 overflow-hidden flex">
                    <div className="w-24 bg-slate-100 shrink-0 flex items-center justify-center">
                      {(t.headshotUrls || [])[0] ? <img src={assetUrl(t.headshotUrls[0])} alt="" className="w-full h-full object-cover" /> : <Users size={28} className="text-slate-300" />}
                    </div>
                    <div className="p-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">{t.stageName || t.fullName}</span>
                        {s.boardVerdict && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${VERDICT_CLS[s.boardVerdict]}`}>{s.boardVerdict.replace('_', ' ')}</span>}
                      </div>
                      <div className="text-[11px] text-slate-400">{[t.unionStatus, t.agencyName].filter(Boolean).join(' · ') || '—'}</div>
                      <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                        {(t.reelUrls || [])[0] && <a href={t.reelUrls[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600"><Film size={11} /> Reel</a>}
                        {aud && <div>Audition: {aud.type?.replace('_', ' ')} · {aud.status}</div>}
                        {s.availabilityNote && <div>Avail: {s.availabilityNote}</div>}
                        {s.proposedRate != null && <div>Rate: {Number(s.proposedRate).toLocaleString()}</div>}
                        {s.coverNote && <div className="text-slate-400 line-clamp-2">{s.coverNote}</div>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {VERDICTS.map(([v, label, cls]) => (
                          <button key={v} onClick={() => setV(s.id, v)} disabled={busy === s.id + v} className={`text-[10px] px-2 py-0.5 rounded-full text-white disabled:opacity-40 ${cls} ${s.boardVerdict === v ? 'ring-2 ring-offset-1 ring-slate-300' : 'opacity-80 hover:opacity-100'}`}>{busy === s.id + v ? '…' : label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CharacterEditor({ call, onClose, onSaved }: { call: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: call.roleName || '', characterCode: '', scriptReference: '', backstory: '', arc: '', relationships: '', personalityNotes: '', visualReferences: '', shootDays: '', scenesCount: '', nightShoots: '', travelDays: '', locations: '', dialoguePages: '', stuntDays: '', castingGender: '', ageRangeMin: '', ageRangeMax: '', castingEthnicity: '', castingNationality: '', castingLanguage: '', castingAccent: '', physicalRequirements: '', requiredSkills: '', certifications: '', requirements: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const charId = call.characterProfile?.id || call.characterProfileId || null;

  useEffect(() => {
    if (!charId) { setLoading(false); return; }
    castingApi.character(charId).then((r) => {
      const c = r.data || {};
      const join = (a: any) => (Array.isArray(a) ? a.join(', ') : '');
      setF({
        name: c.name || call.roleName || '', characterCode: c.characterCode || '', scriptReference: c.scriptReference || '',
        backstory: c.backstory || '', arc: c.arc || '', relationships: c.relationships || '', personalityNotes: c.personalityNotes || '', visualReferences: join(c.visualReferences),
        shootDays: c.shootDays ?? '', scenesCount: c.scenesCount ?? '', nightShoots: c.nightShoots ?? '', travelDays: c.travelDays ?? '', locations: c.locations || '', dialoguePages: c.dialoguePages ?? '', stuntDays: c.stuntDays ?? '',
        castingGender: c.castingGender || '', ageRangeMin: c.ageRangeMin ?? '', ageRangeMax: c.ageRangeMax ?? '', castingEthnicity: c.castingEthnicity || '', castingNationality: c.castingNationality || '', castingLanguage: c.castingLanguage || '', castingAccent: c.castingAccent || '',
        physicalRequirements: c.physicalRequirements || '', requiredSkills: join(c.requiredSkills), certifications: join(c.certifications), requirements: c.requirements || '',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [charId]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      const arr = (s: string) => (s ? s.split(',').map((x: string) => x.trim()).filter(Boolean) : undefined);
      const payload = { ...f, visualReferences: arr(f.visualReferences), requiredSkills: arr(f.requiredSkills), certifications: arr(f.certifications), projectId: call.projectId || undefined, breakdownElementId: call.breakdownElementId || undefined };
      if (charId) await castingApi.updCharacter(charId, payload);
      else {
        const r = await castingApi.addCharacter(payload);
        if (r.data?.id) await castingApi.updCall(call.id, { characterProfileId: r.data.id });
      }
      onSaved();
    } finally { setBusy(false); }
  };
  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  const L = ({ label, children, full }: any) => <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 glass-bar">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><BookOpen size={16} className="text-[#0f172a]" /> Character — {call.roleName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        {loading ? <p className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></p> : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <L label="Character name"><input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} /></L>
              <L label="Character ID / code"><input className={inp} value={f.characterCode} onChange={(e) => set('characterCode', e.target.value)} placeholder="CHAR-014" /></L>
              <L label="Script reference" full><input className={inp} value={f.scriptReference} onChange={(e) => set('scriptReference', e.target.value)} placeholder="Scenes 4, 12, 30–34" /></L>
            </div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Creative</p>
              <div className="space-y-2">
                <L label="Backstory" full><textarea rows={3} className={inp} value={f.backstory} onChange={(e) => set('backstory', e.target.value)} /></L>
                <L label="Arc" full><textarea rows={2} className={inp} value={f.arc} onChange={(e) => set('arc', e.target.value)} /></L>
                <L label="Personality notes" full><textarea rows={2} className={inp} value={f.personalityNotes} onChange={(e) => set('personalityNotes', e.target.value)} /></L>
                <L label="Relationships" full><textarea rows={2} className={inp} value={f.relationships} onChange={(e) => set('relationships', e.target.value)} /></L>
                <L label="Visual references (comma-sep links)" full><input className={inp} value={f.visualReferences} onChange={(e) => set('visualReferences', e.target.value)} /></L>
              </div>
            </div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Production analysis</p>
              <div className="grid grid-cols-3 gap-2">
                <L label="Scenes"><input type="number" className={inp} value={f.scenesCount} onChange={(e) => set('scenesCount', e.target.value)} /></L>
                <L label="Dialogue pages"><input type="number" step="0.1" className={inp} value={f.dialoguePages} onChange={(e) => set('dialoguePages', e.target.value)} /></L>
                <L label="Shoot days"><input type="number" className={inp} value={f.shootDays} onChange={(e) => set('shootDays', e.target.value)} /></L>
                <L label="Night shoots"><input type="number" className={inp} value={f.nightShoots} onChange={(e) => set('nightShoots', e.target.value)} /></L>
                <L label="Stunt days"><input type="number" className={inp} value={f.stuntDays} onChange={(e) => set('stuntDays', e.target.value)} /></L>
                <L label="Travel days"><input type="number" className={inp} value={f.travelDays} onChange={(e) => set('travelDays', e.target.value)} /></L>
                <L label="Locations" full><input className={inp} value={f.locations} onChange={(e) => set('locations', e.target.value)} placeholder="comma-sep" /></L>
              </div>
            </div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Casting requirements</p>
              <div className="grid grid-cols-2 gap-2">
                <L label="Gender"><input className={inp} value={f.castingGender} onChange={(e) => set('castingGender', e.target.value)} /></L>
                <div className="grid grid-cols-2 gap-2"><L label="Age min"><input type="number" className={inp} value={f.ageRangeMin} onChange={(e) => set('ageRangeMin', e.target.value)} /></L><L label="Age max"><input type="number" className={inp} value={f.ageRangeMax} onChange={(e) => set('ageRangeMax', e.target.value)} /></L></div>
                <L label="Ethnicity"><input className={inp} value={f.castingEthnicity} onChange={(e) => set('castingEthnicity', e.target.value)} /></L>
                <L label="Nationality"><input className={inp} value={f.castingNationality} onChange={(e) => set('castingNationality', e.target.value)} /></L>
                <L label="Language"><input className={inp} value={f.castingLanguage} onChange={(e) => set('castingLanguage', e.target.value)} /></L>
                <L label="Accent"><input className={inp} value={f.castingAccent} onChange={(e) => set('castingAccent', e.target.value)} /></L>
                <L label="Required skills (comma-sep)" full><input className={inp} value={f.requiredSkills} onChange={(e) => set('requiredSkills', e.target.value)} /></L>
                <L label="Certifications (comma-sep)" full><input className={inp} value={f.certifications} onChange={(e) => set('certifications', e.target.value)} /></L>
                <L label="Physical requirements" full><input className={inp} value={f.physicalRequirements} onChange={(e) => set('physicalRequirements', e.target.value)} /></L>
                <L label="Notes" full><textarea rows={2} className={inp} value={f.requirements} onChange={(e) => set('requirements', e.target.value)} /></L>
              </div>
            </div>
            {charId && <CharacterMatches characterId={charId} />}
            {charId && <CharacterHistory characterId={charId} />}
          </div>
        )}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={save} disabled={busy || loading} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Save character</button>
        </div>
      </div>
    </div>
  );
}

function CharacterMatches({ characterId }: { characterId: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { castingApi.characterMatches(characterId).then((r) => setD(r.data)).catch(() => setD(false)); }, [characterId]);
  if (!d) return null;
  const mcls = (s: number) => (s >= 80 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : 'text-rose-600');
  const bcls = (s: number) => (s >= 80 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-rose-400');
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Match engine</p>
      {!d.hasRequirements ? <p className="text-xs text-slate-400">Add casting requirements above (gender, age, language, skills…) to score candidates.</p>
        : (d.matches || []).length === 0 ? <p className="text-xs text-slate-400">No submitted candidates to score yet.</p> : (
        <div className="space-y-2">
          {d.matches.map((m: any) => (
            <div key={m.talentId} className="rounded-xl border border-slate-200 p-2.5">
              <div className="flex items-center gap-2">
                {m.headshot ? <img src={assetUrl(m.headshot)} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-slate-100 grid place-items-center"><Users size={13} className="text-slate-400" /></span>}
                <span className="text-sm font-medium text-slate-800 flex-1 truncate">{m.name}</span>
                {m.score != null && <span className={`text-sm font-bold ${mcls(m.score)}`}>{m.score}%</span>}
              </div>
              {m.score != null && <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5"><div className={`h-full ${bcls(m.score)}`} style={{ width: `${m.score}%` }} /></div>}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(m.strengths || []).map((s: string, i: number) => <span key={`s${i}`} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ {s}</span>)}
                {(m.missing || []).map((s: string, i: number) => <span key={`m${i}`} className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700">✗ {s}</span>)}
                {(m.risks || []).map((s: string, i: number) => <span key={`r${i}`} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">⚠ {s}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SelfTapeDrawer({ call, onClose }: any) {
  const [pkg, setPkg] = useState<any>(null);
  const [tapes, setTapes] = useState<any[]>([]);
  const [p, setP] = useState<any>({ title: `${call.roleName} — audition`, characterBrief: '', sides: '', referenceLinks: '', moodBoards: '', productionNotes: '', deadline: '', requiredFormat: 'mp4', minResolution: '1080p', maxDurationSec: '180' });
  const [t, setT] = useState<any>({ videoUrl: '', slateUrl: '', format: '', resolution: '', durationSec: '' });
  const [busy, setBusy] = useState('');
  const STATUS: Record<string, string> = { RECEIVED: 'bg-slate-100 text-slate-600', UNDER_REVIEW: 'bg-blue-100 text-blue-700', ACCEPTED: 'bg-emerald-100 text-emerald-700', REJECTED: 'bg-rose-100 text-rose-700' };

  const load = useCallback(() => {
    castingApi.packages(call.id).then((r) => {
      const first = (Array.isArray(r.data) ? r.data : [])[0] || null;
      setPkg(first);
      if (first) { setP((x: any) => ({ ...x, title: first.title || x.title, characterBrief: first.characterBrief || '', sides: (first.sides || []).join(', '), referenceLinks: (first.referenceLinks || []).join(', '), moodBoards: (first.moodBoards || []).join(', '), productionNotes: first.productionNotes || '', deadline: first.deadline ? new Date(first.deadline).toISOString().slice(0, 10) : '', requiredFormat: first.requiredFormat || 'mp4', minResolution: first.minResolution || '1080p', maxDurationSec: first.maxDurationSec ?? '180' })); castingApi.selfTapes({ packageId: first.id }).then((s) => setTapes(Array.isArray(s.data) ? s.data : [])); }
    }).catch(() => {});
  }, [call.id]);
  useEffect(() => { load(); }, [load]);

  const arr = (s: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
  const savePkg = async () => {
    setBusy('pkg');
    try {
      const payload = { ...p, sides: arr(p.sides), referenceLinks: arr(p.referenceLinks), moodBoards: arr(p.moodBoards), deadline: p.deadline || undefined };
      if (pkg) await castingApi.updPackage(pkg.id, payload); else await castingApi.addPackage(call.id, payload);
      load();
    } finally { setBusy(''); }
  };
  const addTape = async () => {
    if (!t.videoUrl || !pkg) return; setBusy('tape');
    try { await castingApi.addSelfTape({ ...t, packageId: pkg.id, durationSec: t.durationSec || undefined }); setT({ videoUrl: '', slateUrl: '', format: '', resolution: '', durationSec: '' }); castingApi.selfTapes({ packageId: pkg.id }).then((s) => setTapes(Array.isArray(s.data) ? s.data : [])); } finally { setBusy(''); }
  };
  const setStatus = async (id: string, status: string) => { await castingApi.setSelfTapeStatus(id, status); castingApi.selfTapes({ packageId: pkg.id }).then((s) => setTapes(Array.isArray(s.data) ? s.data : [])); };
  const delTape = async (id: string) => { await castingApi.delSelfTape(id); castingApi.selfTapes({ packageId: pkg.id }).then((s) => setTapes(Array.isArray(s.data) ? s.data : [])); };

  const inp = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#0f172a]';
  const flag = (v: any, label: string) => v == null ? null : <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${v ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{v ? '✓' : '✗'} {label}</span>;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 glass-bar z-10">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Video size={16} className="text-[#0f172a]" /> Self-tape — {call.roleName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Audition package</p>
            <div className="grid grid-cols-2 gap-2">
              <input className={`${inp} col-span-2`} placeholder="Title" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
              <textarea rows={2} className={`${inp} col-span-2`} placeholder="Character brief" value={p.characterBrief} onChange={(e) => setP({ ...p, characterBrief: e.target.value })} />
              <input className={`${inp} col-span-2`} placeholder="Sides (comma links)" value={p.sides} onChange={(e) => setP({ ...p, sides: e.target.value })} />
              <input className={`${inp} col-span-2`} placeholder="Reference video links (comma)" value={p.referenceLinks} onChange={(e) => setP({ ...p, referenceLinks: e.target.value })} />
              <input className={`${inp} col-span-2`} placeholder="Mood boards (comma links)" value={p.moodBoards} onChange={(e) => setP({ ...p, moodBoards: e.target.value })} />
              <textarea rows={2} className={`${inp} col-span-2`} placeholder="Production notes" value={p.productionNotes} onChange={(e) => setP({ ...p, productionNotes: e.target.value })} />
              <label className="text-[11px] text-slate-500">Deadline<input type="date" className={inp} value={p.deadline} onChange={(e) => setP({ ...p, deadline: e.target.value })} /></label>
              <label className="text-[11px] text-slate-500">Format<input className={inp} value={p.requiredFormat} onChange={(e) => setP({ ...p, requiredFormat: e.target.value })} placeholder="mp4" /></label>
              <label className="text-[11px] text-slate-500">Min resolution<input className={inp} value={p.minResolution} onChange={(e) => setP({ ...p, minResolution: e.target.value })} placeholder="1080p" /></label>
              <label className="text-[11px] text-slate-500">Max duration (sec)<input type="number" className={inp} value={p.maxDurationSec} onChange={(e) => setP({ ...p, maxDurationSec: e.target.value })} /></label>
            </div>
            <button onClick={savePkg} disabled={busy === 'pkg'} className="mt-2 text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">{busy === 'pkg' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />} {pkg ? 'Update package' : 'Create package'}</button>
            <p className="text-[10px] text-slate-400 mt-1">Metadata only — the system records links &amp; validates against rules; it does not host video.</p>
          </div>

          {pkg && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Self-tape submissions ({tapes.length})</p>
              <div className="rounded-xl bg-slate-50 p-3 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <input className={`${inp} col-span-2`} placeholder="Video link (Vimeo/Drive/WeTransfer…) *" value={t.videoUrl} onChange={(e) => setT({ ...t, videoUrl: e.target.value })} />
                  <input className={`${inp} col-span-2`} placeholder="Slate link" value={t.slateUrl} onChange={(e) => setT({ ...t, slateUrl: e.target.value })} />
                  <input className={inp} placeholder="Format (mp4)" value={t.format} onChange={(e) => setT({ ...t, format: e.target.value })} />
                  <input className={inp} placeholder="Resolution (1080p)" value={t.resolution} onChange={(e) => setT({ ...t, resolution: e.target.value })} />
                  <input className={inp} type="number" placeholder="Duration (sec)" value={t.durationSec} onChange={(e) => setT({ ...t, durationSec: e.target.value })} />
                </div>
                <button onClick={addTape} disabled={busy === 'tape' || !t.videoUrl} className="mt-2 text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">{busy === 'tape' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add &amp; validate</button>
              </div>
              <div className="space-y-1.5">
                {tapes.length === 0 ? <p className="text-xs text-slate-400">No self-tapes yet.</p> : tapes.map((tp) => (
                  <div key={tp.id} className="rounded-xl border border-slate-200 p-2.5">
                    <div className="flex items-center gap-2">
                      <a href={tp.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 truncate flex-1 inline-flex items-center gap-1"><Video size={12} /> Watch</a>
                      <select value={tp.status} onChange={(e) => setStatus(tp.id, e.target.value)} className={`text-[10px] rounded-full px-2 py-0.5 border-0 ${STATUS[tp.status] || 'bg-slate-100'}`}>{['RECEIVED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
                      <button onClick={() => delTape(tp.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{[tp.format, tp.resolution, tp.durationSec ? `${tp.durationSec}s` : null].filter(Boolean).join(' · ') || 'no metadata'}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">{flag(tp.formatOk, 'format')}{flag(tp.resolutionOk, 'resolution')}{flag(tp.durationOk, 'duration')}{flag(tp.deadlineOk, 'on time')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CharacterHistory({ characterId }: { characterId: string }) {
  const [h, setH] = useState<any>(null);
  useEffect(() => { castingApi.characterHistory(characterId).then((r) => setH(r.data)).catch(() => setH(false)); }, [characterId]);
  if (!h) return null;
  const stages: [string, string][] = [['submitted', 'Submitted'], ['auditioned', 'Auditioned'], ['callback', 'Callback'], ['offered', 'Offered'], ['cast', 'Cast']];
  const total = (h.submitted || []).length;
  if (total === 0) return <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Character history</p><p className="text-xs text-slate-400">No talent has passed through this character yet.</p></div>;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Character history (permanent record)</p>
      <div className="space-y-2">
        {stages.map(([k, label]) => {
          const arr = h[k] || [];
          if (arr.length === 0) return null;
          return (
            <div key={k}>
              <div className="text-[11px] text-slate-500 mb-1">{label} ({arr.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {arr.map((t: any) => (
                  <span key={t.talentId} className="inline-flex items-center gap-1 rounded-full bg-slate-100 pl-0.5 pr-2 py-0.5 text-[11px] text-slate-700">
                    {t.headshot ? <img src={assetUrl(t.headshot)} alt="" className="w-4 h-4 rounded-full object-cover" /> : <Users size={11} className="text-slate-400" />}{t.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CallSubmissions({ callId, onChange, flash }: { callId: string; onChange: () => void; flash: (m: string) => void }) {
  const [subs, setSubs] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => { castingApi.submissions(callId).then((r) => setSubs(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [callId]);
  useEffect(() => { load(); }, [load]);

  const [negSub, setNegSub] = useState<any | null>(null);
  const select = async (s: any) => {
    setBusy(s.id);
    try { const r = await castingApi.select(s.id); flash(r.data?.dealMemo ? `Deal memo ${r.data.dealMemo.contractNumber} drafted` : (r.data?.reason || 'Selected')); load(); onChange(); } finally { setBusy(''); }
  };

  return (
    <div className="px-4 pb-4 border-t border-slate-100 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1"><Users size={12} /> Submissions ({subs.length})</p>
      {subs.length === 0 ? <p className="text-xs text-slate-400">No submissions yet. Share the public apply link for this role.</p> : (
        <div className="space-y-1.5">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
              <div><div className="text-sm font-medium text-slate-800">{s.talent?.stageName || s.talent?.fullName}</div><div className="text-[11px] text-slate-400">{s.talent?.unionStatus || 'Talent'}{s.talent?.baseCity ? ` · ${s.talent.baseCity}` : ''}</div></div>
              <div className="flex items-center gap-2">
                <select value={PIPELINE_PLUS.includes(s.status) ? s.status : 'SUBMITTED'} onChange={async (e) => { const r = await castingApi.setStage(s.id, e.target.value); flash(`→ ${e.target.value.replace(/_/g, ' ')}${r.data?.automations?.length ? ` · ${r.data.automations.join(', ')}` : ''}`); load(); onChange(); }} className={`text-[10px] rounded-full px-2 py-0.5 border-0 ${SUB_STATUS[s.status] || 'bg-slate-100 text-slate-600'}`}>
                  {PIPELINE_PLUS.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
                </select>
                <button onClick={() => setNegSub(s)} className="text-[11px] inline-flex items-center gap-1 text-slate-600 hover:underline"><Handshake size={11} /> Negotiate</button>
                <button onClick={() => select(s)} disabled={busy === s.id || ['OFFERED', 'CONFIRMED'].includes(s.status)} className="text-[11px] inline-flex items-center gap-1 text-emerald-700 hover:underline disabled:text-slate-300 disabled:no-underline">
                  {busy === s.id ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />} Select
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {negSub && <NegotiationDrawer submission={negSub} onClose={() => setNegSub(null)} onDone={(m: string) => { setNegSub(null); flash(m); load(); onChange(); }} />}
    </div>
  );
}

function NegotiationDrawer({ submission, onClose, onDone }: any) {
  const [n, setN] = useState<any>(null);
  const [round, setRound] = useState({ type: 'COUNTER', amount: '', note: '' });
  const [busy, setBusy] = useState('');
  const load = () => castingApi.openNegotiation(submission.id).then((r) => setN(r.data)).catch(() => setN(false));
  useEffect(() => { load(); }, [submission.id]);
  const set = (k: string, v: any) => setN((x: any) => ({ ...x, [k]: v }));
  const money = (v: any) => (v == null || v === '' ? '—' : `${n?.currency || 'AED'} ${Number(v).toLocaleString()}`);

  const saveTerms = async () => {
    setBusy('save');
    try { await castingApi.updNegotiation(n.id, { travelClass: n.travelClass, accommodationTier: n.accommodationTier, perDiem: n.perDiem, buyout: n.buyout, exclusivity: n.exclusivity, marketingRequirements: n.marketingRequirements, notes: n.notes }); load(); } finally { setBusy(''); }
  };
  const addRound = async () => {
    if (!round.amount && !round.note) return;
    setBusy('round');
    try { await castingApi.updNegotiation(n.id, { round: { type: round.type, amount: round.amount || undefined, note: round.note || undefined } }); setRound({ type: 'COUNTER', amount: '', note: '' }); load(); } finally { setBusy(''); }
  };
  const agree = async () => {
    setBusy('agree');
    try { const r = await castingApi.agreeNegotiation(n.id, { finalRate: n.finalRate || undefined }); onDone(r.data?.dealMemo ? `Agreed — deal memo ${r.data.dealMemo.contractNumber} drafted` : (r.data?.reason || 'Agreed')); } finally { setBusy(''); }
  };

  const inp = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  const L = ({ label, children }: any) => <label className="text-sm"><span className="block text-[11px] font-medium text-slate-500 mb-0.5">{label}</span>{children}</label>;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 glass-bar">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Handshake size={16} className="text-[#0f172a]" /> Negotiation — {submission.talent?.stageName || submission.talent?.fullName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        {!n ? <p className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></p> : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] text-slate-400">Initial</div><div className="text-sm font-semibold text-slate-800">{money(n.initialOffer)}</div></div>
              <div className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] text-slate-400">Counter</div><div className="text-sm font-semibold text-slate-800">{money(n.counterOffer)}</div></div>
              <div className="rounded-xl bg-emerald-50 p-2"><div className="text-[10px] text-emerald-600">Final</div><input className="w-full bg-transparent text-center text-sm font-semibold text-emerald-700 outline-none" value={n.finalRate ?? ''} onChange={(e) => set('finalRate', e.target.value)} placeholder="—" /></div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Add round</p>
              <div className="flex items-end gap-2">
                <L label="Type"><select className={inp} value={round.type} onChange={(e) => setRound({ ...round, type: e.target.value })}>{['OFFER', 'COUNTER', 'NOTE'].map((x) => <option key={x}>{x}</option>)}</select></L>
                <L label="Amount"><input type="number" className={inp} value={round.amount} onChange={(e) => setRound({ ...round, amount: e.target.value })} /></L>
                <button onClick={addRound} disabled={busy === 'round'} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs disabled:opacity-40">Add</button>
              </div>
              <input className={`${inp} mt-2`} placeholder="Note (optional)" value={round.note} onChange={(e) => setRound({ ...round, note: e.target.value })} />
            </div>

            {Array.isArray(n.rounds) && n.rounds.length > 0 && (
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">History</p>
                <div className="space-y-1">{n.rounds.map((r: any, i: number) => (
                  <div key={i} className="text-[11px] text-slate-500 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#0f172a]" /><b className="text-slate-700">{r.type}</b>{r.amount != null ? ` ${money(r.amount)}` : ''}{r.note ? ` · ${r.note}` : ''}<span className="text-slate-300 ml-auto">{r.at ? new Date(r.at).toLocaleDateString() : ''}</span></div>
                ))}</div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Terms</p>
              <div className="grid grid-cols-2 gap-2">
                <L label="Travel class"><select className={inp} value={n.travelClass || ''} onChange={(e) => set('travelClass', e.target.value)}><option value="">—</option>{['ECONOMY', 'BUSINESS', 'FIRST'].map((x) => <option key={x}>{x}</option>)}</select></L>
                <L label="Accommodation"><select className={inp} value={n.accommodationTier || ''} onChange={(e) => set('accommodationTier', e.target.value)}><option value="">—</option>{['STANDARD', 'EXECUTIVE', 'SUITE'].map((x) => <option key={x}>{x}</option>)}</select></L>
                <L label="Per diem"><input type="number" className={inp} value={n.perDiem ?? ''} onChange={(e) => set('perDiem', e.target.value)} /></L>
                <L label="Buyout"><input className={inp} value={n.buyout || ''} onChange={(e) => set('buyout', e.target.value)} /></L>
                <L label="Exclusivity"><input className={inp} value={n.exclusivity || ''} onChange={(e) => set('exclusivity', e.target.value)} /></L>
                <L label="Marketing"><input className={inp} value={n.marketingRequirements || ''} onChange={(e) => set('marketingRequirements', e.target.value)} /></L>
              </div>
              <button onClick={saveTerms} disabled={busy === 'save'} className="mt-2 text-xs rounded-lg border border-slate-200 text-slate-600 px-3 py-1.5">Save terms</button>
            </div>
          </div>
        )}
        {n && <div className="flex justify-between gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <span className="text-[11px] text-slate-400 self-center">{n.status}</span>
          <button onClick={agree} disabled={busy === 'agree' || n.status === 'AGREED'} className="rounded-xl px-4 py-2 text-sm bg-emerald-600 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy === 'agree' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Agree & draft deal memo</button>
        </div>}
      </div>
    </div>
  );
}

// Talent Operations Hub — coordinator's one screen for cast in onboarding.
const PROD_FIELDS: [string, string][] = [['wardrobeComplete', 'Wardrobe'], ['measurementsComplete', 'Measurements'], ['fittingsComplete', 'Fittings'], ['makeupNotesComplete', 'Makeup notes']];
const PAY_FIELDS: [string, string][] = [['bankingComplete', 'Banking'], ['taxDocsComplete', 'Tax docs'], ['vendorSetupComplete', 'Vendor setup']];

function OperationsHub({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(() => { setLoading(true); castingApi.operations(projectId).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([])).finally(() => setLoading(false)); }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (submissionId: string, checklist: any, field: string) => {
    await castingApi.opsChecklist(submissionId, { ...(checklist || {}), [field]: !checklist?.[field] });
    load();
  };
  const groupStatus = (items: any[]) => {
    const req = items.filter((i) => i.required && i.tracked !== false);
    return req.length ? `${req.filter((i) => i.complete).length}/${req.length}` : '—';
  };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (rows.length === 0) return <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200"><Users className="mx-auto text-slate-300" size={36} /><p className="text-slate-500 mt-2 text-sm">No cast in onboarding. Talent appears here once a submission is <b>Offered</b> or <b>Confirmed</b>.</p></div>;

  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.submissionId} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button onClick={() => setOpenId(openId === r.submissionId ? null : r.submissionId)} className="w-full text-left p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-medium text-slate-900">{r.talent?.stageName || r.talent?.fullName}</span><span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.role}</span><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SUB_STATUS[r.status] || 'bg-slate-100'}`}>{r.status}</span></div>
              <div className="text-[11px] text-slate-400 mt-0.5">Contract {groupStatus(r.readiness.groups.Contracts)} · Travel {groupStatus(r.readiness.groups.Travel)} · Production {groupStatus(r.readiness.groups.Production)} · Payroll {groupStatus(r.readiness.groups.Payroll)}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-lg font-bold ${r.readiness.score >= 90 ? 'text-emerald-600' : r.readiness.score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{r.readiness.score}%</span>
              <ChevronRight size={16} className={`text-slate-300 transition ${openId === r.submissionId ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {openId === r.submissionId && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Contract & Travel (live)</p>
                {[...r.readiness.groups.Contracts, ...r.readiness.groups.Travel].map((it: any, i: number) => {
                  const state = it.tracked === false ? 'soon' : !it.required ? 'na' : it.complete ? 'ok' : 'pending';
                  const cls = state === 'ok' ? 'text-emerald-600' : state === 'pending' ? 'text-amber-600' : 'text-slate-300';
                  return <div key={i} className="flex items-center justify-between py-1 text-sm"><span className="text-slate-700">{it.key}</span><span className={`text-[11px] ${cls}`}>{state === 'ok' ? 'Complete' : state === 'pending' ? 'Pending' : state === 'na' ? 'Not required' : '—'}</span></div>;
                })}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Production & Payroll (editable)</p>
                {[...PROD_FIELDS, ...PAY_FIELDS].map(([field, label]) => (
                  <label key={field} className="flex items-center justify-between py-1 text-sm cursor-pointer">
                    <span className="text-slate-700">{label}</span>
                    <input type="checkbox" className="rounded" checked={!!r.checklist?.[field]} onChange={() => toggle(r.submissionId, r.checklist, field)} />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Project Talent roster — the talent for THIS project, with everything inline ──
const scoreCls = (s: number) => (s >= 90 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : 'text-rose-600');

function TalentRoster({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTalent, setOpenTalent] = useState<any | null>(null);
  const [tab, setTab] = useState<'readiness' | 'travel' | 'reviews' | 'status'>('readiness');
  const load = useCallback(() => { setLoading(true); castingApi.projectTalent(projectId).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([])).finally(() => setLoading(false)); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const open = (row: any, t: any) => { setTab(t); setOpenTalent(row); };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (rows.length === 0) return <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200"><Users className="mx-auto text-slate-300" size={36} /><p className="text-slate-500 mt-2 text-sm">No talent engaged on this project yet. Talent appears here once they're shortlisted, offered or confirmed.</p></div>;

  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-2">{rows.length} talent on this project — open Readiness, Documents &amp; Travel, Reviews or Status without leaving the project.</p>
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.talentId} className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 overflow-hidden shrink-0 grid place-items-center">
              {r.headshot ? <img src={assetUrl(r.headshot)} alt="" className="w-full h-full object-cover" /> : <Users size={18} className="text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-900 truncate">{r.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SUB_STATUS[r.status] || 'bg-slate-100'}`}>{r.status}</span>
                {r.roles?.[0] && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.roles.join(', ')}</span>}
                {r.isLocalTalent ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Local</span>
                  : r.visaRequired ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1"><Plane size={9} /> Visa</span>
                  : r.travelRequired ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center gap-1"><Plane size={9} /> Travel</span> : null}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{[r.unionStatus, r.nationality, r.baseCity].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => open(r, 'readiness')} title="Readiness" className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Gauge size={13} /> <b className={scoreCls(r.readiness.score)}>{r.readiness.score}%</b></button>
              <button onClick={() => open(r, 'travel')} title="Documents & Travel" className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><CreditCard size={13} /> Docs</button>
              <button onClick={() => open(r, 'reviews')} title="Reviews" className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Star size={13} /> {r.reviewCount || 0}</button>
            </div>
          </div>
        ))}
      </div>
      {openTalent && <TalentDossier row={openTalent} projectId={projectId} initialTab={tab} onClose={() => setOpenTalent(null)} />}
    </div>
  );
}

function TalentDossier({ row, projectId, initialTab, onClose }: any) {
  const [tab, setTab] = useState(initialTab || 'readiness');
  const tabs: [string, string, any][] = [['identity', 'Identity', Contact], ['readiness', 'Readiness', Gauge], ['travel', 'Documents & Travel', CreditCard], ['reps', 'Representation', Briefcase], ['credits', 'Credits', Film], ['crm', 'CRM', Handshake], ['reviews', 'Reviews', Star], ['status', 'Status', Film]];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 glass-bar z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden grid place-items-center shrink-0">{row.headshot ? <img src={assetUrl(row.headshot)} alt="" className="w-full h-full object-cover" /> : <Users size={16} className="text-slate-300" />}</div>
            <div className="min-w-0"><h2 className="font-semibold text-slate-900 truncate">{row.name}</h2><p className="text-[11px] text-slate-400">{[row.roles?.join(', '), row.status].filter(Boolean).join(' · ')}</p></div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="flex gap-1 px-4 py-2 border-b border-slate-100 sticky top-[65px] bg-white z-10">
          {tabs.map(([k, label, Icon]) => <button key={k} onClick={() => setTab(k)} className={`text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 ${tab === k ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}><Icon size={13} /> {label}</button>)}
        </div>
        <div className="p-5">
          {tab === 'identity' && <IdentityTab talentId={row.talentId} />}
          {tab === 'readiness' && <ReadinessTab talentId={row.talentId} projectId={projectId} />}
          {tab === 'travel' && <TravelDocsTab talentId={row.talentId} />}
          {tab === 'reps' && <RepresentationTab talentId={row.talentId} />}
          {tab === 'credits' && <CreditsTab talentId={row.talentId} />}
          {tab === 'crm' && <CrmTab talentId={row.talentId} projectId={projectId} />}
          {tab === 'reviews' && <ReviewsTab talentId={row.talentId} />}
          {tab === 'status' && <StatusTab row={row} />}
        </div>
      </div>
    </div>
  );
}

function ReadinessTab({ talentId, projectId }: any) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { castingApi.talentReadiness(talentId, projectId).then((r) => setD(r.data)).catch(() => setD(false)); }, [talentId, projectId]);
  if (d === null) return <Loader2 className="animate-spin mx-auto text-slate-300" />;
  if (!d) return <p className="text-xs text-rose-500">Could not load.</p>;
  return (
    <div>
      <div className="flex items-center gap-3 mb-4"><span className={`text-3xl font-bold ${scoreCls(d.score)}`}>{d.score}%</span><span className="text-xs text-slate-500">overall readiness{d.isLocalTalent ? ' · local talent' : ''}</span></div>
      {Object.entries(d.groups || {}).map(([group, items]: any) => (
        <div key={group} className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{group}</p>
          {items.map((it: any, i: number) => {
            const state = it.tracked === false ? 'soon' : !it.required ? 'na' : it.complete ? 'ok' : 'pending';
            const cls = state === 'ok' ? 'text-emerald-600' : state === 'pending' ? 'text-amber-600' : 'text-slate-300';
            return <div key={i} className="flex items-center justify-between py-1 text-sm"><span className="text-slate-700">{it.key}</span><span className={`text-[11px] ${cls}`}>{state === 'ok' ? 'Complete' : state === 'pending' ? 'Pending' : state === 'na' ? 'Not required' : 'Soon'}</span></div>;
          })}
        </div>
      ))}
    </div>
  );
}

function TravelDocsTab({ talentId }: any) {
  const [t, setT] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr('');
    travelApi.identityFromTalent(talentId)
      .then((r) => { const id = r.data?.id || r.data?.travelerId; if (!id) { setErr('No travel identity'); return; } return travelApi.traveler(id).then((x) => setT(x.data)); })
      .catch(() => setErr('Could not load travel identity'));
  }, [talentId]);
  useEffect(() => { load(); }, [load]);
  if (err) return <p className="text-xs text-slate-500">{err}. This talent may not require travel.</p>;
  if (!t) return <Loader2 className="animate-spin mx-auto text-slate-300" />;
  const docs = t.documents || []; const visas = t.travelerVisas || t.visas || [];
  const fmt = (x?: string) => (x ? new Date(x).toLocaleDateString() : '—');
  const Field = ({ label, value }: any) => <div className="text-sm"><span className="text-[11px] text-slate-400 block">{label}</span><span className="text-slate-700">{value || '—'}</span></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Passport no." value={t.passportNumber} />
        <Field label="Passport expiry" value={fmt(t.passportExpiry)} />
        <Field label="Nationality" value={t.nationality} />
        <Field label="National ID" value={t.nationalId} />
      </div>
      {(t.validationFlags?.length || t.passportExpiringSoon) ? <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-[11px] text-amber-700 inline-flex items-center gap-1"><AlertTriangle size={12} /> {(t.validationFlags || []).join(' · ') || 'Passport expiring soon'}</div> : null}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1"><Plane size={12} /> Visas ({visas.length})</p>
        {visas.length === 0 ? <p className="text-xs text-slate-400">No visa records.</p> : visas.map((v: any) => <div key={v.id} className="flex items-center justify-between text-sm py-1"><span className="text-slate-700">{v.country || v.visaType || 'Visa'}</span><span className="text-[11px] text-slate-500">{v.status || ''} {v.expiryDate ? `· exp ${fmt(v.expiryDate)}` : ''}</span></div>)}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1"><CreditCard size={12} /> Documents ({docs.length})</p>
        {docs.length === 0 ? <p className="text-xs text-slate-400">No documents uploaded.</p> : docs.map((doc: any) => <div key={doc.id} className="flex items-center justify-between text-sm py-1"><span className="text-slate-700">{doc.label || doc.type}</span>{doc.fileUrl ? <a href={assetUrl(doc.fileUrl)} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600">Open</a> : <span className="text-[11px] text-slate-300">—</span>}</div>)}
      </div>
      <p className="text-[11px] text-slate-400">Full passport/visa/document management lives in the Travel tab for this project — this is the read view.</p>
    </div>
  );
}

function ReviewsTab({ talentId }: any) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { castingApi.reviews(talentId).then((r) => setD(r.data)).catch(() => setD(false)); }, [talentId]);
  if (d === null) return <Loader2 className="animate-spin mx-auto text-slate-300" />;
  if (!d) return <p className="text-xs text-rose-500">Could not load reviews.</p>;
  const reviews = d.reviews || [];
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-sm"><span className="text-slate-500">{d.productions || 0} productions</span><span className="text-slate-500">{d.reviewCount || 0} reviews</span></div>
      {Object.keys(d.metrics || {}).length > 0 && <div className="grid grid-cols-2 gap-2 mb-3">{Object.entries(d.metrics).map(([m, v]: any) => <div key={m} className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] text-slate-400">{m}</div><div className="text-sm font-semibold text-slate-800">{Number(v).toFixed(1)}/10</div></div>)}</div>}
      {reviews.length === 0 ? <p className="text-xs text-slate-400">No reviews yet.</p> : reviews.map((rv: any) => <div key={rv.id} className="border-t border-slate-100 py-2 text-sm"><div className="flex items-center justify-between"><span className="text-slate-700">{rv.metric}{rv.department ? ` · ${rv.department}` : ''}</span><span className="font-semibold text-slate-800">{rv.rating}/10</span></div>{rv.comments && <p className="text-[11px] text-slate-500 mt-0.5">{rv.comments}</p>}</div>)}
    </div>
  );
}

function IdentityTab({ talentId }: any) {
  const [t, setT] = useState<any>(null);
  useEffect(() => { castingApi.getTalent(talentId).then((r) => setT(r.data)).catch(() => setT(false)); }, [talentId]);
  if (t === null) return <Loader2 className="animate-spin mx-auto text-slate-300" />;
  if (!t) return <p className="text-xs text-rose-500">Could not load.</p>;
  const arr = (a: any) => (Array.isArray(a) && a.length ? a.join(', ') : '—');
  const fmt = (x?: string) => (x ? new Date(x).toLocaleDateString() : '—');
  const F = ({ label, value, full }: any) => <div className={full ? 'col-span-2' : ''}><span className="text-[11px] text-slate-400 block">{label}</span><span className="text-sm text-slate-700">{value || '—'}</span></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <F label="Legal name" value={t.fullName} />
        <F label="Stage name" value={t.stageName} />
        <F label="Preferred name" value={t.preferredName} />
        <F label="Date of birth" value={fmt(t.dateOfBirth)} />
        <F label="Gender" value={t.gender} />
        <F label="Ethnicity" value={t.ethnicity} />
        <F label="Nationality" value={[t.nationality, ...(t.nationalities || [])].filter(Boolean).join(', ')} />
        <F label="Union" value={t.unionStatus} />
        <F label="Base location" value={t.baseCity} />
        <F label="Current location" value={t.currentLocation} />
        <F label="Categories" value={arr(t.categories)} full />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F label="Languages" value={arr(t.languages)} />
        <F label="Dialects" value={arr(t.dialects)} />
        <F label="Accents" value={arr(t.accents)} />
        <F label="Skills" value={arr(t.skills)} />
        <F label="Height" value={t.heightCm ? `${t.heightCm} cm` : null} />
        <F label="Weight" value={t.weightKg ? `${t.weightKg} kg` : null} />
        <F label="Tattoos" value={t.tattoos} />
        <F label="Distinguishing features" value={t.distinguishingFeatures} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F label="Email" value={t.email} />
        <F label="Mobile" value={t.phone} />
        <F label="WhatsApp" value={t.whatsapp} />
        <F label="Agency" value={t.agencyName} />
      </div>
      {t.biography && <div><span className="text-[11px] text-slate-400 block mb-0.5">Biography</span><p className="text-sm text-slate-700 whitespace-pre-wrap">{t.biography}</p></div>}
      <p className="text-[11px] text-slate-400">Edit identity in the master Talent Directory — this is the project read view of the one master record.</p>
    </div>
  );
}

function StatusTab({ row }: any) {
  const Field = ({ label, value }: any) => <div className="flex items-center justify-between py-1.5 text-sm border-b border-slate-100"><span className="text-slate-500">{label}</span><span className="text-slate-800 font-medium">{value || '—'}</span></div>;
  const n = row.negotiation;
  return (
    <div>
      <Field label="Casting status" value={row.status} />
      <Field label="Role(s)" value={row.roles?.join(', ')} />
      <Field label="Readiness" value={`${row.readiness.score}%`} />
      <Field label="Travel" value={row.isLocalTalent ? 'Local — no travel' : row.visaRequired ? 'Visa required' : row.travelRequired ? 'Travel required' : '—'} />
      <Field label="Negotiation" value={n ? `${n.status}${n.finalRate ? ` · ${Number(n.finalRate).toLocaleString()}` : ''}` : 'Not started'} />
      <Field label="Reviews" value={row.reviewCount || 0} />
    </div>
  );
}
