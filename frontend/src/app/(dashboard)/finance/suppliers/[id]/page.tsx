'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { financeApi, uploadFile } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  ArrowLeft, Building2, Save, Loader2, Plus, X, Trash2,
  Phone, Mail, MessageCircle, FileText, User, CreditCard,
  DollarSign, Edit2, Check, CheckCircle2, Wrench, MapPin, ExternalLink,
} from 'lucide-react';
import { SUPPLIER_CATEGORIES } from '@/components/SupplierSelect';
import ContactPicker from '@/components/ContactPicker';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      'bg-green-100 text-green-700',
  INACTIVE:    'bg-gray-100 text-gray-500',
  BLACKLISTED: 'bg-red-100 text-red-700',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  TRADE_LICENSE: 'Trade Licence', VAT_CERTIFICATE: 'VAT Certificate',
  INSURANCE: 'Insurance', CONTRACT: 'Contract', BANK_DETAILS: 'Bank Details',
  QUOTATION: 'Quotation', INVOICE: 'Invoice', WARRANTY: 'Warranty', OTHER: 'Other',
};

const CONTACT_ROLES: Record<string, string> = {
  SALES: 'Sales', FINANCE: 'Finance / Accounting', OPERATIONS: 'Operations',
  TECHNICAL: 'Technical', MANAGEMENT: 'Management', EMERGENCY: 'Emergency', OTHER: 'Other',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

// ── Contact Card ──────────────────────────────────────────────────────────────

function ContactCard({ contact, onDelete, onEdit }: { contact: any; onDelete: () => void; onEdit: () => void }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 relative">
      {contact.isPrimary && (
        <span className="absolute top-3 right-3 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-medium">Primary</span>
      )}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <User size={14} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800">{contact.fullName}</p>
          {(contact.jobTitle || contact.department) && (
            <p className="text-xs text-gray-500">{[contact.jobTitle, contact.department].filter(Boolean).join(' · ')}</p>
          )}
          <p className="text-xs text-brand-600 mt-0.5">{CONTACT_ROLES[contact.role] ?? contact.role}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
            {contact.mobile      && <span className="flex items-center gap-1"><Phone size={11} />{contact.mobile}</span>}
            {contact.whatsapp    && <span className="flex items-center gap-1"><MessageCircle size={11} />{contact.whatsapp}</span>}
            {contact.email       && <span className="flex items-center gap-1"><Mail size={11} />{contact.email}</span>}
            {contact.officePhone && <span className="flex items-center gap-1"><Phone size={11} />Office: {contact.officePhone}</span>}
          </div>
          {contact.notes && <p className="text-xs text-gray-400 mt-1 italic">{contact.notes}</p>}
        </div>
      </div>
      <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
        <button onClick={onEdit}   className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Edit2 size={11} /> Edit</button>
        <button onClick={onDelete} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 size={11} /> Remove</button>
      </div>
    </div>
  );
}

// ── Contact Form ──────────────────────────────────────────────────────────────

const EMPTY_CONTACT = {
  fullName: '', role: 'OTHER', jobTitle: '', department: '',
  mobile: '', whatsapp: '', email: '', officePhone: '',
  preferredContact: '', isPrimary: false, notes: '',
};

