'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { productionApi } from '@/lib/api';
import { FileText, Plus, Upload, Trash2, Loader2, ChevronLeft, Layers, MousePointer2, Highlighter, PenLine, Type, StickyNote, Tag, Eye, EyeOff, ArrowRightLeft, X, GitCompare, MapPin, Settings2, Lock, Scissors, Clapperboard } from 'lucide-react';
import { PanelHeader, StatRow, Btn, EmptyState, Chip } from './ui';
import ScriptViewer from './ScriptViewer';
import AnnotationOverlay, { type Tool } from './AnnotationOverlay';
import SidesGenerator from './SidesGenerator';
import LiningPanel from './LiningPanel';
import { useOfflineSync } from '@/lib/useOfflineSync';
import { cacheRevision, getCachedRevision, mergeCachedRevision, fetchPdfBytes } from '@/lib/script-offline';
import { assetUrl } from '@/lib/api';
import { Wifi, WifiOff, Download } from 'lucide-react';

const TOOLS: { key: Tool; icon: any; label: string }[] = [
  { key: 'CURSOR', icon: MousePointer2, label: 'Select' },
  { key: 'HIGHLIGHT', icon: Highlighter, label: 'Highlight' },
  { key: 'PEN', icon: PenLine, label: 'Pen' },
  { key: 'TEXT', icon: Type, label: 'Text' },
  { key: 'STICKY', icon: StickyNote, label: 'Sticky' },
  { key: 'TAG', icon: Tag, label: 'Tag' },
];

const inp = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-900 outline-none';
const REV_PRESETS = ['White', 'Blue', 'Pink', 'Yellow', 'Green', 'Goldenrod', 'Buff', 'Salmon', 'Cherry'];
const REV_COLOR: Record<string, string> = { White: '#e2e8f0', Blue: '#bfdbfe', Pink: '#fbcfe8', Yellow: '#fef08a', Green: '#bbf7d0', Goldenrod: '#fde68a', Buff: '#fed7aa', Salmon: '#fecaca', Cherry: '#fca5a5' };

