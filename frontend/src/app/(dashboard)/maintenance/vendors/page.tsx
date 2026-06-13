'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { maintenanceApi, uploadFile } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Search, RefreshCw, Plus, Phone, Mail, Globe, MapPin, Hammer,
  X, Save, Loader2, ChevronRight, Wrench, Building2, FileText,
  Upload, Trash2, Check, AlertTriangle,
} from 'lucide-react';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

// ── Constants ─────────────────────────────────────────────────────────────────

const VENDOR_TYPES = [
  'AUTO_WORKSHOP', 'CARAVAN_REPAIR', 'GENERATOR_REPAIR', 'ELECTRICAL_REPAIR',
  'AC_REPAIR', 'TIRE_SUPPLIER', 'SPARE_PARTS_SUPPLIER', 'STRUCTURAL_REPAIR', 'OTHER',
];

const VENDOR_TYPE_LABELS: Record<string, string> = {
  AUTO_WORKSHOP: 'Auto Workshop', CARAVAN_REPAIR: 'Caravan Repair',
  GENERATOR_REPAIR: 'Generator Repair', ELECTRICAL_REPAIR: 'Electrical Repair',
  AC_REPAIR: 'AC Repair', TIRE_SUPPLIER: 'Tire Supplier',
  SPARE_PARTS_SUPPLIER: 'Spare Parts Supplier', STRUCTURAL_REPAIR: 'Structural Repair',
  OTHER: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  AUTO_WORKSHOP: 'bg-blue-100 text-blue-700',
  CARAVAN_REPAIR: 'bg-orange-100 text-orange-700',
  GENERATOR_REPAIR: 'bg-yellow-100 text-yellow-700',
  ELECTRICAL_REPAIR: 'bg-purple-100 text-purple-700',
  AC_REPAIR: 'bg-cyan-100 text-cyan-700',
  TIRE_SUPPLIER: 'bg-gray-100 text-gray-700',
  SPARE_PARTS_SUPPLIER: 'bg-green-100 text-green-700',
  STRUCTURAL_REPAIR: 'bg-red-100 text-red-700',
  OTHER: 'bg-gray-100 text-gray-500',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  TRADE_LICENSE: 'Trade Licence', VAT_CERTIFICATE: 'VAT Certificate',
  CONTRACT: 'Contract', INSURANCE: 'Insurance',
  QUOTATION: 'Quotation', INVOICE: 'Invoice',
  INSPECTION_REPORT: 'Inspection Report', OTHER: 'Other',
};

const WIZARD_TABS = [
  { id: 'basic',    label: '1. Basic Info'       },
  { id: 'contact',  label: '2. Contact'           },
  { id: 'address',  label: '3. Address & Maps'    },
  { id: 'finance',  label: '4. Financial & VAT'   },
  { id: 'bank',     label: '5. Bank Details'      },
  { id: 'docs',     label: '6. Documents'         },
  { id: 'notes',    label: '7. Notes'             },
] as const;

type WizardTab = typeof WIZARD_TABS[number]['id'];

const EMPTY_FORM = {
  name: '', vendorType: 'AUTO_WORKSHOP', secondaryType: '',
  isActive: true,
  contactPerson: '', mobile: '', whatsapp: '', email: '', website: '',
  address: '', city: '', country: 'UAE', googleMapsUrl: '', gpsCoordinates: '',
  trn: '', tradeLicenseNumber: '', tradeLicenseExpiry: '',
  paymentTermDays: 30, currency: 'AED',
  bankName: '', bankAccountNo: '', iban: '', swiftCode: '',
  notes: '',
};

