'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { rentalApi, driverAppApi } from '@/lib/api';
import { RefreshCw, MapPin, Truck, Zap, Box, Navigation, Check, X, Gauge, Plus } from 'lucide-react';

// Leaflet loaded from CDN on demand (no bundler dependency).
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = LEAFLET_CSS; document.head.appendChild(link);
    }
    let s = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (!s) { s = document.createElement('script'); s.src = LEAFLET_JS; document.body.appendChild(s); }
    s.addEventListener('load', () => resolve((window as any).L));
    s.addEventListener('error', reject);
    if ((window as any).L) resolve((window as any).L);
  });
}

const TILES: Record<string, { url: string; attr: string; label: string }> = {
  osm:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', label: 'Street (free)' },
  sat:    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri', label: 'Satellite (free)' },
  google: { url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attr: '© Google', label: 'Google' },
};
const STATUS_COLOR: Record<string, string> = { ON_LOCATION: '#16A34A', IN_TRANSIT: '#D97706', PLANNED: '#6E7A88', DONE: '#6E7A88' };
const LOC_STATUSES = ['PLANNED', 'IN_TRANSIT', 'ON_LOCATION', 'DONE'];
const unitIcon = (assetType: string, category?: string) => {
  const c = (category || assetType || '').toUpperCase();
  if (c.includes('GENERATOR')) return Zap;
  if (c.includes('VEHICLE') || c.includes('TRUCK') || c.includes('VAN')) return Truck;
  return Box;
};
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

