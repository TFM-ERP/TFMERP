'use client';
/** ScripON Doctor — Notes & Collaboration route /scripon/notes. Best-effort bind to scriptAnnotations.list; sample threads. */
import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi , approvalsApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriponProject } from '@/components/scripon/useScriponProject';
import ScripOnNotes, { SxNote, SxThread, SxBubble } from '@/components/scripon/ScripOnNotes';
import ScripOnNotesTablet from '@/components/scripon/ScripOnNotesTablet';
import ScripOnNotesMobile from '@/components/scripon/ScripOnNotesMobile';
import { useViewport } from '@/components/scripon/useViewport';

const FILTERS = ['All', 'Open', 'Resolved', '@ me', 'Story', 'Production'];
const SAMPLE_NOTES: SxNote[] = [
  { id: 'n1', av: 'MR', author: 'Marcus Rao · Director', scene: 'Sc 14', text: 'The alley ambush needs one more beat before the cars box her in — feels rushed.', meta: '3 replies · 2h · open', color: '#5b8def', status: 'open' },
  { id: 'n2', av: 'SO', author: 'S. Okonkwo · Writer', scene: 'Sc 41', text: 'Intimacy / stunt — confirm coordinator is booked before we lock the page.', meta: '1 reply · 5h · open', color: '#8b7cf0', status: 'open' },
  { id: 'n3', av: 'LP', author: 'Lena Park · Producer', scene: 'Sc 22', text: 'Diner is over the day-rate cap — can we merge with the bar day?', meta: '4 replies · 1d · open', color: '#57b368', status: 'open' },
  { id: 'n4', av: 'JV', author: 'J. Vega · Script sup.', scene: 'Sc 6', text: "Continuity: Sarah's jacket changes between 6 and 8.", meta: '2 replies · 3d · open', color: '#e0a23b', status: 'open' },
  { id: 'n5', av: 'DK', author: 'Dana Kim · 1st AD', scene: 'Sc 31', text: 'Night turnaround is fine after the revision — closing this out.', meta: 'resolved · 2d', color: '#6b727d', status: 'resolved' },
];
const SAMPLE_THREADS: Record<string, SxThread> = {
  n1: { scene: 'SCENE 14 · EXT. ALLEY', badge: 'OPEN', badgeClass: 'amber', snip: "14  EXT. ALLEY — NIGHT\n\nSarah presses into the shadow. Headlights sweep the alley mouth. Two cars. They've boxed the street.",
    bubbles: [
      { av: 'MR', author: 'Marcus Rao', time: '2h ago', text: 'The ambush needs one more beat before the cars box her in — feels rushed on the page.', color: '#5b8def' },
      { av: 'SO', author: 'S. Okonkwo', time: '1h ago', text: 'Agreed. I added "too fast for a patrol" — gives her a half-second to read it. Pushed to Blue v4.', color: '#8b7cf0' },
      { av: '★', author: 'ScripON Doctor', time: 'suggestion', text: 'That beat raises tension ~12% on the pace model. Want me to draft a 2-line alternate and branch a revision?', color: '#C6A463', doc: true },
    ] },
};
const buildThread = (n: SxNote): SxThread => SAMPLE_THREADS[n.id] || { scene: `${n.scene.toUpperCase()}`, badge: n.status === 'resolved' ? 'RESOLVED' : 'OPEN', badgeClass: n.status === 'resolved' ? 'green' : 'amber', snip: '', bubbles: [{ av: n.av, author: n.author.split(' · ')[0], time: n.meta, text: n.text, color: n.color }] };

export default function ScripOnNotesPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const [title, setTitle] = useState('Midnight Run');
  const [notes, setNotes] = useState<SxNote[]>(SAMPLE_NOTES);
  const [activeId, setActiveId] = useState('n1');
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
        if (alive) { setTitle(proj.name || proj.title || 'Project'); setProjectId(proj.id); }
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const revId = docs[0]?.activeRevisionId || docs[0]?.revisions?.[0]?.id; if (!revId) return;
        const an: any = await productionApi.scriptAnnotations.list(revId).catch(() => null);
        const list: any[] = Array.isArray(an?.data) ? an.data : (an?.data?.items ?? an?.data?.annotations ?? []);
        const mapped = list.filter((a) => a?.body || a?.text || a?.note).slice(0, 24).map((a, i): SxNote => {
          const who = a.author || a.createdBy || 'Collaborator';
          return { id: a.id || ('a' + i), av: String(who).split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(), author: who, scene: a.sceneNumber ? `Sc ${a.sceneNumber}` : (a.sceneRef || 'Script'), text: a.body || a.text || a.note, meta: (a.resolved ? 'resolved' : 'open') + (a.createdAt ? ' · ' + new Date(a.createdAt).toLocaleDateString() : ''), color: '#5b8def', status: a.resolved ? 'resolved' : 'open' };
        });
        if (alive && mapped.length) { setNotes(mapped); setActiveId(mapped[0].id); }
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    if (activeFilter === 'All') return notes;
    if (activeFilter === 'Open') return notes.filter((n) => n.status === 'open');
    if (activeFilter === 'Resolved') return notes.filter((n) => n.status === 'resolved');
    return notes;
  }, [notes, activeFilter]);
  const active = notes.find((n) => n.id === activeId) || shown[0] || notes[0];
  const thread = active ? buildThread(active) : null;

  const onAction = (k: string) => {
    if (k === 'resolve') {
      const real = !!active && /^[a-z0-9]{16,}$/i.test(active.id) && !/^[na]\d+$/.test(active.id);
      if (projectId && active && real) {
        approvalsApi.routeChange({ projectId, entityType: 'ANNOTATION_RESOLVE', entityId: active.id, title: 'Resolve note: ' + String(active.text || '').slice(0, 50) }).then(() => flash(t('Resolution sent for sign-off \u2192 Approvals.'))).catch((e: any) => flash(e?.response?.data?.message || t('Could not route \u2014 backend on :3001?')));
      } else { flash(projectId ? t('Resolved.') : t('Resolved (demo).')); }
      return;
    }
    const m: Record<string, string> = { send: t('Replies post in the next phase — collaboration threads are wiring up.'), resolve: t('Resolve ships in the next phase.'), resolveall: t('Bulk resolve ships in the next phase.'), assign: t('Assign ships in the next phase.'), new: t('New note composer ships in the next phase.'), filter: t('More filters ship next.') };
    flash(m[k] || t('Coming soon.'));
  };
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

  const RC: any = vp === 'mobile' ? ScripOnNotesMobile : vp === 'tablet' ? ScripOnNotesTablet : ScripOnNotes;
  return <RC title={title} meta={`${t('Notes')} · ${notes.filter((n) => n.status === 'open').length} ${t('open')} · ${notes.length} ${t('total')}`}
    filters={FILTERS} activeFilter={activeFilter} onFilter={setActiveFilter}
    notes={shown} activeId={active?.id} onSelect={setActiveId} thread={thread}
    onAction={onAction} onNav={onNav} onBack={() => router.push('/home')} toast={toast} />;
}
