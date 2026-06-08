'use client';

import { useState, useEffect, useCallback } from 'react';
import { accommodationApi } from '@/lib/api';
import { BedDouble, Plus, X, Loader2, Building2, Trash2, DoorOpen } from 'lucide-react';

const TYPES = ['HOTEL', 'APARTMENT', 'SERVICED_APARTMENT', 'VILLA', 'RESORT', 'CREW_CAMP', 'DORMITORY', 'STAFF_HOUSING', 'OTHER'];
const ROOM_TYPES = ['SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'EXECUTIVE_SUITE', 'VILLA', 'APARTMENT', 'DORMITORY', 'BED'];
const ROOM_STATUS: Record<string, string> = { AVAILABLE: 'bg-emerald-100 text-emerald-700', OCCUPIED: 'bg-blue-100 text-blue-700', BLOCKED: 'bg-amber-100 text-amber-700', MAINTENANCE: 'bg-rose-100 text-rose-700' };
const RANK: Record<string, string> = { PREFERRED: 'bg-emerald-100 text-emerald-700', APPROVED: 'bg-blue-100 text-blue-700', RESTRICTED: 'bg-amber-100 text-amber-700', BLACKLISTED: 'bg-rose-100 text-rose-700' };

export default function AccommodationMaster() {
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState('');
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const load = useCallback(() => { accommodationApi.properties(type ? { type } : {}).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [type]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="font-sans p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><BedDouble className="text-[#0f172a]" /> Accommodation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Properties &amp; room inventory — hotels, apartments, villas, crew camps, dormitories.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"><Plus size={16} /> Add property</button>
        </div>
      </div>

      <div className="grid gap-2">
        {rows.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No properties yet.</p> : rows.map((p) => (
          <button key={p.id} onClick={() => setViewId(p.id)} className="text-left rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between hover:shadow-md transition">
            <div>
              <div className="font-medium text-slate-900 flex items-center gap-2"><Building2 size={15} className="text-slate-400" /> {p.name} <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{p.type?.replace(/_/g, ' ')}</span>{p.supplier?.ranking && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RANK[p.supplier.ranking]}`}>{p.supplier.ranking}</span>}</div>
              <div className="text-xs text-slate-500 mt-0.5">{[p.city, p.country, p.supplier?.name].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <div className="text-right text-xs text-slate-500"><div>{p._count?.rooms ?? 0} rooms</div><div>{p._count?.assignments ?? 0} stays</div></div>
          </button>
        ))}
      </div>

      {open && <PropertyModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
      {viewId && <PropertyDrawer id={viewId} onClose={() => { setViewId(null); load(); }} />}
    </div>
  );
}

const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
function L({ label, full, children }: any) { return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>; }

function PropertyModal({ onClose, onDone }: any) {
  const [f, setF] = useState<any>({ name: '', type: 'HOTEL', city: '', country: 'United Arab Emirates', contactName: '', contactPhone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const submit = async () => { if (!f.name) return; setBusy(true); try { await accommodationApi.addProperty(f); onDone(); } finally { setBusy(false); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Add property</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Name *" full><input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} /></L>
          <L label="Type"><select className={inp} value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></L>
          <L label="City"><input className={inp} value={f.city} onChange={(e) => set('city', e.target.value)} /></L>
          <L label="Country"><input className={inp} value={f.country} onChange={(e) => set('country', e.target.value)} /></L>
          <L label="Contact name"><input className={inp} value={f.contactName} onChange={(e) => set('contactName', e.target.value)} /></L>
          <L label="Contact phone"><input className={inp} value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></L>
          <L label="Address" full><input className={inp} value={f.address} onChange={(e) => set('address', e.target.value)} /></L>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !f.name} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}

function PropertyDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<any>(null);
  const [r, setR] = useState<any>({ roomNumber: '', type: 'SINGLE', capacity: '1', nightlyRate: '', status: 'AVAILABLE' });
  const [busy, setBusy] = useState(false);
  const load = () => accommodationApi.property(id).then((x) => setP(x.data)).catch(() => setP(false));
  useEffect(() => { load(); }, [id]);
  const addRoom = async () => { if (!r.roomNumber) return; setBusy(true); try { await accommodationApi.addRoom(id, r); setR({ ...r, roomNumber: '' }); load(); } finally { setBusy(false); } };
  const setRoomStatus = async (roomId: string, status: string) => { await accommodationApi.updRoom(roomId, { status }); load(); };
  const delRoom = async (roomId: string) => { await accommodationApi.delRoom(roomId); load(); };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Building2 size={16} className="text-[#0f172a]" /> {p?.name || 'Property'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        {!p ? <p className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></p> : (
          <div className="p-5">
            <p className="text-xs text-slate-500 mb-4">{[p.type?.replace(/_/g, ' '), p.city, p.country, p.contactName, p.contactPhone].filter(Boolean).join(' · ')}</p>

            <div className="rounded-xl bg-slate-50 p-3 mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1"><DoorOpen size={12} /> Add room</p>
              <div className="grid grid-cols-4 gap-2">
                <input className={inp} placeholder="No." value={r.roomNumber} onChange={(e) => setR({ ...r, roomNumber: e.target.value })} />
                <select className={inp} value={r.type} onChange={(e) => setR({ ...r, type: e.target.value })}>{ROOM_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
                <input type="number" className={inp} placeholder="Cap" value={r.capacity} onChange={(e) => setR({ ...r, capacity: e.target.value })} />
                <input type="number" className={inp} placeholder="Rate" value={r.nightlyRate} onChange={(e) => setR({ ...r, nightlyRate: e.target.value })} />
              </div>
              <button onClick={addRoom} disabled={busy} className="mt-2 text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40">Add room</button>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Rooms ({p.rooms?.length || 0})</p>
            <div className="space-y-1.5">
              {(p.rooms || []).length === 0 ? <p className="text-xs text-slate-400">No rooms.</p> : p.rooms.map((rm: any) => (
                <div key={rm.id} className="flex items-center justify-between rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2">
                  <div><span className="text-sm font-medium text-slate-800">Room {rm.roomNumber}</span><span className="text-[11px] text-slate-400 ml-2">{rm.type?.replace(/_/g, ' ')} · cap {rm.capacity}{rm.nightlyRate ? ` · ${rm.currency} ${Number(rm.nightlyRate).toLocaleString()}/night` : ''}</span></div>
                  <div className="flex items-center gap-2">
                    <select value={rm.status} onChange={(e) => setRoomStatus(rm.id, e.target.value)} className={`text-[10px] rounded-full px-2 py-0.5 border-0 ${ROOM_STATUS[rm.status] || 'bg-slate-100'}`}>{Object.keys(ROOM_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    <button onClick={() => delRoom(rm.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
