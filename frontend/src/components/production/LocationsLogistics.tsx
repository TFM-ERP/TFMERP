'use client';

/**
 * SYS-LOC V2 · Milestone 5 — Logistics & Unit Moves.
 * Movement orders (from→to, drive time, convoy, parking, facilities, map, contacts),
 * company moves between shoot days, and proximity — auto-built from confirmed locations.
 * Persists via the new MovementOrder backend; computes estimated moves client-side so the
 * page is useful before db:push (it then shows a one-line note to enable persistence).
 */
import { useEffect, useMemo, useState } from 'react';
import { productionApi } from '@/lib/api';

const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
const stageOf = (l: any) => { const s = l.pipelineStage || l.status; return (s === 'CONFIRMED' || l.status === 'CONFIRMED') ? 'confirmed' : (s === 'WRAPPED' || l.status === 'RELEASED') ? 'wrapped' : ['NOC_REQUESTED', 'AGREEMENT_SENT', 'PERMIT_APPLIED', 'INSURANCE_RECEIVED'].includes(s) ? 'clearing' : 'sourcing'; };
function hav(a: number[], b: number[]) { const R = 6371, r = (x: number) => x * Math.PI / 180; const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]); const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); }
const driveMin = (km: number) => Math.max(1, Math.round((km * 1.3) / 50 * 60));

const STY = `
.lg-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.lg-card{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;overflow:hidden;margin-bottom:13px}
.lg-card .hd{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--border-1)}.lg-card .hd h3{font-size:13px;font-weight:700;flex:1}.lg-card .hd .more{color:var(--accent);font-size:11px;font-weight:600;cursor:pointer}
.lg-pad{padding:13px 14px}
.lg-kv{display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-size:12.5px;border-bottom:1px solid var(--border-1)}.lg-kv:last-child{border-bottom:none}.lg-kv .l{color:var(--text-3)}.lg-kv .r{font-weight:700;color:var(--text-1);text-align:end}
.lg-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border-1);cursor:pointer}.lg-row:last-child{border-bottom:none}.lg-row:hover{background:var(--surface-2)}.lg-row.on{background:var(--accent-soft)}
.lg-row .ic{width:30px;height:30px;border-radius:8px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:14px;flex-shrink:0}.lg-row .m{flex:1;min-width:0}.lg-row .m b{display:block;font-size:12.5px;color:var(--text-1)}.lg-row .m small{font-size:10.5px;color:var(--text-3)}
.lg-bdg{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}
.b-ok{background:var(--ok-soft);color:var(--ok)}.b-warn{background:var(--warn-soft);color:var(--warn)}.b-in{background:var(--info-soft);color:var(--info)}.b-n{background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-1)}
.lg-empty{font-size:12px;color:var(--text-3);padding:16px;text-align:center}
.lg-note{font-size:11px;color:var(--warn);background:var(--warn-soft);border-radius:8px;padding:8px 11px;margin-bottom:12px}
@media(max-width:900px){.lg-grid{grid-template-columns:1fr}}
`;

