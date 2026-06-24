'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, X, RefreshCw, Trophy, FileText, Trash2 } from 'lucide-react';
import { crmApi, clientsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const OPEN = [
  { k: 'QUALIFIED', label: 'Qualified', color: '#6b7280' },
  { k: 'PROPOSAL', label: 'Proposal', color: '#2563eb' },
  { k: 'NEGOTIATION', label: 'Negotiation', color: '#d97706' },
];
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';

export default function CrmPipelinePage() {
  const router = useRouter();
  const [opps, setOpps] = useState<any[]>([]);
  const [pipe, setPipe] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>(null);

  const load = () => {
    setLoading(true);
    Promise.all([crmApi.opportunities(), crmApi.pipeline()]).then(([o, p]) => { setOpps(o.data); setPipe(p.data); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); clientsApi.list().then(r => setClients(r.data.items || r.data || [])).catch(() => {}); }, []);

  const move = async (id: string, stage: string) => {
    let reason: string | undefined;
    if (stage === 'LOST') reason = prompt('Reason for loss (optional):') || undefined;
    await crmApi.setStage(id, stage, reason); load();
  };
  const toQuote = async (o: any) => {
    try { const r = await crmApi.toQuotation(o.id); router.push(`/finance/quotations/${r.data.id}`); }
    catch (e: any) { alert(e.response?.data?.message || 'Link a client first.'); }
  };
  const del = async (id: string) => { if (confirm('Delete this opportunity?')) { await crmApi.removeOpp(id); load(); } };

  const byStage = (s: string) => opps.filter(o => o.stage === s);
  const won = pipe?.byStage?.WON || { count: 0, value: 0 };

  return (
    <div className="p-4 sm:p-6 w-full">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}><Target size={18} style={{ color: 'var(--accent)' }} /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>CRM · Pipeline</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Sales Pipeline</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Track opportunities from qualified to won.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="/crm/leads" className="btn btn-secondary text-sm">Leads</a>
          <button onClick={() => setEdit({ title: '', value: '', stage: 'QUALIFIED', probability: 50 })} className="btn btn-primary"><Plus size={14} /> Opportunity</button>
          <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}><div className="text-xs" style={{ color: 'var(--text-3)' }}>Open pipeline</div><div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{formatCurrency(pipe?.openValue || 0)}</div></div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}><div className="text-xs" style={{ color: 'var(--text-3)' }}>Weighted</div><div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{formatCurrency(pipe?.weightedPipeline || 0)}</div></div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}><div className="text-xs" style={{ color: 'var(--text-3)' }}>Won value</div><div className="text-xl font-bold" style={{ color: 'var(--ok)' }}>{formatCurrency(pipe?.wonValue || 0)}</div></div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}><div className="text-xs" style={{ color: 'var(--text-3)' }}>Win rate</div><div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{pipe?.winRate || 0}%</div></div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {OPEN.map(col => (
          <div key={col.k} className="rounded-xl p-2" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-2)' }}><span className="w-2 h-2 rounded-full" style={{ background: col.color }} /> {col.label}</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{formatCurrency(pipe?.byStage?.[col.k]?.value || 0)}</span>
            </div>
            <div className="space-y-2 min-h-[60px]">
              {byStage(col.k).map(o => (
                <div key={o.id} className="rounded-lg p-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => setEdit(o)} className="text-start text-sm font-medium transition-colors" style={{ color: 'var(--text-1)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-1)'; }}>{o.title}</button>
                    <button onClick={() => del(o.id)} className="transition-colors" style={{ color: 'var(--text-3)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}><Trash2 size={13} /></button>
                  </div>
                  {o.clientName && <div className="text-xs" style={{ color: 'var(--text-3)' }}>{o.clientName}</div>}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{formatCurrency(Number(o.value))}</span>
                    {o.expectedCloseDate && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{fmtD(o.expectedCloseDate)}</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <select value={o.stage} onChange={e => move(o.id, e.target.value)} className="text-[11px] rounded px-1 py-1 flex-1" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', color: 'var(--text-1)' }}>
                      {['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => toQuote(o)} title="Create quotation" className="p-1 transition-colors" style={{ color: 'var(--text-3)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}><FileText size={14} /></button>
                  </div>
                </div>
              ))}
              {byStage(col.k).length === 0 && <div className="text-center text-xs py-4" style={{ color: 'var(--text-3)' }}>—</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Won / Lost summary row */}
      <div className="flex gap-3 mt-4">
        <div className="rounded-xl p-3 flex-1 flex items-center gap-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}><Trophy size={16} style={{ color: 'var(--ok)' }} /> <span className="text-sm" style={{ color: 'var(--text-2)' }}>Won: <b>{won.count}</b> · {formatCurrency(won.value)}</span></div>
        <div className="rounded-xl p-3 flex-1 text-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', color: 'var(--text-2)' }}>Lost: <b>{pipe?.byStage?.LOST?.count || 0}</b></div>
      </div>

      {edit && <OppModal opp={edit} clients={clients} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function OppModal({ opp, clients, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ ...opp, value: opp.value ?? '', expectedCloseDate: opp.expectedCloseDate ? String(opp.expectedCloseDate).slice(0, 10) : '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.title) return; setSaving(true);
    try { if (opp.id) await crmApi.updateOpp(opp.id, f); else await crmApi.createOpp(f); onSaved(); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--surface-1)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-1)' }}><h2 className="font-bold" style={{ color: 'var(--text-1)' }}>{opp.id ? 'Edit opportunity' : 'New opportunity'}</h2><button onClick={onClose} className="transition-colors" style={{ color: 'var(--text-3)' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}><X size={16} /></button></div>
        <div className="px-6 py-4 space-y-3">
          <div><label className="label">Title *</label><input className="input w-full" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
          <div><label className="label">Client</label>
            <select className="input w-full" value={f.clientId || ''} onChange={e => setF({ ...f, clientId: e.target.value })}>
              <option value="">— (none / lead)</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Value (AED)</label><input type="number" className="input w-full" value={f.value} onChange={e => setF({ ...f, value: e.target.value })} /></div>
            <div><label className="label">Probability %</label><input type="number" className="input w-full" value={f.probability} onChange={e => setF({ ...f, probability: e.target.value })} /></div>
            <div><label className="label">Stage</label><select className="input w-full" value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })}>{['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Expected close</label><input type="date" className="input w-full" value={f.expectedCloseDate} onChange={e => setF({ ...f, expectedCloseDate: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input w-full h-16 resize-none" value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border-1)' }}><button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button><button onClick={save} disabled={saving} className="btn btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button></div>
      </div>
    </div>
  );
}
