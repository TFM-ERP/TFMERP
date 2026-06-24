'use client';

/**
 * SYS-LOC V2 · Milestone 3 — Clearance & Compliance centre.
 * Consolidates the per-location compliance data (permits, documents, risks) + project
 * clearance packs into one project-wide surface: permit lifecycle with authority lead-times
 * & expiry alarms, the permit→COI→agreement gate, documents vault, crew-ID packs, risk
 * register. Aggregates client-side across the project's locations (per-location APIs).
 */
import { useEffect, useMemo, useState } from 'react';
import { productionApi } from '@/lib/api';

const up = (s: any) => String(s || '').toUpperCase();
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
const daysTo = (d: any) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;
const label = (s: any) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const CLEAR_DOC = ['NOC', 'LOCATION_AGREEMENT', 'RELEASE', 'INSURANCE'];

const STY = `
.lc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.lc-stat{background:var(--surface-1);border:1px solid var(--border-1);border-radius:11px;padding:10px 12px}
.lc-stat .k{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);font-weight:700}.lc-stat .v{font-size:20px;font-weight:800;margin-top:3px}.lc-stat .d{font-size:10px;color:var(--text-3);margin-top:1px}
.lc-card{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;overflow:hidden;margin-bottom:13px}
.lc-card .hd{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--border-1)}.lc-card .hd h3{font-size:13px;font-weight:700;flex:1}
.lc-tbl{width:100%;border-collapse:collapse;font-size:12px}.lc-tbl th{text-align:start;padding:8px 13px;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);font-weight:700;border-bottom:1px solid var(--border-1)}.lc-tbl td{padding:9px 13px;border-bottom:1px solid var(--border-1);color:var(--text-2)}.lc-tbl tr:last-child td{border-bottom:none}.lc-tbl td b{color:var(--text-1)}
.lc-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border-1)}.lc-row:last-child{border-bottom:none}.lc-row .ic{width:30px;height:30px;border-radius:8px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:14px;flex-shrink:0}.lc-row .m{flex:1;min-width:0}.lc-row .m b{display:block;font-size:12.5px;color:var(--text-1)}.lc-row .m small{font-size:10.5px;color:var(--text-3)}
.lc-bdg{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
.b-ok{background:var(--ok-soft);color:var(--ok)}.b-warn{background:var(--warn-soft);color:var(--warn)}.b-dn{background:var(--danger-soft);color:var(--danger)}.b-ac{background:var(--accent-soft);color:var(--accent)}.b-in{background:var(--info-soft);color:var(--info)}.b-n{background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-1)}
.lc-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.lc-empty{font-size:12px;color:var(--text-3);padding:16px;text-align:center}
@media(max-width:900px){.lc-kpis{grid-template-columns:repeat(2,1fr)}.lc-grid{grid-template-columns:1fr}}
`;

function permitBadge(s: any) {
  const v = up(s);
  if (v === 'APPROVED' || v === 'GRANTED') return <span className="lc-bdg b-ok">Approved</span>;
  if (v === 'SUBMITTED' || v === 'APPLIED' || v === 'IN_REVIEW' || v === 'PENDING') return <span className="lc-bdg b-warn">Submitted ⧗</span>;
  if (v === 'REJECTED' || v === 'EXPIRED' || v === 'CANCELLED') return <span className="lc-bdg b-dn">{label(v)}</span>;
  return <span className="lc-bdg b-n">{v ? label(v) : 'Draft'}</span>;
}
function expiryBadge(d: any) {
  const n = daysTo(d); if (n == null) return <span className="lc-bdg b-n">—</span>;
  if (n < 0) return <span className="lc-bdg b-dn">Expired</span>;
  if (n <= 14) return <span className="lc-bdg b-dn">{n}d</span>;
  if (n <= 30) return <span className="lc-bdg b-warn">{n}d</span>;
  return <span className="lc-bdg b-n">{fmtDate(d)}</span>;
}

import ClearancePacksPanel from './ClearancePacksPanel';

