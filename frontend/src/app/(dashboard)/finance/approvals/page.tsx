'use client';

import { useEffect, useState } from 'react';
import { CheckSquare, CheckCircle, XCircle, RefreshCw, Clock, ChevronRight } from 'lucide-react';
import { approvalsApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const STEP_META: Record<string, { cls: string; dot: string }> = {
  PENDING: { cls: 'text-gray-400', dot: 'bg-gray-300' },
  APPROVED: { cls: 'text-green-600', dot: 'bg-green-500' },
  REJECTED: { cls: 'text-red-600', dot: 'bg-red-500' },
};

export default function ApprovalsPage() {
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    const p = view === 'pending' ? approvalsApi.pending() : approvalsApi.listAll();
    p.then(r => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [view]); // eslint-disable-line

  const act = async (id: string, decision: 'approve' | 'reject') => {
    setActing(id);
    try {
      const comment = comments[id];
      if (decision === 'approve') await approvalsApi.approve(id, comment);
      else await approvalsApi.reject(id, comment);
      setComments(c => ({ ...c, [id]: '' }));
      load();
    } finally { setActing(null); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Finance · Approvals</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Invoice Approvals</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Multi-step approval routing for expenses &amp; supplier invoices.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button onClick={() => setView('pending')} className={cn('px-3 py-1.5', view === 'pending' ? 'bg-brand-50 text-brand-700' : 'text-gray-500')}>Pending</button>
            <button onClick={() => setView('all')} className={cn('px-3 py-1.5', view === 'all' ? 'bg-brand-50 text-brand-700' : 'text-gray-500')}>All</button>
          </div>
          <button onClick={load} className="btn btn-secondary p-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {loading ? <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div> :
        items.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <CheckCircle size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{view === 'pending' ? 'Nothing awaiting approval.' : 'No approval requests yet.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(req => {
              const current = req.steps.find((s: any) => s.stepOrder === req.currentStep);
              const isPending = req.status === 'PENDING';
              return (
                <div key={req.id} className="card">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">{req.title}</div>
                      <div className="text-xs text-gray-400">{req.entityType} · raised {formatDate(req.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(Number(req.amount))}</div>
                      <span className={cn('badge text-[11px]',
                        req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : req.status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700')}>
                        {req.status}
                      </span>
                    </div>
                  </div>

                  {/* Step chain */}
                  <div className="flex items-center flex-wrap gap-1 mb-3">
                    {req.steps.map((s: any, i: number) => {
                      const m = STEP_META[s.status];
                      const isCurrent = isPending && s.stepOrder === req.currentStep;
                      return (
                        <div key={s.id} className="flex items-center">
                          <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border',
                            isCurrent ? 'border-amber-300 bg-amber-50' : 'border-gray-100')}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
                            <span className={cn('font-medium', m.cls)}>{s.approverRole}</span>
                            {s.status !== 'PENDING' && s.decidedByName && <span className="text-gray-400">· {s.decidedByName}</span>}
                          </div>
                          {i < req.steps.length - 1 && <ChevronRight size={13} className="text-gray-300 mx-0.5" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Comments on decided steps */}
                  {req.steps.filter((s: any) => s.comment).length > 0 && (
                    <div className="mb-3 space-y-1">
                      {req.steps.filter((s: any) => s.comment).map((s: any) => (
                        <div key={s.id} className="text-xs text-gray-500"><b>{s.approverRole}:</b> {s.comment}</div>
                      ))}
                    </div>
                  )}

                  {/* Action on current step */}
                  {isPending && current && (
                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Clock size={12} /> Awaiting <b className="text-gray-700">{current.approverRole}</b></div>
                      <div className="flex gap-2">
                        <input className="input text-sm flex-1" placeholder="Comment (optional)" value={comments[req.id] || ''} onChange={e => setComments(c => ({ ...c, [req.id]: e.target.value }))} />
                        <button onClick={() => act(req.id, 'approve')} disabled={acting === req.id} className="btn btn-primary text-sm"><CheckCircle size={14} className="mr-1" /> Approve</button>
                        <button onClick={() => act(req.id, 'reject')} disabled={acting === req.id} className="btn btn-secondary text-sm text-red-600"><XCircle size={14} className="mr-1" /> Reject</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
