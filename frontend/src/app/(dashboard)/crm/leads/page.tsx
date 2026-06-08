'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Plus, X, ArrowRight, Trash2, ArrowLeft } from 'lucide-react';
import { crmApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

const STATUS = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const CLS: Record<string, string> = { NEW: 'bg-blue-50 text-blue-700', CONTACTED: 'bg-amber-50 text-amber-700', QUALIFIED: 'bg-teal-50 text-teal-700', CONVERTED: 'bg-green-50 text-green-700', LOST: 'bg-gray-100 text-gray-500' };

export default function LeadsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>(null);

  const load = () => { setLoading(true); crmApi.leads().then(r => setItems(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const convert = async (l: any) => {
    if (!confirm(`Convert "${l.companyName || l.contactName}" into a sales opportunity?`)) return;
    await crmApi.convertLead(l.id, { value: l.estimatedValue });
    router.push('/crm');
  };
  const del = async (id: string) => { if (confirm('Delete lead?')) { await crmApi.removeLead(id); load(); } };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/crm" className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500">New enquiries before they become opportunities.</p>
          </div>
        </div>
        <button onClick={() => setEdit({ status: 'NEW' })} className="btn-primary"><Plus size={14} /> New lead</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> : items.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No leads yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-2.5 text-left">Company / Contact</th><th className="px-3 py-2.5 text-left">Source</th><th className="px-3 py-2.5 text-left">Status</th><th className="px-3 py-2.5 text-right">Est. value</th><th className="px-5 py-2.5 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {items.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-5 py-3"><button onClick={() => setEdit(l)} className="text-left"><div className="font-medium text-gray-800">{l.companyName || '—'}</div><div className="text-xs text-gray-400">{l.contactName} {l.phone ? `· ${l.phone}` : ''}</div></button></td>
                  <td className="px-3 py-3 text-gray-600">{l.source || '—'}</td>
                  <td className="px-3 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CLS[l.status] || ''}`}>{l.status}</span></td>
                  <td className="px-3 py-3 text-right">{l.estimatedValue ? formatCurrency(Number(l.estimatedValue)) : '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {l.status !== 'CONVERTED' && <button onClick={() => convert(l)} className="text-brand-600 hover:text-brand-700 text-xs flex items-center gap-1">Convert <ArrowRight size={12} /></button>}
                      <button onClick={() => del(l.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && <LeadModal lead={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function LeadModal({ lead, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ ...lead, estimatedValue: lead.estimatedValue ?? '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { if (lead.id) await crmApi.updateLead(lead.id, f); else await crmApi.createLead(f); onSaved(); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">{lead.id ? 'Edit lead' : 'New lead'}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Company</label><input className="input w-full" value={f.companyName || ''} onChange={e => setF({ ...f, companyName: e.target.value })} /></div>
            <div><label className="label">Contact</label><input className="input w-full" value={f.contactName || ''} onChange={e => setF({ ...f, contactName: e.target.value })} /></div>
            <div><label className="label">Email</label><EmailInput className="input w-full" value={f.email || ''} onChange={e => setF({ ...f, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><PhoneInput value={f.phone || ''} onChange={(v) => setF({ ...f, phone: v })} /></div>
            <div><label className="label">Source</label><select className="input w-full" value={f.source || ''} onChange={e => setF({ ...f, source: e.target.value })}><option value="">—</option>{['Referral', 'Website', 'Walk-in', 'Repeat', 'Social', 'Other'].map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Status</label><select className="input w-full" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{STATUS.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="col-span-2"><label className="label">Estimated value (AED)</label><input type="number" className="input w-full" value={f.estimatedValue} onChange={e => setF({ ...f, estimatedValue: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input w-full h-16 resize-none" value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={onClose} className="btn-secondary flex-1">Cancel</button><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button></div>
      </div>
    </div>
  );
}
