'use client';

import { useState, useEffect, useCallback } from 'react';
import { castingApi } from '@/lib/api';
import { Plus, Trash2, Loader2, Briefcase, Film, Phone, Calendar, Star } from 'lucide-react';

const REP_TYPES = ['AGENCY', 'MANAGER', 'LAWYER', 'PUBLICIST', 'BUSINESS_MANAGER', 'ASSISTANT'];
const CREDIT_TYPES = ['FILM', 'TV', 'COMMERCIAL', 'THEATRE', 'OTHER'];
const INTERACTION_TYPES = ['MEETING', 'PHONE_CALL', 'VIDEO_CALL', 'FESTIVAL_MEETING', 'SCRIPT_SENT', 'AUDITION_INVITE', 'CALLBACK_INVITE', 'OFFER_MADE', 'OFFER_DECLINED', 'BOOKING_CONFIRMED', 'CONTRACT_SIGNED', 'EMAIL', 'NOTE', 'OTHER'];
const inp = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#0f172a]';
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString() : '');

// ── V3-B Representation ──────────────────────────────────────────────────────
export function RepresentationTab({ talentId }: { talentId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>({ repType: 'AGENCY', name: '', company: '', email: '', phone: '', commissionPct: '', territory: '', contractStart: '', contractEnd: '', isPrimary: false });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { castingApi.reps(talentId).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [talentId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!f.name) return; setBusy(true); try { await castingApi.addRep(talentId, f); setF({ ...f, name: '', company: '', email: '', phone: '', commissionPct: '' }); load(); } finally { setBusy(false); } };
  const del = async (id: string) => { await castingApi.delRep(id); load(); };
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-xs text-slate-400">No representation on file.</p> : rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-200 px-3 py-2 flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800 flex items-center gap-2"><Briefcase size={13} className="text-slate-400" />{r.name}{r.isPrimary && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">PRIMARY</span>}<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{r.repType.replace('_', ' ')}</span></div>
            <div className="text-[11px] text-slate-500 mt-0.5">{[r.company, r.email, r.phone, r.territory, r.commissionPct != null ? `${r.commissionPct}%` : null, (r.contractStart || r.contractEnd) ? `${fmt(r.contractStart)}–${fmt(r.contractEnd)}` : null].filter(Boolean).join(' · ') || '—'}</div>
          </div>
          <button onClick={() => del(r.id)} className="text-slate-300 hover:text-rose-600 shrink-0"><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Add representation</p>
        <div className="grid grid-cols-2 gap-2">
          <select className={inp} value={f.repType} onChange={(e) => set('repType', e.target.value)}>{REP_TYPES.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select>
          <input className={inp} placeholder="Name *" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <input className={inp} placeholder="Company" value={f.company} onChange={(e) => set('company', e.target.value)} />
          <input className={inp} placeholder="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          <input className={inp} placeholder="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          <input className={inp} placeholder="Commission %" type="number" value={f.commissionPct} onChange={(e) => set('commissionPct', e.target.value)} />
          <input className={inp} placeholder="Territory" value={f.territory} onChange={(e) => set('territory', e.target.value)} />
          <label className="text-[11px] text-slate-500 inline-flex items-center gap-1.5"><input type="checkbox" checked={f.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} /> Primary agent</label>
          <input className={inp} type="date" value={f.contractStart} onChange={(e) => set('contractStart', e.target.value)} />
          <input className={inp} type="date" value={f.contractEnd} onChange={(e) => set('contractEnd', e.target.value)} />
        </div>
        <button onClick={add} disabled={busy || !f.name} className="mt-2 text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">{busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add</button>
      </div>
    </div>
  );
}

// ── V3-B Credits ─────────────────────────────────────────────────────────────
export function CreditsTab({ talentId }: { talentId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>({ creditType: 'FILM', title: '', role: '', year: '', productionCompany: '', director: '', link: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { castingApi.credits(talentId).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [talentId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!f.title) return; setBusy(true); try { await castingApi.addCredit(talentId, f); setF({ ...f, title: '', role: '', year: '', director: '' }); load(); } finally { setBusy(false); } };
  const del = async (id: string) => { await castingApi.delCredit(id); load(); };
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const groups = CREDIT_TYPES.filter((ct) => rows.some((r) => r.creditType === ct));
  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-xs text-slate-400">No credits on file.</p> : groups.map((ct) => (
        <div key={ct}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{ct}</p>
          <div className="space-y-1">
            {rows.filter((r) => r.creditType === ct).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 truncate"><Film size={11} className="inline text-slate-400 mr-1" />{r.title}{r.role ? ` — ${r.role}` : ''}<span className="text-[11px] text-slate-400 ml-1">{[r.year, r.director, r.productionCompany].filter(Boolean).join(' · ')}</span></span>
                <button onClick={() => del(r.id)} className="text-slate-300 hover:text-rose-600 shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Add credit</p>
        <div className="grid grid-cols-2 gap-2">
          <select className={inp} value={f.creditType} onChange={(e) => set('creditType', e.target.value)}>{CREDIT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <input className={inp} placeholder="Title *" value={f.title} onChange={(e) => set('title', e.target.value)} />
          <input className={inp} placeholder="Role" value={f.role} onChange={(e) => set('role', e.target.value)} />
          <input className={inp} placeholder="Year" type="number" value={f.year} onChange={(e) => set('year', e.target.value)} />
          <input className={inp} placeholder="Director" value={f.director} onChange={(e) => set('director', e.target.value)} />
          <input className={inp} placeholder="Production co." value={f.productionCompany} onChange={(e) => set('productionCompany', e.target.value)} />
          <input className={`${inp} col-span-2`} placeholder="Link" value={f.link} onChange={(e) => set('link', e.target.value)} />
        </div>
        <button onClick={add} disabled={busy || !f.title} className="mt-2 text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">{busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add</button>
      </div>
    </div>
  );
}

// ── V3-C CRM timeline + relationship scores ──────────────────────────────────
export function CrmTab({ talentId, projectId }: { talentId: string; projectId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [scores, setScores] = useState<any>(null);
  const [f, setF] = useState<any>({ type: 'MEETING', notes: '', occurredAt: new Date().toISOString().slice(0, 10), followUpDate: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    castingApi.interactions(talentId, projectId).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    castingApi.relScores(talentId).then((r) => setScores(r.data)).catch(() => {});
  }, [talentId, projectId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!f.type) return; setBusy(true); try { await castingApi.addInteraction(talentId, { ...f, projectId: projectId || undefined }); setF({ ...f, notes: '', followUpDate: '' }); load(); } finally { setBusy(false); } };
  const del = async (id: string) => { await castingApi.delInteraction(id); load(); };
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const Bar = ({ label, v }: any) => <div><div className="flex items-center justify-between text-[10px] text-slate-500"><span>{label}</span><span>{v ?? 0}</span></div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-rose-400'}`} style={{ width: `${v || 0}%` }} /></div></div>;
  return (
    <div className="space-y-3">
      {scores && <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3"><Bar label="Engagement" v={scores.engagement} /><Bar label="Responsiveness" v={scores.responsiveness} /><Bar label="Reliability" v={scores.reliability} /><Bar label="Rehire" v={scores.rehire} /></div>}
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Log interaction</p>
        <div className="grid grid-cols-2 gap-2">
          <select className={inp} value={f.type} onChange={(e) => set('type', e.target.value)}>{INTERACTION_TYPES.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select>
          <input className={inp} type="date" value={f.occurredAt} onChange={(e) => set('occurredAt', e.target.value)} />
          <input className={`${inp} col-span-2`} placeholder="Notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          <label className="text-[11px] text-slate-500 col-span-2 inline-flex items-center gap-1.5"><Calendar size={12} /> Follow-up <input className={`${inp} flex-1`} type="date" value={f.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} /></label>
        </div>
        <button onClick={add} disabled={busy} className="mt-2 text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40 inline-flex items-center gap-1">{busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Log</button>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Timeline ({rows.length})</p>
        {rows.length === 0 ? <p className="text-xs text-slate-400">No interactions logged.</p> : (
          <div className="space-y-1.5">{rows.map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f172a] mt-1.5 shrink-0" />
              <div className="min-w-0 flex-1"><span className="text-slate-700 font-medium">{r.type.replace(/_/g, ' ')}</span> <span className="text-[10px] text-slate-400">{fmt(r.occurredAt)}</span>{r.followUpDate && <span className="text-[10px] text-amber-600 ml-1">· follow-up {fmt(r.followUpDate)}</span>}{r.notes && <div className="text-[11px] text-slate-500">{r.notes}</div>}</div>
              <button onClick={() => del(r.id)} className="text-slate-300 hover:text-rose-600 shrink-0"><Trash2 size={12} /></button>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}