export default function LocationsClearance({ projectId, locations = [], onNavigateInner }:
  { projectId: string; locations?: any[]; onNavigateInner?: (t: string) => void }) {
  const [permits, setPermits] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [auth, setAuth] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true; setLoading(true);
    productionApi.locations.authorities().then((r: any) => { if (alive) { const a: any = {}; (r.data || []).forEach((x: any) => a[x.id] = x); setAuth(a); } }).catch(() => {});
    productionApi.clearancePacks.list(projectId).then((r: any) => { if (alive) setPacks(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
    const ids = locations.map((l: any) => l.id).filter(Boolean);
    const nameOf: Record<string, string> = {}; locations.forEach((l: any) => nameOf[l.id] = l.name);
    Promise.allSettled([
      Promise.allSettled(ids.map((id: string) => productionApi.locations.permits(id).then((r: any) => (r.data || []).map((p: any) => ({ ...p, _loc: nameOf[id] }))))),
      Promise.allSettled(ids.map((id: string) => productionApi.locations.documents(id).then((r: any) => (r.data || []).map((d: any) => ({ ...d, _loc: nameOf[id] }))))),
      Promise.allSettled(ids.map((id: string) => productionApi.locations.risks(id).then((r: any) => (r.data || []).map((x: any) => ({ ...x, _loc: nameOf[id] }))))),
    ]).then(([P, D, R]: any) => {
      if (!alive) return;
      const flat = (res: any) => (res.value || []).filter((x: any) => x.status === 'fulfilled').flatMap((x: any) => x.value);
      setPermits(flat(P)); setDocs(flat(D)); setRisks(flat(R)); setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId, locations]);

  const [view, setView] = useState<'compliance' | 'packs'>('compliance');
  const permitsActive = useMemo(() => permits.filter(p => !['REJECTED', 'EXPIRED', 'CANCELLED'].includes(up(p.status))), [permits]);
  const clearDocs = useMemo(() => docs.filter(d => CLEAR_DOC.includes(up(d.category))), [docs]);
  const outstanding = useMemo(() => clearDocs.filter(d => !['SIGNED', 'APPROVED', 'COMPLETE', 'RECEIVED', 'VALID'].includes(up(d.status))).length, [clearDocs]);
  const expiringDocs = useMemo(() => docs.filter(d => { const n = daysTo(d.expiryDate); return n != null && n <= 30; }), [docs]);
  const openRisks = useMemo(() => risks.filter(r => up(r.status) === 'OPEN'), [risks]);

  return (
    <div>
      <style>{STY}</style>
      <div className="lw-ph"><div><div className="k">Locations · Compliance</div><h2>Clearance &amp; Compliance</h2><div className="s">Permits · COI · agreements · ID packs · risk — across {locations.length} locations</div></div>
        <span style={{ flex: 1 }} /><button className="lw-btn ghost" onClick={() => setView('packs')}>🔗 Crew-ID packs</button></div>

      <div className="lw-sub">
        <div className={`lw-st ${view === 'compliance' ? 'on' : ''}`} onClick={() => setView('compliance')}>🛡 Compliance</div>
        <div className={`lw-st ${view === 'packs' ? 'on' : ''}`} onClick={() => setView('packs')}>🔗 Crew-ID packs</div>
      </div>

      {view === 'packs' && <ClearancePacksPanel projectId={projectId} />}
      {view === 'compliance' && (<>
      <div className="lc-kpis">
        <div className="lc-stat"><div className="k">Permits active</div><div className="v">{permitsActive.length}</div><div className="d">{permits.filter(p => { const n = daysTo(p.expiryDate); return n != null && n <= 14; }).length} expiring ≤14d</div></div>
        <div className="lc-stat"><div className="k">Clearance docs out</div><div className="v">{outstanding}</div><div className="d">agreements / COI / NOC</div></div>
        <div className="lc-stat"><div className="k">Docs expiring</div><div className="v">{expiringDocs.length}</div><div className="d">≤ 30 days</div></div>
        <div className="lc-stat"><div className="k">Open risks</div><div className="v">{openRisks.length}</div><div className="d">{risks.filter(r => Number(r.riskScore) >= 9 && up(r.status) === 'OPEN').length} high</div></div>
      </div>

      <div className="lc-card"><div className="hd"><h3>🪪 Permits — lifecycle, lead-times &amp; expiry</h3></div>
        {loading ? <div className="lc-empty">Loading compliance…</div> : permits.length === 0 ? <div className="lc-empty">No permits recorded yet. Open a location → Permits to add one.</div> : (
          <table className="lc-tbl"><thead><tr><th>Permit</th><th>Location</th><th>Authority</th><th>Lead</th><th>Status</th><th>Expiry</th></tr></thead><tbody>
            {permits.map((p: any) => (
              <tr key={p.id}><td><b>{label(p.permitType)}</b></td><td>{p._loc || '—'}</td><td>{auth[p.authorityId]?.name || '—'}</td><td>{auth[p.authorityId]?.leadTimeDays != null ? `${auth[p.authorityId].leadTimeDays}d` : '—'}</td><td>{permitBadge(p.status)}</td><td>{expiryBadge(p.expiryDate)}</td></tr>
            ))}
          </tbody></table>
        )}
      </div>

      <div className="lc-grid">
        <div className="lc-card"><div className="hd"><h3>📄 COI, agreements &amp; documents</h3></div>
          {loading ? <div className="lc-empty">Loading…</div> : clearDocs.length === 0 ? <div className="lc-empty">No agreements / COI / NOC on file yet.</div> :
            clearDocs.slice(0, 8).map((d: any) => {
              const signed = ['SIGNED', 'APPROVED', 'COMPLETE', 'RECEIVED', 'VALID'].includes(up(d.status));
              const exp = daysTo(d.expiryDate);
              return (
                <div key={d.id} className="lc-row"><div className="ic">{up(d.category) === 'INSURANCE' ? '🛡' : up(d.category) === 'NOC' ? '📑' : '✍'}</div>
                  <div className="m"><b>{label(d.category)} · {d._loc || ''}</b><small>{d.partyName || d.authority || ''}{d.refNumber ? ` · ${d.refNumber}` : ''}</small></div>
                  {exp != null && exp <= 30 ? expiryBadge(d.expiryDate) : <span className={`lc-bdg ${signed ? 'b-ok' : 'b-warn'}`}>{signed ? 'Valid' : label(d.status) || 'Pending'}</span>}
                </div>);
            })}
        </div>
        <div className="lc-card"><div className="hd"><h3>🔗 Crew-ID clearance packs · ⚠ Risk register</h3></div>
          {packs.map((p: any) => (
            <div key={p.id} className="lc-row"><div className="ic">🔗</div><div className="m"><b>{p.title || p.label || 'Clearance pack'}</b><small>{(p.members?.length ?? p.memberCount ?? 0)} crew{p.expiresAt ? ` · expires ${fmtDate(p.expiresAt)}` : ''}</small></div><span className={`lc-bdg ${up(p.status) === 'ACTIVE' || up(p.status) === 'SHARED' ? 'b-ok' : 'b-n'}`}>{label(p.status) || 'Draft'}</span></div>
          ))}
          {openRisks.slice(0, 5).map((r: any) => {
            const high = Number(r.riskScore) >= 9;
            return <div key={r.id} className="lc-row"><div className="ic" style={{ background: high ? 'var(--danger-soft)' : 'var(--warn-soft)', color: high ? 'var(--danger)' : 'var(--warn)' }}>⚠</div><div className="m"><b>{r.hazard || r.category || 'Risk'} · {r._loc || ''}</b><small>L{r.likelihood ?? '–'}×I{r.impact ?? '–'} = {r.riskScore ?? '–'}{r.mitigation ? ` · ${String(r.mitigation).slice(0, 40)}` : ''}</small></div><span className={`lc-bdg ${high ? 'b-dn' : 'b-warn'}`}>{high ? 'High' : 'Open'}</span></div>;
          })}
          {packs.length === 0 && openRisks.length === 0 && !loading && <div className="lc-empty">No clearance packs or open risks.</div>}
        </div>
      </div>
      </>)}
    </div>
  );
}
