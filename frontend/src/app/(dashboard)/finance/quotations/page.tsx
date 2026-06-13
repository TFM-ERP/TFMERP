'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

const STATUSES = ['DRAFT','SENT','APPROVED','REJECTED','CONVERTED','CANCELLED'];

export default function QuotationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.quotations.list({ search, status: status || undefined, page, limit: 25 });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, status, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Finance · Sales</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Quotations</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{total} quotations total</p>
        </div>
        <Link href="/finance/quotations/new" className="btn-primary">
          <Plus size={15} /> New Quotation
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by number, client, or subject..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="btn-secondary">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-th">Quotation #</th>
              <th className="table-th">Client</th>
              <th className="table-th">Subject</th>
              <th className="table-th">Activity</th>
              <th className="table-th">Issue Date</th>
              <th className="table-th">Valid Until</th>
              <th className="table-th text-right">Total</th>
              <th className="table-th">Status</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="table-td"><div className="h-4 bg-gray-100 rounded animate-pulse"/></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-td text-center py-12 text-gray-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  No quotations found
                </td>
              </tr>
            ) : (
              items.map(q => (
                <tr key={q.id} className="table-row">
                  <td className="table-td font-mono text-xs font-semibold text-brand-600">{q.quotationNumber}</td>
                  <td className="table-td font-medium">{q.client?.companyName}</td>
                  <td className="table-td text-gray-500 max-w-[180px] truncate">{q.subject || '—'}</td>
                  <td className="table-td">
                    <span className={cn('badge text-[10px]',
                      q.activity === 'RENTAL' ? 'bg-brand-50 text-brand-700' : 'bg-production-50 text-production-500'
                    )}>{q.activity}</span>
                  </td>
                  <td className="table-td text-gray-500">{formatDate(q.issueDate)}</td>
                  <td className="table-td text-gray-500">{formatDate(q.validUntil)}</td>
                  <td className="table-td text-right font-semibold">{formatCurrency(q.total)}</td>
                  <td className="table-td">
                    <StatusBadge module="Quotation" status={q.status} size="sm" showIcon={false} showDot />
                  </td>
                  <td className="table-td">
                    <Link href={`/finance/quotations/${q.id}`}
                      className="btn-ghost text-xs px-2 py-1">
                      Open <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 25 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
