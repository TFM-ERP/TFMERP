'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { clientsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Search, RefreshCw, Plus, Building2, X, ChevronRight } from 'lucide-react';
import EmailInput from '@/components/EmailInput';
import { CinematicHeader } from '@/components/CinematicHeader';
import PhoneInput from '@/components/PhoneInput';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  BLOCKED: 'bg-red-100 text-red-700',
};

const WIZARD_TABS = [
  { id: 'basic', label: '1. Basic Info' },
  { id: 'contact', label: '2. Contact' },
  { id: 'address', label: '3. Address & Maps' },
  { id: 'compliance', label: '4. UAE Compliance & VAT' },
  { id: 'bank', label: '5. Bank Details' },
  { id: 'terms', label: '6. Terms & Review' },
] as const;
type WizardTab = typeof WIZARD_TABS[number]['id'];

const EMPTY_FORM = {
  companyName: '', tradeName: '', trn: '',
  contactName: '', email: '', phone: '',
  billingAddress: '', address: '', city: '', country: 'UAE', website: '', googleMapsUrl: '',
  vatId: '', tradeLicenseNumber: '', tradeLicenseExpiry: '',
  bankName: '', bankAccount: '', iban: '', swiftCode: '', bankBranch: '', bankAddress: '',
  paymentTermDays: '30', creditLimit: '', currency: 'AED', notes: '',
};

