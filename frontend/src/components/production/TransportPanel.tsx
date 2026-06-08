'use client';

import { useState, useEffect, useCallback } from 'react';
import { transportApi } from '@/lib/api';
import { Car, Bus, MapPin, Users, Plus, X, Loader2, CheckCircle2, Trash2, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { PanelHeader, Btn, inputCls } from './ui';

const ORDER_TYPES = ['TALENT_PICKUP', 'CREW_SHUTTLE', 'AIRPORT_PICKUP', 'AIRPORT_DROPOFF', 'EQUIPMENT_RUN', 'INTER_LOCATION', 'OTHER'];
const STATUSES = ['REQUESTED', 'ASSIGNED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'];
const STATUS_CLS: Record<string, string> = { REQUESTED: 'bg-amber-100 text-amber-700', ASSIGNED: 'bg-blue-100 text-blue-700', EN_ROUTE: 'bg-violet-100 text-violet-700', COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-rose-100 text-rose-700' };
const COL_BG: Record<string, string> = { REQUESTED: 'bg-amber-50/50 border-amber-200', ASSIGNED: 'bg-blue-50/50 border-blue-200', EN_ROUTE: 'bg-violet-50/50 border-violet-200', COMPLETED: 'bg-emerald-50/40 border-emerald-200', CANCELLED: 'bg-slate-50 border-slate-200' };

const today = () => new Date().toISOString().slice(0, 10);
const fmtTime = (d?: string) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

export default function TransportPanel({ projectId }: { projectId: string }) {
  const [date, setDate] = useState(today());
  const [board, setBoard] = useState<any>({ byStatus: {}, counts: {}, total: 0, passengers: 0 });
  const [create, setCreate] = useState(false);

  const load = useCallback(() => {
    transportApi.movementBoard(date, projectId).then((r) => setBoard(r.data || { byStatus: {}, counts: {} })).catch(() => {});
  }, [date, projectId]);
  useEffect(() => { load(); }, [load]);

  const shiftDay = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d.toISOString().slice(0, 10)); };
  const setStatus = async (id: string, status: string) => { await transportApi.updOrder(id, { status }); load(); };
  const remove = async (id: string) => { await transportApi.delOrder(id); load(); };

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Car}
        title="Transport — Daily Movement Board"
        subtitle={`Vehicles & drivers hired for this production. ${board.total} movement${board.total === 1 ? '' : 's'} · ${board.passengers} passenger${board.passengers === 1 ? '' : 's'}.`}
        actions={<Btn variant="primary" onClick={() => setCreate(true)}><Plus size={14} /> New movement</Btn>}
      />

      {/* Date stepper */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => shiftDay(-1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm" />
        <button onClick={() => shiftDay(1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button>
        <button onClick={() => setDate(today())} className="text-xs text-slate-500 underline ml-1">Today</button>
      </div>

      {/* Status board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {STATUSES.map((s) => {
          const items = board.byStatus?.[s] || [];
          return (
            <div key={s} className={`rounded-2xl border p-2.5 ${COL_BG[s]}`}>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_CLS[s]}`}>{s.replace('_', ' ')}</span>
                <span className="text-xs text-slate-400">{items.length}</span>
              </div>
              <div className="grid gap-2">
                {items.length === 0 ? <p className="text-[11px] text-slate-400 px-1 py-2">—</p> : items.map((o: any) => (
                  <div key={o.id} className="rounded-xl bg-white ring-1 ring-slate-200 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-slate-500">{o.type.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-slate-500 inline-flex items-center gap-1"><Clock size={11} /> {fmtTime(o.scheduledAt)}</span>
                    </div>
                    <div className="text-xs text-slate-700 mt-1 flex items-center gap-1"><MapPin size={11} className="text-slate-400 shrink-0" /><span className="truncate">{o.fromLocation || '—'} → {o.toLocation || '—'}</span></div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      {o.vehicle ? <span className="inline-flex items-center gap-1">{o.vehicle.vehicleType === 'BUS' || o.vehicle.vehicleType === 'MINIBUS' ? <Bus size={11} /> : <Car size={11} />}{[o.vehicle.make, o.vehicle.model, o.vehicle.plateNumber].filter(Boolean).join(' ') || o.vehicle.vehicleType}</span> : <span className="text-amber-600">no vehicle</span>}
                      {o.driver ? <span>· {o.driver.fullName}</span> : <span className="text-amber-600">· no driver</span>}
                    </div>
                    {(o.passengers?.length > 0 || o.passengerNote) && <div className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1"><Users size={11} />{o.passengers?.length ? o.passengers.map((p: any) => p.traveler?.fullName).filter(Boolean).join(', ') : o.passengerNote}</div>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className={`text-[10px] rounded-full px-2 py-0.5 border-0 ${STATUS_CLS[o.status]}`}>{STATUSES.map((st) => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}</select>
                      <button onClick={() => remove(o.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {create && <OrderModal projectId={projectId} defaultDate={date} onClose={() => setCreate(false)} onDone={() => { setCreate(false); load(); }} />}
    </div>
  );
}

function OrderModal({ projectId, defaultDate, onClose, onDone }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [travelers, setTravelers] = useState<any[]>([]);
  const [f, setF] = useState<any>({ type: 'TALENT_PICKUP', fromLocation: '', toLocation: '', time: '09:00', vehicleId: '', driverId: '', passengerNote: '', travelerIds: [] as string[] });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    transportApi.vehicles({ scope: undefined }).then((r) => setVehicles(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.drivers().then((r) => setDrivers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.travelers(projectId).then((r) => setTravelers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [projectId]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const togglePax = (id: string) => setF((x: any) => ({ ...x, travelerIds: x.travelerIds.includes(id) ? x.travelerIds.filter((t: string) => t !== id) : [...x.travelerIds, id] }));
  const submit = async () => {
    setBusy(true);
    try {
      const scheduledAt = f.time ? `${defaultDate}T${f.time}:00` : `${defaultDate}T09:00:00`;
      await transportApi.addOrder({ projectId, type: f.type, fromLocation: f.fromLocation || undefined, toLocation: f.toLocation || undefined, scheduledAt, vehicleId: f.vehicleId || undefined, driverId: f.driverId || undefined, passengerNote: f.passengerNote || undefined, travelerIds: f.travelerIds });
      onDone();
    } finally { setBusy(false); }
  };
  const inp = inputCls;
  const L = ({ label, children, full }: any) => <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;
  const vLabel = (v: any) => `${v.source === 'IN_HOUSE' ? '🏠' : '🔑'} ${[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}${v.plateNumber ? ` · ${v.plateNumber}` : ''}${v.supplier ? ` · ${v.supplier.name}` : ''}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New movement — {defaultDate}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Type"><select className={inp} value={f.type} onChange={(e) => set('type', e.target.value)}>{ORDER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></L>
          <L label="Time"><input type="time" className={inp} value={f.time} onChange={(e) => set('time', e.target.value)} /></L>
          <L label="From"><input className={inp} value={f.fromLocation} onChange={(e) => set('fromLocation', e.target.value)} placeholder="Hotel / airport…" /></L>
          <L label="To"><input className={inp} value={f.toLocation} onChange={(e) => set('toLocation', e.target.value)} placeholder="Base camp / set…" /></L>
          <L label="Vehicle" full><select className={inp} value={f.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}><option value="">— assign later —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{vLabel(v)}</option>)}</select></L>
          <L label="Driver" full><select className={inp} value={f.driverId} onChange={(e) => set('driverId', e.target.value)}><option value="">— assign later —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.source === 'IN_HOUSE' ? '🏠' : '🔑'} {d.fullName}{d.supplier ? ` · ${d.supplier.name}` : ''}</option>)}</select></L>
          <div className="col-span-2">
            <span className="block text-xs font-medium text-slate-500 mb-1">Passengers ({f.travelerIds.length})</span>
            {travelers.length === 0 ? <p className="text-[11px] text-slate-400">No project people yet — use the note below.</p> : (
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {travelers.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={f.travelerIds.includes(t.id)} onChange={() => togglePax(t.id)} />
                    <span className="text-slate-700">{t.fullName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.personType}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <L label="Passenger note (non-tracked)" full><input className={inp} value={f.passengerNote} onChange={(e) => set('passengerNote', e.target.value)} placeholder="e.g. 12 crew" /></L>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Create movement</Btn>
        </div>
      </div>
    </div>
  );
}
