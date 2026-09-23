'use client';
/** ScriptON Doctor — Script Library route /scripton/library. Slate ⇄ masterScriptApi.list; real add on-ramp. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { masterScriptApi, productionApi, uploadFile } from '@/lib/api';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import ScriptOnLibrary, { SxCard } from '@/components/scripton/ScriptOnLibrary';
import { useViewport } from '@/components/scripton/useViewport';
import { useLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import ScriptonShell from '@/components/scripton/ScriptonShell';

const COVERS = ['linear-gradient(150deg,#243046,#141821)', 'linear-gradient(150deg,#3a2730,#151016)', 'linear-gradient(150deg,#2a1f2e,#120f15)', 'linear-gradient(150deg,#3a2336,#15101a)', 'linear-gradient(150deg,#262046,#131020)', 'linear-gradient(150deg,#332c1c,#151209)', 'linear-gradient(150deg,#1f3329,#101713)'];
const typeColor = (t: string) => { const u = t.toUpperCase(); return /SERIES|PILOT/.test(u) ? '#c3b6f5' : /TVC|COMMERCIAL/.test(u) ? 'var(--gold2)' : /VERTICAL|MICRO/.test(u) ? '#e7a6c6' : /HORROR/.test(u) ? '#f0a3a0' : /ADAPT/.test(u) ? '#9fe3c0' : '#a9c4f7'; };
const gradeColor = (g: string) => { const u = (g || '').toUpperCase(); return u === 'RECOMMEND' ? 'var(--green)' : u === 'CONSIDER' ? 'var(--amber)' : u === 'PASS' ? 'var(--red)' : 'var(--faint)'; };
const rel = (d?: string) => { if (!d) return ''; const t = new Date(d).getTime(); if (!t) return ''; const days = Math.round((Date.now() - t) / 86400000); return days <= 0 ? 'today' : days === 1 ? '1d' : days < 7 ? days + 'd' : days < 30 ? Math.round(days / 7) + 'w' : new Date(d).toLocaleDateString(); };
const FILTERS = ['All', 'Features', 'Series', 'Commercials', 'Vertical', 'Adaptations'];
const matchFilter = (f: string, type: string) => { if (f === 'All') return true; const u = type.toUpperCase(); return f === 'Features' ? /FEATURE|HORROR|DRAMA|FILM/.test(u) || (!/SERIES|TVC|COMMERCIAL|VERTICAL|ADAPT/.test(u)) : f === 'Series' ? /SERIES|PILOT/.test(u) : f === 'Commercials' ? /TVC|COMMERCIAL/.test(u) : f === 'Vertical' ? /VERTICAL|MICRO/.test(u) : f === 'Adaptations' ? /ADAPT/.test(u) : true; };

const SAMPLE: SxCard[] = [
  { id: 's1', title: 'Midnight Run', type: 'FEATURE', typeColor: '#a9c4f7', rev: 'BLUE v4', revColor: '#5b8def', pages: '111 pp', grade: 'CONSIDER', gradeColor: 'var(--amber)', updated: '2h', cover: COVERS[0] },
  { id: 's2', title: 'The Pulpit', type: 'FEATURE', typeColor: '#a9c4f7', rev: 'WHITE', revColor: '#cfd3da', pages: '119 pp', grade: 'CONSIDER', gradeColor: 'var(--amber)', updated: '3d', cover: COVERS[1] },
  { id: 's3', title: 'Virulent', type: 'HORROR', typeColor: '#f0a3a0', rev: 'WHITE', revColor: '#cfd3da', pages: '101 pp', grade: 'PASS', gradeColor: 'var(--red)', updated: '1w', cover: COVERS[2] },
  { id: 's4', title: 'Layla · Ep 1-8', type: 'VERTICAL', typeColor: '#e7a6c6', rev: 'DRAFT', revColor: '#9aa1ab', pages: '8×90s', grade: '—', gradeColor: 'var(--faint)', updated: 'today', cover: COVERS[3] },
  { id: 's5', title: 'Oryx (Pilot)', type: 'SERIES', typeColor: '#c3b6f5', rev: 'PINK', revColor: '#d6649a', pages: '58 pp', grade: 'RECOMMEND', gradeColor: 'var(--green)', updated: '5d', cover: COVERS[4] },
  { id: 's6', title: 'Sand & Glass', type: 'TVC', typeColor: 'var(--gold2)', rev: 'v2', revColor: 'var(--gold)', pages: ':60 / :30', grade: '—', gradeColor: 'var(--faint)', updated: '2d', cover: COVERS[5] },
  { id: 's7', title: 'A Long Way', type: 'ADAPTATION', typeColor: '#9fe3c0', rev: 'DRAFT', revColor: '#9aa1ab', pages: '92 pp', grade: '—', gradeColor: 'var(--faint)', updated: '6h', cover: COVERS[6] },
];

export default function ScriptOnLibraryPage() {
  const router = useRouter();
  const vp = useViewport();
  const { dir, t } = useLocale();
  const onBack = useScriptonBack();
  const [cards, setCards] = useState<SxCard[]>(SAMPLE);
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [docIds, setDocIds] = useState<Set<string>>(new Set());
  const [buildIds, setBuildIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'active' | 'archived' | 'bin'>('active');
  // EMPTY AND ERROR ARE DIFFERENT STATES. A failed load sets this; it is never rendered as an
  // empty shelf, because "nothing here" and "we could not look" are opposite facts.
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** The documents as the server sent them — the cards are a display shape and drop deletedAt,
   *  which the bin's countdown needs. */
  const [raw, setRaw] = useState<any[]>([]);
  /** DEFECT 2's guard, copied from ScriptOnBuildsPanel:208-216. setView applies immediately while
   *  setCards waits on the await, so without this the bin's Delete forever renders over live
   *  scripts for the length of the request, and a slow first response can land after a fast
   *  second one. */
  const reqRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [conf, setConf] = useState<any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3600); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r: any = await masterScriptApi.list();
        const d = r?.data; const list: any[] = Array.isArray(d) ? d : (d?.items ?? d?.scripts ?? []);
        if (alive && list.length) setCards(list.map((m: any, i: number): SxCard => {
          const type = String(m.genre || m.format || m.type || m.projectType || 'Feature');
          const latest = (m.revisions || [])[0] || {};
          const rec = m.coverageRecommendation || m.recommendation || '';
          return {
            id: m.id || ('m' + i), title: m.title || m.name || 'Untitled',
            type: type.toUpperCase().slice(0, 12), typeColor: typeColor(type),
            rev: (latest.revisionLabel || m.status || 'DRAFT').toString().toUpperCase().slice(0, 10), revColor: latest.colorCode || '#9aa1ab',
            pages: (m.pageCount || latest.pageCount) ? `${m.pageCount || latest.pageCount} pp` : '—',
            grade: rec || '—', gradeColor: gradeColor(rec), updated: rel(m.updatedAt || m.createdAt), cover: COVERS[i % COVERS.length],
          };
        }));
      } catch { /* keep sample */ }
      // SCOPING RULE — the slate is the EVERYTHING view, by design, and the panel is the one-project
      // view. Written down because the two surfaces disagree on purpose and nothing said so, which is
      // how an unscoped call read as a bug for a whole evening. Consequence worth knowing: this is the
      // only screen where two builds of the same name from different projects sit side by side.
      // Unify the pool: every ScriptON DevelopmentBuild (new-OS work — Studio ideas, vertical AI video, etc.)
      // shows in the SAME slate as the old master-script library. listBuilds() with no projectId returns the
      // whole build pool (workspace + every project), so old and new always live together.
      try {
        const br: any = await productionApi.scripton.development.listBuilds();
        const bl: any[] = Array.isArray(br.data) ? br.data : (br.data?.items ?? []);
        if (alive && bl.length) {
          const bcards: SxCard[] = bl.map((b: any, i: number): SxCard => {
            const brief = b.brief || {};
            const type = String(brief.projectType || brief.format || brief.family || 'BUILD');
            return {
              id: b.id, title: b.name || 'Untitled build',
              type: type.toUpperCase().slice(0, 12), typeColor: typeColor(type),
              rev: String(b.status || 'DRAFT').toUpperCase().slice(0, 10), revColor: '#C6A463',
              pages: '—', grade: '—', gradeColor: 'var(--faint)',
              updated: rel(b.updatedAt || b.createdAt), cover: COVERS[i % COVERS.length],
            };
          });
          setBuildIds(new Set(bcards.map((c) => c.id)));
          setCards((prev) => { const base = (prev === SAMPLE) ? [] : prev; const ids = new Set(bcards.map((c) => c.id)); return [...bcards, ...base.filter((c) => !ids.has(c.id))]; });
        }
      } catch { /* no builds yet */ }
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriptonProject(projects);
        if (alive && proj?.id) {
          setProjectId(proj.id);
          try {
            const sr: any = await productionApi.script.list(proj.id);
            const sdocs: any[] = Array.isArray(sr.data) ? sr.data : (sr.data?.items ?? []);
            if (alive && sdocs.length) {
              const dev: SxCard[] = sdocs.map(toCard);

              setDocIds(new Set(dev.map((d) => d.id)));
              setCards((prev) => { const base = (prev === SAMPLE) ? [] : prev; const ids = new Set(dev.map((d) => d.id)); return [...dev, ...base.filter((c) => !ids.has(c.id))]; });
            }
          } catch { /* no developed scripts */ }
        }
      } catch { /* no project bound */ }
    })();
    return () => { alive = false; };
  }, []);

  const doImport = async (file?: File | null) => {
    if (!file) return;
    if (!projectId) { setAdding(false); router.push('/production/projects'); return; }
    setBusy(true); flash(t('Uploading script…'));
    try {
      const up = await uploadFile(file);
      flash(t('Breaking down (AI)…'));
      await productionApi.breakdown.importScriptFull(projectId, { fileUrl: up.url, originalName: up.originalName, pagesPerDay: 5 });
      flash(t('Script imported + broken down. Reloading…'));
      setTimeout(() => window.location.reload(), 700);
    } catch (e: any) {
      flash(e?.response?.data?.message || t('Import failed — needs the backend on :3001 and an AI key for breakdown.'));
    } finally { setBusy(false); setAdding(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    // One card per document (dedupe by id) so a script never renders twice — keeps web and
    // tablet/mobile showing the same set. (Distinct documents stay distinct; data-level
    // duplicate docs are cleaned up separately.)
    const seen = new Set<string>();
    return cards.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return matchFilter(activeFilter, c.type) && (!q || c.title.toLowerCase().includes(q));
    });
  }, [cards, activeFilter, search]);

  const onNav = (k: string) => {
    if (k === 'library') return;
    if (k === 'settings') return router.push('/scripton/settings');
    if (k === 'home') return router.push('/scripton');
    if (k === 'reader') return router.push('/scripton/reader');
    if (k === 'breakdown') return router.push('/scripton/breakdown');
    if (k === 'doctor') return router.push('/scripton/doctor');
    if (k === 'schedule') return router.push('/scripton/schedule');
    if (k === 'reports') return router.push('/scripton/reports');
    if (k === 'coverage') return router.push('/scripton/doctor');
    if (k === 'studio') return router.push('/scripton/studio');
    if (k === 'greenlight') return router.push('/scripton/greenlight');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  /** ONE card shape, used by the first load and by every view reload — lifted out of the effect
   *  so the two cannot drift. Body unchanged from the inline version it replaces. */
  const toCard = (m: any, i: number): SxCard => {
                const latest = (m.revisions || [])[0] || {};
                const type = String(m.kind || 'SCRIPT');
                return {
                  id: m.id || ('d' + i), title: m.title || 'Untitled',
                  type: (type === 'SCRIPT' ? 'FEATURE' : type).toUpperCase().slice(0, 12), typeColor: typeColor(type),
                  rev: String(m.activeRevisionLabel || latest.revisionLabel || 'WHITE').toUpperCase().slice(0, 10), revColor: latest.colorCode || '#cfd3da',
                  pages: (m.pageCount || latest.pageCount) ? ((m.pageCount || latest.pageCount) + ' pp') : '\u2014',
                  grade: '\u2014', gradeColor: 'var(--faint)', updated: rel(m.updatedAt || m.createdAt), cover: COVERS[i % COVERS.length],
                };
              };

  /** Load the view being looked at. Every action calls this, so the board a user is on is the
   *  board that refreshes — not always the active one. */
  const loadView = async (pid: string, v: 'active' | 'archived' | 'bin') => {
    const token = ++reqRef.current;
    const live = () => mountedRef.current && token === reqRef.current;
    setLoading(true); setLoadErr(null);
    try {
      const sr: any = await productionApi.script.list(pid, v);
      if (!live()) return;
      const sdocs: any[] = Array.isArray(sr.data) ? sr.data : (sr.data?.items ?? []);
      const docs = sdocs.map(toCard);
      setDocIds(new Set(sdocs.map((m: any) => m.id)));
      setRaw(sdocs);
      // DEFECT 1. The mount effect MERGES: the slate is documents (:122) PLUS development builds
      // (:106) PLUS master scripts (:66). Replacing wholesale dropped everything that was not a
      // document until a page reload.
      //
      // THE PREDICATE SUBTRACTS DOCUMENTS RATHER THAN ENUMERATING SOURCES. `docIds` here is the
      // PRE-update set — setDocIds has been called but this closure still holds the old one — so a
      // card that WAS a document and is absent from the new list has left the active view and
      // goes; anything that was never a document stays. A master script is a different entity from
      // a script document (master-script.service.ts:147 linkToProject creates the document with a
      // fresh id, so the ids never coincide), and naming the sources is what dropped them: the
      // next source added would be dropped too.
      //
      // Archived and bin replace outright — they are DOCUMENT views, and a build or a master
      // script has no business on a script bin.
      if (v === 'active') {
        setCards((prev) => {
          const base = (prev === SAMPLE) ? [] : prev;
          const ids = new Set(docs.map((d) => d.id));
          return [...docs, ...base.filter((c) => !ids.has(c.id) && !docIds.has(c.id))];
        });
      } else {
        setCards(docs);
      }
    } catch (e: any) {
      if (!live()) return;
      // The server's own words, not a generic toast — a refused action must say what refused it.
      setLoadErr(e?.response?.data?.message || t('The scripts could not be loaded.'));
      setCards([]); setDocIds(new Set()); setRaw([]);
    } finally { if (live()) setLoading(false); }
  };
  /** DEFECT 3. The chips are hidden on archived and bin, but activeFilter and search still filter
   *  `shown` — so "Bin is empty" could render over a bin that is not, with the cause invisible.
   *  ScriptOnBuildsPanel:224 resets the filter on switch; the search is cleared for the same
   *  reason. */
  const switchView = (v: 'active' | 'archived' | 'bin') => {
    setView(v); setActiveFilter('All'); setSearch('');
    if (projectId) void loadView(projectId, v);
  };
  const reload = () => { if (projectId) void loadView(projectId, view); };
  /** One place for every action: run it, say what the server said if it refuses, reload THIS view. */
  const act = async (fn: () => Promise<any>, okMsg: string, failMsg: string) => {
    try { await fn(); flash(t(okMsg)); reload(); }
    catch (e: any) { flash(e?.response?.data?.message || t(failMsg)); }
  };

  const binDaysLeft = (d?: string) => { if (!d) return 30; const ms = new Date(d).getTime() + 30 * 86400000 - Date.now(); return Math.max(0, Math.ceil(ms / 86400000)); };
  const onCardDelete = (id: string) => { const c = cards.find((x) => x.id === id); setConf({ kind: 'delete', id, title: c ? c.title : t('this script') }); };
  const doRestore = (id: string) => act(() => productionApi.script.restore(id), 'Restored.', 'Restore failed.');
  const doArchive = (id: string) => act(() => productionApi.script.archive(id), 'Archived.', 'Archive failed.');
  const doUnarchive = (id: string) => act(() => productionApi.script.unarchive(id), 'Back on the board.', 'Unarchive failed.');
  /** The only confirmed actions: Move to bin (reversible but a countdown starts) and Delete
   *  forever (irreversible). Both reload the view being looked at, and a refusal shows what the
   *  server said rather than a generic shrug. */
  const doConf = async () => {
    const c = conf; setConf(null); if (!c) return;
    if (c.kind === 'purge') await act(() => productionApi.script.remove(c.id), 'Deleted forever.', 'Delete failed.');
    else await act(() => productionApi.script.trash(c.id), 'Moved to bin.', 'Action failed.');
  };
  const common = { meta: `${shown.length} ${t('scripts across the slate')}`, filters: FILTERS, activeFilter, onFilter: setActiveFilter, search, onSearch: setSearch, cards: shown, onOpen: (id: string) => router.push(buildIds.has(id) ? ('/scripton/studio?build=' + id) : docIds.has(id) ? ('/scripton/package?doc=' + id) : '/scripton/reader'), onNew: () => setAdding(true), onNav, onBack, toast, onDelete: onCardDelete, canDelete: (id: string) => docIds.has(id),
    view, onView: switchView, error: loadErr, onRetry: reload, loading,
    filtering: activeFilter !== 'All' || !!search.trim(),
    onClearFilters: () => { setActiveFilter('All'); setSearch(''); },
    onArchive: doArchive, onUnarchive: doUnarchive, onRestore: doRestore,
    onPurge: (id: string) => { const c = cards.find((x) => x.id === id); setConf({ kind: 'purge', id, title: c ? c.title : t('this script') }); },
    daysLeft: (c: SxCard) => { const d = raw.find((x: any) => x.id === c.id); return d ? (binDaysLeft(d.deletedAt) + t('d left in bin')) : null; } };
  // Legacy viewport library twins retired — the new shell serves every viewport (desktop-only OS).

  const aBtn: React.CSSProperties = { width: '100%', textAlign: 'start', background: 'rgba(198,164,99,0.14)', color: '#C6A463', border: '1px solid rgba(198,164,99,0.30)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, cursor: 'pointer', marginTop: 8 };
  const aGhost: React.CSSProperties = { ...aBtn, background: 'transparent', color: '#E8E6E0' };

  return (
    <>
      <ScriptonShell screen="slate" active="slate" vp={vp} onBack={onBack} onNav={onNav} topbar={{ scriptScoped: false }}>
        <ScriptOnLibrary {...common} embedded />
      </ScriptonShell>
      <input ref={fileRef} type="file" accept=".pdf,.fdx,.fountain,.txt,.docx" style={{ display: 'none' }} onChange={(e) => doImport(e.target.files?.[0])} />
      {conf && (
        <div onClick={() => setConf(null)} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 74, background: 'rgba(6,7,10,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--sx-body)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '100%', background: '#0e1014', border: '1px solid rgba(198,164,99,0.30)', borderRadius: 16, padding: 18, color: '#E8E6E0' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#E6D2A2', marginBottom: 6 }}>{conf.kind === 'purge' ? t('Delete forever?') : t('Move to bin?')}</div>
            <div style={{ fontSize: 12.5, color: '#9aa1ab', lineHeight: 1.5, marginBottom: 14 }}>{conf.kind === 'purge' ? '\u201c' + conf.title + '\u201d ' + t('will be permanently deleted. This cannot be undone.') : '\u201c' + conf.title + '\u201d ' + t('moves to the bin and is permanently deleted after 30 days unless you restore it.')}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button onClick={() => setConf(null)} style={{ background: '#1b1e25', border: '1px solid rgba(255,255,255,0.12)', color: '#E8E6E0', borderRadius: 9, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>{t('Cancel')}</button><button onClick={doConf} style={{ background: conf.kind === 'purge' ? 'linear-gradient(180deg,#f08a86,#e5635f)' : 'linear-gradient(180deg,#E6D2A2,#C6A463)', border: 'none', color: conf.kind === 'purge' ? '#2a0f0e' : '#15120B', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{conf.kind === 'purge' ? t('Delete forever') : t('Move to bin')}</button></div>
          </div>
        </div>
      )}
      {adding && (
        <div onClick={() => !busy && setAdding(false)} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(6,7,10,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--sx-body)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 390, maxWidth: '100%', background: '#0e1014', border: '1px solid rgba(198,164,99,0.30)', borderRadius: 16, padding: 18, color: '#E8E6E0', boxShadow: '0 24px 70px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#E6D2A2' }}>{t('Add a script')}</div>
              <button onClick={() => setAdding(false)} style={{ background: 'transparent', border: 'none', color: '#8b8f98', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: 11.5, color: '#8b8f98', marginBottom: 6, lineHeight: 1.5 }}>{projectId ? t('Import drops the script into your connected project and breaks it down.') : t('No project connected — New project opens the full form (attach a script there).')}</div>
            <button disabled={busy} onClick={() => fileRef.current?.click()} style={{ ...aBtn, opacity: busy ? 0.6 : 1 }}>{busy ? t('Working…') : '↧  ' + t('Import a script (FDX · Fountain · Word · PDF)')}</button>
            <button onClick={() => { setAdding(false); router.push('/production/projects'); }} style={aGhost}>+  {t('New project (full form)')}</button>
            <button onClick={() => { setAdding(false); router.push('/scripton/studio'); }} style={aGhost}>✦  {t('Develop a new idea (seed → script)')}</button>
            {toast && <div style={{ fontSize: 11.5, color: '#C6A463', marginTop: 10 }}>{toast}</div>}
          </div>
        </div>
      )}
    </>
  );
}
