'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { logisticsReportsApi } from '@/lib/api';
import { BarChart3, BedDouble, Car, Plane, Coins, Loader2, ChevronRight } from 'lucide-react';

const money = (n?: number | null) => (n == null ? '—' : `AED ${Number(n).toLocaleString()}`);

export default function LogisticsDashboard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { logisticsReportsApi.overview().then((r) => setData(r.data)).catch(() => setData(false)); }, []);

  if (data === null) return <div className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></div>;
  const rows = data?.projects || [];
  const t = data?.totals || { peopleHoused: 0, movements: 0, arrivals: 0, cost: 0 };

  const kpi = (icon: any, label: string, value: any) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400 text-[11px] font-medium uppercase tracking-wide">{icon}{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );

  return (
    <div className="font-sans p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><BarChart3 className="text-[#0f172a]" /> Logistics dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Cross-project accommodation, transport &amp; arrival activity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {kpi(<BedDouble size={13} />, 'People housed', t.peopleHoused)}
        {kpi(<Car size={13} />, 'Movements', t.movements)}
        {kpi(<Plane size={13} />, 'Arrivals', t.arrivals)}
        {kpi(<Coins size={13} />, 'Total cost', money(t.cost))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] text-slate-400 uppercase tracking-wide">
            <tr><th className="text-left font-medium px-4 py-2.5">Project</th><th className="text-right font-medium px-3">Housed</th><th className="text-right font-medium px-3">Nights</th><th className="text-right font-medium px-3">Movements</th><th className="text-right font-medium px-3">Arrivals</th><th className="text-right font-medium px-3">Cost</th><th className="px-3"></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No logistics activity across projects yet.</td></tr> : rows.map((p: any) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-medium text-slate-800">{p.title}</div><div className="text-[11px] text-slate-400">{p.code}</div></td>
                <td className="text-right px-3 text-slate-600">{p.peopleHoused}</td>
                <td className="text-right px-3 text-slate-600">{p.roomNights}</td>
                <td className="text-right px-3 text-slate-600">{p.movements}</td>
                <td className="text-right px-3 text-slate-600">{p.arrivals}</td>
                <td className="text-right px-3 text-slate-700 font-medium">{money(p.cost)}</td>
                <td className="px-3 text-right"><Link href={`/production/projects/${p.id}`} className="text-slate-400 hover:text-slate-900 inline-flex"><ChevronRight size={16} /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
