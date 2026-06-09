'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { ShoppingCart, X, Loader2, Tag, Link2, Unlink, CheckCircle2, Coins } from 'lucide-react';
import { Btn, Chip, EmptyState } from './ui';

const inp = 'rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-slate-900 outline-none';
const money = (n: any, c = 'AED') => `${c} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * SYS-13 · D9 — Procurement Staging. Each TAG annotation (a prop/asset call-out) can spawn a
 * DRAFT budget line under a chosen account; accounting reviews and confirms it later.
 */
export default function ProcurementStagingPanel({ projectId, revision, onClose }: { projectId: string; revision: any; onClose: () => void }) {
  const [tags, setTags] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, { accountId: string; quantity: string; rate: string }>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productionApi.scriptAnnotations.procStaging(revision.id), productionApi.scriptAnnotations.procAccounts(projectId)])
      .then(([s, a]) => { setTags(Array.isArray(s.data) ? s.data : []); setAccounts(Array.isArray(a.data) ? a.data : []); })
      .finally(() => setLoading(false));
  }, [revision.id, projectId]);
  useEffect(() => { load(); }, [load]);

  const d = (id: string) => draft[id] || { accountId: '', quantity: '1', rate: '' };
  const setD = (id: string, patch: any) => setDraft((s) => ({ ...s, [id]: { ...d(id), ...patch } }));

  const stage = async (t: any) => {
    const v = d(t.id);
    if (!v.accountId) { alert('Pick a budget account.'); return; }
    await productionApi.scriptAnnotations.procStage(t.id, { accountId: v.accountId, quantity: Number(v.quantity) || 1, rate: Number(v.rate) || 0 });
    load();
  };
  const unstage = async (t: any) => { await productionApi.scriptAnnotations.procUnstage(t.id); load(); };
  const confirm = async (t: any) => { await productionApi.scriptAnnotations.procConfirm(t.id); load(); };

  const staged = tags.filter((t) => t.line).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-sm inline-flex items-center gap-2"><ShoppingCart size={16} /> Procurement staging — {revision?.revisionLabel}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-5">
          {loading ? <Loader2 className="animate-spin text-slate-300 mx-auto my-8" /> : tags.length === 0 ? (
            <EmptyState icon={Tag}>No tags yet. Use the <b>Tag</b> tool on the script (e.g. “Prop: Vintage watch”) to call out props/assets, then stage them to a budget line here.</EmptyState>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                <Chip tone="slate">{tags.length} tags</Chip>
                <Chip tone="money">{staged} staged</Chip>
              </div>
              <div className="space-y-2">
                {tags.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Tag size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-800 text-sm flex-1">{t.text || 'Tag'}</span>
                      <span className="text-[11px] text-slate-400">p.{t.page}</span>
                    </div>

                    {t.line ? (
                      <div className="flex items-center gap-2 text-xs bg-emerald-50/60 rounded-lg px-2.5 py-1.5">
                        <Link2 size={13} className="text-emerald-600" />
                        <span className="flex-1 text-slate-700">{t.line.account?.code} {t.line.account?.title} · {t.line.description}</span>
                        <span className="font-medium">{money(Number(t.line.subtotal), t.line.currency)}</span>
                        <Chip tone={t.line.isDraft ? 'need' : 'money'}>{t.line.isDraft ? 'DRAFT' : 'CONFIRMED'}</Chip>
                        {t.line.isDraft && <button onClick={() => confirm(t)} title="Confirm into the budget" className="text-emerald-600 hover:text-emerald-800"><CheckCircle2 size={14} /></button>}
                        <button onClick={() => unstage(t)} title="Unlink draft" className="text-slate-300 hover:text-rose-500"><Unlink size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <select className={`${inp} flex-1`} value={d(t.id).accountId} onChange={(e) => setD(t.id, { accountId: e.target.value })}>
                          <option value="">— budget account —</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.title}</option>)}
                        </select>
                        <input className={`${inp} w-14`} placeholder="qty" value={d(t.id).quantity} onChange={(e) => setD(t.id, { quantity: e.target.value })} />
                        <input className={`${inp} w-20`} placeholder="rate" value={d(t.id).rate} onChange={(e) => setD(t.id, { rate: e.target.value })} />
                        <Btn variant="secondary" onClick={() => stage(t)} disabled={!d(t.id).accountId}><Coins size={12} /> Stage</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {accounts.length === 0 && <p className="text-[11px] text-amber-600 mt-3">No active budget version found — create/activate a budget to stage lines.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