export default function LogisticsCommandPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'map' | 'approvals' | 'incidents' | 'fuel'>('map');
  const [tile, setTile] = useState<keyof typeof TILES>('osm');
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState('');
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // merged-tab data
  const [approvals, setApprovals] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    rentalApi.logistics.overview().then(r => setData(r.data)).catch(() => setData({ summary: {}, hires: [] })).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'approvals') driverAppApi.pending().then(r => setApprovals(r.data || [])).catch(() => setApprovals([]));
    if (tab === 'incidents') rentalApi.incidents.list({ limit: 50 }).then(r => setIncidents(r.data?.items || r.data || [])).catch(() => setIncidents([]));
    if (tab === 'fuel') rentalApi.fuel.list({ limit: 50 }).then(r => setFuel(r.data?.items || r.data || [])).catch(() => setFuel([]));
  }, [tab]);

  const pins = useMemo(() => {
    const out: any[] = [];
    for (const h of (data?.hires || [])) for (const loc of (h.locations || [])) {
      if (loc.lat != null && loc.lng != null) out.push({ ...loc, hire: h });
    }
    return out;
  }, [data]);

  // self-driven units in a hire (candidate tow vehicles + odometer targets)
  const allItems = useMemo(() => {
    const m: any[] = [];
    for (const h of (data?.hires || [])) { for (const loc of (h.locations || [])) for (const u of (loc.units || [])) m.push({ ...u, hireId: h.id }); for (const u of (h.unplaced || [])) m.push({ ...u, hireId: h.id }); }
    return m;
  }, [data]);

  // ── map init + tiles + pins ──
  useEffect(() => {
    let cancelled = false; if (!mapEl.current) return;
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { zoomControl: true }).setView([24.45, 54.37], 7);
      mapRef.current = map; layerRef.current = L.layerGroup().addTo(map);
      tileLayerRef.current = L.tileLayer(TILES[tile].url, { attribution: TILES[tile].attr, maxZoom: 19, subdomains: tile === 'osm' ? ['a','b','c'] : ['mt0','mt1','mt2','mt3'] }).addTo(map);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line
  useEffect(() => {
    const L = (window as any).L; const map = mapRef.current; if (!L || !map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(TILES[tile].url, { attribution: TILES[tile].attr, maxZoom: 19, subdomains: tile === 'osm' ? ['a','b','c'] : ['mt0','mt1','mt2','mt3'] }).addTo(map);
  }, [tile]);
  useEffect(() => {
    const L = (window as any).L; const map = mapRef.current; const group = layerRef.current;
    if (!L || !map || !group || tab !== 'map') return;
    setTimeout(() => map.invalidateSize(), 50);
    group.clearLayers(); const bounds: any[] = [];
    for (const p of pins) {
      const color = STATUS_COLOR[p.status] || '#6E7A88'; const n = (p.units || []).length;
      const html = `<div style="transform:translate(-50%,-100%)"><div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:11px">${n}</span></div></div>`;
      const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ html, className: '', iconSize: [30, 30] }) }).addTo(group);
      m.bindPopup(`<b>${p.siteName || 'Site'}</b><br>${p.hire?.bookingNumber || ''} · ${p.hire?.client?.companyName || ''}<br>${n} unit(s) · ${p.crewCount || 0} crew · ${String(p.status).replace('_',' ')}`);
      bounds.push([p.lat, p.lng]);
    }
    if (focus) map.setView([focus.lat, focus.lng], 12);
    else if (bounds.length) { try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 }); } catch {} }
  }, [pins, focus, tab]);

  // ── actions ──
  const act = async (fn: () => Promise<any>, key: string) => { setBusy(key); try { await fn(); load(); } catch (e: any) { alert(e?.response?.data?.message || 'Action failed.'); } finally { setBusy(''); } };
  const setLocStatus = (id: string, status: string) => act(() => rentalApi.logistics.setLocationStatus(id, status), 'loc' + id);
  const assignUnit = (itemId: string, locId: string | null) => act(() => rentalApi.logistics.assignUnit(itemId, locId), 'u' + itemId);
  const setTow = (itemId: string, towId: string | null) => act(() => rentalApi.logistics.setTow(itemId, towId), 't' + itemId);
  const setPin = async (loc: any) => {
    const raw = prompt('Paste "lat, lng" or a Google Maps link for ' + (loc.siteName || 'this site'), loc.lat != null ? `${loc.lat}, ${loc.lng}` : '');
    if (raw == null) return;
    let lat: number | null = null, lng: number | null = null;
    const at = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || raw.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (at) { lat = parseFloat(at[1]); lng = parseFloat(at[2]); }
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) { alert('Could not read coordinates. Use "25.20, 55.27" or a Google Maps URL with @lat,lng.'); return; }
    const crewStr = prompt('Crew on this site (optional)', loc.crewCount ?? '');
    await act(() => rentalApi.logistics.updateLocation(loc.id, { lat, lng, crewCount: crewStr ? Number(crewStr) : undefined }), 'pin' + loc.id);
  };
  const recordOdo = async (u: any, kind: 'CHECKOUT' | 'RETURN') => {
    const v = prompt(`${kind === 'CHECKOUT' ? 'Check-out' : 'Return'} odometer (km) for ${u.asset?.name}`, '');
    if (v == null || v === '') return;
    await act(() => rentalApi.logistics.recordReading(u.itemId, { kind, odometer: Number(v) }), 'odo' + u.itemId);
  };
  const inspect = async (u: any, type: 'DELIVERY' | 'RETURN') => {
    const fuelLevel = prompt(`${type === 'DELIVERY' ? 'Check-OUT' : 'Check-IN'} inspection for ${u.asset?.name}\nFuel level (e.g. Full, 3/4, 1/2)`, 'Full');
    if (fuelLevel == null) return;
    const damageNotes = prompt('Any new damage? (leave blank if none)', '') || '';
    await act(() => rentalApi.logistics.logInspection(u.itemId, { type, fuelLevel, damageNotes }), 'insp' + u.itemId);
  };
  // any driver across hires with a compliance issue
  const complianceIssues = useMemo(() => {
    const out: any[] = [];
    for (const h of (data?.hires || [])) for (const d of (h.drivers || [])) if ((d.compliance || []).length) out.push({ ...d, hire: h.bookingNumber });
    return out;
  }, [data]);

  const summary = data?.summary || {};
  const tabBtn = (k: typeof tab, label: string, n?: number) => (
    <button onClick={() => setTab(k)} className="px-3.5 py-2 text-[12.5px] relative"
      style={{ color: tab === k ? 'var(--text-1)' : 'var(--text-3)', fontWeight: tab === k ? 700 : 400 }}>
      {label}{n != null && n > 0 ? <span className="ml-1.5 text-[10px] rounded-full px-1.5 font-medium text-white" style={{ background: '#e24b4a' }}>{n}</span> : null}
      {tab === k && <span className="absolute left-2.5 right-2.5 bottom-0 h-[2px] rounded" style={{ background: 'var(--gold)' }} />}
    </button>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Live Operations</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Logistics Command</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{summary.onHire ?? 0} on hire · {(data?.hires || []).reduce((a: number, h: any) => a + (h.locations?.length || 0), 0)} locations{summary.alerts ? <span className="ml-1 font-medium" style={{ color: 'var(--danger)' }}>· {summary.alerts} alert</span> : null}</p>
        </div>
        <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      <div className="flex gap-1 border-b mb-4" style={{ borderColor: 'var(--border-1)' }}>
        {tabBtn('map', 'Live Map & Sites')}{tabBtn('approvals', 'Driver Approvals', approvals.length)}{tabBtn('incidents', 'Incidents')}{tabBtn('fuel', 'Fuel Logs')}
      </div>

      {tab === 'map' && (<>
        {complianceIssues.length > 0 && (
          <div className="rounded-xl border px-3 py-2 mb-3 text-[12px] flex items-center gap-2 flex-wrap" style={{ borderColor: '#F3C8C8', background: '#FBE9E7', color: '#B91C1C' }}>
            <span className="font-semibold">⚠ Dispatch blocked:</span>
            {complianceIssues.map((d, i) => <span key={i}>{d.name} ({d.compliance.join(', ')}) · {d.hire}{i < complianceIssues.length - 1 ? ' ·' : ''}</span>)}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[['On hire', summary.onHire ?? 0, 'var(--text-1)'], ['On location', summary.onLocation ?? 0, '#16A34A'], ['In transit', summary.inTransit ?? 0, '#D97706'], ['Alerts', summary.alerts ?? 0, '#DC2626']].map(([l, v, c]: any) => (
            <div key={l} className="rounded-2xl border bg-white p-3.5" style={{ borderColor: 'var(--border-1)', background: 'var(--surface-1)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{l}</div>
              <div className="text-[22px] font-extrabold" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
          <div className="rounded-2xl border overflow-hidden relative" style={{ borderColor: 'var(--border-1)' }}>
            <div ref={mapEl} style={{ height: 460, width: '100%', background: '#e6eaef' }} />
            <div className="absolute top-3 right-3 z-[500] flex rounded-lg overflow-hidden shadow" style={{ border: '1px solid var(--border-1)' }}>
              {(Object.keys(TILES) as (keyof typeof TILES)[]).map(k => (
                <button key={k} onClick={() => setTile(k)} className="px-2.5 py-1.5 text-[11px] font-semibold" style={tile === k ? { background: '#1C2433', color: '#fff' } : { background: '#fff', color: '#44505F' }}>{TILES[k].label}</button>
              ))}
            </div>
            {pins.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 rounded-xl px-4 py-3 text-center text-sm text-gray-500 shadow"><MapPin size={20} className="mx-auto mb-1 opacity-40" />No located sites yet. Use "set pin" on a site below.</div>
              </div>
            )}
          </div>
          <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
            {(data?.hires || []).flatMap((h: any) => (h.locations || []).map((loc: any) => (
              <div key={loc.id} className="rounded-2xl border p-3" style={{ borderColor: loc.status === 'IN_TRANSIT' ? '#F0D9B5' : 'var(--border-1)', background: 'var(--surface-1)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-[13px] flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}><MapPin size={13} style={{ color: STATUS_COLOR[loc.status] || '#6E7A88' }} /> {loc.siteName || 'Site'}</div>
                  <select value={loc.status} disabled={busy === 'loc' + loc.id} onChange={(e) => setLocStatus(loc.id, e.target.value)}
                    className="text-[10px] font-bold rounded-full px-2 py-0.5 outline-none" style={{ background: (STATUS_COLOR[loc.status] || '#6E7A88') + '22', color: STATUS_COLOR[loc.status] || '#6E7A88', border: 'none' }}>
                    {LOC_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="text-[11px] mb-2" style={{ color: 'var(--text-3)' }}>
                  {h.bookingNumber} · {h.client?.companyName || '—'}{loc.crewCount ? ` · ${loc.crewCount} crew` : ''}
                  <button onClick={() => setPin(loc)} className="ml-2 inline-flex items-center gap-0.5" style={{ color: 'var(--gold)' }}><MapPin size={10} /> {loc.lat != null ? 'edit pin' : 'set pin'}</button>
                  {loc.lat != null && <button onClick={() => setFocus({ lat: loc.lat, lng: loc.lng })} className="ml-2 inline-flex items-center gap-0.5" style={{ color: 'var(--gold)' }}><Navigation size={10} /> locate</button>}
                </div>
                {(loc.units || []).map((u: any) => {
                  const Icon = unitIcon(u.asset?.assetType, u.asset?.category); const towed = !u.asset?.tracksMileage;
                  return (
                    <div key={u.itemId} className="flex items-center gap-1.5 text-[11.5px] py-0.5 flex-wrap" style={{ color: 'var(--text-2)' }}>
                      <Icon size={13} style={{ color: 'var(--text-3)' }} /><span className="truncate">{u.asset?.name}</span>
                      {towed ? <span className="text-[9px] rounded-full px-1.5" style={{ background: '#EDE9FE', color: '#6D28D9' }}>towed</span>
                        : <button onClick={() => recordOdo(u, u.checkoutOdometer == null ? 'CHECKOUT' : 'RETURN')} className="inline-flex items-center gap-0.5 text-[10.5px]" style={{ color: u.milesThisHire != null ? 'var(--text-3)' : 'var(--gold)' }}><Gauge size={10} /> {u.milesThisHire != null ? `${u.milesThisHire.toLocaleString()} km` : (u.checkoutOdometer == null ? 'check-out' : 'return')}</button>}
                      {u.kmPerL != null && <span className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>{u.kmPerL} km/L</span>}
                      {u.excessKm > 0 && <span className="text-[9px] rounded-full px-1.5 font-semibold" style={{ background: '#FBE9E7', color: '#B91C1C' }}>+{u.excessKm.toLocaleString()} km excess</span>}
                      {/* inspection dots */}
                      <button title="Check-out inspection" onClick={() => inspect(u, 'DELIVERY')} className="ml-auto text-[9px] rounded-full px-1.5 font-semibold" style={u.inspectedOut ? { background: '#E7F6EC', color: '#15803D' } : { background: 'var(--surface-2)', color: 'var(--text-3)' }}>{u.inspectedOut ? '✓ out' : '○ out'}</button>
                      <button title="Check-in inspection" onClick={() => inspect(u, 'RETURN')} className="text-[9px] rounded-full px-1.5 font-semibold" style={u.inspectedIn ? { background: '#E7F6EC', color: '#15803D' } : { background: 'var(--surface-2)', color: 'var(--text-3)' }}>{u.inspectedIn ? '✓ in' : '○ in'}</button>
                    </div>
                  );
                })}
                {(loc.units || []).length === 0 && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>No units — assign below.</div>}
              </div>
            )))}
            {/* unplaced units → assign to a site */}
            {(data?.hires || []).filter((h: any) => (h.unplaced || []).length).map((h: any) => (
              <div key={'up' + h.id} className="rounded-2xl border p-3" style={{ borderColor: '#F0D9B5', background: 'var(--surface-1)' }}>
                <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--warn, #D97706)' }}>{h.bookingNumber} — assign units to a site</div>
                {(h.unplaced || []).map((u: any) => (
                  <div key={u.itemId} className="flex items-center gap-2 text-[11.5px] py-0.5" style={{ color: 'var(--text-2)' }}>
                    <Box size={12} style={{ color: 'var(--text-3)' }} /><span className="truncate flex-1">{u.asset?.name}</span>
                    <select disabled={busy === 'u' + u.itemId} onChange={(e) => e.target.value && assignUnit(u.itemId, e.target.value)} defaultValue=""
                      className="text-[10.5px] rounded-md border px-1.5 py-0.5" style={{ borderColor: 'var(--border-1)', background: 'var(--surface-1)', color: 'var(--text-1)' }}>
                      <option value="">→ site…</option>
                      {(h.locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.siteName || 'Site'}</option>)}
                    </select>
                  </div>
                ))}
                {(h.locations || []).length === 0 && <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Add a site to this hire first (in the booking).</div>}
              </div>
            ))}
            {(data?.hires || []).length === 0 && !loading && <div className="rounded-2xl border p-6 text-center text-sm" style={{ borderColor: 'var(--border-1)', color: 'var(--text-3)' }}>No active hires. Dispatch a booking to see it here.</div>}
          </div>
        </div>

        <h2 className="text-[12px] uppercase tracking-[.07em] font-semibold mt-7 mb-2" style={{ color: 'var(--text-3)' }}>Active Hires</h2>
        <div className="space-y-3">
          {(data?.hires || []).map((h: any) => (
            <div key={h.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-1)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#1C2433', color: '#fff' }}>
                <Link href={`/rental/bookings/${h.id}`} className="font-bold text-[13.5px] hover:underline">{h.client?.companyName || h.bookingNumber}</Link>
                <span className="text-[11px] opacity-70">{h.bookingNumber} · {h.locations?.length || 0} locations · {h.drivers?.length || 0} drivers</span>
              </div>
              {(h.locations || []).map((loc: any) => (
                <div key={loc.id} className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--border-1)' }}>
                  <div className="flex items-center gap-2 font-semibold text-[12.5px]" style={{ color: 'var(--text-1)' }}><MapPin size={12} style={{ color: STATUS_COLOR[loc.status] || '#6E7A88' }} /> {loc.siteName || 'Site'} <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmtDate(loc.fromDate)}–{fmtDate(loc.toDate)}</span></div>
                  {(loc.units || []).map((u: any) => {
                    const Icon = unitIcon(u.asset?.assetType, u.asset?.category);
                    return (
                      <div key={u.itemId} className="flex items-center gap-2 text-[11.5px] pl-5 py-0.5" style={{ color: 'var(--text-2)' }}>
                        <Icon size={12} style={{ color: 'var(--text-3)' }} /><Link href={`/rental/assets/${u.asset?.id}`} className="hover:underline">{u.asset?.name}</Link>
                        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{u.asset?.plateNumber || u.asset?.serialNumber || ''}</span>
                        {!u.asset?.tracksMileage ? <span className="text-[9px] rounded-full px-1.5" style={{ background: '#EDE9FE', color: '#6D28D9' }}>towed</span>
                          : <span className="ml-auto text-[10.5px]" style={{ color: 'var(--text-3)' }}>{u.milesThisHire != null ? `${u.milesThisHire.toLocaleString()} km this hire` : 'no readings'}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </>)}

      {/* ── Driver Approvals tab ── */}
      {tab === 'approvals' && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-1)' }}>
          {approvals.length === 0 ? <div className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>Nothing awaiting approval.</div> : (
            <table className="w-full text-sm"><thead><tr style={{ background: 'var(--surface-2)' }}>
              {['Driver', 'Type', 'Amount', 'When', ''].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>)}
            </tr></thead><tbody>
              {approvals.map((s: any) => (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border-1)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-1)' }}>{s.driver?.name || s.driverName || '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-2)' }}>{s.type}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-1)' }}>{s.amount != null ? `AED ${Number(s.amount).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-3)' }}>{fmtDate(s.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button disabled={busy === 'ap' + s.id} onClick={() => act(() => driverAppApi.review(s.id, 'APPROVED'), 'ap' + s.id)} className="text-[12px] text-green-600 hover:underline inline-flex items-center gap-0.5 mr-3"><Check size={13} /> Approve</button>
                    <button disabled={busy === 'ap' + s.id} onClick={() => act(() => driverAppApi.review(s.id, 'REJECTED'), 'ap' + s.id)} className="text-[12px] text-red-500 hover:underline inline-flex items-center gap-0.5"><X size={13} /> Reject</button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}

      {/* ── Incidents tab ── */}
      {tab === 'incidents' && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-1)' }}>
          {incidents.length === 0 ? <div className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No incident reports.</div> : (
            <table className="w-full text-sm"><thead><tr style={{ background: 'var(--surface-2)' }}>
              {['Asset', 'Type', 'Severity', 'Status', 'When'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>)}
            </tr></thead><tbody>
              {incidents.map((it: any) => (
                <tr key={it.id} className="border-t" style={{ borderColor: 'var(--border-1)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-1)' }}>{it.asset?.name || '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-2)' }}>{(it.type || it.incidentType || '').replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-2)' }}>{it.severity || '—'}</td>
                  <td className="px-4 py-2.5"><span className="badge text-[11px]">{(it.status || '').replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-3)' }}>{fmtDate(it.createdAt || it.occurredAt)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}

      {/* ── Fuel Logs tab ── */}
      {tab === 'fuel' && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-1)' }}>
          {fuel.length === 0 ? <div className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No fuel logs.</div> : (
            <table className="w-full text-sm"><thead><tr style={{ background: 'var(--surface-2)' }}>
              {['Asset', 'Litres', 'Cost', 'Odometer', 'When'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>)}
            </tr></thead><tbody>
              {fuel.map((f: any) => (
                <tr key={f.id} className="border-t" style={{ borderColor: 'var(--border-1)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-1)' }}>{f.asset?.name || '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-2)' }}>{f.litres ?? f.liters ?? '—'}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-1)' }}>{f.cost != null ? `AED ${Number(f.cost).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-2)' }}>{f.odometer != null ? `${Number(f.odometer).toLocaleString()} km` : '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-3)' }}>{fmtDate(f.date || f.createdAt)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}
    </div>
  );
}
