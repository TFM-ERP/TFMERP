'use client';

/**
 * SYS-LOC V2 · Milestone 4 — Scouting.
 * Field-first overview: live scout-visit day planner (type · date · call · stops · party ·
 * transport), candidate assignments & submission progress, and the field-capture / AI
 * brief-match cards from the prototype. Read+route surface — the full visit CRUD lives in
 * the legacy Scout-visits panel (routed via onNavigateInner) and the scouting assignment
 * detail in the standalone scouting page; this consolidates the live picture.
 */
import { useEffect, useMemo, useState } from 'react';
import { productionApi, scoutingApi } from '@/lib/api';

const up = (s: any) => String(s || '').toUpperCase();
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : 'TBC';
const label = (s: any) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const STY = `
.ls-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.ls-card{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;overflow:hidden;margin-bottom:13px}
.ls-card .hd{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--border-1)}.ls-card .hd h3{font-size:13px;font-weight:700;flex:1}.ls-card .hd .more{color:var(--accent);font-size:11px;font-weight:600;cursor:pointer}
.ls-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border-1)}.ls-row:last-child{border-bottom:none}
.ls-row .ic{width:32px;height:32px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:15px;flex-shrink:0}
.ls-row .m{flex:1;min-width:0}.ls-row .m b{display:block;font-size:12.5px;color:var(--text-1)}.ls-row .m small{font-size:10.5px;color:var(--text-3)}
.ls-bdg{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
.b-ok{background:var(--ok-soft);color:var(--ok)}.b-warn{background:var(--warn-soft);color:var(--warn)}.b-ac{background:var(--accent-soft);color:var(--accent)}.b-in{background:var(--info-soft);color:var(--info)}.b-n{background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-1)}
.ls-bars{height:6px;border-radius:999px;background:var(--surface-2);overflow:hidden;margin-top:6px}.ls-bars>i{display:block;height:100%;background:var(--accent)}
.ls-empty{font-size:12px;color:var(--text-3);padding:16px;text-align:center}
.ls-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:13px}
.ls-mini{background:var(--surface-2);border:1px solid var(--border-1);border-radius:11px;padding:12px}
.ls-mini .t{font-size:11px;font-weight:800;color:var(--text-2)}.ls-mini .d{font-size:11.5px;color:var(--text-3);margin-top:4px}
@media(max-width:900px){.ls-grid,.ls-3{grid-template-columns:1fr}}
`;

const visitIcon = (t: any) => up(t) === 'TECH_RECCE' ? '🎥' : up(t) === 'RECON' ? '📸' : '🚐';
const visitBadge = (t: any) => { const v = up(t); const c = v === 'TECH_RECCE' ? 'b-ac' : v === 'RECON' ? 'b-in' : 'b-warn'; return <span className={`ls-bdg ${c}`}>{label(t) || 'Visit'}</span>; };
const subCount = (a: any) => a._count?.submissions ?? (Array.isArray(a.submissions) ? a.submissions.length : (a.submissionCount ?? 0));

import ScoutVisitsPanel from './ScoutVisitsPanel';

