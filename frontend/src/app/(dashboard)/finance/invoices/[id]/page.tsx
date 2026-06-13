'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CreditCard, RefreshCw, Building2, Calendar,
  FileText, Plus, X, Clock, AlertCircle, DollarSign,
  Printer, History, ChevronDown, Edit2, CheckCircle
} from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, daysUntil, cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import StatusTimeline from '@/components/StatusTimeline';
import StatusChangeModal from '@/components/StatusChangeModal';

const PAYMENT_METHODS = ['BANK_TRANSFER','CHEQUE','CASH','CARD','ONLINE'];

function PaymentModal({ invoice, bankAccounts, onClose, onDone }: any) {
  const [form, setForm] = useState({
    amount: Number(invoice.amountDue),
    method: 'BANK_TRANSFER',
    bankAccountId: bankAccounts[0]?.id || '',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.amount <= 0) { alert('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await financeApi.invoices.recordPayment(invoice.id, form);
      onDone();
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Payment failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Outstanding summary */}
        <div className="mx-6 mt-4 mb-1 bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-amber-600 font-medium">Amount Outstanding</p>
            <p className="text-lg font-bold text-amber-700">{formatCurrency(invoice.amountDue, invoice.currency)}</p>
          </div>
          <div className="text-right text-xs text-amber-600">
            <p>Invoice {invoice.invoiceNumber}</p>
            {invoice.dueDate && <p>Due {formatDate(invoice.dueDate)}</p>}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Payment Amount (AED) *</label>
              <input type="number" min="0.01" step="0.01" max={Number(invoice.amountDue)}
                className="input text-lg font-semibold" value={form.amount}
                onChange={e => set('amount', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Payment Date</label>
              <input type="date" className="input" value={form.paymentDate}
                onChange={e => set('paymentDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={form.method} onChange={e => set('method', e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Bank Account Received Into</label>
              <select className="input" value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
                <option value="">Not specified</option>
                {bankAccounts.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.bankName} — {b.accountName}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Reference (cheque no. / transfer ref)</label>
              <input className="input" placeholder="e.g. CHQ-001234 or TT ref"
                value={form.reference} onChange={e => set('reference', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input h-16 resize-none text-sm" placeholder="Optional notes..."
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, bankRes] = await Promise.all([
        financeApi.invoices.get(id),
        financeApi.bankAccounts.list(),
      ]);
      setInv(invRes.data);
      setBankAccounts(bankRes.data.filter((b: any) => b.isActive));
    } catch { router.push('/finance/invoices'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (newStatus: string, notes: string) => {
    await financeApi.invoices.updateStatus(id, newStatus, notes);
    await load();
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => <div key={i} className="card h-32 animate-pulse bg-gray-50" />)}
    </div>
  );
  if (!inv) return null;

  const canRecordPayment = ['SENT','PARTIALLY_PAID','OVERDUE'].includes(inv.status);
  const overdueDays = daysUntil(inv.dueDate);
  const isOverdue = overdueDays !== null && overdueDays < 0 && inv.status !== 'PAID';
  const paidPct = inv.total > 0 ? Math.min(100, (Number(inv.amountPaid) / Number(inv.total)) * 100) : 0;

  return (
    <>
      {showPayModal && (
        <PaymentModal
          invoice={inv}
          bankAccounts={bankAccounts}
          onClose={() => setShowPayModal(false)}
          onDone={load}
        />
      )}
      {showStatusModal && (
        <StatusChangeModal
          module="Invoice"
          currentStatus={inv.status}
          recordRef={inv.invoiceNumber}
          onConfirm={handleStatusChange}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/finance/invoices" className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 font-mono">{inv.invoiceNumber}</h1>
                <StatusBadge module="Invoice" status={inv.status} />
                <span className="badge bg-gray-100 text-gray-600 text-[10px]">{inv.invoiceType}</span>
                {inv.activity === 'RENTAL' ? (
                  <span className="badge bg-brand-50 text-brand-700 text-[10px]">RENTAL</span>
                ) : (
                  <span className="badge bg-production-50 text-production-500 text-[10px]">PRODUCTION</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{inv.subject || inv.client?.companyName}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {inv.status === 'DRAFT' && (
              <Link href={`/finance/invoices/${id}/edit`} className="btn-secondary">
                <Edit2 size={14} /> Edit
              </Link>
            )}
            <button onClick={() => setShowStatusModal(true)} className="btn-secondary">
              <ChevronDown size={14} /> Change Status
            </button>
            <button onClick={() => setShowHistory(h => !h)} className={cn('btn-secondary', showHistory && 'bg-gray-100')}>
              <History size={14} /> History
            </button>
            {canRecordPayment && (
              <button onClick={() => setShowPayModal(true)} className="btn-primary">
                <Plus size={14} /> Record Payment
              </button>
            )}
            <button
              onClick={() => window.open(`/print/invoice/${id}`, '_blank')}
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
            <StatusTimeline module="Invoice" recordId={id} />
          </div>
        )}

        {/* Overdue alert */}
        {isOverdue && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-red-700 text-sm font-medium">
              Overdue by {Math.abs(overdueDays!)} days — Due {formatDate(inv.dueDate)}
            </p>
          </div>
        )}

        {/* Quotation link */}
        {inv.quotation && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 text-sm">
            <FileText size={15} className="text-blue-500" />
            <span className="text-blue-700">From quotation</span>
            <Link href={`/finance/quotations/${inv.quotation.id}`}
              className="font-mono font-semibold text-blue-700 hover:underline">
              {inv.quotation.quotationNumber}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Left: items + payments */}
          <div className="col-span-2 space-y-5">

            {/* Payment progress */}
            <div className="card p-5">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Amount Due</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(inv.amountDue, inv.currency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Invoice Total</p>
                  <p className="text-lg font-semibold text-gray-600">{formatCurrency(inv.total, inv.currency)}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', inv.status === 'PAID' ? 'bg-green-500' : 'bg-brand-500')}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1.5">
                <span>{formatCurrency(inv.amountPaid, inv.currency)} paid</span>
                <span>{paidPct.toFixed(0)}% collected</span>
              </div>
            </div>

            {/* Line items */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm">Line Items</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left">Description</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                    <th className="px-3 py-2.5 text-right">VAT</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items?.map((item: any, i: number) => (
                    <tr key={item.id} className={cn('border-b border-gray-50', i % 2 === 0 ? '' : 'bg-gray-50/50')}>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-800">{item.description}</p>
                        {item.details && <p className="text-xs text-gray-400 mt-0.5">{item.details}</p>}
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-gray-600">{Number(item.quantity)} {item.unit}</td>
                      <td className="px-3 py-3 text-right text-sm">{formatCurrency(item.unitPrice, inv.currency)}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-400">
                        {item.taxRate?.name || '—'}
                        {Number(item.taxAmount) > 0 && <span className="block">{formatCurrency(item.taxAmount, inv.currency)}</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">{formatCurrency(item.lineTotal, inv.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  {[
                    ['Subtotal', inv.subtotal],
                    Number(inv.discountAmount) > 0 && ['Discount', `-${formatCurrency(inv.discountAmount, inv.currency)}`],
                    Number(inv.deductionAmount) > 0 && [inv.deductionReason ? `Deduction (${inv.deductionReason})` : 'Deduction', `-${formatCurrency(inv.deductionAmount, inv.currency)}`],
                    Number(inv.vatAmount) > 0 && ['VAT', inv.vatAmount],
                    ['Total', inv.total],
                  ].filter(Boolean).map(([label, val]: any, i, arr) => (
                    <tr key={label} className={i === arr.length - 1 ? 'border-t border-gray-200' : ''}>
                      <td colSpan={4} className={cn('px-5 py-2 text-right text-sm', i === arr.length - 1 ? 'font-bold text-gray-900' : 'text-gray-500')}>
                        {label}
                      </td>
                      <td className={cn('px-5 py-2 text-right', i === arr.length - 1 ? 'font-bold text-xl text-brand-700' : 'font-semibold')}>
                        {typeof val === 'string' ? val : formatCurrency(val, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>

            {/* Payments */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 text-sm">
                  Payment History ({inv.payments?.length || 0})
                </h2>
                {canRecordPayment && (
                  <button onClick={() => setShowPayModal(true)} className="btn-primary text-xs px-3 py-1.5">
                    <Plus size={12} /> Record Payment
                  </button>
                )}
              </div>
              {inv.payments?.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400">
                  <DollarSign size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No payments recorded yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left">Receipt #</th>
                      <th className="px-3 py-2.5 text-left">Date</th>
                      <th className="px-3 py-2.5 text-left">Method</th>
                      <th className="px-3 py-2.5 text-left">Reference</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                      <th className="px-5 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.payments?.map((p: any) => (
                      <tr key={p.id} className="table-row">
                        <td className="table-td font-mono text-xs font-semibold text-brand-600">{p.paymentNumber}</td>
                        <td className="table-td">{formatDate(p.paymentDate)}</td>
                        <td className="table-td text-gray-500">{p.method.replace('_', ' ')}</td>
                        <td className="table-td text-gray-400 text-xs">{p.reference || '—'}</td>
                        <td className="table-td">
                          <span className={cn('badge text-[10px]',
                            p.status === 'CLEARED' ? 'bg-green-100 text-green-700' :
                            p.status === 'BOUNCED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          )}>{p.status}</span>
                        </td>
                        <td className="table-td text-right font-semibold text-green-700">
                          {formatCurrency(p.amount, inv.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Client */}
            <div className="card p-4">
              <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-gray-400" /> Client
              </h2>
              <p className="font-bold text-gray-900">{inv.client?.companyName}</p>
              {inv.client?.trn && <p className="text-xs text-gray-500 mt-0.5">TRN: {inv.client.trn}</p>}
              {inv.poNumber && (
                <p className="text-xs text-brand-600 mt-1.5 font-medium">PO: {inv.poNumber}</p>
              )}
              {inv.client?.contacts?.[0] && (
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <p>{inv.client.contacts[0].name}</p>
                  {inv.client.contacts[0].email && <p>{inv.client.contacts[0].email}</p>}
                  {inv.client.contacts[0].mobile && <p>{inv.client.contacts[0].mobile}</p>}
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="card p-4">
              <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-gray-400" /> Key Dates
              </h2>
              <div className="space-y-1.5 text-sm">
                {[
                  ['Issue Date', inv.issueDate],
                  ['Due Date', inv.dueDate],
                  ['Sent', inv.sentAt],
                ].map(([label, date]) => date ? (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className={cn('font-medium', label === 'Due Date' && isOverdue ? 'text-red-600' : '')}>
                      {formatDate(date as string)}
                    </span>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Bank account */}
            {inv.bankAccount && (
              <div className="card p-4">
                <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-3">
                  <CreditCard size={14} className="text-gray-400" /> Payment To
                </h2>
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p className="font-medium text-gray-800">{inv.bankAccount.accountName}</p>
                  <p>{inv.bankAccount.bankName}</p>
                  {inv.bankAccount.accountNumber && <p className="font-mono text-xs">{inv.bankAccount.accountNumber}</p>}
                  {inv.bankAccount.iban && <p className="font-mono text-xs">{inv.bankAccount.iban}</p>}
                  {inv.bankAccount.swiftCode && <p className="text-xs text-gray-400">SWIFT: {inv.bankAccount.swiftCode}</p>}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="card p-4">
              <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-2">
                <Clock size={14} className="text-gray-400" /> Created
              </h2>
              <div className="text-xs text-gray-500 space-y-1">
                <p>By <span className="text-gray-700 font-medium">{inv.createdBy?.fullName}</span></p>
                <p>{formatDate(inv.createdAt)}</p>
              </div>
            </div>

            {/* Deduction audit trail */}
            {Number(inv.deductionAmount) > 0 && (
              <div className="card p-4 border-amber-200 bg-amber-50/40">
                <h2 className="font-semibold text-amber-800 text-sm flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-amber-500" /> Deduction Applied
                </h2>
                <div className="text-xs text-gray-600 space-y-1">
                  <p className="text-base font-bold text-amber-700">− {formatCurrency(inv.deductionAmount, inv.currency)}</p>
                  {inv.deductionReason && <p><span className="text-gray-400">Reason:</span> {inv.deductionReason}</p>}
                  {inv.deductionAppliedBy?.fullName && <p><span className="text-gray-400">By:</span> {inv.deductionAppliedBy.fullName}</p>}
                  {inv.deductionAppliedAt && <p><span className="text-gray-400">On:</span> {formatDate(inv.deductionAppliedAt)}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
