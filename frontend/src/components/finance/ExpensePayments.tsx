'use client';
/**
 * Payments against one supplier invoice, and the drawer that records a new one.
 *
 * Attach the slip → the server reads it (OCR here, AI on the text only if a key
 * field is missing) → every field is shown with where it came from, editable →
 * Save creates the payment, files the slip and posts the ledger entry together.
 * Warnings inform; only the duplicate guard on the server blocks a save.
 */
import { useCallback, useEffect, useState } from 'react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { X, Upload, Loader2 } from 'lucide-react';

type Src = 'slip' | 'ai' | 'typed';
type Field = 'date' | 'amount' | 'currency' | 'reference' | 'beneficiary' | 'beneficiaryAccount' | 'payerAccountRef' | 'remark' | 'fee';

const FIELDS: { k: Field; label: string; type?: string; half?: boolean }[] = [
  { k: 'date', label: 'Payment date', type: 'date', half: true },
  { k: 'amount', label: 'Amount', half: true },
  { k: 'fee', label: 'Fee on the slip', half: true },
  { k: 'currency', label: 'Currency', half: true },
  { k: 'reference', label: 'Bank reference / approval code' },
  { k: 'beneficiary', label: 'Beneficiary as printed' },
  { k: 'beneficiaryAccount', label: 'Beneficiary IBAN / account' },
  { k: 'payerAccountRef', label: 'Paid from account (IBAN or card last 4)' },
  { k: 'remark', label: 'Remark' },
];
const TAG: Record<Src, { text: string; cls: string }> = {
  slip: { text: 'read from slip', cls: 'text-emerald-600' },
  ai: { text: 'filled by AI', cls: 'text-amber-600' },
  typed: { text: 'you typed', cls: 'text-gray-400' },
};
const PAID_FROM = [
  { v: 'COMPANY_BANK', l: 'Company bank' },
  { v: 'CASH_ON_HAND', l: 'Cash on hand' },
  { v: 'OWNER', l: 'Me personally' },
] as const;
const METHODS = ['BANK_TRANSFER', 'CARD', 'ONLINE', 'CHEQUE'] as const;
type PaidFrom = (typeof PAID_FROM)[number]['v'];

const errText = (e: any): string => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(' ') : String(m || e?.message || e);
};

