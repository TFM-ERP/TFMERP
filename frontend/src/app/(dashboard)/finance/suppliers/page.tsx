'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { financeApi, uploadFile } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  Search, RefreshCw, Plus, Building2, AlertTriangle, X,
  Save, Loader2, ChevronRight, FileWarning, Wrench, MapPin,
  Check, Upload, Trash2, FileText, Phone, Mail, Globe,
} from 'lucide-react';
import { SUPPLIER_CATEGORIES } from '@/components/SupplierSelect';

// -- Constants -----------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      'bg-green-100 text-green-700',
  INACTIVE:    'bg-gray-100 text-gray-500',
  BLACKLISTED: 'bg-red-100 text-red-700',
};

const WORKSHOP_TRIGGER_CATEGORIES = ['Maintenance Workshop', 'Spare Parts Supplier', 'Tire Supplier'];

const SUPPLIER_DOC_TYPES: Record<string, string> = {
  TRADE_LICENSE:   'Trade Licence',
  VAT_CERTIFICATE: 'VAT Certificate',
  CONTRACT:        'Contract',
  INSURANCE:       'Insurance',
  OTHER:           'Other',
};

const WIZARD_TABS = [
  { id: 'basic',      label: '1. Basic Info'          },
  { id: 'contact',    label: '2. Contact'              },
  { id: 'address',    label: '3. Address & Maps'       },
  { id: 'compliance', label: '4. UAE Compliance & VAT' },
  { id: 'bank',       label: '5. Bank Details'         },
  { id: 'notes',      label: '6. Notes & Review'       },
] as const;

type WizardTab = typeof WIZARD_TABS[number]['id'];

