'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, ExternalLink, GitPullRequest, ShieldCheck, RefreshCw, Sparkles } from 'lucide-react';
import { laborApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  { v: 'PENDING', l: 'Pending', icon: Clock },
  { v: 'APPROVED', l: 'Approved', icon: CheckCircle },
  { v: 'REJECTED', l: 'Rejected', icon: XCircle },
];

export default function RateApprovalsPage() {
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [running, setRunning] = useState<'refresh' | 'ai' | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, { title?: string; publisher?: string; url?: string }>>({});

  const load = useCallback(() => {
    setLoading(true);
    laborApi.proposals(status).then((r) => setRows(r.data || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    laborApi.sources().then((r) => {
      const map: Record<string, any> = {};
      for (const s of r.data || []) map[s.id] = { title: s.title, publisher: s.publisher, url: s.url };
      setSources(map);
    }).catch(() => {});
  }, []);

  // Both actions only FILE PENDING PROPOSALS — nothing goes live without approval below.
  const runRefresh = async () => {
    setRunning('refresh'); setBanner(null);
    try {
      const r = await laborApi.refresh();
      setBanner(`Refresh: ${r.data.checked} allow-listed source(s) checked, ${r.data.changed} changed. Changes are filed below as PENDING review proposals.`);
      load();
    } catch (e: any) { setBanner(e.response?.data?.message || 'Refresh failed.'); }
    finally { setRunning(null); }
  };
  const runAi = async () => {
    if (!confirm('Run AI research across all active agreements with approved sources? Findings are filed as PENDING proposals only — nothing is applied automatically.')) return;
    setRunning('ai'); setBanner(null);
    try {
      const r = await laborApi.aiUpdateAll();
      setBanner(`AI research: ${r.data.agreementsRun} agreement(s) checked, ${r.data.proposalsFiled} proposal(s) filed, ${r.data.skipped} skipped${r.data.errorCount ? `, ${r.data.errorCount} error(s)` : ''}. Review below before approving.`);
      load();
    } catch (e: any) { setBanner(e.response?.data?.message || 'AI research failed — check ANTHROPIC_API_KEY in backend .env.'); }
    finally { setRunning(null); }
  };

  const act = async (id: string, kind: 'approve' | 'reject') => {
    const notes = kind === 'reject' ? (prompt('Reason for rejection (optional):') || '') : (prompt('Approval note (optional):') || '');
    setBusy(id);
    try {
      if (kind === 'approve') await laborApi.approveProposal(id, notes);
      else await laborApi.rejectProposal(id, notes);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Action failed — you may not have approver permission.');
    } finally { setBusy(null); }
  };

  const fmtVal = (v: any) => (v === null || v === undefined || v === '') ? '—' : String(v);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Approvals</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Rate Approvals</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={runRefresh} disabled={!!running} className="btn btn-secondary text-xs">
            <RefreshCw size={13} className={cn('mr-1', running === 'refresh' && 'animate-spin')} /> {running === 'refresh' ? 'Checking sources…' : 'Refresh sources'}
          </button>
          <button onClick={runAi} disabled={!!running} className="btn btn-secondary text-xs">
            <Sparkles size={13} className="mr-1" /> {running === 'ai' ? 'Researching…' : 'AI research'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-green-600" />
        Staged rate changes. Nothing goes live until approved here by a Finance Manager, Line Producer or System Admin. Approving creates a new effective-dated rule version — existing project snapshots are never touched.
      </p>

      {banner && (
        <div className="text-xs text-gray-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-4">{banner}</div>
      )}

      <div className="flex gap-1 mb-5">
        {STATUS_TABS.map((t) => (
          <button key={t.v} onClick={() => setStatus(t.v)}
            className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1', status === t.v ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
            <t.icon size={12} /> {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>
      ) : !rows.length ? (
        <div className="card p-10 text-center text-gray-400 text-sm">No {status.toLowerCase()} proposals.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const ctx = p.payload?._context || {};
            const diff = p.diff || {};
            return (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {ctx.review ? (ctx.sourceTitle || 'Source review') : (ctx.ruleLabel || ctx.label || 'Rate change')}
                      </span>
                      <span className={cn('text-[10px] uppercase rounded px-1.5 py-0.5', p.origin === 'AI' ? 'bg-violet-100 text-violet-700' : p.origin === 'REFRESH' ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500')}>{p.origin}</span>
                      {p.confidence != null && <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">conf {Math.round(Number(p.confidence) * 100)}%</span>}
                      {ctx.newRule && <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">new rule</span>}
                      {ctx.review && <span className={cn('text-[10px] rounded px-1.5 py-0.5', ctx.status === 'OK' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600')}>{ctx.status === 'OK' ? 'source changed' : ctx.status?.toLowerCase()}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ctx.laborBodyName ? `${ctx.laborBodyName} · ` : ''}{ctx.agreementName || ''}{ctx.rateType ? ` · ${ctx.rateType}` : ''} · {new Date(p.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => act(p.id, 'approve')} disabled={busy === p.id} className="btn btn-primary text-xs"><CheckCircle size={13} className="mr-1" /> {ctx.review ? 'Acknowledge' : 'Approve'}</button>
                      <button onClick={() => act(p.id, 'reject')} disabled={busy === p.id} className="btn btn-secondary text-xs text-red-600 border-red-200"><XCircle size={13} className="mr-1" /> {ctx.review ? 'Dismiss' : 'Reject'}</button>
                    </div>
                  )}
                  {status !== 'PENDING' && (
                    <span className={cn('badge text-xs', status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>{status}</span>
                  )}
                </div>

                {ctx.review && (
                  <div className="mt-2 text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    {ctx.note}
                    {ctx.sourceUrl && <a href={ctx.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-600 inline-flex items-center gap-0.5 ml-2"><ExternalLink size={11} /> Open source</a>}
                  </div>
                )}

                {/* Diff */}
                {Object.keys(diff).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(diff).map(([field, d]: any) => (
                      <div key={field} className="text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                        <span className="text-gray-400 uppercase text-[10px]">{field}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-red-500 line-through">{fmtVal(d.from)}</span>
                          <span className="text-gray-300">→</span>
                          <span className="text-green-700 font-semibold">{fmtVal(d.to)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                  {p.payload?.notes && <span>Note: {p.payload.notes}</span>}
                  {!ctx.review && p.sourceId && sources[p.sourceId] && (
                    <a href={sources[p.sourceId].url || '#'} target="_blank" rel="noreferrer" className="text-brand-600 inline-flex items-center gap-0.5">
                      <ExternalLink size={11} /> {sources[p.sourceId].publisher || sources[p.sourceId].title || 'Source'}
                    </a>
                  )}
                  {p.payload?.effectiveDate && <span>Effective: {new Date(p.payload.effectiveDate).toLocaleDateString()}</span>}
                  {p.reviewNotes && <span>Reviewer: {p.reviewNotes}</span>}
                  {p.reviewedAt && <span>Reviewed: {new Date(p.reviewedAt).toLocaleDateString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
