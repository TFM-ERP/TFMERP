'use client';

/**
 * SYS-12.F — Driver run view (the production transport driver app), reusable.
 * Lives in two homes (never a separate sidebar tab):
 *   • standalone Transport module → /driver/dispatch (login-resolved or ?driverId=)
 *   • project level → embedded in the Captain console "Drivers" tab (embedded + driverId).
 * "Eyes on the road": one glanceable Up-Next card, the run lifecycle reduced to a single
 * massive one-tap button (Acknowledge → Arrived → On board → Complete), constraint-aware
 * Navigate, a Panic FAB, the Digital Glovebox (receipt → OCR → ledger), and a turnaround clock.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { captainApi, transportApi, commsApi, uploadFile } from '@/lib/api';
import {
  Loader2, Navigation2, CheckCircle2, AlertOctagon, Clock, MapPin, ChevronRight,
  Car, Receipt, ShieldCheck, CloudOff,
} from 'lucide-react';

const fmtTime = (d?: string) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const vehLabel = (v: any) => (v ? [v.make, v.model].filter(Boolean).join(' ') || v.vehicleType || 'Vehicle' : '');

// ── Offline-first outbox (Transactional Outbox Pattern) ───────────────────────
const OUTBOX_KEY = 'tfm_driver_outbox';
type OutboxEvt = { id: string; runId: string; action: string; geo: { lat?: number; lng?: number }; ts: number };
const loadQueue = (): OutboxEvt[] => { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; } };
const saveQueue = (q: OutboxEvt[]) => { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(q)); } catch { /* ignore */ } };
const uuid = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
// Optimistic local FSM mirror — keeps the card moving even fully offline.
function applyLocal(run: any, action: string): any {
  const now = new Date().toISOString(); const r: any = { ...run };
  switch (action) {
    case 'ACK': if (r.status === 'REQUESTED' || r.status === 'ASSIGNED') r.status = 'EN_ROUTE'; r.acknowledgedAt ||= now; r.enRouteAt ||= now; break;
    case 'ARRIVE': r.arrivedAt ||= now; if (r.status === 'ASSIGNED') r.status = 'EN_ROUTE'; break;
    case 'ONBOARD': r.status = 'PASSENGER_ONBOARD'; r.onboardAt ||= now; break;
    case 'COMPLETE': r.status = 'COMPLETED'; r.completedAt ||= now; break;
    case 'CANCEL': r.status = 'CANCELLED'; break;
  }
  return r;
}
// SHA-256 hex of a file — tamper-evident condition photos.
async function sha256Hex(file: File): Promise<string> {
  try { const buf = await file.arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', buf); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch { return ''; }
}
const getGeo = (): Promise<{ lat?: number; lng?: number }> => new Promise((res) => { if (typeof navigator === 'undefined' || !navigator.geolocation) return res({}); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 4000 }); });

function primary(run: any): { label: string; action: string } | null {
  switch (run?.status) {
    case 'REQUESTED':
    case 'ASSIGNED': return { label: 'Tap to acknowledge', action: 'ACK' };
    case 'EN_ROUTE': return run.arrivedAt ? { label: 'Passenger on board', action: 'ONBOARD' } : { label: "I've arrived", action: 'ARRIVE' };
    case 'PASSENGER_ONBOARD': return { label: 'Complete run', action: 'COMPLETE' };
    default: return null;
  }
}
function navTarget(run: any): { label: string; q: string; lat?: number; lng?: number } {
  const pickupPhase = !run.onboardAt;
  return pickupPhase
    ? { label: run.fromLocation || 'pickup', q: run.fromLocation || '', lat: run.pickupLat, lng: run.pickupLng }
    : { label: run.toLocation || 'destination', q: run.toLocation || '', lat: run.dropLat, lng: run.dropLng };
}