export default function ScriptHubPanel({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [openDoc, setOpenDoc] = useState<any>(null);   // full document w/ revisions
  const [activeRev, setActiveRev] = useState<any>(null); // full revision w/ scenes + pdfUrl
  const [uploading, setUploading] = useState(false);
  const [revLabel, setRevLabel] = useState('White');
  const fileRef = useRef<HTMLInputElement>(null);

  // Annotation state (D2)
  const [layers, setLayers] = useState<any[]>([]);
  const [annos, setAnnos] = useState<any[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeLayerId, setActiveLayerId] = useState('');
  const [tool, setTool] = useState<Tool>('CURSOR');
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [compare, setCompare] = useState<any>(null); // { other, data } when compare modal open
  const [settingsLayer, setSettingsLayer] = useState<any>(null);
  const [sidesOpen, setSidesOpen] = useState(false);
  const [liningOpen, setLiningOpen] = useState(false);
  const [shares, setShares] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [shareDraft, setShareDraft] = useState<any>({ templateKey: '', department: '', access: 'VIEW' });

  useEffect(() => { productionApi.projects.permissionTemplates().then((r) => setTemplates(r.data || [])).catch(() => {}); }, []);

  // D7 — offline cache + write-queue
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | undefined>(undefined);
  const activeRevRef = useRef<any>(null);
  useEffect(() => { activeRevRef.current = activeRev; }, [activeRev]);
  const { online, pending, syncing, queueScriptAnnotation } = useOfflineSync(() => {
    const id = activeRevRef.current?.id;
    if (id) productionApi.scriptAnnotations.list(id).then((r) => setAnnos(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  });

  const load = useCallback(() => {
    setLoading(true);
    productionApi.script.list(projectId)
      .then((r) => setDocs(Array.isArray(r.data) ? r.data : []))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const createDoc = async () => {
    if (!title.trim()) return;
    const r = await productionApi.script.createDocument(projectId, { title });
    setTitle(''); setCreating(false); load();
    openDocument(r.data.id);
  };

  const openDocument = async (id: string) => {
    const r = await productionApi.script.getDocument(id);
    setOpenDoc(r.data);
    const active = (r.data.revisions || []).find((x: any) => x.id === r.data.activeRevisionId) || r.data.revisions?.[0];
    if (active) loadRevision(active.id);
    else setActiveRev(null);
  };
  const loadRevision = async (revId: string) => {
    if (online) {
      try {
        const r = await productionApi.script.getRevision(revId);
        setActiveRev(r.data); setPdfBytes(undefined);
        // Background-cache the PDF bytes for offline open.
        fetchPdfBytes(assetUrl(r.data.pdfUrl)).then((pdf) => cacheRevision({ revisionId: revId, documentId: r.data.documentId, revision: r.data, pdf, annotations: [], layers: [] }));
        return;
      } catch { /* fall through to cache */ }
    }
    const cached = await getCachedRevision(revId);
    if (cached) { setActiveRev(cached.revision); setPdfBytes(cached.pdf); setAnnos(cached.annotations || []); setLayers(cached.layers || []); }
    else if (!online) alert('This revision isn’t cached for offline use. Open it once while online.');
  };

  // Load layers (per document) + annotations (per revision)
  const loadLayers = useCallback(async (documentId: string) => {
    const r = await productionApi.scriptAnnotations.layers(documentId);
    const ls = Array.isArray(r.data) ? r.data : [];
    setLayers(ls);
    setActiveLayerId((cur) => cur || ls.find((l: any) => l.type === 'PERSONAL')?.id || ls[0]?.id || '');
  }, []);
  const loadAnnos = useCallback(async (revisionId: string) => {
    const r = await productionApi.scriptAnnotations.list(revisionId);
    setAnnos(Array.isArray(r.data) ? r.data : []);
  }, []);
  useEffect(() => { if (openDoc) loadLayers(openDoc.id); }, [openDoc, loadLayers]);
  useEffect(() => { if (activeRev) loadAnnos(activeRev.id); }, [activeRev, loadAnnos]);
  // Keep the offline cache fresh while online.
  useEffect(() => { if (online && activeRev) mergeCachedRevision(activeRev.id, { annotations: annos }); }, [annos, online, activeRev]);
  useEffect(() => { if (online && activeRev) mergeCachedRevision(activeRev.id, { layers }); }, [layers, online, activeRev]);

  const createAnno = async (a: any) => {
    if (!activeLayerId || !activeRev) { alert('Pick a layer first.'); return; }
    const base = { ...a, layerId: activeLayerId, revisionId: activeRev.id };
    if (!online) {
      // Offline — queue the write + optimistically render + update the cache.
      const id = await queueScriptAnnotation(base, `Note · p.${a.page}`);
      const next = [...annos, { id, ...base, layer: activeLayer, conflict: false }];
      setAnnos(next);
      mergeCachedRevision(activeRev.id, { annotations: next });
      return;
    }
    try {
      await productionApi.scriptAnnotations.create(base);
      loadAnnos(activeRev.id);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'You do not have edit access to this layer.');
    }
  };
  const deleteAnno = async (id: string) => { await productionApi.scriptAnnotations.remove(id); if (activeRev) loadAnnos(activeRev.id); };
  const toggleLayer = (id: string) => setHidden((h) => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const addLayer = async () => {
    const name = prompt('New layer name (e.g. Art Department)'); if (!name) return;
    await productionApi.scriptAnnotations.createLayer(openDoc.id, { name, type: 'DEPARTMENT', visibility: 'PROJECT', color: '#3b82f6' });
    loadLayers(openDoc.id);
  };
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const orphans = annos.filter((a) => a.conflict);
  const [exporting, setExporting] = useState(false);

  // D8 — export the currently-visible layers as a watermarked PDF.
  const exportPdf = async () => {
    if (!activeRev) return;
    const visibleLayerIds = layers.filter((l) => !hidden.has(l.id)).map((l) => l.id);
    setExporting(true);
    try {
      const r = await productionApi.scriptAnnotations.exportPdf(activeRev.id, visibleLayerIds);
      window.open(assetUrl(r.data.url), '_blank');
    } catch (e: any) { alert(e?.response?.data?.message || 'Export failed.'); }
    finally { setExporting(false); }
  };

  // D3 — transfer notes from the previous revision into the active one
  const prevRevision = () => {
    const revs = openDoc?.revisions || [];
    const idx = revs.findIndex((r: any) => r.id === activeRev?.id);
    return idx >= 0 && idx + 1 < revs.length ? revs[idx + 1] : null; // revisions are newest-first
  };
  const doTransfer = async () => {
    const prev = prevRevision();
    if (!prev || !activeRev) return;
    if (!confirm(`Transfer notes from "${prev.revisionLabel}" into "${activeRev.revisionLabel}"? Matched notes re-anchor to their text; unmatched land in the orphans tray.`)) return;
    const r = await productionApi.scriptAnnotations.transfer(prev.id, activeRev.id);
    await loadAnnos(activeRev.id);
    alert(`Transferred ${r.data.transferred}/${r.data.total} notes. ${r.data.orphaned} need manual placement.`);
  };
  const placeOrphanAt = async (id: string, pos: { page: number; x: number; y: number }) => {
    await productionApi.scriptAnnotations.placeOrphan(id, pos);
    setPlacingId(null);
    if (activeRev) loadAnnos(activeRev.id);
  };
  const openCompare = async (otherRevId: string) => {
    if (!activeRev) return;
    const other = (openDoc.revisions || []).find((r: any) => r.id === otherRevId);
    const r = await productionApi.scriptAnnotations.compare(otherRevId, activeRev.id);
    setCompare({ other, data: r.data });
  };

  // D4 — layer settings + shares
  const openSettings = async (layer: any) => {
    setSettingsLayer(layer);
    const r = await productionApi.scriptAnnotations.shares(layer.id);
    setShares(Array.isArray(r.data) ? r.data : []);
  };
  const saveLayerSettings = async (patch: any) => {
    const r = await productionApi.scriptAnnotations.updateLayer(settingsLayer.id, patch);
    setSettingsLayer({ ...settingsLayer, ...patch });
    loadLayers(openDoc.id);
  };
  const addShare = async () => {
    if (!shareDraft.templateKey && !shareDraft.department) return;
    await productionApi.scriptAnnotations.addShare(settingsLayer.id, shareDraft);
    setShareDraft({ templateKey: '', department: '', access: 'VIEW' });
    const r = await productionApi.scriptAnnotations.shares(settingsLayer.id); setShares(r.data || []);
  };
  const removeShare = async (id: string) => { await productionApi.scriptAnnotations.removeShare(id); setShares((s) => s.filter((x) => x.id !== id)); };

  const uploadRevision = async (file: File | null) => {
    if (!file || !openDoc) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('revisionLabel', revLabel);
      fd.append('colorCode', REV_COLOR[revLabel] || '');
      const r = await productionApi.script.addRevision(openDoc.id, fd);
      await openDocument(openDoc.id);
      setActiveRev(r.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Upload failed.');
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const setActive = async (revId: string) => { await productionApi.script.setActive(openDoc.id, revId); loadRevision(revId); };
  const removeDoc = async (id: string) => { if (!confirm('Delete this script and all revisions?')) return; await productionApi.script.removeDocument(id); setOpenDoc(null); load(); };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;

  // ── Binder view (a document is open) ──────────────────────────────────────────
  if (openDoc) {
    return (
      <div className="font-sans">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => { setOpenDoc(null); setActiveRev(null); }} className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-900"><ChevronLeft size={15} /></button>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{openDoc.title}</h3>
              <p className="text-[11px] text-slate-400">{openDoc.revisions?.length || 0} revision{openDoc.revisions?.length === 1 ? '' : 's'}</p>
            </div>
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`} title={online ? 'Online — changes sync live' : 'Offline — changes saved locally'}>
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? (syncing ? 'Syncing…' : 'Online') : 'Offline'}
              {pending > 0 && <span className="ml-0.5 font-semibold">· {pending} queued</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Version dropdown */}
            {openDoc.revisions?.length > 0 && (
              <select className={inp} value={activeRev?.id || ''} onChange={(e) => setActive(e.target.value)}>
                {openDoc.revisions.map((rv: any) => <option key={rv.id} value={rv.id}>{rv.revisionLabel} · {new Date(rv.createdAt).toLocaleDateString('en-GB')}</option>)}
              </select>
            )}
            <select className={inp} value={revLabel} onChange={(e) => setRevLabel(e.target.value)}>
              {REV_PRESETS.map((c) => <option key={c} value={c}>{c} pages</option>)}
            </select>
            {prevRevision() && <Btn variant="secondary" onClick={doTransfer} title="Re-anchor notes from the previous revision"><ArrowRightLeft size={13} /> Transfer notes</Btn>}
            {(openDoc.revisions?.length || 0) > 1 && (
              <select className={inp} value="" onChange={(e) => e.target.value && openCompare(e.target.value)}>
                <option value="">Compare with…</option>
                {openDoc.revisions.filter((r: any) => r.id !== activeRev?.id).map((r: any) => <option key={r.id} value={r.id}>{r.revisionLabel}</option>)}
              </select>
            )}
            {activeRev && <Btn variant="secondary" onClick={exportPdf} disabled={exporting} title="Export your visible layers as a watermarked PDF">{exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export</Btn>}
            {activeRev && <Btn variant="secondary" onClick={() => setLiningOpen(true)} title="Script-supervisor lining + Hot Cost"><Clapperboard size={13} /> Lining</Btn>}
            {activeRev && <Btn variant="secondary" onClick={() => setSidesOpen(true)} title="Generate sides for a shoot day"><Scissors size={13} /> Sides</Btn>}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => uploadRevision(e.target.files?.[0] || null)} />
            <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload revision</Btn>
          </div>
        </div>
        {sidesOpen && activeRev && <SidesGenerator projectId={projectId} revision={activeRev} onClose={() => setSidesOpen(false)} />}
        {liningOpen && activeRev && <LiningPanel projectId={projectId} revision={activeRev} onClose={() => setLiningOpen(false)} />}

        {activeRev ? (
          <>
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
              <Chip tone="slate"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: activeRev.colorCode || '#e2e8f0' }} />{activeRev.revisionLabel}</Chip>
              <span>{activeRev.pageCount} pages</span>
              <span>· {activeRev.scenes?.length || 0} scenes</span>
              <span>· {annos.length} notes</span>
              {orphans.length > 0 && <Chip tone="risk">{orphans.length} orphan{orphans.length === 1 ? '' : 's'}</Chip>}
            </div>

            {/* Orphans tray (D3) — transferred notes that lost their text */}
            {orphans.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 mb-3">
                <p className="text-xs font-semibold text-amber-800 mb-1.5 inline-flex items-center gap-1"><MapPin size={13} /> {orphans.length} note{orphans.length === 1 ? '' : 's'} need placement {placingId && '— click on the page to drop the armed note'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {orphans.map((o) => (
                    <button key={o.id} onClick={() => setPlacingId((p) => p === o.id ? null : o.id)}
                      className={`text-[11px] px-2 py-1 rounded-lg border ${placingId === o.id ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-amber-200 bg-white text-amber-700 hover:border-amber-400'}`}>
                      {o.tool === 'TAG' || o.tool === 'TEXT' || o.tool === 'STICKY' ? (o.payload?.text || o.tool) : (o.anchorText?.slice(0, 28) || o.tool)} <span className="text-amber-400">· p.{o.page}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <ScriptViewer
                  pdfUrl={activeRev.pdfUrl}
                  pdfData={pdfBytes}
                  scenes={activeRev.scenes || []}
                  renderOverlay={(ctx) => (
                    <AnnotationOverlay
                      ctx={ctx}
                      annotations={annos.filter((a) => a.page === ctx.page && !a.conflict)}
                      tool={tool}
                      color={activeLayer?.color || '#eab308'}
                      layerVisible={(lid) => !hidden.has(lid)}
                      onCreate={createAnno}
                      onDelete={deleteAnno}
                      placingId={placingId}
                      onPlace={placeOrphanAt}
                    />
                  )}
                />
              </div>

              {/* Right rail — tools + layers */}
              <div className="w-48 shrink-0 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Tools</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TOOLS.map((t) => (
                      <button key={t.key} onClick={() => setTool(t.key)} title={t.label}
                        className={`aspect-square rounded-lg border flex items-center justify-center ${tool === t.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                        <t.icon size={15} />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Double-click a note to delete it.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Layers</p>
                    <button onClick={addLayer} className="text-slate-400 hover:text-slate-900"><Plus size={13} /></button>
                  </div>
                  <div className="space-y-1">
                    {layers.map((l) => (
                      <div key={l.id} className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${activeLayerId === l.id ? 'bg-slate-100' : ''}`}>
                        <button onClick={() => toggleLayer(l.id)} className="text-slate-400 hover:text-slate-700">{hidden.has(l.id) ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                        <button onClick={() => setActiveLayerId(l.id)} className="flex-1 text-left text-xs truncate inline-flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                          <span className={activeLayerId === l.id ? 'font-medium text-slate-900' : 'text-slate-600'}>{l.name}</span>
                        </button>
                        {l.type === 'EXEC' || l.visibility !== 'PROJECT' ? <Lock size={10} className="text-slate-300" /> : <span className="text-[9px] text-slate-300">shared</span>}
                        <button onClick={() => openSettings(l)} className="text-slate-300 hover:text-slate-700"><Settings2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">New notes go to the <b>{activeLayer?.name || '—'}</b> layer.</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={Upload}>No revision uploaded yet. Pick a revision color and upload the script PDF.</EmptyState>
        )}

        {/* Layer settings + shares modal (D4) */}
        {settingsLayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setSettingsLayer(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <h2 className="font-semibold text-sm inline-flex items-center gap-2"><Settings2 size={16} /> Layer · {settingsLayer.name}</h2>
                <button onClick={() => setSettingsLayer(null)}><X size={18} /></button>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">Type</label>
                    <select className={`${inp} w-full`} value={settingsLayer.type} onChange={(e) => saveLayerSettings({ type: e.target.value })}>
                      {['PERSONAL', 'DEPARTMENT', 'MEETING', 'SCRIPT_SUPE', 'EXEC'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Visibility</label>
                    <select className={`${inp} w-full`} value={settingsLayer.visibility} onChange={(e) => saveLayerSettings({ visibility: e.target.value })}>
                      <option value="PRIVATE">Private (me)</option>
                      <option value="SHARED_ROLE">Shared with roles/depts</option>
                      <option value="PROJECT">Whole project</option>
                    </select>
                  </div>
                </div>
                {settingsLayer.type === 'EXEC' && <p className="text-[11px] text-rose-600 inline-flex items-center gap-1"><Lock size={11} /> Exec layers are visible only to Producers / Line Producers.</p>}

                {settingsLayer.visibility === 'SHARED_ROLE' && (
                  <div>
                    <label className="text-[11px] text-slate-400">Shared with</label>
                    <div className="space-y-1 mt-1">
                      {shares.length === 0 && <p className="text-[11px] text-slate-400">No grants yet — add a role or department below.</p>}
                      {shares.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 px-2 py-1">
                          <span className="flex-1">{s.templateKey ? (templates.find((t) => t.key === s.templateKey)?.name || s.templateKey) : ''}{s.templateKey && s.department ? ' · ' : ''}{s.department || ''}</span>
                          <Chip tone={s.access === 'EDIT' ? 'money' : 'slate'}>{s.access}</Chip>
                          <button onClick={() => removeShare(s.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <select className={`${inp} flex-1`} value={shareDraft.templateKey} onChange={(e) => setShareDraft({ ...shareDraft, templateKey: e.target.value })}>
                        <option value="">— role —</option>
                        {templates.map((t) => <option key={t.id} value={t.key}>{t.name}</option>)}
                      </select>
                      <input className={`${inp} w-24`} placeholder="dept" value={shareDraft.department} onChange={(e) => setShareDraft({ ...shareDraft, department: e.target.value })} />
                      <select className={inp} value={shareDraft.access} onChange={(e) => setShareDraft({ ...shareDraft, access: e.target.value })}>
                        <option value="VIEW">View</option><option value="EDIT">Edit</option>
                      </select>
                      <button onClick={addShare} className="p-1.5 rounded-lg bg-slate-900 text-white"><Plus size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compare Scripts modal (D3) */}
        {compare && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setCompare(null)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="font-semibold text-sm inline-flex items-center gap-2"><GitCompare size={16} /> {compare.other?.revisionLabel} → {activeRev?.revisionLabel}</h2>
                <button onClick={() => setCompare(null)}><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Chip tone="money">+{compare.data.summary.added} added</Chip>
                  <Chip tone="risk">−{compare.data.summary.removed} removed</Chip>
                  <Chip tone="link">{compare.data.summary.moved} moved</Chip>
                  <Chip tone="need">{compare.data.summary.reworded} reworded</Chip>
                  <Chip tone="slate">{compare.data.summary.unchanged} unchanged</Chip>
                </div>
                {[['Added', compare.data.added, 'text-emerald-700'], ['Removed', compare.data.removed, 'text-rose-700'], ['Moved', compare.data.moved, 'text-blue-700'], ['Reworded', compare.data.reworded, 'text-amber-700']].map(([label, rows, cls]: any) => (
                  rows.length > 0 && (
                    <div key={label}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${cls}`}>{label}</p>
                      <div className="space-y-0.5">
                        {rows.map((r: any, i: number) => (
                          <div key={i} className="text-xs text-slate-600">
                            <span className="text-slate-400">{r.sceneNumber || '•'}</span>{' '}
                            {label === 'Reworded' ? <>{r.from} → <b>{r.to}</b></> : label === 'Moved' ? <>{r.slugline} <span className="text-slate-400">p.{r.fromPage}→{r.toPage}</span></> : <>{r.slugline} <span className="text-slate-400">p.{r.page}</span></>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Document list ─────────────────────────────────────────────────────────────
  return (
    <div className="font-sans">
      <PanelHeader
        icon={FileText}
        title="Script & document hub"
        subtitle="Upload script revisions, browse scenes, and (next slices) annotate, transfer notes, generate sides."
        actions={<Btn variant="primary" onClick={() => setCreating((c) => !c)}><Plus size={13} /> New script</Btn>}
      />

      {creating && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 mb-3 flex items-center gap-2">
          <input className={`${inp} flex-1`} placeholder="Script title (e.g. Episode 101)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Btn variant="primary" onClick={createDoc} disabled={!title.trim()}>Create</Btn>
          <Btn variant="secondary" onClick={() => setCreating(false)}>Cancel</Btn>
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState icon={FileText}>No scripts yet. Create one, then upload its PDF revision.</EmptyState>
      ) : (
        <>
          <StatRow stats={[['Scripts', docs.length], ['Revisions', docs.reduce((t, d) => t + (d.revisions?.length || 0), 0)]]} />
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 flex items-center gap-3 hover:border-slate-300">
                <FileText size={18} className="text-slate-400 shrink-0" />
                <button onClick={() => openDocument(d.id)} className="flex-1 text-left min-w-0">
                  <span className="font-medium text-slate-800">{d.title}</span>
                  <span className="block text-[11px] text-slate-400 flex items-center gap-1"><Layers size={11} /> {d.revisions?.length || 0} revision{d.revisions?.length === 1 ? '' : 's'}
                    {d.revisions?.[0] && <> · latest {d.revisions[0].revisionLabel}</>}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  {(d.revisions || []).slice(0, 5).map((rv: any) => <span key={rv.id} title={rv.revisionLabel} className="inline-block w-3 h-3 rounded-full border border-slate-200" style={{ background: rv.colorCode || '#e2e8f0' }} />)}
                </div>
                <button onClick={() => removeDoc(d.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
