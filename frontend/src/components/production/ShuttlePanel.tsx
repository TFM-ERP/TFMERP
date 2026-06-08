'use client';

import { useState, useEffect, useCallback } from 'react';
import { shuttleApi } from '@/lib/api';
import { transportApi } from '@/lib/api';
import { Bus, MapPin, Plus, X, Loader2, Trash2, Clock, Users, ChevronUp, ChevronDown, UserPlus, CheckCircle2 } from 'lucide-react';
import { PanelHeader, Btn, Chip, EmptyState, inputCls } from './ui';

const FREQ = ['DAILY', 'WEEKDAYS', 'WEEKLY', 'CUSTOM'];
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const STATUS_CLS: Record<string, string> = { ACTIVE: 'bg-emerald-100 text-emerald-700', PAUSED: 'bg-amber-100 text-amber-700', ARCHIVED: 'bg-slate-100 text-slate-500' };

export default function ShuttlePanel({ projectId }: { projectId: string }) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [create, setCreate] = useState(false);

  const load = useCallback(() => {
    shuttleApi.routes({ projectId }).then((r) => setRoutes(Array.isArray(r.data) ? r.data : [])).catch(() => setRoutes([]));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!selId && routes.length) setSelId(routes[0].id); }, [routes, selId]);

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Bus}
        title="Shuttle & bus scheduling"
        subtitle="Recurring multi-stop routes with capacity, assigned vehicle & driver, and a rider manifest."
        actions={<Btn variant="primary" onClick={() => setCreate(true)}><Plus size={14} /> New route</Btn>}
      />

      <div className="grid md:grid-cols-[260px_1fr] gap-4">
        {/* Route list */}
        <div className="grid gap-1.5 content-start">
          {routes.length === 0 ? <p className="text-xs text-slate-400 py-4">No routes yet.</p> : routes.map((r) => (
            <button key={r.id} onClick={() => setSelId(r.id)} className={`text-left rounded-xl border px-3 py-2.5 ${selId === r.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-800 truncate">{r.name}</span><Chip tone={r.status === 'ACTIVE' ? 'money' : r.status === 'PAUSED' ? 'need' : 'slate'}>{r.status}</Chip></div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                {r.departureTime && <span className="inline-flex items-center gap-1"><Clock size={10} />{r.departureTime}</span>}
                <span>{r._count?.stops ?? 0} stops</span>
                <span className="inline-flex items-center gap-1"><Users size={10} />{r._count?.riders ?? 0}{(r.capacity ?? r.vehicle?.capacity) ? `/${r.capacity ?? r.vehicle?.capacity}` : ''}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Route detail */}
        <div>{selId ? <RouteDetail key={selId} routeId={selId} projectId={projectId} onChanged={load} onDeleted={() => { setSelId(null); load(); }} /> : <p className="text-xs text-slate-400">Select a route.</p>}</div>
      </div>

      {create && <RouteModal projectId={projectId} onClose={() => setCreate(false)} onDone={(id: string) => { setCreate(false); load(); setSelId(id); }} />}
    </div>
  );
}

function RouteDetail({ routeId, projectId, onChanged, onDeleted }: any) {
  const [r, setR] = useState<any>(null);
  const [newStop, setNewStop] = useState<any>({ name: '', arrivalTime: '' });
  const [travelers, setTravelers] = useState<any[]>([]);
  const [addPax, setAddPax] = useState('');

  const load = useCallback(() => { shuttleApi.route(routeId).then((x) => setR(x.data)).catch(() => setR(false)); }, [routeId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { shuttleApi.travelers(projectId).then((x) => setTravelers(Array.isArray(x.data) ? x.data : [])).catch(() => {}); }, [projectId]);

  if (r === null) return <p className="text-slate-400 py-8 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (!r) return <p className="text-xs text-rose-500">Route not found.</p>;

  const cap = r.capacity ?? r.vehicle?.capacity ?? null;
  const used = r.seatsUsed ?? r.riders?.length ?? 0;
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const riderIds = new Set((r.riders || []).map((x: any) => x.travelerId));

  const addStop = async () => { if (!newStop.name) return; await shuttleApi.addStop(routeId, newStop); setNewStop({ name: '', arrivalTime: '' }); load(); onChanged(); };
  const delStop = async (id: string) => { await shuttleApi.delStop(id); load(); onChanged(); };
  const move = async (idx: number, dir: -1 | 1) => {
    const stops = [...r.stops]; const j = idx + dir; if (j < 0 || j >= stops.length) return;
    [stops[idx], stops[j]] = [stops[j], stops[idx]];
    await shuttleApi.reorderStops(routeId, stops.map((s: any) => s.id)); load();
  };
  const addRider = async () => { if (!addPax) return; try { await shuttleApi.addRider(routeId, { travelerId: addPax }); setAddPax(''); load(); onChanged(); } catch (e: any) { alert(e?.response?.data?.message || 'At capacity'); } };
  const delRider = async (id: string) => { await shuttleApi.delRider(id); load(); onChanged(); };
  const setRiderStop = async (rider: any, stopId: string) => { await shuttleApi.addRider(routeId, { travelerId: rider.travelerId, pickupStopId: stopId || undefined }); load(); };
  const delRoute = async () => { if (!confirm('Delete this route?')) return; await shuttleApi.delRoute(routeId); onDeleted(); };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-900">{r.name}</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">{[r.frequency, r.departureTime, r.vehicle ? `${[r.vehicle.make, r.vehicle.model].filter(Boolean).join(' ') || r.vehicle.vehicleType}${r.vehicle.plateNumber ? ` · ${r.vehicle.plateNumber}` : ''}` : 'no vehicle', r.driver?.fullName].filter(Boolean).join(' · ')}</p>
        </div>
        <button onClick={delRoute} className="text-slate-300 hover:text-rose-600"><Trash2 size={15} /></button>
      </div>

      {/* Capacity bar */}
      {cap != null && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1"><span>Capacity</span><span>{used}/{cap} seats{r.seatsLeft != null ? ` · ${r.seatsLeft} left` : ''}</span></div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Stops */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1"><MapPin size={12} /> Stops ({r.stops?.length || 0})</p>
          <div className="space-y-1.5 mb-2">
            {(r.stops || []).map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-[10px] w-5 h-5 rounded-full bg-slate-900 text-white grid place-items-center shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1"><div className="text-sm text-slate-800 truncate">{s.name}</div>{s.arrivalTime && <div className="text-[10px] text-slate-400">{s.arrivalTime}</div>}</div>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === r.stops.length - 1} className="text-slate-300 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={14} /></button>
                <button onClick={() => delStop(s.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" placeholder="Stop name" value={newStop.name} onChange={(e) => setNewStop({ ...newStop, name: e.target.value })} />
            <input type="time" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm w-24" value={newStop.arrivalTime} onChange={(e) => setNewStop({ ...newStop, arrivalTime: e.target.value })} />
            <button onClick={addStop} className="rounded-lg bg-slate-900 text-white px-2.5"><Plus size={14} /></button>
          </div>
        </div>

        {/* Riders */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1"><Users size={12} /> Riders ({used})</p>
          <div className="space-y-1.5 mb-2 max-h-56 overflow-y-auto">
            {(r.riders || []).length === 0 ? <p className="text-xs text-slate-400">No riders yet.</p> : r.riders.map((rd: any) => (
              <div key={rd.id} className="flex items-center gap-2 rounded-lg ring-1 ring-slate-200 px-2.5 py-1.5">
                <span className="text-sm text-slate-800 truncate flex-1">{rd.traveler?.fullName}</span>
                <select value={rd.pickupStopId || ''} onChange={(e) => setRiderStop(rd, e.target.value)} className="text-[10px] rounded-lg border border-slate-200 px-1.5 py-0.5 max-w-[110px]"><option value="">pickup…</option>{(r.stops || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <button onClick={() => delRider(rd.id)} className="text-slate-300 hover:text-rose-600"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <select className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" value={addPax} onChange={(e) => setAddPax(e.target.value)}>
              <option value="">Add rider…</option>
              {travelers.filter((t) => !riderIds.has(t.id)).map((t) => <option key={t.id} value={t.id}>{t.fullName} ({t.personType})</option>)}
            </select>
            <button onClick={addRider} disabled={!addPax} className="rounded-lg bg-slate-900 text-white px-2.5 disabled:opacity-40"><UserPlus size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteModal({ projectId, onClose, onDone }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [f, setF] = useState<any>({ name: '', frequency: 'DAILY', departureTime: '07:00', daysOfWeek: [] as string[], capacity: '', vehicleId: '', driverId: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    transportApi.vehicles().then((r) => setVehicles(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.drivers().then((r) => setDrivers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const toggleDay = (d: string) => setF((x: any) => ({ ...x, daysOfWeek: x.daysOfWeek.includes(d) ? x.daysOfWeek.filter((y: string) => y !== d) : [...x.daysOfWeek, d] }));
  const submit = async () => { if (!f.name) return; setBusy(true); try { const res = await shuttleApi.addRoute({ ...f, projectId }); onDone(res.data?.id); } finally { setBusy(false); } };
  const inp = inputCls;
  const L = ({ label, children, full }: any) => <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;
  const vLabel = (v: any) => `${v.source === 'IN_HOUSE' ? '🏠' : '🔑'} ${[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}${v.capacity ? ` · ${v.capacity} seats` : ''}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New shuttle route</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Route name *" full><input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Hotel → Base Camp" /></L>
          <L label="Frequency"><select className={inp} value={f.frequency} onChange={(e) => set('frequency', e.target.value)}>{FREQ.map((x) => <option key={x} value={x}>{x}</option>)}</select></L>
          <L label="Departure"><input type="time" className={inp} value={f.departureTime} onChange={(e) => set('departureTime', e.target.value)} /></L>
          {(f.frequency === 'WEEKLY' || f.frequency === 'CUSTOM') && (
            <div className="col-span-2"><span className="block text-xs font-medium text-slate-500 mb-1">Days</span><div className="flex gap-1 flex-wrap">{DAYS.map((d) => <button key={d} onClick={() => toggleDay(d)} className={`text-[11px] px-2 py-1 rounded-lg border ${f.daysOfWeek.includes(d) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>{d}</button>)}</div></div>
          )}
          <L label="Vehicle" full><select className={inp} value={f.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}><option value="">— assign later —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{vLabel(v)}</option>)}</select></L>
          <L label="Driver" full><select className={inp} value={f.driverId} onChange={(e) => set('driverId', e.target.value)}><option value="">— assign later —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></L>
          <L label="Capacity override"><input type="number" className={inp} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="vehicle default" /></L>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || !f.name}>{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Create route</Btn>
        </div>
      </div>
    </div>
  );
}
