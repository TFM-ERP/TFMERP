'use client';
/** ScriptON Doctor — Revisions & Compare route /scripton/revisions. Timeline ⇄ doc.revisions; diff ⇄ two revisions' scenes. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import ScriptOnRevisions, { SxRev, SxCompare, SxLine } from '@/components/scripton/ScriptOnRevisions';
import ScriptOnRevisionsTablet from '@/components/scripton/ScriptOnRevisionsTablet';
import ScriptOnRevisionsMobile from '@/components/scripton/ScriptOnRevisionsMobile';
import { useViewport } from '@/components/scripton/useViewport';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import { useScriptonShellFlag } from '@/components/scripton/osShellFlag';
import ScriptonCompare, { type CompareResult } from '@/components/scripton/compare/ScriptonCompare';

const SAMPLE_REVS: SxRev[] = [
  { id: 'r1', label: 'Blue v4', color: '#5b8def', date: 'today', author: 'S. Okonkwo', summary: 'Tightened Act 2; cut 4 pp. Re-paginated Sc 14–28.', active: true },
  { id: 'r2', label: 'Pink v3', color: '#d6649a', date: '4 days ago', author: 'S. Okonkwo', summary: 'Added Broker confrontation (Sc 47). +3 pp.' },
  { id: 'r3', label: 'Yellow v2', color: '#e0a23b', date: '11 days ago', author: "Writers' room", summary: 'Dialogue punch-up pass across Act 1.' },
  { id: 'r4', label: 'White — shooting draft', color: '#cfd3da', date: '3 weeks ago', author: 'S. Okonkwo', summary: 'Locked draft for budgeting. 119 pp.' },
  { id: 'r5', label: 'Draft 1', color: '#9aa1ab', date: '6 weeks ago', author: 'S. Okonkwo', summary: 'First full draft. Imported from Final Draft.' },
];
const SAMPLE_COMPARE: SxCompare = {
  fromLabel: 'Pink v3', fromColor: '#d6649a', toLabel: 'Blue v4', toColor: '#5b8def',
  fromLines: [
    { t: '14  EXT. ALLEY — NIGHT', cls: '' }, { t: ' ', cls: '' },
    { t: 'Sarah presses into the shadow. Rain ticks off the dumpster lids.', cls: '' },
    { t: 'She waits. A long time. Nothing comes. She checks her phone again.', cls: 'del' },
    { t: ' ', cls: '' }, { t: '          SARAH', cls: '' }, { t: '     (to herself, exhausted)', cls: 'del' },
    { t: '     Come on. Come on.', cls: '' },
  ],
  toLines: [
    { t: '14  EXT. ALLEY — NIGHT', cls: '' }, { t: ' ', cls: '' },
    { t: 'Sarah presses into the shadow. Rain ticks off the dumpster lids.', cls: '' }, { t: ' ', cls: '' },
    { t: '          SARAH', cls: '' }, { t: '     Come on. Come on.', cls: '' }, { t: ' ', cls: '' },
    { t: 'Headlights sweep the alley mouth — too fast for a patrol. She goes still.', cls: 'add' },
    { t: "A second set follows. Two cars. They've boxed the street.", cls: 'add' },
  ],
};

const sortRevs = (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
const sceneText = (s: any, i: number) => `${s.sceneNumber || i + 1}. ${(s.slugline || s.description || 'SCENE').toString().slice(0, 60)}`;

export default function ScriptOnRevisionsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBack = useScriptonBack();
  const flag = useScriptonShellFlag();
  // Render→Compare mode: landed here from Write's Render with ?pass=<id>.
  const [passId, setPassId] = useState('');
  const [cmp, setCmp] = useState<CompareResult | null>(null);
  const [cmpBusy, setCmpBusy] = useState<string | null>(null);
  const [title, setTitle] = useState('Midnight Run');
  const [revs, setRevs] = useState<SxRev[]>(SAMPLE_REVS);
  const [rawRevs, setRawRevs] = useState<any[]>([]);
  const [toId, setToId] = useState('r1');
  const [compare, setCompare] = useState<SxCompare>(SAMPLE_COMPARE);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  const buildDiff = async (fromR: any, toR: any) => {
    setLoading(true);
    try {
      const [fr, tr] = await Promise.all([productionApi.script.getRevision(fromR.id), productionApi.script.getRevision(toR.id)]);
      const fS: any[] = (fr as any).data?.scenes ?? []; const tS: any[] = (tr as any).data?.scenes ?? [];
      const num = (s: any) => String(s.sceneNumber ?? '');
      const tMap = new Map(tS.map((s) => [num(s), (s.slugline || s.description || '')])); const fMap = new Map(fS.map((s) => [num(s), (s.slugline || s.description || '')]));
      const fromLines: SxLine[] = fS.slice(0, 60).map((s, i) => { const n = num(s); const cls: SxLine['cls'] = !tMap.has(n) ? 'del' : (tMap.get(n) !== (s.slugline || s.description || '') ? 'del' : ''); return { t: sceneText(s, i), cls }; });
      const toLines: SxLine[] = tS.slice(0, 60).map((s, i) => { const n = num(s); const cls: SxLine['cls'] = !fMap.has(n) ? 'add' : (fMap.get(n) !== (s.slugline || s.description || '') ? 'add' : ''); return { t: sceneText(s, i), cls }; });
      setCompare({ fromLabel: fromR.label, fromColor: fromR.color, toLabel: toR.label, toColor: toR.color, fromLines, toLines });
    } catch { flash(t('Could not load revision scenes to compare.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriptonProject(projects); if (!proj?.id) return;
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0]; const list: any[] = (doc?.revisions ?? []).slice().sort(sortRevs);
        if (!alive || !list.length) return;
        const mapped: SxRev[] = list.map((r) => ({ id: r.id, label: r.revisionLabel || 'Revision', color: r.colorCode || '#9aa1ab', date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '', author: r.createdBy || '', summary: r.pageCount ? `${r.pageCount} pp` : '', active: r.id === doc.activeRevisionId }));
        setTitle(proj.name || proj.title || 'Project'); setRevs(mapped); setRawRevs(list);
        const toIdx = Math.max(0, mapped.findIndex((m) => m.active)); const to = mapped[toIdx] || mapped[0]; const from = mapped[toIdx + 1];
        setToId(to.id);
        if (from) buildDiff(from, to); else setCompare(null);
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  // Read the ?pass= param post-mount (avoids useSearchParams Suspense), then fetch the
  // render result — the single, refresh-safe source for the compare view.
  useEffect(() => { if (typeof window !== 'undefined') setPassId(new URLSearchParams(window.location.search).get('pass') || ''); }, []);
  useEffect(() => {
    if (flag !== 'new' || !passId) return;
    let alive = true;
    (async () => { try { const rr: any = await productionApi.scripton.renderResult(passId); if (alive) setCmp(rr.data || null); } catch { /* keep loading */ } })();
    return () => { alive = false; };
  }, [flag, passId]);

  const newLbl = cmp?.version?.label || (cmp?.version ? 'V' + cmp.version.n : t('rendered'));
  const prevLbl = cmp?.prevVersion?.label || t('previous');
  const setActive = async () => {
    if (!cmp?.buildId || !cmp?.version?.id) { flash(t('No version to activate.')); return; }
    setCmpBusy('act');
    try { await productionApi.scripton.development.switchVersion(cmp.buildId, cmp.version.id); flash(`${newLbl} ${t('is now the active version.')}`); }
    catch (e: any) { flash(e?.response?.data?.message || t('Could not set the active version.')); }
    finally { setCmpBusy(null); }
  };
  const keepPrev = () => flash(`${prevLbl} ${t('stays active — nothing was overwritten.')}`);
  const discardNew = async () => {
    if (!cmp?.version?.id) return;
    if (typeof window !== 'undefined' && !window.confirm(`${t('Discard')} ${newLbl}? ${prevLbl} ${t('stays active and the change pass is preserved.')}`)) return;
    setCmpBusy('discard');
    try { await productionApi.scripton.development.setStatus(cmp.version.id, 'DISCARDED'); flash(`${newLbl} ${t('discarded —')} ${prevLbl} ${t('is active.')}`); }
    catch (e: any) { flash(e?.response?.data?.message || t('Could not discard the version.')); }
    finally { setCmpBusy(null); }
  };

  const onSelect = (id: string) => {
    setToId(id);
    if (!rawRevs.length) return; // sample mode
    const idx = revs.findIndex((r) => r.id === id); const to = revs[idx]; const from = revs[idx + 1];
    if (to && from) buildDiff(from, to); else setCompare(null);
  };
  const onAction = (k: string) => flash(k === 'new' ? t('New revision (colour-advance) ships in the next phase here.') : k === 'restore' ? t('Restore-a-draft ships in the next phase.') : t('Export revised pages ships in the next phase.'));
  const onNav = (k: string) => {
    if (k === 'home') return router.push('/scripton');
    if (k === 'reader') return router.push('/scripton/reader');
    if (k === 'breakdown') return router.push('/scripton/breakdown');
    if (k === 'doctor') return router.push('/scripton/doctor');
    if (k === 'schedule') return router.push('/scripton/schedule');
    if (k === 'reports') return router.push('/scripton/reports');
    if (k === 'coverage') return router.push('/scripton/doctor');
    if (k === 'studio') return router.push('/scripton/studio');
    if (k === 'greenlight') return router.push('/scripton/greenlight');
    if (k === 'library') return router.push('/scripton/library');
    if (k === 'settings') return router.push('/scripton/settings');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  // Render→Compare mode (new shell + a ?pass= from Render). Cold (no pass) falls
  // through to the revision picker below, which under the new flag already wears the
  // Versions rail — a live bridge, not a dead-end.
  if (flag === 'new' && passId) {
    if (!cmp) return <div style={{ position: 'fixed', inset: 0, background: '#0a0b0e', color: '#9aa1ab', display: 'grid', placeItems: 'center', fontSize: 13, zIndex: 50 }}>{t('Loading the render…')}</div>;
    return <ScriptonCompare title={title} result={cmp} vp={vp} onNav={onNav} onBack={onBack}
      onSetActive={setActive} onKeep={keepPrev} onDiscard={discardNew} busy={cmpBusy} toast={toast} />;
  }

  const RC: any = vp === 'mobile' ? ScriptOnRevisionsMobile : vp === 'tablet' ? ScriptOnRevisionsTablet : ScriptOnRevisions;
  return <RC title={title} meta={`${revs.length} ${t('revisions')}${compare ? ' · ' + t('comparing') + ' ' + compare.fromLabel + ' ↔ ' + compare.toLabel : ''}`}
    revisions={revs} activeToId={toId} onSelect={onSelect} compare={compare} loading={loading}
    onAction={onAction} onNav={onNav} onBack={onBack} toast={toast} />;
}
