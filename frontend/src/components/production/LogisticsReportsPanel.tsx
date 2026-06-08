'use client';

import { useState, useEffect } from 'react';
import { logisticsReportsApi } from '@/lib/api';
import { BarChart3, BedDouble, Car, Bus, Plane, Users, Loader2, Coins, CalendarDays } from 'lucide-react';

const money = (n?: number | null) => (n == null ? '—' : `AED ${Number(n).toLocaleString()}`);

export default function LogisticsReportsPanel({ projectId }: { projectId: string }) {
  const [r, setR] = useState<any>(null);
  useEffect(() => { logisticsReportsApi.summary(projectId).then((x) => setR(x.data)).catch(() => setR(false)); }, [projectId]);

  if (r === null) return <p className="text-slate-400 py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (!r) return <p className="text-xs text-rose-500">Could not load report.</p>;

  const h = r.headline || {};
  const kpi = (icon: any, label: string, value: any, sub?: string) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400 text-[11px] font-medium uppercase tracking-wide">{icon}{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="font-sans">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2"><BarChart3 size={18} className="text-[#0f172a]" /> Logistics &amp; executive report</h3>
        <p className="text-xs text-slate-500 mt-0.5">Accommodation, transport, shuttle &amp; arrivals roll-up for this production.</p>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {kpi(<Users size={13} />, 'People in scope', r.peopleInScope ?? 0)}
        {kpi(<BedDouble size={13} />, 'Accommodation', money(r.accommodationCost), `${h.roomNights || 0} room-nights`)}
        {kpi(<Car size={13} />, 'Transport (hired)', money(r.transportCost), `${r.transport?.hiredVehicles || 0} vehicles`)}
        {kpi(<Coins size={13} />, 'Total logistics', money(r.totalLogisticsCost))}
        {kpi(<Users size={13} />, 'Cost / person', money(r.costPerPerson))}
        {kpi(<CalendarDays size={13} />, 'Cost / shoot day', money(r.costPerShootDay), r.shootDays ? `${r.shootDays} shoot days` : 'no shoot days set')}
      </div>

      {/* Headline counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Mini icon={<BedDouble size={13} />} label="Housed" a={h.peopleHoused || 0} />
        <Mini icon={<Car size={13} />} label="Movements" a={h.movements || 0} b={`${h.passengersMoved || 0} pax`} />
        <Mini icon={<Bus size={13} />} label="Shuttle routes" a={h.shuttleRoutes || 0} b={`${h.shuttleRiders || 0} riders`} />
        <Mini icon={<Plane size={13} />} label="Arrivals" a={h.arrivals || 0} b={`${h.arrivalsCompleted || 0} done`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Accommodation by property */}
        <Card title="Accommodation by property">
          {(r.accommodation?.byProperty || []).length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] text-slate-400"><th className="text-left font-medium py-1">Property</th><th className="text-right font-medium">People</th><th className="text-right font-medium">Cost</th></tr></thead>
              <tbody>{r.accommodation.byProperty.map((p: any, i: number) => <tr key={i} className="border-t border-slate-100"><td className="py-1.5 text-slate-700">{p.name}</td><td className="text-right text-slate-600">{p.people}</td><td className="text-right text-slate-600">{money(p.cost)}</td></tr>)}</tbody>
            </table>
          )}
        </Card>

        {/* Vehicle / driver utilisation */}
        <Card title="Vehicle utilisation">
          {(r.transport?.vehicleUtilisation || []).length === 0 ? <Empty /> : (
            <div className="space-y-1.5">{r.transport.vehicleUtilisation.slice(0, 8).map((v: any, i: number) => <Bar key={i} label={v.label} value={v.trips} max={r.transport.vehicleUtilisation[0].trips} suffix="trips" />)}</div>
          )}
        </Card>

        <Card title="Driver utilisation">
          {(r.transport?.driverUtilisation || []).length === 0 ? <Empty /> : (
            <div className="space-y-1.5">{r.transport.driverUtilisation.slice(0, 8).map((d: any, i: number) => <Bar key={i} label={d.label} value={d.trips} max={r.transport.driverUtilisation[0].trips} suffix="trips" />)}</div>
          )}
        </Card>

        {/* Shuttle */}
        <Card title="Shuttle routes">
          {(r.shuttle?.detail || []).length === 0 ? <Empty /> : (
            <div className="space-y-1.5">{r.shuttle.detail.map((s: any) => <div key={s.id} className="flex items-center justify-between text-sm"><span className="text-slate-700 truncate">{s.name}</span><span className="text-[11px] text-slate-500">{s.riders}{s.capacity ? `/${s.capacity}` : ''}{s.utilisation != null ? ` · ${s.utilisation}%` : ''}</span></div>)}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Mini({ icon, label, a, b }: any) {
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"><div className="flex items-center gap-1.5 text-[11px] text-slate-400">{icon}{label}</div><div className="text-lg font-semibold text-slate-900">{a}{b && <span className="text-[11px] font-normal text-slate-400 ml-1.5">{b}</span>}</div></div>;
}
function Card({ title, children }: any) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</p>{children}</div>; }
function Empty() { return <p className="text-xs text-slate-400 py-3">No data yet.</p>; }
function Bar({ label, value, max, suffix }: any) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return <div><div className="flex items-center justify-between text-[11px] mb-0.5"><span className="text-slate-600 truncate">{label}</span><span className="text-slate-400">{value} {suffix}</span></div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#0f172a]" style={{ width: `${pct}%` }} /></div></div>;
}
