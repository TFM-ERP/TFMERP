'use client';

import { useState, useEffect, useCallback } from 'react';
import { travelApi, uploadFile, assetUrl } from '@/lib/api';
import { DESTINATIONS, DOC_LABEL, evalVisa } from '@/lib/visa-rules';
import { Plane, Plus, X, MapPin, ShieldCheck, AlertTriangle, CheckCircle2, Upload, FileText, Loader2, Globe2 } from 'lucide-react';
import { PanelHeader, Chip, Btn, EmptyState, inputCls } from './ui';

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', REQUESTED: 'bg-amber-100 text-amber-700', APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700', BOOKING_IN_PROGRESS: 'bg-blue-100 text-blue-700', BOOKED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700', COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-slate-100 text-slate-400',
};
const STATUS_TONE: Record<string, string> = {
  DRAFT: 'slate', REQUESTED: 'need', APPROVED: 'money', REJECTED: 'risk',
  BOOKING_IN_PROGRESS: 'need', BOOKED: 'link', IN_TRANSIT: 'link', COMPLETED: 'money', CANCELLED: 'risk',
};
const money = (n: any, c = 'AED') => (n ? `${c} ${Number(n).toLocaleString()}` : '—');

export default function TravelPanel({ projectId }: { projectId: string }) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await travelApi.trips(projectId); setTrips(Array.isArray(data) ? data : []); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Plane}
        title="Travel & Visas"
        subtitle="Trips, approvals and visas for this project only."
        actions={<Btn variant="primary" onClick={() => setOpen(true)}><Plus size={15} /> Request Trip</Btn>}
      />

      {loading ? <p className="text-slate-400 text-sm py-10 text-center">Loading…</p>
        : trips.length === 0 ? (
          <EmptyState icon={Plane}>No trips for this project yet.</EmptyState>
        ) : (
          <div className="grid gap-2.5">
            {trips.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {t.origin || '—'} → {t.destination || '—'}</span>
                      <Chip tone={STATUS_TONE[t.status] || 'slate'}>{t.status.replace(/_/g, ' ')}</Chip>
                      {t._count?.visas > 0 && <Chip tone="cast"><span className="inline-flex items-center gap-1"><ShieldCheck size={11} /> {t._count.visas} visa</span></Chip>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{t.traveler?.fullName}{t.traveler?.nationality ? ` · ${t.traveler.nationality}` : ''}{t.departDate ? ` · ${new Date(t.departDate).toLocaleDateString()}` : ''}{t.purpose ? ` · ${t.purpose}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-slate-800">{money(t.estimatedCost, t.currency)}</div>
                    {t.status === 'REQUESTED' && <button onClick={async () => { await travelApi.approve(t.id); load(); }} className="mt-1 text-xs text-emerald-700 hover:underline">Approve →</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {open && <RequestTripModal projectId={projectId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

export function RequestTripModal({ projectId, onClose, onDone }: { projectId?: string; onClose: () => void; onDone: () => void }) {
  const [travelers, setTravelers] = useState<any[]>([]);
  const [f, setF] = useState<any>({ travelerId: '', origin: '', destinationCode: '', purpose: '', departDate: '', returnDate: '', estimatedCost: '', currency: 'AED' });
  const [saving, setSaving] = useState(false);
  const [visaWindow, setVisaWindow] = useState<any | null>(null);
  const [visaDocs, setVisaDocs] = useState<Record<string, string>>({});
  const [visaCleared, setVisaCleared] = useState(false);

  useEffect(() => { travelApi.travelers().then((r) => setTravelers(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const traveler = travelers.find((t) => t.id === f.travelerId);
  const destLabel = DESTINATIONS.find((d) => d.code === f.destinationCode)?.label || '';

  const onDestination = (code: string) => {
    set('destinationCode', code); setVisaCleared(false); setVisaDocs({});
    const v = evalVisa(traveler?.nationality, code);
    setVisaWindow(v.required ? v : null);
  };
  useEffect(() => {
    if (!f.destinationCode) return;
    const v = evalVisa(traveler?.nationality, f.destinationCode);
    if (v.required && !visaCleared) setVisaWindow(v); else if (!v.required) setVisaWindow(null);
  }, [f.travelerId]); // eslint-disable-line

  const submit = async () => {
    setSaving(true);
    try {
      await travelApi.request({
        projectId, travelerId: f.travelerId, origin: f.origin, destination: destLabel || f.destinationCode,
        destinationCountry: f.destinationCode || undefined, purpose: f.purpose,
        departDate: f.departDate || undefined, returnDate: f.returnDate || undefined,
        estimatedCost: f.estimatedCost === '' ? undefined : Number(f.estimatedCost), currency: f.currency,
        visaDocuments: Object.entries(visaDocs).map(([type, url]) => ({ type, url })),
      });
      onDone();
    } finally { setSaving(false); }
  };

  const visaPending = !!visaWindow && !visaCleared;
  const canSubmit = f.travelerId && f.destinationCode !== undefined && !visaPending && !saving;
  const inp = inputCls;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Plane size={16} className="text-[#0f172a]" /> Request Trip</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <Field label="Traveller *" full>
            <select className={inp} value={f.travelerId} onChange={(e) => set('travelerId', e.target.value)}>
              <option value="">Select…</option>{travelers.map((t) => <option key={t.id} value={t.id}>{t.fullName}{t.nationality ? ` (${t.nationality})` : ''}</option>)}
            </select>
          </Field>
          <Field label="From"><input className={inp} value={f.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Abu Dhabi" /></Field>
          <Field label="To *">
            <select className={inp} value={f.destinationCode} onChange={(e) => onDestination(e.target.value)}>
              <option value="" disabled hidden>Select destination…</option>
              {DESTINATIONS.map((d) => <option key={d.label} value={d.code}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Depart"><input type="date" className={inp} value={f.departDate} onChange={(e) => set('departDate', e.target.value)} /></Field>
          <Field label="Return"><input type="date" className={inp} value={f.returnDate} onChange={(e) => set('returnDate', e.target.value)} /></Field>
          <Field label="Purpose" full><input className={inp} value={f.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Shoot / recce / meeting" /></Field>
          <Field label="Estimated cost"><input type="number" className={inp} value={f.estimatedCost} onChange={(e) => set('estimatedCost', e.target.value)} /></Field>
          <Field label="Currency"><input className={inp} value={f.currency} onChange={(e) => set('currency', e.target.value)} /></Field>

          {f.destinationCode && (visaWindow ? (
            <div className="col-span-2 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
              <span className="text-xs text-amber-800 inline-flex items-center gap-1.5">
                {visaCleared ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} />}
                {visaCleared ? 'Visa documents attached' : `${visaWindow.visaType.replace(/_/g, ' ')} required — ${visaWindow.slaDays}-day processing`}
              </span>
              <button onClick={() => setVisaWindow({ ...visaWindow })} className="text-xs font-medium text-amber-800 underline">{visaCleared ? 'Review' : 'Provide documents'}</button>
            </div>
          ) : (
            <div className="col-span-2 text-xs text-emerald-700 inline-flex items-center gap-1.5"><ShieldCheck size={14} /> No visa required for this route.</div>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">{visaPending ? 'Complete the visa documents to continue.' : 'Routes through travel approval.'}</span>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={submit} disabled={!canSubmit}>{saving && <Loader2 size={14} className="animate-spin" />} Submit request</Btn>
          </div>
        </div>
      </div>

      {visaWindow && !visaCleared && (
        <VisaAutoWindow dest={destLabel} traveler={traveler} rule={visaWindow} docs={visaDocs}
          onUpload={(key: string, url: string) => setVisaDocs((d) => ({ ...d, [key]: url }))}
          onClose={() => setVisaWindow(null)} onConfirm={() => { setVisaCleared(true); setVisaWindow(null); }} />
      )}
    </div>
  );
}

function VisaAutoWindow({ dest, traveler, rule, docs, onUpload, onClose, onConfirm }: any) {
  const [busy, setBusy] = useState<string | null>(null);
  const required: string[] = rule.docs || [];
  const allDone = required.every((k) => docs[k]);
  const upload = async (key: string, file: File) => {
    setBusy(key);
    try { const up = await uploadFile(file); onUpload(key, up.url); } catch {} finally { setBusy(null); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#1f2937] to-[#374151] px-5 py-4 text-white">
          <div className="flex items-center gap-2"><Globe2 size={18} className="text-[#0f172a]" /><h3 className="font-semibold">Visa required — {dest}</h3></div>
          <p className="text-[12px] text-slate-300 mt-1">{traveler?.fullName || 'Traveller'} ({traveler?.nationality || '—'}) needs a <b className="text-white">{rule.visaType.replace(/_/g, ' ')}</b>. Processing <b className="text-white">{rule.slaDays} days</b> — upload the documents below.</p>
        </div>
        <div className="p-5 space-y-2.5 max-h-[55vh] overflow-y-auto">
          {required.map((key) => (
            <div key={key} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${docs[key] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
              <span className="text-sm text-slate-700 inline-flex items-center gap-2">{docs[key] ? <CheckCircle2 size={16} className="text-emerald-600" /> : <FileText size={16} className="text-slate-400" />}{DOC_LABEL[key] || key}</span>
              {docs[key] ? <a href={assetUrl(docs[key])} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">view</a> : (
                <label className="text-xs inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-2.5 py-1.5 cursor-pointer hover:bg-slate-800">
                  {busy === key ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Upload
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && upload(key, e.target.files[0])} />
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
          <span className="text-[11px] text-slate-500">{required.filter((k) => docs[k]).length}/{required.length} provided</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm border border-slate-200 text-slate-600">Later</button>
            <button onClick={onConfirm} disabled={!allDone} className="rounded-xl px-4 py-2 text-sm bg-[#0f172a] text-white disabled:opacity-40 inline-flex items-center gap-1.5"><ShieldCheck size={15} /> Confirm documents</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, full, children }: any) {
  return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;
}
