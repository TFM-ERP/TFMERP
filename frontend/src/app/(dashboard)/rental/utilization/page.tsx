'use client';

import { useEffect, useState } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { rentalApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const dayMs = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function UtilizationPage() {
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * dayMs)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    rentalApi.bookings.utilization(from, to).then(r => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const rows = data?.rows || [];
  const totals = data?.totals || {};
  const maxRev = Math.max(1, ...rows.map((r: any) => r.revenue));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><BarChart2 size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Analytics</div>
            <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Asset Utilization &amp; Revenue</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>How hard each asset works and what it earns over a period.</p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
          <button onClick={load} className="btn-primary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Run</button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4"><div className="text-xs text-gray-500">Total revenue</div><div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.revenue || 0)}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500">Avg utilization</div><div className="text-2xl font-bold text-gray-900">{totals.avgUtilization || 0}%</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500">Assets earning</div><div className="text-2xl font-bold text-gray-900">{totals.activeAssets || 0}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500">Window</div><div className="text-2xl font-bold text-gray-900">{data?.windowDays || 0}d</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50"><h2 className="font-semibold text-gray-800 text-sm">Per asset</h2></div>
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No data for this period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Asset</th>
                <th className="px-3 py-2.5 text-left w-44">Utilization</th>
                <th className="px-3 py-2.5 text-right">Days</th>
                <th className="px-3 py-2.5 text-right">Revenue</th>
                <th className="px-5 py-2.5 text-right">Per day</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.assetId} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-800">{r.name}</div>
                    <div className="text-[11px] text-gray-400">{String(r.assetType).replace(/_/g, ' ')}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${r.utilizationPct}%`, background: r.utilizationPct >= 70 ? '#16a34a' : r.utilizationPct >= 35 ? '#d97706' : '#dc2626' }} />
                      </div>
                      <span className="text-xs text-gray-500 w-9 text-right">{r.utilizationPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600">{r.daysBooked}</td>
                  <td className="px-3 py-3 text-right font-medium">{formatCurrency(r.revenue)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{formatCurrency(r.revenuePerDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
