'use client';
/**
 * ScriptON Doctor workspace — flagged parallel route /scripton (existing /scripts + /script-workspace untouched).
 * First screen: the Script Reader, a carbon-copy of design/ScriptHub-Reader-Desktop-HiFi.html,
 * wired to the live script SSOT (productionApi.script) and Doctor actions (productionApi.scripton).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi , approvalsApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriptonProject, resolveScriptonProjectId } from '@/components/scripton/useScriptonProject';
import type { SxScene, SxSceneRead, SxTab } from '@/components/scripton/ScriptOnReader';
import { useViewport } from '@/components/scripton/useViewport';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import { useScriptonMode } from '@/components/scripton/useScriptonMode';
import ScriptonWrite, { type PassVM } from '@/components/scripton/write/ScriptonWrite';

const SAMPLE: SxScene[] = [
  { id: 's1', sceneNumber: '1', slugline: 'INT. DINER — DAY', intExt: 'INT', dayNight: 'DAY', status: 'tagged', description: 'Steam off the coffee. MARA (30s) watches the door over the rim of her cup. The booth vinyl is cracked; so is her patience.' },
  { id: 's2', sceneNumber: '2', slugline: 'EXT. HIGHWAY — DAY', intExt: 'EXT', dayNight: 'DAY', status: 'tagged', description: 'A two-lane ribbon through nothing. A single car carves the heat-haze, going too fast to be innocent.' },
  { id: 's3', sceneNumber: '7', slugline: 'INT. SAFEHOUSE — NIGHT', intExt: 'INT', dayNight: 'NIGHT', status: 'tagged', description: 'Mismatched lamps. Maps taped to the wall. Mara lays out three burner phones like a hand of cards.' },
  { id: 's4', sceneNumber: '11', slugline: 'EXT. DOCKS — NIGHT', intExt: 'EXT', dayNight: 'NIGHT', status: 'attn', description: 'Containers stacked like a dead city. Sodium light pools. Somewhere, water slaps pilings.' },
  { id: 's5', sceneNumber: '13', slugline: 'INT. VAN — NIGHT', intExt: 'INT', dayNight: 'NIGHT', status: 'attn', description: 'Surveillance gear glows. Mara watches a monitor, jaw tight, as a figure crosses the loading floor below.' },
  { id: 's6', sceneNumber: '14', slugline: 'INT. WAREHOUSE — NIGHT', intExt: 'INT', dayNight: 'NIGHT', status: 'attn', description: 'Rain hammers the skylights. MARA (30s), soaked, edges along a steel gantry above the loading floor. Below, two SILHOUETTES move crates under a single sodium lamp.\nA crate scrapes concrete. One silhouette FREEZES, head tilting toward the dark.\nMara’s hand finds the railing. She doesn’t move. Below, the sodium lamp BUZZES — and dies.' },
  { id: 's7', sceneNumber: '15', slugline: 'INT. WAREHOUSE / OFFICE', intExt: 'INT', dayNight: 'NIGHT', status: 'todo', description: 'A glass box overlooking the floor. A ledger left open. Mara photographs every page.' },
  { id: 's8', sceneNumber: '16', slugline: 'EXT. ROOFTOP — NIGHT', intExt: 'EXT', dayNight: 'NIGHT', status: 'todo', description: 'Wind and city glow. Mara presses against an HVAC unit as a searchlight rakes the gravel.' },
  { id: 's9', sceneNumber: '22', slugline: 'INT. HOSPITAL — DAY', intExt: 'INT', dayNight: 'DAY', status: 'todo', description: 'Fluorescent calm. Mara sits in a plastic chair, a stranger’s blood dried on her sleeve.' },
];

export default function ScriptOnWorkspace() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBackOs = useScriptonBack();
  const mode = useScriptonMode();
  const onNav = (k: string) => { if (k === 'home') return router.push('/scripton'); if (k === 'library') return router.push('/scripton/library'); if (k === 'coverage') return router.push('/scripton/coverage'); if (k !== 'reader') return onAction(k); };
  // Start neutral (loading) — never seed the fictional sample. A real script's
  // identity is filled in once it binds; the sample is shown ONLY when no script
  // can be bound at all (true demo), and is labelled as such (`sample`).
  const [scenes, setScenes] = useState<SxScene[]>([]);
  const [title, setTitle] = useState('');
  const [revLabel, setRevLabel] = useState('');
  const [revColor, setRevColor] = useState('#ffffff');
  const [pageCount, setPageCount] = useState<number | string>(0);
  const [totalScenes, setTotalScenes] = useState(0);
  const [updated, setUpdated] = useState('');
  const [loading, setLoading] = useState(true);
  const [sample, setSample] = useState(false);
  const [revisions, setRevisions] = useState<{ id: string; label: string; color?: string; date?: string }[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeRev, setActiveRev] = useState<any>(null);
  const [passVM, setPassVM] = useState<PassVM | null>(null);
  const [docId, setDocId] = useState('');
  const toPassVM = (pass: any): PassVM | null => {
    if (!pass) return null;
    const changes = (pass.changes || []).map((c: any) => ({ id: c.id, kind: c.kind, sceneNumber: c.spec?.sceneNumber, label: c.spec?.label, tag: c.spec?.tag, summary: c.spec?.summary, before: c.spec?.before, after: c.spec?.after }));
    return { passId: pass.id, changeCount: changes.length, continuity: Math.round((pass.continuityScore ?? 0) * 100), versionLabel: '→ new draft', changes, bridge: changes.length ? 'One bridge needed: S64 night → S65 dawn. Auto-fix on render.' : '' };
  };

  const [activeId, setActiveId] = useState('s6');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<SxTab>('Doctor');
  const [sceneRead, setSceneRead] = useState<SxSceneRead>(null);
  const [reading, setReading] = useState(false);
  const [diagByNum, setDiagByNum] = useState<Record<string, SxSceneRead>>({});
  const [surface, setSurface] = useState<null | 'coverage' | 'compare' | 'budgetfit' | 'rewrite'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  // `?doc=<id>` opens a specific script in Write (read post-mount, like ?pass=);
  // default binds the ScriptON project's first doc.
  const [docParam, setDocParam] = useState('');
  useEffect(() => { if (typeof window !== 'undefined') setDocParam(new URLSearchParams(window.location.search).get('doc') || ''); }, []);

  useEffect(() => {
    let alive = true;
    let bound = false;
    // The labelled demo sample — shown ONLY when no real script can be bound
    // (no project/doc, or the backend is unreachable before we bind anything).
    const applyDemo = () => {
      if (!alive) return;
      setScenes(SAMPLE); setActiveId('s6'); setTitle('Midnight Run'); setRevLabel('BLUE · v4');
      setRevColor('#5b8def'); setPageCount(111); setTotalScenes(64); setUpdated('2h ago'); setSample(true);
    };
    (async () => {
      setLoading(true); setSample(false);
      try {
        let doc: any = null; let pid: string | null = null;
        // Explicit ?doc= wins — fetch that document directly.
        if (docParam) {
          try { const d: any = await productionApi.script.getDocument(docParam); doc = d.data || null; pid = doc?.projectId || null; } catch { /* fall through to project resolution */ }
        }
        if (!doc) {
          const pr: any = await productionApi.projects.list();
          const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
          pid = pickScriptonProject(projects)?.id || null;
          // Cold workspace cache → resolve the ScriptON Library workspace explicitly
          // (a cold cache is NOT a no-script demo — only fall to the sample if even
          // the workspace can't be resolved).
          if (!pid) pid = await resolveScriptonProjectId();
          if (!pid) { applyDemo(); return; }
          const dr: any = await productionApi.script.list(pid);
          const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
          doc = docs[0];
        }
        if (!doc) { applyDemo(); return; }
        // A real script is bound — show ITS identity (e.g. عنترة), never the sample,
        // even when it has no parsed pages yet.
        bound = true;
        if (alive) { setDocId(doc.id); setProjectId(pid); setTitle(doc.title || 'Script'); setSample(false); }
        try { const pp: any = await productionApi.scripton.revisionPass(doc.id); if (alive) setPassVM(toPassVM(pp.data)); } catch { /* no open pass */ }
        const revId = doc.activeRevisionId || doc.revisions?.[0]?.id;
        let rvData: any = null; let sc: SxScene[] = [];
        if (revId) {
          try {
            const rv: any = await productionApi.script.getRevision(revId);
            rvData = rv.data || null;
            sc = (rvData?.scenes ?? []).map((s: any) => ({
              id: s.id, sceneNumber: s.sceneNumber, slugline: s.slugline, intExt: s.intExt, dayNight: s.dayNight,
              description: s.description, status: s.description ? 'tagged' : 'todo',
            }));
          } catch { /* revision unreadable → honest empty state, keep the real title */ }
        }
        if (!alive) return;
        // Bound but no parsed scenes → empty state with the real title (NOT the sample).
        setScenes(sc);
        if (sc.length) setActiveId(sc[0].id);
        setRevLabel(rvData?.revisionLabel || doc.activeRevisionLabel || 'DRAFT');
        setRevColor(rvData?.hex || '#ffffff');
        setPageCount(rvData?.pageCount || sc.length);
        setTotalScenes(sc.length);
        setUpdated('');
        setActiveRev(rvData);
        setRevisions((doc.revisions ?? []).map((r: any) => ({ id: r.id, label: r.revisionLabel || 'Revision', color: r.hex, date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '' })));
      } catch { if (!bound) applyDemo(); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [docParam]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scenes;
    return scenes.filter((s) => (s.slugline || '').toLowerCase().includes(q) || (s.sceneNumber || '').includes(q));
  }, [scenes, search]);

  const active = scenes.find((s) => s.id === activeId) || scenes[0];

  const selectScene = (id: string) => {
    setActiveId(id);
    const s = scenes.find((x) => x.id === id);
    setSceneRead(s?.sceneNumber ? (diagByNum[String(s.sceneNumber)] ?? null) : null);
  };

  const runDiagnostics = async () => {
    if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to run live diagnostics.')); return; }
    setReading(true);
    try {
      const r: any = await productionApi.scripton.diagnostics(projectId, { revisionId: activeRev.id });
      const arr: any[] = r.data?.scenes || [];
      const map: Record<string, SxSceneRead> = {};
      for (const s of arr) {
        map[String(s.sceneNumber)] = {
          verdict: s.verdict, wants: s.objective || s.wants, obstacle: s.obstacle,
          subtext: s.subtext, power: s.powerShift || s.power, confidence: s.confidence || 'High',
        };
      }
      setDiagByNum(map);
      setSceneRead(active?.sceneNumber ? (map[String(active.sceneNumber)] ?? null) : null);
    } catch (e: any) {
      flash(e?.response?.status ? `${t('Diagnostics failed (HTTP')} ${e.response.status}) — ${t('check the backend.')}` : t('Diagnostics failed — backend not reachable on :3001.'));
    } finally { setReading(false); }
  };

  const onAction = (a: string) => {
    if (a === 'cmdk') { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('scripon:cmdk')); return; }
    if (a === 'diagnose') return runDiagnostics();
    if (a === 'compare') return router.push('/scripton/revisions');
    if (a === 'notes') return router.push('/scripton/notes');
    if (a === 'coverage') return router.push('/scripton/coverage');
    if (a === 'budgetfit') { if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to run this.')); return; } return setSurface('budgetfit'); }
    if (a === 'rewrite') { if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to rewrite.')); return; } return setSurface('rewrite'); }
    if (a === 'breakdown') return router.push('/scripton/breakdown');
    if (a === 'doctor') return router.push('/scripton/doctor');
    if (a === 'schedule') return router.push('/scripton/schedule');
    if (a === 'reports') return router.push('/scripton/reports');
    if (a === 'studio') return router.push('/scripton/studio');
    if (a === 'greenlight') return router.push('/scripton/greenlight');
    if (a === 'settings') return router.push('/scripton/settings');
    if (a === 'develop') return router.push('/scripton/studio');
    if (a === 'distribute') {
      if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to distribute.')); return; }
      if (mode === 'solo') { flash(t('Distributed — sides ready (solo mode, no sign-off needed).')); return; }
      approvalsApi.routeChange({ projectId, entityType: 'SCRIPT_DISTRIBUTION', entityId: activeRev.id, title: 'Distribute script' })
        .then(() => flash(t('Sent for distribution sign-off → Approvals.')))
        .catch((e: any) => flash(e?.response?.data?.message || t('Could not route — is the backend on :3001?')));
      return;
    }
    const msgs: Record<string, string> = {
      rewrite: t('Rewrite slate — variant generation ships in the next phase.'),
      develop: t('Develop / expand ships in the next phase.'),
      distribute: t('Distribution (sides, watermarked PDF) ships in the next phase.'),
      schedule: t('Schedule & Budget is a later screen in the build order.'),
      reports: t('Reports is a later screen in the build order.'),
      cmdk: t('Command palette (⌘K) is a later screen in the build order.'),
    };
    flash(msgs[a] || t('Coming soon.'));
  };

  // Write — the canvas + Story Spine (always the new OS; legacy Reader desktop/tablet/mobile retired).
  const stagedNums = new Set((passVM?.changes || []).map((c) => Number(c.sceneNumber)));
  const stagedIds = filtered.filter((s) => stagedNums.has(Number(s.sceneNumber))).map((s) => s.id);
  return (
    <ScriptonWrite
      title={title} revisionLabel={revLabel} revisionColor={revColor}
      scenes={filtered} activeId={active?.id} onSelectScene={selectScene}
      pageCount={pageCount} loading={loading} sample={sample} stagedSceneIds={stagedIds} pass={passVM} scriptId={docId}
      scriptScoped={!!docParam}
      onNav={onNav} onBack={onBackOs}
      onRender={async () => {
        const passId = passVM?.passId;
        if (!passId) { flash(t('Stage a change to start a Revision Pass first.')); return; }
        flash(t('Rendering the new draft…'));
        try {
          await productionApi.scripton.renderPass(passId, { projectId });
          router.push('/scripton/revisions?pass=' + encodeURIComponent(passId));
        } catch (e: any) {
          flash(e?.response?.data?.message || t('Render failed — backend on :3001?'));
        }
      }}
      onPassAction={(k) => flash(k === 'save' ? t('Pass saved.') : t('Ships with the next slice.'))}
      onStage={async (change) => {
        if (!docId) return { ok: false, conflict: t('No script bound.') };
        try {
          const r: any = await productionApi.scripton.stageChange({ scriptId: docId, ...change });
          if (r.data?.conflict) return { ok: false, conflict: r.data.conflict };
          try { const pp: any = await productionApi.scripton.revisionPass(docId); setPassVM(toPassVM(pp.data)); } catch { /* */ }
          flash(t('Change staged — continuity held.'));
          return { ok: true };
        } catch (e: any) { return { ok: false, conflict: e?.response?.data?.message || t('Stage failed — backend on :3001?') }; }
      }}
      toast={toast} vp={vp}
    />
  );
}
