'use client';

import { useEffect, useState, useCallback } from 'react';
import { rentalApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { RefreshCw, Fuel } from 'lucide-react';
import { CinematicHeader } from '@/components/CinematicHeader';

export default function FuelPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      rentalApi.fuel.list({ page, limit: 25 }),
      rentalApi.fuel.summary(),
    ])
      .then(([listRes, sumRes]) => {
        setItems(listRes.data.items);
        setTotal(listRes.data.total);
        setPages(listRes.data.pages);
        setSummary(sumRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CinematicHeader kicker="Rentals · Fleet" title="Fuel Logs" count={`${total} entries`}>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </CinematicHeader>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Liters', value: `${Number(summary.totalLiters).toFixed(1)} L` },
            { label: 'Total Cost', value: `AED ${Number(summary.totalCost).toLocaleString('en-AE', { minimumFractionDigits: 2 })}` },
            { label: 'Total Fill-ups', value: summary.totalFills },
            { label: 'Avg Price/Liter', value: `AED ${Number(summary.avgPricePerLiter).toFixed(3)}` },
          ].map(k => (
            <div key={k.label} className="card text-center">
              <p className="text-xs text-gray-500 font-medium">{k.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Date</th>
              <th className="table-th">Asset</th>
              <th className="table-th">Station</th>
              <th className="table-th text-right">Liters</th>
              <th className="table-th text-right">Price/L</th>
              <th className="table-th text-right">Total Cost</th>
              <th className="table-th text-right">Odometer</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="table-row">
                <td className="table-td text-sm text-gray-600">{formatDate(item.logDate)}</td>
                <td className="table-td">
                  <span className="text-sm font-medium text-gray-800">{item.asset?.name}</span>
                  <div className="text-xs text-gray-400">{item.asset?.assetType}</div>
                </td>
                <td className="table-td text-sm text-gray-600">{item.fuelStation || '—'}</td>
                <td className="table-td text-right text-sm text-gray-700">{Number(item.liters).toFixed(1)}</td>
                <td className="table-td text-right text-sm text-gray-700">
                  {Number(item.pricePerLiter).toFixed(3)}
                </td>
                <td className="table-td text-right text-sm font-medium text-gray-800">
                  AED {Number(item.totalCost).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                </td>
                <td className="table-td text-right text-sm text-gray-600">
                  {item.odometer ? `${item.odometer.toLocaleString()} km` : '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No fuel logs</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
