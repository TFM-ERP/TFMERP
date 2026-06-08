'use client';

// SYS-07 slice 7 — scope-aware operational tabs (Security, Payments, and simple
// Documents/Permits) that work identically for a PROJECT location or a standalone
// MASTER library location. The caller passes an `a` adapter wired to the right API.

import { useState, useEffect, useCallback } from 'react';
import { assetUrl } from '@/lib/api';
import { Plus, Save, Trash2, Shield, Coins, FileText, CheckCircle2, BadgeCheck, FolderArchive, Mail } from 'lucide-react';

export type OpsAdapter = {
  authorities: () => Promise<any>;
  // security
  listSecurity: (id: string) => Promise<any>;
  addSecurity: (id: string, d: any) => Promise<any>;
  updSecurity: (sid: string, d: any) => Promise<any>;
  delSecurity: (sid: string) => Promise<any>;
  postSecurity?: (sid: string) => Promise<any>;   // project only (ledger)
  // payments
  listPayments: (id: string) => Promise<any>;
  paySummary: (id: string) => Promise<any>;
  addPayment: (id: string, d: any) => Promise<any>;
  updPayment: (pid: string, d: any) => Promise<any>;
  delPayment: (pid: string) => Promise<any>;
  payPayment?: (pid: string) => Promise<any>;      // project (post to ledger)
  markPaid?: (pid: string) => Promise<any>;        // master (no ledger)
  // simple docs/permits (master)
  listDocs?: (id: string) => Promise<any>;
  addDoc?: (id: string, d: any) => Promise<any>;
  updDoc?: (did: string, d: any) => Promise<any>;
  delDoc?: (did: string) => Promise<any>;
  listPermits?: (id: string) => Promise<any>;
  addPermit?: (id: string, d: any) => Promise<any>;
  updPermit?: (pid: string, d: any) => Promise<any>;
  delPermit?: (pid: string) => Promise<any>;
  importEmail?: (id: string, fd: FormData) => Promise<any>;
};

