'use client';

import { useState, useEffect, useCallback } from 'react';
import { travelApi } from '@/lib/api';
import { RequestTripModal } from '@/components/production/TravelPanel';
import { Plane, Plus, MapPin, ShieldCheck, Building2, CalendarClock, Layers } from 'lucide-react';

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', REQUESTED: 'bg-amber-100 text-amber-700', APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700', BOOKING_IN_PROGRESS: 'bg-blue-100 text-blue-700', BOOKED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700', COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-slate-100 text-slate-400',
};
const money = (n: any, c = 'AED') => (n ? `${c} ${Number(n).toLocaleString()}` : '—');
const projLabel = (t: any) => (t.project ? (t.project.isHouse ? 'House / Corporate' : t.project.title) : 'Standalone');

export default function TravelMaster() {
  const [dash, setDash] = useState<any | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [scope, setScope] = useState<'all' | 'standalone'>('all');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    travelApi.dashboard().then((r) => setDash(r.data)).catch(() => {});
    travelApi.trips(scope === 'standalone' ? { scope: 'standalone' } : {}).then((r) => setTrips(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const count = (rows: any[] = [], k: string) => rows.find((x) => x.status === k)?._count ?? 0;
  const total = (rows: any[] = []) => rows.reduce((a, x) => a + (x._count || 0), 0);

  return (
    <div className="font-sans p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Logistics · Mobility</div>
          <h1 className="text-[20px] font-extrabold leading-tight flex items-center gap-2" style={{ color: 'var(--text-1)' }}><Plane size={20} style={{ color: 'var(--gold)' }} /> Travel & Visas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>Master view across every project, plus standalone corporate travel.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800"><Plus size={16} /> New standalone trip</button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={<Plane size={16} />} label="Total trips" value={total(dash?.byStatus)} />
        <Stat icon={<CalendarClock size={16} />} label="Awaiting approval" value={count(dash?.byStatus, 'REQUESTED')} tone="amber" />
        <Stat icon={<ShieldCheck size={16} />} label="Visas in progress" value={total(dash?.visaByStatus)} tone="violet" />
        <Stat icon={<Building2 size={16} />} label="Standalone" value={dash?.standalone ?? 0} tone="slate" />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card title="Upcoming departures" icon={<CalendarClock size={15} />} className="md:col-span-2">
          {(dash?.upcoming || []).length === 0 ? <Empty>No upcoming trips.</Empty> : (dash.upcoming).map((t: any) => (
            <Row key={t.id} left={`${t.origin || ''}→${t.destination || ''}`} sub={`${t.traveler?.fullName || ''} · ${projLabel(t)}`} right={t.departDate ? new Date(t.departDate).toLocaleDateString() : '—'} />
          ))}
        </Card>
        <Card title="Visas due" icon={<ShieldCheck size={15} />}>
          {(dash?.visasDue || []).length === 0 ? <Empty>None pending.</Empty> : (dash.visasDue).map((v: any) => (
            <Row key={v.id} left={v.visaType?.replace(/_/g, ' ')} sub={`${v.traveler?.fullName || ''} · ${v.country}`} right={v.status} />
          ))}
        </Card>
      </div>

      {/* Scope toggle + trips list */}
      <div className="flex items-center gap-2 mb-3">
        <Toggle active={scope === 'all'} onClick={() => setScope('all')}>All projects</Toggle>
        <Toggle active={scope === 'standalone'} onClick={() => setScope('standalone')}>Standalone only</Toggle>
      </div>
      <div className="grid gap-2.5">
        {trips.length === 0 ? <Empty>No trips.</Empty> : trips.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-900 inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {t.origin || '—'} → {t.destination || '—'}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLS[t.status] || 'bg-slate-100'}`}>{t.status.replace(/_/g, ' ')}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${t.project ? (t.project.isHouse ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700') : 'bg-amber-50 text-amber-700'}`}><Building2 size={11} /> {projLabel(t)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t.traveler?.fullName}{t.traveler?.nationality ? ` · ${t.traveler.nationality}` : ''}{t.departDate ? ` · ${new Date(t.departDate).toLocaleDateString()}` : ''}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold text-slate-800">{money(t.estimatedCost, t.currency)}</div>
              {t.status === 'REQUESTED' && <button onClick={async () => { await travelApi.approve(t.id); load(); }} className="mt-1 text-xs text-emerald-700 hover:underline">Approve →</button>}
            </div>
          </div>
        ))}
      </div>

      {open && <RequestTripModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

const TONE: Record<string, string> = { default: 'text-slate-900', amber: 'text-amber-600', violet: 'text-violet-600', slate: 'text-slate-500' };
function Stat({ icon, label, value, tone = 'default' }: any) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-1.5 text-slate-400 text-xs">{icon}{label}</div><div className={`text-2xl font-semibold mt-1 ${TONE[tone]}`}>{value}</div></div>;
}
function Card({ title, icon, children, className = '' }: any) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">{icon}{title}</p><div className="space-y-1">{children}</div></div>;
}
function Row({ left, sub, right }: any) {
  return <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"><div className="min-w-0"><div className="text-sm text-slate-800 truncate">{left}</div><div className="text-[11px] text-slate-400 truncate">{sub}</div></div><span className="text-xs text-slate-500 shrink-0 ml-2">{right}</span></div>;
}
function Empty({ children }: any) { return <p className="text-xs text-slate-400 py-2">{children}</p>; }
function Toggle({ active, onClick, children }: any) {
  return <bu