'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi, assetUrl } from '@/lib/api';
import { MapPin, RefreshCw, Plus, Trash2, Loader2, Lock, Unlock, Check, BarChart3, ThumbsUp, ThumbsDown } from 'lucide-react';
import { PanelHeader, StatRow, ClusterCard, Chip, Btn, EmptyState, SectionLabel } from './ui';

const NEED_TONE: Record<string, string> = { SOURCING: 'slate', OPTIONS: 'need', LOCKED: 'money' };
const SIGNOFF_TONE: Record<string, string> = { PENDING: 'slate', APPROVED: 'money', REJECTED: 'risk' };

// Lazy option-comparison deck + director sign-off for one Need (SYS-07 V2 · Slice 6).
function NeedCompare({ needId, onSignedOff }: { needId: string; onSignedOff: () => void }) {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const load = () => productionApi.locationReports.compareNeed(needId).then((r) => { setData(r.data); setNote(r.data?.need?.signOffNote || ''); });
  const toggle = () => { if (!open && !data) load(); setOpen((o) => !o); };
  const signOff = async (status: string) => { await productionApi.locationReports.signOff(needId, { status, note }); await load(); onSignedOff(); };

  return (
    <div>
      <button onClick={toggle} className="text-xs inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"><BarChart3 size={13} /> {open ? 'Hide' : 'Compare options & sign-off'}</button>
      {open && (!data ? <p className="text-xs text-slate-400 mt-2"><Loader2 size={13} className="animate-spin inline" /> loading…</p> : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Director sign-off:</span>
            <Chip tone={SIGNOFF_TONE[data.need.signOffStatus] || 'slate'}>{data.need.signOffStatus}</Chip>
            {data.need.signOffAt && <span className="text-[11px] text-slate-400">{new Date(data.need.signOffAt).toLocaleDateString('en-GB')}</span>}
          </div>
          {data.options.length === 0 ? <p className="text-xs text-slate-400">No options to compare.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.options.map((o: any) => (
                <div key={o.optionId} className={`rounded-xl border p-2 ${o.isSelected ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-800 text-sm truncate flex-1">{o.name}<span className="text-[11px] text-slate-400 ml-1">{[o.area, o.emirate].filter(Boolean).join(', ')}</span></span>
                    {o.weightedScore != null && <Chip tone="link">{o.weightedScore.toFixed(1)}</Chip>}
                    {o.blockers > 0 && <Chip tone="risk">{o.blockers} blk</Chip>}
                  </div>
                  {o.plates.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto">
                      {o.plates.map((p: any) => <img key={p.id} src={assetUrl(p.url)} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200" />)}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">{o.plateCount} plate{o.plateCount === 1 ? '' : 's'} · {o.recommendation || 'unrated'}</p>
                </div>
              ))}
            </div>
          )}
          <textarea className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" rows={2} placeholder="Sign-off note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => signOff('APPROVED')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs hover:bg-emerald-700"><ThumbsUp size={13} /> Approve</button>
            <button onClick={() => signOff('REJECTED')} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 text-rose-600 px-3 py-2 text-xs hover:bg-rose-50"><ThumbsDown size={13} /> Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
const OPT_TONE: Record<string, string> = { PROPOSED: 'slate', SCOUTING: 'need', RECCED: 'link', SHORTLISTED: 'link', APPROVED: 'money', REJECTED: 'risk' };
const OPT_STATUSES = ['PROPOSED', 'SCOUTING', 'RECCED', 'SHORTLISTED', 'APPROVED', 'REJECTED'];
const inp = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-900 outline-none';

export default function LocationNeedsPanel({ projectId }: { projectId: string }) {
  const [needs, setNeeds] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addSel, setAddSel] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productionApi.locationNeeds.list(projectId), productionApi.locations.list(projectId)])
      .then(([n, l]) => { setNeeds(Array.isArray(n.data) ? n.data : []); setLocs(Array.isArray(l.data) ? l.data : []); })
      .catch(() => setNeeds([]))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const sync = async () => { setBusy(true); try { const r = await productionApi.locationNeeds.sync(projectId); load(); } finally { setBusy(false); } };
  const addOption = async (needId: string) => { const locationId = addSel[needId]; if (!locationId) return; await productionApi.locationNeeds.addOption(needId, { locationId }); setAddSel(s => ({ ...s, [needId]: '' })); load(); };
  const setOptStatus = async (id: string, optionStatus: string) => { await productionApi.locationNeeds.updateOption(id, { optionStatus }); load(); };
  const removeOption = async (id: string) => { await productionApi.locationNeeds.removeOption(id); load(); };
  const lock = async (needId: string, optionId: string) => { await productionApi.locationNeeds.lock(needId, optionId); load(); };
  const unlock = async (needId: string) => { await productionApi.locationNeeds.unlock(needId); load(); };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;

  const lockedCount = needs.filter(n => n.status === 'LOCKED').length;
  const optionCount = needs.reduce((t, n) => t + (n.options?.length || 0), 0);

  return (
    <div className="font-sans">
      <PanelHeader
        icon={MapPin}
        title="Location breakdown & options"
        subtitle="Each script location, the candidate places in play, and the locked pick — synced from the breakdown."
        actions={<Btn variant="secondary" onClick={sync} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync from breakdown</Btn>}
      />

      {needs.length === 0 ? (
        <EmptyState icon={MapPin}>No location needs yet. Run the AI script breakdown, then “Sync from breakdown” to list each script location here.</EmptyState>
      ) : (
        <>
          <StatRow stats={[['Script locations', needs.length], ['Locked', lockedCount], ['Candidate options', optionCount]]} />
          <div className="space-y-2">
            {needs.map((n) => {
              const selected = (n.options || []).find((o: any) => o.isSelected);
              const taken = new Set((n.options || []).map((o: any) => o.locationId));
              const pool = locs.filter((l: any) => !taken.has(l.id));
              return (
                <ClusterCard
                  key={n.id}
                  defaultOpen={n.status !== 'LOCKED'}
                  title={<span className="inline-flex items-center gap-2">{n.name} <Chip tone={NEED_TONE[n.status] || 'slate'}>{n.status}</Chip></span>}
                  badges={n.intExt ? <Chip tone="slate">{n.intExt}</Chip> : null}
                  meta={<span>{(n.options?.length || 0)} option{(n.options?.length === 1) ? '' : 's'}{n.sceneRefs ? ` · Sc ${n.sceneRefs}` : ''}</span>}
                >
                  {/* Candidate options */}
                  <div>
                    <SectionLabel icon={MapPin}>Candidate locations</SectionLabel>
                    {(n.options || []).length === 0 ? <p className="text-xs text-slate-400">No candidates yet — add a scouted/library location below.</p> : (
                      <div className="space-y-1.5">
                        {n.options.map((o: any) => (
                          <div key={o.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${o.isSelected ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                            <span className="font-medium text-slate-800 text-sm truncate flex-1">
                              {o.isSelected && <Check size={13} className="inline text-emerald-600 mr-1" />}
                              {o.location?.name || '—'}
                              <span className="text-[11px] text-slate-400 ml-1.5">{[o.location?.emirate, o.location?.area].filter(Boolean).join(' · ')}</span>
                            </span>
                            <select className={inp} value={o.optionStatus} onChange={(e) => setOptStatus(o.id, e.target.value)}>
                              {OPT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                            </select>
                            {n.status === 'LOCKED' && o.isSelected
                              ? <button onClick={() => unlock(n.id)} title="Unlock" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900 text-xs"><Unlock size={12} /> Unlock</button>
                              : <button onClick={() => lock(n.id, o.id)} title="Lock this as the location" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900 text-xs"><Lock size={12} /> Lock</button>}
                            <button onClick={() => removeOption(o.id)} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add candidate */}
                  <div className="flex items-center gap-2">
                    <select className={`${inp} flex-1`} value={addSel[n.id] || ''} onChange={(e) => setAddSel(s => ({ ...s, [n.id]: e.target.value }))}>
                      <option value="">— add a candidate location —</option>
                      {pool.map((l: any) => <option key={l.id} value={l.id}>{l.name}{l.emirate ? ` · ${l.emirate}` : ''}</option>)}
                    </select>
                    <Btn variant="secondary" onClick={() => addOption(n.id)} disabled={!addSel[n.id]}><Plus size={13} /> Add option</Btn>
                  </div>
                  {selected && <p className="text-[11px] text-emerald-700">Locked to <b>{selected.location?.name}</b> — this Need’s scenes now point at it for call sheets &amp; per-diem.</p>}

                  {/* Option comparison deck + director sign-off (S6) */}
                  {(n.options || []).length > 0 && <NeedCompare needId={n.id} onSignedOff={load} />}
                </ClusterCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
