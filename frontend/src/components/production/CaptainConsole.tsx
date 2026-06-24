'use client';

/**
 * SYS-12.F — Transport Captain console (web operations cockpit), scoped to one production.
 * Four work surfaces over the same spine:
 *   Dispatch (Kanban FSM) · Map (live command map) · Garage (fleet + return countdown) · Crew (HOS).
 * The Dispatch board mirrors the driver-app one-tap FSM 1:1 and enforces the turnaround lockout
 * on assignment. Token-styled (Graphite & Gold) so it flips with the theme.
 */
import { useEffect, useState, useCallback } from 'react';
import { captainApi, transportApi } from '@/lib/api';
import DispatchBoard from './DispatchBoard';
import DriverRunView from './DriverRunView';
import {
  Loader2, RefreshCw, CalendarDays, Wand2, AlertTriangle, X, Truck, UserRound, Clock,
  CheckCircle2, Navigation, MapPin, Wrench, Car, Users, Lock, ChevronRight, Radio,
} from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 14 };
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (d?: string) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const fmtClock = (d?: string | null) => (d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const vehLabel = (v: any) => (v ? [v.make, v.model].filter(Boolean).join(' ') || v.vehicleType || 'Vehicle' : '');

const COL_TINT: Record<string, string> = {
  UNASSIGNED: 'var(--text-3)', DISPATCHED: '#6aa3ff', EN_ROUTE: 'var(--gold)', ONBOARD: '#34d399', COMPLETED: 'var(--ok)',
};
const FLEET_META: Record<string, { label: string; icon: any; hex: string }> = {
  WORKING: { label: 'Working fleet', icon: Wrench, hex: '#c98b2e' },
  PASSENGER: { label: 'Passenger fleet', icon: Users, hex: '#6aa3ff' },
  PICTURE: { label: 'Picture cars', icon: Car, hex: '#a78bfa' },
  OTHER: { label: 'Other', icon: Truck, hex: 'var(--text-3)' },
};
type Tab = 'dispatch' | 'map' | 'garage' | 'crew';

export default function CaptainConsole({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<Tab>('dispatch');
  const [date, setDate] = useState(todayStr());
  const [board, setBoard] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [assign, setAssign] = useState<any>(null); // { run, driverId, vehicleId, error, force }
  const [garage, setGarage] = useState<any>(null);
  const [toast, setToast] = useState<string>('');
  const [openDriver, setOpenDriver] = useState<any>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await captainApi.board({ projectId, date });
      setBoard(r.data);
    } finally { setBusy(false); setLoading(false); }
  }, [projectId, date]);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { transportApi.vehicles({ projectId }).then((r) => setVehicles(r.data || [])).catch(() => {}); }, [projectId]);
  useEffect(() => { if (tab === 'garage') captainApi.garage(projectId).then((r) => setGarage(r.data)).catch(() => {}); }, [tab, projectId, board]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const act = async (runId: string, action: string) => {
    try { await captainApi.runAction(runId, action); await load(); } catch (e: any) { flash(e?.response?.data?.message || 'Action failed'); }
  };
  const doAssign = async () => {
    if (!assign?.run || !assign.driverId || !assign.vehicleId) { setAssign({ ...assign, error: 'Pick a driver and a vehicle.' }); return; }
    try {
      await captainApi.assign(assign.run.id, { driverId: assign.driverId, vehicleId: assign.vehicleId, force: !!assign.force });
      setAssign(null); await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Assign failed';
      setAssign({ ...assign, error: msg, lockHit: /turnaround/i.test(msg) });
    }
  };
  const syncCallSheet = async () => {
    setBusy(true);
    try { const r = await captainApi.syncCallSheet({ projectId, date }); flash(`Call-sheet sync: ${r.data.created} run(s) created, ${r.data.skipped} skipped.`); await load(); }
    catch (e: any) { flash(e?.response?.data?.message || 'No call sheet for that date.'); }
    finally { setBusy(false); }
  };
  const wrapDriver = async (id: string) => { try { await captainApi.wrapDriver(id); await load(); } catch { /* ignore */ } };

  const hos: any[] = board?.hos || [];
  const hosById = Object.fromEntries(hos.map((d) => [d.id, d]));

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>;

  return (
    <div style={{ color: 'var(--text-1)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Navigation size={18} style={{ color: 'var(--gold)' }} /> Transport Captain</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Dispatch, fleet and driver compliance for this production.</p>
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ ...card, padding: '6px 10px' }}>
          <CalendarDays size={14} style={{ color: 'var(--text-3)' }} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-1)', fontSize: 13, border: 'none', outline: 'none' }} />
        </label>
        <button onClick={syncCallSheet} disabled={busy} title="Generate hotel-pickup runs from today's cast call times"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '8px 12px', fontSize: 13, fontWeight: 600, background: 'var(--gold)', color: '#161C28' }}>
          <Wand2 size={14} /> Sync call sheet
        </button>
        <button onClick={load} title="Refresh" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-2)', borderRadius: 9, padding: '8px 10px', color: 'var(--text-2)', fontSize: 13 }}>
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {board?.urgent > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5' }}>
          <AlertTriangle size={15} /> {board.urgent} urgent run{board.urgent > 1 ? 's' : ''} waiting — wrapped talent needs a car.
        </div>
      )}
      {toast && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ ...card, color: 'var(--text-2)' }}>{toast}</div>}

      {/* Sub-tab nav */}
      <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: 'var(--border-1)' }}>
        {([['dispatch', 'Dispatch', Radio], ['map', 'Map', MapPin], ['garage', 'Garage', Truck], ['crew', 'Drivers', Clock]] as [Tab, string, any][]).map(([k, lbl, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className="px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
            style={{ color: tab === k ? 'var(--text-1)' : 'var(--text-3)', borderBottom: `2px solid ${tab === k ? 'var(--gold)' : 'transparent'}`, marginBottom: -1 }}>
            <Icon size={14} /> {lbl}
            {k === 'crew' && hos.some((d) => d.locked) && <span style={{ width: 6, height: 6, borderRadius: 99, background: '#dc2626' }} />}
          </button>
        ))}
      </div>

      {/* ── Dispatch (Kanban) ── */}
      {tab === 'dispatch' && (
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: 420 }}>
          {(board?.columns || []).map((col: any) => (
            <div key={col.key} className="flex-shrink-0" style={{ width: 280 }}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span style={{ width: 8, height: 8, borderRadius: 99, background: COL_TINT[col.key] || 'var(--text-3)' }} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{col.runs.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {col.runs.map((run: any) => <RunCard key={run.id} run={run} onAssign={() => setAssign({ run, driverId: run.driver?.id || '', vehicleId: run.vehicle?.id || '', error: '', force: false })} onAct={act} />)}
                {col.runs.length === 0 && <div className="text-xs px-2 py-6 text-center rounded-lg" style={{ border: '1px dashed var(--border-2)', color: 'var(--text-3)' }}>—</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Map ── */}
      {tab === 'map' && (
        <div className="flex flex-col gap-4">
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}><DispatchBoard lockedProjectId={projectId} /></div>
          <RoutesPanel projectId={projectId} />
        </div>
      )}

      {/* ── Garage ── */}
      {tab === 'garage' && (
        <div>
          {garage?.dueSoon?.length > 0 && (
            <div className="mb-4" style={{ ...card, padding: 14 }}>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><Clock size={15} style={{ color: 'var(--warn)' }} /> Rental returns due soon</div>
              <div className="flex flex-col gap-1.5">
                {garage.dueSoon.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm">
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: v.hoursLeft <= 24 ? 'rgba(220,38,38,0.15)' : 'rgba(212,160,23,0.15)', color: v.hoursLeft <= 24 ? '#fca5a5' : 'var(--warn)' }}>
                      {v.hoursLeft <= 0 ? 'OVERDUE' : `${v.hoursLeft}h`}
                    </span>
                    <span className="font-medium">{v.label}</span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{v.plate} · {v.supplier || 'rental'} → {v.returnLocation || 'depot'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {['WORKING', 'PASSENGER', 'PICTURE', 'OTHER'].map((cls) => {
              const meta = FLEET_META[cls]; const Icon = meta.icon; const list = garage?.byClass?.[cls] || [];
              return (
                <div key={cls} style={{ ...card, padding: 12 }}>
                  <div className="flex items-center gap-2 mb-2"><Icon size={15} style={{ color: meta.hex }} /><span className="text-sm font-semibold flex-1">{meta.label}</span><span className="text-xs" style={{ color: 'var(--text-3)' }}>{list.length}</span></div>
                  {list.length === 0 ? <div className="text-xs py-3 text-center" style={{ color: 'var(--text-3)' }}>None</div> : list.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderTop: '1px solid var(--border-1)' }}>
                      <span className="flex-1 truncate">{vehLabel(v)} <span className="text-xs" style={{ color: 'var(--text-3)' }}>{v.plateNumber}</span></span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: v.status === 'AVAILABLE' ? 'var(--ok)' : 'var(--text-3)' }}>{(v.status || '').toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Drivers (roster + HOS + per-driver run view) ── */}
      {tab === 'crew' && (openDriver ? (
        <div>
          <button onClick={() => setOpenDriver(null)} className="mb-3 inline-flex items-center gap-1 text-sm" style={{ color: 'var(--text-3)' }}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> All drivers
          </button>
          <DriverRunView driverId={openDriver.id} embedded />
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div className="px-4 py-2.5 text-xs uppercase tracking-wide" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border-1)' }}>Drivers · turnaround / hours of service</div>
          {hos.length === 0 && <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No drivers.</div>}
          {hos.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-1)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.locked ? '#dc2626' : 'var(--ok)' }}>
                {d.locked ? <Lock size={15} /> : <UserRound size={15} />}
              </div>
              <button onClick={() => setOpenDriver(d)} className="flex-1 min-w-0 text-start">
                <div className="text-sm font-medium truncate">{d.fullName}</div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {d.locked ? <span style={{ color: '#fca5a5' }}>Resting — cleared {fmtClock(d.nextAvailableAt)}</span> : <span style={{ color: 'var(--ok)' }}>Available</span>}
                  {d.onDutySince && <span> · {d.hoursOnDuty}h on duty</span>}
                </div>
              </button>
              <button onClick={() => setOpenDriver(d)} title="Open driver run view" style={{ fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 8, padding: '5px 9px', color: 'var(--text-2)' }}>Run view</button>
              <button onClick={() => wrapDriver(d.id)} title="End duty day (starts the turnaround clock)" style={{ fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 8, padding: '5px 9px', color: 'var(--text-2)' }}>Wrap</button>
            </div>
          ))}
        </div>
      ))}

      {/* Assign modal */}
      {assign && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setAssign(null)}>
          <div style={{ ...card, width: 420, maxWidth: '100%', padding: 18 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3"><Navigation size={16} style={{ color: 'var(--gold)' }} /><span className="font-semibold flex-1">Assign run</span><button onClick={() => setAssign(null)} style={{ color: 'var(--text-3)' }}><X size={16} /></button></div>
            <div className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
              {fmtTime(assign.run.scheduledAt)} · {assign.run.fromLocation || '?'} <ChevronRight size={12} className="inline" /> {assign.run.toLocation || '?'}
              {assign.run.passengerNote && <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{assign.run.passengerNote}</div>}
            </div>
            <label className="text-xs" style={{ color: 'var(--text-3)' }}>Driver</label>
            <select value={assign.driverId} onChange={(e) => setAssign({ ...assign, driverId: e.target.value, error: '' })}
              className="w-full mb-3 mt-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 10px', color: 'var(--text-1)', fontSize: 13 }}>
              <option value="">Select driver…</option>
              {hos.map((d) => <option key={d.id} value={d.id}>{d.locked ? '🔒 ' : ''}{d.fullName}{d.locked ? ` (rested ${fmtClock(d.nextAvailableAt)})` : ''}</option>)}
            </select>
            <label className="text-xs" style={{ color: 'var(--text-3)' }}>Vehicle</label>
            <select value={assign.vehicleId} onChange={(e) => setAssign({ ...assign, vehicleId: e.target.value, error: '' })}
              className="w-full mb-3 mt-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 10px', color: 'var(--text-1)', fontSize: 13 }}>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{vehLabel(v)} · {v.plateNumber || v.vehicleType}{v.status && v.status !== 'AVAILABLE' ? ` (${String(v.status).toLowerCase()})` : ''}</option>)}
            </select>
            {assign.error && (
              <div className="text-xs mb-3 px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5' }}>
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> <span>{assign.error}</span>
              </div>
            )}
            {assign.lockHit && (
              <label className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--warn)' }}>
                <input type="checkbox" checked={!!assign.force} onChange={(e) => setAssign({ ...assign, force: e.target.checked })} />
                Override turnaround — log a forced call (safety/compliance exception)
              </label>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssign(null)} style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-2)', color: 'var(--text-2)' }}>Cancel</button>
              <button onClick={doAssign} style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, background: 'var(--gold)', color: '#161C28' }}>{assign.lockHit && assign.force ? 'Force assign' : 'Dispatch'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Run card ──────────────────────────────────────────────────────────────────
function RunCard({ run, onAssign, onAct }: { run: any; onAssign: () => void; onAct: (id: string, a: string) => void }) {
  const vip = run.priority === 'VIP', urgent = run.priority === 'URGENT';
  const btn = (label: string, action: string, primary = false): any => (
    <button onClick={() => onAct(run.id, action)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 7, flex: 1, background: primary ? 'var(--gold)' : 'var(--surface-2)', color: primary ? '#161C28' : 'var(--text-2)', border: primary ? 'none' : '1px solid var(--border-2)' }}>{label}</button>
  );
  return (
    <div style={{ ...card, padding: 11, borderLeft: `3px solid ${urgent ? '#dc2626' : vip ? 'var(--gold)' : 'var(--border-2)'}` }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold">{fmtTime(run.scheduledAt)}</span>
        {urgent && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(220,38,38,0.18)', color: '#fca5a5' }}>URGENT</span>}
        {vip && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(212,160,23,0.18)', color: 'var(--gold)' }}>VIP</span>}
      </div>
      <div className="text-xs mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
        <span className="truncate">{run.fromLocation || '?'}</span><ChevronRight size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} /><span className="truncate">{run.toLocation || '?'}</span>
      </div>
      {run.passengerNote && <div className="text-xs mb-1.5 truncate" style={{ color: 'var(--text-3)' }}>👤 {run.passengerNote}</div>}
      {(run.driver || run.vehicle) && (
        <div className="text-[11px] mb-2 flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: 'var(--text-3)' }}>
          {run.driver && <span className="inline-flex items-center gap-1"><UserRound size={11} /> {run.driver.fullName}</span>}
          {run.vehicle && <span className="inline-flex items-center gap-1"><Truck size={11} /> {vehLabel(run.vehicle)} {run.vehicle.plateNumber}</span>}
        </div>
      )}
      {run.vehicle && (run.vehicle.fleetClass === 'WORKING' || ['TRUCK', 'BUS', 'MINIBUS'].includes(run.vehicle.vehicleType)) && (
        <div className="text-[10px] mb-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(212,160,23,0.15)', color: 'var(--warn)' }}>🚛 Heavy · no U-turn · ≤80 km/h</div>
      )}
      {/* lifecycle timeline */}
      {(run.acknowledgedAt || run.arrivedAt || run.onboardAt || run.completedAt) && (
        <div className="text-[10px] mb-2 flex flex-wrap gap-x-2" style={{ color: 'var(--text-3)' }}>
          {run.acknowledgedAt && <span>ack {fmtTime(run.acknowledgedAt)}</span>}
          {run.arrivedAt && <span>arr {fmtTime(run.arrivedAt)}</span>}
          {run.onboardAt && <span style={{ color: '#34d399' }}>onboard {fmtTime(run.onboardAt)}</span>}
          {run.completedAt && <span style={{ color: 'var(--ok)' }}>done {fmtTime(run.completedAt)}</span>}
        </div>
      )}
      {/* actions by FSM state */}
      <div className="flex gap-1.5">
        {run.status === 'REQUESTED' && <button onClick={onAssign} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 7, flex: 1, background: 'var(--gold)', color: '#161C28' }}>Assign driver</button>}
        {run.status === 'ASSIGNED' && <>{btn('Acknowledge', 'ACK', true)}{btn('Cancel', 'CANCEL')}</>}
        {run.status === 'EN_ROUTE' && <>{!run.arrivedAt ? btn('Arrived', 'ARRIVE', true) : btn('On board', 'ONBOARD', true)}{btn('Cancel', 'CANCEL')}</>}
        {run.status === 'PASSENGER_ONBOARD' && btn('Complete run', 'COMPLETE', true)}
        {run.status === 'COMPLETED' && <div className="text-xs flex items-center gap-1 py-1" style={{ color: 'var(--ok)' }}><CheckCircle2 size={13} /> Completed</div>}
      </div>
    </div>
  );
}

// ── Recce routes manager (Map tab) — Locations scouts routes; constraints sync to drivers ──
const routeInput: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-1)', fontSize: 13, width: '100%' };
function RoutesPanel({ projectId }: { projectId: string }) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ label: '', kind: 'TRUCK_SAFE', constraints: '' });
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { captainApi.routes(projectId).then((r) => setRoutes(r.data || [])).catch(() => setRoutes([])); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!form.label.trim()) return; try { await captainApi.createRoute({ projectId, label: form.label.trim(), kind: form.kind, constraints: form.constraints || null, points: [] }); setForm({ label: '', kind: 'TRUCK_SAFE', constraints: '' }); setAdding(false); load(); } catch { /* ignore */ } };
  const del = async (id: string) => { try { await captainApi.removeRoute(id); load(); } catch { /* ignore */ } };
  return (
    <div style={{ ...card, padding: 14 }}>
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={15} style={{ color: 'var(--gold)' }} /><span className="text-sm font-semibold flex-1">Recce routes</span>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12, fontWeight: 600, border: '1px solid var(--border-2)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-2)' }}>{adding ? 'Cancel' : '+ Add route'}</button>
      </div>
      {adding && (
        <div className="flex flex-col gap-2 mb-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
          <input placeholder="Label (e.g. Camera truck — north approach)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} style={routeInput} />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={routeInput}>
            {['STANDARD', 'TRUCK_SAFE', 'NOISE_RESTRICTED', 'SCENIC', 'AVOID'].map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ').toLowerCase()}</option>)}
          </select>
          <textarea placeholder="Constraints synced to drivers (e.g. avoid bridge <4m on Al Khail; noise curfew 22:00–06:00)" value={form.constraints} onChange={(e) => setForm({ ...form, constraints: e.target.value })} rows={2} style={routeInput} />
          <button onClick={add} style={{ background: 'var(--gold)', color: '#161C28', borderRadius: 8, padding: '8px', fontWeight: 700, fontSize: 13 }}>Save route</button>
        </div>
      )}
      {routes.length === 0 ? <div className="text-xs py-3 text-center" style={{ color: 'var(--text-3)' }}>No recce routes yet — add truck-safe / noise-restricted routes; drivers see the constraints on Navigate.</div> :
        routes.map((r: any) => (
          <div key={r.id} className="flex items-start gap-2 py-2" style={{ borderTop: '1px solid var(--border-1)' }}>
            <span className="text-[10px] px-1.5 py-0.5 rounded mt-0.5" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{r.kind}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{r.label}</div>
              {r.constraints && <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{r.constraints}</div>}
            </div>
            <button onClick={() => del(r.id)} style={{ color: 'var(--text-3)' }} title="Remove route"><X size={14} /></button>
          </div>
        ))}
    </div>
  );
}
