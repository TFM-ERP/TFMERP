'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, AlertCircle, RefreshCw, FileText, ArrowRight, Archive, ArchiveRestore, X } from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, daysUntil, cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { useLocale } from '@/lib/i18n';
import { useCan } from '@/lib/permissions';

const STATUSES = ['DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED'];
const RETRY_COPY = "Something went wrong sending that — the invoice hasn't changed. Check your connection and try again.";

/**
 * Archive confirm dialog. Inline in this file per house style (PaymentModal /
 * ShareModal on the detail page live in that file the same way) — there is
 * no shared Modal/Confirm component in this app.
 */
function ArchiveConfirmDialog({ invoiceNumber, submitting, error, onCancel, onConfirm, t }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">
            {t('Archive invoice {number}?').replace('{number}', invoiceNumber)}
          </h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" disabled={submitting}>
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            {t('It disappears from your invoice list. Nothing about the invoice or your numbers changes, and you can put it back any time.')}
          </p>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
          )}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={submitting}>{t('Cancel')}</button>
          <button onClick={onConfirm} className="btn-primary flex-1" disabled={submitting}>
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Archive size={14} />}
            {t('Archive')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const { t } = useLocale();
  const { can: canArchive, loading: canArchiveLoading } = useCan('finance', 2);
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdueOnly') === 'true');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  // Archive/unarchive row action state.
  const [archiveTarget, setArchiveTarget] = useState<any>(null); // row awaiting confirm, or null
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [archiveDialogError, setArchiveDialogError] = useState('');
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.invoices.list({
        search, status: status || undefined,
        overdueOnly: overdueOnly ? true : undefined,
        archived: showArchived ? 'true' : undefined,
        page, limit: 25,
      });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, status, overdueOnly, showArchived, page]);

  useEffect(() => { load(); }, [load]);

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveSubmitting(true);
    setArchiveDialogError('');
    try {
      await financeApi.invoices.archive(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (e) {
      setArchiveDialogError(t(RETRY_COPY));
    } finally {
      setArchiveSubmitting(false);
    }
  };

  const handleUnarchive = async (inv: any) => {
    setBusyRowId(inv.id);
    setActionError('');
    try {
      await financeApi.invoices.unarchive(inv.id);
      await load();
    } catch (e) {
      setActionError(t(RETRY_COPY));
    } finally {
      setBusyRowId(null);
    }
  };

  return (
    <>
      {archiveTarget && (
        <ArchiveConfirmDialog
          invoiceNumber={archiveTarget.invoiceNumber}
          submitting={archiveSubmitting}
          error={archiveDialogError}
          onCancel={() => { if (!archiveSubmitting) setArchiveTarget(null); }}
          onConfirm={confirmArchive}
          t={t}
        />
      )}
    <div className="p-6 space-y-5">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>{t('Finance · Receivables')}</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>{t('Invoices')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{total} {t('invoices total')}</p>
        </div>
        <Link href="/finance/invoices/new" className="btn-primary">
          <Plus size={15} /> {t('New Invoice')}
        </Link>
      </div>

      {actionError && (
        <div className="card flex items-center gap-2 text-sm text-red-700 bg-red-50 border-red-200">
          <AlertCircle size={15} className="shrink-0" />
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="ms-auto text-red-600 hover:text-red-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input ps-9" placeholder={t('Search invoice number, client, PO...')}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t('All Statuses')}</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-600" />
          <AlertCircle size={14} className="text-red-500" /> {t('Overdue only')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={e => { setShowArchived(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-gray-300 text-brand-600" />
          <Archive size={14} className="text-gray-400" /> {t('Show archived invoices')}
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
              <th className="table-th">{t('Invoice #')}</th>
              <th className="table-th">{t('Client')}</th>
              <th className="table-th">{t('PO Ref')}</th>
              <th className="table-th">{t('Issue Date')}</th>
              <th className="table-th">{t('Due Date')}</th>
              <th className="table-th text-end">{t('Total')}</th>
              <th className="table-th text-end">{t('Amount Due')}</th>
              <th className="table-th">{t('Status')}</th>
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
                  {t('No invoices found')}
                </td>
              </tr>
            ) : (
              items.map(inv => {
                const overdueDays = daysUntil(inv.dueDate);
                const isOverdue = overdueDays !== null && overdueDays < 0 && inv.status !== 'PAID';
                const isArchived = !!inv.archivedAt;
                return (
                  <tr key={inv.id} className={cn('table-row', isOverdue && 'bg-red-50/30', isArchived && 'opacity-50')}>
                    <td className="table-td font-mono text-xs font-semibold text-brand-600">{inv.invoiceNumber}</td>
                    <td className="table-td font-medium">{inv.client?.companyName}</td>
                    <td className="table-td text-gray-400 text-xs">{inv.poNumber || '—'}</td>
                    <td className="table-td text-gray-500">{formatDate(inv.issueDate)}</td>
                    <td className="table-td">
                      <span className={cn(isOverdue && 'text-red-600 font-medium')}>
                        {formatDate(inv.dueDate)}
                        {isOverdue && <span className="ms-1 text-xs">({Math.abs(overdueDays!)}{t('d overdue')})</span>}
                      </span>
                    </td>
                    <td className="table-td text-end font-medium">{formatCurrency(inv.total)}</td>
                    <td className={cn('table-td text-end font-semibold', Number(inv.amountDue) > 0 && 'text-amber-600')}>
                      {formatCurrency(inv.amountDue)}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge module="Invoice" status={inv.status} size="sm" showIcon={false} showDot />
                        {isArchived && (
                          <span className="badge bg-gray-100 text-gray-400 text-[10px]">{t('Archived')}</span>
                        )}
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/finance/invoices/${inv.id}`} className="btn-ghost text-xs px-2 py-1">
                          Open <ArrowRight size={12} />
                        </Link>
                        {!canArchiveLoading && canArchive && (
                          isArchived ? (
                            <button
                              onClick={() => handleUnarchive(inv)}
                              disabled={busyRowId === inv.id}
                              className="btn-ghost text-xs px-2 py-1"
                            >
                              <ArchiveRestore size={12} /> {t('Unarchive')}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setArchiveDialogError(''); setArchiveTarget(inv); }}
                              disabled={busyRowId === inv.id}
                              className="btn-ghost text-xs px-2 py-1"
                            >
                              <Archive size={12} /> {t('Archive')}
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {total > 25 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>{t('Showing')} {(page-1)*25+1}–{Math.min(page*25, total)} {t('of')} {total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>{t('Prev')}</button>
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(p => p+1)} disabled={page*25>=total}>{t('Next')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
