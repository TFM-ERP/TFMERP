'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, FileText, RefreshCw,
  Building2, Calendar, CreditCard, Edit2,
  ArrowRight, Clock, Printer, History, ChevronDown, X
} from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import StatusTimeline from '@/components/StatusTimeline';
import StatusChangeModal from '@/components/StatusChangeModal';

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [q, setQ]                       = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [converting, setConverting]     = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistory, setShowHistory]   = useState(false);

  const load = async () => {
    setLoading(true);
    try { setQ((await financeApi.quotations.get(id)).data); }
    catch { router.push('/finance/quotations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (newStatus: string, notes: string) => {
    await financeApi.quotations.updateStatus(id, newStatus, notes);
    await load();
  };

  const convertToInvoice = async () => {
    if (!confirm('Convert this quotation to a Tax Invoice?')) return;
    setConverting(true);
    try {
      const res = await financeApi.quotations.convertToInvoice(id);
      router.push(`/finance/invoices/${res.data.id}`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Conversion failed');
    } finally { setConverting(false); }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => <div key={i} className="card h-32 animate-pulse bg-gray-50" />)}
    </div>
  );

  if (!q) return null;

  const canConvert = ['APPROVED', 'SENT'].includes(q.status);

  return (
    <>
      {showStatusModal && (
        <StatusChangeModal
          module="Quotation"
          currentStatus={q.status}
          recordRef={q.quotationNumber}
          onConfirm={handleStatusChange}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    <div className="p-6 max-w-[1700px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/quotations" className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{q.quotationNumber}</h1>
              <StatusBadge module="Quotation" status={q.status} />
            </div>
            <p className="text-sm text-gray-500">{q.subject || 'No subject'}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {q.status === 'DRAFT' && (
            <Link href={`/finance/quotations/${id}/edit`} className="btn-secondary">
              <Edit2 size={14} /> Edit
            </Link>
          )}
          <button onClick={() => setShowStatusModal(true)} className="btn-secondary">
            <ChevronDown size={14} /> Change Status
          </button>
          <button onClick={() => setShowHistory(h => !h)} className={cn('btn-secondary', showHistory && 'bg-gray-100')}>
            <History size={14} /> History
          </button>
          {canConvert && (
            <button onClick={convertToInvoice} disabled={converting}
              className="btn-primary">
              {converting ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
              Convert to Invoice
            </button>
          )}
          <button
            onClick={() => window.open(`/print/quotation/${id}`, '_blank')}
            className="btn-secondary"
            title="Print / Save as PDF"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Status History Timeline */}
      {showHistory && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <History size={15} /> Status History
            </h3>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <StatusTimeline module="Quotation" recordId={id} />
        </div>
      )}

      {/* Linked invoices banner */}
      {q.invoices?.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-700 text-sm font-medium">
            <CheckCircle size={16} />
            Converted — {q.invoices.length} invoice{q.invoices.length > 1 ? 's' : ''} generated
          </div>
          <div className="flex gap-2">
            {q.invoices.map((inv: any) => (
              <Link key={inv.id} href={`/finance/invoices/${inv.id}`}
                className="btn-secondary text-xs px-3 py-1">
                {inv.invoiceNumber} <ArrowRight size={11} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-5">

          {/* Line items */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">Line Items</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 text-right">Disc %</th>
                  <th className="px-3 py-2.5 text-right">VAT</th>
                  <th className="px-5 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {q.items?.map((item: any, i: number) => (
                  <tr key={item.id} className={cn('border-b border-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-800">{item.description}</p>
                      {item.details && <p className="text-xs text-gray-400 mt-0.5">{item.details}</p>}
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-gray-600">
                      {Number(item.quantity)} {item.unit}
                    </td>
                    <td className="px-3 py-3 text-right text-sm">{formatCurrency(item.unitPrice, q.currency)}</td>
                    <td className="px-3 py-3 text-right text-sm text-gray-400">
                      {Number(item.discountPct) > 0 ? `${item.discountPct}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-500">
                      {item.taxRate ? `${item.taxRate.name}` : '—'}
                      {Number(item.taxAmount) > 0 && (
                        <span className="block text-[10px]">{formatCurrency(item.taxAmount, q.currency)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(item.lineTotal, q.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={5} className="px-5 py-2.5 text-right text-sm text-gray-500">Subtotal</td>
                  <td className="px-5 py-2.5 text-right font-semibold">{formatCurrency(q.subtotal, q.currency)}</td>
                </tr>
                {Number(q.discountAmount) > 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-1.5 text-right text-sm text-green-600">Discount</td>
                    <td className="px-5 py-1.5 text-right text-green-600 font-semibold">
                      − {formatCurrency(q.discountAmount, q.currency)}
                    </td>
                  </tr>
                )}
                {Number(q.deductionAmount) > 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-1.5 text-right text-sm text-amber-600">
                      {q.deductionReason ? `Deduction (${q.deductionReason})` : 'Deduction'}
                    </td>
                    <td className="px-5 py-1.5 text-right text-amber-600 font-semibold">
                      − {formatCurrency(q.deductionAmount, q.currency)}
                    </td>
                  </tr>
                )}
                {Number(q.vatAmount) > 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-1.5 text-right text-sm text-gray-500">VAT</td>
                    <td className="px-5 py-1.5 text-right font-semibold">{formatCurrency(q.vatAmount, q.currency)}</td>
                  </tr>
                )}
                <tr className="border-t border-gray-200">
                  <td colSpan={5} className="px-5 py-3 text-right font-bold text-gray-900">Total</td>
                  <td className="px-5 py-3 text-right font-bold text-xl text-brand-700">
                    {formatCurrency(q.total, q.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {(q.notes || q.termsConditions) && (
            <div className="card p-5 space-y-4">
              {q.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{q.notes}</p>
                </div>
              )}
              {q.termsConditions && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Terms & Conditions</h3>
                  <p className="text-sm text-gray-500 whitespace-pre-line">{q.termsConditions}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Building2 size={14} className="text-gray-400" /> Client
            </h2>
            <div>
              <p className="font-bold text-gray-900">{q.client?.companyName}</p>
              {q.client?.trn && <p className="text-xs text-gray-500">TRN: {q.client.trn}</p>}
              {q.client?.contacts?.[0] && (
                <div className="mt-2 text-xs text-gray-500">
                  <p>{q.client.contacts[0].name}</p>
                  {q.client.contacts[0].email && <p>{q.client.contacts[0].email}</p>}
                  {q.client.contacts[0].mobile && <p>{q.client.contacts[0].mobile}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="card p-4 space-y-2">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" /> Dates
            </h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Issue Date</span>
                <span className="font-medium">{formatDate(q.issueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valid Until</span>
                <span className="font-medium">{formatDate(q.validUntil)}</span>
              </div>
              {q.sentAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sent</span>
                  <span className="font-medium">{formatDate(q.sentAt)}</span>
                </div>
              )}
              {q.approvedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Approved</span>
                  <span className="font-medium text-green-600">{formatDate(q.approvedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bank account */}
          {q.bankAccount && (
            <div className="card p-4 space-y-2">
              <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <CreditCard size={14} className="text-gray-400" /> Bank Account
              </h2>
              <div className="text-sm text-gray-600 space-y-0.5">
                <p className="font-medium text-gray-800">{q.bankAccount.accountName}</p>
                {q.bankAccount.iban && <p className="font-mono text-xs">{q.bankAccount.iban}</p>}
                <p>{q.bankAccount.bankName}</p>
              </div>
            </div>
          )}

          {/* Activity */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-2">
              <Clock size={14} className="text-gray-400" /> Activity
            </h2>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Created by <span className="text-gray-700 font-medium">{q.createdBy?.fullName}</span></p>
              <p>{formatDate(q.createdAt)}</p>
              {q.approvedBy && (
                <p>Approved by <span className="text-gray-700 font-medium">{q.approvedBy.fullName}</span></p>
              )}
            </div>
          </div>

          {/* Deduction audit trail */}
          {Number(q.deductionAmount) > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50/40">
              <h2 className="font-semibold text-amber-800 text-sm mb-2">Deduction Applied</h2>
              <div className="text-xs text-gray-600 space-y-1">
                <p className="text-base font-bold text-amber-700">− {formatCurrency(q.deductionAmount, q.currency)}</p>
                {q.deductionReason && <p><span className="text-gray-400">Reason:</span> {q.deductionReason}</p>}
                {q.deductionAppliedBy?.fullName && <p><span className="text-gray-400">By:</span> {q.deductionAppliedBy.fullName}</p>}
                {q.deductionAppliedAt && <p><span className="text-gray-400">On:</span> {formatDate(q.deductionAppliedAt)}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