function ContactForm({ initial, onSave, onCancel }: { initial?: any; onSave: (d: any) => Promise<void>; onCancel: () => void }) {
  const [form, setForm]     = useState<any>(initial ?? { ...EMPTY_CONTACT });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const f = (k: string) => ({
    value: form[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((v: any) => ({ ...v, [k]: e.target.value })),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try { await onSave(form); }
    catch (err: any) { setError(err?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="border border-brand-200 rounded-xl p-4 bg-brand-50/30 space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Full Name *</label><input className="input w-full" required {...f('fullName')} autoFocus /></div>
        <div><label className="label">Role</label>
          <select className="input w-full" {...f('role')}>
            {Object.entries(CONTACT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label className="label">Job Title</label><input className="input w-full" {...f('jobTitle')} /></div>
        <div><label className="label">Mobile</label><PhoneInput value={form.mobile || ''} onChange={(v) => setForm((s: any) => ({ ...s, mobile: v }))} placeholder="+971 50 XXX XXXX" /></div>
        <div><label className="label">WhatsApp</label><PhoneInput value={form.whatsapp || ''} onChange={(v) => setForm((s: any) => ({ ...s, whatsapp: v }))} placeholder="+971 50 XXX XXXX" /></div>
        <div><label className="label">Email</label><EmailInput className="input w-full" {...f('email')} /></div>
        <div><label className="label">Office Phone</label><PhoneInput value={form.officePhone || ''} onChange={(v) => setForm((s: any) => ({ ...s, officePhone: v }))} /></div>
        <div className="col-span-2"><label className="label">Notes</label><input className="input w-full" {...f('notes')} /></div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="isPrimary" checked={!!form.isPrimary}
            onChange={e => setForm((v: any) => ({ ...v, isPrimary: e.target.checked }))} className="rounded" />
          <label htmlFor="isPrimary" className="text-sm text-gray-700 cursor-pointer">Set as primary contact</label>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Saving…' : 'Save Contact'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary text-sm">Cancel</button>
      </div>
    </form>
  );
}

// ── Document Row ──────────────────────────────────────────────────────────────

function DocumentRow({ doc, onDelete }: { doc: any; onDelete: () => void }) {
  const expired = doc.expiryDate && new Date(doc.expiryDate) < new Date();
  const warn    = doc.expiryDate && !expired && new Date(doc.expiryDate) < new Date(Date.now() + 60 * 86400000);
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      <FileText size={16} className="text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{doc.name}</p>
        <p className="text-xs text-gray-400">
          {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
          {doc.expiryDate && (
            <span className={cn('ml-2', expired ? 'text-red-600 font-semibold' : warn ? 'text-amber-600' : '')}>
              · Expires: {formatDate(doc.expiryDate)}{expired ? ' ⚠ EXPIRED' : warn ? ' ⚠ Expiring soon' : ''}
            </span>
          )}
        </p>
        {doc.notes && <p className="text-xs text-gray-400 italic mt-0.5">{doc.notes}</p>}
      </div>
      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline shrink-0">View</a>
      <button onClick={onDelete} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SupplierDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [supplier,  setSupplier]  = useState<any>(null);
  const [summary,   setSummary]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [toast,     setToast]     = useState('');
  const [tab,       setTab]       = useState<'overview'|'contacts'|'documents'|'purchases'>('overview');
  const [editing,   setEditing]   = useState(false);
  const [editData,  setEditData]  = useState<any>({});
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact,     setEditContact]     = useState<any>(null);
  const [showDocForm,     setShowDocForm]     = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [docForm,  setDocForm]  = useState({ docType:'OTHER', name:'', fileUrl:'', expiryDate:'', notes:'' });
  const [docFile,  setDocFile]  = useState<File|null>(null);
  const [showStatusModal,  setShowStatusModal]  = useState(false);
  const [newStatus,        setNewStatus]        = useState('');
  const [blacklistReason,  setBlacklistReason]  = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, sumr] = await Promise.all([
        financeApi.suppliers.get(id),
        financeApi.suppliers.financialSummary(id),
      ]);
      const s = sr.data;
      // Ensure categories array is initialized
      if (!s.categories) s.categories = s.category ? [s.category] : [];
      setSupplier(s); setSummary(sumr.data); setEditData({ ...s });
    } catch { setError('Failed to load supplier'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Save edits
  const saveEdits = async () => {
    setSaving(true);
    try {
      const res = await financeApi.suppliers.update(id, editData);
      setSupplier(res.data); setEditing(false); showToast('Supplier updated');
    } catch (err: any) { setError(err?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const ef = (k: string) => ({
    value: editData[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setEditData((d: any) => ({ ...d, [k]: e.target.value })),
  });

  // Contacts
  const saveContact = async (data: any) => {
    if (editContact) {
      const res = await financeApi.suppliers.updateContact(editContact.id, data);
      setSupplier((s: any) => ({ ...s, supplierContacts: s.supplierContacts.map((c: any) => c.id === editContact.id ? res.data : c) }));
      setEditContact(null);
    } else {
      const res = await financeApi.suppliers.addContact(id, data);
      setSupplier((s: any) => ({ ...s, supplierContacts: [...(s.supplierContacts||[]), res.data] }));
      setShowContactForm(false);
    }
    showToast('Contact saved');
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Remove this contact?')) return;
    await financeApi.suppliers.removeContact(contactId);
    setSupplier((s: any) => ({ ...s, supplierContacts: s.supplierContacts.filter((c: any) => c.id !== contactId) }));
  };

  // Documents
  const submitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    let fileUrl = docForm.fileUrl;
    if (docFile) {
      setUploading(true);
      try { const r = await uploadFile(docFile); fileUrl = r.url; }
      finally { setUploading(false); }
    }
    if (!fileUrl) { alert('Please upload a file or enter a URL'); return; }
    const res = await financeApi.suppliers.addDocument(id, { ...docForm, fileUrl });
    setSupplier((s: any) => ({ ...s, documents: [res.data, ...(s.documents||[])] }));
    setShowDocForm(false);
    setDocForm({ docType:'OTHER', name:'', fileUrl:'', expiryDate:'', notes:'' });
    setDocFile(null);
    showToast('Document added');
  };

  const deleteDocument = async (docId: string) => {
    if (!confirm('Remove this document?')) return;
    await financeApi.suppliers.removeDocument(docId);
    setSupplier((s: any) => ({ ...s, documents: s.documents.filter((d: any) => d.id !== docId) }));
  };

  // Status change
  const changeStatus = async () => {
    await financeApi.suppliers.updateStatus(id, newStatus, blacklistReason||undefined);
    await load(); setShowStatusModal(false); showToast(`Status changed to ${newStatus}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  if (error && !supplier) return <div className="p-6 text-red-600">{error}</div>;
  if (!supplier) return null;

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'contacts',  label: 'Contacts' },
    { id: 'documents', label: `Documents (${supplier.documents?.length||0})` },
    { id: 'purchases', label: 'Purchase History' },
  ] as const;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/finance/suppliers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ArrowLeft size={14} /> Back to Supplier Directory
      </Link>

      {toast && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
            <Building2 size={22} className="text-brand-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
              <span className={cn('badge text-xs', STATUS_COLORS[supplier.status]??'bg-gray-100 text-gray-500')}>
                {supplier.status}
              </span>
            </div>
            {supplier.supplierCode && <p className="text-sm text-gray-400 font-mono">{supplier.supplierCode}</p>}
            {supplier.tradeName    && <p className="text-sm text-gray-500">{supplier.tradeName}</p>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { setNewStatus(supplier.status); setShowStatusModal(true); }}
            className="btn btn-secondary text-sm flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Change Status
          </button>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn btn-primary text-sm flex items-center gap-1.5">
              <Edit2 size={14} /> Edit
            </button>
          ) : (
            <>
              <button onClick={saveEdits} disabled={saving}
                className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
              </button>
              <button onClick={() => { setEditing(false); setEditData(supplier); }} className="btn btn-secondary text-sm">Cancel</button>
            </>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Purchases',  value: `AED ${Number(summary.totalSpend||0).toLocaleString()}` },
            { label: 'VAT Reclaimed',    value: `AED ${Number(summary.totalVatReclaimed||0).toLocaleString()}` },
            { label: 'Pending Payables', value: `AED ${Number(summary.pendingAmount||0).toLocaleString()}` },
            { label: 'Expense Records',  value: String(summary.expenseCount||0) },
          ].map(card => (
            <div key={card.label} className="card py-3 px-4">
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Basic Information</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Name *</label><input className="input w-full" {...ef('name')} /></div>
                <div><label className="label">Trade Name</label><input className="input w-full" {...ef('tradeName')} /></div>
                <div><label className="label">City</label><input className="input w-full" {...ef('city')} /></div>
                <div><label className="label">Country</label><input className="input w-full" {...ef('country')} /></div>
                <div className="col-span-2"><label className="label">Address</label><input className="input w-full" {...ef('address')} /></div>
                <div><label className="label">Website</label><input className="input w-full" {...ef('website')} /></div>
                <div>
                  <label className="label flex items-center gap-1"><MapPin size={12} /> Google Maps URL</label>
                  <input className="input w-full" {...ef('googleMapsUrl')} placeholder="https://maps.google.com/…" />
                </div>

                {/* Multi-select categories */}
                <div className="col-span-2">
                  <label className="label">Categories <span className="text-gray-400 font-normal text-xs">(select all that apply)</span></label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {SUPPLIER_CATEGORIES.map(cat => {
                      const sel = (editData.categories || []).includes(cat);
                      const isWorkshop = ['Maintenance Workshop','Spare Parts Supplier','Tire Supplier'].includes(cat);
                      return (
                        <button key={cat} type="button"
                          onClick={() => setEditData((d: any) => ({
                            ...d,
                            categories: sel
                              ? d.categories.filter((c: string) => c !== cat)
                              : [...(d.categories||[]), cat],
                          }))}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            sel
                              ? isWorkshop ? 'bg-orange-100 border-orange-400 text-orange-700'
                                          : 'bg-brand-100 border-brand-400 text-brand-700'
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                          }`}>
                          {isWorkshop && sel && <Wrench size={10} className="inline mr-1" />}{cat}
                        </button>
                      );
                    })}
                  </div>
                  {(editData.categories||[]).some((c: string) => ['Maintenance Workshop','Spare Parts Supplier','Tire Supplier'].includes(c)) && !supplier.vendorId && (
                    <p className="mt-1.5 text-xs text-orange-600 flex items-center gap-1">
                      <Wrench size={11} /> A Maintenance Vendor will be auto-created when you save.
                    </p>
                  )}
                </div>

                <div className="col-span-2"><label className="label">Notes</label><textarea className="input w-full" rows={2} {...ef('notes')} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Categories */}
                {((supplier.categories?.length > 0) || supplier.category) && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-1">Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(supplier.categories?.length > 0 ? supplier.categories : [supplier.category]).map((cat: string) => (
                        <span key={cat} className={`badge text-xs ${['Maintenance Workshop','Spare Parts Supplier','Tire Supplier'].includes(cat) ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>{cat}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Linked vendor */}
                {supplier.vendor && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-1">Maintenance Vendor</p>
                    <a href={`/rental/maintenance/vendors/${supplier.vendor.id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 hover:bg-orange-100">
                      <Wrench size={13} /> {supplier.vendor.name}
                      <ExternalLink size={11} className="ml-0.5 opacity-60" />
                    </a>
                  </div>
                )}
                <InfoRow label="Code"    value={supplier.supplierCode} />
                <InfoRow label="City"    value={supplier.city} />
                <InfoRow label="Country" value={supplier.country} />
                <InfoRow label="Address" value={supplier.address} />
                <InfoRow label="Website" value={supplier.website} />
                {supplier.googleMapsUrl && (
                  <div>
                    <p className="text-xs text-gray-400">Google Maps</p>
                    <a href={supplier.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> Open in Maps <ExternalLink size={11} />
                    </a>
                  </div>
                )}
                {supplier.notes && <div className="col-span-2"><p className="text-xs text-gray-400">Notes</p><p className="text-sm text-gray-700 italic mt-0.5">{supplier.notes}</p></div>}
                {supplier.blacklistReason && (
                  <div className="col-span-2 p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-500 font-semibold">Blacklist Reason</p>
                    <p className="text-sm text-red-700 mt-0.5">{supplier.blacklistReason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tax & Compliance */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Tax &amp; Compliance</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">TRN</label><input className="input w-full font-mono" {...ef('trn')} /></div>
                <div><label className="label">VAT ID</label><input className="input w-full font-mono" {...ef('vatId')} /></div>
                <div><label className="label">Trade Licence No.</label><input className="input w-full" {...ef('tradeLicenseNumber')} /></div>
                <div><label className="label">Trade Licence Expiry</label>
                  <input type="date" className="input w-full"
                    value={editData.tradeLicenseExpiry ? String(editData.tradeLicenseExpiry).slice(0,10) : ''}
                    onChange={e => setEditData((d:any) => ({...d, tradeLicenseExpiry: e.target.value}))} />
                </div>
                <div><label className="label">Insurance Expiry</label>
                  <input type="date" className="input w-full"
                    value={editData.insuranceExpiry ? String(editData.insuranceExpiry).slice(0,10) : ''}
                    onChange={e => setEditData((d:any) => ({...d, insuranceExpiry: e.target.value}))} />
                </div>
                <div><label className="label">Contract Expiry</label>
                  <input type="date" className="input w-full"
                    value={editData.contractExpiry ? String(editData.contractExpiry).slice(0,10) : ''}
                    onChange={e => setEditData((d:any) => ({...d, contractExpiry: e.target.value}))} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="TRN"               value={supplier.trn} />
                <InfoRow label="VAT ID"            value={supplier.vatId !== supplier.trn ? supplier.vatId : undefined} />
                <InfoRow label="Trade Licence No." value={supplier.tradeLicenseNumber} />
                {supplier.tradeLicenseExpiry && (
                  <div><p className="text-xs text-gray-400">Trade Licence Expiry</p>
                    <p className={cn('text-sm mt-0.5', new Date(supplier.tradeLicenseExpiry)<new Date() ? 'text-red-600 font-semibold':'text-gray-800')}>{formatDate(supplier.tradeLicenseExpiry)}</p>
                  </div>
                )}
                {supplier.insuranceExpiry && (
                  <div><p className="text-xs text-gray-400">Insurance Expiry</p>
                    <p className={cn('text-sm mt-0.5', new Date(supplier.insuranceExpiry)<new Date() ? 'text-red-600 font-semibold':'text-gray-800')}>{formatDate(supplier.insuranceExpiry)}</p>
                  </div>
                )}
                {supplier.contractExpiry && (
                  <div><p className="text-xs text-gray-400">Contract Expiry</p>
                    <p className={cn('text-sm mt-0.5', new Date(supplier.contractExpiry)<new Date() ? 'text-red-600 font-semibold':'text-gray-800')}>{formatDate(supplier.contractExpiry)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Financial Terms */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Financial Terms</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Currency</label>
                  <select className="input w-full" {...ef('currency')}>
                    {['AED','USD','EUR','GBP','SAR'].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Payment Terms (days)</label><input type="number" className="input w-full" {...ef('paymentTermDays')} min={0} /></div>
                <div><label className="label">Credit Limit</label><input type="number" className="input w-full" {...ef('creditLimit')} min={0} step={0.01} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Currency"      value={supplier.currency} />
                <InfoRow label="Payment Terms" value={supplier.paymentTermDays ? `${supplier.paymentTermDays} days` : undefined} />
                <InfoRow label="Credit Limit"  value={supplier.creditLimit ? `AED ${Number(supplier.creditLimit).toLocaleString()}` : undefined} />
              </div>
            )}
          </div>

          {/* Bank Details */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Bank Details</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Bank Name</label><input className="input w-full" {...ef('bankName')} /></div>
                <div><label className="label">Account Number</label><input className="input w-full" {...ef('bankAccount')} /></div>
                <div><label className="label">IBAN</label><input className="input w-full" {...ef('iban')} /></div>
                <div><label className="label">SWIFT / BIC</label><input className="input w-full" {...ef('swiftCode')} /></div>
                <div><label className="label">Branch</label><input className="input w-full" {...ef('bankBranch')} /></div>
                <div className="col-span-2"><label className="label">Bank Address</label><input className="input w-full" {...ef('bankAddress')} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Bank Name"    value={supplier.bankName} />
                <InfoRow label="Acct Number"  value={supplier.bankAccount} />
                <InfoRow label="IBAN"         value={supplier.iban} />
                <InfoRow label="SWIFT / BIC"  value={supplier.swiftCode} />
                <InfoRow label="Branch"       value={supplier.bankBranch} />
                <InfoRow label="Bank Address" value={supplier.bankAddress} />
                {!supplier.bankName && !supplier.iban && <p className="col-span-2 text-sm text-gray-400 italic">No bank details on file</p>}
              </div>
            )}
          </div>

          {/* Primary Contact */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Primary Contact</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Contact Name</label><input className="input w-full" {...ef('contactName')} /></div>
                <div><label className="label">Email</label><EmailInput className="input w-full" {...ef('email')} /></div>
                <div className="col-span-2"><label className="label">Phone</label><PhoneInput value={editData.phone || ''} onChange={(v) => setEditData((d: any) => ({ ...d, phone: v }))} /></div>
              </div>
            ) : (
              <div className="space-y-2">
                <InfoRow label="Name"  value={supplier.contactName} />
                <InfoRow label="Email" value={supplier.email} />
                <InfoRow label="Phone" value={supplier.phone} />
                {!supplier.contactName && !supplier.email && !supplier.phone && <p className="text-sm text-gray-400 italic">No primary contact set</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Contacts ── */}
      {tab === 'contacts' && (
        <ContactPicker supplierId={id} contactType="SUPPLIER_EMPLOYEE" />
      )}

      {/* ── Documents ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Trade licence, VAT certificate, contracts, insurance, and more.</p>
            {!showDocForm && (
              <button onClick={() => setShowDocForm(true)} className="btn btn-primary text-sm flex items-center gap-1.5">
                <Plus size={14} /> Add Document
              </button>
            )}
          </div>
          {showDocForm && (
            <form onSubmit={submitDocument} className="card border-brand-200 bg-brand-50/20 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Add Document</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Document Type</label>
                  <select className="input w-full" value={docForm.docType} onChange={e => setDocForm(d=>({...d,docType:e.target.value}))}>
                    {Object.entries(DOC_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label className="label">Document Name *</label>
                  <input className="input w-full" required value={docForm.name}
                    onChange={e => setDocForm(d=>({...d,name:e.target.value}))} placeholder="e.g. Trade Licence 2025" />
                </div>
                <div><label className="label">Expiry Date</label>
                  <input type="date" className="input w-full" value={docForm.expiryDate}
                    onChange={e => setDocForm(d=>({...d,expiryDate:e.target.value}))} />
                </div>
                <div><label className="label">Upload File</label>
                  <input type="file" className="input w-full text-sm py-1.5"
                    onChange={e => setDocFile(e.target.files?.[0]??null)} />
                </div>
                <div className="col-span-2"><label className="label">Or enter file URL</label>
                  <input className="input w-full" value={docForm.fileUrl}
                    onChange={e => setDocForm(d=>({...d,fileUrl:e.target.value}))} placeholder="https://..." />
                </div>
                <div className="col-span-2"><label className="label">Notes</label>
                  <input className="input w-full" value={docForm.notes}
                    onChange={e => setDocForm(d=>({...d,notes:e.target.value}))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={uploading} className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : null} {uploading ? 'Uploading…' : 'Save Document'}
                </button>
                <button type="button" onClick={() => setShowDocForm(false)} className="btn btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          )}
          <div className="card divide-y p-0 overflow-hidden">
            {(supplier.documents||[]).length === 0
              ? <div className="text-center py-10 text-gray-400"><FileText size={28} className="mx-auto mb-2 text-gray-300" />No documents yet.</div>
              : <div className="px-4">{(supplier.documents||[]).map((doc:any) => <DocumentRow key={doc.id} doc={doc} onDelete={() => deleteDocument(doc.id)} />)}</div>
            }
          </div>
        </div>
      )}

      {/* ── Purchase History ── */}
      {tab === 'purchases' && (
        <div>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Reference</th>
                  <th className="table-th">Category</th>
                  <th className="table-th">Description</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">VAT (AED)</th>
                  <th className="table-th text-right">Total (AED)</th>
                </tr>
              </thead>
              <tbody>
                {(supplier.expenses||[]).map((e:any) => (
                  <tr key={e.id} className="table-row">
                    <td className="table-td font-mono text-xs text-gray-600">{e.expenseNumber}</td>
                    <td className="table-td text-gray-600">{e.category}</td>
                    <td className="table-td text-gray-700 max-w-xs truncate">{e.description}</td>
                    <td className="table-td text-gray-600 whitespace-nowrap">{formatDate(e.expenseDate)}</td>
                    <td className="table-td"><span className="badge text-xs bg-gray-100 text-gray-600">{e.status}</span></td>
                    <td className="table-td text-right text-gray-600">{Number(e.vatAmount||0).toLocaleString()}</td>
                    <td className="table-td text-right font-medium text-gray-800">{Number(e.totalAmount||0).toLocaleString()}</td>
                  </tr>
                ))}
                {(supplier.expenses||[]).length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No purchase records</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {supplier._count?.expenses > 20 && (
            <p className="text-xs text-gray-400 mt-2 text-center">Showing last 20 of {supplier._count.expenses} records</p>
          )}
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Change Supplier Status</h3>
            <div><label className="label">New Status</label>
              <select className="input w-full" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="BLACKLISTED">Blacklisted</option>
              </select>
            </div>
            {newStatus === 'BLACKLISTED' && (
              <div><label className="label">Reason for Blacklisting</label>
                <textarea className="input w-full" rows={2} value={blacklistReason}
                  onChange={e => setBlacklistReason(e.target.value)} placeholder="Internal reason…" />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={changeStatus} className="btn btn-primary flex-1">Confirm</button>
              <button onClick={() => setShowStatusModal(false)} className="btn btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
