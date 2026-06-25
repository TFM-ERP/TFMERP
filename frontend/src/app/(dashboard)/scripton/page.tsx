'use client';
/**
 * ScriptON Doctor workspace HOME — command-centre Dashboard (carbon-copy of design/dashboard.html).
 * Flagged route /scripton. Reader lives at /scripton/reader. Existing /scripts + /script-workspace untouched.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import ScriptOnDashboard, { SxDash } from '@/components/scripton/ScriptOnDashboard';
import ScriptOnDashboardTablet from '@/components/scripton/ScriptOnDashboardTablet';
import ScriptOnDashboardMobile from '@/components/scripton/ScriptOnDashboardMobile';
import { useViewport } from '@/components/scripton/useViewport';
import { useLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import { useScriptonShellFlag } from '@/components/scripton/osShellFlag';
import ScriptonHome from '@/components/scripton/home/ScriptonHome';

/** /scripton — the OS Home. Under the `new` shell it's the rebuilt Home/Slate;
 *  `old` keeps the previous command-centre dashboard as an instant fallback. */
export default function ScriptOnHomePage() {
  const flag = useScriptonShellFlag();
  if (flag === 'new') return <ScriptonHome />;
  return <LegacyHome />;
}

const SAMPLE: SxDash = {
  title: 'Midnight Run', meta: 'Feature · prep · 18 days to camera', revisionLabel: 'BLUE · v4', revisionColor: '#5b8def',
  kpis: [
    { label: 'SCENES', value: '64', caption: '9 INT · 5 EXT night' },
    { label: 'PAGES', value: '111', caption: '~1.9 hr runtime' },
    { label: 'SHOOT DAYS', value: '18', caption: '6.2 pp/day' },
    { label: 'LOCATIONS', value: '11', caption: '3 over budget', tone: 'var(--amber)' },
    { label: 'BUDGET (EFC)', value: '$1.24M', caption: '+2% vs plan', tone: 'var(--green)' },
    { label: 'COVERAGE', value: 'CONSIDER', caption: 'Plot B/4 · Dlg A-' },
  ],
  loop: [
    { label: 'Script', caption: 'Locked · Blue v4', pct: 100, done: true },
    { label: 'Breakdown', caption: '82% tagged · 52 / 64', pct: 82 },
    { label: 'Schedule', caption: '60% · 18 shoot days', pct: 60 },
    { label: 'Budget', caption: '$1.24M · on track', pct: 74 },
    { label: 'Coverage', caption: 'CONSIDER · 2h ago', pct: 55, tone: 'var(--amber)' },
  ],
  needs: [
    { text: 'Act 2 midpoint reads flat — Doctor suggests pulling the betrayal 6 pages earlier.', badge: 'HIGH', level: 'high' },
    { text: '3 locations exceed the day-rate cap — budget-fit can consolidate the diner + bar.', badge: 'MED', level: 'med' },
    { text: 'Scene 14 → 15 turnaround risk: night shoot runs past wrap window.', badge: 'MED', level: 'med' },
    { text: '2 speaking roles still uncast (LEO, the BROKER).', badge: 'CAST', level: 'info' },
  ],
  activity: [
    { text: 'Coverage regenerated on Blue v4', when: '2h ago', color: 'var(--gold)' },
    { text: 'Budget-fit branched “Lean 5-location” revision', when: 'yesterday', color: 'var(--blue)' },
    { text: 'Breakdown synced 11 new strips to Schedule', when: 'yesterday', color: 'var(--green)' },
  ],
  status: { coverage: 'CONSIDER', coverageTone: 'amber', revisions: 'White · Blue · Pink · Blue v4 · +1', notes: '7 · 2 unresolved' },
};

const REC_TONE: Record<string, string> = { RECOMMEND: 'green', CONSIDER: 'amber', PASS: 'red' };

