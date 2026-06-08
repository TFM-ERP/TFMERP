'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, AlertCircle, RefreshCw, FileText, ArrowRight } from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, daysUntil, cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

const STATUSES = ['DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED'];

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdueOnly') === 'true');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.invoices.list({
        search, status: status || undefined,
        overdueOnly: overdueOnly ? true : undefined,
        page, limit: 25,
      });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, status, overdueOnly, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">{total} invoices total</p>
        </div>
        <Link href="/finance/invoices/new" className="btn-primary">
          <Plus size={15} /> New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search invoice number, client, PO..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-600" />
          <AlertCircle size={14} className="text-red-500" /> Overdue only
        </label>
        <button onClick={load} className="btn-secondary">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-th">Invoice #</th>
              <th className="table-th">Client</th>
              <th className="table-th">PO Ref</th>
              <th className="table-th">Issue Date</th>
              <th className="table-th">Due Date</th>
              <th className="table-th text-right">Total</th>
              <th className="table-th text-right">Amount Due</th>
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
                  No invoices found
                </td>
              </tr>
            ) : (
              items.map(inv => {
                const overdueDays = daysUntil(inv.dueDate);
                const isOverdue = overdueDays !== null && overdueDays < 0 && inv.status !== 'PAID';
                return (
                  <tr key={inv.id} className={cn('table-row', isOverdue && 'bg-red-50/30')}>
                    <td className="table-td font-mono text-xs font-semibold text-brand-600">{inv.invoiceNumber}</td>
                    <td className="table-td font-medium">{inv.client?.companyName}</td>
                    <td className="table-td text-gray-400 text-xs">{inv.poNumber || '—'}</td>
                    <td className="table-td text-gray-500">{formatDate(inv.issueDate)}</td>
                    <td className="table-td">
                      <span className={cn(isOverdue && 'text-red-600 font-medium')}>
                        {formatDate(inv.dueDate)}
                        {isOverdue && <span className="ml-1 text-xs">({Math.abs(overdueDays!)}d overdue)</span>}
                      </span>
                    </td>
                    <td className="table-td text-right font-medium">{formatCurrency(inv.total)}</td>
                    <td className={cn('table-td text-right font-semibold', Number(inv.amountDue) > 0 && 'text-amber-600')}>
                      {formatCurrency(inv.amountDue)}
                    </td>
                    <td className="table-td">
                      <StatusBadge module="Invoice" status={inv.status} size="sm" showIcon={false} showDot />
                    </td>
                    <td className="table-td">
                      <Link href={`/finance/invoices/${inv.id}`} className="btn-ghost text-xs px-2 py-1">
                        Open <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {total > 25 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {(page-1)*25+1}–{Math.min(page*25, total)} of {total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>Prev</button>
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(p => p+1)} disabled={page*25>=total}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
