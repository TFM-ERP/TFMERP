'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productionApi, uploadFile, assetUrl } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, RefreshCw, Plus, Film, Calendar, Copy, FileUp, Wand2, X, Clapperboard } from 'lucide-react';

const PROJECT_TYPES = ['TVC', 'CORPORATE', 'DOCUMENTARY', 'FEATURE', 'SHORT', 'MUSIC_VIDEO', 'OTHER'];
const STATUSES = ['DEVELOPMENT', 'PRE_PRODUCTION', 'PRODUCTION', 'POST_PRODUCTION', 'DELIVERED', 'CANCELLED', 'ARCHIVED'];

/** One-sheet "genre line" under the title. */
const TYPE_LABEL: Record<string, string> = {
  TVC: 'TVC', CORPORATE: 'Corporate Film', DOCUMENTARY: 'Documentary',
  FEATURE: 'Feature Film', SHORT: 'Short Film', MUSIC_VIDEO: 'Music Video', OTHER: 'Production',
};
/** Tiles without an uploaded poster fall back to a type-keyed gradient — per theme. */
const TYPE_FALLBACK: Record<string, string> = {
  FEATURE: 'linear-gradient(135deg,#2a2a2e,#121214 55%,#3a2c12)',
  DOCUMENTARY: 'linear-gradient(160deg,#1d2b26,#121416 60%,#1b2330)',
  TVC: 'linear-gradient(150deg,#3a2c12,#1c1407 60%,#0d0a05)',
  MUSIC_VIDEO: 'radial-gradient(120% 120% at 20% 0%,#46201c,#161214 70%)',
  SHORT: 'linear-gradient(140deg,#262033,#141118 60%,#101418)',
  CORPORATE: 'linear-gradient(145deg,#23272d,#141416 60%,#1a1d22)',
  OTHER: 'linear-gradient(135deg,#26262a,#121214 60%,#1d1d21)',
};
const TYPE_FALLBACK_LIGHT: Record<string, string> = {
  FEATURE: 'linear-gradient(135deg,#E6E4DF,#F3F1EC 55%,#F2EBD8)',
  DOCUMENTARY: 'linear-gradient(160deg,#DCEAE4,#EFF4F1 60%,#E5EEE8)',
  TVC: 'linear-gradient(150deg,#F0E6D5,#F8F3E8 60%,#F2EBD8)',
  MUSIC_VIDEO: 'radial-gradient(120% 120% at 20% 0%,#F2DCDA,#F9EEED 70%)',
  SHORT: 'linear-gradient(140deg,#E4E0EC,#F2F0F6 60%,#EBE9F0)',
  CORPORATE: 'linear-gradient(145deg,#E0E3E7,#F0F1F4 60%,#E9ECEF)',
  OTHER: 'linear-gradient(135deg,#E6E4DF,#F2F1EE 60%,#EBEAE6)',
};

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
  // Bulk select: active grid bulk-archives; archived section bulk-unarchives / bulk-deletes.
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());        // active tiles
  const [selectedArc, setSelectedArc] = useState<Set<string>>(new Set());  // archived cards
  const [archiving, setArchiving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Theme: marquee + tiles follow the global mode (Graphite light · Charcoal Black dark).
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  // Marquee palette per theme
  const MQ = isDark ? {
    panel: 'linear-gradient(120deg,#141416 0%,#0E0E10 55%,#1c1407 130%)', border: '#232326',
    glow: 'radial-gradient(circle,rgba(201,169,106,.16),transparent 70%)', kicker: '#c9a96a',
    title: '#fff', count: 'rgba(255,255,255,.55)',
    fieldBg: 'rgba(255,255,255,.07)', fieldBd: '1px solid rgba(255,255,255,.14)', fieldText: 'rgba(255,255,255,.85)',
    searchText: '#ffffff', searchPh: 'placeholder-white/40', icon: 'rgba(255,255,255,.45)',
    btnBg: 'linear-gradient(135deg,#c9a96a,#a87f3d)', btnText: '#1a1206', btnShadow: '0 4px 14px rgba(176,141,79,.35)',
    chipBd: '1px solid rgba(255,255,255,.16)', chipText: 'rgba(255,255,255,.7)',
    chipOnBg: '#c9a96a', chipOnBd: '1px solid #c9a96a', chipOnText: '#1a1206',
    colorScheme: 'dark' as const,
  } : {
    panel: 'linear-gradient(120deg,#FCFCFB 0%,#F3F2EF 70%,#EFEBE2 130%)', border: '#E3E1DB',
    glow: 'radial-gradient(circle,rgba(176,141,79,.14),transparent 70%)', kicker: '#b08d4f',
    title: '#1C2433', count: '#8B97A6',
    fieldBg: '#ffffff', fieldBd: '1px solid #E3E1DB', fieldText: '#3C4656',
    searchText: '#1C2433', searchPh: 'placeholder-gray-400', icon: '#8B97A6',
    btnBg: 'linear-gradient(135deg,#1C2433,#0F1722)', btnText: '#fff', btnShadow: '0 4px 14px rgba(28,36,51,.25)',
    chipBd: '1px solid #E1E4EA', chipText: '#5B6B7E',
    chipOnBg: '#1C2433', chipOnBd: '1px solid #1C2433', chipOnText: '#fff',
    colorScheme: 'light' as const,
  };
  // Tile palette per theme
  const TL = isDark ? {
    scrim: 'linear-gradient(180deg, rgba(8,12,20,.05) 30%, rgba(8,12,20,.82) 78%, rgba(8,12,20,.93))',
    letterbox: '#0b0f17', ink: '#fff', meta: 'rgba(255,255,255,.8)', code: 'rgba(255,255,255,.75)',
    glass: { background: 'rgba(8,12,20,.55)', backdropFilter: 'blur(6px)', color: '#fff' } as any,
    fallback: TYPE_FALLBACK, border: 'border-gray-200', gold: '#c9a96a',
  } : {
    scrim: 'linear-gradient(180deg, rgba(255,255,255,0) 35%, rgba(255,255,255,.88) 75%, rgba(255,255,255,.96))',
    letterbox: '#E8E6E1', ink: '#1C2433', meta: '#5B6B7E', code: '#6A7077',
    glass: { background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(6px)', color: '#1C2433', border: '1px solid rgba(0,0,0,.07)' } as any,
    fallback: TYPE_FALLBACK_LIGHT, border: 'border-[#E3E1DB]', gold: '#b08d4f',
  };

  // Tile filters + sort: production type, project status, and ordering.
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'type' | 'status' | 'title'>('newest');
  const STATUS_ORDER = ['PRODUCTION', 'PRE_PRODUCTION', 'POST_PRODUCTION', 'DEVELOPMENT', 'DELIVERED', 'CANCELLED'];
  const activeItems = useMemo(() => {
    let list = items.filter((p: any) => p.status !== 'ARCHIVED');
    if (typeFilter) list = list.filter((p: any) => p.projectType === typeFilter);
    if (statusFilter) list = list.filter((p: any) => p.status === statusFilter);
    const by: Record<string, (a: any, b: any) => number> = {
      newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
      title: (a, b) => String(a.title).localeCompare(String(b.title)),
      type: (a, b) => String(a.projectType).localeCompare(String(b.projectType)) || String(a.title).localeCompare(String(b.title)),
      status: (a, b) => (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) || String(a.title).localeCompare(String(b.title)),
    };
    return [...list].sort(by[sortBy]);
  }, [items, typeFilter, statusFilter, sortBy]);
  const archivedItems = useMemo(() => items.filter((p: any) => p.status === 'ARCHIVED'), [items]);
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleArc = (id: string) => setSelectedArc(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const archiveSelected = async () => {
    if (!selected.size) return;
    if (!confirm(`Archive ${selected.size} project(s)? They stay intact and reversible — unarchive anytime from the Archived section.`)) return;
    setArchiving(true);
    try {
      const r = await productionApi.projects.bulkArchive([...selected]);
      alert(`Archived ${r.data.archived} project(s).`);
      setSelected(new Set()); setShowArchived(true); load();
    } catch (e: any) { alert(e.response?.data?.message || 'Bulk archive failed.'); }
    finally { setArchiving(false); }
  };
  const unarchiveIds = async (ids: string[]) => {
    if (!ids.length) return;
    setBulkBusy(true);
    try { await productionApi.projects.bulkUnarchive(ids); setSelectedArc(new Set()); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Unarchive failed.'); }
    finally { setBulkBusy(false); }
  };
  const deleteIds = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Permanently DELETE ${ids.length} archived project(s) and everything in them (budgets, ledger, schedule, crew)?\nThis cannot be undone.`)) return;
    setBulkBusy(true);
    try {
      const r = await productionApi.projects.bulkDelete(ids);
      const failed = (r.data.results || []).filter((x: any) => !x.ok);
      if (failed.length) {
        const protectedOnes = failed.filter((x: any) => String(x.error || '').includes('force=true'));
        let forced = 0;
        if (protectedOnes.length && confirm(`${failed.length} project(s) are protected (locked budgets / posted ledger).\n\nDelete them anyway?`)) {
          const rf = await productionApi.projects.bulkDelete(protectedOnes.map((x: any) => x.id), true);
          forced = rf.data.deleted || 0;
        }
        alert(`Deleted ${(r.data.deleted || 0) + forced} project(s).${failed.length - forced > 0 ? ` ${failed.length - forced} skipped.` : ''}`);
      }
      setSelectedArc(new Set()); load();
    } catch (e: any) { alert(e.response?.data?.message || 'Delete failed.'); }
    finally { setBulkBusy(false); }
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
      {/* ── Marquee header — theme-aware: Charcoal Black panel in dark, Graphite paper in light ── */}
      <div className="relative rounded-[20px] overflow-hidden mb-6" style={{ background: MQ.panel, border: `1px solid ${MQ.border}`, color: MQ.title }}>
        <div aria-hidden className="absolute pointer-events-none" style={{ right: -60, top: -80, width: 300, height: 300, borderRadius: '50%', background: MQ.glow }} />
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-center gap-3.5">
            <div>
              <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.22em', color: MQ.kicker }}>The Film Makers · Production Slate</div>
              <div className="text-[20px] font-extrabold leading-tight" style={{ color: MQ.title }}>Film Slate <span className="text-[11.5px] font-normal ml-1" style={{ color: MQ.count }}>{activeItems.length} active{archivedItems.length ? ` · ${archivedItems.length} archived` : ''}</span></div>
            </div>
            <span className="flex-1" />
            <button onClick={() => setShowForm(true)} className="rounded-xl px-4 py-2 text-[12.5px] font-bold cursor-pointer"
              style={{ background: MQ.btnBg, color: MQ.btnText, boxShadow: MQ.btnShadow }}>
              + New Project
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-xl px-3 py-2" style={{ background: MQ.fieldBg, border: MQ.fieldBd }}>
              <Search size={13} className="shrink-0" style={{ color: MQ.icon }} />
              <input className={`bg-transparent outline-none border-none text-[12.5px] flex-1 ${MQ.searchPh}`}
                style={{ color: MQ.searchText }}
                placeholder="Search title, number, client…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="rounded-xl px-2.5 py-2 text-[12px] outline-none" style={{ background: MQ.fieldBg, border: MQ.fieldBd, color: MQ.fieldText, colorScheme: MQ.colorScheme }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Status: All</option>
              {STATUSES.filter(s => s !== 'ARCHIVED').map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select className="rounded-xl px-2.5 py-2 text-[12px] outline-none" style={{ background: MQ.fieldBg, border: MQ.fieldBd, color: MQ.fieldText, colorScheme: MQ.colorScheme }}
              value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="newest">Sort: Newest</option><option value="type">Sort: Type</option>
              <option value="status">Sort: Status</option><option value="title">Sort: Title</option>
            </select>
            <button onClick={() => setShowArchived(v => !v)}
              className="rounded-xl px-3 py-2 text-[11.5px] cursor-pointer"
              style={{ border: MQ.fieldBd, color: showArchived ? MQ.kicker : MQ.count, background: showArchived ? 'rgba(176,141,79,.12)' : 'transparent' }}>
              🗂 Archived{archivedItems.length ? ` (${archivedItems.length})` : ''}
            </button>
            <button onClick={load} title="Refresh" className="rounded-xl p-2 cursor-pointer" style={{ border: MQ.fieldBd, color: MQ.count }}>
              <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[['', 'All'], ...PROJECT_TYPES.map(t => [t, TYPE_LABEL[t] || t])].map(([val, label]) => (
              <button key={val || 'all'} onClick={() => setTypeFilter(val as string)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold cursor-pointer transition-colors"
                style={typeFilter === val
                  ? { background: MQ.chipOnBg, border: MQ.chipOnBd, color: MQ.chipOnText }
                  : { background: 'transparent', border: MQ.chipBd, color: MQ.chipText }}>
                {label}
              </button>
            ))}
          </div>
        </div>
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

      {/* Contextual bulk action — appears only while tiles are selected */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <span className="text-xs text-gray-500 font-medium">{selected.size} selected</span>
          <span className="flex-1" />
          <button onClick={() => setSelected(new Set())} className="btn btn-secondary text-xs">Clear</button>
          <button onClick={archiveSelected} disabled={archiving} className="btn btn-primary text-xs whitespace-nowrap">
            {archiving ? 'Archiving…' : `Archive selected (${selected.size})`}
          </button>
        </div>
      )}

      {/* ── Project grid — cinematic poster tiles (Option A). No delete here: archive first. ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeItems.map((p: any) => {
          const t = (p.posterTransform || {}) as any;
          const chip = 'rounded-full px-2 py-0.5 text-[10.5px] font-semibold';
          return (
            <Link key={p.id} href={`/production/projects/${p.id}`}
              className={cn('group relative rounded-2xl overflow-hidden border min-h-[205px] flex flex-col justify-end shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all', TL.border, selected.has(p.id) && 'ring-2 ring-indigo-400')}
              style={{ color: TL.ink }}>
              {/* poster — framed exactly as saved in the editor (natural proportions on a
                  theme letterbox); unframed posters fall back to cover; no poster = gradient */}
              <div aria-hidden className="absolute inset-0" style={{ background: p.posterUrl ? TL.letterbox : undefined, backgroundImage: p.posterUrl ? undefined : (TL.fallback[p.projectType] || TL.fallback.OTHER) }} />
              {p.posterUrl && (p.posterTransform ? (
                <img src={assetUrl(p.posterUrl)} alt="" aria-hidden draggable={false} style={{
                  position: 'absolute', left: '50%', top: '50%', width: `${(Number(t.zoom) || 1) * 100}%`, height: 'auto', maxWidth: 'none',
                  transform: `translate(-50%, -50%) translate(${Number(t.x) || 0}%, ${Number(t.y) || 0}%) rotate(${Number(t.rot) || 0}deg)`,
                }} />
              ) : (
                <div aria-hidden className="absolute inset-0" style={{ backgroundImage: `url(${assetUrl(p.posterUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              ))}
              <div aria-hidden className="absolute inset-0" style={{ background: TL.scrim }} />
              {/* top chips */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <input type="checkbox" checked={selected.has(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer" title="Select for bulk archive" />
                <span className={chip} style={TL.glass}>{p.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {p.totalBudget ? <span className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold" style={TL.glass}>{formatCurrency(p.totalBudget)}</span> : null}
                <button title="Duplicate project" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDup(p); }}
                  className="rounded-lg p-1.5 opacity-80 hover:opacity-100" style={TL.glass}><Copy size={13} /></button>
              </div>
              {/* body */}
              <div className="relative p-4">
                <div className="text-[9.5px] tracking-[.08em]" style={{ color: TL.code }}>{p.projectNumber}</div>
                <div className="text-[14.5px] font-bold leading-tight" style={{ color: TL.ink, textShadow: isDark ? '0 1px 8px rgba(0,0,0,.4)' : 'none' }}>{p.title}</div>
                <div className="text-[9.5px] font-bold uppercase tracking-[.14em] mb-1.5" style={{ color: TL.gold }}>{TYPE_LABEL[p.projectType] || p.projectType.replace(/_/g, ' ')}</div>
                <div className="flex gap-3.5 text-[11px]" style={{ color: TL.meta }}>
                  {p.client && <span className="truncate max-w-[45%]">{p.client.companyName}</span>}
                  <span>{p._count?.crew || 0} crew</span>
                  {p.startDate && <span>{formatDate(p.startDate)}</span>}
                </div>
              </div>
            </Link>
          );
        })}
        {activeItems.length === 0 && !loading && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Film size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No projects yet. Create your first production project.</p>
          </div>
        )}
      </div>

      {/* ── Archived — the only place Delete exists ── */}
      {showArchived && archivedItems.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[12px] uppercase tracking-[.07em] text-gray-400 font-semibold mb-2">Archived · {archivedItems.length}</h2>
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-3">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input type="checkbox"
                checked={selectedArc.size === archivedItems.length && archivedItems.length > 0}
                onChange={(e) => setSelectedArc(e.target.checked ? new Set(archivedItems.map((p: any) => p.id)) : new Set())}
                className="w-4 h-4 accent-indigo-600" />
              Select all
            </label>
            <span className="text-xs text-gray-400">{selectedArc.size} of {archivedItems.length} selected</span>
            <span className="flex-1" />
            <button onClick={() => unarchiveIds([...selectedArc])} disabled={bulkBusy || !selectedArc.size}
              className="btn btn-primary text-xs disabled:opacity-40">⤴ Unarchive selected</button>
            <button onClick={() => deleteIds([...selectedArc])} disabled={bulkBusy || !selectedArc.size}
              className="btn text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 disabled:opacity-40">🗑 Delete selected</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedItems.map((p: any) => (
              <div key={p.id} className={cn('relative card', selectedArc.has(p.id) ? 'ring-2 ring-indigo-400' : 'opacity-75')}>
                <input type="checkbox" checked={selectedArc.has(p.id)} onChange={() => toggleArc(p.id)}
                  className="absolute top-3 right-3 w-4 h-4 accent-indigo-600 cursor-pointer" />
                <span className="badge text-xs bg-gray-100 text-gray-400">ARCHIVED</span>
                <Link href={`/production/projects/${p.id}`} className="block mt-2">
                  <p className="font-semibold text-gray-600 text-sm leading-tight">{p.title}</p>
                  <p className="text-[10px] uppercase tracking-[.12em] text-gray-400 font-bold mt-0.5">{TYPE_LABEL[p.projectType] || p.projectType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400 mt-1">{p.projectNumber}{p.client ? ` · ${p.client.companyName}` : ''}</p>
                </Link>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => unarchiveIds([p.id])} disabled={bulkBusy} className="btn btn-secondary text-xs">⤴ Unarchive</button>
                  <button disabled={bulkBusy} className="btn text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5"
                    onClick={async () => {
                      const typed = prompt(`Delete "${p.title}" and EVERYTHING in it (budgets, ledger, schedule, crew)?\nThis cannot be undone.\n\nType the project number to confirm: ${p.projectNumber}`);
                      if (typed !== p.projectNumber) { if (typed !== null) alert('Project number did not match — nothing deleted.'); return; }
                      try { await productionApi.projects.remove(p.id); load(); }
                      catch (err: any) {
                        const msg = err.response?.data?.message || 'Delete failed.';
                        if (msg.includes('force=true') && confirm(`${msg}\n\nDelete anyway?`)) {
                          try { await productionApi.projects.remove(p.id, true); load(); } catch (e2: any) { alert(e2.response?.data?.message || 'Delete failed.'); }
                        } else alert(msg);
                      }
                    }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
