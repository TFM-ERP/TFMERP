'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { rentalApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-yellow-100 text-yellow-700',
  MAJOR: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function DamagePage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    rentalApi.damage.list({ severity: severity || undefined, page, limit: 25 })
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [severity, page]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id: string) => {
    const costStr = prompt('Enter repair cost (AED):');
    if (costStr === null) return;
    const cost = Number(costStr);
    try {
      await rentalApi.damage.resolve(id, cost);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to resolve');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Fleet</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Damage Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{total} reports</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-36" value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}>
            <option value="">All Severity</option>
            <option value="MINOR">Minor</option>
            <option value="MAJOR">Major</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <button onClick={load} className="btn btn-secondary p-2">
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Report #</th>
              <th className="table-th">Asset</th>
              <th className="table-th">Booking</th>
              <th className="table-th">Severity</th>
              <th className="table-th">Reported</th>
              <th className="table-th">Resolved</th>
              <th className="table-th text-right">Repair Cost</th>
              <th className="table-th">Bill Client?</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="table-row">
                <td className="table-td">
                  <span className="font-medium text-gray-900 text-sm">{item.reportNumber}</span>
                </td>
                <td className="table-td">
                  <Link href={`/rental/assets/${item.asset?.id}`} className="text-sm text-brand-600 hover:underline">
                    {item.asset?.name}
                  </Link>
                </td>
                <td className="table-td">
                  {item.booking ? (
                    <Link href={`/rental/bookings/${item.booking.id}`} className="text-sm text-brand-600 hover:underline">
                      {item.booking.bookingNumber}
                    </Link>
                  ) : '—'}
                </td>
                <td className="table-td">
                  <span className={cn('badge', SEVERITY_COLORS[item.severity] || 'bg-gray-100 text-gray-600')}>
                    {item.severity}
                  </span>
                </td>
                <td className="table-td text-sm text-gray-600">{formatDate(item.reportedAt)}</td>
                <td className="table-td text-sm">
                  {item.resolvedAt ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 size={12} /> {formatDate(item.resolvedAt)}
                    </span>
                  ) : (
                    <span className="text-amber-500 text-xs">Pending</span>
                  )}
                </td>
                <td className="table-td text-right text-sm text-gray-600">
                  {item.repairCost ? `AED ${Number(item.repairCost).toLocaleString()}` : '—'}
                </td>
                <td className="table-td text-center">
                  {item.chargeToClient ? (
                    <span className="text-xs font-medium text-red-600">Yes</span>
                  ) : (
                    <span className="text-xs text-gray-400">No</span>
                  )}
                </td>
                <td className="table-td">
                  {!item.resolvedAt && (
                    <button onClick={() => handleResolve(item.id)} className="text-xs text-green-600 hover:underline">
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">No damage reports</td></tr>
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
