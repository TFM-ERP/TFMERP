'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { MapPin, Plus, Trash2, Loader2, Printer, Users, Route, Calendar, Clock, ChevronUp, ChevronDown, Crown, Bus, AlertTriangle } from 'lucide-react';
import { PanelHeader, StatRow, ClusterCard, Chip, Btn, EmptyState, SectionLabel } from './ui';

const TRANSPORT_TONE: Record<string, string> = { REQUESTED: 'need', ASSIGNED: 'link', EN_ROUTE: 'link', COMPLETED: 'money', CANCELLED: 'slate' };

// Per-visit transport request + status (lazy-loads its own status).
function VisitTransport({ visit }: { visit: any }) {
  const [st, setSt] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { productionApi.scoutVisits.transportStatus(visit.id).then(r => setSt(r.data)).catch(() => setSt({ requested: false })); }, [visit.id]);
  useEffect(() => { load(); }, [load]);
  const request = async () => { setBusy(true); try { await productionApi.scoutVisits.requestTransport(visit.id); load(); } finally { setBusy(false); } };
  const cancel = async () => { setBusy(true); try { await productionApi.scoutVisits.cancelTransport(visit.id); load(); } finally { setBusy(false); } };
  const headcount = visit.members?.length || 0;

  if (!st) return null;
  return (
    <div>
      <SectionLabel icon={Bus}>Transport</SectionLabel>
      {!st.requested ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-400 flex-1">Raise a transport request sized to the party ({headcount} crew). The transport team picks it up on their movement board.</p>
          <Btn variant="secondary" onClick={request} disabled={busy || headcount === 0}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Bus size={13} />} Request transport</Btn>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tone={TRANSPORT_TONE[st.status] || 'slate'}>{String(st.status).replace('_', ' ')}</Chip>
            <span className="text-xs text-slate-500">{st.passengerNote}</span>
            <button onClick={cancel} disabled={busy} className="text-[11px] text-slate-400 hover:text-rose-500 ml-auto">Cancel request</button>
          </div>
          {(st.vehicle || st.driver) && (
            <div className="text-[11px] text-slate-500">
              {st.vehicle && <span>{[st.vehicle.make, st.vehicle.model].filter(Boolean).join(' ')}{st.vehicle.plateNumber ? ` · ${st.vehicle.plateNumber}` : ''}{st.vehicle.capacity ? ` · ${st.vehicle.capacity} seats` : ''}</span>}
              {st.driver && <span>{st.vehicle ? ' · ' : ''}Driver: {st.driver.fullName}{st.driver.mobile ? ` (${st.driver.mobile})` : ''}</span>}
            </div>
          )}
          {st.needsResize && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Party is now {st.partyCount} — re-request to re-size. <button onClick={request} disabled={busy} className="underline">Re-size now</button></p>}
        </div>
      )}
    </div>
  );
}

