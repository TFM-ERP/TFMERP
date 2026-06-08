'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { ShieldCheck, Plus, Trash2, Loader2, Send, RefreshCw, Link2, Printer, Ban, Check, X, Clock, History } from 'lucide-react';
import { PanelHeader, StatRow, ClusterCard, Chip, Btn, EmptyState, SectionLabel } from './ui';

const STATUS_TONE: Record<string, string> = { DRAFT: 'slate', SHARED: 'money', EXPIRED: 'risk', REVOKED: 'risk' };
const inp = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-900 outline-none';
const APP = typeof window !== 'undefined' ? window.location.origin : '';

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fmt = (d: any) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function ClearancePacksPanel({ projectId }: { projectId: string }) {
  const [packs, setPacks] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [draft, setDraft] = useState<any>({ visitId: '', recipientName: '', recipientOrg: '', recipientEmail: '', expiryDays: 7, purpose: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productionApi.clearancePacks.list(projectId), productionApi.scoutVisits.list(projectId)])
      .then(([p, v]) => { setPacks(Array.isArray(p.data) ? p.data : []); setVisits(Array.isArray(v.data) ? v.data : []); })
      .catch(() => setPacks([]))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const build = async () => {
    if (!draft.visitId) return;
    await productionApi.clearancePacks.buildFromVisit(draft.visitId, draft);
    setDraft({ visitId: '', recipientName: '', recipientOrg: '', recipientEmail: '', expiryDays: 7, purpose: '' });
    setBuilding(false);
    load();
  };
  const share = async (p: any) => { await productionApi.clearancePacks.share(p.id, { recipients: p.recipientEmail }); load(); };
  const refresh = async (id: string) => { await productionApi.clearancePacks.refresh(id); load(); };
  const revoke = async (id: string) => { if (!confirm('Revoke this link? The venue will lose access immediately.')) return; await productionApi.clearancePacks.revoke(id); load(); };
  const remove = async (id: string) => { if (!confirm('Delete this clearance pack?')) return; await productionApi.clearancePacks.remove(id); load(); };
  const setExpiry = async (id: string, days: number) => { await productionApi.clearancePacks.update(id, { expiryDays: days }); load(); };
  const toggleConsent = async (crewId: string, val: boolean) => { await productionApi.clearancePacks.setConsent(crewId, val); load(); };
  const copyLink = (token: string) => { navigator.clipboard?.writeText(`${APP}/clearance/${token}`); };

  const printPack = (p: any) => {
    const w = window.open('', '_blank');
    if (!w) return;
    productionApi.clearancePacks.logDownload(p.id).catch(() => {});
    const rows = (p.members || []).map((m: any) => `
      <tr>
        <td><b>${esc(m.name)}</b>${m.consentGiven ? '' : ' <span style="color:#e11d48;font-size:11px">(no consent — excluded)</span>'}</td>
        <td>${esc(m.roleTitle || '')}</td>
        <td>${esc(m.department || '')}</td>
        <td>${m.passportUrl ? `<a href="${esc(m.passportUrl)}">Passport</a>` : '—'}</td>
        <td>${m.emiratesIdUrl ? `<a href="${esc(m.emiratesIdUrl)}">Emirates ID</a>` : '—'}</td>
        <td>${m.photoUrl ? `<a href="${esc(m.photoUrl)}">Photo</a>` : '—'}</td>
      </tr>`).join('');
    w.document.write(`<html><head><title>Clearance Pack — ${esc(p.title)}</title>
      <style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;padding:28px;font-size:12px}
      h1{font-size:18px;margin:0 0 2px}.sub{color:#64748b;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #0f172a;padding:6px 8px}
      td{border-bottom:1px solid #e2e8f0;padding:7px 8px} a{color:#2563eb}</style></head><body>
      <h1>Crew Clearance Pack</h1><p class="sub">${esc(p.title)}</p>
      <p>${p.recipientOrg ? `<b>For:</b> ${esc(p.recipientOrg)}<br>` : ''}${p.recipientName ? `<b>Attn:</b> ${esc(p.recipientName)}<br>` : ''}<b>Expires:</b> ${esc(fmt(p.expiresAt))}</p>
      ${p.purpose ? `<p>${esc(p.purpose)}</p>` : ''}
      <table><thead><tr><th>Name</th><th>Role</th><th>Dept</th><th>Passport</th><th>Emirates ID</th><th>Photo</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="color:#94a3b8">No members.</td></tr>'}</tbody></table>
      <p style="color:#94a3b8;font-size:10px">Confidential — contains personal identity documents shared with consent for pre-clearance only.</p>
      </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;

  const shared = packs.filter(p => p.status === 'SHARED').length;
  const partyVisits = visits.filter(v => (v.members?.length || 0) > 0);

  return (
    <div className="font-sans">
      <PanelHeader
        icon={ShieldCheck}
        title="Clearance packs"
        subtitle="Compile a scout party's IDs into a time-limited, audited link to send venues/security ahead. Only crew who consented are included."
        actions={<Btn variant="primary" onClick={() => setBuilding(b => !b)} disabled={partyVisits.length === 0}><Plus size={13} /> Build pack</Btn>}
      />

      {building && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 mb-3 space-y-2.5">
          <SectionLabel icon={ShieldCheck}>Build from a scout visit's party</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <select className={inp} value={draft.visitId} onChange={e => setDraft({ ...draft, visitId: e.target.value })}>
              <option value="">— scout visit —</option>
              {partyVisits.map((v: any) => <option key={v.id} value={v.id}>{v.title} · {v.members.length} crew</option>)}
            </select>
            <input className={inp} type="number" min={1} placeholder="Link expiry (days)" value={draft.expiryDays} onChange={e => setDraft({ ...draft, expiryDays: e.target.value })} />
            <input className={inp} placeholder="Venue / authority name" value={draft.recipientOrg} onChange={e => setDraft({ ...draft, recipientOrg: e.target.value })} />
            <input className={inp} placeholder="Contact name" value={draft.recipientName} onChange={e => setDraft({ ...draft, recipientName: e.target.value })} />
            <input className={inp} type="email" placeholder="Recipient email" value={draft.recipientEmail} onChange={e => setDraft({ ...draft, recipientEmail: e.target.value })} />
            <input className={inp} placeholder="Purpose (optional)" value={draft.purpose} onChange={e => setDraft({ ...draft, purpose: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={build} disabled={!draft.visitId}>Build pack</Btn>
            <Btn variant="secondary" onClick={() => setBuilding(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {packs.length === 0 ? (
        <EmptyState icon={ShieldCheck}>{partyVisits.length === 0 ? 'Assign a party to a scout visit first, then build a clearance pack here.' : 'No clearance packs yet. Build one from a scout visit’s party.'}</EmptyState>
      ) : (
        <>
          <StatRow stats={[['Packs', packs.length], ['Shared', shared], ['Party visits', partyVisits.length]]} />
          <div className="space-y-2">
            {packs.map((p) => {
              const expired = p.status === 'EXPIRED' || p.status === 'REVOKED' || (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now());
              const consenting = (p.members || []).filter((m: any) => m.consentGiven).length;
              const missing = (p.members || []).filter((m: any) => !m.consentGiven);
              return (
                <ClusterCard
                  key={p.id}
                  defaultOpen={p.status === 'DRAFT'}
                  title={<span className="inline-flex items-center gap-2">{p.title} <Chip tone={STATUS_TONE[p.status] || 'slate'}>{p.status}</Chip></span>}
                  badges={<Chip tone={missing.length ? 'risk' : 'money'}>{consenting}/{p.members?.length || 0} cleared</Chip>}
                  meta={<span className="inline-flex items-center gap-1"><Clock size={12} />{expired ? 'expired' : `exp ${fmt(p.expiresAt)}`}</span>}
                >
                  {/* actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn variant="secondary" onClick={() => copyLink(p.token)}><Link2 size={13} /> Copy link</Btn>
                    <Btn variant="secondary" onClick={() => refresh(p.id)}><RefreshCw size={13} /> Refresh consent</Btn>
                    <Btn variant="secondary" onClick={() => printPack(p)}><Printer size={13} /> Print pack</Btn>
                    <select className={inp} value="" onChange={e => e.target.value && setExpiry(p.id, Number(e.target.value))}>
                      <option value="">Reset expiry…</option>
                      {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}
                    </select>
                    {p.status !== 'REVOKED' && <Btn variant="primary" onClick={() => share(p)} disabled={!p.recipientEmail || expired}><Send size={13} /> {p.status === 'SHARED' ? 'Re-send' : 'Share'}</Btn>}
                    {p.status !== 'REVOKED' && <button onClick={() => revoke(p.id)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-2 text-xs"><Ban size={13} /> Revoke</button>}
                    <button onClick={() => remove(p.id)} className="text-slate-300 hover:text-rose-500 ml-auto"><Trash2 size={14} /></button>
                  </div>
                  {!p.recipientEmail && <p className="text-[11px] text-amber-600">Add a recipient email to share by email — or copy the link and send it yourself.</p>}

                  {/* members + consent */}
                  <div>
                    <SectionLabel icon={ShieldCheck}>Party & consent</SectionLabel>
                    <div className="space-y-1.5">
                      {(p.members || []).map((m: any) => (
                        <div key={m.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${m.consentGiven ? 'border-slate-200' : 'border-amber-200 bg-amber-50/40'}`}>
                          <span className="font-medium text-slate-800 text-sm flex-1 truncate">
                            {m.name}<span className="text-[11px] text-slate-400 ml-1.5">{[m.roleTitle, m.department].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px]">
                            {[['passportUrl', 'Passport'], ['emiratesIdUrl', 'Emirates ID'], ['photoUrl', 'Photo']].map(([k, label]) =>
                              m[k] ? <a key={k} href={m[k]} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{label}</a> : <span key={k} className="text-slate-300">{label}</span>
                            )}
                          </span>
                          {m.crewId && (
                            <button onClick={() => toggleConsent(m.crewId, !m.consentGiven)} title={m.consentGiven ? 'Consent given' : 'Mark consent given'}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${m.consentGiven ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-900'}`}>
                              {m.consentGiven ? <Check size={12} /> : <X size={12} />} Consent
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {missing.length > 0 && <p className="text-[11px] text-amber-600 mt-1.5">{missing.length} member{missing.length === 1 ? '' : 's'} excluded (no consent): {missing.map((m: any) => m.name).join(', ')}. Toggle consent then Refresh.</p>}
                  </div>

                  {/* audit */}
                  {(p.accesses || []).length > 0 && (
                    <div>
                      <SectionLabel icon={History}>Audit trail</SectionLabel>
                      <div className="space-y-0.5 text-[11px] text-slate-500">
                        {p.accesses.slice(0, 8).map((a: any) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <Chip tone={a.event === 'VIEWED' ? 'link' : a.event === 'REVOKED' || a.event === 'EXPIRED' ? 'risk' : a.event === 'SHARED' ? 'money' : 'slate'}>{a.event}</Chip>
                            <span className="text-slate-400">{fmt(a.createdAt)}</span>
                            {a.detail && <span className="text-slate-500">· {a.detail}</span>}
                            {a.ip && <span className="text-slate-300">· {a.ip}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </ClusterCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