export default function LocationsLogistics({ projectId, locations = [], currency = 'AED' }:
  { projectId: string; locations?: any[]; currency?: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    productionApi.movementOrders.list(projectId)
      .then((r: any) => { setOrders(Array.isArray(r.data) ? r.data : []); setPending(false); })
      .catch(() => setPending(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line

  // client-side estimates from confirmed locations (work before backend migration)
  const ll = useMemo(() => locations.map((l: any) => ({ ...l, _ll: [Number(l.lat), Number(l.lng)] as [number, number] })).filter((l: any) => Number.isFinite(l._ll[0]) && Number.isFinite(l._ll[1]) && (l._ll[0] || l._ll[1])), [locations]);
  const confirmed = useMemo(() => ll.filter((l: any) => stageOf(l) === 'confirmed'), [ll]);
  const base = useMemo(() => ll.find((l: any) => /base|camp/i.test(l.name || '')) || confirmed[0] || ll[0], [ll, confirmed]);
  const estMoves = useMemo(() => confirmed.filter((l: any) => l !== base).map((l: any) => { const km = base ? hav(base._ll, l._ll) : 0; return { id: 'est-' + l.id, toLabel: l.name, fromLabel: base?.name, distanceKm: Math.round(km * 10) / 10, driveMinutes: driveMin(km), _loc: l }; }), [confirmed, base]);

  const shown = orders.length ? orders : estMoves;
  const current = shown.find((o: any) => o.id === sel) || shown[0];

  const generate = async () => {
    setBusy(true);
    try { await productionApi.movementOrders.generate(projectId); load(); } catch { setPending(true); } finally { setBusy(false); }
  };

  return (
    <div>
      <style>{STY}</style>
      <div className="lw-ph"><div><div className="k">Locations · Logistics</div><h2>Logistics &amp; Unit Moves</h2><div className="s">Movement orders · company moves · proximity</div></div>
        <span style={{ flex: 1 }} /><button className="lw-btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : '⚙ Generate from confirmed'}</button></div>

      {pending && <div className="lg-note">Movement orders persist once the backend migration is applied (run <b>npm run db:push</b> &amp; restart). Estimates below are computed live from confirmed locations.</div>}

      <div className="lg-grid">
        <div className="lg-card"><div className="hd"><h3>🚚 Movement orders</h3><span className="more">{shown.length} total</span></div>
          {loading ? <div className="lg-empty">Loading…</div> : shown.length === 0 ? <div className="lg-empty">No moves yet — confirm a location (with map coords) and click Generate.</div> :
            shown.map((o: any) => (
              <div key={o.id} className={`lg-row ${current?.id === o.id ? 'on' : ''}`} onClick={() => setSel(o.id)}>
                <div className="ic">🚚</div>
                <div className="m"><b>{o.title || `→ ${o.toLabel}`}</b><small>{o.fromLabel || 'base'} → {o.toLabel}{o.driveMinutes ? ` · ${o.driveMinutes} min` : ''}{o.distanceKm ? ` · ${o.distanceKm} km` : ''}</small></div>
                <span className={`lg-bdg ${o.id?.startsWith('est-') ? 'b-n' : o.status === 'ISSUED' ? 'b-ok' : 'b-in'}`}>{o.id?.startsWith('est-') ? 'estimate' : (o.status || 'DRAFT').toLowerCase()}</span>
              </div>
            ))}
        </div>
        <div className="lg-card"><div className="hd"><h3>📋 {current ? (current.title || `Move → ${current.toLabel}`) : 'Movement order'}</h3></div>
          <div className="lg-pad">
            {current ? (<>
              <div className="lg-kv"><span className="l">From → To</span><span className="r">{current.fromLabel || 'base'} → {current.toLabel}</span></div>
              <div className="lg-kv"><span className="l">Drive · distance</span><span className="r">{current.driveMinutes ?? '—'} min · {current.distanceKm ?? '—'} km</span></div>
              <div className="lg-kv"><span className="l">Date</span><span className="r">{fmtDate(current.date)}</span></div>
              <div className="lg-kv"><span className="l">Convoy</span><span className="r">{current.convoyVehicles ?? '—'} vehicles</span></div>
              <div className="lg-kv"><span className="l">Parking</span><span className="r">{current.parkingNotes || current._loc?.parkingNotes || '—'}</span></div>
              <div className="lg-kv"><span className="l">Facilities</span><span className="r">{current.facilitiesNotes || current._loc?.basecampNotes || '—'}</span></div>
              <div className="lg-kv"><span className="l">Map</span><span className="r">{(current.mapUrl || current._loc?.googleMapsUrl) ? <a href={current.mapUrl || current._loc?.googleMapsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>📍 Open map</a> : '—'}</span></div>
            </>) : <div className="lg-empty">Select a move.</div>}
          </div>
        </div>
      </div>

      <div className="lg-card"><div className="hd"><h3>🔁 Company moves &amp; proximity</h3></div>
        {!base ? <div className="lg-empty">Add map coordinates to confirmed locations to plan moves.</div> : (
          <>
            {confirmed.filter((l: any) => l !== base).map((l: any) => { const km = hav(base._ll, l._ll); return (
              <div key={l.id} className="lg-row" style={{ cursor: 'default' }}><div className="ic">🔁</div><div className="m"><b>{base.name} → {l.name}</b><small>≈ {driveMin(km)} min · {km.toFixed(1)} km</small></div><span className="lg-bdg b-ok">confirmed</span></div>
            ); })}
            {(base.nearestHospitalName || (base as any).nearestHospital) && <div className="lg-row" style={{ cursor: 'default' }}><div className="ic">🏥</div><div className="m"><b>Nearest hospital</b><small>{base.nearestHospitalName || (base as any).nearestHospital} — pushes to call-sheet safety</small></div><span className="lg-bdg b-n">safety</span></div>}
            {confirmed.filter((l: any) => l !== base).length === 0 && <div className="lg-empty">Only the base is confirmed so far — confirm another location to plan a move.</div>}
          </>
        )}
      </div>
    </div>
  );
}
