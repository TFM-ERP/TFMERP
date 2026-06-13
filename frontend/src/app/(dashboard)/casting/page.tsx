'use client';

import { useState, useEffect, useCallback } from 'react';
import { castingApi } from '@/lib/api';
import { CallSubmissions } from '@/components/production/CastingPanel';
import { Clapperboard, Plus, X, Loader2, Building2, Users, ChevronRight, Star } from 'lucide-react';

const CALL_STATUS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', OPEN: 'bg-emerald-100 text-emerald-700', IN_REVIEW: 'bg-blue-100 text-blue-700',
  CALLBACKS: 'bg-amber-100 text-amber-700', OFFER: 'bg-violet-100 text-violet-700', CAST: 'bg-emerald-100 text-emerald-700', CLOSED: 'bg-slate-100 text-slate-400',
};
const projLabel = (c: any) => (c.project ? (c.project.isHouse ? 'House / Corporate' : c.project.title) : 'Standalone');

export default function CastingMaster() {
  const [dash, setDash] = useState<any | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [scope, setScope] = useState<'all' | 'standalone'>('all');
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    castingApi.dashboard().then((r) => setDash(r.data)).catch(() => {});
    castingApi.calls(scope === 'standalone' ? { scope: 'standalone' } : {}).then((r) => setCalls(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [scope]);
  useEffect(() => { load(); }, [load]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const total = (g: any[] = []) => g.reduce((a, x) => a + (x._count || 0), 0);
  const byStatus = (g: any[] = [], ks: string[]) => g.filter((x) => ks.includes(x.status)).reduce((a, x) => a + (x._count || 0), 0);

  return (
    <div className="font-sans p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Clapperboard className="text-[#0f172a]" /> Casting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every casting call across projects, plus standalone talent-agency calls.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800"><Plus size={16} /> New standalone call</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={<Clapperboard size={16} />} label="Total calls" value={total(dash?.byStatus)} />
        <Stat icon={<Users size={16} />} label="Open / in review" value={byStatus(dash?.byStatus, ['OPEN', 'IN_REVIEW', 'CALLBACKS'])} tone="emerald" />
        <Stat icon={<Star size={16} />} label="At offer" value={byStatus(dash?.byStatus, ['OFFER'])} tone="violet" />
        <Stat icon={<Building2 size={16} />} label="Standalone" value={dash?.standalone ?? 0} tone="slate" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card title="Open calls" icon={<Clapperboard size={15} />}>
          {(dash?.openCalls || []).length === 0 ? <Empty>No open calls.</Empty> : dash.openCalls.map((c: any) => (
            <Row key={c.id} left={c.roleName} sub={`${projLabel(c)} · ${c._count?.submissions ?? 0} subs`} right={c.status.replace(/_/g, ' ')} />
          ))}
        </Card>
        <Card title="Recent submissions" icon={<Users size={15} />}>
          {(dash?.recentSubs || []).length === 0 ? <Empty>No submissions yet.</Empty> : dash.recentSubs.map((s: any) => (
            <Row key={s.id} left={s.talent?.stageName || s.talent?.fullName} sub={s.castingCall?.roleName} right={s.status} />
          ))}
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Toggle active={scope === 'all'} onClick={() => setScope('all')}>All projects</Toggle>
        <Toggle active={scope === 'standalone'} onClick={() => setScope('standalone')}>Standalone only</Toggle>
      </div>
      <div className="grid gap-2.5">
        {calls.length === 0 ? <Empty>No casting calls.</Empty> : calls.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button onClick={() => setOpenId(openId === c.id ? null : c.id)} className="w-full text-left p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">{c.roleName}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${CALL_STATUS[c.status] || 'bg-slate-100'}`}>{c.status.replace(/_/g, ' ')}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${c.project ? (c.project.isHouse ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700') : 'bg-amber-50 text-amber-700'}`}><Building2 size={11} /> {projLabel(c)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{c.roleType?.replace(/_/g, ' ')} · {c._count?.submissions ?? 0} submissions</p>
              </div>
              <ChevronRight size={16} className={`text-slate-300 transition ${openId === c.id ? 'rotate-90' : ''}`} />
            </button>
            {openId === c.id && <CallSubmissions callId={c.id} onChange={load} flash={flash} />}
          </div>
        ))}
      </div>

      {open && <StandaloneCallModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
      {toast && <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lg">{toast}</div>}
    </div>
  );
}

function StandaloneCallModal({ onClose, onDone }: any) {
  const [f, setF] = useState<any>({ roleName: '', roleType: 'SUPPORTING', characterDescription: '', isPublic: true });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const submit = async () => {
    if (!f.roleName) return;
    setBusy(true);
    try { await castingApi.createCall({ roleName: f.roleName, roleType: f.roleType, characterDescription: f.characterDescription || undefined, isPublic: f.isPublic, status: 'OPEN' }); onDone(); }
    finally { setBusy(false); }
  };
  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New standalone casting call</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 space-y-3">
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">No project — a talent-agency style call. Selections post deal memos to the House/Corporate ledger.</p>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Role name *</span><input className={inp} value={f.roleName} onChange={(e) => set('roleName', e.target.value)} /></label>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Role type</span>
            <select className={inp} value={f.roleType} onChange={(e) => set('roleType', e.target.value)}>{['LEAD', 'SUPPORTING', 'FEATURED', 'DAY_PLAYER', 'BACKGROUND', 'STUNT', 'VOICE', 'STAND_IN', 'OTHER'].map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="text-sm block"><span className="block text-xs font-medium text-slate-500 mb-1">Description</span><textarea rows={3} className={inp} value={f.characterDescription} onChange={(e) => set('characterDescription', e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.isPublic} onChange={(e) => set('isPublic', e.target.checked)} className="rounded" /> Accept public submissions</label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !f.roleName} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Create</button>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = { default: 'text-slate-900', emerald: 'text-emerald-600', violet: 'text-violet-600', slate: 'text-slate-500' };
function Stat({ icon, label, value, tone = 'default' }: any) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-1.5 text-slate-400 text-xs">{icon}{label}</div><div className={`text-2xl font-semibold mt-1 ${TONE[tone]}`}>{value}</div></div>;
}
function Card({ title, icon, children }: any) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">{icon}{title}</p><div className="space-y-1">{children}</div></div>;
}
function Row({ left, sub, right }: any) {
  return <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"><div className="min-w-0"><div className="text-sm text-slate-800 truncate">{left}</div><div className="text-[11px] text-slate-400 truncate">{sub}</div></div><span className="text-xs text-slate-500 shrink-0 ml-2">{right}</span></div>;
}
function Empty({ children }: any) { return <p className="text-xs text-slate-400 py-2">{children}</p>; }
function Toggle({ active, onClick, children }: any) {
  return <button onClick={onClick} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{children}</button>;
}
