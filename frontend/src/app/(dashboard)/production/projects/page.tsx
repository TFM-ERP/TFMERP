'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productionApi, uploadFile } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, RefreshCw, Plus, Film, Calendar, Copy, FileUp, Wand2, X, Clapperboard } from 'lucide-react';

const PROJECT_TYPES = ['TVC', 'CORPORATE', 'DOCUMENTARY', 'FEATURE', 'SHORT', 'MUSIC_VIDEO', 'OTHER'];
const STATUSES = ['DEVELOPMENT', 'PRE_PRODUCTION', 'PRODUCTION', 'POST_PRODUCTION', 'DELIVERED', 'CANCELLED', 'ARCHIVED'];

const STATUS_COLORS: Record<string, string> = {
  DEVELOPMENT: 'bg-gray-100 text-gray-600',
  PRE_PRODUCTION: 'bg-blue-100 text-blue-700',
  PRODUCTION: 'bg-yellow-100 text-yellow-700',
  POST_PRODUCTION: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  ARCHIVED: 'bg-gray-100 text-gray-400',
};

export default function ProductionProjectsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', clientId: '', projectType: 'TVC', currency: 'AED', startDate: '', endDate: '', description: '',
  });
  // Filming country (GeoNode) — drives jurisdiction tax rules + incentives/rebates
  const [countries, setCountries] = useState<any[]>([]);
  const [countryId, setCountryId] = useState('');
  // Bulk archive: archived hidden by default, multi-select via card checkboxes
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiving, setArchiving] = useState(false);
  const visible = useMemo(() => showArchived ? items : items.filter((p: any) => p.status !== 'ARCHIVED'), [items, showArchived]);
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const archiveSelected = async () => {
    if (!selected.size) return;
    if (!confirm(`Archive ${selected.size} project(s)? They stay intact and reversible — set Status back from the project page anytime.`)) return;
    setArchiving(true);
    try {
      const r = await productionApi.projects.bulkArchive([...selected]);
      alert(`Archived ${r.data.archived} project(s).`);
      setSelected(new Set()); load();
    } catch (e: any) { alert(e.response?.data?.message || 'Bulk archive failed.'); }
    finally { setArchiving(false); }
  };
  // Optional script upload + breakdown on create
  const scriptRef = useRef<HTMLInputElement>(null);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [scriptMode, setScriptMode] = useState<'full' | 'import'>('full');
  // Optional Movie Magic import on create
  const [mmbFile, setMmbFile] = useState<File | null>(null);
  const [mmsFile, setMmsFile] = useState<File | null>(null);
  // Optional 6000–9000 distribution/P&A/revenue/corporate ledger
  const [includeDistribution, setIncludeDistribution] = useState(false);
  const [progress, setProgress] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [dup, setDup] = useState<any>(null);
  const [duping, setDuping] = useState(false);

  const runDuplicate = async (scope: string) => {
    if (!dup) return;
    setDuping(true);
    try { await productionApi.projects.duplicate(dup.id, scope); setDup(null); load(); }
    finally { setDuping(false); }
  };

  const load = useCallback(() => {
    setLoading(true);
    productionApi.projects.list(search ? { search } : {})
      .then(r => { setItems(r.data.items || []); setTotal(r.data.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    import('@/lib/api').then(m => {
      m.clientsApi.list().then(r => setClients(r.data.items || r.data || [])).catch(() => {});
      m.laborApi.geoList().then(r => {
        const all = r.data || [];
        const cs = all.filter((g: any) => g.level === 'COUNTRY');
        setCountries(cs);
        const uae = cs.find((c: any) => c.code === 'AE' || c.name === 'United Arab Emirates');
        if (uae) setCountryId(uae.id); // default filming country
      }).catch(() => {});
    });
  }, []);

  const resetForm = () => {
    setShowForm(false); setProgress('');
    setForm({ title: '', clientId: '', projectType: 'TVC', currency: 'AED', startDate: '', endDate: '', description: '' });
    setScriptFile(null); setMmbFile(null); setMmsFile(null); setIncludeDistribution(false);
  };

  const handleSave = async () => {
    if (!form.title) { setError('Project title is required'); return; }
    setSaving(true); setError('');
    try {
      setProgress('Creating project…');
      const res = await productionApi.projects.create({
        ...form,
        clientId: form.clientId || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        includeDistribution,
        productionCountryId: countryId || undefined,
      });
      const created = res.data;

      // optional: import a Movie Magic budget/schedule, then jump into the project
      if ((mmbFile || mmsFile) && created?.id) {
        try {
          setProgress('Importing Movie Magic files…');
          await productionApi.movieMagic.import(created.id, mmbFile, mmsFile);
          resetForm();
          router.push(`/production/projects/${created.id}`);
          return;
        } catch (me: any) {
          resetForm();
          router.push(`/production/projects/${created.id}`);
          alert(`Project created, but the Movie Magic import failed: ${me.response?.data?.message || 'error'}.\nYou can retry from the project's Settings tab.`);
          return;
        }
      }

      // optional: upload + break down the script, then jump into the project
      if (scriptFile && created?.id) {
        try {
          setProgress('Uploading script…');
          const up = await uploadFile(scriptFile);
          setProgress(scriptMode === 'full' ? 'Breaking down + scheduling + budgeting (AI)…' : 'Breaking down script (AI)…');
          if (scriptMode === 'full') {
            await productionApi.breakdown.importScriptFull(created.id, { fileUrl: up.url, originalName: up.originalName, pagesPerDay: 5 });
          } else {
            await productionApi.breakdown.importScript(created.id, { fileUrl: up.url, originalName: up.originalName, replace: true });
          }
          resetForm();
          router.push(`/production/projects/${created.id}`);
          return;
        } catch (be: any) {
          // project exists; only the breakdown failed — surface it but still open the project
          resetForm();
          router.push(`/production/projects/${created.id}`);
          alert(`Project created, but the script breakdown failed: ${be.response?.data?.message || 'error'}.\nYou can retry from the Schedule tab (Import script).`);
          return;
        }
      }

      resetForm();
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create project');
      setProgress('');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} projects</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> New Project
        </button>
      </div>

      {/* New Project Form */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Production Project</h3>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Project Title *</label>
              <input className="input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Toyota TVC - Summer 2024" />
            </div>
            <div>
              <label className="label">Client</label>
              <select className="input w-full" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">— No client —</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Project Type</label>
              <select className="input w-full" value={form.projectType} onChange={e => setForm(f => ({ ...f, projectType: e.target.value }))}>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Base Currency *</label>
              <select className="input w-full" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['AED', 'USD', 'EUR', 'GBP', 'CAD', 'SAR'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-0.5">The budget, fringes and incentives all denominate in this. Set it now — it's hard to change later.</p>
            </div>
            <div>
              <label className="label">Filming Country *</label>
              <select className="input w-full" value={countryId} onChange={e => setCountryId(e.target.value)}>
                <option value="">— select —</option>
                {countries.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-0.5">Where you're shooting — sets the VAT/tax rules for accounting and which rebates show in the Incentives tab.</p>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input w-full" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input w-full" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input w-full" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Optional script breakdown on create */}
            <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
              <label className="label flex items-center gap-1.5"><Wand2 size={13} className="text-brand-600" /> Script (optional — auto-breakdown after save)</label>
              <input ref={scriptRef} type="file" accept=".fdx,.pdf,.docx,.txt,.fountain" className="hidden" onChange={e => setScriptFile(e.target.files?.[0] || null)} />
              {!scriptFile ? (
                <button type="button" onClick={() => scriptRef.current?.click()} className="btn btn-secondary text-sm mt-1">
                  <FileUp size={14} className="mr-1" /> Choose .fdx / .pdf / .docx
                </button>
              ) : (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-700 bg-gray-100 rounded px-2 py-1 inline-flex items-center gap-1.5">
                    <FileUp size={13} /> {scriptFile.name}
                    <button type="button" onClick={() => setScriptFile(null)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                  </span>
                  <select className="input text-sm h-8" value={scriptMode} onChange={e => setScriptMode(e.target.value as any)}>
                    <option value="full">Full setup (breakdown + schedule + budget)</option>
                    <option value="import">Breakdown only (scenes + elements)</option>
                  </select>
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">Uses AI to tag scenes &amp; elements after the project is saved, then opens the project. Needs the AI key configured. You can also do this later from the Schedule tab.</p>
            </div>

            {/* Optional Movie Magic import on create (no AI) */}
            <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
              <label className="label flex items-center gap-1.5"><Clapperboard size={13} className="text-brand-600" /> Movie Magic (optional — import after save)</label>
              <div className="grid sm:grid-cols-2 gap-2 mt-1">
                <label className="btn btn-secondary text-sm cursor-pointer justify-center inline-flex"><FileUp size={14} className="mr-1" /> <span className="truncate max-w-[180px]">{mmbFile ? mmbFile.name : 'MMB budget export (.xml/.csv)'}</span><input type="file" accept=".xml,.csv" className="hidden" onChange={e => setMmbFile(e.target.files?.[0] || null)} /></label>
                <label className="btn btn-secondary text-sm cursor-pointer justify-center inline-flex"><FileUp size={14} className="mr-1" /> <span className="truncate max-w-[180px]">{mmsFile ? mmsFile.name : 'MMS schedule export (.sex)'}</span><input type="file" accept=".sex,.xml" className="hidden" onChange={e => setMmsFile(e.target.files?.[0] || null)} /></label>
              </div>
              {(mmbFile || mmsFile) && <div className="mt-1 flex gap-2 text-[11px] text-gray-500">{mmbFile && <button type="button" onClick={() => setMmbFile(null)} className="hover:text-red-500 inline-flex items-center gap-1"><X size={11} /> clear budget</button>}{mmsFile && <button type="button" onClick={() => setMmsFile(null)} className="hover:text-red-500 inline-flex items-center gap-1"><X size={11} /> clear schedule</button>}</div>}
              <p className="text-[11px] text-gray-400 mt-1.5">Use a Movie Magic <b>export</b> (File ▸ Export → XML/CSV or .sex) — native .mmb/.mms binaries aren't readable. No AI; lines are tagged with the Movie Magic origin.</p>
            </div>

            {/* Optional distribution / P&A / revenue / corporate ledger (6000–9000) */}
            <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={includeDistribution} onChange={e => setIncludeDistribution(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="text-sm font-medium text-gray-700">Include distribution &amp; corporate ledger (6000–9000)</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">Adds Marketing &amp; P&amp;A (6000), Revenue (7000), Cost of Goods Sold (8000) and Corporate Overhead (9000) sections for projects that track sales and distribution — not just the production budget. You can also add it later from Settings.</span>
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4 items-center">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? (progress || 'Creating…') : ((mmbFile || mmsFile) ? 'Create & import' : scriptFile ? 'Create & break down' : 'Create Project')}</button>
            <button onClick={resetForm} disabled={saving} className="btn btn-secondary">Cancel</button>
            {saving && progress && <span className="text-xs text-gray-400">{progress}</span>}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowArchived(v => !v)}
          className={cn('btn text-xs whitespace-nowrap', showArchived ? 'bg-gray-200 text-gray-700' : 'btn-secondary')}>
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
        {selected.size > 0 && (
          <button onClick={archiveSelected} disabled={archiving} className="btn btn-primary text-xs whitespace-nowrap">
            {archiving ? 'Archiving…' : `Archive selected (${selected.size})`}
          </button>
        )}
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((p: any) => (
          <Link key={p.id} href={`/production/projects/${p.id}`} className={cn('card hover:border-brand-300 hover:shadow-md transition-all cursor-pointer block', selected.has(p.id) && 'border-brand-400 ring-1 ring-brand-200', p.status === 'ARCHIVED' && 'opacity-60')}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selected.has(p.id)}
                  onClick={(e) => { e.stopPropagation(); }}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer" title="Select for bulk archive" />
                <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
                  <Film size={16} className="text-brand-600" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('badge text-xs', STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600')}>
                  {p.status.replace(/_/g, ' ')}
                </span>
                <button title="Duplicate project" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDup(p); }}
                  className="text-gray-300 hover:text-brand-600"><Copy size={14} /></button>
                <button title="Delete project" onClick={async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const typed = prompt(`Delete "${p.title}" and EVERYTHING in it (budgets, ledger, schedule, crew)?\nThis cannot be undone.\n\nType the project number to confirm: ${p.projectNumber}`);
                  if (typed !== p.projectNumber) { if (typed !== null) alert('Project number did not match — nothing deleted.'); return; }
                  try { await productionApi.projects.remove(p.id); load(); }
                  catch (err: any) {
                    const msg = err.response?.data?.message || 'Delete failed.';
                    if (msg.includes('force=true') && confirm(`${msg}\n\nDelete anyway?`)) {
                      try { await productionApi.projects.remove(p.id, true); load(); } catch (e2: any) { alert(e2.response?.data?.message || 'Delete failed.'); }
                    } else alert(msg);
                  }
                }} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
              </div>
            </div>
            <p className="font-semibold text-gray-900 text-sm mb-1 leading-tight">{p.title}</p>
            <p className="text-xs text-gray-400 mb-3">{p.projectNumber} · {p.projectType.replace(/_/g, ' ')}</p>
            {p.client && <p className="text-xs text-gray-500 mb-2">{p.client.companyName}</p>}
            <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-2 mt-2">
              <span>{p._count?.crew || 0} crew</span>
              {p.totalBudget ? (
                <span className="font-semibold text-gray-700">{formatCurrency(p.totalBudget)}</span>
              ) : (
                <span className="text-gray-300">No budget</span>
              )}
            </div>
          </Link>
        ))}
        {items.length === 0 && !loading && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Film size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No projects yet. Create your first production project.</p>
          </div>
        )}
      </div>

      {/* Duplicate scope dialog */}
      {dup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !duping && setDup(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">Duplicate "{dup.title}"</h3>
            <p className="text-xs text-gray-500 mb-4">Copies the budget structure. Choose which personnel to carry over.</p>
            <div className="space-y-2">
              {[
                ['all', 'All personnel (ATL & BTL)', 'Director, producers and the full crew'],
                ['atl', 'ATL personnel only', 'Above-the-line: director, producers, line producer'],
                ['btl', 'BTL personnel only', 'Below-the-line: department crew'],
                ['none', 'Without personnel', 'Budget only — no crew, cast or department heads'],
              ].map(([scope, label, desc]) => (
                <button key={scope} disabled={duping} onClick={() => runDuplicate(scope)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors disabled:opacity-50">
                  <div className="font-medium text-gray-800 text-sm">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setDup(null)} disabled={duping} className="btn btn-secondary text-sm">Cancel</button>
            </div>
            {duping && <p className="text-xs text-gray-400 mt-2">Duplicating…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
