'use client';

import { useState, useEffect, useCallback } from 'react';
import { castingApi, travelApi, usersApi, productionApi } from '@/lib/api';
import { Users, Plus, X, Loader2, ShieldCheck, Search, Trash2, Plane, CheckCircle2, Clock, MinusCircle, Gauge, Award, Contact, SlidersHorizontal, ListPlus, Bookmark, FolderPlus } from 'lucide-react';
import TravelIdentityPanel from '@/components/production/TravelIdentityPanel';
import { RepresentationTab, CreditsTab, CrmTab } from '@/components/production/TalentV3Tabs';

const CONSENT_CLS: Record<string, string> = { GRANTED: 'bg-emerald-100 text-emerald-700', PENDING: 'bg-amber-100 text-amber-700', WITHDRAWN: 'bg-rose-100 text-rose-700', EXPIRED: 'bg-slate-100 text-slate-500' };

export default function TalentDatabase() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [reviewsId, setReviewsId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [opening, setOpening] = useState('');
  const [adv, setAdv] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [addTo, setAddTo] = useState<any | null>(null);
  const load = useCallback(() => { castingApi.talent(q ? { search: q } : {}).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const forget = async (id: string) => { if (confirm('Withdraw consent and flag for erasure (right to be forgotten)?')) { await castingApi.withdrawConsent(id, 'User request'); load(); } };
  const openTravel = async (talentId: string) => {
    setOpening(talentId);
    try { const r = await travelApi.identityFromTalent(talentId); setIdentityId(r.data?.id); } finally { setOpening(''); }
  };

  return (
    <div className="font-sans p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Users className="text-[#0f172a]" /> Talent Database</h1>
          <p className="text-sm text-slate-500 mt-0.5">Master talent pool — GDPR-consented, reusable across all casting calls.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setListsOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 text-slate-600 px-3 py-2.5 text-sm hover:border-[#0f172a]"><FolderPlus size={15} /> Lists</button>
          <button onClick={() => setAdv((v) => !v)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${adv ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-[#0f172a]'}`}><SlidersHorizontal size={15} /> Advanced</button>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800"><Plus size={16} /> Add talent</button>
        </div>
      </div>

      {adv && <AdvancedSearch onAddToList={(t: any) => setAddTo(t)} onProfile={(t: any) => setProfile(t)} onReady={(id: string) => setReadyId(id)} />}

      {!adv && <><div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, stage name, skill…" className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#0f172a]" />
      </div>

      <div className="grid gap-2">
        {rows.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No talent profiles.</p> : rows.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <button onClick={() => setEditing(t)} className="font-medium text-slate-900 hover:text-[#0f172a] text-left">{t.stageName || t.fullName}{t.stageName && <span className="text-xs text-slate-400 ml-1">({t.fullName})</span>}</button>
              <div className="text-xs text-slate-500">{[t.unionStatus, t.nationality, t.baseCity, (t.skills || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${CONSENT_CLS[t.consentStatus] || 'bg-slate-100 text-slate-500'}`}><ShieldCheck size={11} /> {t.consentStatus}</span>
              <button onClick={() => setAddTo(t)} title="Add to a list / shortlist" className="text-slate-300 hover:text-[#0f172a]"><ListPlus size={15} /></button>
              <button onClick={() => setProfile(t)} title="Representation, credits & CRM" className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Contact size={13} /> Profile</button>
              <button onClick={() => setReadyId(t.id)} title="Talent readiness" className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Gauge size={13} /> Readiness</button>
              <button onClick={() => setReviewsId(t.id)} title="Performance history (internal)" className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Award size={13} /> Reviews</button>
              <button onClick={() => openTravel(t.id)} disabled={opening === t.id} title="Travel & immigration identity" className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a] disabled:opacity-40">{opening === t.id ? <Loader2 size={12} className="animate-spin" /> : <Plane size={13} />} Travel</button>
              {t.consentStatus !== 'WITHDRAWN' && <button onClick={() => forget(t.id)} title="Right to be forgotten" className="text-slate-300 hover:text-rose-600"><Trash2 size={15} /></button>}
            </div>
          </div>
        ))}
      </div></>}

      {(open || editing) && <AddTalentModal existing={editing} onClose={() => { setOpen(false); setEditing(null); }} onDone={() => { setOpen(false); setEditing(null); load(); }} />}
      {listsOpen && <ListsDrawer onClose={() => setListsOpen(false)} />}
      {addTo && <AddToListModal talent={addTo} onClose={() => setAddTo(null)} />}
      {identityId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setIdentityId(null)}>
          <div className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <TravelIdentityPanel travelerId={identityId} onClose={() => setIdentityId(null)} />
          </div>
        </div>
      )}
      {readyId && <ReadinessDrawer talentId={readyId} onClose={() => setReadyId(null)} />}
      {reviewsId && <ReviewsDrawer talentId={reviewsId} onClose={() => setReviewsId(null)} />}
      {profile && <ProfileDrawer talent={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}

function ProfileDrawer({ talent, onClose }: { talent: any; onClose: () => void }) {
  const [tab, setTab] = useState<'reps' | 'credits' | 'crm'>('reps');
  const tabs: [string, string][] = [['reps', 'Representation'], ['credits', 'Credits'], ['crm', 'CRM']];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Contact size={16} className="text-[#0f172a]" /> {talent.stageName || talent.fullName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="flex gap-1 px-4 py-2 border-b border-slate-100 sticky top-[60px] bg-white z-10">
          {tabs.map(([k, label]) => <button key={k} onClick={() => setTab(k as any)} className={`text-xs px-3 py-1.5 rounded-lg ${tab === k ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{label}</button>)}
        </div>
        <div className="p-5">
          {tab === 'reps' && <RepresentationTab talentId={talent.id} />}
          {tab === 'credits' && <CreditsTab talentId={talent.id} />}
          {tab === 'crm' && <CrmTab talentId={talent.id} />}
        </div>
      </div>
    </div>
  );
}

const METRICS = ['punctuality', 'performance', 'professionalism', 'cooperation', 'preparedness', 'reliability'];
const DEPARTMENTS = ['PRODUCTION', 'DIRECTOR', 'AD', 'WARDROBE', 'MAKEUP', 'OTHER'];

function ReviewsDrawer({ talentId, onClose }: { talentId: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [f, setF] = useState<any>({ department: 'PRODUCTION', metric: 'performance', rating: '8', comments: '', projectId: '' });
  const [busy, setBusy] = useState(false);
  const load = () => castingApi.reviews(talentId).then((r) => setD(r.data)).catch(() => setD(false));
  useEffect(() => { load(); productionApi.projects.list().then((r) => setProjects(Array.isArray(r.data) ? r.data : (r.data?.items || []))).catch(() => {}); }, [talentId]);
  const add = async () => {
    setBusy(true);
    try { await castingApi.addReview(talentId, { ...f, projectId: f.projectId || undefined, rating: Number(f.rating) }); setF({ ...f, comments: '' }); load(); } finally { setBusy(false); }
  };
  const inp = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#0f172a]';
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Award size={16} className="text-[#0f172a]" /> Performance History</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-800">Internal only — never shown to talent or their representatives.</div>
        {d === null ? <p className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></p>
          : d === false ? <p className="p-10 text-center text-slate-400 text-sm">Not available for your role.</p> : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-500"><b className="text-slate-800 text-lg">{d.productions}</b> productions · <b className="text-slate-800">{d.reviewCount}</b> reviews</div>
            {d.metrics.length > 0 && (
              <div className="space-y-1.5">
                {d.metrics.map((m: any) => (
                  <div key={m.metric}>
                    <div className="flex items-center justify-between text-xs"><span className="capitalize text-slate-600">{m.metric}</span><span className="font-semibold text-slate-800">{m.avg.toFixed(1)} <span className="text-slate-400">/10 · {m.count}</span></span></div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${m.avg >= 8 ? 'bg-emerald-500' : m.avg >= 5 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${m.avg * 10}%` }} /></div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Add review (post-wrap)</p>
              <div className="grid grid-cols-2 gap-2">
                <select className={inp} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>{DEPARTMENTS.map((x) => <option key={x}>{x}</option>)}</select>
                <select className={inp} value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{METRICS.map((x) => <option key={x} className="capitalize">{x}</option>)}</select>
                <select className={inp} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">— production —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                <select className={inp} value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })}>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}/10</option>)}</select>
              </div>
              <input className={`${inp} mt-2`} placeholder="Comments (optional)" value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} />
              <button onClick={add} disabled={busy} className="mt-2 w-full rounded-lg bg-slate-900 text-white py-1.5 text-xs disabled:opacity-40 inline-flex items-center justify-center gap-1">{busy && <Loader2 size={12} className="animate-spin" />} Add review</button>
            </div>

            {(d.reviews || []).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">History</p>
                <div className="space-y-1.5">{d.reviews.map((r: any) => (
                  <div key={r.id} className="text-[11px] text-slate-500 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#0f172a]" /><b className="text-slate-700 capitalize">{r.metric}</b> {r.rating}/10{r.department ? ` · ${r.department}` : ''}{r.project?.title ? ` · ${r.project.title}` : ''}{r.comments ? ` · ${r.comments}` : ''}</div>
                ))}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadinessDrawer({ talentId, onClose }: { talentId: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { castingApi.talentReadiness(talentId).then((r) => setD(r.data)).catch(() => setD(false)); }, [talentId]);
  const itemRow = (it: any) => {
    const state = it.tracked === false ? 'soon' : !it.required ? 'na' : it.complete ? 'ok' : 'pending';
    const map: any = {
      ok: { cls: 'text-emerald-600', icon: <CheckCircle2 size={15} />, label: 'Complete' },
      pending: { cls: 'text-amber-600', icon: <Clock size={15} />, label: 'Pending' },
      na: { cls: 'text-slate-400', icon: <MinusCircle size={15} />, label: 'Not required' },
      soon: { cls: 'text-slate-300', icon: <MinusCircle size={15} />, label: 'Not tracked yet' },
    };
    const m = map[state];
    return (
      <div key={it.key} className="flex items-center justify-between py-1.5">
        <span className={`text-sm inline-flex items-center gap-2 ${state === 'soon' ? 'text-slate-400' : 'text-slate-700'}`}><span className={m.cls}>{m.icon}</span>{it.key}</span>
        <span className={`text-[11px] ${m.cls}`}>{m.label}</span>
      </div>
    );
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Gauge size={16} className="text-[#0f172a]" /> Talent Readiness</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        {d === null ? <p className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></p>
          : d === false ? <p className="p-10 text-center text-slate-400 text-sm">Could not load.</p> : (
          <div className="p-5">
            <div className="rounded-2xl border border-slate-200 p-4 mb-4 text-center">
              <div className={`text-4xl font-bold ${d.score >= 90 ? 'text-emerald-600' : d.score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{d.score}%</div>
              <div className="text-xs text-slate-500 mt-1">ready{d.isLocalTalent ? ' · local talent (travel excluded)' : ''}</div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-2"><div className={`h-full ${d.score >= 90 ? 'bg-emerald-500' : d.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${d.score}%` }} /></div>
            </div>
            {Object.entries(d.groups).map(([group, items]: any) => (
              <div key={group} className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{group}</p>
                <div className="rounded-xl border border-slate-200 px-3 divide-y divide-slate-50">{items.map(itemRow)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTalentModal({ existing, onClose, onDone }: any) {
  const [f, setF] = useState<any>({ fullName: '', stageName: '', preferredName: '', email: '', phone: '', whatsapp: '', nationality: '', nationalities: '', baseCity: '', currentLocation: '', laborBodyId: '', gender: '', ethnicity: '', dateOfBirth: '', languages: '', dialects: '', accents: '', skills: '', categories: '', heightCm: '', weightKg: '', tattoos: '', distinguishingFeatures: '', biography: '', pressLinks: '', agencyName: '', representedById: '', consentStatus: 'GRANTED' });
  const [unions, setUnions] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    castingApi.unions().then((r) => setUnions(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    usersApi.list().then((r) => { const all = Array.isArray(r.data) ? r.data : (r.data?.items || []); setReps(all.filter((u: any) => u.role === 'TALENT_REP')); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!existing) return;
    const join = (a: any) => (Array.isArray(a) ? a.join(', ') : '');
    setF({
      fullName: existing.fullName || '', stageName: existing.stageName || '', preferredName: existing.preferredName || '',
      email: existing.email || '', phone: existing.phone || '', whatsapp: existing.whatsapp || '',
      nationality: existing.nationality || '', nationalities: join(existing.nationalities), baseCity: existing.baseCity || '', currentLocation: existing.currentLocation || '',
      laborBodyId: existing.laborBodyId || '', gender: existing.gender || '', ethnicity: existing.ethnicity || '',
      dateOfBirth: existing.dateOfBirth ? new Date(existing.dateOfBirth).toISOString().slice(0, 10) : '',
      languages: join(existing.languages), dialects: join(existing.dialects), accents: join(existing.accents),
      skills: join(existing.skills), categories: join(existing.categories),
      heightCm: existing.heightCm ?? '', weightKg: existing.weightKg ?? '', tattoos: existing.tattoos || '',
      distinguishingFeatures: existing.distinguishingFeatures || '', biography: existing.biography || '', pressLinks: join(existing.pressLinks),
      agencyName: existing.agencyName || '', representedById: existing.representedById || '', consentStatus: existing.consentStatus || 'GRANTED',
    });
  }, [existing]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const submit = async () => {
    if (!f.fullName) return; setBusy(true);
    const u = unions.find((x) => x.id === f.laborBodyId);
    const arr = (s: string) => (s ? s.split(',').map((x: string) => x.trim()).filter(Boolean) : undefined);
    const payload = {
      ...f,
      laborBodyId: f.laborBodyId || null,
      unionStatus: u ? (u.shortName || u.name) : 'Non-union', // display label kept in sync with the link
      skills: arr(f.skills), languages: arr(f.languages), dialects: arr(f.dialects), accents: arr(f.accents),
      categories: arr(f.categories), nationalities: arr(f.nationalities), pressLinks: arr(f.pressLinks),
      heightCm: f.heightCm || undefined, weightKg: f.weightKg || undefined,
      dateOfBirth: f.dateOfBirth || undefined,
      representedById: f.representedById || null,
      consentGivenAt: f.consentStatus === 'GRANTED' ? new Date().toISOString() : undefined,
    };
    try {
      if (existing) await castingApi.updTalent(existing.id, payload);
      else await castingApi.addTalent(payload);
      onDone();
    } finally { setBusy(false); }
  };
  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0"><h2 className="font-semibold text-slate-900">{existing ? 'Edit talent' : 'Add talent'}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Identity</p>
          <div className="grid grid-cols-2 gap-3">
            <L label="Legal / full name *"><input className={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></L>
            <L label="Stage name"><input className={inp} value={f.stageName} onChange={(e) => set('stageName', e.target.value)} /></L>
            <L label="Preferred name"><input className={inp} value={f.preferredName} onChange={(e) => set('preferredName', e.target.value)} /></L>
            <L label="Date of birth"><input type="date" className={inp} value={f.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></L>
            <L label="Gender"><input className={inp} value={f.gender} onChange={(e) => set('gender', e.target.value)} /></L>
            <L label="Ethnicity"><input className={inp} value={f.ethnicity} onChange={(e) => set('ethnicity', e.target.value)} /></L>
            <L label="Nationality (primary)"><input className={inp} value={f.nationality} onChange={(e) => set('nationality', e.target.value)} /></L>
            <L label="Other nationalities"><input className={inp} value={f.nationalities} onChange={(e) => set('nationalities', e.target.value)} placeholder="comma-sep" /></L>
            <L label="Base location"><input className={inp} value={f.baseCity} onChange={(e) => set('baseCity', e.target.value)} /></L>
            <L label="Current location"><input className={inp} value={f.currentLocation} onChange={(e) => set('currentLocation', e.target.value)} /></L>
            <L label="Categories (comma-sep)" full><input className={inp} value={f.categories} onChange={(e) => set('categories', e.target.value)} placeholder="ACTOR, MODEL, VOICE_ARTIST, STUNT_PERFORMER" /></L>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-4 mb-2">Languages & physical</p>
          <div className="grid grid-cols-2 gap-3">
            <L label="Languages"><input className={inp} value={f.languages} onChange={(e) => set('languages', e.target.value)} placeholder="comma-sep" /></L>
            <L label="Dialects"><input className={inp} value={f.dialects} onChange={(e) => set('dialects', e.target.value)} placeholder="comma-sep" /></L>
            <L label="Accents"><input className={inp} value={f.accents} onChange={(e) => set('accents', e.target.value)} placeholder="comma-sep" /></L>
            <L label="Skills"><input className={inp} value={f.skills} onChange={(e) => set('skills', e.target.value)} placeholder="comma-sep" /></L>
            <L label="Height (cm)"><input type="number" className={inp} value={f.heightCm} onChange={(e) => set('heightCm', e.target.value)} /></L>
            <L label="Weight (kg)"><input type="number" className={inp} value={f.weightKg} onChange={(e) => set('weightKg', e.target.value)} /></L>
            <L label="Tattoos"><input className={inp} value={f.tattoos} onChange={(e) => set('tattoos', e.target.value)} /></L>
            <L label="Distinguishing features"><input className={inp} value={f.distinguishingFeatures} onChange={(e) => set('distinguishingFeatures', e.target.value)} /></L>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-4 mb-2">Contact, union & professional</p>
          <div className="grid grid-cols-2 gap-3">
            <L label="Email"><input className={inp} value={f.email} onChange={(e) => set('email', e.target.value)} /></L>
            <L label="Mobile"><input className={inp} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></L>
            <L label="WhatsApp"><input className={inp} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></L>
            <L label="Union / Guild"><select className={inp} value={f.laborBodyId} onChange={(e) => set('laborBodyId', e.target.value)}><option value="">None / Non-union</option>{unions.map((u) => <option key={u.id} value={u.id}>{u.name}{u.country?.name ? ` (${u.country.name})` : ''}</option>)}</select></L>
            <L label="Agency"><input className={inp} value={f.agencyName} onChange={(e) => set('agencyName', e.target.value)} /></L>
            <L label="Consent"><select className={inp} value={f.consentStatus} onChange={(e) => set('consentStatus', e.target.value)}>{['GRANTED', 'PENDING'].map((x) => <option key={x} value={x}>{x}</option>)}</select></L>
            <L label="Represented by (agent)" full><select className={inp} value={f.representedById} onChange={(e) => set('representedById', e.target.value)}><option value="">— none —</option>{reps.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></L>
            <L label="Press links (comma-sep)" full><input className={inp} value={f.pressLinks} onChange={(e) => set('pressLinks', e.target.value)} /></L>
            <L label="Biography" full><textarea rows={3} className={inp} value={f.biography} onChange={(e) => set('biography', e.target.value)} /></L>
          </div>
          {!existing && <p className="text-[11px] text-slate-400 mt-3">Representation, credits &amp; CRM are managed on the talent's <b>Profile</b> after saving.</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !f.fullName} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}
function L({ label, full, children }: any) { return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>; }

// ── V3-E Advanced search ─────────────────────────────────────────────────────
const fInp = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#0f172a]';
function AdvancedSearch({ onAddToList, onProfile, onReady }: any) {
  const blank = { q: '', gender: '', nationality: '', ethnicity: '', unionStatus: '', languages: '', skills: '', categories: '', ageMin: '', ageMax: '', minReliability: '', hasAgency: false, hasAwards: false, passportValid: false, travelReady: false };
  const [f, setF] = useState<any>(blank);
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<any[]>([]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const loadSaved = () => castingApi.savedSearches().then((r) => setSaved(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  useEffect(() => { loadSaved(); }, []);
  const arr = (s: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
  const run = async () => {
    setBusy(true);
    try { const r = await castingApi.search({ ...f, languages: arr(f.languages), skills: arr(f.skills), categories: arr(f.categories) }); setRows(Array.isArray(r.data) ? r.data : []); } finally { setBusy(false); }
  };
  const saveCurrent = async () => { const name = prompt('Save this search as:'); if (!name) return; await castingApi.saveSearch({ name, filters: f }); loadSaved(); };
  const applySaved = (s: any) => { setF({ ...blank, ...(s.filters || {}) }); setTimeout(run, 0); };
  const delSaved = async (id: string) => { await castingApi.delSavedSearch(id); loadSaved(); };

  return (
    <div className="mb-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input className={fInp} placeholder="Name / stage" value={f.q} onChange={(e) => set('q', e.target.value)} />
          <input className={fInp} placeholder="Gender" value={f.gender} onChange={(e) => set('gender', e.target.value)} />
          <input className={fInp} placeholder="Nationality" value={f.nationality} onChange={(e) => set('nationality', e.target.value)} />
          <input className={fInp} placeholder="Ethnicity" value={f.ethnicity} onChange={(e) => set('ethnicity', e.target.value)} />
          <input className={fInp} placeholder="Union status" value={f.unionStatus} onChange={(e) => set('unionStatus', e.target.value)} />
          <input className={fInp} placeholder="Languages (comma)" value={f.languages} onChange={(e) => set('languages', e.target.value)} />
          <input className={fInp} placeholder="Skills (comma)" value={f.skills} onChange={(e) => set('skills', e.target.value)} />
          <input className={fInp} placeholder="Categories (comma)" value={f.categories} onChange={(e) => set('categories', e.target.value)} />
          <input className={fInp} type="number" placeholder="Age min" value={f.ageMin} onChange={(e) => set('ageMin', e.target.value)} />
          <input className={fInp} type="number" placeholder="Age max" value={f.ageMax} onChange={(e) => set('ageMax', e.target.value)} />
          <input className={fInp} type="number" placeholder="Min reliability %" value={f.minReliability} onChange={(e) => set('minReliability', e.target.value)} />
        </div>
        <div className="flex items-center gap-4 flex-wrap mt-3 text-[11px] text-slate-600">
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.hasAgency} onChange={(e) => set('hasAgency', e.target.checked)} /> Has agency</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.hasAwards} onChange={(e) => set('hasAwards', e.target.checked)} /> Has awards</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.passportValid} onChange={(e) => set('passportValid', e.target.checked)} /> Valid passport</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.travelReady} onChange={(e) => set('travelReady', e.target.checked)} /> Travel-ready</label>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => { setF(blank); setRows(null); }} className="text-slate-500">Reset</button>
            <button onClick={saveCurrent} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600"><Bookmark size={12} /> Save</button>
            <button onClick={run} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40">{busy ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Search</button>
          </div>
        </div>
        {saved.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">Saved:</span>
            {saved.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 pl-2 pr-1 py-0.5 text-[11px] text-slate-600">
                <button onClick={() => applySaved(s)} className="hover:text-slate-900">{s.name}</button>
                <button onClick={() => delSaved(s.id)} className="text-slate-300 hover:text-rose-600"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {rows && (
        <div className="mt-3">
          <p className="text-[11px] text-slate-400 mb-2">{rows.length} match{rows.length === 1 ? '' : 'es'}</p>
          <div className="grid gap-2">
            {rows.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden grid place-items-center shrink-0">{t.headshot ? <img src={t.headshot} alt="" className="w-full h-full object-cover" /> : <Users size={16} className="text-slate-300" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{t.stageName || t.fullName}</div>
                  <div className="text-[11px] text-slate-500">{[t.unionStatus, t.nationality, t.baseCity, t.age ? `${t.age}y` : null, t.reliability != null ? `${t.reliability}% reliable` : null, (t.categories || []).slice(0, 2).join('/')].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {t.passportValid && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-1"><Plane size={9} /> Passport</span>}
                  <button onClick={() => onReady(t.id)} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Gauge size={12} /></button>
                  <button onClick={() => onProfile(t)} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><Contact size={12} /></button>
                  <button onClick={() => onAddToList(t)} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:border-[#0f172a]"><ListPlus size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddToListModal({ talent, onClose }: { talent: any; onClose: () => void }) {
  const [lists, setLists] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const load = () => castingApi.talentLists().then((r) => setLists(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const add = async (listId: string) => { await castingApi.addToList(listId, talent.id); setDone((d) => ({ ...d, [listId]: true })); };
  const create = async () => { if (!newName) return; const r = await castingApi.createList({ name: newName }); setNewName(''); await castingApi.addToList(r.data.id, talent.id); load(); setDone((d) => ({ ...d, [r.data.id]: true })); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900 text-sm">Add {talent.stageName || talent.fullName} to…</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-4 space-y-1.5 max-h-72 overflow-y-auto">
          {lists.length === 0 ? <p className="text-xs text-slate-400">No lists yet — create one below.</p> : lists.map((l) => (
            <button key={l.id} onClick={() => add(l.id)} disabled={done[l.id]} className="w-full flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-[#0f172a] disabled:opacity-50">
              <span className="text-slate-700">{l.name} <span className="text-[10px] text-slate-400">{l.kind} · {l._count?.members ?? 0}</span></span>
              {done[l.id] ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Plus size={14} className="text-slate-400" />}
            </button>
          ))}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <input className={fInp} placeholder="New list name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button onClick={create} disabled={!newName} className="rounded-lg bg-slate-900 text-white px-3 text-sm disabled:opacity-40">Create</button>
        </div>
      </div>
    </div>
  );
}

function ListsDrawer({ onClose }: { onClose: () => void }) {
  const [lists, setLists] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const load = () => castingApi.talentLists().then((r) => setLists(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { if (openId) castingApi.talentList(openId).then((r) => setDetail(r.data)).catch(() => {}); else setDetail(null); }, [openId]);
  const del = async (id: string) => { if (!confirm('Delete this list?')) return; await castingApi.delList(id); if (openId === id) setOpenId(null); load(); };
  const removeMember = async (mid: string) => { await castingApi.delListMember(mid); if (openId) castingApi.talentList(openId).then((r) => setDetail(r.data)); load(); };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white"><h2 className="font-semibold text-slate-900 flex items-center gap-2"><FolderPlus size={16} className="text-[#0f172a]" /> Talent Lists & Shortlists</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        {!openId ? (
          <div className="p-5 space-y-2">
            {lists.length === 0 ? <p className="text-xs text-slate-400">No lists yet. Use the “Add to list” action on any talent.</p> : lists.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                <button onClick={() => setOpenId(l.id)} className="text-left"><div className="text-sm font-medium text-slate-800">{l.name}</div><div className="text-[11px] text-slate-400">{l.kind} · {l._count?.members ?? 0} talent</div></button>
                <button onClick={() => del(l.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <button onClick={() => setOpenId(null)} className="text-xs text-slate-500 mb-3">← All lists</button>
            {!detail ? <Loader2 className="animate-spin mx-auto text-slate-300" /> : (
              <>
                <h3 className="font-semibold text-slate-900">{detail.name} <span className="text-[11px] text-slate-400">{detail.kind}</span></h3>
                <div className="mt-3 space-y-1.5">
                  {(detail.members || []).length === 0 ? <p className="text-xs text-slate-400">Empty list.</p> : detail.members.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span className="text-sm text-slate-700">{m.talent?.stageName || m.talent?.fullName}<span className="text-[11px] text-slate-400 ml-1">{[m.talent?.unionStatus, m.talent?.baseCity].filter(Boolean).join(' · ')}</span></span>
                      <button onClick={() => removeMember(m.id)} className="text-slate-300 hover:text-rose-600"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