const VISIT_TONE: Record<string, string> = { PLANNED: 'slate', CONFIRMED: 'need', IN_PROGRESS: 'link', DONE: 'money', CANCELLED: 'risk' };
const TYPE_LABEL: Record<string, string> = { RECON: 'Recon', PRELIMINARY: 'Preliminary', TECH_RECCE: 'Tech recce' };
const TYPES = ['RECON', 'PRELIMINARY', 'TECH_RECCE'];
const STATUSES = ['PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const inp = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-900 outline-none';

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function ScoutVisitsPanel({ projectId }: { projectId: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [needs, setNeeds] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [crew, setCrew] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<any>({ title: '', type: 'RECON', date: '', callTime: '', meetingPoint: '' });
  const [stopSel, setStopSel] = useState<Record<string, { needId: string; locationId: string }>>({});
  const [memberSel, setMemberSel] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      productionApi.scoutVisits.list(projectId),
      productionApi.locationNeeds.list(projectId),
      productionApi.locations.list(projectId),
      productionApi.scoutVisits.crewPool(projectId),
    ])
      .then(([v, n, l, c]) => {
        setVisits(Array.isArray(v.data) ? v.data : []);
        setNeeds(Array.isArray(n.data) ? n.data : []);
        setLocs(Array.isArray(l.data) ? l.data : []);
        setCrew(Array.isArray(c.data) ? c.data : []);
      })
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!draft.title.trim()) return;
    await productionApi.scoutVisits.create({ ...draft, projectId, date: draft.date || null });
    setDraft({ title: '', type: 'RECON', date: '', callTime: '', meetingPoint: '' });
    setCreating(false);
    load();
  };
  const setVisitField = async (id: string, data: any) => { await productionApi.scoutVisits.update(id, data); load(); };
  const removeVisit = async (id: string) => { if (!confirm('Delete this scout visit?')) return; await productionApi.scoutVisits.remove(id); load(); };

  const addStop = async (visitId: string) => {
    const sel = stopSel[visitId] || { needId: '', locationId: '' };
    if (!sel.needId && !sel.locationId) return;
    await productionApi.scoutVisits.addStop(visitId, { needId: sel.needId || null, locationId: sel.locationId || null });
    setStopSel(s => ({ ...s, [visitId]: { needId: '', locationId: '' } }));
    load();
  };
  const removeStop = async (stopId: string) => { await productionApi.scoutVisits.removeStop(stopId); load(); };
  const moveStop = async (visit: any, idx: number, dir: -1 | 1) => {
    const ids = visit.stops.map((s: any) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await productionApi.scoutVisits.reorderStops(visit.id, ids);
    load();
  };

  const addMember = async (visitId: string) => {
    const crewId = memberSel[visitId];
    if (!crewId) return;
    await productionApi.scoutVisits.addMember(visitId, { crewId });
    setMemberSel(s => ({ ...s, [visitId]: '' }));
    load();
  };
  const removeMember = async (memberId: string) => { await productionApi.scoutVisits.removeMember(memberId); load(); };
  const toggleLead = async (memberId: string, isLead: boolean) => { await productionApi.scoutVisits.updateMember(memberId, { isLead: !isLead }); load(); };

  const printCallSheet = async (visit: any) => {
    let cs: any;
    try { const r = await productionApi.scoutVisits.callSheet(visit.id); cs = r.data; } catch { return; }
    const w = window.open('', '_blank');
    if (!w) return;
    const v = cs.visit;
    const stopRows = cs.stops.map((s: any) => `
      <tr>
        <td style="text-align:center;font-weight:600">${s.order}</td>
        <td><b>${esc(s.need || s.location || '—')}</b>${s.need && s.location ? `<br><span style="color:#64748b">at ${esc(s.location)}</span>` : ''}
            ${s.sceneRefs ? `<br><span style="color:#64748b;font-size:11px">Sc ${esc(s.sceneRefs)}${s.intExt ? ` · ${esc(s.intExt)}` : ''}</span>` : ''}</td>
        <td>${esc(s.address || s.area || '')}${s.googleMapsUrl ? `<br><a href="${esc(s.googleMapsUrl)}" style="color:#2563eb;font-size:11px">Map</a>` : ''}</td>
        <td>${s.contactName ? esc(s.contactName) : ''}${s.contactPhone ? `<br>${esc(s.contactPhone)}` : ''}</td>
        <td>${esc(s.arriveAt || '')}${s.departAt ? ` – ${esc(s.departAt)}` : ''}</td>
        <td>${esc(s.notes || '')}</td>
      </tr>`).join('');
    const partyRows = cs.party.map((p: any) => `
      <tr>
        <td><b>${esc(p.name)}</b>${p.isLead ? ' <span style="background:#0f172a;color:#fff;border-radius:4px;padding:1px 5px;font-size:10px">LEAD</span>' : ''}</td>
        <td>${esc(p.roleTitle || '')}</td>
        <td>${esc(p.department || '')}</td>
        <td>${esc(p.phone || '')}</td>
        <td>${esc(p.email || '')}</td>
      </tr>`).join('');
    w.document.write(`<html><head><title>Scout Call Sheet — ${esc(v.title)}</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;color:#0f172a;padding:28px;font-size:12px}
        h1{font-size:18px;margin:0 0 2px} .sub{color:#64748b;margin:0 0 16px}
        .meta{display:flex;gap:24px;margin:0 0 18px;flex-wrap:wrap}
        .meta div span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8}
        .meta div b{font-size:13px}
        table{width:100%;border-collapse:collapse;margin:0 0 20px}
        th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;border-bottom:2px solid #0f172a;padding:6px 8px}
        td{border-bottom:1px solid #e2e8f0;padding:7px 8px;vertical-align:top}
        h2{font-size:13px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.04em}
      </style></head><body>
      <h1>Scout Call Sheet</h1>
      <p class="sub">${esc(v.title)}${v.projectName ? ` · ${esc(v.projectName)}` : ''}</p>
      <div class="meta">
        <div><span>Type</span><b>${esc(TYPE_LABEL[v.type] || v.type)}</b></div>
        <div><span>Date</span><b>${esc(fmtDate(v.date))}</b></div>
        <div><span>Call time</span><b>${esc(v.callTime || '—')}</b></div>
        <div><span>Meeting point</span><b>${esc(v.meetingPoint || '—')}</b></div>
        <div><span>Party</span><b>${cs.headcount} crew</b></div>
      </div>
      ${v.purpose ? `<p><b>Purpose:</b> ${esc(v.purpose)}</p>` : ''}
      <h2>Route — ${cs.stops.length} stop${cs.stops.length === 1 ? '' : 's'}</h2>
      <table><thead><tr><th>#</th><th>Scouting for</th><th>Location / address</th><th>Site contact</th><th>Window</th><th>Notes</th></tr></thead><tbody>${stopRows || '<tr><td colspan="6" style="color:#94a3b8">No stops added.</td></tr>'}</tbody></table>
      <h2>Scout party</h2>
      <table><thead><tr><th>Name</th><th>Role</th><th>Dept</th><th>Phone</th><th>Email</th></tr></thead><tbody>${partyRows || '<tr><td colspan="5" style="color:#94a3b8">No party members assigned.</td></tr>'}</tbody></table>
      ${v.notes ? `<h2>Notes</h2><p>${esc(v.notes)}</p>` : ''}
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;

  const planned = visits.filter(v => ['PLANNED', 'CONFIRMED', 'IN_PROGRESS'].includes(v.status)).length;
  const done = visits.filter(v => v.status === 'DONE').length;
  const partyTotal = visits.reduce((t, v) => t + (v.members?.length || 0), 0);

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Route}
        title="Scout visits"
        subtitle="Plan a multi-stop scouting day, build the route across script locations, assign the party, and print the scout call sheet."
        actions={<Btn variant="primary" onClick={() => setCreating(c => !c)}><Plus size={13} /> New visit</Btn>}
      />

      {creating && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 mb-3 space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <input className={inp} placeholder="Visit title (e.g. Day 1 — Old Town recon)" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <select className={inp} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <input className={inp} type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
            <input className={inp} placeholder="Call time (e.g. 06:30)" value={draft.callTime} onChange={e => setDraft({ ...draft, callTime: e.target.value })} />
            <input className={`${inp} md:col-span-2`} placeholder="Meeting point / unit base" value={draft.meetingPoint} onChange={e => setDraft({ ...draft, meetingPoint: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={create} disabled={!draft.title.trim()}>Create visit</Btn>
            <Btn variant="secondary" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {visits.length === 0 ? (
        <EmptyState icon={Route}>No scout visits yet. Create one, build the route from your script locations, and assign the scout party.</EmptyState>
      ) : (
        <>
          <StatRow stats={[['Scout visits', visits.length], ['Planned / active', planned], ['Completed', done], ['Party assignments', partyTotal]]} />
          <div className="space-y-2">
            {visits.map((v) => {
              const sel = stopSel[v.id] || { needId: '', locationId: '' };
              return (
                <ClusterCard
                  key={v.id}
                  defaultOpen={v.status !== 'DONE' && v.status !== 'CANCELLED'}
                  title={<span className="inline-flex items-center gap-2">{v.title} <Chip tone={VISIT_TONE[v.status] || 'slate'}>{v.status.replace('_', ' ')}</Chip></span>}
                  badges={<Chip tone="slate">{TYPE_LABEL[v.type] || v.type}</Chip>}
                  meta={<span className="inline-flex items-center gap-3"><span className="inline-flex items-center gap-1"><Calendar size={12} />{fmtDate(v.date)}</span>{v.callTime && <span className="inline-flex items-center gap-1"><Clock size={12} />{v.callTime}</span>}<span className="inline-flex items-center gap-1"><Route size={12} />{v.stops?.length || 0} stops</span><span className="inline-flex items-center gap-1"><Users size={12} />{v.members?.length || 0}</span></span>}
                  right={<button onClick={(e) => { e.stopPropagation(); printCallSheet(v); }} title="Print scout call sheet" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900 text-xs"><Printer size={12} /> Call sheet</button>}
                >
                  {/* visit controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={inp} value={v.status} onChange={e => setVisitField(v.id, { status: e.target.value })}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <input className={`${inp} flex-1 min-w-[160px]`} defaultValue={v.meetingPoint || ''} placeholder="Meeting point" onBlur={e => { if (e.target.value !== (v.meetingPoint || '')) setVisitField(v.id, { meetingPoint: e.target.value }); }} />
                    <input className={inp} defaultValue={v.callTime || ''} placeholder="Call time" onBlur={e => { if (e.target.value !== (v.callTime || '')) setVisitField(v.id, { callTime: e.target.value }); }} />
                    <button onClick={() => removeVisit(v.id)} className="text-slate-300 hover:text-rose-500 ml-auto"><Trash2 size={14} /></button>
                  </div>

                  {/* Route / stops */}
                  <div>
                    <SectionLabel icon={Route}>Route</SectionLabel>
                    {(v.stops || []).length === 0 ? <p className="text-xs text-slate-400">No stops yet — add a script location or candidate place below.</p> : (
                      <div className="space-y-1.5">
                        {v.stops.map((s: any, i: number) => (
                          <div key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                            <span className="text-xs font-semibold text-slate-400 w-5 text-center">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-slate-800 text-sm">{s.need?.name || s.location?.name || s.label || '—'}</span>
                              {s.need && s.location && <span className="text-[11px] text-slate-400 ml-1.5">at {s.location.name}</span>}
                              {(s.location?.area || s.location?.emirate) && <span className="text-[11px] text-slate-400 ml-1.5">· {[s.location?.area, s.location?.emirate].filter(Boolean).join(', ')}</span>}
                            </div>
                            <div className="flex flex-col">
                              <button onClick={() => moveStop(v, i, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-700 disabled:opacity-30"><ChevronUp size={13} /></button>
                              <button onClick={() => moveStop(v, i, 1)} disabled={i === v.stops.length - 1} className="text-slate-300 hover:text-slate-700 disabled:opacity-30"><ChevronDown size={13} /></button>
                            </div>
                            <button onClick={() => removeStop(s.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <select className={inp} value={sel.needId} onChange={e => setStopSel(st => ({ ...st, [v.id]: { ...sel, needId: e.target.value } }))}>
                        <option value="">— script location (Need) —</option>
                        {needs.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                      <select className={inp} value={sel.locationId} onChange={e => setStopSel(st => ({ ...st, [v.id]: { ...sel, locationId: e.target.value } }))}>
                        <option value="">— candidate place (Location) —</option>
                        {locs.map((l: any) => <option key={l.id} value={l.id}>{l.name}{l.emirate ? ` · ${l.emirate}` : ''}</option>)}
                      </select>
                      <Btn variant="secondary" onClick={() => addStop(v.id)} disabled={!sel.needId && !sel.locationId}><Plus size={13} /> Add stop</Btn>
                    </div>
                  </div>

                  {/* Party */}
                  <div>
                    <SectionLabel icon={Users}>Scout party</SectionLabel>
                    {(v.members || []).length === 0 ? <p className="text-xs text-slate-400">No party assigned — pick crew below. IDs for the clearance pack are compiled in the next slice.</p> : (
                      <div className="space-y-1.5">
                        {v.members.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                            <span className="font-medium text-slate-800 text-sm flex-1 truncate">
                              {m.name}
                              <span className="text-[11px] text-slate-400 ml-1.5">{[m.roleTitle, m.department].filter(Boolean).join(' · ')}</span>
                            </span>
                            <button onClick={() => toggleLead(m.id, m.isLead)} title={m.isLead ? 'Lead' : 'Mark as lead'} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${m.isLead ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-900'}`}><Crown size={12} /> Lead</button>
                            <button onClick={() => removeMember(m.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <select className={`${inp} flex-1`} value={memberSel[v.id] || ''} onChange={e => setMemberSel(s => ({ ...s, [v.id]: e.target.value }))}>
                        <option value="">— add crew to the party —</option>
                        {crew.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.roleTitle ? ` · ${c.roleTitle}` : c.department ? ` · ${c.department}` : ''}</option>)}
                      </select>
                      <Btn variant="secondary" onClick={() => addMember(v.id)} disabled={!memberSel[v.id]}><Plus size={13} /> Add to party</Btn>
                    </div>
                  </div>

                  {/* Transport */}
                  <VisitTransport visit={v} />
                </ClusterCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