export function ExpensePayments({ expenseId, onChanged }: { expenseId: string; onChanged?: () => void }) {
  const [data, setData] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ url: string; pdf: boolean } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [slipText, setSlipText] = useState('');
  const [vals, setVals] = useState<Partial<Record<Field, string>>>({});
  const [src, setSrc] = useState<Partial<Record<Field, Src>>>({});
  const [paidFrom, setPaidFrom] = useState<PaidFrom>('COMPANY_BANK');
  const [bankAccountId, setBankAccountId] = useState('');
  const [method, setMethod] = useState<string>('BANK_TRANSFER');

  const load = useCallback(async () => {
    try {
      // includeOwner: the GM's own account has to be selectable when he paid personally.
      const [p, b] = await Promise.all([financeApi.supplierPayments.list(expenseId), financeApi.bankAccounts.list(true)]);
      setData(p.data);
      setBanks(b.data || []);
      setListError(null);
    } catch (e) { setListError(errText(e)); }
  }, [expenseId]);
  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setVals({}); setSrc({}); setWarnings([]); setError(null); setToken(null); setSlipText('');
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null); setPaidFrom('COMPANY_BANK'); setBankAccountId(''); setMethod('BANK_TRANSFER');
  };
  const set = (k: Field, v: string) => { setVals((s) => ({ ...s, [k]: v })); setSrc((s) => ({ ...s, [k]: 'typed' })); };

  const onFile = async (f?: File) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ url: URL.createObjectURL(f), pdf: f.type === 'application/pdf' });
    setReading(true); setError(null);
    try {
      const { data: r } = await financeApi.supplierPayments.readSlip(f, expenseId);
      setToken(r.uploadToken); setSlipText(r.text || ''); setWarnings(r.warnings || []);
      const v: Partial<Record<Field, string>> = {}; const s: Partial<Record<Field, Src>> = {};
      Object.entries(r.fields || {}).forEach(([k, x]: [string, any]) => { v[k as Field] = x.value; s[k as Field] = x.source; });
      setVals(v); setSrc(s);
      if (r.suggestedPaidFrom) setPaidFrom(r.suggestedPaidFrom);
      if (r.suggestedBankAccountId) setBankAccountId(r.suggestedBankAccountId);
      if (v.payerAccountRef && v.payerAccountRef.length === 4) setMethod('CARD');
    } catch (e) {
      setError(`Could not read the slip: ${errText(e)} You can fill the form in by hand.`);
    } finally { setReading(false); }
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await financeApi.supplierPayments.record(expenseId, {
        paidFrom,
        bankAccountId: paidFrom === 'CASH_ON_HAND' ? null : bankAccountId || null,
        method: paidFrom === 'CASH_ON_HAND' ? 'CASH' : method,
        paymentDate: vals.date,
        amount: Number(vals.amount),
        feeAmount: vals.fee ? Number(vals.fee) : null,
        currency: vals.currency || 'AED',
        reference: vals.reference || null,
        beneficiary: vals.beneficiary || null,
        beneficiaryAccount: vals.beneficiaryAccount || null,
        payerAccountRef: vals.payerAccountRef || null,
        notes: vals.remark ? `Remark: ${vals.remark}` : null,
        uploadToken: token, slipText,
      });
      setOpen(false); reset(); await load(); onChanged?.();
    } catch (e) { setError(errText(e)); } finally { setSaving(false); }
  };

  const accountChoices = banks.filter((b: any) => b.isActive !== false && (paidFrom === 'OWNER' ? b.ownership === 'OWNER' : b.ownership !== 'OWNER'));
  const canSave = !saving && !reading && !!vals.amount && Number(vals.amount) > 0 && !!vals.date;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Payments</h3>
        <button className="btn-primary text-sm" onClick={() => { reset(); setOpen(true); }}>Record payment</button>
      </div>

      {listError && <p className="text-sm text-red-600">{listError}</p>}

      {data && (data.payments.length === 0 ? (
        <p className="text-sm text-gray-400">No payment recorded yet · {formatCurrency(data.unpaid)} unpaid.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="py-2">No.</th><th>Date</th><th>Paid from</th><th>Method</th>
                <th className="text-right">Amount</th><th className="text-right">Fee</th>
                <th>Reference</th><th>Beneficiary</th><th>Slip</th><th>Entry</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 text-gray-800" title={p.notes || ''}>
                  <td className="py-2 whitespace-nowrap">{p.paymentNumber}</td>
                  <td className="whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                  <td className="whitespace-nowrap">
                    {PAID_FROM.find((x) => x.v === p.paidFrom)?.l || '—'}
                    {p.bankAccount ? <span className="text-gray-400"> · {p.bankAccount.bankName}</span> : null}
                  </td>
                  <td className="whitespace-nowrap">{String(p.method).replace('_', ' ').toLowerCase()}</td>
                  <td className="text-right whitespace-nowrap">{formatCurrency(Number(p.amount))}</td>
                  <td className="text-right whitespace-nowrap text-gray-400">{p.feeAmount ? formatCurrency(Number(p.feeAmount)) : ''}</td>
                  <td className="whitespace-nowrap">{p.reference || ''}</td>
                  <td className="max-w-[16rem] truncate">{p.beneficiary || ''}</td>
                  <td>{p.slip ? <a className="text-blue-600 hover:underline" href={p.slip.url} target="_blank" rel="noreferrer">view</a> : ''}</td>
                  <td className="text-gray-400 whitespace-nowrap">{p.entryNumber || ''}</td>
                </tr>
              ))}
              <tr className="font-semibold text-gray-900">
                <td className="py-2" colSpan={4}>Unpaid</td>
                <td className="text-right">{formatCurrency(data.unpaid)}</td>
                <td colSpan={5} />
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => !saving && !reading && (setOpen(false), reset())}>
          <div className="bg-white shadow-2xl w-full max-w-4xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">Record payment{data?.expenseNumber ? ` · ${data.expenseNumber}` : ''}</h2>
              <button onClick={() => { setOpen(false); reset(); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 px-6 py-4">
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-6 text-sm text-gray-500 cursor-pointer hover:border-gray-300">
                  {reading ? <><Loader2 size={18} className="animate-spin" /> Reading slip…</> : <><Upload size={18} /> Attach the slip — photo, screenshot or PDF (optional)</>}
                  <input type="file" accept=".pdf,image/*" className="hidden" disabled={reading || saving} onChange={(e) => onFile(e.target.files?.[0])} />
                </label>

                <div>
                  <label className="label">Paid from</label>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-800">
                    {PAID_FROM.map((o) => (
                      <label key={o.v} className="flex items-center gap-1.5">
                        <input type="radio" checked={paidFrom === o.v} onChange={() => {
                          setPaidFrom(o.v); setBankAccountId('');
                          setMethod(o.v === 'CASH_ON_HAND' ? 'CASH' : method === 'CASH' ? 'BANK_TRANSFER' : method);
                        }} />
                        {o.l}
                      </label>
                    ))}
                  </div>
                </div>

                {paidFrom !== 'CASH_ON_HAND' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">{paidFrom === 'OWNER' ? 'Your account (optional)' : 'Company account'}</label>
                      <select className="input w-full" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                        <option value="">{paidFrom === 'OWNER' ? 'Not recorded' : 'Choose…'}</option>
                        {accountChoices.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.bankName} · {b.accountName} · …{String(b.accountNumber).slice(-4)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Method</label>
                      <select className="input w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
                        {METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ').toLowerCase()}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {FIELDS.map(({ k, label, type, half }) => (
                    <div key={k} className={half ? '' : 'col-span-2'}>
                      <div className="flex items-baseline justify-between">
                        <label className="label">{label}</label>
                        {src[k] && <span className={`text-[10px] ${TAG[src[k]!].cls}`}>{TAG[src[k]!].text}</span>}
                      </div>
                      <input className="input w-full" type={type || 'text'} value={vals[k] || ''} onChange={(e) => set(k, e.target.value)} />
                    </div>
                  ))}
                </div>

                {warnings.map((w, i) => <p key={i} className="text-sm text-amber-700">⚠ {w}</p>)}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button className="btn-secondary flex-1" disabled={saving} onClick={() => { setOpen(false); reset(); }}>Cancel</button>
                  <button className="btn-primary flex-1" disabled={!canSave} onClick={save}>{saving ? 'Saving…' : 'Save payment'}</button>
                </div>
                <p className="text-xs text-gray-400">Saving creates the payment, files the slip on the invoice and the supplier, and posts the accounting entry.</p>
              </div>

              <div className="border border-gray-100 rounded-2xl min-h-[24rem] flex items-center justify-center overflow-hidden bg-gray-50">
                {preview
                  ? (preview.pdf
                    ? <iframe title="slip" src={preview.url} className="w-full h-full min-h-[36rem]" />
                    : <img alt="slip" src={preview.url} className="max-w-full max-h-[36rem] object-contain" />)
                  : <span className="text-sm text-gray-400">The slip appears here</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
