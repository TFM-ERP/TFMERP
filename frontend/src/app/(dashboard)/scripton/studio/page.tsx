'use client';
/** ScriptON Studio route. Develop = persisted pipeline (D1–D6); Adapt → directions → seed; Format. */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveStudioView } from './studio-view.logic';
import { productionApi, approvalsApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { resolveScriptonProjectId } from '@/components/scripton/useScriptonProject';
import ScriptOnStudio from '@/components/scripton/ScriptOnStudio';
import type { SxLadder, SxSpine, SxDirection, SxEpisode } from '@/components/scripton/shared/sx';
import ScriptOnIntake from '@/components/scripton/ScriptOnIntake';
import ScriptOnBuildsPanel from '@/components/scripton/ScriptOnBuildsPanel';
import ScriptOnBuildScreen from '@/components/scripton/ScriptOnBuildScreen';
import ScriptonDevelop from '@/components/scripton/develop/ScriptonDevelop';
import ScriptonShell from '@/components/scripton/ScriptonShell';
import { useViewport } from '@/components/scripton/useViewport';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import { useScriptonShellFlag } from '@/components/scripton/osShellFlag';
import { useScriptonMode } from '@/components/scripton/useScriptonMode';

const STAGE_ORDER = ['LOGLINE', 'SYNOPSIS', 'TREATMENT', 'BEATS', 'SCENES', 'STEP_OUTLINE', 'DRAFT', 'COVERAGE'];
const BUILD_ORDER: [string, string][] = [['LOGLINE', 'Logline'], ['SYNOPSIS', 'Synopsis'], ['TREATMENT', 'Treatment'], ['BEATS', 'Beats'], ['SCENES', 'Scenes'], ['STEP_OUTLINE', 'Step outline'], ['DRAFT', 'Draft']];
const STAGE_LABEL: Record<string, string> = { LOGLINE: 'Logline', SYNOPSIS: 'Synopsis', TREATMENT: 'Treatment', BEATS: 'Beats', SCENES: 'Scenes', STEP_OUTLINE: 'Step Outline', DRAFT: 'Draft', COVERAGE: 'Coverage', SEASON_ARC: 'Season arc', EPISODE_MAP: 'Episode map', PREMISE: 'Premise', STORY_ENGINE: 'Story engine', BEAT_ENGINE: 'Beat engine', THESIS: 'Thesis', RESEARCH_PLAN: 'Research plan', RIGHTS_PLAN: 'Rights plan', INTERVIEW_OUTLINE: 'Interview outline', PAPER_EDIT: 'Paper edit', NARRATION: 'Narration', SHOT_LIST: 'Shot List', VIDEO_PROMPT: 'Video Prompt' };
const SAMPLE_LADDER: SxLadder[] = [
  { name: 'Logline', sub: 'Connect a project to develop a real story — this is demo content.', state: 'on', body: 'A burned-out fixer has one night to move a witness across a city that wants them both dead.' },
  { name: 'Synopsis', sub: 'pending', state: 'wait' }, { name: 'Treatment', sub: 'pending', state: 'wait' },
  { name: 'Beats', sub: 'pending', state: 'wait' }, { name: 'Scenes', sub: 'pending', state: 'wait' },
  { name: 'Step Outline', sub: 'pending', state: 'wait' }, { name: 'Draft', sub: 'pending', state: 'wait' }, { name: 'Coverage', sub: 'pending', state: 'wait' },
];
const SPINE: SxSpine[] = [{ k: 'Format', v: 'Feature · 3-act' }, { k: 'Status', v: 'Demo — no project' }];
const COMPS: string[] = [];
const SAMPLE_FORMAT: SxEpisode[] = [
  { ep: 1, hook: 'A dock pickup goes wrong in 3 seconds.', escalation: 'She grabs the witness and runs.', sting: 'Her own handler set the trap.', cliffhanger: 'Headlights fill the alley — cut.' },
];
const NAVMAP: Record<string, string> = { home: '/scripton', reader: '/scripton/reader', breakdown: '/scripton/breakdown', schedule: '/scripton/schedule', doctor: '/scripton/doctor', coverage: '/scripton/doctor', studio: '/scripton/studio', greenlight: '/scripton/greenlight', reports: '/scripton/reports', library: '/scripton/library', settings: '/scripton/settings', revisions: '/scripton/revisions', notes: '/scripton/notes', approvals: '/scripton/approvals' };

/**
 * useSearchParams REQUIRES A SUSPENSE BOUNDARY, or `next build` fails on this route.
 *
 * THIS IS THE CANONICAL PATTERN for reading the query in this app: useSearchParams inside a
 * <Suspense> boundary, with the rule itself pure and tested (studio-view.logic.ts). The one file
 * still on the old post-mount form is app/(dashboard)/scripton/revisions/page.tsx, marked there.
 *
 * This codebase had been routing around that — revisions/page.tsx reads its query post-mount with
 * the comment "avoids useSearchParams Suspense" — but that workaround is precisely the bug being
 * fixed here: a post-mount read of window.location.search never re-runs on a query-ONLY navigation,
 * because the pathname does not change and the component does not remount. Reading the query
 * properly is the fix, so the boundary comes with it.
 */
export default function StudioPage() {
  return (<Suspense fallback={null}><StudioPageInner /></Suspense>);
}

function StudioPageInner() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBack = useScriptonBack();
  const osNew = useScriptonShellFlag() === 'new'; // light OS re-skin (Develop screen 5)
  const collabMode = useScriptonMode();
  const [title, setTitle] = useState('Midnight Run');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [mode, setMode] = useState('builds');

  const [stages, setStages] = useState<any[] | null>(null);
  const [adaptResult, setAdaptResult] = useState<SxDirection[]>([]);
  const [formatResult, setFormatResult] = useState<SxEpisode[]>(SAMPLE_FORMAT);
  const [formatTarget, setFormatTarget] = useState('vertical');
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [reads, setReads] = useState<Record<string, any>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null); // sticky generation error — stays until dismissed or the next run (mirrors the reader)
  const [mounted, setMounted] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildItems, setBuildItems] = useState<any[]>([]);
  const [buildStatus, setBuildStatus] = useState('');
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildName, setBuildName] = useState('New build');
  const [buildDirections, setBuildDirections] = useState<any[] | null>(null);
  const [buildProgress, setBuildProgress] = useState<number | null>(null);
  const [buildActions, setBuildActions] = useState<any[] | null>(null);
  const promoCrawl = useRef<any>(null);
  useEffect(() => () => { clearInterval(promoCrawl.current); }, []);
  const tT = useRef<any>(null);
  const buildIdRef = useRef<string | undefined>(undefined);

  /**
   * THE URL OWNS THE TAB. Clicking Build on the rail while a build was open did nothing — he had to
   * visit another screen and come back.
   *
   * The push was never the problem. The rail pushes /scripton/studio?tab=builds while the open build
   * sits at /scripton/studio?build=X, so the URL genuinely changes and Next genuinely navigates. It
   * is the READ that was missing: `mode` was useState and `buildIdRef` was set once at mount from
   * window.location.search, so a query-only navigation — which does not remount the page component —
   * left both holding their old values. The render then took the `buildIdRef.current && mode ===
   * 'develop'` branch and drew the same screen again. Leaving by a different route and returning
   * worked only because it forced a remount.
   *
   * This effect is the one place either value is derived from the URL, which is also what makes
   * browser Back work and a refresh land where he was. It fires only when the query string actually
   * changes, so every imperative setMode('adapt'|'format'|'develop') elsewhere keeps working.
   *
   * `tab` WINS over `build`, explicitly: ?tab=builds&build=X shows the board. The rail's intent is
   * "show me the board", and leaving the build set would land back on the branch above.
   */
  const searchParams = useSearchParams();
  const searchStr = searchParams.toString();
  const lastSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSearchRef.current === searchStr) return;
    lastSearchRef.current = searchStr;
    const v = resolveStudioView(searchStr);
    buildIdRef.current = v.buildId;
    setMode(v.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);
  const flash = (m: string) => { setToast(m); clearTimeout(tT.current); tT.current = setTimeout(() => setToast(null), 3600); };
  useEffect(() => { setMounted(true); }, []);

  // ── Build versions (V1/V2/V3) ──
  const [vers, setVers] = useState<{ versions: any[]; activeVersionId: string | null }>({ versions: [], activeVersionId: null });
  const [briefPeek, setBriefPeek] = useState<any>(null);
  const loadVersions = async () => { if (!buildIdRef.current) return; try { const r: any = await productionApi.scripton.development.listVersions(buildIdRef.current); setVers(r.data || { versions: [], activeVersionId: null }); } catch { /* */ } };
  const loadPipeline = async (pid: string) => { try { const r: any = await productionApi.scripton.development.pipeline(pid, buildIdRef.current); setStages(Array.isArray(r.data) ? r.data : []); } catch { setStages([]); } void loadVersions(); };
  const newVer = async () => { if (!buildIdRef.current || !projectId) return; setBusy('ver'); try { await productionApi.scripton.development.newVersion(buildIdRef.current); await loadPipeline(projectId); flash(t('Started a new version — re-develop from the brief.')); } catch (e: any) { flash(e?.response?.data?.message || t('Could not start a new version.')); } finally { setBusy(undefined); } };
  const switchVer = async (id: string) => { if (!buildIdRef.current || !projectId || id === vers.activeVersionId) return; setBusy('ver'); try { await productionApi.scripton.development.switchVersion(buildIdRef.current, id); await loadPipeline(projectId); flash(t('Switched version.')); } catch { flash(t('Could not switch version.')); } finally { setBusy(undefined); } };
  const peekBrief = async () => { if (!buildIdRef.current) return; try { const r: any = await productionApi.scripton.development.versionBrief(buildIdRef.current); setBriefPeek(r.data || { brief: null }); } catch { /* */ } };
  const briefSummary = (b: any) => { if (!b) return t('No brief snapshot.'); const L = (k: string, v: any) => (v && (Array.isArray(v) ? v.length : true)) ? (k + ': ' + (Array.isArray(v) ? v.join(', ') : v)) : ''; return [L(t('Title'), b.name), L(t('Format'), b.projectType), L(t('Base genre'), b.baseGenre), L(t('Blend layers'), b.blendLayers), L(t('Tone'), b.tones || b.tone), L(t('Setting'), [b.settingCountry, b.settingEra].filter(Boolean).join(' · ')), L(t('Language'), b.language), L(t('Market'), b.country), L(t('Budget scope'), b.budgetTier), L(t('Based on reality'), b.realBased ? (b.realityLevel || 'INSPIRED') : ''), L(t('Real-person note'), b.realPersonNote)].filter(Boolean).join('\n') || t('No brief snapshot.'); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // ScriptON is standalone: a build always develops in the hidden ScriptON Library workspace — never tied to a
        // production project the bind bar happened to point at. Promotion to a real project is an explicit step.
        const pid = await resolveScriptonProjectId();
        // buildIdRef and mode come from the URL effect above — the second reader is what let them disagree.
        if (alive && pid) { setProjectId(pid); setTitle('ScriptON Studio'); await loadPipeline(pid);
          try {
            const saved = typeof window !== 'undefined' ? window.localStorage.getItem('scripon.dir.' + pid) : null;
            if (saved && alive) { const pd: any = JSON.parse(saved); if (pd && Array.isArray(pd.directions) && pd.directions.length) { if (pd.buildId) buildIdRef.current = pd.buildId; setBuildName(pd.name || t('New build')); setBuildItems([{ label: t('Researching the subject'), state: 'done' }, { label: t('Reading your source'), state: 'done' }, { label: t('Applying the Lore Atlas'), state: 'done' }, { label: t('Exploring three directions'), state: 'done' }]); setBuildStatus(t('Choose your direction')); setBuildError(null); setBuildProgress(null); setBuildActions(null); setBuildDirections(pd.directions); setBuilding(true); } }
          } catch { /* */ }
        }
      } catch { /* sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const lastIdx = useMemo(() => { if (!stages) return -1; let last = -1; stages.forEach((s, i) => { if (s.current) last = i; }); return last; }, [stages]);

  const ladder: SxLadder[] = useMemo(() => {
    if (!projectId) return SAMPLE_LADDER;                       // no build connected → the demo ladder
    if (!stages || !stages.length) return [];                  // build connected but stages still loading → render nothing, never the wrong default (fixes the "wrong ladder until refresh" flash)
    // Render the build's actual format ladder (feature/series/vertical/documentary), in the order the backend returns it.
    return stages.map((s, i) => {
      const kind = s.kind;
      const v = s.current;
      const state: 'done' | 'on' | 'wait' = v ? (i < lastIdx ? 'done' : 'on') : (i === lastIdx + 1 ? 'on' : 'wait');
      return {
        name: t(STAGE_LABEL[kind] || kind), kind, stageId: s.id, state,
        sub: v ? (v.framework ? t('framework:') + ' ' + v.framework : '') : (i === lastIdx + 1 ? t('ready to generate') : t('pending')),
        body: v && v.body ? String(v.body) : '',
        versionId: v?.id, versionN: v?.n, versionCount: (s.versions || []).length, versionColor: v?.colorCode,
        status: v?.status, framework: v?.framework, scenes: v?.data?.scenes, steps: v?.data?.steps,
      } as SxLadder;
    });
  }, [projectId, stages, lastIdx, t]);

  const spine: SxSpine[] = useMemo(() => {
    if (!projectId || !stages) return SPINE;
    const log = stages.find((s) => s.kind === 'LOGLINE')?.current;
    const beats = stages.find((s) => s.kind === 'BEATS')?.current;
    return [
      { k: t('Format'), v: t('Feature · 3-act') },
      { k: t('Logline'), v: log?.body ? String(log.body).slice(0, 80) : '—' },
      { k: t('Framework'), v: beats?.framework || '—' },
      { k: t('Stage'), v: (lastIdx >= 0 && stages && stages[lastIdx]) ? t(STAGE_LABEL[stages[lastIdx].kind] || '—') : t('not started') },
    ];
  }, [projectId, stages, lastIdx, t]);

  const genStage = async (kind: string, extra: any = {}) => {
    if (!projectId) { flash(t('Connect a project to develop.')); return; }
    setGenBusy(kind); setGenErr(null); flash(t('Generating') + ' ' + t(STAGE_LABEL[kind] || kind) + '…');
    try { await productionApi.scripton.development.generate(projectId, { kind, buildId: buildIdRef.current, ...extra }); await loadPipeline(projectId); flash(t(STAGE_LABEL[kind] || kind) + ' ' + t('generated.')); }
    catch (e: any) { setGenErr(e?.response?.data?.message || t('Develop engine needs an AI key configured on the server.')); }
    finally { setGenBusy(null); }
  };
  const advance = () => { const next = (stages && stages[lastIdx + 1]) ? stages[lastIdx + 1].kind : undefined; if (!next) { flash(t('The ladder is complete.')); return; } void genStage(next); };
  const onRegenerate = (kind: string) => void genStage(kind);
  const onFramework = (_kind: string, fw: string) => void genStage('BEATS', { framework: fw });
  const onSwitchVersion = async (stageId: string, dir: number) => {
    if (!projectId || !stages) return;
    const s = stages.find((x) => x.id === stageId); if (!s) return;
    const vs = (s.versions || []).slice().sort((a: any, b: any) => a.n - b.n);
    const curIdx = Math.max(0, vs.findIndex((v: any) => v.id === s.currentVersionId));
    const tgt = vs[Math.min(vs.length - 1, Math.max(0, curIdx + dir))]; if (!tgt || tgt.id === s.currentVersionId) return;
    try { await productionApi.scripton.development.setVersion(stageId, tgt.id); await loadPipeline(projectId); } catch { /* */ }
  };
  const onPromote = async (versionId: string) => {
    if (!projectId) return;
    if (collabMode === 'solo') {
      try { await productionApi.scripton.development.setStatus(versionId, 'APPROVED'); await loadPipeline(projectId); flash(t('Approved.')); }
      catch (e: any) { flash(e?.response?.data?.message || t('Could not approve.')); }
      return;
    }
    try {
      await approvalsApi.routeChange({ projectId, entityType: 'STAGE_VERSION_APPROVE', entityId: versionId, title: t('Approve development stage') });
      flash(t('Sent for sign-off → Approvals.'));
    } catch (e: any) {
      try { await productionApi.scripton.development.setStatus(versionId, 'APPROVED'); await loadPipeline(projectId); flash(t('Approved.')); }
      catch { setGenErr(e?.response?.data?.message || t('Could not route approval.')); }
    }
  };

  const onRead = async (versionId: string) => { setGenErr(null); try { const r: any = await productionApi.scripton.development.read(versionId); setReads((m) => ({ ...m, [versionId]: r.data })); flash(t('Gate read ready.')); } catch (e: any) { setGenErr(e?.response?.data?.message || t('Read needs an AI key on the server.')); } };
  const onBranch = async (stageId: string, versionId: string) => { if (!projectId) return; try { await productionApi.scripton.development.duplicate(versionId, 'Branch'); await loadPipeline(projectId); flash(t('Branched — flip versions with ◀ ▶, then Approve the winner.')); } catch { flash(t('Could not branch.')); } };
  const onPromoteScript = async (versionId: string) => {
    if (!projectId) return;
    const steps = [t('Planning the scenes'), t('Writing scene by scene'), t('Paginating the feature'), t('Filing in your Library')];
    setBuildName(title || t('Feature')); setBuildDirections(null); setBuildActions(null);
    setBuildItems(steps.map((l, i) => ({ label: l, state: i === 0 ? 'active' : 'wait' })));
    setBuildStatus(t('Planning the feature screenplay')); setBuildError(null); setGenErr(null); setBuilding(true); setBuildProgress(2);
    clearInterval(promoCrawl.current);
    let docId = '';
    try {
      const r: any = await productionApi.scripton.development.promoteToScript(versionId);
      docId = (r && r.data && r.data.documentId) || '';
      const total0 = (r && r.data && r.data.total) || 45;
      if (!docId) { setBuildError(t('Could not start generation. Your draft is safe.')); return; }
      const finish = (pages: number) => {
        clearInterval(promoCrawl.current);
        setBuildProgress(100); setBuildItems(steps.map((l) => ({ label: l, state: 'done' }))); setBuildStatus(t('Filed') + ' \u00b7 ' + pages + ' ' + t('pages in your Script Library'));
        setBuildActions([
          { label: '\u25a4  ' + t('Read the script'), primary: true, onClick: () => router.push('/scripton/script?doc=' + docId) },
          { label: '\u2193  ' + t('Download PDF'), onClick: () => { try { window.open('/scripton/script?doc=' + docId + '&print=1', '_blank'); } catch { router.push('/scripton/script?doc=' + docId + '&print=1'); } } },
          { label: t('Close'), onClick: () => { setBuilding(false); setBuildActions(null); setBuildProgress(null); setMode('develop'); } },
        ]);
        if (projectId) loadPipeline(projectId);
      };
      let lastBeat = -1; let lastChange = Date.now(); let pollErrs = 0;
      const STALL_MS = 420000; // 7 min \u2014 only while WRITING; a single scene's retries/failover can be slow but alive
      promoCrawl.current = setInterval(async () => {
        try {
          const pr: any = await productionApi.scripton.development.scriptProgress(docId);
          const d: any = (pr && pr.data) || {};
          pollErrs = 0;
          const total = d.total || total0; const done = d.done || 0; const pages = d.pageCount || 0;
          if (d.status === 'DONE') { finish(pages); return; }
          if (d.status === 'ERROR') { clearInterval(promoCrawl.current); setBuildError(d.error || t('Generation failed. Your developed draft is safe.')); return; }
          // Phase-aware stall guard. PLANNING maps the whole scene list in one long AI call before any
          // scene is written, so the page counter can't move \u2014 that is NOT a stall. Watch the backend
          // heartbeat (lastActivityAt) and only surface a stall once WRITING has started and the
          // heartbeat truly goes cold. A dead backend process is caught by the pollErrs guard below.
          const planning = d.phase === 'PLANNING' || (d.status === 'GENERATING' && done === 0 && !d.phase);
          const beat = d.lastActivityAt || done; // advances whenever the backend is alive (planning passes + each scene)
          if (beat !== lastBeat) { lastBeat = beat; lastChange = Date.now(); }
          else if (!planning && Date.now() - lastChange > STALL_MS) { clearInterval(promoCrawl.current); setBuildError(t('Generation stalled \u2014 no progress for several minutes. Your draft is safe. Check your AI engine in Engines & Routing, then try Send to production again.')); return; }
          const pct = planning ? 5 : Math.max(2, Math.min(99, Math.round((done / Math.max(1, total)) * 100)));
          const idx = planning ? 0 : (done <= 0 ? 0 : done < total ? 1 : 2);
          setBuildProgress(pct);
          setBuildItems(steps.map((l, i) => ({ label: l, state: i < idx ? 'done' : i === idx ? 'active' : 'wait' })));
          setBuildStatus(planning ? t(d.note || 'Planning the scenes \u2014 this can take a few minutes on long scripts.') : (t('Writing scene') + ' ' + Math.min(done + 1, total) + ' ' + t('of') + ' ' + total + (pages ? ' \u00b7 ' + pages + ' ' + t('pages') : '')));
        } catch { pollErrs++; if (pollErrs >= 8) { clearInterval(promoCrawl.current); setBuildError(t('Lost contact with the generation service. Your developed draft is safe \u2014 try Send to production again.')); } }
      }, 1700);
    } catch (e: any) {
      clearInterval(promoCrawl.current);
      setBuildError(e?.response?.data?.message || t('Could not send to production. Your draft is safe \u2014 try again.'));
    }
  };
  const onAdapt = async (source: string) => {
    if (!source || source.trim().length < 40) { flash(t('Paste a source synopsis or excerpt first.')); return; }
    if (!projectId) { flash(t('Connect a project to run the adapt engine.')); return; }
    setBusy('adapt'); setGenErr(null); flash(t('Reading the source…'));
    try { const res: any = await productionApi.scripton.adapt(projectId, { sourceText: source, targetFormat: 'feature' }); const d: any = res.data || {}; setAdaptResult(Array.isArray(d.directions) ? d.directions : []); flash((d.directions?.length || 0) + ' ' + t('adaptation directions.')); }
    catch (e: any) { setGenErr(e?.response?.data?.message || t('Adapt engine needs an AI key configured.')); }
    finally { setBusy(undefined); }
  };
  const onPickDirection = async (d: SxDirection) => {
    if (!projectId) { flash(t('Connect a project to develop the pick.')); return; }
    setMode('develop');
    await genStage('LOGLINE', { seed: (d.logline || d.label || '') + (d.change ? ('\nCHANGE: ' + d.change) : '') + (d.tone ? ('\nTONE: ' + d.tone) : '') });
    flash(t('Seeded the ladder from') + ' “' + (d.label || 'pick') + '”. ' + t('Use Advance to write each stage.'));
  };
  const onFormat = async (target: string) => {
    if (!projectId) { flash(t('Connect a project with a script to convert format.')); return; }
    setBusy('format'); setGenErr(null); flash(t('Converting to') + ' ' + target + '…');
    try { const res: any = await productionApi.scripton.formatConvert(projectId, { targetFormat: target }); const d: any = res.data || {}; setFormatResult(Array.isArray(d.episodes) ? d.episodes : []); flash((d.episodes?.length || 0) + ' ' + target + ' ' + t('episodes.')); }
    catch (e: any) { setGenErr(e?.response?.data?.message || t('Format convert needs a parsed script — import or break one down first.')); }
    finally { setBusy(undefined); }
  };

  const onIntakeBegin = async (form: any) => {
    if (!projectId) return;
    try { window.localStorage.removeItem('scripon.dir.' + projectId); } catch { /* */ }
    const name = String(form.name || form.title || t('New build')).slice(0, 120);
    const { name: _n, title: _t, framework: _fw, ...rest } = form;
    const brief: any = { ...rest, spine: { ...((rest as any).spine || {}), ...(_fw ? { framework: _fw } : {}) } };
    try { const b: any = await productionApi.scripton.development.createBuild({ name, projectId, brief }); if (b && b.data && b.data.id) buildIdRef.current = b.data.id; } catch { /* */ }
    try { await productionApi.scripton.development.saveIntake(projectId, brief); } catch { /* */ }
    setTitle(name);
    const items: any[] = [{ label: t('Researching the subject'), state: 'active' }, { label: t('Reading your source'), state: 'wait' }, { label: t('Applying the Lore Atlas'), state: 'wait' }, { label: t('Exploring three directions'), state: 'wait' }];
    setBuildName(name); setBuildDirections(null); setBuildItems(items.map((x) => ({ ...x }))); setBuildStatus(t('Researching the subject')); setBuildError(null); setBuilding(true);
    try { await productionApi.scripton.research(projectId); } catch { /* tolerant */ }
    items[0] = { label: t('Researching the subject'), state: 'done' }; items[1] = { label: t('Reading your source'), state: 'done' }; items[2] = { label: t('Applying the Lore Atlas'), state: 'done' }; items[3] = { label: t('Exploring three directions'), state: 'active' };
    setBuildItems(items.map((x) => ({ ...x }))); setBuildStatus(t('Exploring three directions'));
    try {
      const res: any = await productionApi.scripton.adapt(projectId, { sourceText: String(form.sourceText || ''), targetFormat: 'feature' });
      const dirs: any[] = (res && res.data && Array.isArray(res.data.directions)) ? res.data.directions : [];
      items[3] = { label: t('Exploring three directions'), state: 'done' }; setBuildItems(items.map((x) => ({ ...x })));
      if (dirs.length) { setBuildStatus(t('Choose your direction')); setBuildDirections(dirs); try { window.localStorage.setItem('scripon.dir.' + projectId, JSON.stringify({ buildId: buildIdRef.current, name, directions: dirs })); } catch { /* */ } try { window.localStorage.removeItem('scripon.intakeDraft.' + projectId); } catch { /* */ } }
      else { setBuildError(t('Could not generate directions - opening Develop so you can start manually.')); }
    } catch (e: any) { setBuildError((e?.response?.data?.message || t('Directions could not be generated.')) + ' ' + t('Opening Develop so you can start manually.')); }
  };
  const onBuildPick = async (d: any) => {
    if (!projectId) return;
    try { window.localStorage.removeItem('scripon.dir.' + projectId); } catch { /* */ }
    const summary = String(d.label || '') + (d.change ? (' - change: ' + d.change) : '') + (d.tone ? (' - tone: ' + d.tone) : '');
    try { await productionApi.scripton.development.saveIntake(projectId, { treatment: summary.slice(0, 600) }); } catch { /* */ }
    setBuildDirections(null); setBuilding(false);
    await onPickDirection(d);
  };
  const onBuildRegen = async (dir: any, note: string) => {
    if (!projectId) return null;
    try { const r: any = await productionApi.scripton.adaptOne(projectId, { direction: dir, note: note || '' }); return (r && r.data && r.data.direction) || null; } catch { return null; }
  };
  const onTab = (k: string) => setMode(k);
  const onNav = (k: string) => { if (NAVMAP[k]) return router.push(NAVMAP[k]); flash(`${k[0].toUpperCase() + k.slice(1)} ` + t('is a later screen in the build order.')); };
  const onAction = (k: string) => {
    if (k === 'advance') return advance();
    if (k === 'cmdk') return flash(t('Press ⌘K anywhere in the workspace.'));
    if (k === 'import') return setMode('adapt');
    if (k.startsWith('fmt-')) return setFormatTarget(k.slice(4));
    if (k === 'tab-develop') return setMode('develop');
    if (k === 'tab-adapt') return setMode('adapt');
    if (k === 'tab-format') return setMode('format');
    flash(t('Coming soon.'));
  };

  if (!mounted) return null;
  // New Develop — structural rebuild (Figma 69:2), under the new shell when a build is open.
  // `old` (or the Builds list with no build open) keeps the current Builder below. When `building`
  // (a Draft → script render is running), fall through so the existing ScriptOnBuildScreen renders.
  if (osNew && buildIdRef.current && mode === 'develop' && !building) {
    return <ScriptonDevelop vp={vp} onBack={onBack} projectId={projectId} buildId={buildIdRef.current}
      ladder={ladder} spine={spine} comps={COMPS} genBusy={genBusy}
      onAdvance={advance} onRegenerate={onRegenerate} onSwitchVersion={onSwitchVersion} onPromoteScript={onPromoteScript} />;
  }
  // New shell — the Build workspace landing (builds list) renders inside the ONE ScriptonShell, so its
  // chrome matches every other route (no more standalone "Development builds" bar bypassing the shell).
  // The create-flow (adapt/intake) and the render screen still use the legacy overlays below; opening a
  // build routes to ScriptonDevelop above. `old` keeps the legacy Builder untouched.
  if (osNew && projectId && !buildIdRef.current && mode === 'builds' && !building) {
    return (
      <ScriptonShell screen="develop" active="develop" vp={vp} onBack={onBack}
        topbar={{ scriptScoped: false }}>
        <ScriptOnBuildsPanel embedded osNew projectId={projectId} onNewBuild={() => setMode('adapt')} onClose={() => router.push('/home')} />
      </ScriptonShell>
    );
  }
  const RC: any = ScriptOnStudio; // desktop-only OS — the tablet/mobile studio twins are retired
  return (<><RC osNew={osNew} title={title} meta={t('Studio · seed → script')} mode={mode} onTab={onTab} showDevelop={mode === 'develop' || !!buildIdRef.current} ladder={ladder} spine={spine} comps={COMPS} note={t('Doctor: keep every stage true to the approved spine.')} adaptResult={adaptResult} formatResult={formatResult} formatTarget={formatTarget} busy={busy} genBusy={genBusy}
    onNav={onNav} onBack={onBack} onAction={onAction} onAdapt={onAdapt} onFormat={onFormat} onPick={onPickDirection} onRegenerate={onRegenerate} onSwitchVersion={onSwitchVersion} onPromote={onPromote} onFramework={onFramework} onRead={onRead} onBranch={onBranch} onPromoteScript={onPromoteScript} reads={reads} toast={toast} />{mode === 'adapt' && projectId ? <ScriptOnIntake projectId={projectId} busy={genBusy === 'LOGLINE'} onBegin={onIntakeBegin} onClose={() => setMode('develop')} /> : null}{mode === 'builds' && projectId ? <ScriptOnBuildsPanel osNew={osNew} projectId={projectId} onClose={() => { if (buildIdRef.current) setMode('develop'); else router.push('/home'); }} onNewBuild={() => setMode('adapt')} railGap={vp === 'mobile' || vp === 'tablet' ? 0 : 74} /> : null}{building ? <ScriptOnBuildScreen title={buildName} items={buildItems} status={buildStatus} error={buildError} progress={buildProgress} actions={buildActions} directions={buildDirections} onPick={onBuildPick} onRegen={onBuildRegen} onContinue={() => { try { if (projectId) window.localStorage.removeItem('scripon.dir.' + projectId); } catch { } setBuilding(false); setBuildActions(null); setBuildProgress(null); setMode('develop'); }} /> : null}
    {(buildIdRef.current && mode === 'develop') ? (
      <div style={{ position: 'fixed', top: 14, insetInlineStart: '50%', transform: 'translateX(-50%)', zIndex: 64, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(19,21,27,0.96)', border: '1px solid rgba(198,164,99,0.3)', borderRadius: 999, padding: '5px 8px', boxShadow: '0 8px 28px rgba(0,0,0,0.5)', fontFamily: 'var(--sx-body)' }}>
        <span style={{ fontSize: 10.5, color: '#9aa1ab', fontWeight: 700, letterSpacing: 0.5, paddingInlineStart: 4 }}>{t('VERSIONS')}</span>
        {((vers.versions && vers.versions.length) ? vers.versions : [{ id: '', n: 1, label: 'V1' }]).map((v: any) => { const on = (v.id && v.id === vers.activeVersionId) || (!v.id && !vers.activeVersionId); return (<button key={v.id || 'v1'} onClick={() => { if (v.id) void switchVer(v.id); }} disabled={busy === 'ver'} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (on ? 'transparent' : 'rgba(255,255,255,0.12)'), background: on ? 'linear-gradient(180deg,#E6D2A2,#C6A463)' : 'transparent', color: on ? '#15120B' : '#9aa1ab' }}>{v.label || ('V' + v.n)}</button>); })}
        <button onClick={() => void newVer()} disabled={busy === 'ver'} title={t('Snapshot this and re-develop from the brief')} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(87,179,104,0.4)', background: 'transparent', color: '#6FCF97' }}>+ {t('New version')}</button>
        <button onClick={() => void peekBrief()} title={t('Go back to the brief')} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#9aa1ab' }}>↩ {t('Brief')}</button>
      </div>
    ) : null}
    {briefPeek ? (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,10,0.7)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setBriefPeek(null)}>
        <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'auto', background: '#14161c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 18, fontFamily: 'var(--sx-body)', color: '#E7E3D8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#F4EEE0' }}>{t('The brief behind')} {briefPeek.label || ('V' + (briefPeek.n || 1))}</div><span onClick={() => setBriefPeek(null)} style={{ cursor: 'pointer', color: '#9aa1ab' }}>✕</span></div>
          <div style={{ fontSize: 11.5, color: '#9aa1ab', marginBottom: 10 }}>{t('Read-only reference. To change it, start a New version.')}</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: '#cfd3da', fontFamily: 'var(--sx-body)', margin: 0, lineHeight: 1.6 }}>{briefSummary(briefPeek.brief)}</pre>
        </div>
      </div>
    ) : null}
    {genErr ? (
      <div role="alert" style={{ position: 'fixed', insetBlockEnd: 20, insetInlineStart: '50%', transform: 'translateX(-50%)', zIndex: 92, maxWidth: 580, width: 'calc(100% - 32px)', display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(180deg,rgba(44,20,20,0.98),rgba(26,13,13,0.98))', border: '1px solid rgba(214,109,109,0.55)', borderRadius: 13, padding: '12px 14px', boxShadow: '0 16px 46px rgba(0,0,0,0.62)', fontFamily: 'var(--sx-body)', backdropFilter: 'blur(8px)' }}>
        <span aria-hidden style={{ fontSize: 16, lineHeight: '19px', color: '#E8A0A0', flexShrink: 0 }}>⚠</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, color: '#E8A0A0', textTransform: 'uppercase', marginBottom: 3 }}>{t('Generation stopped')}</div>
          <div style={{ fontSize: 12.5, color: '#F0E9DC', lineHeight: 1.55, wordBreak: 'break-word' }}>{genErr}</div>
          <div style={{ fontSize: 11, color: '#b9a9a9', marginTop: 5 }}>{t('Stays until you dismiss it or run again.')}</div>
        </div>
        <button onClick={() => setGenErr(null)} aria-label={t('Dismiss')} title={t('Dismiss')} style={{ flexShrink: 0, background: 'transparent', border: 'none', color: '#d9b3b3', cursor: 'pointer', fontSize: 16, lineHeight: '19px', padding: 0 }}>✕</button>
      </div>
    ) : null}</>);
}
