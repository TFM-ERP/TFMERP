'use client';

import { useState, useEffect, useCallback } from 'react';
import { locationLibraryApi } from '@/lib/api';
import { Landmark, Plus, X, Save, Trash2, ExternalLink, Clock } from 'lucide-react';

const CATEGORIES = ['MEDIA_AUTHORITY', 'FILM_COMMISSION', 'MEDIA_ZONE', 'MEDIA_COUNCIL', 'AVIATION', 'ROADS', 'POLICE', 'AIRPORT', 'HERITAGE', 'MUNICIPALITY', 'MARINE', 'OTHER'];
const CAT_CLS: Record<string, string> = {
  MEDIA_AUTHORITY: 'bg-fuchsia-100 text-fuchsia-700',
  FILM_COMMISSION: 'bg-purple-100 text-purple-700', MEDIA_ZONE: 'bg-indigo-100 text-indigo-700', MEDIA_COUNCIL: 'bg-violet-100 text-violet-700',
  AVIATION: 'bg-sky-100 text-sky-700', ROADS: 'bg-amber-100 text-amber-700',
  POLICE: 'bg-blue-100 text-blue-700', AIRPORT: 'bg-sky-100 text-sky-700', HERITAGE: 'bg-orange-100 text-orange-700',
  MUNICIPALITY: 'bg-green-100 text-green-700', MARINE: 'bg-teal-100 text-teal-700', OTHER: 'bg-gray-100 text-gray-600',
};
const lbl = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function AuthoritiesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await locationLibraryApi.authorities(); setRows(data || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const blank = { name: '', category: 'FILM_COMMISSION', jurisdiction: '', contactName: '', email: '', phone: '', portalUrl: '', leadTimeDays: '', notes: '' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const p = { ...form }; if (p.leadTimeDays === '') p.leadTimeDays = null; else p.leadTimeDays = Number(p.leadTimeDays);
      await locationLibraryApi.upsertAuthority(p); setForm(null); await load();
    } finally { setSaving(false); }
  };
  const remove = async (id: string) => { if (confirm('Delete this authority?')) { await locationLibraryApi.removeAuthority(id); load(); } };

  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Landmark className="text-[#0f172a]" /> Permit Authorities</h1>
          <p className="text-sm text-gray-500 mt-1">The issuing bodies productions apply to — reused across every location permit.</p>
        </div>
        <button onClick={() => setForm({ ...blank })} className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Plus size={16} /> Add authority</button>
      </div>

      {loading ? <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
        : rows.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <Landmark className="mx-auto text-gray-300" size={40} />
            <p className="text-gray-500 mt-3">No authorities yet. Run <code>seed-permit-authorities.js</code> or add one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((a) => (
              <div key={a.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.name}</span>
                      {a.category && <span className={`text-[11px] px-2 py-0.5 rounded ${CAT_CLS[a.category] || CAT_CLS.OTHER}`}>{lbl(a.category)}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{[a.jurisdiction, a.contactName].filter(Boolean).join(' · ') || '—'}</p>
                    <div className="text-[11px] text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {a.phone && <span>{a.phone}</span>}
                      {a.email && <span>{a.email}</span>}
                      {a.leadTimeDays != null && <span className="inline-flex items-center gap-1"><Clock size={11} /> ~{a.leadTimeDays}d lead</span>}
                      {a.portalUrl && <a href={a.portalUrl} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5">Portal <ExternalLink size={10} /></a>}
                    </div>
                    {a.notes && <p className="text-xs text-gray-500 mt-1.5">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setForm({ ...a })} className="text-gray-400 hover:text-black text-sm">✎</button>
                    <button onClick={() => remove(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {form && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-5 py-3 flex items-center justify-between"><h2 className="font-semibold">{form.id ? 'Edit authority' : 'Add authority'}</h2><button onClick={() => setForm(null)}><X size={18} /></button></div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Name *</span><input className={inp} value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Category</span><select className={inp} value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{lbl(c)}</option>)}</select></label>
              <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Jurisdiction</span><input className={inp} value={form.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} placeholder="Abu Dhabi / UAE" /></label>
              <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Contact name</span><input className={inp} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} /></label>
              <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Lead time (days)</span><input type="number" className={inp} value={form.leadTimeDays} onChange={(e) => set('leadTimeDays', e.target.value)} /></label>
              <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Email</span><input className={inp} value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
              <label className="text-sm"><span className="block text-xs text-gray-500 mb-1">Phone</span><input className={inp} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
              <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Portal URL</span><input className={inp} value={form.portalUrl} onChange={(e) => set('portalUrl', e.target.value)} /></label>
              <label className="text-sm col-span-2"><span className="block text-xs text-gray-500 mb-1">Notes</span><textarea className={inp} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
            </div>
            <div className="border-t px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={save} disabled={saving || !form.name} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#0f172a] text-white rounded-lg disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
