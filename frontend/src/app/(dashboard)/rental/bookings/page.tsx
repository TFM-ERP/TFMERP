'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { rentalApi, clientsApi } from '@/lib/api';
import { formatDate, cn, STATUS_LABELS } from '@/lib/utils';
import { Search, RefreshCw, Calendar } from 'lucide-react';
import { CinematicHeader } from '@/components/CinematicHeader';
import StatusBadge from '@/components/StatusBadge';

export default function BookingsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    rentalApi.bookings.list({
      search: search || undefined,
      status: status || undefined,
      page,
      limit: 25,
    })
      .then(r => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CinematicHeader kicker="Rentals · Fleet" title="Rental Bookings" count={`${total} bookings`}>
        <div className="flex gap-2">
          <Link href="/rental/bookings/calendar" className="btn btn-secondary flex items-center gap-1.5">
            <Calendar size={14} /> Calendar
          </Link>
          <Link href="/rental/bookings/new" className="btn btn-primary">+ New Booking</Link>
        </div>
      </CinematicHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search by booking #, client, PO..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-52" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Booking #</th>
              <th className="table-th">Client</th>
              <th className="table-th">Start Date</th>
              <th className="table-th">End Date</th>
              <th className="table-th">Status</th>
              <th className="table-th text-right">Items</th>
              <th className="table-th text-right">Total (AED)</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="table-row">
                <td className="table-td">
                  <Link href={`/rental/bookings/${item.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                    {item.bookingNumber}
                  </Link>
                  {item.poNumber && <div className="text-xs text-gray-400">PO: {item.poNumber}</div>}
                </td>
                <td className="table-td text-sm text-gray-700">{item.client?.companyName}</td>
                <td className="table-td text-sm text-gray-600">{formatDate(item.startDate)}</td>
                <td className="table-td text-sm text-gray-600">{formatDate(item.endDate)}</td>
                <td className="table-td">
                  <StatusBadge module="Booking" status={item.status} size="sm" showIcon={false} showDot />
                </td>
                <td className="table-td text-right text-sm text-gray-600">{item._count?.items ?? 0}</td>
                <td className="table-td text-right text-sm font-medium text-gray-800">
                  {Number(item.total).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No bookings found</td></tr>
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
