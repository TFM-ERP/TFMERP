'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Inbox, RefreshCw, GitBranch } from 'lucide-react';
import { workflowApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const ENTITY_LABEL: Record<string, string> = {
  INVOICE: 'Invoice', EXPENSE: 'Expense', PURCHASE_ORDER: 'Purchase Order', PETTY_CASH: 'Petty Cash',
  TIMECARD: 'Timecard', CONTRACT: 'Contract', BUDGET_TRANSFER: 'Budget Transfer', OVERAGE: 'Overage',
  BUDGET_CHANGE: 'Budget Change', SCHEDULE_CHANGE: 'Schedule Change', LOCATION: 'Location', OTHER: 'Item',
};

export default function MyApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    workflowApi.myPending().then(r => setItems(r.data || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, kind: 'approve' | 'reject') => {
    const comment = kind === 'reject' ? (prompt('Reason for rejection (optional):') || '') : (prompt('Note (optional):') || '');
    setBusy(id);
    try {
      if (kind === 'approve') await workflowApi.approve(id, comment); else await workflowApi.reject(id, comment);
      load();
    } catch (e: any) { alert(e.response?.data?.message || 'Action failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Inbox size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Approvals</h1>
            <p className="text-sm text-gray-500">Items waiting on you across every project — {items.length} pending.</p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary text-xs"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>
      ) : !items.length ? (
        <div className="card p-10 text-center text-gray-400 text-sm"><CheckCircle2 size={22} className="mx-auto mb-2 opacity-30" />Nothing waiting on you. 🎬</div>
      ) : (
        <div className="space-y-2">
          {items.map((i: any) => (
            <div key={i.id} className="card flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <span className="text-[10px] uppercase bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{ENTITY_LABEL[i.entityType] || i.entityType}</span>
                  {i.label || i.entityId}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                  <GitBranch size={11} /> {i.definition} · step: <b className="text-gray-600">{i.step}</b> · {new Date(i.createdAt).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => act(i.id, 'approve')} disabled={busy === i.id} className="btn btn-primary text-xs"><CheckCircle2 size={13} className="mr-1" /> Approve</button>
                <button onClick={() => act(i.id, 'reject')} disabled={busy === i.id} className="btn btn-secondary text-xs text-red-600 border-red-200"><XCircle size={13} className="mr-1" /> Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-4">Sequential routing — approving advances to the next step; the workflow only takes effect once every step approves. Rejecting stops it.</p>
    </div>
  );
}
