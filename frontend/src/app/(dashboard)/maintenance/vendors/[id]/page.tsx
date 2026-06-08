'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { maintenanceApi, contactsApi, uploadFile } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import {
  ArrowLeft, Edit2, Save, X, Phone, Mail, Globe, MapPin,
  Plus, FileText, Eye, Trash2, Upload, Loader2, ExternalLink,
  Wrench, DollarSign, User, MessageCircle, Check, CheckCircle2,
  Building2, CreditCard, AlertTriangle,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

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

const DOC_TYPES = ['TRADE_LICENSE', 'VAT_CERTIFICATE', 'CONTRACT', 'INSURANCE', 'QUOTATION', 'INVOICE', 'INSPECTION_REPORT', 'OTHER'];
const DOC_TYPE_LABELS: Record<string, string> = {
  TRADE_LICENSE: 'Trade Licence', VAT_CERTIFICATE: 'VAT Certificate',
  CONTRACT: 'Contract', INSURANCE: 'Insurance', QUOTATION: 'Quotation',
  INVOICE: 'Invoice', INSPECTION_REPORT: 'Inspection Report', OTHER: 'Other',
};

const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  APPROVED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  WAITING_FOR_PARTS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const CONTACT_ROLES: Record<string, string> = {
  SALES: 'Sales', FINANCE: 'Finance / Accounting', OPERATIONS: 'Operations',
  TECHNICAL: 'Technical', MANAGEMENT: 'Management', EMERGENCY: 'Emergency', OTHER: 'Other',
};

// ── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title, icon: Icon, children, editChildren, onEdit, onSave, onCancel, editing, saving,
}: {
  title: string;
  icon?: React.FC<any>;
  children: React.ReactNode;
  editChildren?: React.ReactNode;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  editing?: boolean;
  saving?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          {Icon && <Icon size={14} className="text-gray-400" />}
          {title}
        </h3>
        {onEdit && !editing && (
          <button onClick={onEdit} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
            <Edit2 size={11} /> Edit
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={onSave} disabled={saving}
              className="btn btn-primary py-0.5 px-2.5 text-xs flex items-center gap-1 disabled:opacity-50">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onCancel} className="btn btn-secondary py-0.5 px-2.5 text-xs">Cancel</button>
          </div>
        )}
      </div>
      {editing && editChildren ? editChildren : children}
    </div>
  );
}

// ── Contact Card ─────────────────────────────────────────────────────────────

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
          <p className="font-medium text-gray-800">{contact.fullName || contact.name}</p>
          {(contact.jobTitle || contact.department) && (
            <p className="text-xs text-gray-500">{[contact.jobTitle, contact.department].filter(Boolean).join(' · ')}</p>
          )}
          {contact.role && (
            <p className="text-xs text-brand-600 mt-0.5">{CONTACT_ROLES[contact.role] ?? contact.role}</p>
          )}
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
        <button onClick={onDelete} className="text-xs text-red-500  hover:underline flex items-center gap-1"><Trash2 size={11} /> Remove</button>
      </div>
    </div>
  );
}

// ── Contact Form ─────────────────────────────────────────────────────────────

const EMPTY_CONTACT = {
  fullName: '', role: 'OTHER', jobTitle: '', department: '',
  mobile: '', whatsapp: '', email: '', officePhone: '',
  isPrimary: false, notes: '',
};

