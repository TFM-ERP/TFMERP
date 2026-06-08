'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { financeApi, clientsApi, companyApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import LineItemsEditor, { LineItem } from '@/components/finance/LineItemsEditor';

export default function EditInvoicePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    clientId: '',
    bankAccountId: '',
    activity: 'RENTAL',
    invoiceType: 'TAX_INVOICE',
    issueDate: '',
    dueDate: '',
    currency: 'AED',
    subject: '',
    notes: '',
    termsConditions: '',
    poNumber: '',
    vatDisplay: 'SEPARATE',
    deductionAmount: 0,
    deductionReason: '',
  });

  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    Promise.all([
      financeApi.invoices.get(id),
      clientsApi.list(),
      companyApi.bankAccounts.list(),
      financeApi.vat.list(),
    ]).then(([ir, cr, br, vr]) => {
      const inv = ir.data;
      if (inv.status !== 'DRAFT') { setBlocked(true); return; }
      setClients(cr.data.items || cr.data || []);
      setBankAccounts(br.data || []);
      setTaxRates(vr.data || []);
      setForm({
        clientId: inv.clientId || '',
        bankAccountId: inv.bankAccountId || '',
        activity: inv.activity || 'RENTAL',
        invoiceType: inv.invoiceType || 'TAX_INVOICE',
        issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : '',
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
        currency: inv.currency || 'AED',
        subject: inv.subject || '',
        notes: inv.notes || '',
        termsConditions: inv.termsConditions || '',
        poNumber: inv.poNumber || '',
        vatDisplay: inv.vatDisplay || 'SEPARATE',
        deductionAmount: Number(inv.deductionAmount || 0),
        deductionReason: inv.deductionReason || '',
      });
      setItems((inv.items || []).map((i: any) => ({
        id: i.id || crypto.randomUUID(),
        kind: (i.kind === 'SERVICE' ? 'SERVICE' : 'ASSET') as 'ASSET' | 'SERVICE',
        description: i.description || '',
        details: i.details || '',
        quantity: Number(i.quantity || 1),
        unit: i.unit || 'day',
        days: Number(i.days || 1),
        unitPrice: Number(i.unitPrice || 0),
        discountPct: Number(i.discountPct || 0),
        taxRateId: i.taxRateId || '',
        taxAmount: Number(i.taxAmount || 0),
        lineTotal: Number(i.lineTotal || 0),
      })));
    }).catch(() => router.push('/finance/invoices'))
      .finally(() => setLoading(false));
  }, [id]);

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const rawVat = items.reduce((s, i) => s + i.taxAmount, 0);
  const deductionAmount = Math.min(Math.max(Number(form.deductionAmount) || 0, 0), Math.max(subtotal, 0));
  const vatTotal = subtotal > 0 ? rawVat * ((subtotal - deductionAmount) / subtotal) : 0;
  const grandTotal = subtotal - deductionAmount + vatTotal;

  const handleSave = async () => {
    if (!form.clientId) { setError('Please select a client'); return; }
    if (items.length === 0) { setError('Please add at least one line item'); return; }
    if (items.some(i => !i.description)) { setError('All line items need a description'); return; }
    setSaving(true); setError('');
    try {
      await financeApi.invoices.update(id, {
        ...form,
        dueDate: form.dueDate || undefined,
        bankAccountId: form.bankAccountId || undefined,
        deductionAmount: Number(form.deductionAmount) || 0,
        deductionReason: form.deductionReason || undefined,
        items: items.map((item) => ({
          kind: item.kind || 'ASSET',
          description: item.description,
          details: item.details || undefined,
          quantity: item.quantity,
          unit: item.unit,
          days: item.days,
          unitPrice: item.unitPrice,
          discountPct: item.discountPct,
          taxRateId: item.taxRateId || undefined,
          taxAmount: item.taxAmount,
        })),
      });
      router.push(`/finance/invoices/${id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update invoice');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i => <div key={i} className="card h-32 animate-pulse bg-gray-50" />)}</div>;
  if (blocked) return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="card p-6 text-center space-y-3">
        <p className="text-gray-700 font-medium">This invoice can no longer be edited.</p>
        <p className="text-sm text-gray-500">Only invoices in <b>Draft</b> status can be edited.</p>
        <Link href={`/finance/invoices/${id}`} className="btn-primary inline-flex">Back to invoice</Link>
      </div>
    </div>
  );

  return (
    <div className="p-6 w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/finance/invoices/${id}`} className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Edit Invoice</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Client *</label>
                <select className="input w-full" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Select client...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Invoice Type</label>
                <select className="input w-full" value={form.invoiceType} onChange={e => setForm(f => ({ ...f, invoiceType: e.target.value }))}>
                  <option value="TAX_INVOICE">Tax Invoice</option>
                  <option value="PROFORMA">Proforma Invoice</option>
                  <option value="CREDIT_NOTE">Credit Note</option>
                </select>
              </div>
              <div>
                <label className="label">Activity</label>
                <select className="input w-full" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}>
                  <option value="RENTAL">Rental</option>
                  <option value="PRODUCTION">Production</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <div>
                <label className="label">Issue Date</label>
                <input type="date" className="input w-full" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input w-full" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <label className="label">PO / Reference No.</label>
                <input className="input w-full" value={form.poNumber} onChange={e => setForm(f => ({ ...f, poNumber: e.target.value }))} />
              </div>
              <div>
                <label className="label">Subject</label>
                <input className="input w-full" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Line Items</h3>
            <LineItemsEditor
              items={items}
              vatRates={taxRates.map((t: any) => ({ id: t.id, name: t.name, rate: Number(t.rate) }))}
              onChange={setItems}
              currency={form.currency}
            />
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Notes & Terms</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Notes (shown on invoice)</label>
                <textarea className="input w-full" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label className="label">Terms & Conditions</label>
                <textarea className="input w-full" rows={2} value={form.termsConditions} onChange={e => setForm(f => ({ ...f, termsConditions: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {deductionAmount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Deduction{form.deductionReason ? ` (${form.deductionReason})` : ''}</span>
                  <span>− {formatCurrency(deductionAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">VAT</span>
                <span className="font-medium">{formatCurrency(vatTotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-bold text-gray-900">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Deduction</h3>
            <p className="text-[11px] text-gray-400 mb-3">Fixed manual reduction applied before VAT (goodwill, adjustment, negotiated reduction).</p>
            <div className="space-y-3">
              <div>
                <label className="label">Deduction Amount ({form.currency})</label>
                <input type="number" min="0" step="0.01" className="input w-full"
                  value={form.deductionAmount}
                  onChange={e => setForm(f => ({ ...f, deductionAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              {Number(form.deductionAmount) > 0 && (
                <div>
                  <label className="label">Reason / Note</label>
                  <input className="input w-full text-sm" placeholder="e.g. Goodwill discount"
                    value={form.deductionReason}
                    onChange={e => setForm(f => ({ ...f, deductionReason: e.target.value }))} />
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Bank Account</h3>
            <select className="input w-full text-sm" value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}>
              <option value="">No bank account</option>
              {bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.bankName} — {b.accountName}</option>)}
            </select>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">VAT Display</h3>
            <select className="input w-full text-sm" value={form.vatDisplay} onChange={e => setForm(f => ({ ...f, vatDisplay: e.target.value }))}>
              <option value="SEPARATE">Show VAT separately</option>
              <option value="INCLUDED">VAT included in price</option>
              <option value="EXCLUDED">Exclusive of VAT</option>
              <option value="HIDDEN">Hide VAT</option>
            </select>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full justify-center disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href={`/finance/invoices/${id}`} className="btn btn-secondary w-full justify-center">Cancel</Link>
        </div>
      </div>
    </div>
  );
}