const money = (n: any, c = 'AED') => `${c} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
const SEC_STATUS = ['PLANNED', 'CONFIRMED', 'ON_SITE', 'COMPLETED', 'CANCELLED'];
const SEC_CLS: Record<string, string> = { PLANNED: 'bg-gray-100 text-gray-600', CONFIRMED: 'bg-blue-100 text-blue-700', ON_SITE: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-gray-100 text-gray-400' };

export function SecurityTab({ id, a, currency = 'AED' }: { id: string; a: OpsAdapter; currency?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const load = useCallback(() => { a.listSecurity(id).then((r) => setRows(r.data || [])); }, [id, a]);
  useEffect(() => { load(); }, [load]);
  const blank = { company: '', contactName: '', contactPhone: '', guards: 1, marshals: 0, days: 1, ratePerGuard: '', shiftStart: '', shiftEnd: '', status: 'PLANNED', notes: '' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const preview = form ? (Number(form.guards || 0) + Number(form.marshals || 0)) * Number(form.ratePerGuard || 0) * Number(form.days || 1) : 0;
  const save = async () => {
    const p = { ...form }; ['ratePerGuard'].forEach((k) => { if (p[k] === '') p[k] = null; });
    if (form.id) await a.updSecurity(form.id, p); else await a.addSecurity(id, p);
    setForm(null); load();
  };
  return (
    <div className="space-y-3">
      {!form && <button onClick={() => setForm({ ...blank })} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add security arrangement</button>}
      {form && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} placeholder="Security company" value={form.company} onChange={(e) => set('company', e.target.value)} />
            <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{SEC_STATUS.map((s) => <option key={s}>{s.replace('_', ' ')}</option>)}</select>
            <input className={inp} placeholder="Contact name" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            <input className={inp} placeholder="Contact phone" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
            <label className="text-xs text-gray-500">Guards<input type="number" className={inp} value={form.guards} onChange={(e) => set('guards', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Marshals<input type="number" className={inp} value={form.marshals} onChange={(e) => set('marshals', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Days<input type="number" className={inp} value={form.days} onChange={(e) => set('days', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Rate / person / day<input type="number" className={inp} value={form.ratePerGuard} onChange={(e) => set('ratePerGuard', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Shift start<input type="datetime-local" className={inp} value={form.shiftStart?.slice?.(0, 16) || ''} onChange={(e) => set('shiftStart', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Shift end<input type="datetime-local" className={inp} value={form.shiftEnd?.slice?.(0, 16) || ''} onChange={(e) => set('shiftEnd', e.target.value)} /></label>
          </div>
          {preview > 0 && <p className="text-xs text-gray-500">Estimated cost: <b>{money(preview, currency)}</b></p>}
          <div className="flex gap-2"><button onClick={save} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={13} /> Save</button><button onClick={() => setForm(null)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {rows.map((s) => (
        <div key={s.id} className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2"><Shield size={14} className="text-gray-400" /><span className="font-medium text-sm">{s.company || 'Security'}</span><span className={`text-[11px] px-2 py-0.5 rounded ${SEC_CLS[s.status]}`}>{s.status.replace('_', ' ')}</span>{s.postedTxnId && <span className="text-[10px] text-green-600 inline-flex items-center gap-0.5"><BadgeCheck size={11} /> posted</span>}</div>
              <p className="text-xs text-gray-500 mt-0.5">{s.guards} guard(s) · {s.marshals} marshal(s) · {Number(s.days)} day(s){s.totalCost ? ` · ${money(s.totalCost, s.currency)}` : ''}</p>
              {(s.contactName || s.contactPhone) && <p className="text-[11px] text-gray-400">{[s.contactName, s.contactPhone].filter(Boolean).join(' · ')}</p>}
            </div>
            <div className="flex items-center gap-2">
              {a.postSecurity && s.totalCost && !s.postedTxnId && <button onClick={async () => { await a.postSecurity!(s.id); load(); }} title="Post cost to budget" className="text-[#8a6d2f]"><Coins size={14} /></button>}
              <button onClick={() => setForm({ ...s })} className="text-gray-400">✎</button>
              <button onClick={async () => { await a.delSecurity(s.id); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ))}
      {rows.length === 0 && !form && <p className="text-sm text-gray-400 flex items-center gap-2"><Shield size={15} /> No security/marshals arranged yet.</p>}
    </div>
  );
}

const PAY_KIND = ['QUOTE', 'DEPOSIT', 'BALANCE', 'ADDITIONAL', 'REFUND'];
const PAY_STATUS = ['PENDING', 'INVOICED', 'PAID'];
const PAY_CLS: Record<string, string> = { PENDING: 'bg-gray-100 text-gray-600', INVOICED: 'bg-amber-100 text-amber-700', PAID: 'bg-green-100 text-green-700' };

export function PaymentsTab({ id, a, currency = 'AED' }: { id: string; a: OpsAdapter; currency?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [sum, setSum] = useState<any>(null);
  const [form, setForm] = useState<any | null>(null);
  const load = useCallback(() => { a.listPayments(id).then((r) => setRows(r.data || [])); a.paySummary(id).then((r) => setSum(r.data)); }, [id, a]);
  useEffect(() => { load(); }, [load]);
  const blank = { kind: 'DEPOSIT', description: '', amount: '', currency, dueDate: '', payeeName: '', invoiceRef: '', status: 'PENDING', notes: '' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    const p = { ...form }; if (p.amount === '') p.amount = 0;
    if (form.id) await a.updPayment(form.id, p); else await a.addPayment(id, p);
    setForm(null); load();
  };
  const pay = async (row: any) => {
    if (a.payPayment) await a.payPayment(row.id); else if (a.markPaid) await a.markPaid(row.id);
    load();
  };
  return (
    <div className="space-y-3">
      {sum && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <Mini label="Quoted" value={money(sum.quoted, sum.currency)} />
          <Mini label="Scheduled" value={money(sum.scheduled, sum.currency)} />
          <Mini label="Paid" value={money(sum.paid, sum.currency)} />
          <Mini label="Outstanding" value={money(sum.outstanding, sum.currency)} hot={sum.outstanding > 0} />
        </div>
      )}
      {!form && <button onClick={() => setForm({ ...blank })} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add payment line</button>}
      {form && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className={inp} value={form.kind} onChange={(e) => set('kind', e.target.value)}>{PAY_KIND.map((k) => <option key={k}>{k}</option>)}</select>
            <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{PAY_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            <input className={inp} type="number" placeholder="Amount" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            <input className={inp} placeholder="Payee (owner)" value={form.payeeName} onChange={(e) => set('payeeName', e.target.value)} />
            <input className={`${inp} col-span-2`} placeholder="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
            <label className="text-xs text-gray-500">Due<input type="date" className={inp} value={form.dueDate?.slice?.(0, 10) || ''} onChange={(e) => set('dueDate', e.target.value)} /></label>
            <input className={inp} placeholder="Invoice ref" value={form.invoiceRef} onChange={(e) => set('invoiceRef', e.target.value)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={13} /> Save</button><button onClick={() => setForm(null)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {rows.map((p) => (
        <div key={p.id} className="border rounded-lg p-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2"><span className="text-[11px] px-2 py-0.5 rounded bg-[#0f172a]/15 text-[#8a6d2f]">{p.kind}</span><span className="font-medium text-sm">{money(p.amount, p.currency)}</span><span className={`text-[11px] px-2 py-0.5 rounded ${PAY_CLS[p.status]}`}>{p.status}</span></div>
            <p className="text-xs text-gray-500 mt-0.5">{[p.description, p.payeeName, p.invoiceRef].filter(Boolean).join(' · ')}</p>
            {p.dueDate && <p className="text-[11px] text-gray-400">Due {new Date(p.dueDate).toLocaleDateString()}{p.paidDate ? ` · paid ${new Date(p.paidDate).toLocaleDateString()}` : ''}</p>}
          </div>
          <div className="flex items-center gap-2">
            {p.status !== 'PAID' && p.kind !== 'QUOTE' && <button onClick={() => pay(p)} title={a.payPayment ? 'Pay (post to ledger)' : 'Mark paid'} className="text-green-600"><CheckCircle2 size={15} /></button>}
            <button onClick={() => setForm({ ...p })} className="text-gray-400">✎</button>
            <button onClick={async () => { await a.delPayment(p.id); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {rows.length === 0 && !form && <p className="text-sm text-gray-400 flex items-center gap-2"><Coins size={15} /> No payment lines yet — add the quote, deposit and balance.</p>}
    </div>
  );
}

function Mini({ label, value, hot }: { label: string; value: any; hot?: boolean }) {
  return <div className={`rounded-lg p-2 ${hot ? 'bg-amber-50' : 'bg-gray-50'}`}><div className="text-[10px] text-gray-400">{label}</div><div className={`text-sm font-semibold ${hot ? 'text-amber-700' : ''}`}>{value}</div></div>;
}

// ── Standalone (master-scope) Permits & Documents — metadata records, no OCR/ledger ──
const PERMIT_TYPES = ['GROUND_FILMING', 'DRONE_GCAA', 'ROAD_TRAFFIC', 'POLICE', 'AIRPORT', 'HERITAGE_DCT', 'PARKING', 'MARINE', 'PYRO_SFX', 'FIREARMS', 'OTHER'];
const PERMIT_STATUS = ['NOT_REQUIRED', 'DRAFT', 'APPLIED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'];
const PSTAT_CLS: Record<string, string> = { APPROVED: 'bg-green-100 text-green-700', IN_REVIEW: 'bg-amber-100 text-amber-700', APPLIED: 'bg-blue-100 text-blue-700', REJECTED: 'bg-red-100 text-red-700', EXPIRED: 'bg-red-50 text-red-600', DRAFT: 'bg-gray-100 text-gray-600', NOT_REQUIRED: 'bg-gray-100 text-gray-500' };
const lbl = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function PermitsTab({ id, a, currency = 'AED' }: { id: string; a: OpsAdapter; currency?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [auths, setAuths] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const load = useCallback(() => { a.listPermits?.(id).then((r) => setRows(r.data || [])); }, [id, a]);
  useEffect(() => { load(); a.authorities().then((r) => setAuths(r.data || [])).catch(() => {}); }, [load]); // eslint-disable-line
  const blank = { permitType: 'GROUND_FILMING', authorityId: '', authority: '', jurisdiction: '', referenceNumber: '', status: 'DRAFT', applicationDate: '', expiryDate: '', fee: '', currency, conditions: '' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const pick = (aid: string) => { const x = auths.find((y) => y.id === aid); setForm((f: any) => ({ ...f, authorityId: aid, authority: x?.name || '', jurisdiction: f.jurisdiction || x?.jurisdiction || '' })); };
  const save = async () => { const p = { ...form }; if (p.fee === '') p.fee = null; if (form.id) await a.updPermit?.(form.id, p); else await a.addPermit?.(id, p); setForm(null); load(); };
  return (
    <div className="space-y-3">
      {!form && <button onClick={() => setForm({ ...blank })} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add permit</button>}
      {form && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className={inp} value={form.permitType} onChange={(e) => set('permitType', e.target.value)}>{PERMIT_TYPES.map((t) => <option key={t} value={t}>{lbl(t)}</option>)}</select>
            <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{PERMIT_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            <select className={inp} value={form.authorityId} onChange={(e) => pick(e.target.value)}><option value="">Authority…</option>{auths.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <input className={inp} placeholder="Reference #" value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
            <input className={inp} type="number" placeholder="Fee" value={form.fee} onChange={(e) => set('fee', e.target.value)} />
            <label className="text-xs text-gray-500">Expires<input type="date" className={inp} value={form.expiryDate?.slice?.(0, 10) || ''} onChange={(e) => set('expiryDate', e.target.value)} /></label>
          </div>
          <textarea className={inp} rows={2} placeholder="Conditions" value={form.conditions} onChange={(e) => set('conditions', e.target.value)} />
          <div className="flex gap-2"><button onClick={save} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={13} /> Save</button><button onClick={() => setForm(null)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {rows.map((p) => (
        <div key={p.id} className="border rounded-lg p-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2"><BadgeCheck size={14} className="text-gray-400" /><span className="font-medium text-sm">{lbl(p.permitType || 'OTHER')}</span><span className={`text-[11px] px-2 py-0.5 rounded ${PSTAT_CLS[p.status]}`}>{p.status.replace('_', ' ')}</span></div>
            <p className="text-xs text-gray-500 mt-0.5">{[p.authority, p.referenceNumber].filter(Boolean).join(' · ')}{p.expiryDate ? ` · exp ${new Date(p.expiryDate).toLocaleDateString()}` : ''}{p.fee ? ` · ${money(p.fee, p.currency)}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setForm({ ...p })} className="text-gray-400">✎</button>
            <button onClick={async () => { await a.delPermit?.(p.id); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {rows.length === 0 && !form && <p className="text-sm text-gray-400 flex items-center gap-2"><BadgeCheck size={15} /> No standing permits on this location.</p>}
    </div>
  );
}