function ContactForm({ initial, onSave, onCancel }: {
  initial?: any;
  onSave: (d: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [form,   setForm]   = useState<any>(initial ?? { ...EMPTY_CONTACT });
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
        <div>
          <label className="label">Role</label>
          <select className="input w-full" {...f('role')}>
            {Object.entries(CONTACT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label className="label">Job Title</label><input className="input w-full" {...f('jobTitle')} /></div>
        <div><label className="label">Mobile</label><input className="input w-full" {...f('mobile')} placeholder="+971 50 XXX XXXX" /></div>
        <div><label className="label">WhatsApp</label><input className="input w-full" {...f('whatsapp')} placeholder="+971 50 XXX XXXX" /></div>
        <div><label className="label">Email</label><input type="email" className="input w-full" {...f('email')} /></div>
        <div><label className="label">Office Phone</label><input className="input w-full" {...f('officePhone')} /></div>
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

// ── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, onDelete }: { doc: any; onDelete: () => void }) {
  const fullUrl = doc.url?.startsWith('http') ? doc.url : `${API_BASE}${doc.url}`;
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
              · Expires: {formatDate(doc.expiryDate)}{expired ? ' ⚠ EXPIRED' : warn ? ' ⚠ Soon' : ''}
            </span>
          )}
        </p>
      </div>
      <a href={fullUrl} target="_blank" rel="noopener noreferrer"
        className="text-xs text-brand-600 hover:underline flex items-center gap-1 shrink-0">
        <Eye size={12} /> View
      </a>
      <button onClick={onDelete} className="text-gray-400 hover:text-red-500 shrink-0 p-1">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VendorDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();

  const [vendor,    setVendor]    = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [contacts,  setContacts]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState('');
  const [tab,       setTab]       = useState<'overview' | 'contacts' | 'documents' | 'jobs' | 'invoices'>('overview');

  // Per-section edit state
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editData,    setEditData]    = useState<any>({});
  const [saving,      setSaving]      = useState(false);

  // Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdating,  setStatusUpdating]  = useState(false);

  // Contact state
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact,     setEditContact]     = useState<any>(null);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Document state
  const [showDocForm,  setShowDocForm]  = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [docForm,      setDocForm]      = useState({ docType: 'TRADE_LICENSE', name: '', expiryDate: '' });
  const [docFile,      setDocFile]      = useState<File | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    try {
      const [vRes, fRes] = await Promise.all([
        maintenanceApi.vendors.get(id),
        maintenanceApi.vendors.financialSummary(id),
      ]);
      setVendor(vRes.data);
      setEditData({ ...vRes.data });
      setFinancial(fRes.data);
    } catch {
      router.push('/maintenance/vendors');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const res = await contactsApi.list({ vendorId: id });
      setContacts(res.data?.items || res.data || []);
    } catch { setContacts([]); }
    finally { setContactsLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'contacts') loadContacts(); }, [tab, loadContacts]);

  // ── Per-section save ────────────────────────────────────────────────────────

  const startEdit = (section: string) => {
    setEditData({ ...vendor });
    setEditSection(section);
  };

  const cancelEdit = () => setEditSection(null);

  const saveSection = async (section: string) => {
    setSaving(true);
    try {
      const res = await maintenanceApi.vendors.update(id, editData);
      setVendor(res.data);
      setEditSection(null);
      showToast('Saved successfully');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const ef = (k: string) => ({
    value: editData[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditData((d: any) => ({ ...d, [k]: e.target.value })),
  });

  // ── Status change ────────────────────────────────────────────────────────────

  const toggleStatus = async () => {
    setStatusUpdating(true);
    try {
      await maintenanceApi.vendors.update(id, { isActive: !vendor.isActive });
      await load();
      showToast(`Status changed to ${!vendor.isActive ? 'Active' : 'Inactive'}`);
    } finally {
      setStatusUpdating(false);
      setShowStatusModal(false);
    }
  };

  // ── Contacts ─────────────────────────────────────────────────────────────────

  const saveContact = async (data: any) => {
    const payload = { ...data, vendorId: id };
    if (editContact) {
      const res = await contactsApi.update(editContact.id, payload);
      setContacts(cs => cs.map(c => c.id === editContact.id ? res.data : c));
      setEditContact(null);
    } else {
      const res = await contactsApi.create(payload);
      setContacts(cs => [...cs, res.data]);
      setShowContactForm(false);
    }
    showToast('Contact saved');
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Remove this contact?')) return;
    await contactsApi.remove(contactId);
    setContacts(cs => cs.filter(c => c.id !== contactId));
    showToast('Contact removed');
  };

  // ── Documents ─────────────────────────────────────────────────────────────────

  const handleDocUpload = async () => {
    if (!docForm.name.trim()) { showToast('Please enter a document name'); return; }
    if (!docFile) { showToast('Please select a file'); return; }
    setUploading(true);
    try {
      const uploaded = await uploadFile(docFile);
      await maintenanceApi.vendors.addDocument(id, {
        docType: docForm.docType,
        name:    docForm.name,
        url:     uploaded.url,
        expiryDate: docForm.expiryDate || undefined,
      });
      setShowDocForm(false);
      setDocForm({ docType: 'TRADE_LICENSE', name: '', expiryDate: '' });
      setDocFile(null);
      if (docInputRef.current) docInputRef.current.value = '';
      await load();
      showToast('Document added');
    } catch (err: any) {
      showToast(err?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const removeDocument = async (docId: string) => {
    if (!confirm('Remove this document?')) return;
    await maintenanceApi.vendors.removeDocument(docId);
    setVendor((v: any) => ({ ...v, documents: v.documents.filter((d: any) => d.id !== docId) }));
    showToast('Document removed');
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );
  if (!vendor) return null;

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'contacts',  label: `Contacts (${contacts.length})` },
    { id: 'documents', label: `Documents (${vendor.documents?.length || 0})` },
    { id: 'jobs',      label: `Jobs (${vendor._count?.jobs || vendor.jobs?.length || 0})` },
    { id: 'invoices',  label: `Invoices (${vendor._count?.invoices || vendor.invoices?.length || 0})` },
  ] as const;

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/maintenance/vendors" className="btn btn-secondary p-1.5">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Wrench size={22} className="text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
              <span className={cn('badge text-xs', vendor.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                {vendor.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[vendor.vendorType] ?? 'bg-gray-100 text-gray-500')}>
                {VENDOR_TYPE_LABELS[vendor.vendorType] ?? vendor.vendorType}
              </span>
              {vendor.secondaryType && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[vendor.secondaryType] ?? 'bg-gray-100 text-gray-500')}>
                  {VENDOR_TYPE_LABELS[vendor.secondaryType] ?? vendor.secondaryType}
                </span>
              )}
              {vendor.supplier && (
                <Link href={`/finance/suppliers/${vendor.supplier.id}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5 hover:bg-brand-100">
                  <Building2 size={10} /> {vendor.supplier.name} <ExternalLink size={9} />
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowStatusModal(true)}
            className="btn btn-secondary text-sm flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Change Status
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      {financial && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Invoiced', value: formatCurrency(financial.totalInvoiced || 0), color: 'text-gray-900' },
            { label: 'Total Paid',     value: formatCurrency(financial.totalPaid     || 0), color: 'text-green-700' },
            { label: 'Outstanding',    value: formatCurrency(financial.outstanding   || 0), color: (financial.outstanding || 0) > 0 ? 'text-red-600' : 'text-green-700' },
            { label: 'Total Jobs',     value: String(vendor._count?.jobs || vendor.jobs?.length || 0), color: 'text-gray-900' },
          ].map(card => (
            <div key={card.label} className="card py-3 px-4">
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className={cn('text-xl font-bold mt-0.5', card.color)}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Basic Info */}
          <SectionCard
            title="Basic Information"
            icon={Wrench}
            editing={editSection === 'basic'}
            saving={saving}
            onEdit={() => startEdit('basic')}
            onSave={() => saveSection('basic')}
            onCancel={cancelEdit}
            editChildren={
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Name *</label>
                  <input className="input w-full" {...ef('name')} />
                </div>
                <div>
                  <label className="label">Primary Type</label>
                  <select className="input w-full" {...ef('vendorType')}>
                    {VENDOR_TYPES.map(t => <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Secondary Type</label>
                  <select className="input w-full" value={editData.secondaryType || ''}
                    onChange={e => setEditData((d: any) => ({ ...d, secondaryType: e.target.value || null }))}>
                    <option value="">— None —</option>
                    {VENDOR_TYPES.map(t => <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input w-full" rows={3} {...ef('notes')} />
                </div>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <span className={cn('text-xs px-2 py-1 rounded-full font-medium', TYPE_COLORS[vendor.vendorType] ?? 'bg-gray-100 text-gray-500')}>
                  {VENDOR_TYPE_LABELS[vendor.vendorType] ?? vendor.vendorType}
                </span>
                {vendor.secondaryType && (
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', TYPE_COLORS[vendor.secondaryType] ?? 'bg-gray-100 text-gray-500')}>
                    {VENDOR_TYPE_LABELS[vendor.secondaryType] ?? vendor.secondaryType}
                  </span>
                )}
              </div>
              {vendor.notes
                ? <p className="text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg">{vendor.notes}</p>
                : <p className="text-xs text-gray-400">No notes</p>
              }
            </div>
          </SectionCard>

          {/* Contact Info */}
          <SectionCard
            title="Contact Information"
            icon={Phone}
            editing={editSection === 'contact'}
            saving={saving}
            onEdit={() => startEdit('contact')}
            onSave={() => saveSection('contact')}
            onCancel={cancelEdit}
            editChildren={
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Contact Person</label>
                  <input className="input w-full" {...ef('contactPerson')} placeholder="Full name" />
                </div>
                <div>
                  <label className="label">Mobile</label>
                  <input className="input w-full" {...ef('mobile')} placeholder="+971 50 000 0000" />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input className="input w-full" {...ef('whatsapp')} placeholder="+971 50 000 0000" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input w-full" {...ef('email')} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input className="input w-full" {...ef('website')} placeholder="https://…" />
                </div>
              </div>
            }
          >
            <div className="space-y-2 text-sm">
              {vendor.contactPerson && (
                <p className="font-medium text-gray-800">{vendor.contactPerson}</p>
              )}
              {vendor.mobile && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone size={13} className="text-gray-400 shrink-0" />{vendor.mobile}
                </div>
              )}
              {vendor.whatsapp && vendor.whatsapp !== vendor.mobile && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MessageCircle size={13} className="text-green-500 shrink-0" />WhatsApp: {vendor.whatsapp}
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail size={13} className="text-gray-400 shrink-0" />{vendor.email}
                </div>
              )}
              {vendor.website && (
                <div className="flex items-center gap-2">
                  <Globe size={13} className="text-gray-400 shrink-0" />
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                    className="text-brand-600 hover:underline flex items-center gap-1">
                    {vendor.website} <ExternalLink size={10} />
                  </a>
                </div>
              )}
              {!vendor.contactPerson && !vendor.mobile && !vendor.email && (
                <p className="text-xs text-gray-400">No contact info</p>
              )}
            </div>
          </SectionCard>

          {/* Address & Location */}
          <SectionCard
            title="Address & Location"
            icon={MapPin}
            editing={editSection === 'address'}
            saving={saving}
            onEdit={() => startEdit('address')}
            onSave={() => saveSection('address')}
            onCancel={cancelEdit}
            editChildren={
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Full Address</label>
                  <input className="input w-full" {...ef('address')} placeholder="Street, area, building…" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input w-full" {...ef('city')} placeholder="Dubai" />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input className="input w-full" {...ef('country')} />
                </div>
                <div className="col-span-2">
                  <label className="label flex items-center gap-1"><MapPin size={11} /> Google Maps URL</label>
                  <input className="input w-full" {...ef('googleMapsUrl')} placeholder="https://maps.google.com/…" />
                </div>
                <div className="col-span-2">
                  <label className="label">GPS Coordinates</label>
                  <input className="input w-full" {...ef('gpsCoordinates')} placeholder="25.2048, 55.2708" />
                </div>
              </div>
            }
          >
            <div className="space-y-2 text-sm">
              {vendor.address && (
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p>{vendor.address}</p>
                    {(vendor.city || vendor.country) && (
                      <p className="text-gray-500">{[vendor.city, vendor.country].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
              {vendor.googleMapsUrl && (
                <a href={vendor.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
                  <MapPin size={11} /> Open in Google Maps <ExternalLink size={10} />
                </a>
              )}
              {vendor.gpsCoordinates && (
                <p className="text-xs text-gray-500 font-mono">GPS: {vendor.gpsCoordinates}</p>
              )}
              {!vendor.address && !vendor.googleMapsUrl && (
                <p className="text-xs text-gray-400">No location info</p>
              )}
            </div>
          </SectionCard>

          {/* UAE Compliance */}
          <SectionCard
            title="UAE Compliance & Financial Terms"
            icon={CreditCard}
            editing={editSection === 'compliance'}
            saving={saving}
            onEdit={() => startEdit('compliance')}
            onSave={() => saveSection('compliance')}
            onCancel={cancelEdit}
            editChildren={
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">TRN / VAT Number</label>
                  <input className="input w-full font-mono" {...ef('trn')} placeholder="100XXXXXXXXX00003" />
                </div>
                <div>
                  <label className="label">Trade Licence No.</label>
                  <input className="input w-full" {...ef('tradeLicenseNumber')} />
                </div>
                <div>
                  <label className="label">Trade Licence Expiry</label>
                  <input type="date" className="input w-full" {...ef('tradeLicenseExpiry')} />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select className="input w-full" {...ef('currency')}>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="SAR">SAR — Saudi Riyal</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment Terms (days)</label>
                  <input type="number" className="input w-full" min={0}
                    value={editData.paymentTermDays ?? 30}
                    onChange={e => setEditData((d: any) => ({ ...d, paymentTermDays: Number(e.target.value) }))} />
                </div>
              </div>
            }
          >
            <div className="space-y-2 text-sm">
              {[
                { label: 'TRN / VAT',       value: vendor.trn },
                { label: 'Trade Licence',   value: vendor.tradeLicenseNumber },
                { label: 'Licence Expiry',  value: vendor.tradeLicenseExpiry ? formatDate(vendor.tradeLicenseExpiry) : null },
                { label: 'Currency',        value: vendor.currency },
                { label: 'Payment Terms',   value: vendor.paymentTermDays ? `${vendor.paymentTermDays} days` : null },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="flex justify-between">
                  <span className="text-gray-400 text-xs">{f.label}</span>
                  <span className="font-medium text-gray-800 text-xs">{f.value}</span>
                </div>
              ))}
              {!vendor.trn && !vendor.tradeLicenseNumber && (
                <p className="text-xs text-gray-400">No compliance info</p>
              )}
            </div>
          </SectionCard>

          {/* Bank Details */}
          <SectionCard
            title="Bank Details"
            icon={DollarSign}
            editing={editSection === 'bank'}
            saving={saving}
            onEdit={() => startEdit('bank')}
            onSave={() => saveSection('bank')}
            onCancel={cancelEdit}
            editChildren={
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Bank Name</label>
                  <input className="input w-full" {...ef('bankName')} placeholder="Emirates NBD" />
                </div>
                <div>
                  <label className="label">Account Number</label>
                  <input className="input w-full font-mono" {...ef('bankAccountNo')} />
                </div>
                <div>
                  <label className="label">IBAN</label>
                  <input className="input w-full font-mono" {...ef('iban')} placeholder="AE XXXX XXXX XXXX XXXX XXXX X" />
                </div>
                <div>
                  <label className="label">SWIFT Code</label>
                  <input className="input w-full font-mono" {...ef('swiftCode')} />
                </div>
              </div>
            }
          >
            <div className="space-y-2 text-sm">
              {[
                { label: 'Bank',       value: vendor.bankName },
                { label: 'Account',    value: vendor.bankAccountNo },
                { label: 'IBAN',       value: vendor.iban },
                { label: 'SWIFT',      value: vendor.swiftCode },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="flex justify-between">
                  <span className="text-gray-400 text-xs">{f.label}</span>
                  <span className="font-mono text-xs text-gray-800">{f.value}</span>
                </div>
              ))}
              {!vendor.bankName && !vendor.iban && (
                <p className="text-xs text-gray-400">No bank details added</p>
              )}
            </div>
          </SectionCard>

        </div>
      )}

      {/* ── CONTACTS TAB ── */}
      {tab === 'contacts' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Workshop Contacts</h3>
            <button onClick={() => { setShowContactForm(true); setEditContact(null); }}
              className="btn btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Add Contact
            </button>
          </div>

          {(showContactForm && !editContact) && (
            <div className="mb-4">
              <ContactForm
                onSave={saveContact}
                onCancel={() => setShowContactForm(false)}
              />
            </div>
          )}

          {contactsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map(c => (
                editContact?.id === c.id ? (
                  <div key={c.id} className="md:col-span-2">
                    <ContactForm
                      initial={c}
                      onSave={saveContact}
                      onCancel={() => setEditContact(null)}
                    />
                  </div>
                ) : (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    onEdit={() => { setEditContact(c); setShowContactForm(false); }}
                    onDelete={() => deleteContact(c.id)}
                  />
                )
              ))}
              {contacts.length === 0 && !showContactForm && (
                <div className="col-span-2 text-center py-10 text-gray-400">
                  <User size={28} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No contacts yet. Add the primary contact, accounts, or technical reps.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {tab === 'documents' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Vendor Documents</h3>
            <button onClick={() => setShowDocForm(!showDocForm)}
              className="btn btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Add Document
            </button>
          </div>

          {showDocForm && (
            <div className="card mb-4">
              <h4 className="text-xs font-semibold text-gray-600 mb-3">Upload Document</h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input w-full" value={docForm.docType}
                    onChange={e => setDocForm(f => ({ ...f, docType: e.target.value }))}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Document Name *</label>
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
              <div className="mb-3">
                <label className={cn(
                  'flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed text-sm font-medium cursor-pointer transition-colors',
                  uploading ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50'
                )}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {docFile ? docFile.name : uploading ? 'Uploading…' : 'Choose File'}
                  <input ref={docInputRef} type="file" className="hidden" accept="image/*,.pdf" disabled={uploading}
                    onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleDocUpload} disabled={uploading || !docFile || !docForm.name}
                  className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {uploading ? 'Uploading…' : 'Upload & Save'}
                </button>
                <button onClick={() => { setShowDocForm(false); setDocFile(null); }} className="btn btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div className="card p-0 divide-y divide-gray-100">
            {vendor.documents?.map((doc: any) => (
              <div key={doc.id} className="px-4">
                <DocumentRow doc={doc} onDelete={() => removeDocument(doc.id)} />
              </div>
            ))}
            {(!vendor.documents || vendor.documents.length === 0) && !showDocForm && (
              <div className="text-center py-10 text-gray-400">
                <FileText size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No documents yet. Add trade licence, VAT certificate, contracts…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── JOBS TAB ── */}
      {tab === 'jobs' && (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Wrench size={14} /> Maintenance Jobs
            </h3>
            <Link href={`/maintenance/jobs?vendorId=${id}`}
              className="text-xs text-brand-600 hover:underline">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Job No.</th>
                <th className="table-th">Asset</th>
                <th className="table-th">Category</th>
                <th className="table-th">Opened</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {vendor.jobs?.map((job: any) => (
                <tr key={job.id} className="table-row">
                  <td className="table-td">
                    <Link href={`/maintenance/jobs/${job.id}`}
                      className="font-mono text-xs text-brand-600 hover:underline">{job.jobNumber}</Link>
                  </td>
                  <td className="table-td text-sm">{job.asset?.name || '—'}</td>
                  <td className="table-td text-sm text-gray-500">{job.category || '—'}</td>
                  <td className="table-td text-xs text-gray-500">{formatDate(job.openedAt)}</td>
                  <td className="table-td">
                    <span className={cn('badge', JOB_STATUS_COLORS[job.status])}>
                      {job.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="table-td text-right text-sm">
                    {job.totalCost ? formatCurrency(job.totalCost) : '—'}
                  </td>
                </tr>
              ))}
              {(!vendor.jobs || vendor.jobs.length === 0) && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No jobs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── INVOICES TAB ── */}
      {tab === 'invoices' && (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <DollarSign size={14} /> Vendor Invoices
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Invoice No.</th>
                <th className="table-th">Job</th>
                <th className="table-th">Issued</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Total</th>
                <th className="table-th text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {vendor.invoices?.map((inv: any) => (
                <tr key={inv.id} className="table-row">
                  <td className="table-td font-mono text-xs text-brand-600">{inv.invoiceNumber}</td>
                  <td className="table-td text-xs text-gray-500">{inv.job?.jobNumber || '—'}</td>
                  <td className="table-td text-xs text-gray-500">{formatDate(inv.issuedAt)}</td>
                  <td className="table-td">
                    <span className={cn('badge',
                      inv.status === 'PAID' ? 'bg-green-100 text-green-700'
                        : inv.status === 'DISPUTED' ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700')}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="table-td text-right">{formatCurrency(inv.total)}</td>
                  <td className="table-td text-right font-semibold">
                    {Number(inv.amountDue) > 0
                      ? <span className="text-red-600">{formatCurrency(inv.amountDue)}</span>
                      : <span className="text-green-600">Paid</span>}
                  </td>
                </tr>
              ))}
              {(!vendor.invoices || vendor.invoices.length === 0) && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No invoices yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── STATUS MODAL ── */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-brand-600" />
              Change Vendor Status
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              Currently <strong>{vendor.isActive ? 'Active' : 'Inactive'}</strong>.
              Switch to <strong>{vendor.isActive ? 'Inactive' : 'Active'}</strong>?
            </p>
            {vendor.isActive && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Setting to Inactive will hide this vendor from new job assignments.</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowStatusModal(false)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={toggleStatus} disabled={statusUpdating}
                className={cn('btn text-sm flex items-center gap-1.5 disabled:opacity-50',
                  vendor.isActive ? 'btn-secondary text-red-600' : 'btn-primary')}>
                {statusUpdating && <Loader2 size={13} className="animate-spin" />}
                Set {vendor.isActive ? 'Inactive' : 'Active'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
