'use client';
/** ScripON — Notes/Room route /scripon/notes. Under the `new` shell flag it
 *  renders the consolidated Room (notes + approval chain + distribution); `old`
 *  keeps the current notes view. Resolve→approvalsApi.routeChange is live;
 *  replies + distribution-viewed are honest next-phase stubs. */
import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi, approvalsApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriponProject } from '@/components/scripon/useScriponProject';
import ScripOnNotes, { SxNote, SxThread } from '@/components/scripon/ScripOnNotes';
import ScripOnNotesTablet from '@/components/scripon/ScripOnNotesTablet';
import ScripOnNotesMobile from '@/components/scripon/ScripOnNotesMobile';
import { useViewport } from '@/components/scripon/useViewport';
import { useScriponBack } from '@/components/scripon/useScriponBack';
import { useScriponShellFlag } from '@/components/scripon/osShellFlag';
import ScriponRoom from '@/components/scripon/room/ScriponRoom';
import { toNoteCards, filterNotes, openCount, toChainStages, pickChainRequest, toDistribution, buildThread } from '@/components/scripon/room/scripon-room.logic';

const FILTERS = ['All', 'Open', 'Resolved', '@ me', 'Story', 'Production'];
const SAMPLE_NOTES: SxNote[] = [
  { id: 'n1', av: 'MR', author: 'Marcus Rao · Director', scene: 'Sc 14', text: 'The alley ambush needs one more beat before the cars box her in — feels rushed.', meta: '3 replies · 2h · open', color: '#5b8def', status: 'open' },
  { id: 'n2', av: 'SO', author: 'S. Okonkwo · Writer', scene: 'Sc 41', text: 'Intimacy / stunt — confirm coordinator is booked before we lock the page.', meta: '1 reply · 5h · open', color: '#8b7cf0', status: 'open' },
  { id: 'n5', av: 'DK', author: 'Dana Kim · 1st AD', scene: 'Sc 31', text: 'Night turnaround is fine after the revision — closing this out.', meta: 'resolved · 2d', color: '#6b727d', status: 'resolved' },
];
const SAMPLE_THREADS: Record<string, SxThread> = {
  n1: { scene: 'SCENE 14 · EXT. ALLEY', badge: 'OPEN', badgeClass: 'amber', snip: '', bubbles: [
    { av: 'MR', author: 'Marcus Rao', time: '2h ago', text: 'The ambush needs one more beat before the cars box her in.', color: '#5b8def' },
    { av: '★', author: 'ScripON Doctor', time: 'suggestion', text: 'That beat raises tension ~12% on the pace model. Want me to branch a revision?', color: '#C6A463', doc: true },
  ] },
};
const sampleThread = (n: SxNote): SxThread => SAMPLE_THREADS[n.id] || { scene: n.scene.toUpperCase(), badge: n.status === 'resolved' ? 'RESOLVED' : 'OPEN', badgeClass: n.status === 'resolved' ? 'green' : 'amber', snip: '', bubbles: [{ av: n.av, author: n.author.split(' · ')[0], time: n.meta, text: n.text, color: n.color }] };

