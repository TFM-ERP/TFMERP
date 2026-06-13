'use client';

import { useEffect, useState, useCallback } from 'react';
import { GitBranch, Plus, Trash2, Save, RefreshCw, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { workflowApi, productionApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const ENTITY_TYPES = ['INVOICE', 'EXPENSE', 'PURCHASE_ORDER', 'PETTY_CASH', 'TIMECARD', 'CONTRACT', 'BUDGET_TRANSFER', 'OVERAGE', 'BUDGET_CHANGE', 'SCHEDULE_CHANGE', 'LOCATION', 'OTHER'];
const GLOBAL_ROLES = ['', 'SYSTEM_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'PRODUCTION_MANAGER', 'PRODUCTION_COORDINATOR', 'HR_MANAGER'];

export default function WorkflowsAdminPage() {
  const [defs, setDefs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<any>(null); // working copy of selected definition
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    workflowApi.definitions().then(r => setDefs(r.data || [])).catch(() => setDefs([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); productionApi.projects.permissionTemplates().then(r => setTemplates(r.data || [])).catch(() => {}); }, [load]);

  const pick = (d: any) => setSel(JSON.parse(JSON.stringify({ ...d, nodes: [...(d.nodes || [])].sort((a, b) => a.order - b.order) })));
  const newDef = () => setSel({ key: '', name: '', entityType: 'PURCHASE_ORDER', description: '', isActive: true, nodes: [{ order: 1, name: 'Step 1', approverTemplateKey: '', approverRole: '' }] });

  const setNode = (i: number, patch: any) => setSel((s: any) => ({ ...s, nodes: s.nodes.map((n: any, j: number) => j === i ? { ...n, ...patch } : n) }));
  const addNode = () => setSel((s: any) => ({ ...s, nodes: [...s.nodes, { order: s.nodes.length + 1, name: `Step ${s.nodes.length + 1}`, approverTemplateKey: '', approverRole: '' }] }));
  const delNode = (i: number) => setSel((s: any) => ({ ...s, nodes: s.nodes.filter((_: any, j: number) => j !== i).map((n: any, k: number) => ({ ...n, order: k + 1 })) }));
  const move = (i: number, dir: -1 | 1) => setSel((s: any) => {
    const a = [...s.nodes]; const j = i + dir; if (j < 0 || j >= a.length) return s;
    [a[i], a[j]] = [a[j], a[i]]; return { ...s, nodes: a.map((n, k) => ({ ...n, order: k + 1 })) };
  });

  const save = async () => {
    if (!sel.key || !sel.name) { alert('Key and name are required.'); return; }
    setSaving(true);
    try { await workflowApi.upsertDefinition(sel); load(); alert('Workflow saved.'); }
    catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><GitBranch size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Workflows</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Approval Workflows</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Sequential approval chains for POs, timecards, petty cash, transfers and more.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={newDef} className="btn btn-secondary text-xs"><Plus size={14} className="mr-1" /> New</button>
          <button onClick={load} className="btn btn-secondary p-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-4">
        {/* list */}
        <div className="card p-0 overflow-hidden h-fit">
          {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading…</div> : defs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No workflows yet.</div>
          ) : defs.map((d: any) => (
            <button key={d.id} onClick={() => pick(d)} className={cn('w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 text-left hover:bg-gray-50', sel?.key === d.key && 'bg-brand-50')}>
              <div>
                <div className="text-sm font-medium text-gray-800">{d.name}</div>
                <div className="text-[11px] text-gray-400">{d.entityType.replace(/_/g, ' ')} · {(d.nodes || []).length} steps{d.isActive ? '' : ' · inactive'}</div>
              </div>
              <ChevronRight size={15} className="text-gray-300" />
            </button>
          ))}
        </div>

        {/* editor */}
        {sel ? (
          <div className="card space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label text-xs">Key (unique)</label><input className="input text-sm w-full font-mono" value={sel.key} onChange={e => setSel((s: any) => ({ ...s, key: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} placeholder="PO_STANDARD" /></div>
              <div><label className="label text-xs">Entity type</label><select className="input text-sm w-full" value={sel.entityType} onChange={e => setSel((s: any) => ({ ...s, entityType: e.target.value }))}>{ENTITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div className="col-span-2"><label className="label text-xs">Name</label><input className="input text-sm w-full" value={sel.name} onChange={e => setSel((s: any) => ({ ...s, name: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label text-xs">Description</label><input className="input text-sm w-full" value={sel.description || ''} onChange={e => setSel((s: any) => ({ ...s, description: e.target.value }))} /></div>
              <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={sel.isActive} onChange={e => setSel((s: any) => ({ ...s, isActive: e.target.checked }))} /> Active (the one used for new items of this type)</label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase">Approval steps (in order)</span>
                <button onClick={addNode} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><Plus size={12} /> Add step</button>
              </div>
              <div className="space-y-2">
                {sel.nodes.map((n: any, i: number) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold bg-brand-100 text-brand-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0">{n.order}</span>
                      <input className="input text-sm h-8 flex-1" value={n.name} onChange={e => setNode(i, { name: e.target.value })} placeholder="Step name e.g. Dept Head" />
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === sel.nodes.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown size={14} /></button>
                      <button onClick={() => delNode(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-7">
                      <div><label className="text-[10px] text-gray-400">Project role (template)</label>
                        <select className="input text-xs h-8 w-full" value={n.approverTemplateKey || ''} onChange={e => setNode(i, { approverTemplateKey: e.target.value || null })}>
                          <option value="">— any —</option>{templates.map((t: any) => <option key={t.key} value={t.key}>{t.name}</option>)}
                        </select>
                      </div>
                      <div><label className="text-[10px] text-gray-400">…or global role</label>
                        <select className="input text-xs h-8 w-full" value={n.approverRole || ''} onChange={e => setNode(i, { approverRole: e.target.value || null })}>
                          {GLOBAL_ROLES.map(r => <option key={r} value={r}>{r ? r.replace(/_/g, ' ') : '— none —'}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">A user may act on a step if they hold its project role OR its global role. System Admin can always act.</p>
            </div>

            <div className="flex justify-end">
              <button onClick={save} disabled={saving} className="btn btn-primary text-xs"><Save size={13} className="mr-1" /> {saving ? 'Saving…' : 'Save workflow'}</button>
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center text-gray-400 text-sm">Pick a workflow to edit, or create a new one.</div>
        )}
      </div>
    </div>
  );
}
