'use client';

/**
 * SYS-LOC V2 · Milestone 2 — Map & Routes.
 * Real Leaflet map of the project's locations (those with lat/lng), color-coded by pipeline
 * stage, with a unit-base marker, route lines (base → each, estimated drive time), a
 * click-to-pan side list, and overlay toggles. Reuses the app's Leaflet pattern (Dispatch).
 * Drive/walk times are straight-line estimates for now; real routing (OSRM/Directions) can
 * drop in later behind the same UI.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const STAGE = (l: any) => {
  const s = l.pipelineStage || (l.status === 'CONFIRMED' ? 'CONFIRMED' : l.status === 'RELEASED' ? 'WRAPPED' : 'SOURCING');
  if (s === 'CONFIRMED' || l.status === 'CONFIRMED') return 'confirmed';
  if (s === 'WRAPPED' || l.status === 'RELEASED') return 'wrapped';
  if (['NOC_REQUESTED', 'AGREEMENT_SENT', 'PERMIT_APPLIED', 'INSURANCE_RECEIVED'].includes(s)) return 'clearing';
  return 'sourcing';
};
const HEX: Record<string, string> = { sourcing: '#5b8def', clearing: '#E0A53F', confirmed: '#34D399', wrapped: '#8A94A6', base: '#C9A24A' };
function hav(a: number[], b: number[]) { const R = 6371, r = (x: number) => x * Math.PI / 180; const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]); const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); }
const driveMin = (km: number) => Math.max(1, Math.round((km * 1.3) / 50 * 60));

const STY = `
.lm-wrap{display:flex;gap:13px;align-items:flex-start;flex-wrap:wrap}
.lm-map{flex:1;min-width:300px;height:480px;border-radius:12px;border:1px solid var(--border-1);overflow:hidden;position:relative}
.lm-map .leaflet-control-attribution{font-size:9px}
.lm-side{width:248px;flex-shrink:0}
.lm-card{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;overflow:hidden;margin-bottom:12px}
.lm-card .h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);padding:10px 12px 6px}
.lm-row{display:flex;align-items:center;gap:9px;padding:8px 12px;border-top:1px solid var(--border-1);cursor:pointer;font-size:12px}
.lm-row:hover{background:var(--surface-2)}
.lm-row .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.lm-row .n{flex:1;min-width:0}.lm-row .n b{display:block;color:var(--text-1);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lm-row .n small{color:var(--text-3);font-size:10px}
.lm-tg{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px}
.lm-t{font-size:10.5px;font-weight:700;padding:5px 9px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border-1);color:var(--text-2);cursor:pointer}
.lm-t.on{background:var(--accent);color:var(--accent-on);border-color:var(--accent)}
.lm-t.soon{opacity:.6}
.lm-empty{background:var(--surface-1);border:1px dashed var(--border-2);border-radius:12px;padding:30px;text-align:center;color:var(--text-3);font-size:13px;width:100%}
.lm-leg{display:flex;gap:10px;flex-wrap:wrap;padding:9px 12px;border-top:1px solid var(--border-1);font-size:10.5px;color:var(--text-3)}
.lm-leg span{display:inline-flex;align-items:center;gap:5px}.lm-leg i{width:9px;height:9px;border-radius:50%}
`;

export default function LocationsMap({ locations = [], currency = 'AED' }: { locations?: any[]; currency?: string }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const Lref = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const routesRef = useRef<any>(null);
  const baseRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [showLoc, setShowLoc] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [overlays, setOverlays] = useState<Record<string, boolean>>({});

  const pts = useMemo(() => locations
    .map((l: any) => ({ ...l, _ll: [Number(l.lat), Number(l.lng)] as [number, number] }))
    .filter((l: any) => Number.isFinite(l._ll[0]) && Number.isFinite(l._ll[1]) && (l._ll[0] !== 0 || l._ll[1] !== 0)), [locations]);
  const base = useMemo(() => pts.find((l: any) => /base|camp/i.test(l.name || '')) || pts.find((l: any) => STAGE(l) === 'confirmed') || pts[0], [pts]);

  // init leaflet once
  useEffect(() => {
    let cancelled = false;
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = LEAFLET_CSS; link.setAttribute('data-leaflet', '1'); document.head.appendChild(link);
    }
    (async () => {
      const mod: any = await import('leaflet'); const L = mod.default || mod;
      if (cancelled || !mapEl.current || mapRef.current) return;
      Lref.current = L;
      const m = L.map(mapEl.current, { zoomControl: true }).setView([24.45, 54.37], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      markersRef.current = L.layerGroup().addTo(m);
      routesRef.current = L.layerGroup().addTo(m);
      mapRef.current = m; setReady(true);
      setTimeout(() => m.invalidateSize(), 250);
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // sync markers + base + routes
  useEffect(() => {
    const L = Lref.current, m = mapRef.current; if (!L || !m || !ready) return;
    markersRef.current.clearLayers(); routesRef.current.clearLayers();
    if (baseRef.current) { m.removeLayer(baseRef.current); baseRef.current = null; }
    const all: [number, number][] = [];
    for (const l of pts) {
      all.push(l._ll);
      const km = base ? hav(base._ll, l._ll) : 0;
      const mk = L.circleMarker(l._ll, { radius: 8, color: '#fff', weight: 2, fillColor: HEX[STAGE(l)], fillOpacity: .95 })
        .bindPopup(`<b>${l.name || 'Location'}</b><br>${l.type || ''} · ${STAGE(l)}${base && l !== base ? `<br>≈ ${driveMin(km)} min from base` : ''}`);
      markersRef.current.addLayer(mk);
      if (base && l !== base) {
        const line = L.polyline([base._ll, l._ll], { color: HEX.base, weight: 2, dashArray: '5 7', opacity: .7 }).bindTooltip(`≈ ${driveMin(km)} min · ${km.toFixed(1)} km`);
        routesRef.current.addLayer(line);
      }
    }
    if (base) { baseRef.current = L.circleMarker(base._ll, { radius: 11, color: '#fff', weight: 3, fillColor: HEX.base, fillOpacity: 1 }).bindPopup(`<b>◎ Unit base</b><br>${base.name || ''}`).addTo(m); }
    if (all.length) { try { m.fitBounds(all, { padding: [40, 40], maxZoom: 13 }); } catch { /* */ } }
  }, [pts, base, ready]);

  // toggle layers
  useEffect(() => { const m = mapRef.current; if (!m || !ready) return; if (showLoc) markersRef.current.addTo(m); else m.removeLayer(markersRef.current); }, [showLoc, ready]);
  useEffect(() => { const m = mapRef.current; if (!m || !ready) return; if (showRoutes) routesRef.current.addTo(m); else m.removeLayer(routesRef.current); }, [showRoutes, ready]);

  const panTo = (l: any) => { const m = mapRef.current; if (m) m.setView(l._ll, 14, { animate: true }); };

  return (
    <div>
      <style>{STY}</style>
      {pts.length === 0 ? (
        <div className="lm-empty">No locations have map coordinates yet.<br /><span style={{ fontSize: 12 }}>Add latitude/longitude (or a Google Maps link) on a location and it will appear here with routes &amp; drive-times.</span></div>
      ) : (
        <div className="lm-wrap">
          <div className="lm-map" ref={mapEl} />
          <div className="lm-side">
            <div className="lm-card">
              <div className="h">Overlays</div>
              <div className="lm-tg">
                <span className={`lm-t ${showLoc ? 'on' : ''}`} onClick={() => setShowLoc(v => !v)}>Locations</span>
                <span className={`lm-t ${showRoutes ? 'on' : ''}`} onClick={() => setShowRoutes(v => !v)}>Routes</span>
                {['Parking', 'Holding', 'Catering', 'Closure', 'Camera'].map(o => (
                  <span key={o} className={`lm-t soon ${overlays[o] ? 'on' : ''}`} title="Overlay geometry lands with Logistics (M5)" onClick={() => setOverlays(s => ({ ...s, [o]: !s[o] }))}>{o}</span>
                ))}
              </div>
              <div className="lm-leg">
                <span><i style={{ background: HEX.base }} />Base</span><span><i style={{ background: HEX.sourcing }} />Sourcing</span><span><i style={{ background: HEX.clearing }} />Clearing</span><span><i style={{ background: HEX.confirmed }} />Confirmed</span><span><i style={{ background: HEX.wrapped }} />Wrapped</span>
              </div>
            </div>
            <div className="lm-card">
              <div className="h">Locations · drive from base</div>
              {pts.map((l: any) => {
                const km = base ? hav(base._ll, l._ll) : 0;
                return (
                  <div key={l.id} className="lm-row" onClick={() => panTo(l)}>
                    <span className="dot" style={{ background: l === base ? HEX.base : HEX[STAGE(l)] }} />
                    <div className="n"><b>{l.name || 'Location'}{l === base ? ' ◎' : ''}</b><small>{l === base ? 'unit base' : `${driveMin(km)} min · ${km.toFixed(1)} km`}</small></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
