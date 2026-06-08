'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { Route, Plus, Trash2, Loader2, Users, Calendar, MapPin, Bus, Crown, ShieldCheck, Truck, Car } from 'lucide-react';
import { PanelHeader, StatRow, ClusterCard, Chip, Btn, EmptyState, SectionLabel } from './ui';

const VISIT_TONE: Record<string, string> = { PLANNED: 'slate', CONFIRMED: 'need', IN_PROGRESS: 'link', DONE: 'money', CANCELLED: 'risk' };
const TYPE_LABEL: Record<string, string> = { RECON: 'Recon', PRELIMINARY: 'Preliminary', TECH_RECCE: 'Tech recce' };
const TYPES = ['RECON', 'PRELIMINARY', 'TECH_RECCE'];
const inp = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-900 outline-none';
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '—');
const APP = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * SYS-07 V2 · Slice 9 — standalone (master/library-scope) Scout Visits. Same spine as the
 * project panel but project-less: route built from library candidates, party from the crew
 * directory, transport at house scope, plus an "available options" feed.
 */
export default function MasterScoutVisitsPanel() {
  const [visits, setVisits] = useState<any[]>([]);
  const [opts, setOpts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<any>({ title: '', type: 'RECON', date: '', meetingPoint: '' });
  const [stopSel, setStopSel] = useState<Record<string, string>>({});
  const [memberSel, setMemberSel] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productionApi.scoutVisits.list(), productionApi.scoutVisits.masterOptions()])
      .then(([v, o]) => { setVisits(Array.isArray(v.data) ? v.data : []); setOpts(o.data); })
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!draft.title.trim()) return;
    await productionApi.scoutVisits.create({ ...draft, date: draft.date || null }); // no projectId = master scope
    setDraft({ title: '', type: 'RECON', date: '', meetingPoint: '' });
    setCreating(false); load();
  };
  const setVisitField = async (id: string, data: any) => { await productionApi.scoutVisits.update(id, data); load(); };
  const removeVisit = async (id: string) => { if (!confirm('Delete this scout visit?')) return; await productionApi.scoutVisits.remove(id); load(); };

  const addStop = async (visitId: string) => {
    const sel = stopSel[visitId];
    if (!sel) return;
    const ml = opts?.masterLocations.find((m: any) => m.id === sel);
    await productionApi.scoutVisits.addStop(visitId, { label: ml ? ml.name : sel });
    setStopSel((s) => ({ ...s, [visitId]: '' })); load();
  };
  const removeStop = async (stopId: string) => { await productionApi.scoutVisits.removeStop(stopId); load(); };

  const addMember = async (visitId: string) => {
    const id = memberSel[visitId];
    const c = opts?.crew.find((x: any) => x.id === id);
    if (!c) return;
    await productionApi.scoutVisits.addMember(visitId, { name: c.name, department: c.department, roleTitle: c.role, phone: c.phone, email: c.email });
    setMemberSel((s) => ({ ...s, [visitId]: '' })); load();
  };
  const removeMember = async (memberId: string) => { await productionApi.scoutVisits.removeMember(memberId); load(); };
  const toggleLead = async (memberId: string, isLead: boolean) => { await productionApi.scoutVisits.updateMember(memberId, { isLead: !isLead }); load(); };

  const buildClearance = async (visit: any) => {
    if (!visit.members?.length) { alert('Add party members first.'); return; }
    const r = await productionApi.clearancePacks.buildFromVisit(visit.id, { title: `Clearance — ${visit.title}`, expiryDays: 7 });
    const token = r.data?.token;
    if (token) { navigator.clipboard?.writeText(`${APP}/clearance/${token}`); alert('Clearance pack built — secure link copied to clipboard.'); }
    load();
  };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Route}
        title="Scout visits — master library"
        subtitle="Plan a project-less scouting day over library candidates, pull a party from the crew directory, and align the house fleet."
        actions={<Btn variant="primary" onClick={() => setCreating((c) => !c)}><Plus size={13} /> New visit</Btn>}
      />

      {/* Available options feed */}
      {opts && (
        <StatRow stats={[
          ['Crew directory', opts.counts.crew],
          ['Available vehicles', opts.counts.vehicles],
          ['Available drivers', opts.counts.drivers],
          ['Library candidates', opts.counts.masterLocations],
        ]} />
      )}

      {creating && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 mb-3 space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <input className={inp} placeholder="Visit title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select className={inp} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
            <input className={inp} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <input className={inp} placeholder="Meeting point" value={draft.meetingPoint} onChange={(e) => setDraft({ ...draft, meetingPoint: e.target.value })} />
          </div>
          <div className="flex gap-2"><Btn variant="primary" onClick={create} disabled={!draft.title.trim()}>Create</Btn><Btn variant="secondary" onClick={() => setCreating(false)}>Cancel</Btn></div>
        </div>
      )}

      {visits.length === 0 ? (
        <EmptyState icon={Route}>No master scout visits yet. Create one to scout library candidates without a project.</EmptyState>
      ) : (
        <div className="space-y-2">
          {visits.map((v) => (
            <ClusterCard
              key={v.id}
              defaultOpen={v.status !== 'DONE' && v.status !== 'CANCELLED'}
              title={<span className="inline-flex items-center gap-2">{v.title} <Chip tone={VISIT_TONE[v.status] || 'slate'}>{v.status.replace('_', ' ')}</Chip></span>}
              badges={<Chip tone="slate">{TYPE_LABEL[v.type] || v.type}</Chip>}
              meta={<span className="inline-flex items-center gap-3"><span className="inline-flex items-center gap-1"><Calendar size={12} />{fmtDate(v.date)}</span><span className="inline-flex items-center gap-1"><Route size={12} />{v.stops?.length || 0}</span><span className="inline-flex items-center gap-1"><Users size={12} />{v.members?.length || 0}</span></span>}
            >
              <div className="flex flex-wrap items-center gap-2">
                <select className={inp} value={v.status} onChange={(e) => setVisitField(v.id, { status: e.target.value })}>
                  {['PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
                <button onClick={() => buildClearance(v)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900 text-xs"><ShieldCheck size={12} /> Clearance pack</button>
                <button onClick={() => removeVisit(v.id)} className="text-slate-300 hover:text-rose-500 ml-auto"><Trash2 size={14} /></button>
              </div>

              {/* Route from library candidates */}
              <div>
                <SectionLabel icon={MapPin}>Route</SectionLabel>
                {(v.stops || []).length > 0 && (
                  <div className="space-y-1.5">
                    {v.stops.map((s: any, i: number) => (
                      <div key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                        <span className="text-xs font-semibold text-slate-400 w-5 text-center">{i + 1}</span>
                        <span className="flex-1 font-medium text-slate-800 text-sm">{s.location?.name || s.label || '—'}</span>
                        <button onClick={() => removeStop(s.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <select className={`${inp} flex-1`} value={stopSel[v.id] || ''} onChange={(e) => setStopSel((s) => ({ ...s, [v.id]: e.target.value }))}>
                    <option value="">— library candidate —</option>
                    {opts?.masterLocations.map((m: any) => <option key={m.id} value={m.id}>{m.name}{m.region ? ` · ${m.region}` : ''}</option>)}
                  </select>
                  <Btn variant="secondary" onClick={() => addStop(v.id)} disabled={!stopSel[v.id]}><Plus size={13} /> Add stop</Btn>
                </div>
              </div>

              {/* Party from crew directory */}
              <div>
                <SectionLabel icon={Users}>Scout party</SectionLabel>
                {(v.members || []).length > 0 && (
                  <div className="space-y-1.5">
                    {v.members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                        <span className="font-medium text-slate-800 text-sm flex-1 truncate">{m.name}<span className="text-[11px] text-slate-400 ml-1.5">{[m.roleTitle, m.department].filter(Boolean).join(' · ')}</span></span>
                        <button onClick={() => toggleLead(m.id, m.isLead)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${m.isLead ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-900'}`}><Crown size={12} /> Lead</button>
                        <button onClick={() => removeMember(m.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <select className={`${inp} flex-1`} value={memberSel[v.id] || ''} onChange={(e) => setMemberSel((s) => ({ ...s, [v.id]: e.target.value }))}>
                    <option value="">— add crew from directory —</option>
                    {opts?.crew.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : c.department ? ` · ${c.department}` : ''}</option>)}
                  </select>
                  <Btn variant="secondary" onClick={() => addMember(v.id)} disabled={!memberSel[v.id]}><Plus size={13} /> Add to party</Btn>
                </div>
              </div>

              {/* House fleet at a glance */}
              {opts && (opts.vehicles.length > 0 || opts.drivers.length > 0) && (
                <div>
                  <SectionLabel icon={Bus}>Available house fleet</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {opts.vehicles.slice(0, 8).map((veh: any) => <Chip key={veh.id} tone="slate"><Truck size={11} className="inline mr-1" />{[veh.make, veh.model].filter(Boolean).join(' ') || veh.vehicleType}{veh.capacity ? ` · ${veh.capacity}p` : ''}</Chip>)}
                    {opts.drivers.slice(0, 6).map((d: any) => <Chip key={d.id} tone="link"><Car size={11} className="inline mr-1" />{d.fullName}</Chip>)}
                  </div>
                </div>
              )}
            </ClusterCard>
          ))}
        </div>
      )}
    </div>
  );
}