const DOC_CATS = ['NOC', 'LOCATION_AGREEMENT', 'RELEASE', 'INSURANCE', 'LOCATION_GUIDE', 'RISK_ASSESSMENT', 'METHOD_STATEMENT', 'ID_DOCUMENT', 'QUOTE', 'PERMIT_DOC', 'OTHER'];
const DOC_STATUS = ['DRAFT', 'REQUESTED', 'RECEIVED', 'SIGNED', 'ISSUED', 'EXPIRED', 'VOID'];
const DSTAT_CLS: Record<string, string> = { SIGNED: 'bg-green-100 text-green-700', ISSUED: 'bg-green-100 text-green-700', RECEIVED: 'bg-teal-100 text-teal-700', REQUESTED: 'bg-blue-100 text-blue-700', EXPIRED: 'bg-red-100 text-red-700', VOID: 'bg-gray-100 text-gray-400', DRAFT: 'bg-gray-100 text-gray-600' };

export function DocumentsTab({ id, a }: { id: string; a: OpsAdapter }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const load = useCallback(() => { a.listDocs?.(id).then((r) => setRows(r.data || [])); }, [id, a]);
  useEffect(() => { load(); }, [load]);
  const [msg, setMsg] = useState<string | null>(null);
  const blank = { category: 'NOC', title: '', status: 'RECEIVED', language: 'BILINGUAL', partyName: '', authority: '', refNumber: '', issueDate: '', expiryDate: '', fileUrl: '', notes: '' };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => { if (form.id) await a.updDoc?.(form.id, form); else await a.addDoc?.(id, form); setForm(null); load(); };
  const importEmail = async (file: File) => {
    if (!a.importEmail) return;
    setMsg('Importing…');
    try { const { data } = await a.importEmail(id, (() => { const fd = new FormData(); fd.append('file', file); return fd; })()); setMsg(`Imported "${data.subject || file.name}" — ${data.documents} document(s) filed.`); load(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Import failed.'); }
  };
  return (
    <div className="space-y-3">
      {msg && <div className="text-sm bg-blue-50 text-blue-700 rounded-lg px-3 py-2">{msg}</div>}
      {!form && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setForm({ ...blank })} className="text-sm inline-flex items-center gap-1 text-[#8a6d2f]"><Plus size={14} /> Add document</button>
          {a.importEmail && <label className="text-sm inline-flex items-center gap-1 text-[#8a6d2f] cursor-pointer"><Mail size={14} /> Import email (.msg)<input type="file" className="hidden" accept=".msg,.eml" onChange={(e) => e.target.files?.[0] && importEmail(e.target.files[0])} /></label>}
        </div>
      )}
      {form && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className={inp} value={form.category} onChange={(e) => set('category', e.target.value)}>{DOC_CATS.map((c) => <option key={c} value={c}>{lbl(c)}</option>)}</select>
            <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            <input className={`${inp} col-span-2`} placeholder="Title" value={form.title} onChange={(e) => set('title', e.target.value)} />
            <input className={inp} placeholder="Party / owner" value={form.partyName} onChange={(e) => set('partyName', e.target.value)} />
            <input className={inp} placeholder="Authority" value={form.authority} onChange={(e) => set('authority', e.target.value)} />
            <select className={inp} value={form.language} onChange={(e) => set('language', e.target.value)}><option value="EN">English</option><option value="AR">Arabic</option><option value="BILINGUAL">Bilingual</option></select>
            <input className={inp} placeholder="Reference #" value={form.refNumber} onChange={(e) => set('refNumber', e.target.value)} />
            <label className="text-xs text-gray-500">Issued<input type="date" className={inp} value={form.issueDate?.slice?.(0, 10) || ''} onChange={(e) => set('issueDate', e.target.value)} /></label>
            <label className="text-xs text-gray-500">Expires<input type="date" className={inp} value={form.expiryDate?.slice?.(0, 10) || ''} onChange={(e) => set('expiryDate', e.target.value)} /></label>
            <input className={`${inp} col-span-2`} placeholder="File URL (optional)" value={form.fileUrl} onChange={(e) => set('fileUrl', e.target.value)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="text-sm bg-[#0f172a] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Save size={13} /> Save</button><button onClick={() => setForm(null)} className="text-sm border px-3 py-1.5 rounded-lg">Cancel</button></div>
        </div>
      )}
      {rows.map((d) => (
        <div key={d.id} className="border rounded-lg p-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] px-2 py-0.5 rounded bg-[#0f172a]/15 text-[#8a6d2f]">{lbl(d.category)}</span><span className="font-medium text-sm">{d.title}</span><span className={`text-[11px] px-2 py-0.5 rounded ${DSTAT_CLS[d.status]}`}>{d.status}</span></div>
            <p className="text-xs text-gray-500 mt-0.5">{[d.partyName, d.authority, d.refNumber].filter(Boolean).join(' · ')}{d.expiryDate ? ` · exp ${new Date(d.expiryDate).toLocaleDateString()}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {d.fileUrl && <a href={assetUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-gray-400"><FileText size={14} /></a>}
            <button onClick={() => setForm({ ...d })} className="text-gray-400">✎</button>
            <button onClick={async () => { await a.delDoc?.(d.id); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {rows.length === 0 && !form && <p className="text-sm text-gray-400 flex items-center gap-2"><FolderArchive size={15} /> No documents on this location.</p>}
    </div>
  );
}