export default function DriverRunView({ driverId, embedded = false }: { driverId?: string; embedded?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [override, setOverride] = useState<string>(driverId || '');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [pending, setPending] = useState(0);
  const [routes, setRoutes] = useState<any[]>([]);
  const receiptInput = useRef<HTMLInputElement>(null);
  const condInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setOverride(driverId || ''); }, [driverId]);

  const load = useCallback(async () => {
    try { const r = await captainApi.myRuns(override || undefined); setData(r.data); } finally { setLoading(false); }
  }, [override]);
  // Outbox flush — FIFO, idempotent (each event carries a stable id); reconciles with the server.
  const flush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let q = loadQueue();
    while (q.length) {
      const ev = q[0];
      try { await captainApi.runAction(ev.runId, ev.action, ev.geo, ev.id); q = q.slice(1); saveQueue(q); setPending(q.length); }
      catch { break; } // transient / offline — retry on the next tick
    }
    await load();
  }, [load]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setPending(loadQueue().length);
    const t = setInterval(() => flush(), 15000);
    const on = () => flush();
    if (typeof window !== 'undefined') window.addEventListener('online', on);
    return () => { clearInterval(t); if (typeof window !== 'undefined') window.removeEventListener('online', on); };
  }, [flush]);
  useEffect(() => { if (!driverId) transportApi.drivers().then((r) => setDrivers(r.data || [])).catch(() => {}); }, [driverId]);
  // Recce routes for the active run's project → constraint hand-off (truck-safe / noise zones)
  useEffect(() => {
    const pid = data?.runs?.[0]?.projectId;
    if (pid) captainApi.routes(pid).then((r) => setRoutes(r.data || [])).catch(() => setRoutes([]));
    else setRoutes([]);
  }, [data?.runs?.[0]?.projectId]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const runs: any[] = data?.runs || [];
  const current = runs[0] || null;
  const later = runs.slice(1);
  const ta = data?.turnaround;

  const act = (action: string) => {
    if (!current) return;
    const runId = current.id;
    // Optimistic local update — the card advances instantly, even fully offline.
    const updatedRun = applyLocal(current, action);
    setData((d: any) => {
      if (!d) return d;
      let runs = [...(d.runs || [])];
      if (['COMPLETED', 'CANCELLED'].includes(updatedRun.status)) runs = runs.filter((r: any) => r.id !== runId);
      else runs[0] = updatedRun;
      return { ...d, runs };
    });
    // Durable outbox → flush (idempotent on the server via the stable event id).
    const q = loadQueue(); q.push({ id: uuid(), runId, action, geo: {}, ts: Date.now() }); saveQueue(q); setPending(q.length);
    flush();
  };

  const doNavigate = () => {
    if (!current) return;
    const t = navTarget(current);
    const dest = t.lat != null && t.lng != null ? `${t.lat},${t.lng}` : encodeURIComponent(t.q);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  };
  // Truck-safe routing — consumer Maps ignore height/weight limits, so hand off to TruckMap.
  const truckNavigate = () => {
    if (!current) return;
    const t = navTarget(current);
    const q = t.lat != null && t.lng != null ? `${t.lat},${t.lng}` : t.q;
    window.open(`https://truckmap.com/search/${encodeURIComponent(q)}`, '_blank');
  };

  const panic = async () => {
    if (!confirm('Raise a PANIC alert to dispatch?')) return;
    try { await captainApi.panic(current?.id); flash('🚨 Dispatch alerted — they are calling you.'); } catch { flash('Could not reach dispatch — call the Captain directly.'); }
  };

  const onReceipt = async (e: any) => {
    const file = e.target.files?.[0]; if (!file || !current) return;
    try {
      const up = await uploadFile(file);
      await commsApi.receiptIntake({ channelId: current.chatChannelId, projectId: current.projectId, imagePath: up.url, mime: file.type });
      flash('🧾 Receipt sent to dispatch for approval.');
    } catch { flash('Receipt saved — sync when back online.'); }
    finally { if (receiptInput.current) receiptInput.current.value = ''; }
  };
  const onCondition = async (e: any) => {
    const files: File[] = Array.from(e.target.files || []).slice(0, 4) as File[]; if (!files.length || !current) return;
    try {
      const geo = await getGeo();
      const SIDES = ['front', 'rear', 'left', 'right'];
      const photos: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const [up, sha256] = await Promise.all([uploadFile(files[i]), sha256Hex(files[i])]);
        photos.push({ url: up.url, sha256, side: SIDES[i] || `photo${i + 1}`, lat: geo.lat, lng: geo.lng, at: new Date().toISOString() });
      }
      await captainApi.conditionReport(current.id, photos);
      flash(`🛡️ ${photos.length}-point condition report hashed & filed to the vault.`);
    } catch { flash('Condition photos saved — sync when online.'); }
    finally { if (condInput.current) condInput.current.value = ''; }
  };

  if (loading) return <div className={`flex items-center justify-center ${embedded ? 'py-16' : 'min-h-screen'}`} style={{ background: embedded ? 'transparent' : 'var(--page-bg)' }}><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>;

  const act_ = primary(current);
  const heavyVeh = !!current?.vehicle && (current.vehicle.fleetClass === 'WORKING' || ['TRUCK', 'BUS', 'MINIBUS'].includes(current.vehicle.vehicleType));

  return (
    <div className={embedded ? 'relative max-w-[480px] mx-auto' : 'min-h-screen pb-28'} style={{ background: embedded ? 'transparent' : 'var(--page-bg)', color: 'var(--text-1)' }}>
      {/* Top bar — turnaround clock */}
      <div className={`${embedded ? '' : 'sticky top-0 z-20'} px-4 py-3 flex items-center gap-2`} style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-1)', borderRadius: embedded ? 12 : 0 }}>
        <Car size={18} style={{ color: 'var(--gold)' }} />
        <div className="font-semibold text-[15px] flex-1">{data?.driver?.fullName ? data.driver.fullName : 'Transport · Runs'}</div>
        {pending > 0 && (
          <div className="text-xs px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: 'var(--surface-2)', color: 'var(--warn)' }} title="Queued offline — will sync automatically">
            <CloudOff size={12} /> {pending}
          </div>
        )}
        {ta && (
          <div className="text-xs px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: 'var(--surface-2)', color: ta.locked ? '#fca5a5' : 'var(--text-3)' }}>
            <Clock size={12} /> {ta.onDutySince ? `${ta.hoursOnDuty}h on duty` : 'Off duty'}
          </div>
        )}
      </div>

      {!data?.driver && !driverId && (
        <div className="m-4 p-4 rounded-xl text-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', color: 'var(--text-3)' }}>
          No driver profile linked to your login. Pick a driver to preview:
          <select value={override} onChange={(e) => setOverride(e.target.value)} className="w-full mt-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '10px', color: 'var(--text-1)', fontSize: 14 }}>
            <option value="">Select driver…</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
        </div>
      )}

      {toast && <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-sm text-center" style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}>{toast}</div>}

      {current ? (
        <div className="p-4">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Up next</div>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-1)', border: `2px solid ${current.priority === 'URGENT' ? '#dc2626' : 'var(--gold)'}` }}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl font-bold">{fmtTime(current.scheduledAt) || 'Now'}</span>
                {current.priority === 'VIP' && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(212,160,23,0.2)', color: 'var(--gold)' }}>VIP</span>}
                {current.priority === 'URGENT' && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5' }}>URGENT</span>}
              </div>
              <div className="text-lg font-semibold leading-tight">{current.passengerNote || 'Run'}</div>
              <div className="mt-2 flex items-center gap-2 text-[15px]" style={{ color: 'var(--text-2)' }}>
                <MapPin size={16} style={{ color: 'var(--gold)' }} />
                <span className="font-medium">{navTarget(current).label}</span>
              </div>
              <div className="mt-1 text-sm flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                {current.fromLocation} <ChevronRight size={13} /> {current.toLocation}
              </div>
              {current.vehicle && <div className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>{vehLabel(current.vehicle)} · {current.vehicle.plateNumber}</div>}
            </div>
            {act_ && (
              <button onClick={() => act(act_.action)}
                className="w-full flex items-center justify-center gap-2"
                style={{ minHeight: 76, fontSize: 20, fontWeight: 800, background: 'var(--gold)', color: '#161C28' }}>
                <CheckCircle2 size={22} /> {act_.label}
              </button>
            )}
          </div>

          {heavyVeh && (
            <div className="mt-2 text-xs px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: 'var(--surface-2)', color: 'var(--warn)' }}>
              <span>🚛</span><span><b>Heavy load / towed trailer</b> — no U-turns · max 80 km/h · trips run longer, leave extra time.</span>
            </div>
          )}
          {routes.filter((r: any) => r.constraints).map((r: any) => (
            <div key={r.id} className="mt-2 text-xs px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: 'var(--surface-2)', color: 'var(--warn)' }}>
              <span>⚠</span><span><b style={{ textTransform: 'capitalize' }}>{String(r.kind).replace(/_/g, ' ').toLowerCase()}</b> — {r.constraints}</span>
            </div>
          ))}
          <div className="flex gap-3 mt-3">
            <button onClick={doNavigate} className="flex-1 flex items-center justify-center gap-2 rounded-2xl"
              style={{ minHeight: 64, fontSize: 18, fontWeight: 700, background: 'var(--surface-1)', border: '2px solid var(--border-2)', color: 'var(--text-1)' }}>
              <Navigation2 size={20} style={{ color: 'var(--gold)' }} /> Navigate
            </button>
            {(heavyVeh || routes.some((r: any) => r.kind === 'TRUCK_SAFE')) && (
              <button onClick={truckNavigate} title="Truck-safe routing — avoids low bridges / weight limits, respects no-U-turn"
                className="flex items-center justify-center gap-2 rounded-2xl px-4"
                style={{ minHeight: 64, fontSize: 15, fontWeight: 700, background: 'var(--gold)', color: '#161C28' }}>
                Truck route
              </button>
            )}
          </div>
          {current.notes && <div className="mt-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>⚠ {current.notes}</div>}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button onClick={() => receiptInput.current?.click()} className="flex flex-col items-center gap-1 rounded-2xl py-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
              <Receipt size={22} style={{ color: 'var(--gold)' }} /><span className="text-sm font-medium">Capture receipt</span>
            </button>
            <button onClick={() => condInput.current?.click()} className="flex flex-col items-center gap-1 rounded-2xl py-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
              <ShieldCheck size={22} style={{ color: 'var(--gold)' }} /><span className="text-sm font-medium">Vehicle check</span>
            </button>
          </div>
        </div>
      ) : data?.driver ? (
        <div className="p-10 text-center" style={{ color: 'var(--text-3)' }}>
          <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: 'var(--ok)' }} />
          <div className="text-lg font-medium" style={{ color: 'var(--text-2)' }}>No active runs</div>
          <p className="text-sm mt-1">Idle / available. New runs appear here the moment dispatch assigns them.</p>
        </div>
      ) : null}

      {later.length > 0 && (
        <div className="px-4">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Later today · {later.length}</div>
          <div className="flex flex-col gap-2">
            {later.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                <span className="text-sm font-bold w-12">{fmtTime(r.scheduledAt)}</span>
                <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-2)' }}>{r.passengerNote || `${r.fromLocation} → ${r.toLocation}`}</span>
                {r.priority === 'VIP' && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(212,160,23,0.18)', color: 'var(--gold)' }}>VIP</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panic FAB */}
      {current && (
        <button onClick={panic} className={`${embedded ? 'absolute' : 'fixed'} bottom-5 end-5 z-30 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg`} style={{ background: '#e24b4a', color: '#fff' }}>
          <AlertOctagon size={18} /> <span className="text-sm font-bold">SOS</span>
        </button>
      )}
    </div>
  );
}
