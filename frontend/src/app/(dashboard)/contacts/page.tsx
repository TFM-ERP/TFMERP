'use client';

import { useState, useEffect, useCallback } from 'react';
import { contactsApi, clientsApi, maintenanceApi } from '@/lib/api';
import {
  BookUser, Plus, Search, X, Smartphone, PhoneCall,
  Mail, Building2, Edit2, Trash2, ChevronDown, User,
} from 'lucide-react';
import PhoneInput, { PhoneDisplay } from '@/components/PhoneInput';
import EmailInput from '@/components/EmailInput';

// ── Types ─────────────────────────────────────────────────────────────────────

const CONTACT_TYPES = [
  { value: 'CREW_MEMBER',       label: 'Crew Member' },
  { value: 'VENDOR_EMPLOYEE',   label: 'Vendor Employee' },
  { value: 'CLIENT_EMPLOYEE',   label: 'Client Employee' },
  { value: 'WORKSHOP_EMPLOYEE', label: 'Workshop Employee' },
  { value: 'DRIVER_CONTACT',    label: 'Driver Contact' },
  { value: 'SUPPLIER_EMPLOYEE', label: 'Supplier Employee' },
  { value: 'FREELANCER',        label: 'Freelancer' },
  { value: 'OTHER',             label: 'Other' },
];

const TYPE_COLOURS: Record<string, string> = {
  CREW_MEMBER:       'bg-purple-100 text-purple-800',
  VENDOR_EMPLOYEE:   'bg-orange-100 text-orange-800',
  CLIENT_EMPLOYEE:   'bg-blue-100 text-blue-800',
  WORKSHOP_EMPLOYEE: 'bg-yellow-100 text-yellow-800',
  DRIVER_CONTACT:    'bg-green-100 text-green-800',
  SUPPLIER_EMPLOYEE: 'bg-teal-100 text-teal-800',
  FREELANCER:        'bg-pink-100 text-pink-800',
  OTHER:             'bg-gray-100 text-gray-700',
};

const EMPTY_FORM = {
  name: '',
  contactType: 'OTHER',
  jobTitle: '',
  department: '',
  company: '',
  mobile: '',
  whatsapp: '',
  landline: '',
  email: '',
  clientId: '',
  vendorId: '',
  supplierId: '',
  notes: '',
  isActive: true,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const label = CONTACT_TYPES.find((t) => t.value === type)?.label ?? type;
  const cls = TYPE_COLOURS[type] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: any;
  onEdit: (c: any) => void;
  onDelete: (c: any) => void;
}) {
  const linked =
    contact.client?.companyName ||
    contact.vendor?.name ||
    contact.supplier?.name ||
    contact.driver?.fullName ||
    contact.company;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{contact.name}</p>
            {(contact.jobTitle || contact.department) && (
              <p className="text-xs text-gray-500 truncate">
                {[contact.jobTitle, contact.department].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(contact)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(contact)}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Type + linked entity */}
      <div className="flex flex-wrap gap-2 items-center">
        <TypeBadge type={contact.contactType} />
        {linked && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Building2 className="w-3 h-3" />
            {linked}
          </span>
        )}
      </div>

      {/* Contact details */}
      <div className="flex flex-col gap-1.5 text-sm text-gray-600">
        {contact.mobile && (
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <PhoneDisplay value={contact.mobile} />
          </div>
        )}
        {contact.whatsapp && (
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-green-400" />
            <a
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm hover:text-green-600 transition-colors"
            >
              WA: {contact.whatsapp}
            </a>
          </div>
        )}
        {contact.landline && (
          <div className="flex items-center gap-2">
            <PhoneCall className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <PhoneDisplay value={contact.landline} />
          </div>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-indigo-600 truncate">
            <Mail className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
      </div>

      {!contact.isActive && (
        <span className="text-xs text-red-500 font-medium">Inactive</span>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ContactModal({
  open,
  initial,
  clients,
  vendors,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: any;
  clients: any[];
  vendors: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) {
      setForm({
        ...EMPTY_FORM,
        ...initial,
        clientId: initial.clientId ?? '',
        vendorId: initial.vendorId ?? '',
        supplierId: initial.supplierId ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
  }, [initial, open]);

  if (!open) return null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        clientId:   form.clientId   || null,
        vendorId:   form.vendorId   || null,
        supplierId: form.supplierId || null,
      };
      if (initial?.id) {
        await contactsApi.update(initial.id, payload);
      } else {
        await contactsApi.create(payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const selectCls = `${inputCls} bg-white`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial?.id ? 'Edit Contact' : 'New Contact'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Identity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Full Name *</label>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label className={labelCls}>Contact Type</label>
              <select className={selectCls} value={form.contactType} onChange={(e) => set('contactType', e.target.value)}>
                {CONTACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Job Title</label>
              <input className={inputCls} value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Workshop Manager" />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <input className={inputCls} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Operations" />
            </div>
            <div>
              <label className={labelCls}>Company (free text)</label>
              <input className={inputCls} value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Independent / workshop name" />
            </div>
          </div>

          {/* Communication */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Communication</p>
            <div className="grid grid-cols-2 gap-4">
              <PhoneInput
                label="Mobile"
                value={form.mobile}
                onChange={(v) => set('mobile', v)}
                placeholder="50 123 4567"
              />
              <PhoneInput
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => set('whatsapp', v)}
                placeholder="50 123 4567"
              />
              <PhoneInput
                label="Landline"
                value={form.landline}
                onChange={(v) => set('landline', v)}
                placeholder="2 123 4567"
              />
              <div>
                <label className={labelCls}>Email</label>
                <EmailInput className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Link to Existing Record (optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Client</label>
                <select className={selectCls} value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
                  <option value="">— None —</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Maintenance Vendor</label>
                <select className={selectCls} value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)}>
                  <option value="">— None —</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notes + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Any additional notes…"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 48;

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const [clients, setClients] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Load dropdown data once
  useEffect(() => {
    clientsApi.list().then((r) => setClients(r.data ?? [])).catch(() => {});
    maintenanceApi.vendors.list({ limit: 200 }).then((r) => setVendors(r.data?.items ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (typeFilter) params.contactType = typeFilter;
      const res = await contactsApi.list(params);
      setContacts(res.data.items);
      setTotal(res.data.total);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (c: any) => { setEditTarget(c); setModalOpen(true); };
  const handleNew  = () => { setEditTarget(null); setModalOpen(true); };
  const handleSaved = () => { setModalOpen(false); load(); };

  const handleDelete = async (c: any) => {
    if (!confirm(`Delete contact "${c.name}"?`)) return;
    await contactsApi.remove(c.id);
    load();
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookUser className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contact Directory</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} contact{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            placeholder="Search name, mobile, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="relative">
          <select
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            {CONTACT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {(search || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setPage(1); }}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <BookUser className="w-10 h-10 opacity-30" />
          <p>No contacts found.</p>
          <button onClick={handleNew} className="text-indigo-600 text-sm font-medium hover:underline">
            Add your first contact
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {contacts.map((c) => (
            <ContactCard key={c.id} contact={c} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">Page {page} of {pages}</span>
          <button
            disabled={page === pages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      <ContactModal
        open={modalOpen}
        initial={editTarget}
        clients={clients}
        vendors={vendors}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
