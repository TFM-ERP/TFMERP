'use client';

import { useState, useEffect, useCallback } from 'react';
import { scoutingApi, productionApi } from '@/lib/api';
import { useOfflineSync } from '@/lib/useOfflineSync';
import OfflineSyncBar from '@/components/production/OfflineSyncBar';
import {
  Compass, Plus, X, MapPin, Calendar, Flag, Camera, Check, Save,
  ChevronRight, Star, Library, ExternalLink, WifiOff,
} from 'lucide-react';

const TYPES = ['INITIAL', 'PHOTO', 'DIRECTOR', 'PRODUCER', 'TECH_RECCE', 'PERMIT', 'FINAL'];
const PRIORITIES = [
  { v: 'LOW', cls: 'bg-gray-100 text-gray-600' },
  { v: 'MEDIUM', cls: 'bg-blue-100 text-blue-700' },
  { v: 'HIGH', cls: 'bg-amber-100 text-amber-700' },
  { v: 'URGENT', cls: 'bg-red-100 text-red-700' },
];
const A_STATUS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-gray-100 text-gray-400',
};
const S_STATUS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600', SHORTLISTED: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700',
};
const CATEGORIES = ['INT', 'EXT', 'STUDIO', 'BACKLOT', 'OTHER'];

export default function ScoutingPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await scoutingApi.assignments();
      setAssignments(data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sync = useOfflineSync(load);
  useEffect(() => {
    productionApi.projects.list()
      .then(r => setProjects(Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.data || [])))
      .catch(() => {});
  }, []);

  const projName = (id: string) => projects.find((p: any) => p.id === id)?.title || '—';

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Compass className="text-[#0f172a]" /> Location Scouting</h1>
          <p className="text-sm text-gray-500 mt-1">Brief scouts, collect field candidates, accept the winners straight into the Master Library.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New assignment
        </button>
      </div>

      <div className="mb-4"><OfflineSyncBar sync={sync} /></div>

      {loading ? <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
        : assignments.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <Compass className="mx-auto text-gray-300" size={40} />
            <p className="text-gray-500 mt-3">No scouting assignments yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const pr = PRIORITIES.find((p) => p.v === a.priority);
              return (
                <button key={a.id} onClick={() => setOpenId(a.id)} className="w-full text-left bg-white border rounded-xl p-4 hover:shadow-md transition flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.title}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded ${A_STATUS[a.status]}`}>{a.status.replace('_', ' ')}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded ${pr?.cls}`}>{a.priority}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">{a.type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {projName(a.projectId)}{a.sceneRefs ? ` · Sc. ${a.sceneRefs}` : ''}{a.dueDate ? ` · due ${new Date(a.dueDate).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold flex items-center gap-1 justify-end"><Camera size={14} className="text-gray-400" /> {a._count?.submissions || 0}</div>
                    <div className="text-[11px] text-gray-400">candidates</div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </button>
              );
            })}
          </div>
        )}

      {creating && <AssignmentModal projects={projects} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {openId && <AssignmentDrawer id={openId} projName={projName} sync={sync} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function AssignmentModal({ projects, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ projectId: projects[0]?.id || '', title: '', description: '', sceneRefs: '', locationType: 'EXT', type: 'INITIAL', priority: 'MEDIUM', budgetTarget: '', dueDate: '', assignedToName: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
  const save = async () => {
    setSaving(true);
    try { const p = { ...f }; if (p.budgetTarget === '') p.budgetTarget = null; await scoutingApi.createAssignment(p); onSaved(); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between"><h2 className="font-semibold">New scouting assignment</h2><button onClick={onClose}><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Project *</span>
            <select className={inp} value={f.projectId} onChange={(e) => set('projectId', e.target.value)}>
              <option value="">Select…</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select></label>
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Title *</span><input className={inp} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Desert dune — opening sequence" /></label>
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Brief</span><textarea className={inp} rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Scenes</span><input className={inp} value={f.sceneRefs} onChange={(e) => set('sceneRefs', e.target.value)} placeholder="12, 14, 30" /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Type</span><select className={inp} value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Category</span><select className={inp} value={f.locationType} onChange={(e) => set('locationType', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Priority</span><select className={inp} value={f.priority} onChange={(e) => set('priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p.v}>{p.v}</option>)}</select></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Budget target/day</span><input type="number" className={inp} value={f.budgetTarget} onChange={(e) => set('budgetTarget', e.target.value)} /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Due date</span><input type="date" className={inp} value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></label>
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Assigned scout</span><input className={inp} value={f.assignedToName} onChange={(e) => set('assignedToName', e.target.value)} placeholder="Name" /></label>
        </div>
        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !f.projectId || !f.title} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#0f172a] text-white rounded-lg disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

function AssignmentDrawer({ id, projName, sync, onClose, onChanged }: any) {
  const [a, setA] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(() => { scoutingApi.assignment(id).then((r) => setA(r.data)); }, [id]);
  useEffect(() => { load(); }, [load]);

  const accept = async (subId: string, link: boolean) => {
    const { data } = await scoutingApi.accept(subId, link);
    setResult(`Accepted → added to Master Library${data.linkedProjectLocationId ? ' and linked to the project' : ''}.`);
    load(); onChanged();
  };
  const reject = async (subId: string) => { await scoutingApi.setSubStatus(subId, 'REJECTED'); load(); onChanged(); };
  const shortlist = async (subId: string) => { await scoutingApi.setSubStatus(subId, 'SHORTLISTED'); load(); };

  if (!a) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 glass-bar border-b px-5 py-3 flex items-center justify-between z-10">
          <div><h2 className="font-semibold">{a.title}</h2><p className="text-xs text-gray-400">{projName(a.projectId)} · {a.type.replace('_', ' ')} · {a.status.replace('_', ' ')}</p></div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          {a.description && <p className="text-sm text-gray-600">{a.description}</p>}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {a.sceneRefs && <span className="inline-flex items-center gap-1"><Flag size={12} /> Sc. {a.sceneRefs}</span>}
            {a.dueDate && <span className="inline-flex items-center gap-1"><Calendar size={12} /> {new Date(a.dueDate).toLocaleDateString()}</span>}
            {a.budgetTarget && <span>Target {a.feeCurrency} {Number(a.budgetTarget).toLocaleString()}/day</span>}
            {a.assignedToName && <span>Scout: {a.assignedToName}</span>}
          </div>

          {result && <div className="text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2">{result}</div>}

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Field candidates ({a.submissions?.length || 0})</h3>
            <button onClick={() => setAdding(true)} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add candidate</button>
          </div>

          {a.submissions?.length ? a.submissions.map((s: any) => {
            const media = Array.isArray(s.media) ? s.media : [];
            return (
              <div key={s.id} className="border rounded-xl overflow-hidden">
                {media.length > 0 && <div className="flex gap-1 bg-gray-100 p-1 overflow-x-auto">{media.map((u: string, i: number) => <img key={i} src={u} alt="" className="h-24 rounded object-cover" />)}</div>}
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2"><span className="font-medium text-sm">{s.candidateName}</span><span className={`text-[11px] px-2 py-0.5 rounded ${S_STATUS[s.status]}`}>{s.status}</span></div>
                      {s.fullAddress && <p className="text-xs text-gray-500 mt-0.5">{s.fullAddress}</p>}
                    </div>
                    {(s.lat && s.lng) && <a href={s.googleMapsUrl || `https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 inline-flex items-center gap-1">Map <ExternalLink size={11} /></a>}
                  </div>
                  {s.summary && <p className="text-sm text-gray-600 mt-1">{s.summary}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {s.estFeePerDay && <span>~{a.feeCurrency} {Number(s.estFeePerDay).toLocaleString()}/day</span>}
                    {s.ownerName && <span>Owner: {s.ownerName}</span>}
                    {s.submittedByName && <span>by {s.submittedByName}</span>}
                  </div>
                  {s.status !== 'ACCEPTED' && s.status !== 'REJECTED' && (
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => accept(s.id, true)} className="text-xs inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg"><Check size={13} /> Accept + link to project</button>
                      <button onClick={() => accept(s.id, false)} className="text-xs inline-flex items-center gap-1 border px-3 py-1.5 rounded-lg"><Library size={13} /> Accept to library</button>
                      <button onClick={() => shortlist(s.id)} className="text-xs inline-flex items-center gap-1 border px-3 py-1.5 rounded-lg"><Star size={13} /> Shortlist</button>
                      <button onClick={() => reject(s.id)} className="text-xs text-red-600 px-2">Reject</button>
                    </div>
                  )}
                  {s.acceptedMasterLocationId && <p className="text-xs text-green-600 mt-2 inline-flex items-center gap-1"><Library size={12} /> In Master Library</p>}
                </div>
              </div>
            );
          }) : <p className="text-sm text-gray-400">No candidates submitted yet.</p>}
        </div>
      </div>
      {adding && <SubmissionModal assignmentId={id} sync={sync} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); onChanged(); }} />}
    </div>
  );
}

