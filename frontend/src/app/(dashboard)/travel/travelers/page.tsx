'use client';

import { useState, useEffect, useCallback } from 'react';
import { travelApi } from '@/lib/api';
import { Users, Plus, X, Loader2, ShieldCheck } from 'lucide-react';
import TravelIdentityPanel from '@/components/production/TravelIdentityPanel';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

const PTYPE_CLS: Record<string, string> = { TALENT: 'bg-violet-100 text-violet-700', CREW: 'bg-blue-100 text-blue-700', CONSULTANT: 'bg-amber-100 text-amber-700', VIP: 'bg-rose-100 text-rose-700', ACCOMPANYING: 'bg-slate-100 text-slate-600' };

export default function TravelersDirectory() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const load = useCallback(() => { travelApi.travelers().then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="font-sans p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Users className="text-[#0f172a]" /> Travelers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Master traveller directory — passports, nationality, GDPR consent.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800"><Plus size={16} /> Add traveller</button>
      </div>

      <div className="grid gap-2">
        {rows.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No travellers yet.</p> : rows.map((t) => (
          <button key={t.id} onClick={() => setViewId(t.id)} className="text-left rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between hover:shadow-md transition">
            <div>
              <div className="font-medium text-slate-900 flex items-center gap-2">{t.fullName}<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PTYPE_CLS[t.personType] || 'bg-slate-100'}`}>{t.personType}</span></div>
              <div className="text-xs text-slate-500">{[t.nationality, t.email, t.phone].filter(Boolean).join(' · ') || '—'}{t._count?.companions ? ` · ${t._count.companions} accompanying` : ''}</div>
            </div>
            <div className="text-right text-xs">
              {t.passportNumber && <div className="text-slate-500">Passport {t.passportExpiry ? `· exp ${new Date(t.passportExpiry).toLocaleDateString()}` : ''}</div>}
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full ${t.gdprConsent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><ShieldCheck size={11} /> {t.gdprConsent ? 'Consent on file' : 'No consent'}</span>
            </div>
          </button>
        ))}
      </div>

      {open && <AddTravelerModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
      {viewId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => { setViewId(null); load(); }}>
          <div className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <TravelIdentityPanel travelerId={viewId} onClose={() => { setViewId(null); load(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddTravelerModal({ onClose, onDone }: any) {
  const [f, setF] = useState<any>({ fullName: '', personType: 'CREW', email: '', phone: '', nationality: '', passportNumber: '', passportExpiry: '', gdprConsent: false });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const submit = async () => { if (!f.fullName) return; setBusy(true); try { await travelApi.addTraveler({ ...f, consentAt: f.gdprConsent ? new Date().toISOString() : undefined }); onDone(); } finally { setBusy(false); } };
  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Add traveller</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Full name *"><input className={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></L>
          <L label="Person type"><select className={inp} value={f.personType} onChange={(e) => set('personType', e.target.value)}>{['TALENT', 'CREW', 'CONSULTANT', 'VIP'].map((x) => <option key={x} value={x}>{x}</option>)}</select></L>
          <L label="Nationality"><input className={inp} value={f.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="AE / GB / US" /></L>
          <L label="Email"><EmailInput className={inp} value={f.email} onChange={(e) => set('email', e.target.value)} /></L>
          <L label="Phone"><PhoneInput value={f.phone || ''} onChange={(v) => set('phone', v)} /></L>
          <L label="Passport number"><input className={inp} value={f.passportNumber} onChange={(e) => set('passportNumber', e.target.value)} /></L>
          <L label="Passport expiry"><input type="date" className={inp} value={f.passportExpiry} onChange={(e) => set('passportExpiry', e.target.value)} /></L>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.gdprConsent} onChange={(e) => set('gdprConsent', e.target.checked)} className="rounded" /> Data-processing consent on file</label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !f.fullName} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}
function L({ label, full, children }: any) { return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>; }
