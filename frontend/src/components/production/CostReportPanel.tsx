'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { RefreshCw, Camera, FileDown, ChevronDown, ChevronRight, AlertTriangle, Printer, Mail, ArrowLeftRight, Plus, Trash2, X, CheckCircle, XCircle, MapPin, Briefcase } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

export default function CostReportPanel({ projectId, currency = 'AED', onMutate }: { projectId: string; currency?: string; onMutate?: () => void }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [data, setData] = useState<any>(null);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [move, setMove] = useState<any>({ fromCode: '', toCode: '', amount: '', reason: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      productionApi.costing.report(projectId),
      productionApi.costing.snapshots(projectId),
      productionApi.costing.transfers(projectId),
    ]).then(([r, s, tr]) => { setData(r.data); setSnaps(s.data || []); setTransfers(tr.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const mutated = () => { load(); onMutate?.(); };

  const saveEtc = async (accountId: string, raw: string) => {
    const v = raw.trim() === '' ? null : Number(raw);
    await productionApi.costing.setEtc(accountId, v);
    mutated();
  };
  const snapshot = async () => {
    const label = prompt('Snapshot label (e.g. "Week 14"):') || undefined;
    await productionApi.costing.saveSnapshot(projectId, label);
    load();
  };
  const toggle = (code: string) => setCollapsed(p => { const n = new Set(p); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const emailReport = async () => {
    const r = prompt('Email the cost report to (comma-separated emails):', '');
    if (!r) return;
    try { const res = await productionApi.mail.costReport(projectId, { recipients: r }); alert(`Cost report emailed to ${res.data.sent} recipient(s).`); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not send — check Company Management → Email (SMTP) setup.'); }
  };

  // All accounts (for the move-budget pickers)
  const allAccounts: { code: string; title: string }[] = (data?.sections || []).flatMap((s: any) => s.accounts.map((a: any) => ({ code: a.code, title: a.title })));

  const saveMove = async () => {
    if (!move.fromCode || !move.toCode || !move.amount) return;
    try {
      await productionApi.costing.createTransfer({ projectId, fromCode: move.fromCode, toCode: move.toCode, amount: Number(move.amount), reason: move.reason || undefined });
      setMoveOpen(false); setMove({ fromCode: '', toCode: '', amount: '', reason: '' });
      mutated();
    } catch (e: any) { alert(e?.response?.data?.message || 'Could not move budget.'); }
  };
  const setTransferStatus = async (id: string, status: string) => { await productionApi.costing.setTransferStatus(id, status); mutated(); };
  const removeTransfer = async (id: string) => { if (confirm('Delete this budget move?')) { await productionApi.costing.removeTransfer(id); mutated(); } };

  const raiseOverage = async (a: any) => {
    const over = Math.round((a.efc - a.revisedBudget) * 100) / 100;
    if (!confirm(`Raise an overage of ${money(over)} on ${a.code} · ${a.title}? It will go to the Overages tab for approval; once approved it lifts this line's budget.`)) return;
    await productionApi.overages.create({
      projectId, accountCode: a.code, accountTitle: a.title,
      description: `Overrun on ${a.code} · ${a.title}`, amount: over, reason: 'EFC exceeds revised budget',
    });
    alert('Overage logged in the Overages tab (pending approval).');
    mutated();
  };

  const csv = () => {
    if (!data) return;
    const rows = [['Section', 'Cost Center', 'Title', 'Budget', 'Transfers', 'Approved Chg', 'Revised', 'Committed', 'Actual', 'ETC', 'EFC', 'Variance']];
    for (const s of data.sections) for (const a of s.accounts)
      rows.push([s.title, a.code, a.title, a.budget, a.transfer, a.approvedChange, a.revisedBudget, a.committed, a.actual, a.etc, a.efc, a.variance].map(String));
    rows.push(['', '', 'TOTAL', data.totals.budget, data.totals.transfer, data.totals.approvedChange, data.totals.revisedBudget, data.totals.committed, data.totals.actual, '', data.totals.efc, data.totals.variance].map(String));
    if (data.locations && data.locations.count > 0) {
      rows.push([]);
      rows.push(['LOCATION SPEND (informational)', 'Fee paid', 'Fee pending', 'Permit fees', 'Security', 'Total'].map(String));
      for (const l of data.locations.byLocation) rows.push([l.name, l.paid, l.pending, l.permitFees, l.security, l.total].map(String));
      rows.push(['LOCATIONS TOTAL', data.locations.payments.paid, data.locations.payments.pending, data.locations.permitFees, data.locations.security.total, data.locations.total].map(String));
    }
    const blob = new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'cost-report.csv'; a.click(); URL.revokeObjectURL(u);
  };

  const t = data?.totals;
  const delta = (a: any) => Number(a.transfer || 0) + Number(a.approvedChange || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Cost Report (EFC)</h3>
          <p className="text-xs text-gray-400">Budget → Revised (transfers + approved overages) → Committed → Actual → EFC → Variance.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMoveOpen(true)} className="btn btn-secondary text-xs py-1.5 px-2"><ArrowLeftRight size={12} className="me-1" /> Move budget</button>
          <button onClick={emailReport} className="btn btn-secondary text-xs py-1.5 px-2"><Mail size={12} className="me-1" /> Email</button>
          <button onClick={() => window.open(`/print/costreport/${projectId}`, '_blank')} className="btn btn-secondary text-xs py-1.5 px-2"><Printer size={12} className="me-1" /> Print / PDF</button>
          <button onClick={() => window.open(`/print/reportpack/${projectId}`, '_blank')} className="btn btn-secondary text-xs py-1.5 px-2"><Briefcase size={12} className="me-1" /> Financier pack</button>
          <button onClick={csv} className="btn btn-secondary text-xs py-1.5 px-2"><FileDown size={12} className="me-1" /> CSV</button>
          <button onClick={snapshot} className="btn btn-secondary text-xs py-1.5 px-2"><Camera size={12} className="me-1" /> Save snapshot</button>
          <button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* Totals */}
      {t && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="card"><p className="text-xs text-gray-400">Budget</p><p className="text-lg font-bold text-gray-900">{money(t.budget)}</p>{Math.abs(t.revisedBudget - t.budget) > 0.01 && <p className="text-[10px] text-gray-400">revised {money(t.revisedBudget)}</p>}</div>
          <div className="card"><p className="text-xs text-gray-400">Approved Δ</p><p className={cn('text-lg font-bold', t.approvedChange > 0 ? 'text-purple-600' : 'text-gray-400')}>{t.approvedChange > 0 ? '+' : ''}{money(t.approvedChange)}</p></div>
          <div className="card"><p className="text-xs text-gray-400">Committed</p><p className="text-lg font-bold text-blue-600">{money(t.committed)}</p></div>
          <div className="card"><p className="text-xs text-gray-400">Actual</p><p className="text-lg font-bold text-amber-600">{money(t.actual)}</p></div>
          <div className="card"><p className="text-xs text-gray-400">Est. Final Cost</p><p className="text-lg font-bold text-gray-900">{money(t.efc)}</p></div>
          <div className={cn('card', t.variance < 0 ? 'ring-1 ring-red-200' : '')}><p className="text-xs text-gray-400">Variance</p><p className={cn('text-lg font-bold', t.variance < 0 ? 'text-red-600' : 'text-green-600')}>{t.variance < 0 ? '-' : ''}{money(Math.abs(t.variance))}</p></div>
        </div>
      )}

      {/* Report table */}
      <div className="card overflow-x-auto p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          !data || data.sections.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No active budget.</div> : (
            <table className="w-full text-sm min-w-[920px]">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2.5 text-start">Cost Center</th>
                <th className="px-3 py-2.5 text-end">Budget</th>
                <th className="px-3 py-2.5 text-end">Δ Adj</th>
                <th className="px-3 py-2.5 text-end">Revised</th>
                <th className="px-3 py-2.5 text-end">Committed</th>
                <th className="px-3 py-2.5 text-end">Actual</th>
                <th className="px-3 py-2.5 text-end w-24">ETC</th>
                <th className="px-3 py-2.5 text-end">EFC</th>
                <th className="px-3 py-2.5 text-end">Variance</th>
              </tr></thead>
              <tbody>
                {data.sections.map((s: any) => {
                  const open = !collapsed.has(s.code);
                  const sDelta = Number(s.transfer || 0) + Number(s.approvedChange || 0);
                  return (
                    <Fragment key={s.code}>
                      <tr className="bg-gray-50 cursor-pointer" onClick={() => toggle(s.code)}>
                        <td className="px-4 py-2 font-semibold text-gray-800" style={{ borderLeft: `3px solid ${s.color || '#6366f1'}` }}>
                          <span className="inline-flex items-center gap-1">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{s.code} — {s.title}</span>
                        </td>
                        <td className="px-3 py-2 text-end font-semibold">{money(s.budget)}</td>
                        <td className={cn('px-3 py-2 text-end', sDelta > 0 ? 'text-purple-600' : sDelta < 0 ? 'text-blue-600' : 'text-gray-300')}>{sDelta === 0 ? '—' : (sDelta > 0 ? '+' : '−') + money(Math.abs(sDelta))}</td>
                        <td className="px-3 py-2 text-end font-semibold">{money(s.revisedBudget)}</td>
                        <td className="px-3 py-2 text-end font-semibold text-blue-600">{money(s.committed)}</td>
                        <td className="px-3 py-2 text-end font-semibold text-amber-600">{money(s.actual)}</td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-end font-semibold">{money(s.efc)}</td>
                        <td className={cn('px-3 py-2 text-end font-semibold', s.variance < 0 ? 'text-red-600' : 'text-gray-600')}>{s.variance < 0 ? '-' : ''}{money(Math.abs(s.variance))}</td>
                      </tr>
                      {open && s.accounts.map((a: any) => {
                        const d = delta(a);
                        return (
                          <tr key={a.code} className={cn('border-b border-gray-50', a.overspent && 'bg-red-50/40')}>
                            <td className="px-4 py-1.5 ps-8 text-gray-600 text-xs">{a.code} · {a.title}</td>
                            <td className="px-3 py-1.5 text-end text-gray-600">{money(a.budget)}</td>
                            <td className={cn('px-3 py-1.5 text-end text-xs', d > 0 ? 'text-purple-600' : d < 0 ? 'text-blue-600' : 'text-gray-300')}
                              title={`Transfers ${money(a.transfer)} · Approved overages ${money(a.approvedChange)}`}>
                              {d === 0 ? '—' : (d > 0 ? '+' : '−') + money(Math.abs(d))}
                            </td>
                            <td className="px-3 py-1.5 text-end text-gray-700">{money(a.revisedBudget)}</td>
                            <td className="px-3 py-1.5 text-end text-blue-600">{a.committed ? money(a.committed) : '—'}</td>
                            <td className="px-3 py-1.5 text-end text-amber-600">{a.actual ? money(a.actual) : '—'}</td>
                            <td className="px-3 py-1.5 text-end">
                              <input type="number" defaultValue={a.etcManual ? a.etc : ''} placeholder={String(Math.round(a.committed))}
                                onBlur={e => { if (e.target.value !== (a.etcManual ? String(a.etc) : '')) saveEtc(a.accountId, e.target.value); }}
                                className={cn('input text-xs h-7 w-20 text-end', a.etcManual && 'border-brand-300')} title="Estimate to Complete (blank = remaining commitments)" />
                            </td>
                            <td className="px-3 py-1.5 text-end font-medium text-gray-800">{money(a.efc)}</td>
                            <td className={cn('px-3 py-1.5 text-end whitespace-nowrap', a.variance < 0 ? 'text-red-600' : 'text-gray-500')}>
                              {a.overspent && <button onClick={() => raiseOverage(a)} title="Raise overage for the gap" className="text-red-500 hover:text-red-700 me-1 align-middle"><AlertTriangle size={11} className="inline" /></button>}
                              {a.variance < 0 ? '-' : ''}{money(Math.abs(a.variance))}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {t && (
                  <tr className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-200">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-3 py-3 text-end">{money(t.budget)}</td>
                    <td className={cn('px-3 py-3 text-end', t.approvedChange > 0 ? 'text-purple-700' : 'text-gray-400')}>{t.approvedChange > 0 ? '+' + money(t.approvedChange) : '—'}</td>
                    <td className="px-3 py-3 text-end">{money(t.revisedBudget)}</td>
                    <td className="px-3 py-3 text-end text-blue-700">{money(t.committed)}</td>
                    <td className="px-3 py-3 text-end text-amber-700">{money(t.actual)}</td>
                    <td></td>
                    <td className="px-3 py-3 text-end">{money(t.efc)}</td>
                    <td className={cn('px-3 py-3 text-end', t.variance < 0 ? 'text-red-600' : 'text-green-600')}>{t.variance < 0 ? '-' : ''}{money(Math.abs(t.variance))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
      </div>
      <p className="text-[11px] text-gray-400">Revised = Budget ± line-to-line transfers + approved overages. ETC = your Estimate to Complete (blank = remaining PO commitments). EFC = Actual + ETC. Variance = Revised − EFC. The red triangle raises an overage for an overspent line.</p>

      {/* Location spend (ADDITIVE · informational — not part of the EFC reconciliation above) */}
      {data?.locations && data.locations.count > 0 && (data.locations.total > 0 || data.locations.feePerDayTotal > 0) && (
        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><MapPin size={12} /> Location spend</h4>
            <span className="text-[11px] text-gray-400">{data.locations.count} location{data.locations.count === 1 ? '' : 's'} · fees, permits &amp; security — informational, not in the EFC above</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <div><p className="text-[10px] text-gray-400 uppercase">Committed</p><p className="text-base font-bold text-blue-600">{money(data.locations.committed)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Actual (paid)</p><p className="text-base font-bold text-amber-600">{money(data.locations.actual)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Total exposure</p><p className="text-base font-bold text-gray-900">{money(data.locations.total)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Permit fees</p><p className="text-base font-semibold text-gray-700">{money(data.locations.permitFees)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Security</p><p className="text-base font-semibold text-gray-700">{money(data.locations.security.total)}</p></div>
          </div>
          {data.locations.byLocation.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-[10px] text-gray-400 uppercase border-b border-gray-100">
                  <th className="text-start py-1.5">Location</th>
                  <th className="text-end px-2">Fee paid</th>
                  <th className="text-end px-2">Fee pending</th>
                  <th className="text-end px-2">Permits</th>
                  <th className="text-end px-2">Security</th>
                  <th className="text-end px-2">Total</th>
                </tr></thead>
                <tbody>
                  {data.locations.byLocation.map((l: any) => (
                    <tr key={l.id} className="border-t border-gray-50">
                      <td className="py-1.5 text-gray-700 text-xs">{l.name}</td>
                      <td className="py-1.5 px-2 text-end text-amber-600">{l.paid ? money(l.paid) : '\u2014'}</td>
                      <td className="py-1.5 px-2 text-end text-blue-600">{l.pending ? money(l.pending) : '\u2014'}</td>
                      <td className="py-1.5 px-2 text-end text-gray-600">{l.permitFees ? money(l.permitFees) : '\u2014'}</td>
                      <td className="py-1.5 px-2 text-end text-gray-600">{l.security ? money(l.security) : '\u2014'}</td>
                      <td className="py-1.5 px-2 text-end font-medium text-gray-800">{money(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.locations.feePerDayTotal > 0 && <p className="text-[11px] text-gray-400 mt-2">Reference: combined location day-rate {money(data.locations.feePerDayTotal)}/day across locations. Actual fee spend is tracked via landlord payments (paid/pending) above.</p>}
        </div>
      )}

      {/* Budget transfers */}
      {transfers.length > 0 && (
        <div className="card">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ArrowLeftRight size={12} /> Budget moves</h4>
          <p className="text-[11px] text-gray-400 mb-2">Only approved moves reshape the budget above. Pending moves wait for sign-off.</p>
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-start py-1">When</th><th className="text-start">From</th><th className="text-start">To</th><th className="text-end">Amount</th><th className="text-start ps-3">Status</th><th className="text-start ps-3">Reason</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {transfers.map(tr => {
                const st = tr.status || 'PENDING';
                const cls = st === 'APPROVED' ? 'bg-green-100 text-green-700' : st === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700';
                return (
                  <tr key={tr.id} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-500 text-xs">{formatDate(tr.date)}</td>
                    <td className="py-1.5 text-gray-700 text-xs">{tr.fromCode}{tr.fromTitle ? ` · ${tr.fromTitle}` : ''}</td>
                    <td className="py-1.5 text-gray-700 text-xs">{tr.toCode}{tr.toTitle ? ` · ${tr.toTitle}` : ''}</td>
                    <td className="py-1.5 text-end font-medium text-gray-800">{money(Number(tr.amount))}</td>
                    <td className="py-1.5 ps-3"><span className={cn('badge text-[11px]', cls)}>{st.charAt(0) + st.slice(1).toLowerCase()}</span></td>
                    <td className="py-1.5 ps-3 text-gray-400 text-xs">{tr.reason || '—'}</td>
                    <td className="py-1.5 text-end whitespace-nowrap">
                      {st === 'PENDING' && (
                        <>
                          <button onClick={() => setTransferStatus(tr.id, 'APPROVED')} title="Approve move" className="text-green-500 hover:text-green-700 me-2"><CheckCircle size={14} /></button>
                          <button onClick={() => setTransferStatus(tr.id, 'REJECTED')} title="Reject move" className="text-red-400 hover:text-red-600 me-2"><XCircle size={14} /></button>
                        </>
                      )}
                      <button onClick={() => removeTransfer(tr.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Snapshots */}
      {snaps.length > 0 && (
        <div className="card">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Saved snapshots</h4>
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-start py-1">When</th><th className="text-start">Label</th><th className="text-end">EFC</th><th className="text-end">Variance</th></tr></thead>
            <tbody>
              {snaps.map(s => (
                <tr key={s.id} className="border-t border-gray-50">
                  <td className="py-1.5 text-gray-500 text-xs">{formatDate(s.asOf)}</td>
                  <td className="py-1.5 text-gray-700">{s.label || '—'}</td>
                  <td className="py-1.5 text-end text-gray-700">{money(s.efc)}</td>
                  <td className={cn('py-1.5 text-end', Number(s.variance) < 0 ? 'text-red-600' : 'text-green-600')}>{money(s.variance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Move-budget modal */}
      {moveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setMoveOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div>
                <div className="font-semibold text-gray-800 text-sm">Move budget between lines</div>
                <div className="text-[11px] text-gray-400">Reallocates within the same total — no change to the grand budget. Takes effect once approved below.</div>
              </div>
              <button onClick={() => setMoveOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label text-xs">Move from (donor) *</label>
                <select className="input text-sm h-9 w-full" value={move.fromCode} onChange={e => setMove((f: any) => ({ ...f, fromCode: e.target.value }))}>
                  <option value="">— Select cost center —</option>
                  {allAccounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Move to (recipient) *</label>
                <select className="input text-sm h-9 w-full" value={move.toCode} onChange={e => setMove((f: any) => ({ ...f, toCode: e.target.value }))}>
                  <option value="">— Select cost center —</option>
                  {allAccounts.filter(a => a.code !== move.fromCode).map(a => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label text-xs">Amount ({currency}) *</label><input type="number" className="input text-sm h-9 w-full" value={move.amount} onChange={e => setMove((f: any) => ({ ...f, amount: e.target.value }))} /></div>
                <div><label className="label text-xs">Reason</label><input className="input text-sm h-9 w-full" value={move.reason} onChange={e => setMove((f: any) => ({ ...f, reason: e.target.value }))} placeholder="e.g. cover camera overage" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={() => setMoveOpen(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button>
              <button onClick={saveMove} disabled={!move.fromCode || !move.toCode || !move.amount} className="btn btn-primary text-xs py-1.5 disabled:opacity-40"><Plus size={13} className="me-1" /> Move budget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