function SubmissionModal({ assignmentId, sync, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ candidateName: '', summary: '', fullAddress: '', lat: '', lng: '', estFeePerDay: '', ownerName: '', ownerPhone: '', mediaText: '', submittedByName: '' });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
  const offline = sync && !sync.online;

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { set('lat', pos.coords.latitude.toFixed(7)); set('lng', pos.coords.longitude.toFixed(7)); setLocating(false); },
      () => setLocating(false), { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const save = async () => {
    setSaving(true);
    try {
      const media = (f.mediaText || '').split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean);
      const payload: any = { ...f, media };
      delete payload.mediaText;
      ['lat', 'lng', 'estFeePerDay'].forEach((k) => { if (payload[k] === '') payload[k] = null; });
      if (offline && sync?.queueScoutSubmission) {
        // Field capture with no signal — persist on-device; auto-syncs on reconnect.
        await sync.queueScoutSubmission(assignmentId, payload, `Scout candidate: ${payload.candidateName}`);
      } else {
        await scoutingApi.submit(assignmentId, { ...payload, clientId: (crypto as any)?.randomUUID?.() });
      }
      onSaved();
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between"><h2 className="font-semibold">Add field candidate</h2><button onClick={onClose}><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Candidate name *</span><input className={inp} value={f.candidateName} onChange={(e) => set('candidateName', e.target.value)} /></label>
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Summary / notes</span><textarea className={inp} rows={2} value={f.summary} onChange={(e) => set('summary', e.target.value)} /></label>
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Address</span><input className={inp} value={f.fullAddress} onChange={(e) => set('fullAddress', e.target.value)} /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Latitude</span><input className={inp} value={f.lat} onChange={(e) => set('lat', e.target.value)} /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Longitude</span><input className={inp} value={f.lng} onChange={(e) => set('lng', e.target.value)} /></label>
          <button onClick={useMyLocation} disabled={locating} className="col-span-2 text-xs inline-flex items-center justify-center gap-1 border rounded-lg py-2 text-gray-600"><MapPin size={13} /> {locating ? 'Locating…' : 'Use my current GPS location'}</button>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Est. fee/day</span><input type="number" className={inp} value={f.estFeePerDay} onChange={(e) => set('estFeePerDay', e.target.value)} /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Owner name</span><input className={inp} value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Owner phone</span><input className={inp} value={f.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} /></label>
          <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Submitted by</span><input className={inp} value={f.submittedByName} onChange={(e) => set('submittedByName', e.target.value)} /></label>
          <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Photo URLs (one per line)</span><textarea className={inp} rows={2} value={f.mediaText} onChange={(e) => set('mediaText', e.target.value)} placeholder="Upload-based capture lands with the offline portal" /></label>
        </div>
        <div className="border-t px-5 py-3 flex items-center justify-between gap-2">
          {offline ? <span className="text-xs text-amber-700 inline-flex items-center gap-1"><WifiOff size={13} /> Offline — saved on device, syncs later</span> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={save} disabled={saving || !f.candidateName} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#0f172a] text-white rounded-lg disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : offline ? 'Save offline' : 'Submit candidate'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
