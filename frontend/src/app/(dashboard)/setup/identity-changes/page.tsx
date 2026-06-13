'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Check, X, Users, Loader2 } from 'lucide-react';
import { accountApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Row = {
  id: string; fullName: string; email: string;
  department?: string | null; jobTitle?: string | null;
  legalName?: string | null; legalNameProposed?: string | null; updatedAt: string;
};

export default function IdentityChangesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    accountApi.pendingLegalNames()
      .then((r) => setRows(r.data || []))
      .catch((e) => { if (e?.response?.status === 403) setDenied(true); setRows([]); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (userId: string, approve: boolean) => {
    if (!confirm(approve ? 'Approve this legal-name change? It becomes the record of truth.' : 'Reject this legal-name change? The current name is kept.')) return;
    setBusy(userId);
    try { await accountApi.clearLegalName(userId, approve); setRows((rs) => rs.filter((r) => r.id !== userId)); }
    catch (e: any) { alert(e?.response?.data?.message || 'Action failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Users size={20} className="text-brand-600" />
        <h1 className="text-xl font-bold text-gray-900">Identity changes</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5 flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-green-600" />
        Legal-name changes submitted by users in their account. They stay pending — and the record of truth is unchanged — until approved here by HR or Finance.
      </p>

      {denied ? (
        <div className="card p-10 text-center text-gray-400 text-sm">Only HR or Finance can review legal-name changes.</div>
      ) : loading ? (
        <div className="card p-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading…</div>
      ) : !rows.length ? (
        <div className="card p-10 text-center text-gray-400 text-sm">No pending legal-name changes.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {r.email}{r.department ? ` · ${r.department}` : ''}{r.jobTitle ? ` · ${r.jobTitle}` : ''} · requested {new Date(r.updatedAt).toLocaleDateString('en-GB')}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-sm">
                    <span className="text-red-500 line-through">{r.legalName || '—'}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-green-700 font-semibold">{r.legalNameProposed || '—'}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => act(r.id, true)} disabled={busy === r.id}
                    className={cn('btn btn-primary text-xs', busy === r.id && 'opacity-50')}><Check size={13} className="mr-1" /> Approve</button>
                  <button onClick={() => act(r.id, false)} disabled={busy === r.id}
                    className="btn btn-secondary text-xs text-red-600 border-red-200"><X size={13} className="mr-1" /> Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