// ── Pending document type (for wizard upload step) ────────────────────────────
interface PendingDoc {
  id: string;
  docType: string;
  name: string;
  expiryDate: string;
  file: File;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

// ── Wizard Modal ──────────────────────────────────────────────────────────────

function VendorWizardModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (vendor: any) => void;
}) {
  const [tab, setTab]     = useState<WizardTab>('basic');
  const [form, setForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [docForm, setDocForm] = useState({ docType: 'TRADE_LICENSE', name: '', expiryDate: '' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const f = (k: keyof typeof EMPTY_FORM) => ({
    value: form[k] as string | number | boolean,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value })),
  });

  const str = (k: keyof typeof EMPTY_FORM) => ({
    value: String(form[k] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value })),
  });

  const addDocToQueue = () => {
    if (!docFile) return;
    if (!docForm.name.trim()) { setError('Document name is required'); return; }
    const doc: PendingDoc = {
      id: Math.random().toString(36).slice(2),
      ...docForm,
      file: docFile,
      uploading: false,
      uploaded: false,
    };
    setPendingDocs(d => [...d, doc]);
    setDocFile(null);
    setDocForm({ docType: 'TRADE_LICENSE', name: '', expiryDate: '' });
    if (docInputRef.current) docInputRef.current.value = '';
    setError('');
  };

  const removeDoc = (id: string) => setPendingDocs(d => d.filter(x => x.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Vendor name is required'); setTab('basic'); return; }
    setSaving(true); setError('');
    try {
      const res = await maintenanceApi.vendors.create({
        ...form,
        secondaryType:      form.secondaryType     || undefined,
        gpsCoordinates:     form.gpsCoordinates    || undefined,
        tradeLicenseExpiry: form.tradeLicenseExpiry || undefined,
        paymentTermDays:    Number(form.paymentTermDays) || 30,
      });
      const vendorId = res.data.id;

      // Upload any queued documents
      for (const doc of pendingDocs) {
        try {
          const uploaded = await uploadFile(doc.file);
          await maintenanceApi.vendors.addDocument(vendorId, {
            docType: doc.docType, name: doc.name,
            url: uploaded.url,
            expiryDate: doc.expiryDate || undefined,
          });
        } catch { /* individual doc failures are non-fatal */ }
      }

      onCreated(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create vendor');
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
            <Hammer size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">Add Vendor / Workshop</h2>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {/* ── 1. Basic Info ── */}
          {tab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Vendor / Workshop Name *</label>
                  <input className="input w-full" required {...str('name')} autoFocus
                    placeholder="e.g. Emirates Auto Workshop LLC" />
                </div>
                <div>
                  <label className="label">Primary Type *</label>
                  <select className="input w-full" {...str('vendorType')}>
                    {VENDOR_TYPES.map(t => <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Secondary Type <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                  <select className="input w-full" {...str('secondaryType')}>
                    <option value="">— None —</option>
                    {VENDOR_TYPES.map(t => <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input w-full" value={form.isActive ? 'true' : 'false'}
                    onChange={e => setForm(v => ({ ...v, isActive: e.target.value === 'true' }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                The vendor type helps categorize this partner in maintenance jobs and spending reports.
              </div>
            </div>
          )}

          {/* ── 2. Contact ── */}
          {tab === 'contact' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Primary Contact Person</label>
                <input className="input w-full" {...str('contactPerson')} placeholder="Full name" />
              </div>
              <div>
                <label className="label">Mobile</label>
                <PhoneInput value={form.mobile || ''} onChange={(v) => setForm(s => ({ ...s, mobile: v }))} placeholder="+971 50 000 0000" />
              </div>
              <div>
                <label className="label">WhatsApp</label>
                <PhoneInput value={form.whatsapp || ''} onChange={(v) => setForm(s => ({ ...s, whatsapp: v }))} placeholder="+971 50 000 0000" />
              </div>
              <div>
                <label className="label">Email</label>
                <EmailInput className="input w-full" {...str('email')} />
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input w-full" {...str('website')} placeholder="https://www.example.com" />
              </div>
              <div className="col-span-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                Additional contacts (sales rep, accounts, technical) can be added from the vendor profile after saving.
              </div>
            </div>
          )}

          {/* ── 3. Address & Maps ── */}
          {tab === 'address' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Address</label>
                <input className="input w-full" {...str('address')} placeholder="Street, area, building…" />
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
                  placeholder="https://maps.google.com/?q=… or share link from Google Maps" />
                <p className="text-xs text-gray-400 mt-1">Paste the share link from Google Maps for one-click navigation to the workshop.</p>
              </div>
              <div className="col-span-2">
                <label className="label">GPS Coordinates <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input className="input w-full" {...str('gpsCoordinates')} placeholder="25.2048, 55.2708" />
              </div>
            </div>
          )}

          {/* ── 4. Financial & VAT ── */}
          {tab === 'finance' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">TRN / VAT Number</label>
                <input className="input w-full font-mono" {...str('trn')} placeholder="100XXXXXXXXX00003" />
              </div>
              <div>
                <label className="label">Trade Licence No.</label>
                <input className="input w-full" {...str('tradeLicenseNumber')} />
              </div>
              <div>
                <label className="label">Trade Licence Expiry</label>
                <input type="date" className="input w-full" {...str('tradeLicenseExpiry')} />
              </div>
              <div>
                <label className="label">Currency</label>
                <select className="input w-full" {...str('currency')}>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                </select>
              </div>
              <div>
                <label className="label">Payment Terms (days)</label>
                <input type="number" className="input w-full" value={form.paymentTermDays}
                  onChange={e => setForm(v => ({ ...v, paymentTermDays: Number(e.target.value) }))}
                  min={0} placeholder="30" />
              </div>
              <div className="col-span-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                TRN is used to record recoverable VAT on maintenance invoices.
              </div>
            </div>
          )}

          {/* ── 5. Bank Details ── */}
          {tab === 'bank' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Bank Name</label>
                <input className="input w-full" {...str('bankName')} placeholder="Emirates NBD" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input className="input w-full font-mono" {...str('bankAccountNo')} />
              </div>
              <div>
                <label className="label">IBAN</label>
                <input className="input w-full font-mono" {...str('iban')} placeholder="AE XXXX XXXX XXXX XXXX XXXX X" />
              </div>
              <div>
                <label className="label">SWIFT / BIC</label>
                <input className="input w-full font-mono" {...str('swiftCode')} placeholder="EBILAEAD" />
              </div>
            </div>
          )}

          {/* ── 6. Documents ── */}
          {tab === 'docs' && (
            <div className="space-y-4">
              {/* Add document form */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 mb-3">Attach a Document</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="label">Type</label>
                    <select className="input w-full" value={docForm.docType}
                      onChange={e => setDocForm(f => ({ ...f, docType: e.target.value }))}>
                      {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Name *</label>
                    <input className="input w-full" value={docForm.name}
                      onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Trade Licence 2025" />
                  </div>
                  <div>
                    <label className="label">Expiry Date</label>
                    <input type="date" className="input w-full" value={docForm.expiryDate}
                      onChange={e => setDocForm(f => ({ ...f, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-sm font-medium cursor-pointer transition-colors',
                    docFile ? 'border-green-400 bg-green-50 text-green-700' : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50'
                  )}>
                    {docFile ? <Check size={14} /> : <Upload size={14} />}
                    {docFile ? docFile.name : 'Choose File…'}
                    <input ref={docInputRef} type="file" className="hidden" accept="image/*,.pdf"
                      onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button type="button" onClick={addDocToQueue} disabled={!docFile}
                    className="btn btn-primary text-sm disabled:opacity-40 shrink-0">
                    Add to Queue
                  </button>
                </div>
              </div>

              {/* Queue */}
              {pendingDocs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">{pendingDocs.length} document{pendingDocs.length > 1 ? 's' : ''} queued for upload</p>
                  {pendingDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg">
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">{DOC_TYPE_LABELS[doc.docType] || doc.docType} · {doc.file.name}</p>
                      </div>
                      <button type="button" onClick={() => removeDoc(doc.id)}
                        className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}

              {pendingDocs.length === 0 && (
                <p className="text-center py-6 text-sm text-gray-400">
                  No documents queued. You can also add documents from the vendor profile after saving.
                </p>
              )}
            </div>
          )}

          {/* ── 7. Notes ── */}
          {tab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="label">Internal Notes / Remarks</label>
                <textarea className="input w-full" rows={4} {...str('notes')}
                  placeholder="Specialization, work quality history, preferred contact times, SLA notes…" />
              </div>
              {/* Summary */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-gray-600 mb-2">Summary</p>
                {[
                  { label: 'Name',         value: form.name },
                  { label: 'Type',         value: VENDOR_TYPE_LABELS[form.vendorType] },
                  { label: 'Contact',      value: form.contactPerson },
                  { label: 'Mobile',       value: form.mobile },
                  { label: 'City',         value: [form.city, form.country].filter(Boolean).join(', ') },
                  { label: 'TRN',          value: form.trn },
                  { label: 'Payment',      value: form.paymentTermDays ? `${form.paymentTermDays} days` : '' },
                  { label: 'Documents',    value: pendingDocs.length > 0 ? `${pendingDocs.length} queued` : '' },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex text-xs gap-2">
                    <span className="text-gray-400 w-20 shrink-0">{r.label}</span>
                    <span className="text-gray-700 font-medium">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
          <button type="button" onClick={prev} disabled={isFirst}
            className="btn btn-secondary text-sm disabled:opacity-30">← Previous</button>
          <span className="text-xs text-gray-400">{tabIdx + 1} / {WIZARD_TABS.length}</span>
          {isLast ? (
            <button onClick={handleSubmit} disabled={saving}
              className="btn btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving…' : 'Create Vendor'}
            </button>
          ) : (
            <button type="button" onClick={next} className="btn btn-primary text-sm">Next →</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const [items,      setItems]      = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    maintenanceApi.vendors.list({
      search:     search     || undefined,
      vendorType: typeFilter || undefined,
      isActive:   activeFilter !== '' ? activeFilter : undefined,
      page, limit: 24,
    })
      .then(r => {
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, typeFilter, activeFilter, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Maintenance · Partners</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Vendors &amp; Workshops</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{total} third-party partner{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowWizard(true)} className="btn btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search name, contact, email…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-52" value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {VENDOR_TYPES.map(t => <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>)}
        </select>
        <select className="input w-36" value={activeFilter}
          onChange={e => { setActiveFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(vendor => (
          <Link key={vendor.id} href={`/maintenance/vendors/${vendor.id}`}
            className="card hover:shadow-md hover:border-brand-200 transition-all cursor-pointer block group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-brand-700 transition-colors line-clamp-2">
                  {vendor.name}
                </h3>
                {vendor.contactPerson && (
                  <p className="text-xs text-gray-500 mt-0.5">{vendor.contactPerson}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={cn('badge text-xs', TYPE_COLORS[vendor.vendorType] || 'bg-gray-100 text-gray-600')}>
                  {VENDOR_TYPE_LABELS[vendor.vendorType] || vendor.vendorType}
                </span>
                {!vendor.isActive && (
                  <span className="badge bg-gray-100 text-gray-500 text-xs">Inactive</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-gray-600 mb-3">
              {vendor.mobile && (
                <div className="flex items-center gap-2"><Phone size={11} className="text-gray-400 shrink-0" />{vendor.mobile}</div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-2"><Mail size={11} className="text-gray-400 shrink-0" /><span className="truncate">{vendor.email}</span></div>
              )}
              {(vendor.city || vendor.address) && (
                <div className="flex items-center gap-2"><MapPin size={11} className="text-gray-400 shrink-0" /><span className="truncate">{vendor.city || vendor.address}</span></div>
              )}
              {vendor.website && (
                <div className="flex items-center gap-2"><Globe size={11} className="text-gray-400 shrink-0" /><span className="truncate">{vendor.website}</span></div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
              <div className="flex items-center gap-3 text-gray-500">
                <span className="flex items-center gap-1"><Wrench size={11} />{vendor._count?.jobs || 0} jobs</span>
                <span className="flex items-center gap-1"><FileText size={11} />{vendor._count?.invoices || 0} inv.</span>
              </div>
              {Number(vendor.outstandingBalance) > 0 ? (
                <span className="text-red-600 font-semibold">AED {Number(vendor.outstandingBalance).toLocaleString()} due</span>
              ) : (
                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
              )}
            </div>
          </Link>
        ))}

        {items.length === 0 && !loading && (
          <div className="col-span-3 text-center py-20">
            <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">No vendors found.</p>
            <button onClick={() => setShowWizard(true)}
              className="mt-3 text-brand-600 text-sm hover:underline">
              + Add your first vendor
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-5 text-sm text-gray-600">
          <span>Page {page} of {pages} · {total} total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {showWizard && (
        <VendorWizardModal
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); load(); }}
        />
      )}
    </div>
  );
}