export default function LocationsScouting({ projectId, onNavigateInner }: { projectId: string; onNavigateInner?: (t: string) => void }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [assigns, setAssigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true; setLoading(true);
    Promise.allSettled([
      productionApi.scoutVisits.list(projectId),
      scoutingApi.assignments({ projectId }),
    ]).then(([v, a]: any) => {
      if (!alive) return;
      if (v.status === 'fulfilled') { const d = v.value.data; setVisits(Array.isArray(d) ? d : (d?.items || [])); }
      if (a.status === 'fulfilled') { const d = a.value.data; setAssigns(Array.isArray(d) ? d : (d?.items || [])); }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const [view, setView] = useState<'field' | 'visits'>('field');
  const subsTotal = useMemo(() => assigns.reduce((n, a) => n + subCount(a), 0), [assigns]);
  const openAssigns = useMemo(() => assigns.filter(a => !['CLOSED', 'COMPLETE', 'ARCHIVED'].includes(up(a.status))), [assigns]);

  return (
    <div>
      <style>{STY}</style>
      <div className="lw-ph"><div><div className="k">Locations · Field</div><h2>Scouting</h2><div className="s">{visits.length} scout visits · {assigns.length} assignments · {subsTotal} submissions</div></div>
        <span style={{ flex: 1 }} />
        <button className="lw-btn ghost" onClick={() => setView('visits')}>＋ Scout visit</button></div>

      <div className="lw-sub">
        <div className={`lw-st ${view === 'field' ? 'on' : ''}`} onClick={() => setView('field')}>📥 Field &amp; AI</div>
        <div className={`lw-st ${view === 'visits' ? 'on' : ''}`} onClick={() => setView('visits')}>🗓 Visits &amp; call-sheets</div>
      </div>

      {view === 'visits' && <ScoutVisitsPanel projectId={projectId} />}
      {view === 'field' && (<>
      <div className="ls-grid">
        <div className="ls-card"><div className="hd"><h3>🗓 Scout visits</h3><span className="more" onClick={() => setView('visits')}>Planner →</span></div>
          {loading ? <div className="ls-empty">Loading…</div> : visits.length === 0 ? <div className="ls-empty">No scout visits yet. Plan a recon, preliminary or tech recce.</div> :
            visits.slice(0, 7).map((v: any) => (
              <div key={v.id} className="ls-row" onClick={() => setView('visits')} style={{ cursor: 'pointer' }}>
                <div className="ic">{visitIcon(v.type)}</div>
                <div className="m"><b>{(v.stops?.[0]?.label) || v.meetingPoint || label(v.type) || 'Scout visit'}</b>
                  <small>{fmtDate(v.date)}{v.callTime ? ` · call ${v.callTime}` : ''}{v.stops?.length ? ` · ${v.stops.length} stops` : ''}{v.members?.length ? ` · party ${v.members.length}` : ''}</small></div>
                {visitBadge(v.type)}
                {v.transportRequested && <span className="ls-bdg b-ok">🚐</span>}
              </div>
            ))}
        </div>
        <div className="ls-card"><div className="hd"><h3>📥 Candidate assignments &amp; submissions</h3></div>
          {loading ? <div className="ls-empty">Loading…</div> : assigns.length === 0 ? <div className="ls-empty">No scouting assignments yet. Brief scouts against a location need.</div> :
            assigns.slice(0, 7).map((a: any) => {
              const sc = subCount(a); const target = a.targetSubmissions || a.target || 5;
              return (
                <div key={a.id} className="ls-row"><div className="ic">📍</div>
                  <div className="m"><b>{a.title || a.brief || a.locationName || 'Assignment'}</b>
                    <small>{label(a.status) || 'Open'} · {sc} submission{sc === 1 ? '' : 's'}{a.acceptedMasterLocationId ? ' · accepted' : ''}</small>
                    <div className="ls-bars"><i style={{ width: `${Math.min(100, Math.round((sc / target) * 100))}%` }} /></div></div>
                  <span className={`ls-bdg ${a.acceptedMasterLocationId ? 'b-ok' : sc ? 'b-in' : 'b-n'}`}>{a.acceptedMasterLocationId ? 'Accepted' : sc ? 'In review' : 'Briefed'}</span>
                </div>);
            })}
        </div>
      </div>

      <div className="ls-3">
        <div className="ls-mini"><div className="t">🤖 AI brief-match</div><div className="d">{openAssigns.length} open brief{openAssigns.length === 1 ? '' : 's'} — match against the Master Library &amp; submissions. <span style={{ color: 'var(--accent)' }}>Lands in a later slice.</span></div></div>
        <div className="ls-mini"><div className="t">📚 Library look-alikes</div><div className="d">Reuse past locations that fit the brief — with usage history &amp; spend. Routed from the Master Library.</div></div>
        <div className="ls-mini"><div className="t">📱 Mobile field capture</div><div className="d">Offline scout PWA — photos + GPS + what3words, synced to submissions. <span style={{ color: 'var(--accent)' }}>Phase 3.</span></div></div>
      </div>
      </>)}
    </div>
  );
}
