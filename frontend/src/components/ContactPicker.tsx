'use client';

import { useEffect, useState, useCallback } from 'react';
import { contactsApi } from '@/lib/api';
import { Plus, Search, User, X, Link2, Loader2 } from 'lucide-react';

/**
 * Directory-backed contact picker.
 *
 * Contacts live in the central Contact module. This component shows the
 * contacts linked to a given entity (client/supplier/vendor/driver) and lets
 * the user either LINK an existing directory contact or ADD a new one — both
 * write to the Contact module, never to a standalone per-entity table.
 *
 * Pass exactly one of clientId / supplierId / vendorId / driverId.
 */
type LinkKey = 'clientId' | 'supplierId' | 'vendorId' | 'driverId';

export default function ContactPicker({
  clientId, supplierId, vendorId, driverId, contactType = 'OTHER',
}: {
  clientId?: string; supplierId?: string; vendorId?: string; driverId?: string;
  contactType?: string;
}) {
  const linkKey: LinkKey =
    clientId ? 'clientId' : supplierId ? 'supplierId' : vendorId ? 'vendorId' : 'driverId';
  const linkId = (clientId || supplierId || vendorId || driverId)!;

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    contactsApi.list({ [linkKey]: linkId, limit: 200 })
      .then(r => setContacts(r.data.items || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [linkKey, linkId]);
  useEffect(() => { load(); }, [load]);

  const unlink = async (c: any) => {
    if (!confirm(`Remove ${c.name} from this record? (The contact stays in the Contacts directory.)`)) return;
    // Unlink rather than delete — clear the FK so it remains in the directory.
    await contactsApi.update(c.id, { [linkKey]: null });
    load();
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          Contacts <span className="text-xs text-gray-400">· from the Contacts directory</span>
        </h3>
        <button onClick={() => setPicking(true)} className="btn btn-primary text-xs"><Plus size={12} className="mr-1" /> Add / Link Contact</button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-gray-400"><Loader2 className="animate-spin inline" size={16} /></div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No contacts linked. Use “Add / Link Contact”.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1"><User size={12} className="text-gray-400" /> {c.name}</p>
                {c.jobTitle && <p className="text-xs text-gray-400">{c.jobTitle}{c.department ? ` · ${c.department}` : ''}</p>}
                {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                {(c.mobile || c.whatsapp || c.landline) && <p className="text-xs text-gray-500">{[c.mobile, c.whatsapp, c.landline].filter(Boolean).join(' · ')}</p>}
              </div>
              <button onClick={() => unlink(c)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <ContactPickerModal
          linkKey={linkKey} linkId={linkId} contactType={contactType}
          onClose={() => setPicking(false)}
          onDone={() => { setPicking(false); load(); }}
        />
      )}
    </div>
  );
}

function ContactPickerModal({ linkKey, linkId, contactType, onClose, onDone }: {
  linkKey: LinkKey; linkId: string; contactType: string;
  onClose: () => void; onDone: () => void;
}) {
  const [mode, setMode] = useState<'link' | 'new'>('link');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', jobTitle: '', department: '', email: '', mobile: '', whatsapp: '', landline: '' });

  // Search the whole directory for UNLINKED-to-this-entity contacts
  useEffect(() => {
    if (mode !== 'link') return;
    setSearching(true);
    const t = setTimeout(() => {
      contactsApi.list({ search: search || undefined, limit: 25 })
        .then(r => setResults((r.data.items || r.data || []).filter((c: any) => c[linkKey] !== linkId)))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search, mode, linkKey, linkId]);

  const linkExisting = async (c: any) => {
    await contactsApi.update(c.id, { [linkKey]: linkId });
    onDone();
  };

  const createNew = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await contactsApi.create({ ...form, contactType, [linkKey]: linkId });
      onDone();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[520px] max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-semibold">Add Contact</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b">
          <button onClick={() => setMode('link')} className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${mode === 'link' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400'}`}>Link existing</button>
          <button onClick={() => setMode('new')} className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${mode === 'new' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400'}`}>Add new</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mode === 'link' ? (
            <>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 w-full" placeholder="Search contacts directory…" autoFocus value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="space-y-1.5 max-h-[48vh] overflow-y-auto">
                {searching ? (
                  <div className="text-center py-6 text-gray-400"><Loader2 className="animate-spin inline" size={16} /></div>
                ) : results.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">No matching contacts. Switch to “Add new”.</div>
                ) : results.map(c => (
                  <button key={c.id} onClick={() => linkExisting(c)}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/40">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{[c.jobTitle, c.company, c.email].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <Link2 size={15} className="text-gray-300" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Name *</label><input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Job Title</label><input className="input w-full" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} /></div>
              <div><label className="label">Department</label><input className="input w-full" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
              <div><label className="label">Email</label><input className="input w-full" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="label">Mobile</label><input className="input w-full" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} /></div>
              <div><label className="label">WhatsApp</label><input className="input w-full" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
              <div><label className="label">Landline</label><input className="input w-full" value={form.landline} onChange={e => setForm(f => ({ ...f, landline: e.target.value }))} /></div>
            </div>
          )}
        </div>

        {mode === 'new' && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button onClick={createNew} disabled={saving || !form.name.trim()} className="btn btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Create & Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
