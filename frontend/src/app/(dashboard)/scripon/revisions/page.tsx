'use client';
/** ScripON Doctor — Revisions & Compare route /scripon/revisions. Timeline ⇄ doc.revisions; diff ⇄ two revisions' scenes. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriponProject } from '@/components/scripon/useScriponProject';
import ScripOnRevisions, { SxRev, SxCompare, SxLine } from '@/components/scripon/ScripOnRevisions';
import ScripOnRevisionsTablet from '@/components/scripon/ScripOnRevisionsTablet';
import ScripOnRevisionsMobile from '@/components/scripon/ScripOnRevisionsMobile';
import { useViewport } from '@/components/scripon/useViewport';
import { useScriponBack } from '@/components/scripon/useScriponBack';

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

export default function ScripOnRevisionsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBack = useScriponBack();
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
        const proj = pickScriponProject(projects); if (!proj?.id) return;
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

  const onSelect = (id: string) => {
    setToId(id);
    if (!rawRevs.length) return; // sample mode
    const idx = revs.findIndex((r) => r.id === id); const to = revs[idx]; const from = revs[idx + 1];
    if (to && from) buildDiff(from, to); else setCompare(null);
  };
  const onAction = (k: string) => flash(k === 'new' ? t('New revision (colour-advance) ships in the next phase here.') : k === 'restore' ? t('Restore-a-draft ships in the next phase.') : t('Export revised pages ships in the next phase.'));
  const onNav = (k: string) => {
    if (k === 'home') return router.push('/scripon');
    if (k === 'reader') return router.push('/scripon/reader');
    if (k === 'breakdown') return router.push('/scripon/breakdown');
    if (k === 'doctor') return router.push('/scripon/doctor');
    if (k === 'schedule') return router.push('/scripon/schedule');
    if (k === 'reports') return router.push('/scripon/reports');
    if (k === 'coverage') return router.push('/scripon/doctor');
    if (k === 'studio') return router.push('/scripon/studio');
    if (k === 'greenlight') return router.push('/scripon/greenlight');
    if (k === 'library') return router.push('/scripon/library');
    if (k === 'settings') return router.push('/scripon/settings');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  const RC: any = vp === 'mobile' ? ScripOnRevisionsMobile : vp === 'tablet' ? ScripOnRevisionsTablet : ScripOnRevisions;
  return <RC title={title} meta={`${revs.length} ${t('revisions')}${compare ? ' · ' + t('comparing') + ' ' + compare.fromLabel + ' ↔ ' + compare.toLabel : ''}`}
    revisions={revs} activeToId={toId} onSelect={onSelect} compare={compare} loading={loading}
    onAction={onAction} onNav={onNav} onBack={onBack} toast={toast} />;
}
