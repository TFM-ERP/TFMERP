'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { rentalApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { CinematicHeader } from '@/components/CinematicHeader';

export default function DriversPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    rentalApi.drivers.list({ search: search || undefined, page, limit: 25 })
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    rentalApi.drivers.expiryAlerts().then(r => setAlerts(r.data)).catch(() => {});
  }, []);

  const daysUntil = (date: string) => {
    const diff = (new Date(date).getTime() - Date.now()) / 86400000;
    return Math.ceil(diff);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CinematicHeader kicker="Rentals · People" title="Drivers" count={`${total} drivers`}>
        <Link href="/rental/drivers/new" className="btn btn-primary">+ Add Driver</Link>
      </CinematicHeader>

      {alerts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{alerts.length} driver(s)</span> have documents expiring within 30 days.
          </p>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search drivers..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">Type</th>
              <th className="table-th">Mobile</th>
              <th className="table-th">License Expiry</th>
              <th className="table-th">Visa Expiry</th>
              <th className="table-th text-right">Jobs</th>
            </tr>
          </thead>
          <tbody>
            {items.map(d => {
              const licDays = d.licenseExpiry ? daysUntil(d.licenseExpiry) : null;
              const visaDays = d.visaExpiry ? daysUntil(d.visaExpiry) : null;
              return (
                <tr key={d.id} className="table-row">
                  <td className="table-td">
                    <Link href={`/rental/drivers/${d.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                      {d.fullName}
                    </Link>
                    {!d.isActive && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
                  </td>
                  <td className="table-td text-sm text-gray-600">{d.driverType}</td>
                  <td className="table-td text-sm text-gray-600">{d.mobile}</td>
                  <td className="table-td text-sm">
                    <span className={cn(licDays !== null && licDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-600')}>
                      {d.licenseExpiry ? formatDate(d.licenseExpiry) : '—'}
                    </span>
                  </td>
                  <td className="table-td text-sm">
                    <span className={cn(visaDays !== null && visaDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-600')}>
                      {d.visaExpiry ? formatDate(d.visaExpiry) : '—'}
                    </span>
                  </td>
                  <td className="table-td text-right text-sm text-gray-600">{d._count?.jobs ?? 0}</td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No drivers found</td></tr>
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