export default function ScripOnNotesPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBack = useScriponBack();
  const flag = useScriponShellFlag();
  const [title, setTitle] = useState('ScripON');
  const [revLabel, setRevLabel] = useState('WHITE');
  const [revColor, setRevColor] = useState('#cfd3da');
  const [rawAnn, setRawAnn] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [exports, setExports] = useState<any[]>([]);
  const [activeId, setActiveId] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriponProject(projects); if (!proj?.id) return;
        if (alive) { setTitle(proj.name || proj.title || 'ScripON'); setProjectId(proj.id); }
        try { const ar: any = await approvalsApi.forProject(proj.id); if (alive) setApprovals(Array.isArray(ar.data) ? ar.data : (ar.data?.items ?? [])); } catch { /* none */ }
        try { const ex: any = await productionApi.scripton.reviewProtection.listExports(proj.id); if (alive) setExports(Array.isArray(ex.data) ? ex.data : (ex.data?.items ?? ex.data?.exports ?? [])); } catch { /* none */ }
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const revId = docs[0]?.activeRevisionId || docs[0]?.revisions?.[0]?.id; if (!revId) return;
        try { const rv: any = await productionApi.script.getRevision(revId); if (alive && rv.data) { setRevLabel(rv.data.revisionLabel || 'WHITE'); setRevColor(rv.data.colorCode || '#cfd3da'); } } catch { /* */ }
        const an: any = await productionApi.scriptAnnotations.list(revId).catch(() => null);
        const list: any[] = Array.isArray(an?.data) ? an.data : (an?.data?.items ?? an?.data?.annotations ?? []);
        if (alive) setRawAnn(list);
      } catch { /* keep empty */ }
    })();
    return () => { alive = false; };
  }, []);

  const realNotes = useMemo(() => toNoteCards(rawAnn), [rawAnn]);
  // OLD path keeps the sample fallback; NEW Room shows real data (empty state when none).
  const oldNotes = realNotes.length ? (realNotes as SxNote[]) : SAMPLE_NOTES;
  const newNotes = realNotes;

  const resolveNote = (note?: { id: string; text: string } | null) => {
    const real = !!note && /^[a-z0-9]{16,}$/i.test(note.id);
    if (projectId && note && real) {
      approvalsApi.routeChange({ projectId, entityType: 'ANNOTATION_RESOLVE', entityId: note.id, title: 'Resolve note: ' + String(note.text || '').slice(0, 50) })
        .then(() => flash(t('Resolution sent for sign-off → Approvals.')))
        .catch((e: any) => flash(e?.response?.data?.message || t('Could not route — backend on :3001?')));
    } else { flash(projectId ? t('Resolved.') : t('Resolved (demo).')); }
  };

  const onNav = (k: string) => {
    if (k === 'room') return;
    if (k === 'home') return router.push('/scripon');
    if (k === 'reader') return router.push('/scripon/reader');
    if (k === 'breakdown') return router.push('/scripon/breakdown');
    if (k === 'doctor') return router.push('/scripon/doctor');
    if (k === 'schedule') return router.push('/scripon/schedule');
    if (k === 'reports') return router.push('/scripon/reports');
    if (k === 'coverage') return router.push('/scripon/doctor');
    if (k === 'studio') return router.push('/scripon/settings');
    if (k === 'greenlight') return router.push('/scripon/greenlight');
    if (k === 'library') return router.push('/scripon/library');
    if (k === 'settings') return router.push('/scripon/settings');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  if (flag === 'new') {
    const shown = filterNotes(newNotes, activeFilter);
    const selected = newNotes.find((n) => n.id === activeId) || shown[0] || newNotes[0] || null;
    const chainReq = pickChainRequest(approvals, selected?.id);
    const chainStages = toChainStages(chainReq);
    const chainTitle = chainReq ? String(chainReq.entityType || '').replace(/_/g, ' ').toLowerCase() : '';
    return (
      <ScriponRoom
        title={title} revisionLabel={revLabel} revisionColor={revColor}
        filters={FILTERS} activeFilter={activeFilter} onFilter={setActiveFilter}
        notes={shown} openLabel={`${openCount(newNotes)} ${t('open')}`} selectedId={selected?.id} onSelect={setActiveId}
        thread={buildThread(selected)} chainStages={chainStages} chainTitle={chainTitle}
        distribution={toDistribution(exports)} kernelInert
        onResolve={() => resolveNote(selected)} onReply={() => flash(t('Replies post in the next phase — collaboration threads are wiring up.'))}
        onNav={onNav} onBack={onBack} toast={toast} vp={vp}
      />
    );
  }

  // ── old fallback — the existing notes view ──
  const oldShown = activeFilter === 'Open' ? oldNotes.filter((n) => n.status === 'open') : activeFilter === 'Resolved' ? oldNotes.filter((n) => n.status === 'resolved') : oldNotes;
  const oldActive = oldNotes.find((n) => n.id === activeId) || oldShown[0] || oldNotes[0];
  const oldThread = oldActive ? sampleThread(oldActive) : null;
  const onAction = (k: string) => {
    if (k === 'resolve') return resolveNote(oldActive);
    const m: Record<string, string> = { send: t('Replies post in the next phase — collaboration threads are wiring up.'), new: t('New note composer ships in the next phase.') };
    flash(m[k] || t('Coming soon.'));
  };
  const RC: any = vp === 'mobile' ? ScripOnNotesMobile : vp === 'tablet' ? ScripOnNotesTablet : ScripOnNotes;
  return <RC title={title} meta={`${t('Notes')} · ${oldNotes.filter((n) => n.status === 'open').length} ${t('open')} · ${oldNotes.length} ${t('total')}`}
    filters={FILTERS} activeFilter={activeFilter} onFilter={setActiveFilter}
    notes={oldShown} activeId={oldActive?.id} onSelect={setActiveId} thread={oldThread}
    onAction={onAction} onNav={onNav} onBack={onBack} toast={toast} />;
}
