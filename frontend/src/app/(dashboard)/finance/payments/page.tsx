'use client';

import { useEffect, useState, useCallback } from 'react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { CinematicHeader } from '@/components/CinematicHeader';

const STATUS_OPTIONS = ['', 'PENDING', 'CLEARED', 'BOUNCED', 'REFUNDED'];

const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-700',
  CLEARED:  'bg-green-100 text-green-700',
  BOUNCED:  'bg-red-100 text-red-600',
  REFUNDED: 'bg-gray-100 text-gray-600',
};

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  CARD: 'Card',
  ONLINE: 'Online',
};

export default function PaymentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      financeApi.payments.list({ status: status || undefined, page, limit: 25 }),
      financeApi.payments.summary(),
    ])
      .then(([pr, sr]) => {
        setItems(pr.data.items || []);
        setTotal(pr.data.total || 0);
        setSummary(sr.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    await financeApi.payments.updateStatus(id, newStatus);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <CinematicHeader kicker="Finance · Cash" title="Payments" count={`${total} payments`}>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </CinematicHeader>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Cleared</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.cleared)}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center shrink-0">
              <Clock size={18} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Pending</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.pending)}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <XCircle size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Bounced</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.bounced)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Reference</th>
              <th className="table-th">Client</th>
              <th className="table-th">Invoice</th>
              <th className="table-th">Method</th>
              <th className="table-th">Date</th>
              <th className="table-th">Amount</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => (
              <tr key={p.id} className="table-row">
                <td className="table-td font-mono text-xs text-gray-500">{p.paymentNumber}</td>
                <td className="table-td text-sm font-medium text-gray-800">{p.client?.companyName}</td>
                <td className="table-td text-xs text-gray-500">{p.invoice?.invoiceNumber}</td>
                <td className="table-td text-sm text-gray-600">{METHOD_LABEL[p.method] || p.method}</td>
                <td className="table-td text-sm text-gray-500">{formatDate(p.paymentDate)}</td>
                <td className="table-td text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                <td className="table-td">
                  <span className={cn('badge text-xs', STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-500')}>
                    {p.status}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex gap-1">
                    {p.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleUpdateStatus(p.id, 'CLEARED')}
                          className="text-xs text-green-600 hover:text-green-700 font-medium">Clear</button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => handleUpdateStatus(p.id, 'BOUNCED')}
                          className="text-xs text-red-500 hover:text-red-600 font-medium">Bounce</button>
                      </>
                    )}
                    {p.status === 'BOUNCED' && (
                      <button onClick={() => handleUpdateStatus(p.id, 'PENDING')}
                        className="text-xs text-yellow-600 hover:text-yellow-700 font-medium">Reopen</button>
                    )}
                    {p.status === 'CLEARED' && (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No payments found</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 25 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="btn btn-secondary py-1 disabled:opacity-40">Previous</button>
              <button disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
