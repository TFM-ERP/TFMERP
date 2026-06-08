'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { financeApi, clientsApi, companyApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import LineItemsEditor, { LineItem } from '@/components/finance/LineItemsEditor';

const VAT_DISPLAY_OPTIONS = [
  { value: 'SEPARATE', label: 'Show VAT separately' },
  { value: 'INCLUDED', label: 'VAT included in prices' },
  { value: 'EXCLUDED', label: 'VAT excluded (shown at bottom)' },
  { value: 'HIDDEN', label: 'Hide VAT until invoice stage' },
];

export default function EditQuotationPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [vatRates, setVatRates] = useState<any[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);

  const [form, setForm] = useState({
    clientId: '',
    bankAccountId: '',
    activity: 'RENTAL',
    currency: 'AED',
    issueDate: '',
    validUntil: '',
    subject: '',
    notes: '',
    termsConditions: '',
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
      financeApi.quotations.get(id),
      clientsApi.list(),
      companyApi.bankAccounts.list(),
      financeApi.vat.list(),
    ]).then(([qr, c, b, v]) => {
      const q = qr.data;
      if (q.status !== 'DRAFT') { setBlocked(true); return; }
      setClients(c.data);
      setBankAccounts(b.data || []);
      setVatRates(v.data);
      setForm({
        clientId: q.clientId || '',
        bankAccountId: q.bankAccountId || '',
        activity: q.activity || 'RENTAL',
        currency: q.currency || 'AED',
        issueDate: q.issueDate ? new Date(q.issueDate).toISOString().split('T')[0] : '',
        validUntil: q.validUntil ? new Date(q.validUntil).toISOString().split('T')[0] : '',
        subject: q.subject || '',
        notes: q.notes || '',
        termsConditions: q.termsConditions || '',
        internalNotes: q.internalNotes || '',
        vatDisplay: q.vatDisplay || 'SEPARATE',
        vatNote: q.vatNote || '',
        discountType: q.discountType || '',
        discountValue: Number(q.discountValue || 0),
        deductionAmount: Number(q.deductionAmount || 0),
        deductionReason: q.deductionReason || '',
      });
      setItems((q.items || []).map((i: any) => ({
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
    }).catch(() => router.push('/finance/quotations'))
      .finally(() => setLoading(false));
  }, [id]);

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = form.discountType === 'PERCENT'
    ? subtotal * (form.discountValue / 100)
    : form.discountType === 'FIXED' ? form.discountValue : 0;
  const rawVat = items.reduce((s, i) => s + i.taxAmount, 0);
  const taxableBase = subtotal - discountAmount;
  const deductionAmount = Math.min(Math.max(Number(form.deductionAmount) || 0, 0), Math.max(taxableBase, 0));
  const vatAmount = taxableBase > 0 ? rawVat * ((taxableBase - deductionAmount) / taxableBase) : 0;
  const total = subtotal - discountAmount - deductionAmount + vatAmount;

  const handleSave = async () => {
    if (!form.clientId) { alert('Please select a client'); return; }
    if (items.length === 0) { alert('Please add at least one line item'); return; }
    setSaving(true);
    try {
      await financeApi.quotations.update(id, {
        ...form,
        discountValue: form.discountValue || undefined,
        discountType: form.discountType || undefined,
        deductionAmount: Number(form.deductionAmount) || 0,
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
      router.push(`/finance/quotations/${id}`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to update quotation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i => <div key={i} className="card h-32 animate-pulse bg-gray-50" />)}</div>;
  if (blocked) return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="card p-6 text-center space-y-3">
        <p className="text-gray-700 font-medium">This quotation can no longer be edited.</p>
        <p className="text-sm text-gray-500">Only quotations in <b>Draft</b> status can be edited.</p>
        <Link href={`/finance/quotations/${id}`} className="btn-primary inline-flex">Back to quotation</Link>
      </div>
    </div>
  );

  return (
    <div className="p-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/finance/quotations/${id}`} className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Quotation</h1>
            <p className="text-sm text-gray-500">Draft — changes saved on update</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">Client & Details</h2>
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
                <input className="input" value={form.subject} onChange={e => set('subject', e.target.value)} />
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

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">Line Items</h2>
            <LineItemsEditor items={items} vatRates={vatRates} onChange={setItems} currency={form.currency} />
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">Notes & Terms</h2>
            <div>
              <label className="label">Client Notes (shown on PDF)</label>
              <textarea className="input h-20 resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            <div>
              <label className="label">Terms & Conditions</label>
              <textarea className="input h-24 resize-none font-mono text-xs" value={form.termsConditions} onChange={e => set('termsConditions', e.target.value)} />
            </div>
            <div>
              <label className="label">Internal Notes (not on PDF)</label>
              <textarea className="input h-16 resize-none text-xs" value={form.internalNotes} onChange={e => set('internalNotes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
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
                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} — {b.accountName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">VAT Display</label>
              <select className="input text-sm" value={form.vatDisplay} onChange={e => set('vatDisplay', e.target.value)}>
                {VAT_DISPLAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

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
                <input type="number" min="0" className="input" value={form.discountValue}
                  onChange={e => set('discountValue', parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>

          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm">Deduction</h2>
            <p className="text-[11px] text-gray-400 -mt-1">Fixed manual reduction applied before VAT (goodwill, adjustment, negotiated reduction).</p>
            <div>
              <label className="label">Deduction Amount ({form.currency})</label>
              <input type="number" min="0" step="0.01" className="input" value={form.deductionAmount}
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

          <div className="card p-4 space-y-2">
            <h2 className="font-semibold text-gray-800 text-sm mb-3">Summary</h2>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{formatCurrency(subtotal, form.currency)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span><span>− {formatCurrency(discountAmount, form.currency)}</span>
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
                <span>VAT</span><span>{formatCurrency(vatAmount, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span><span>{formatCurrency(total, form.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