// ── Add Client Wizard (mirrors the supplier wizard) ────────────────────────────
function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [tab, setTab] = useState<WizardTab>('basic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const str = (k: keyof typeof EMPTY_FORM) => ({
    value: String(form[k] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value })),
  });

  const tabIdx = WIZARD_TABS.findIndex(t => t.id === tab);
  const isFirst = tabIdx === 0;
  const isLast = tabIdx === WIZARD_TABS.length - 1;

  const submit = async () => {
    if (!form.companyName.trim()) { setError('Company name is required'); setTab('basic'); return; }
    setSaving(true); setError('');
    try {
      const { contactName, email, phone, ...rest } = form;
      await clientsApi.create({
        ...rest,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        tradeLicenseExpiry: form.tradeLicenseExpiry || undefined,
        paymentTermDays: form.paymentTermDays ? Number(form.paymentTermDays) : undefined,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
        contacts: contactName
          ? [{ name: contactName, email: email || undefined, mobile: phone || undefined, isPrimary: true }]
          : undefined,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create client');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <Building2 size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">Add Client</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        {/* Wizard tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b shrink-0 overflow-x-auto">
          {WIZARD_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap -mb-px',
                tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {tab === 'basic' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Company Name *</label><input className="input w-full" {...str('companyName')} /></div>
              <div><label className="label">Trade Name</label><input className="input w-full" {...str('tradeName')} /></div>
              <div><label className="label">TRN (UAE Tax No.)</label><input className="input w-full" {...str('trn')} placeholder="100XXXXXXXXX00003" /></div>
              <div><label className="label">City</label><input className="input w-full" {...str('city')} placeholder="Dubai" /></div>
              <div><label className="label">Country</label><input className="input w-full" {...str('country')} /></div>
              <div className="col-span-2"><label className="label">Website</label><input className="input w-full" {...str('website')} /></div>
            </div>
          )}

          {tab === 'contact' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Primary Contact Name</label><input className="input w-full" {...str('contactName')} /></div>
              <div><label className="label">Email</label><EmailInput className="input w-full" {...str('email')} /></div>
              <div><label className="label">Phone</label><PhoneInput value={form.phone || ''} onChange={(v) => setForm(f => ({ ...f, phone: v }))} placeholder="+971 …" /></div>
            </div>
          )}

          {tab === 'address' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Billing Address</label><textarea className="input w-full" rows={2} {...str('billingAddress')} /></div>
              <div className="col-span-2"><label className="label">Physical Address</label><textarea className="input w-full" rows={2} {...str('address')} /></div>
              <div><label className="label">City</label><input className="input w-full" {...str('city')} /></div>
              <div><label className="label">Country</label><input className="input w-full" {...str('country')} /></div>
              <div className="col-span-2"><label className="label">Google Maps URL</label><input className="input w-full" {...str('googleMapsUrl')} placeholder="https://maps.google.com/…" /></div>
            </div>
          )}

          {tab === 'compliance' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">VAT ID / TRN</label><input className="input w-full" {...str('vatId')} placeholder="defaults to TRN" /></div>
              <div><label className="label">Trade License Number</label><input className="input w-full" {...str('tradeLicenseNumber')} /></div>
              <div><label className="label">Trade License Expiry</label><input type="date" className="input w-full" {...str('tradeLicenseExpiry')} /></div>
              <div className="col-span-2 text-xs text-gray-400">Upload the trade license, VAT certificate and contracts as attachments after saving (Documents tab on the client page).</div>
            </div>
          )}

          {tab === 'bank' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Bank Name</label><input className="input w-full" {...str('bankName')} /></div>
              <div><label className="label">Branch</label><input className="input w-full" {...str('bankBranch')} /></div>
              <div><label className="label">Account Number</label><input className="input w-full" {...str('bankAccount')} /></div>
              <div><label className="label">IBAN</label><input className="input w-full" {...str('iban')} /></div>
              <div><label className="label">SWIFT / BIC</label><input className="input w-full" {...str('swiftCode')} /></div>
              <div className="col-span-2"><label className="label">Bank Address</label><input className="input w-full" {...str('bankAddress')} /></div>
            </div>
          )}

          {tab === 'terms' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label">Payment Terms (days)</label><input type="number" className="input w-full" {...str('paymentTermDays')} /></div>
                <div><label className="label">Credit Limit (AED)</label><input type="number" className="input w-full" {...str('creditLimit')} placeholder="0.00" /></div>
                <div>
                  <label className="label">Currency</label>
                  <select className="input w-full" {...str('currency')}>
                    {['AED', 'USD', 'EUR', 'GBP', 'SAR'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Notes</label><textarea className="input w-full" rows={2} {...str('notes')} /></div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">{form.companyName || 'New client'}</p>
                {[form.tradeName, form.city, form.trn, form.contactName].filter(Boolean).join(' · ') || 'Fill in the details above.'}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
          <button onClick={isFirst ? onClose : () => setTab(WIZARD_TABS[tabIdx - 1].id)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100">
            {isFirst ? 'Cancel' : 'Back'}
          </button>
          {isLast ? (
            <button onClick={submit} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Create Client'}
            </button>
          ) : (
            <button onClick={() => setTab(WIZARD_TABS[tabIdx + 1].id)}
              className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700">
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    clientsApi.list({ search: search || undefined, status: statusFilter || undefined })
      .then(r => setItems(r.data.items || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <CinematicHeader kicker="Partners · Clients" title="Clients" count={`${items.length} clients`}>
        <button onClick={() => setShowWizard(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> Add Client
        </button>
      </CinematicHeader>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
        <button onClick={load} className="btn btn-secondary p-2"><RefreshCw size={14} className={cn(loading && 'animate-spin')} /></button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Company</th>
              <th className="table-th">City</th>
              <th className="table-th">TRN</th>
              <th className="table-th">Payment Terms</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c: any) => {
              const status = c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE');
              return (
                <tr key={c.id} className="table-row">
                  <td className="table-td">
                    <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:text-brand-600">{c.companyName}</Link>
                    {c.tradeName && <div className="text-xs text-gray-400">{c.tradeName}</div>}
                  </td>
                  <td className="table-td text-sm text-gray-600">{c.city || '—'}</td>
                  <td className="table-td text-sm text-gray-600">{c.trn || '—'}</td>
                  <td className="table-td text-sm text-gray-600">{c.paymentTermDays} days</td>
                  <td className="table-td"><span className={cn('badge', STATUS_COLORS[status])}>{status}</span></td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No clients found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showWizard && <NewClientModal onClose={() => setShowWizard(false)} onCreated={() => { setShowWizard(false); load(); }} />}
    </div>
  );
}
