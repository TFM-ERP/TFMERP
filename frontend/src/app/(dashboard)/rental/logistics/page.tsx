'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { rentalApi } from '@/lib/api';
import { RefreshCw, MapPin, Truck, Zap, Box, User, Users, AlertTriangle, Navigation } from 'lucide-react';

// Leaflet is loaded from CDN on demand (no bundler dependency).
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
  osm:   { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', label: 'Street (free)' },
  sat:   { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri', label: 'Satellite (free)' },
  google:{ url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attr: '© Google', label: 'Google' },
};

const STATUS_COLOR: Record<string, string> = { ON_LOCATION: '#16A34A', IN_TRANSIT: '#D97706', PLANNED: '#6E7A88', DONE: '#6E7A88' };
const unitIcon = (assetType: string, category?: string) => {
  const c = (category || assetType || '').toUpperCase();
  if (c.includes('GENERATOR')) return Zap;
  if (c.includes('VEHICLE') || c.includes('TRUCK') || c.includes('VAN')) return Truck;
  if (c.includes('TRAILER') || c.includes('CARAVAN') || c.includes('OFFICE')) return Box;
  return Box;
};

export default function LogisticsCommandPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tile, setTile] = useState<keyof typeof TILES>('osm');
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement; const sync = () => setIsDark(root.classList.contains('dark'));
    sync(); const mo = new MutationObserver(sync); mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    rentalApi.logistics.overview().then(r => setData(r.data)).catch(() => setData({ summary: {}, hires: [] })).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // All located sites (with coords) across every hire — the map pins.
  const pins = useMemo(() => {
    const out: any[] = [];
    for (const h of (data?.hires || [])) for (const loc of (h.locations || [])) {
      if (loc.lat != null && loc.lng != null) out.push({ ...loc, hire: h });
    }
    return out;
  }, [data]);

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    if (!mapEl.current) return;
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView([24.45, 54.37], 7); // UAE default
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      tileLayerRef.current = L.tileLayer(TILES[tile].url, { attribution: TILES[tile].attr, maxZoom: 19, subdomains: tile === 'osm' ? ['a','b','c'] : ['mt0','mt1','mt2','mt3'] }).addTo(map);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Swap tile layer when provider changes.
  useEffect(() => {
    const L = (window as any).L; const map = mapRef.current;
    if (!L || !map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(TILES[tile].url, { attribution: TILES[tile].attr, maxZoom: 19, subdomains: tile === 'osm' ? ['a','b','c'] : ['mt0','mt1','mt2','mt3'] }).addTo(map);
  }, [tile]);

  // Render pins when data changes.
  useEffect(() => {
    const L = (window as any).L; const map = mapRef.current; const group = layerRef.current;
    if (!L || !map || !group) return;
    group.clearLayers();
    const bounds: any[] = [];
    for (const p of pins) {
      const color = STATUS_COLOR[p.status] || '#6E7A88';
      const n = (p.units || []).length;
      const html = `<div style="transform:translate(-50%,-100%)"><div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:11px">${n}</span></div></div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [30, 30] });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(group);
      m.bindPopup(`<b>${p.siteName || 'Site'}</b><br>${p.hire?.bookingNumber || ''} · ${p.hire?.client?.companyName || ''}<br>${n} unit(s) · ${p.crewCount || 0} crew · ${String(p.status).replace('_',' ')}`);
      bounds.push([p.lat, p.lng]);
    }
    if (focus) { map.setView([focus.lat, focus.lng], 12); }
    else if (bounds.length) { try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 }); } catch {} }
  }, [pins, focus]);

  const summary = data?.summary || {};
  const card = 'rounded-2xl border bg-white p-3.5';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Marquee */}
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Live Operations</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Logistics Command</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {summary.onHire ?? 0} on hire · {(data?.hires || []).reduce((a: number, h: any) => a + (h.locations?.length || 0), 0)} locations
            {summary.alerts ? <span className="ml-1 font-medium" style={{ color: 'var(--danger)' }}>· {summary.alerts} alert</span> : null}
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[['On hire', summary.onHire ?? 0, 'var(--text-1)'], ['On location', summary.onLocation ?? 0, '#16A34A'], ['In transit', summary.inTransit ?? 0, '#D97706'], ['Alerts', summary.alerts ?? 0, '#DC2626']].map(([l, v, c]: any) => (
          <div key={l} className={card} style={{ borderColor: 'var(--border-1)' }}>
            <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{l}</div>
            <div className="text-[22px] font-extrabold" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
        {/* Map */}
        <div className="rounded-2xl border overflow-hidden relative" style={{ borderColor: 'var(--border-1)' }}>
          <div ref={mapEl} style={{ height: 460, width: '100%', background: '#e6eaef' }} />
          <div className="absolute top-3 right-3 z-[500] flex rounded-lg overflow-hidden shadow" style={{ border: '1px solid var(--border-1)' }}>
            {(Object.keys(TILES) as (keyof typeof TILES)[]).map(k => (
              <button key={k} onClick={() => setTile(k)}
                className="px-2.5 py-1.5 text-[11px] font-semibold"
                style={tile === k ? { background: '#1C2433', color: '#fff' } : { background: '#fff', color: '#44505F' }}>
                {TILES[k].label}
              </button>
            ))}
          </div>
          {pins.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 rounded-xl px-4 py-3 text-center text-sm text-gray-500 shadow">
                <MapPin size={20} className="mx-auto mb-1 opacity-40" />
                No located sites yet. Add coordinates to a hire's sites to see them here.
              </div>
            </div>
          )}
        </div>

        {/* Location roll-up */}
        <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
          {(data?.hires || []).flatMap((h: any) => (h.locations || []).map((loc: any) => (
            <div key={loc.id} className="rounded-2xl border p-3" style={{ borderColor: loc.status === 'IN_TRANSIT' ? '#F0D9B5' : 'var(--border-1)', background: 'var(--surface-1)' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-[13px] flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}>
                  <MapPin size={13} style={{ color: STATUS_COLOR[loc.status] || '#6E7A88' }} /> {loc.siteName || 'Site'}
                </div>
                <span className="text-[9.5px] font-bold rounded-full px-2 py-0.5" style={{ background: (STATUS_COLOR[loc.status] || '#6E7A88') + '22', color: STATUS_COLOR[loc.status] || '#6E7A88' }}>
                  {String(loc.status).replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] mb-2" style={{ color: 'var(--text-3)' }}>
                {h.bookingNumber} · {h.client?.companyName || '—'}{loc.crewCount ? ` · ${loc.crewCount} crew` : ''}
                {loc.lat != null && <button onClick={() => setFocus({ lat: loc.lat, lng: loc.lng })} className="ml-2 text-[11px] inline-flex items-center gap-0.5" style={{ color: 'var(--gold)' }}><Navigation size={10} /> locate</button>}
              </div>
              {(loc.units || []).map((u: any) => {
                const Icon = unitIcon(u.asset?.assetType, u.asset?.category);
                const towed = !u.asset?.tracksMileage;
                return (
                  <div key={u.itemId} className="flex items-center gap-2 text-[11.5px] py-0.5" style={{ color: 'var(--text-2)' }}>
                    <Icon size={13} style={{ color: 'var(--text-3)' }} />
                    <span className="truncate">{u.asset?.name}</span>
                    {towed
                      ? <span className="text-[9px] rounded-full px-1.5" style={{ background: '#EDE9FE', color: '#6D28D9' }}>towed</span>
                      : <span className="ml-auto text-[10.5px]" style={{ color: 'var(--text-3)' }}>{u.milesThisHire != null ? `${u.milesThisHire.toLocaleString()} km` : '—'}</span>}
                  </div>
                );
              })}
              {(loc.units || []).length === 0 && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>No units assigned.</div>}
            </div>
          )))}
          {(data?.hires || []).length === 0 && !loading && (
            <div className="rounded-2xl border p-6 text-center text-sm" style={{ borderColor: 'var(--border-1)', color: 'var(--text-3)' }}>
              No active hires. Confirm a booking and dispatch it to see it here.
            </div>
          )}
        </div>
      </div>

      {/* Active Hires tree */}
      <h2 className="text-[12px] uppercase tracking-[.07em] font-semibold mt-7 mb-2" style={{ color: 'var(--text-3)' }}>Active Hires</h2>
      <div className="space-y-3">
        {(data?.hires || []).map((h: any) => (
          <div key={h.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-1)' }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'var(--char, #1C2433)', color: '#fff' }}>
              <Link href={`/rental/bookings/${h.id}`} className="font-bold text-[13.5px] hover:underline">{h.client?.companyName || h.bookingNumber}</Link>
              <span className="text-[11px] opacity-70">{h.bookingNumber} · {h.locations?.length || 0} locations · {h.drivers?.length || 0} drivers</span>
            </div>
            {(h.locations || []).map((loc: any) => (
              <div key={loc.id} className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--border-1)' }}>
                <div className="flex items-center gap-2 font-semibold text-[12.5px]" style={{ color: 'var(--text-1)' }}>
                  <MapPin size={12} style={{ color: STATUS_COLOR[loc.status] || '#6E7A88' }} /> {loc.siteName || 'Site'}
                  <span className="text-[9.5px] font-bold rounded-full px-2" style={{ background: (STATUS_COLOR[loc.status] || '#6E7A88') + '22', color: STATUS_COLOR[loc.status] || '#6E7A88' }}>{String(loc.status).replace('_', ' ')}</span>
                </div>
                {(loc.units || []).map((u: any) => {
                  const Icon = unitIcon(u.asset?.assetType, u.asset?.category);
                  return (
                    <div key={u.itemId} className="flex items-center gap-2 text-[11.5px] pl-5 py-0.5" style={{ color: 'var(--text-2)' }}>
                      <Icon size={12} style={{ color: 'var(--text-3)' }} />
                      <Link href={`/rental/assets/${u.asset?.id}`} className="hover:underline">{u.asset?.name}</Link>
                      <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{u.asset?.plateNumber || u.asset?.serialNumber || ''}</span>
                      {!u.asset?.tracksMileage
                        ? <span className="text-[9px] rounded-full px-1.5" style={{ background: '#EDE9FE', color: '#6D28D9' }}>towed</span>
                        : <span className="ml-auto text-[10.5px]" style={{ color: 'var(--text-3)' }}>{u.milesThisHire != null ? `${u.milesThisHire.toLocaleString()} km this hire` : 'no readings'}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            {(h.unplaced || []).length > 0 && (
              <div className="px-4 py-2 border-t text-[11px]" style={{ borderColor: 'var(--border-1)', color: 'var(--warn, #D97706)' }}>
                {h.unplaced.length} unit(s) not yet assigned to a location
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