function LegacyHome() {
  const router = useRouter();
  const vp = useViewport();
  const { t } = useLocale();
  const onBack = useScriptonBack();
  const [data, setData] = useState<SxDash>(SAMPLE);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriptonProject(projects);
        if (!proj?.id) return;
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0];
        const revId = doc?.activeRevisionId || doc?.revisions?.[0]?.id;
        let rev: any = null; let scenes: any[] = [];
        if (revId) { const rv: any = await productionApi.script.getRevision(revId); rev = rv.data; scenes = rv.data?.scenes ?? []; }
        let cov: any = null;
        try { const cr: any = await productionApi.scripton.latestCoverage(proj.id); cov = cr.data || null; } catch { /* none */ }
        if (!alive) return;
        const rec = cov?.recommendation || cov?.verdict;
        const revs: any[] = doc?.revisions ?? [];
        const next: SxDash = {
          title: proj.name || proj.title || 'Project',
          meta: [proj.projectType, proj.status].filter(Boolean).join(' · ') || 'Production',
          revisionLabel: rev?.revisionLabel || 'CURRENT',
          revisionColor: rev?.colorCode || '#5b8def',
          kpis: [
            { label: 'SCENES', value: String(scenes.length || '—'), caption: scenes.length ? 'from active revision' : 'no script yet' },
            { label: 'PAGES', value: rev?.pageCount ? String(rev.pageCount) : '—', caption: '' },
            { label: 'SHOOT DAYS', value: '—', caption: 'from schedule' },
            { label: 'LOCATIONS', value: '—', caption: 'from breakdown' },
            { label: 'BUDGET (EFC)', value: '—', caption: 'from budget' },
            { label: 'COVERAGE', value: rec || '—', caption: cov ? 'latest run' : 'not run yet', tone: rec ? `var(--${REC_TONE[rec] === 'green' ? 'green' : REC_TONE[rec] === 'red' ? 'red' : 'amber'})` : undefined },
          ],
          loop: [
            { label: 'Script', caption: rev ? `Locked · ${rev.revisionLabel || 'current'}` : 'No script', pct: rev ? 100 : 0, done: !!rev },
            { label: 'Breakdown', caption: '—', pct: 0 },
            { label: 'Schedule', caption: '—', pct: 0 },
            { label: 'Budget', caption: '—', pct: 0 },
            { label: 'Coverage', caption: rec ? `${rec}` : 'not run', pct: rec ? 55 : 0, tone: 'var(--amber)' },
          ],
          needs: [
            ...(rec && rec !== 'RECOMMEND' ? [{ text: `Coverage came back ${rec} — open the Doctor to work the notes.`, badge: rec, level: 'med' as const }] : []),
            ...(scenes.filter((s) => !s.description).length ? [{ text: `${scenes.filter((s) => !s.description).length} scenes have no action text yet.`, badge: 'SCRIPT', level: 'info' as const }] : []),
          ],
          activity: revs.slice(0, 3).map((r: any) => ({ text: `Revision ${r.revisionLabel || ''} added`, when: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '', color: r.colorCode || 'var(--blue)' })),
          status: { coverage: rec || '—', coverageTone: rec ? (REC_TONE[rec] || 'amber') : 'amber', revisions: String(revs.length || '—'), notes: '—' },
        };
        setData(next);
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const onNav = (k: string) => {
    if (k === 'home') return;
    if (k === 'reader') return router.push('/scripton/reader');
    if (k === 'library') return router.push('/scripton/library');
    if (k === 'settings') return router.push('/scripton/settings');
    if (k === 'reports') return router.push('/scripton/reports');
    if (k === 'approvals') return router.push('/scripton/approvals');
    if (k === 'breakdown') return router.push('/scripton/breakdown');
    if (k === 'doctor') return router.push('/scripton/doctor');
    if (k === 'schedule') return router.push('/scripton/schedule');
    const names: Record<string, string> = { reports: 'Reports' };
    flash(`${names[k] || k} ${t('is a later screen in the build order.')}`);
  };
  const onQuick = (_k: string) => router.push('/scripton/reader');

  const v2nav = null;
  if (vp === 'mobile') return (<><ScriptOnDashboardMobile data={data} onNav={onNav} onBack={onBack} onQuick={onQuick} />{v2nav}</>);
  if (vp === 'tablet') return (<><ScriptOnDashboardTablet data={data} onNav={onNav} onBack={onBack} onQuick={onQuick} />{v2nav}</>);
  return (<><ScriptOnDashboard data={data} onNav={onNav} onBack={onBack} onQuick={onQuick} toast={toast} />{v2nav}</>);
}
