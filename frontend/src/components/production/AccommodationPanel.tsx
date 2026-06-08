'use client';

import { useState, useEffect, useCallback } from 'react';
import { accommodationApi } from '@/lib/api';
import { BedDouble, Building2, X, Loader2, UserPlus, Trash2, CheckCircle2 } from 'lucide-react';
import { PanelHeader, Chip, Btn, EmptyState, SectionLabel, inputCls } from './ui';

const CLASSES = ['STANDARD', 'BUSINESS', 'EXECUTIVE', 'VIP', 'ULTRA_VIP'];
const STATUSES = ['REQUESTED', 'RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
const STATUS_CLS: Record<string, string> = { REQUESTED: 'bg-amber-100 text-amber-700', RESERVED: 'bg-blue-100 text-blue-700', CHECKED_IN: 'bg-emerald-100 text-emerald-700', CHECKED_OUT: 'bg-slate-100 text-slate-500', CANCELLED: 'bg-rose-100 text-rose-700' };
const PTYPE: Record<string, string> = { TALENT: 'bg-violet-100 text-violet-700', CREW: 'bg-blue-100 text-blue-700', CONSULTANT: 'bg-amber-100 text-amber-700', VIP: 'bg-rose-100 text-rose-700', ACCOMPANYING: 'bg-slate-100 text-slate-600' };
const PTYPE_TONE: Record<string, string> = { TALENT: 'cast', CREW: 'link', CONSULTANT: 'need', VIP: 'risk', ACCOMPANYING: 'slate' };
const STATUS_TONE: Record<string, string> = { REQUESTED: 'need', RESERVED: 'link', CHECKED_IN: 'money', CHECKED_OUT: 'slate', CANCELLED: 'risk' };

export default function AccommodationPanel({ projectId }: { projectId: string }) {
  const [needs, setNeeds] = useState<any[]>([]);
  const [rooming, setRooming] = useState<any>({ assignments: [], byStatus: {} });
  const [assign, setAssign] = useState<any | null>(null);

  const load = useCallback(() => {
    accommodationApi.needs(projectId).then((r) => setNeeds(Array.isArray(r.data) ? r.data : [])).catch(() => setNeeds([]));
    accommodationApi.rooming(projectId).then((r) => setRooming(r.data || { assignments: [], byStatus: {} })).catch(() => {});
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => { await accommodationApi.updAssignment(id, { status }); load(); };
  const remove = async (id: string) => { await accommodationApi.delAssignment(id); load(); };

  return (
    <div className="font-sans">
      <PanelHeader
        icon={BedDouble}
        title="Accommodation"
        subtitle="Rooming & occupancy for this project. Local people are excluded automatically."
      />

      {/* Needs accommodation */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-2 flex items-center gap-1"><UserPlus size={12} /> Needs accommodation ({needs.length})</p>
        {needs.length === 0 ? <p className="text-xs text-slate-500">Everyone who needs a room is assigned. 🎉</p> : (
          <div className="grid gap-1.5">
            {needs.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-xl bg-white ring-1 ring-amber-200 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-slate-800 truncate">{n.fullName}</span>
                  <Chip tone={PTYPE_TONE[n.personType] || 'slate'}>{n.personType}</Chip>
                  {n.suggestedClass && <Chip tone="cast">→ {n.suggestedClass.replace('_', ' ')}</Chip>}
                  <span className="text-[11px] text-slate-400 truncate">{[n.nationality, n.homeCity].filter(Boolean).join(' · ')}</span>
                </div>
                <Btn variant="primary" onClick={() => setAssign(n)} className="shrink-0"><BedDouble size={12} /> Assign</Btn>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Occupancy / rooming list */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <SectionLabel icon={Building2} className="mb-0">Rooming list ({rooming.assignments.length})</SectionLabel>
        {Object.entries(rooming.byStatus || {}).map(([s, n]: any) => <Chip key={s} tone={STATUS_TONE[s] || 'slate'}>{s.replace('_', ' ')}: {n}</Chip>)}
      </div>
      {rooming.assignments.length === 0 ? <EmptyState icon={Building2}>No assignments yet.</EmptyState> : (
        <div className="grid gap-1.5">
          {rooming.assignments.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="text-sm font-medium text-slate-800">{a.traveler?.fullName}</span><Chip tone="cast">{a.accommodationClass?.replace('_', ' ')}</Chip></div>
                <div className="text-[11px] text-slate-500">{a.property?.name || '—'}{a.room ? ` · Room ${a.room.roomNumber} (${a.room.type?.replace('_', ' ')})` : ''}{a.checkIn ? ` · ${new Date(a.checkIn).toLocaleDateString()}` : ''}{a.checkOut ? `–${new Date(a.checkOut).toLocaleDateString()}` : ''}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} className={`text-[10px] rounded-full px-2 py-0.5 border-0 ${STATUS_CLS[a.status] || 'bg-slate-100'}`}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
                <button onClick={() => remove(a.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assign && <AssignModal projectId={projectId} traveler={assign} onClose={() => setAssign(null)} onDone={() => { setAssign(null); load(); }} />}
    </div>
  );
}

function AssignModal({ projectId, traveler, onClose, onDone }: any) {
  const [properties, setProperties] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [f, setF] = useState<any>({ propertyId: '', roomId: '', accommodationClass: traveler.suggestedClass || 'STANDARD', checkIn: '', checkOut: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { accommodationApi.properties().then((r) => setProperties(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const pickProperty = async (id: string) => {
    set('propertyId', id); set('roomId', '');
    if (!id) { setRooms([]); return; }
    const r = await accommodationApi.property(id);
    setRooms((r.data?.rooms || []).filter((rm: any) => rm.status === 'AVAILABLE'));
  };
  const submit = async () => {
    setBusy(true);
    try { await accommodationApi.addAssignment({ travelerId: traveler.id, projectId, propertyId: f.propertyId || undefined, roomId: f.roomId || undefined, accommodationClass: f.accommodationClass, checkIn: f.checkIn || undefined, checkOut: f.checkOut || undefined, status: 'RESERVED' }); onDone(); } finally { setBusy(false); }
  };
  const inp = inputCls;
  const L = ({ label, children, full }: any) => <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Assign — {traveler.fullName}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Property" full><select className={inp} value={f.propertyId} onChange={(e) => pickProperty(e.target.value)}><option value="">Select…</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type?.replace('_', ' ')})</option>)}</select></L>
          <L label="Room" full><select className={inp} value={f.roomId} onChange={(e) => set('roomId', e.target.value)} disabled={!f.propertyId}><option value="">{f.propertyId ? '— optional —' : 'pick property first'}</option>{rooms.map((rm) => <option key={rm.id} value={rm.id}>Room {rm.roomNumber} · {rm.type?.replace('_', ' ')} · cap {rm.capacity}{rm.nightlyRate ? ` · ${rm.currency} ${Number(rm.nightlyRate).toLocaleString()}` : ''}</option>)}</select></L>
          <L label="Class"><select className={inp} value={f.accommodationClass} onChange={(e) => set('accommodationClass', e.target.value)}>{CLASSES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></L>
          <div />
          <L label="Check-in"><input type="date" className={inp} value={f.checkIn} onChange={(e) => set('checkIn', e.target.value)} /></L>
          <L label="Check-out"><input type="date" className={inp} value={f.checkOut} onChange={(e) => set('checkOut', e.target.value)} /></L>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Assign room</Btn>
        </div>
      </div>
    </div>
  );
}
