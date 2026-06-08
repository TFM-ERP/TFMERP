'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { locationLibraryApi } from '@/lib/api';
import { MapPin, History, DollarSign, AlertCircle } from 'lucide-react';

declare global { interface Window { google?: any; markerClusterer?: any; __tfmMapInit?: () => void } }

const CLUSTERER_SRC = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

const money = (n: any) => `AED ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function LocationsMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const clusterer = useRef<any>(null);
  const heatmap = useRef<any>(null);
  const [points, setPoints] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'nokey' | 'error'>('loading');
  const [selected, setSelected] = useState<any>(null);
  const [heatOn, setHeatOn] = useState(false);

  // Load Google Maps JS (with the visualization library for heatmaps) using the key
  // served from backend/.env, plus the MarkerClusterer library for clustering.
  const ensureGoogle = useCallback(async (): Promise<boolean> => {
    if (window.google?.maps) { await loadScript(CLUSTERER_SRC); return true; }
    const { data } = await locationLibraryApi.mapConfig();
    if (!data?.apiKey) { setStatus('nokey'); return false; }
    const ok = await loadScript(`https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=visualization`);
    if (!ok) { setStatus('error'); return false; }
    await loadScript(CLUSTERER_SRC);
    return true;
  }, []);

  useEffect(() => {
    (async () => {
      const [pts, an] = await Promise.all([locationLibraryApi.mapPoints(), locationLibraryApi.analytics()]);
      setPoints(pts.data || []); setAnalytics(an.data);
      const ok = await ensureGoogle();
      if (!ok || !mapRef.current) return;
      const g = window.google;
      const center = (pts.data && pts.data[0]) ? { lat: pts.data[0].lat, lng: pts.data[0].lng } : { lat: 24.4539, lng: 54.3773 }; // Abu Dhabi default
      mapObj.current = new g.maps.Map(mapRef.current, { center, zoom: pts.data?.length ? 7 : 5, mapTypeId: 'hybrid', streetViewControl: false });
      plot(pts.data || []);
      setStatus('ready');
    })().catch(() => setStatus('error'));
  }, [ensureGoogle]); // eslint-disable-line react-hooks/exhaustive-deps

  const plot = (pts: any[]) => {
    const g = window.google; if (!g || !mapObj.current) return;
    markers.current.forEach((m) => m.setMap(null)); markers.current = [];
    if (clusterer.current) { clusterer.current.clearMarkers(); clusterer.current = null; }
    const info = new g.maps.InfoWindow();
    markers.current = pts.map((p) => {
      const m = new g.maps.Marker({ position: { lat: p.lat, lng: p.lng }, title: p.name });
      m.addListener('click', () => {
        setSelected(p);
        info.setContent(`<div style="font-size:13px"><b>${p.name}</b><br/>${p.area || ''}<br/>${p.timesUsed || 0} uses</div>`);
        info.open(mapObj.current, m);
      });
      return m;
    });
    // Cluster markers (falls back to plain markers if the clusterer lib didn't load)
    if (window.markerClusterer?.MarkerClusterer) {
      clusterer.current = new window.markerClusterer.MarkerClusterer({ map: mapObj.current, markers: markers.current });
    } else {
      markers.current.forEach((m) => m.setMap(mapObj.current));
    }
  };

  const toggleHeat = () => {
    const g = window.google; if (!g?.maps?.visualization || !mapObj.current) return;
    const next = !heatOn; setHeatOn(next);
    if (next) {
      // weight each point by usage so frequently-used locations burn hotter
      const data = points.map((p) => ({ location: new g.maps.LatLng(p.lat, p.lng), weight: (p.timesUsed || 0) + 1 }));
      heatmap.current = heatmap.current || new g.maps.visualization.HeatmapLayer({ data, radius: 40, opacity: 0.7 });
      heatmap.current.setData(data);
      heatmap.current.setMap(mapObj.current);
      // hide markers/clusters under the heat layer
      if (clusterer.current) clusterer.current.clearMarkers(); else markers.current.forEach((m) => m.setMap(null));
    } else {
      heatmap.current?.setMap(null);
      if (window.markerClusterer?.MarkerClusterer) clusterer.current = new window.markerClusterer.MarkerClusterer({ map: mapObj.current, markers: markers.current });
      else markers.current.forEach((m) => m.setMap(mapObj.current));
    }
  };

  const focus = (p: any) => {
    setSelected(p);
    if (mapObj.current) { mapObj.current.panTo({ lat: p.lat, lng: p.lng }); mapObj.current.setZoom(13); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><MapPin className="text-[#0f172a]" /> Location Map</h1>
          <p className="text-sm text-gray-500 mt-1">Every mapped library location, clustered. Click a pin or list item to focus.</p>
        </div>
        {status === 'ready' && (
          <button onClick={toggleHeat} className={`text-sm px-3 py-2 rounded-lg border ${heatOn ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-white text-gray-600'}`}>
            {heatOn ? 'Show pins' : 'Heatmap'}
          </button>
        )}
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Mapped locations" value={analytics.withGps} />
          <Stat label="Total library" value={analytics.total} />
          <Stat label="Total spent (all time)" value={money(analytics.totalSpent)} />
          <Stat label="Countries" value={Object.keys(analytics.byCountry || {}).length} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div ref={mapRef} className="w-full h-[560px] rounded-xl border bg-gray-100" />
          {status === 'nokey' && (
            <div className="mt-2 text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" /> No Google Maps key found. Add <code className="mx-1">GOOGLE_MAPS_API_KEY</code> to <code className="mx-1">backend/.env</code> and restart the backend.
            </div>
          )}
          {status === 'error' && <div className="mt-2 text-sm bg-red-50 text-red-700 rounded-lg px-3 py-2">Map failed to load — check the key and its referrer restrictions in Google Cloud Console.</div>}
        </div>

        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b text-xs font-semibold uppercase text-gray-400">Mapped ({points.length})</div>
          <div className="max-h-[520px] overflow-y-auto divide-y">
            {points.map((p) => (
              <button key={p.id} onClick={() => focus(p)} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 ${selected?.id === p.id ? 'bg-[#0f172a]/10' : ''}`}>
                <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {p.thumb ? <img src={p.thumb} alt="" onError={(e) => { const t = e.currentTarget as any; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = `https://picsum.photos/seed/${encodeURIComponent(p.id)}/80/80`; } }} className="w-full h-full object-cover" /> : <MapPin size={14} className="text-gray-300" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 truncate">{p.area || '—'}</div>
                </div>
              </button>
            ))}
            {points.length === 0 && <p className="text-sm text-gray-400 p-4">No locations have GPS coordinates yet. Add lat/lng in the Library.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="bg-white border rounded-xl p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></div>;
}