const EMPTY_FORM = {
  name: '', tradeName: '', status: 'ACTIVE',
  trn: '', vatId: '',
  tradeLicenseNumber: '', tradeLicenseExpiry: '',
  contactName: '', email: '', phone: '',
  city: '', country: 'UAE', address: '', website: '',
  googleMapsUrl: '',
  paymentTermDays: '', creditLimit: '', currency: 'AED',
  bankName: '', bankAccount: '', iban: '', swiftCode: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM & { categories: string[] };

interface PendingDoc {
  id: string;
  docType: string;
  name: string;
  expiryDate: string;
  file: File;
}

// -- Supplier Wizard Modal -----------------------------------------------------

function NewSupplierModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (s: any) => void;
}) {
  const [form, setForm]     = useState<FormState>({ ...EMPTY_FORM, categories: [] });
  const [tab, setTab]       = useState<WizardTab>('basic');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [docForm, setDocForm] = useState({ docType: 'TRADE_LICENSE', name: '', expiryDate: '' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const str = (k: keyof typeof EMPTY_FORM) => ({
    value: String(form[k] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value })),
  });

  const toggleCat = (cat: string) =>
    setForm(v => ({
      ...v,
      categories: v.categories.includes(cat)
        ? v.categories.filter(c => c !== cat)
        : [...v.categories, cat],
    }));

  const willCreateVendor = form.categories.some(c => WORKSHOP_TRIGGER_CATEGORIES.includes(c));

  const addDocToQueue = () => {
    if (!docFile) return;
    if (!docForm.name.trim()) { setError('Document name is required'); return; }
    setPendingDocs(d => [...d, {
      id: Math.random().toString(36).slice(2),
      ...docForm,
      file: docFile,
    }]);
    setDocFile(null);
    setDocForm({ docType: 'TRADE_LICENSE', name: '', expiryDate: '' });
    if (docInputRef.current) docInputRef.current.value = '';
    setError('');
  };

  const removeDoc = (id: string) => setPendingDocs(d => d.filter(x => x.id !== id));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Supplier name is required'); setTab('basic'); return; }
    setSaving(true); setError('');
    try {
      const res = await financeApi.suppliers.create({
        ...form,
        categories:         form.categories,
        paymentTermDays:    form.paymentTermDays ? Number(form.paymentTermDays) : undefined,
        creditLimit:        form.creditLimit     ? Number(form.creditLimit)     : undefined,
        vatId:              form.vatId || form.trn || undefined,
        tradeLicenseExpiry: form.tradeLicenseExpiry || undefined,
      });
      const supplierId = res.data.id;
      for (const doc of pendingDocs) {
        try {
          const uploaded = await uploadFile(doc.file);
          await financeApi.suppliers.addDocument(supplierId, {
            docType: doc.docType, name: doc.name,
            url: uploaded.url,
            expiryDate: doc.expiryDate || undefined,
          });
        } catch { /* non-fatal */ }
      }
      onCreated(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create supplier');
    } finally { setSaving(false); }
  };

  const tabIdx  = WIZARD_TABS.findIndex(t => t.id === tab);
  const isFirst = tabIdx === 0;
  const isLast  = tabIdx === WIZARD_TABS.length - 1;
  const prev = () => setTab(WIZARD_TABS[tabIdx - 1].id);
  const next = () => setTab(WIZARD_TABS[tabIdx + 1].id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <Building2 size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">Add Supplier</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        {/* Wizard tabs */}
        <div className="flex gap-0.5 px-6 pt-4 shrink-0 overflow-x-auto">
          {WIZARD_TABS.map((t, i) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors',
                tab === t.id
                  ? 'border-brand-600 text-brand-700 bg-brand-50'
                  : i < tabIdx
                    ? 'border-green-400 text-green-700'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
              )}>
              {i < tabIdx ? <Check size={10} className="inline mr-1" /> : null}
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {/* 1. Basic Info */}
          {tab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Supplier Name *</label>
                  <input className="input w-full" required {...str('name')} autoFocus
                    placeholder="e.g. Emirates Auto Workshop LLC" />
                </div>
                <div>
                  <label className="label">Trade Name</label>
                  <input className="input w-full" {...str('tradeName')} placeholder="DBA / trading as..." />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input w-full" {...str('status')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="BLACKLISTED">Blacklisted</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Categories <span className="text-gray-400 font-normal text-xs">(select all that apply)</span></label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {SUPPLIER_CATEGORIES.map(cat => {
                      const sel = form.categories.includes(cat);
                      const isWorkshop = WORKSHOP_TRIGGER_CATEGORIES.includes(cat);
                      return (
                        <button key={cat} type="button" onClick={() => toggleCat(cat)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            sel
                              ? isWorkshop
                                ? 'bg-orange-100 border-orange-400 text-orange-700'
                                : 'bg-brand-100 border-brand-400 text-brand-700'
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                          )}>
                          {isWorkshop && sel && <Wrench size={10} className="inline mr-1" />}
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  {willCreateVendor && (
                    <p className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                      <Wrench size={11} /> A Maintenance Vendor record will be created automatically and linked to this supplier.
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select className="input w-full" {...str('currency')}>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="SAR">SAR - Saudi Riyal</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment Terms (days)</label>
                  <input type="number" className="input w-full" {...str('paymentTermDays')} placeholder="30" min={0} />
                </div>
                <div>
                  <label className="label">Credit Limit (AED)</label>
                  <input type="number" className="input w-full" {...str('creditLimit')} min={0} step={0.01} placeholder="0.00" />
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                Supplier categories help route expenses and invoices to the correct cost centres.
              </div>
            </div>
          )}

          {/* 2. Contact */}
          {tab === 'contact' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Primary Contact Person</label>
                <input className="input w-full" {...str('contactName')} placeholder="Full name" />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Phone size={12} /> Phone</label>
                <input className="input w-full" {...str('phone')} placeholder="+971 4 XXX XXXX" />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Mail size={12} /> Email</label>
                <input type="email" className="input w-full" {...str('email')} />
              </div>
              <div className="col-span-2">
                <label className="label flex items-center gap-1"><Globe size={12} /> Website</label>
                <input className="input w-full" {...str('website')} placeholder="https://www.example.com" />
              </div>
              <div className="col-span-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                Additional contacts with WhatsApp numbers and departments can be added from the supplier profile after saving.
              </div>
            </div>
          )}

          {/* 3. Address & Maps */}
          {tab === 'address' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Address</label>
                <input className="input w-full" {...str('address')} placeholder="Street, area, building..." />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input w-full" {...str('city')} placeholder="Dubai" />
              </div>
              <div>
                <label className="label">Country</label>
                <input className="input w-full" {...str('country')} />
              </div>
              <div className="col-span-2">
                <label className="label flex items-center gap-1"><MapPin size={12} /> Google Maps URL</label>
                <input className="input w-full" {...str('googleMapsUrl')}
                  placeholder="https://maps.google.com/?q=..." />
                <p className="text-xs text-gray-400 mt-1">Paste the share link from Google Maps for one-click navigation.</p>
              </div>
            </div>
          )}

          {/* 4. UAE Compliance + VAT */}
          {tab === 'compliance' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">TRN (UAE Tax Reg. No.)</label>
                  <input className="input w-full font-mono" value={form.trn}
                    onChange={e => setForm(v => ({ ...v, trn: e.target.value, vatId: e.target.value }))}
                    placeholder="100XXXXXXXXX00003" />
                </div>
                <div>
                  <label className="label">VAT ID <span className="text-gray-400 font-normal text-xs">(if different)</span></label>
                  <input className="input w-full font-mono" {...str('vatId')} />
                </div>
                <div>
                  <label className="label">Trade Licence No.</label>
                  <input className="input w-full" {...str('tradeLicenseNumber')} />
                </div>
                <div>
                  <label className="label">Trade Licence Expiry</label>
                  <input type="date" className="input w-full" {...str('tradeLicenseExpiry')} />
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 mb-3">Attach Compliance Documents</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="label">Type</label>
                    <select className="input w-full" value={docForm.docType}
                      onChange={e => setDocForm(prev => ({ ...prev, docType: e.target.value }))}>
                      {Object.entries(SUPPLIER_DOC_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Name *</label>
                    <input className="input w-full" value={docForm.name}
                      onChange={e => setDocForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Trade Licence 2025" />
                  </div>
                  <div>
                    <label className="label">Expiry Date</label>
                    <input type="date" className="input w-full" value={docForm.expiryDate}
                      onChange={e => setDocForm(prev => ({ ...prev, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-sm font-medium cursor-pointer transition-colors',
                    docFile
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50'
                  )}>
                    {docFile ? <Check size={14} /> : <Upload size={14} />}
                    {docFile ? docFile.name : 'Choose File...'}
                    <input ref={docInputRef} type="file" className="hidden" accept="image/*,.pdf"
                      onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button type="button" onClick={addDocToQueue} disabled={!docFile}
                    className="btn btn-primary text-sm disabled:opacity-40 shrink-0">
                    Add to Queue
                  </button>
                </div>
              </div>

              {pendingDocs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">
                    {pendingDocs.length} document{pendingDocs.length > 1 ? 's' : ''} queued
                  </p>
                  {pendingDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg">
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">{SUPPLIER_DOC_TYPES[doc.docType]} - {doc.file.name}</p>
                      </div>
                      <button type="button" onClick={() => removeDoc(doc.id)}
                        className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              {pendingDocs.length === 0 && (
                <p className="text-center text-xs text-gray-400">
                  No documents queued. You can also upload from the supplier profile after saving.
                </p>
              )}
            </div>
          )}

          {/* 5. Bank Details */}
          {tab === 'bank' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Bank Name</label>
                <input className="input w-full" {...str('bankName')} placeholder="Emirates NBD" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input className="input w-full font-mono" {...str('bankAccount')} />
              </div>
              <div>
                <label className="label">IBAN</label>
                <input className="input w-full font-mono" {...str('iban')} placeholder="AE070331234567890123456" />
              </div>
              <div>
                <label className="label">SWIFT / BIC</label>
                <input className="input w-full font-mono" {...str('swiftCode')} placeholder="EBILAEAD" />
              </div>
            </div>
          )}

          {/* 6. Notes + Review */}
          {tab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="label">Internal Notes / Remarks</label>
                <textarea className="input w-full" rows={3} {...str('notes')}
                  placeholder="Preferred contact times, quality history, SLA notes..." />
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-gray-600 mb-2">Review Before Saving</p>
                {[
                  { label: 'Name',       value: form.name },
                  { label: 'Trade Name', value: form.tradeName },
                  { label: 'Categories', value: form.categories.join(', ') },
                  { label: 'Contact',    value: form.contactName },
                  { label: 'Phone',      value: form.phone },
                  { label: 'Email',      value: form.email },
                  { label: 'City',       value: [form.city, form.country].filter(Boolean).join(', ') },
                  { label: 'TRN',        value: form.trn },
                  { label: 'Trade Lic.', value: form.tradeLicenseNumber },
                  { label: 'Bank',       value: form.bankName },
                  { label: 'IBAN',       value: form.iban },
                  { label: 'Payment',    value: form.paymentTermDays ? form.paymentTermDays + ' days' : '' },
                  { label: 'Documents',  value: pendingDocs.length > 0 ? pendingDocs.length + ' queued' : '' },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex text-xs gap-2">
                    <span className="text-gray-400 w-20 shrink-0">{r.label}</span>
                    <span className="text-gray-700 font-medium">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
          <button type="button" onClick={prev} disabled={isFirst}
            className="btn btn-secondary text-sm disabled:opacity-30">
            Previous
          </button>
          <span className="text-xs text-gray-400">{tabIdx + 1} / {WIZARD_TABS.length}</span>
          {isLast ? (
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="btn btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving...' : 'Create Supplier'}
            </button>
          ) : (
            <button type="button" onClick={next} className="btn btn-primary text-sm">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Main Page -----------------------------------------------------------------

export default function SuppliersPage() {
  const [items,      setItems]      = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [alerts,     setAlerts]     = useState<{ suppliers: any[]; documents: any[] }>({ suppliers: [], documents: [] });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      financeApi.suppliers.list({
        search:   search    || undefined,
        category: catFilter || undefined,
        status:   statFilter || undefined,
        page,
        limit: 30,
      }),
      financeApi.suppliers.expiryAlerts(),
    ])
      .then(([sr, ar]) => {
        setItems(sr.data.items || []);
        setTotal(sr.data.total || 0);
        setPages(sr.data.pages || 1);
        setAlerts(ar.data || { suppliers: [], documents: [] });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, catFilter, statFilter, page]);

  useEffect(() => { load(); }, [load]);

  const totalAlerts = (alerts.suppliers?.length || 0) + (alerts.documents?.length || 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Directory</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} supplier{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      {totalAlerts > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <FileWarning size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">{totalAlerts} expiry alert{totalAlerts > 1 ? 's' : ''} within 60 days</p>
              {alerts.suppliers?.map((a: any) => (
                <div key={a.id} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  <Link href={`/finance/suppliers/${a.id}`} className="font-medium underline">{a.name}</Link>
                  {a.tradeLicenseExpiry && (
                    <span>Trade licence: <span className="font-mono">{formatDate(a.tradeLicenseExpiry)}</span></span>
                  )}
                </div>
              ))}
              {alerts.documents?.map((d: any) => (
                <div key={d.id} className="text-xs">
                  <Link href={`/finance/suppliers/${d.supplierId}`} className="font-medium underline">
                    {d.supplier?.name}
                  </Link>
                  {' - '}{d.name}: <span className="font-mono">{formatDate(d.expiryDate)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search name, code, TRN..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-52" value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-40" value={statFilter}
          onChange={e => { setStatFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Supplier</th>
              <th className="table-th">Category</th>
              <th className="table-th">TRN / VAT</th>
              <th className="table-th">Trade Licence</th>
              <th className="table-th">Contact</th>
              <th className="table-th text-center">Contacts</th>
              <th className="table-th text-center">Docs</th>
              <th className="table-th text-center">Expenses</th>
              <th className="table-th">Status</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any) => {
              const licExpired = s.tradeLicenseExpiry && new Date(s.tradeLicenseExpiry) < new Date();
              const licWarn    = s.tradeLicenseExpiry && !licExpired &&
                new Date(s.tradeLicenseExpiry) < new Date(Date.now() + 60 * 86400000);
              return (
                <tr key={s.id} className="table-row">
                  <td className="table-td">
                    <Link href={`/finance/suppliers/${s.id}`}
                      className="font-medium text-gray-900 hover:text-brand-600 block">
                      {s.name}
                    </Link>
                    {s.supplierCode && <span className="text-xs font-mono text-gray-400">{s.supplierCode}</span>}
                    {s.tradeName && <p className="text-xs text-gray-400">{s.tradeName}</p>}
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap gap-1">
                      {(s.categories?.length > 0 ? s.categories : s.category ? [s.category] : []).map((cat: string) => (
                        <span key={cat} className={`badge text-xs ${
                          ['Maintenance Workshop', 'Spare Parts Supplier', 'Tire Supplier'].includes(cat)
                            ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                        }`}>{cat}</span>
                      ))}
                      {s.vendor && (
                        <span className="badge bg-orange-100 text-orange-700 text-xs flex items-center gap-0.5">
                          <Wrench size={10} /> Workshop
                        </span>
                      )}
                      {!s.categories?.length && !s.category && <span className="text-gray-300 text-xs">-</span>}
                    </div>
                  </td>
                  <td className="table-td">
                    <p className="text-xs font-mono text-gray-700">{s.trn || s.vatId || '-'}</p>
                  </td>
                  <td className="table-td text-xs">
                    <p className="text-gray-600">{s.tradeLicenseNumber || '-'}</p>
                    {s.tradeLicenseExpiry && (
                      <p className={cn(licExpired ? 'text-red-600 font-semibold' : licWarn ? 'text-amber-600' : 'text-gray-400')}>
                        {licExpired ? 'Expired' : licWarn ? 'Soon' : ''} {formatDate(s.tradeLicenseExpiry)}
                      </p>
                    )}
                  </td>
                  <td className="table-td text-xs text-gray-500">
                    {s.contactName && <p className="font-medium text-gray-700">{s.contactName}</p>}
                    {s.email && <p>{s.email}</p>}
                    {s.phone && <p>{s.phone}</p>}
                    {!s.contactName && !s.email && !s.phone && <span className="text-gray-300">-</span>}
                  </td>
                  <td className="table-td text-center text-xs text-gray-600">{s._count?.supplierContacts || 0}</td>
                  <td className="table-td text-center text-xs text-gray-600">{s._count?.documents || 0}</td>
                  <td className="table-td text-center text-xs text-gray-600">{s._count?.expenses || 0}</td>
                  <td className="table-td">
                    <span className={cn('badge text-xs', STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-500')}>
                      {s.status || (s.isActive ? 'ACTIVE' : 'INACTIVE')}
                    </span>
                  </td>
                  <td className="table-td">
                    <Link href={`/finance/suppliers/${s.id}`} className="text-gray-400 hover:text-brand-600">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="text-center py-16">
                  <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400">No suppliers found.</p>
                  <button onClick={() => setShowNew(true)} className="mt-3 text-brand-600 text-sm hover:underline">
                    + Add your first supplier
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {pages} - {total} total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {showNew && (
        <NewSupplierModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
}
