'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Send, ChevronDown } from 'lucide-react';
import { financeApi, clientsApi, companyApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import LineItemsEditor, { LineItem } from '@/components/finance/LineItemsEditor';

const VAT_DISPLAY_OPTIONS = [
  { value: 'SEPARATE', label: 'Show VAT separately' },
  { value: 'INCLUDED', label: 'VAT included in prices' },
  { value: 'EXCLUDED', label: 'VAT excluded (shown at bottom)' },
  { value: 'HIDDEN', label: 'Hide VAT until invoice stage' },
];

export default function NewQuotationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [vatRates, setVatRates] = useState<any[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);

  // Form state
  const [form, setForm] = useState({
    clientId: '',
    bankAccountId: '',
    activity: 'RENTAL',
    currency: 'AED',
    issueDate: new Date().toISOString().split('T')[0],
    validUntil: '',
    subject: '',
    notes: '',
    termsConditions: 'Payment due within 30 days of invoice date.\nPrices are subject to VAT at the applicable rate.\nAll prices are in AED unless otherwise stated.',
    internalNotes: '',
    vatDisplay: 'SEPARATE',
    vatNote: '',
    discountType: '',
    discountValue: 0,
    deductionAmount: 0,
    deductionReason: '',
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    Promise.all([
      clientsApi.list(),
      companyApi.bankAccounts.list(),  // bank accounts come from Company Management
      financeApi.vat.list(),
    ]).then(([c, b, v]) => {
      setClients(c.data);
      const banks = b.data || [];
      setBankAccounts(banks);
      setVatRates(v.data);
      // Pre-select the Company Management default account
      const defBank = banks.find((a: any) => a.isDefault) || banks[0];
      if (defBank) set('bankAccountId', defBank.id);
    });
  }, []);

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = form.discountType === 'PERCENT'
    ? subtotal * (form.discountValue / 100)
    : form.discountType === 'FIXED' ? form.discountValue : 0;
  const rawVat = items.reduce((s, i) => s + i.taxAmount, 0);
  // Manual deduction applied before VAT — reduces the taxable base, VAT recalculated proportionally
  const taxableBase = subtotal - discountAmount;
  const deductionAmount = Math.min(Math.max(Number(form.deductionAmount) || 0, 0), Math.max(taxableBase, 0));
  const vatAmount = taxableBase > 0 ? rawVat * ((taxableBase - deductionAmount) / taxableBase) : 0;
  const total = subtotal - discountAmount - deductionAmount + vatAmount;

  const handleSave = async (sendAfter = false) => {
    if (!form.clientId) { alert('Please select a client'); return; }
    if (items.length === 0) { alert('Please add at least one line item'); return; }

    setSaving(true);
    try {
      const res = await financeApi.quotations.create({
        ...form,
        discountValue: form.discountValue || undefined,
        discountType: form.discountType || undefined,
        deductionAmount: Number(form.deductionAmount) || undefined,
        deductionReason: form.deductionReason || undefined,
        validUntil: form.validUntil || undefined,
        vatNote: form.vatNote || undefined,
        internalNotes: form.internalNotes || undefined,
        items: items.map(item => ({
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

      const id = res.data.id;
      if (sendAfter) {
        await financeApi.quotations.updateStatus(id, 'SENT');
      }
      router.push(`/finance/quotations/${id}`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/quotations" className="btn-ghost p-2">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Quotation</h1>
            <p className="text-sm text-gray-500">Draft — not saved yet</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="btn-secondary">
            <Save size={14} /> Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="btn-primary">
            <Send size={14} /> Save & Send
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main form — left 2 cols */}
        <div className="col-span-2 space-y-5">

          {/* Client & basics */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">
              Client & Details
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Client *</label>
                <select className="input" value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Subject / Title</label>
                <input className="input" placeholder="e.g. Base Camp Package — June Shoot"
                  value={form.subject} onChange={e => set('subject', e.target.value)} />
              </div>

              <div>
                <label className="label">Activity</label>
                <select className="input" value={form.activity} onChange={e => set('activity', e.target.value)}>
                  <option value="RENTAL">Rental Operations</option>
                  <option value="PRODUCTION">Production</option>
                </select>
              </div>

              <div>
                <label className="label">Issue Date</label>
                <input type="date" className="input" value={form.issueDate} onChange={e => set('issueDate', e.target.value)} />
              </div>

              <div>
                <label className="label">Valid Until</label>
                <input type="date" className="input" value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">
              Line Items
            </h2>
            <LineItemsEditor
              items={items}
              vatRates={vatRates}
              onChange={setItems}
              currency={form.currency}
            />
          </div>

          {/* Notes & Terms */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">
              Notes & Terms
            </h2>
            <div>
              <label className="label">Client Notes (shown on PDF)</label>
              <textarea className="input h-20 resize-none" placeholder="Any notes for the client..."
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            <div>
              <label className="label">Terms & Conditions</label>
              <textarea className="input h-24 resize-none font-mono text-xs"
                value={form.termsConditions} onChange={e => set('termsConditions', e.target.value)} />
            </div>
            <div>
              <label className="label">Internal Notes (not on PDF)</label>
              <textarea className="input h-16 resize-none text-xs"
                placeholder="Internal comments, approval notes..."
                value={form.internalNotes} onChange={e => set('internalNotes', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Sidebar — right col */}
        <div className="space-y-4">

          {/* Settings */}
          <div className="card p-4 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm">Settings</h2>

            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['AED','USD','EUR','GBP','SAR'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Bank Account</label>
              <select className="input" value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
                <option value="">No bank details</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>{b.bankName} — {b.accountName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">VAT Display</label>
              <select className="input text-sm" value={form.vatDisplay} onChange={e => set('vatDisplay', e.target.value)}>
                {VAT_DISPLAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {form.vatDisplay === 'HIDDEN' && (
              <div>
                <label className="label">VAT Note (shown instead)</label>
                <input className="input text-xs" placeholder="e.g. VAT will be finalized on invoice"
                  value={form.vatNote} onChange={e => set('vatNote', e.target.value)} />
              </div>
            )}
          </div>

          {/* Discount */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm">Discount</h2>
            <div>
              <label className="label">Discount Type</label>
              <select className="input" value={form.discountType} onChange={e => set('discountType', e.target.value)}>
                <option value="">No discount</option>
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </div>
            {form.discountType && (
              <div>
                <label className="label">{form.discountType === 'PERCENT' ? 'Discount %' : 'Discount Amount'}</label>
                <input type="number" min="0" className="input"
                  value={form.discountValue}
                  onChange={e => set('discountValue', parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>

          {/* Deduction */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm">Deduction</h2>
            <p className="text-[11px] text-gray-400 -mt-1">Fixed manual reduction applied before VAT (goodwill, adjustment, negotiated reduction).</p>
            <div>
              <label className="label">Deduction Amount ({form.currency})</label>
              <input type="number" min="0" step="0.01" className="input"
                value={form.deductionAmount}
                onChange={e => set('deductionAmount', parseFloat(e.target.value) || 0)} />
            </div>
            {Number(form.deductionAmount) > 0 && (
              <div>
                <label className="label">Reason / Note</label>
                <input className="input text-sm" placeholder="e.g. Goodwill discount"
                  value={form.deductionReason} onChange={e => set('deductionReason', e.target.value)} />
              </div>
            )}
          </div>

          {/* Totals summary */}
          <div className="card p-4 space-y-2">
            <h2 className="font-semibold text-gray-800 text-sm mb-3">Summary</h2>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, form.currency)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>− {formatCurrency(discountAmount, form.currency)}</span>
              </div>
            )}
            {deductionAmount > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Deduction{form.deductionReason ? ` (${form.deductionReason})` : ''}</span>
                <span>− {formatCurrency(deductionAmount, form.currency)}</span>
              </div>
            )}
            {vatAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT</span>
                <span>{formatCurrency(vatAmount, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatCurrency(total, form.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
