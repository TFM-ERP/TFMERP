'use client';

/**
 * SYS-06 — Dispatch board (reusable).
 * Live driver map (Leaflet + OSM, streamed over the /dispatch socket) + geofenced basecamp
 * pins. Two modes:
 *   • standalone (no props) → RENTAL drivers (no project) with a project picker for ad-hoc views.
 *   • embedded <DispatchBoard lockedProjectId={id} /> → locked to one production: only that
 *     project's crew drivers + its basecamp pins. Used inside the project Transport tab.
 * Requires: npm i leaflet (+ -D @types/leaflet)
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { telemetryApi, productionApi } from '@/lib/api';
import { dispatchSocket } from '@/lib/socket';
import { Loader2, RefreshCw, Truck, Radio, Coffee, MapPin, Navigation, Plus, X, Crosshair } from 'lucide-react';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const GOLD = '#b08d4f';

const statusMeta: Record<string, { label: string; hex: string; cssVar: string; icon: any }> = {
  ON_SHIFT: { label: 'On shift', hex: '#16a34a', cssVar: 'var(--ok)', icon: Radio },
  ON_BREAK: { label: 'On break', hex: '#d4a017', cssVar: 'var(--warn)', icon: Coffee },
  OFF_SHIFT: { label: 'Off shift', hex: '#8b8b8b', cssVar: 'var(--text-3)', icon: Truck },
};
const PIN_KINDS = ['BASECAMP', 'CREW_PARKING', 'CATERING', 'UNIT_BASE', 'SET', 'OTHER'];
const kindLabel = (k: string) => String(k).replace(/_/g, ' ').toLowerCase();
const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 16 };
const num = (v: any): number => (v == null ? NaN : Number(v));
const short = (s?: string) => (s ? s.slice(0, 6) : '—');
const ago = (d?: string) => {
  if (!d) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function DispatchBoard({ lockedProjectId }: { lockedProjectId?: string }) {
  const locked = !!lockedProjectId;
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [pickedProject, setPickedProject] = useState<string>('');
  const [pins, setPins] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [pinForm, setPinForm] = useState<any>(null);

  const activeProject = lockedProjectId || pickedProject; // the project whose slate + pins we show

  const mapEl = useRef<HTMLDivElement>(null);
  const Lref = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const trailRef = useRef<any>(null);
  const pinsLayer = useRef<any>(null);
  const fitted = useRef(false);
  const addModeRef = useRef(false);
  const driversRef = useRef<any[]>([]);

  const shownDrivers = activeProject ? drivers.filter((d) => d.projectId === activeProject) : drivers.filter((d) => !d.projectId);
  driversRef.current = shownDrivers;
  addModeRef.current = addMode;

  // 1) Init Leaflet once.
  useEffect(() => {
    let cancelled = false;
    if (!document.querySelector(`link[data-leaflet]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS; link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }
    (async () => {
      const mod: any = await import('leaflet');
      const L = mod.default || mod;
      if (cancelled || !mapEl.current || mapRef.current) return;
      Lref.current = L;
      const m = L.map(mapEl.current).setView([25.2048, 55.2708], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
      m.on('click', (e: any) => { if (addModeRef.current) setPinForm({ lat: e.latlng.lat, lng: e.latlng.lng, kind: 'BASECAMP', label: '', radiusM: 120 }); });
      mapRef.current = m;
      setMapReady(true);
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // projects for the picker (standalone only)
  useEffect(() => {
    if (locked) return;
    productionApi.projects.list().then((r: any) => { const d = r.data; setProjects(Array.isArray(d) ? d : (d?.items || d?.projects || [])); }).catch(() => {});
  }, [locked]);

  // pins + check-ins for the active project
  const loadPins = useCallback(() => {
    if (!activeProject) { setPins([]); setCheckins([]); return; }
    telemetryApi.pins(activeProject).then(setPins).catch(() => setPins([]));
    telemetryApi.checkins(activeProject).then(setCheckins).catch(() => setCheckins([]));
  }, [activeProject]);
  useEffect(() => { loadPins(); const t = setInterval(loadPins, 20000); return () => clearInterval(t); }, [loadPins]);

  // 2) Driver load + realtime + fallback poll.
  const load = useCallback(async () => {
    setRefreshing(true);
    try { setDrivers(await telemetryApi.live()); } finally { setRefreshing(false); setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const s = dispatchSocket();
    s.emit('dispatch:join');
    const onDrivers = (rows: any[]) => setDrivers(rows || []);
    s.on('drivers', onDrivers);
    const t = setInterval(load, 15000);
    return () => { s.off('drivers', onDrivers); clearInterval(t); };
  }, [load]);

  // 3) Sync driver markers.
  useEffect(() => {
    const L = Lref.current, m = mapRef.current;
    if (!L || !m) return;
    const seen = new Set<string>();
    const pts: [number, number][] = [];
    for (const d of shownDrivers) {
      const lat = num(d.lastLat), lng = num(d.lastLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      seen.add(d.id); pts.push([lat, lng]);
      const sm = statusMeta[d.status] || statusMeta.OFF_SHIFT;
      let mk = markers.current.get(d.id);
      if (!mk) {
        mk = L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 2, fillColor: sm.hex, fillOpacity: 1 });
        mk.on('click', () => setSelId((cur: string | null) => (cur === d.id ? null : d.id)));
        mk.addTo(m);
        markers.current.set(d.id, mk);
      } else { mk.setLatLng([lat, lng]); mk.setStyle({ fillColor: sm.hex }); }
      mk.bindPopup(`<b>Driver ${short(d.driverId)}</b><br>${sm.label}${d.vehicleId ? ` · veh ${short(d.vehicleId)}` : ''}<br><span style="color:#888">${ago(d.lastPingAt)}</span>`);
    }
    for (const [id, mk] of markers.current) if (!seen.has(id)) { m.removeLayer(mk); markers.current.delete(id); }
    if (!fitted.current && pts.length) { m.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); fitted.current = true; }
  }, [shownDrivers, mapReady]);

  // 3b) Geofence pins.
  useEffect(() => {
    const L = Lref.current, m = mapRef.current;
    if (!L || !m) return;
    if (!pinsLayer.current) pinsLayer.current = L.layerGroup().addTo(m);
    const layer = pinsLayer.current; layer.clearLayers();
    for (const p of pins) {
      const lat = num(p.lat), lng = num(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      L.circle([lat, lng], { radius: p.radiusM, color: GOLD, weight: 1, fillColor: GOLD, fillOpacity: 0.12 }).addTo(layer);
      L.circleMarker([lat, lng], { radius: 6, color: '#fff', weight: 2, fillColor: GOLD, fillOpacity: 1 })
        .bindPopup(`<b>${p.label}</b><br>${kindLabel(p.kind)} · ${p.radiusM}m`).addTo(layer);
    }
  }, [pins, mapReady]);

  // 4) Selection styling + trail.
  useEffect(() => {
    for (const [id, mk] of markers.current) mk.setStyle?.({ radius: id === selId ? 11 : 8, weight: id === selId ? 3 : 2 });
  }, [selId, shownDrivers, mapReady]);
  useEffect(() => {
    const L = Lref.current, m = mapRef.current;
    if (!L || !m) return;
    if (trailRef.current) { m.removeLayer(trailRef.current); trailRef.current = null; }
    const sel = driversRef.current.find((d) => d.id === selId);
    if (!sel?.driverId) return;
    let alive = true;
    telemetryApi.track({ driverId: sel.driverId, sinceMin: 120 }).then((rows: any[]) => {
      if (!alive || !mapRef.current) return;
      const pts = (rows || []).map((p) => [num(p.lat), num(p.lng)] as [number, number]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (pts.length > 1) trailRef.current = L.polyline(pts, { color: GOLD, weight: 3, opacity: 0.75, dashArray: '4 6' }).addTo(m);
      const la = num(sel.lastLat), ln = num(sel.lastLng);
      if (Number.isFinite(la) && Number.isFinite(ln)) m.panTo([la, ln]);
    }).catch(() => {});
    return () => { alive = false; };
  }, [selId, mapReady]);

  const focus = (d: any) => {
    setSelId((cur) => (cur === d.id ? null : d.id));
    const m = mapRef.current, la = num(d.lastLat), ln = num(d.lastLng);
    if (m && Number.isFinite(la) && Number.isFinite(ln)) m.setView([la, ln], Math.max(m.getZoom(), 13));
  };
  const savePin = async () => {
    if (!pinForm || !activeProject || !pinForm.label.trim()) return;
    try { await telemetryApi.createPin({ projectId: activeProject, kind: pinForm.kind, label: pinForm.label.trim(), lat: pinForm.lat, lng: pinForm.lng, radiusM: Number(pinForm.radiusM) || 120 }); setPinForm(null); setAddMode(false); loadPins(); }
    catch { /* ignore */ }
  };
  const deletePin = async (id: string) => { try { await telemetryApi.removePin(id); loadPins(); } catch { /* ignore */ } };

  const onShift = shownDrivers.filter((d) => d.status === 'ON_SHIFT').length;

  return (
    <div className={locked ? '' : 'p-6'} style={{ color: 'var(--text-1)' }}>
      <div className={locked ? '' : 'max-w-[1280px] mx-auto'}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <h1 className="text-2xl font-semibold">{locked ? 'Live dispatch' : 'Dispatch'}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
              {locked ? "This production's crew drivers + basecamp pins, live." : 'Standalone rental dispatch — pick a project to see its drivers + basecamp pins.'}
            </p>
          </div>
          {!locked && (
            <select value={pickedProject} onChange={(e) => { setPickedProject(e.target.value); setAddMode(false); setPinForm(null); }}
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 9, padding: '7px 10px', color: 'var(--text-1)', fontSize: 13 }}>
              <option value="">Rentals · standalone</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title || p.projectNumber || p.id}</option>)}
            </select>
          )}
          {activeProject && (
            <button onClick={() => { setAddMode((v) => !v); setPinForm(null); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 600, background: addMode ? 'var(--gold)' : 'var(--surface-2)', color: addMode ? '#161C28' : 'var(--text-2)', border: '1px solid var(--border-2)' }}>
              <Plus size={14} /> {addMode ? 'Click map to place' : 'Add pin'}
            </button>
          )}
          <button onClick={load} title="Refresh now" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-2)', borderRadius: 9, padding: '7px 10px', color: 'var(--text-2)', fontSize: 13 }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'On shift', value: onShift, color: 'var(--ok)' },
            { label: 'On break', value: shownDrivers.filter((d) => d.status === 'ON_BREAK').length, color: 'var(--warn)' },
            { label: 'Tracked now', value: shownDrivers.length, color: 'var(--gold)' },
            { label: 'Basecamp pins', value: pins.length, color: 'var(--text-1)' },
          ].map((k) => (
            <div key={k.label} style={{ ...card, padding: '14px 16px' }}>
              <div className="text-2xl font-semibold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr minmax(0,320px)' }}>
          {/* Map */}
          <div style={{ ...card, overflow: 'hidden', position: 'relative' }}>
            <div ref={mapEl} style={{ height: 560, width: '100%', background: 'var(--surface-2)', cursor: addMode ? 'crosshair' : '' }} />
            {(!mapReady || loading) && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--surface-1)', opacity: 0.85 }}>
                <Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} />
              </div>
            )}
            {pinForm && (
              <div className="absolute z-[1000] top-3 start-3 end-3 sm:right-auto sm:w-72" style={{ ...card, padding: 12 }}>
                <div className="flex items-center gap-2 mb-2"><Crosshair size={14} style={{ color: 'var(--gold)' }} /><span className="text-sm font-semibold flex-1">New pin</span><button onClick={() => setPinForm(null)} style={{ color: 'var(--text-3)' }}><X size={15} /></button></div>
                <div className="flex flex-col gap-2">
                  <select value={pinForm.kind} onChange={(e) => setPinForm({ ...pinForm, kind: e.target.value })} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-1)', fontSize: 13 }}>
                    {PIN_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
                  </select>
                  <input autoFocus placeholder="Label (e.g. Basecamp — North lot)" value={pinForm.label} onChange={(e) => setPinForm({ ...pinForm, label: e.target.value })}
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-1)', fontSize: 13 }} />
                  <label className="text-xs flex items-center gap-2" style={{ color: 'var(--text-3)' }}>Radius
                    <input type="number" value={pinForm.radiusM} onChange={(e) => setPinForm({ ...pinForm, radiusM: e.target.value })} style={{ width: 70, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '6px 8px', color: 'var(--text-1)', fontSize: 13 }} /> m
                  </label>
                  <button onClick={savePin} style={{ background: 'var(--gold)', color: '#161C28', borderRadius: 8, padding: '8px', fontWeight: 600, fontSize: 13 }}>Drop pin</button>
                </div>
              </div>
            )}
            {mapReady && !loading && shownDrivers.length === 0 && !pinForm && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center px-6 py-4 rounded-xl" style={{ ...card, color: 'var(--text-3)' }}>
                <MapPin size={26} className="mx-auto mb-2" />
                <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{activeProject ? 'No drivers on shift for this production' : 'No rental drivers on shift'}</div>
                <p className="text-xs mt-1 max-w-[260px]">{activeProject ? 'Project drivers appear here live; drop basecamp pins above.' : 'Rental drivers appear here live. Pick a project above to see its slate.'}</p>
              </div>
            )}
          </div>

          {/* Right column: drivers + pins/arrivals */}
          <div className="flex flex-col gap-4" style={{ maxHeight: 620 }}>
            <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: activeProject ? '1 1 0' : '1 1 auto', minHeight: 0 }}>
              <div className="px-4 py-3 text-sm font-semibold" style={{ borderBottom: '1px solid var(--border-1)' }}>Drivers</div>
              <div className="overflow-y-auto">
                {shownDrivers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-3)' }}>None on shift.</div>
                ) : shownDrivers.map((d) => {
                  const sm = statusMeta[d.status] || statusMeta.OFF_SHIFT; const Icon = sm.icon; const on = d.id === selId;
                  return (
                    <button key={d.id} onClick={() => focus(d)} className="w-full text-start flex items-center gap-3 px-4 py-3 transition-colors"
                      style={{ borderBottom: '1px solid var(--border-1)', background: on ? 'var(--surface-2)' : 'transparent', borderLeft: `2px solid ${on ? 'var(--gold)' : 'transparent'}` }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sm.cssVar, flexShrink: 0 }}><Icon size={16} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">Driver {short(d.driverId)}</div>
                        <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
                          <span style={{ color: sm.cssVar }}>{sm.label}</span>
                          {d.vehicleId && <span className="inline-flex items-center gap-1"><Truck size={11} /> {short(d.vehicleId)}</span>}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{ago(d.lastPingAt)}</div>
                        {on && <div className="text-[10px] inline-flex items-center gap-1 mt-0.5" style={{ color: 'var(--gold)' }}><Navigation size={10} /> trail</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeProject && (
              <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
                <div className="px-4 py-3 text-sm font-semibold flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <MapPin size={14} style={{ color: 'var(--gold)' }} /> Pins &amp; arrivals
                </div>
                <div className="overflow-y-auto">
                  {pins.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 px-4 py-2 text-sm" style={{ borderBottom: '1px solid var(--border-1)' }}>
                      <span className="flex-1 truncate"><span className="font-medium">{p.label}</span> <span className="text-xs" style={{ color: 'var(--text-3)' }}>· {kindLabel(p.kind)} · {p.radiusM}m</span></span>
                      <button onClick={() => deletePin(p.id)} title="Remove" style={{ color: 'var(--text-3)' }}><X size={14} /></button>
                    </div>
                  ))}
                  {pins.length === 0 && <div className="px-4 py-4 text-xs" style={{ color: 'var(--text-3)' }}>No pins yet — “Add pin”, then click the map.</div>}
                  {checkins.length > 0 && <div className="px-4 pt-3 pb-1 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Recent arrivals</div>}
                  {checkins.map((c) => (
                    <div key={c.id} className="px-4 py-2 text-xs" style={{ borderBottom: '1px solid var(--border-1)', color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--ok)' }}>●</span> Driver {short(c.driverId)} → {c.pin?.label || 'pin'} <span style={{ color: 'var(--text-3)' }}>· {ago(c.at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
