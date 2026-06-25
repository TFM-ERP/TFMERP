'use client';
/** ScriptON Doctor — Schedule & Budget route /scripton/schedule. Board ⇄ scheduling.board, budget ⇄ breakdown.budgetPreview. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import ScriptOnSchedule, { SxDay, SxBudRow, SxKpi } from '@/components/scripton/ScriptOnSchedule';
import ScriptOnScheduleTablet from '@/components/scripton/ScriptOnScheduleTablet';
import ScriptOnScheduleMobile from '@/components/scripton/ScriptOnScheduleMobile';
import { useViewport } from '@/components/scripton/useViewport';
import ScriptOnBudgetFit from '@/components/scripton/ScriptOnBudgetFit';
import { useLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';

const STRIP_COLOR: Record<string, { bg: string; fg: string }> = {
  'INT/DAY': { bg: '#f2ecd6', fg: '#2a2410' }, 'EXT/DAY': { bg: '#f4d79a', fg: '#2e2208' },
  'INT/NIGHT': { bg: '#cfe0ff', fg: '#10243f' }, 'EXT/NIGHT': { bg: '#bfe6c6', fg: '#0f2b16' },
};
const eighths = (p: number) => { if (!p) return ''; let w = Math.floor(p); let f = Math.round((p - w) * 8); if (f === 8) { w++; f = 0; } return `${w || ''}${f ? (w ? ' ' : '') + f + '/8' : ''}`.trim() || '0'; };
const money = (n: number) => '$' + (n >= 1000 ? (n / 1000).toFixed(n >= 1e6 ? 2 : 0).replace(/\.00$/, '') + (n >= 1e6 ? 'M' : 'k') : String(Math.round(n)));

const SAMPLE_KPIS: SxKpi[] = [
  { label: 'SHOOT DAYS', value: '18', caption: '+1 vs plan' },
  { label: 'PAGES / DAY', value: '6.2', caption: 'target ≤ 6.5' },
  { label: 'EFC', value: '$1.24M', caption: '+2% vs $1.20M', tone: 'var(--amber)' },
  { label: 'OVER-CAP DAYS', value: '3', caption: 'night premiums', tone: 'var(--amber)' },
  { label: 'COMPANY MOVES', value: '5', caption: '−1 if merged', tone: 'var(--green)' },
];
const SAMPLE_DAYS: SxDay[] = [
  { label: 'Day 1', sub: 'Mon · Stage A', pp: '5.1 pp', ppTone: 'green', strips: [
    { num: '1', slug: "INT. SARAH'S APT — NIGHT", pp: '2/8', cast: 'Sarah · Riley', bg: '#cfe0ff', fg: '#10243f' },
    { num: '3', slug: 'INT. STAIRWELL — NIGHT', pp: '1 3/8', cast: 'Sarah', bg: '#cfe0ff', fg: '#10243f' },
    { num: '6', slug: 'INT. LOBBY — NIGHT', pp: '1 1/8', cast: 'Sarah · Broker', bg: '#cfe0ff', fg: '#10243f' } ] },
  { label: 'Day 2', sub: 'Tue · Downtown', pp: '7.0 pp', ppTone: 'amber', strips: [
    { num: '14', slug: 'EXT. ALLEY — NIGHT', pp: '3/8', cast: 'Sarah · Riley', bg: '#bfe6c6', fg: '#0f2b16' },
    { num: '15', slug: 'EXT. ROOFTOP — NIGHT', pp: '2 2/8', cast: 'Sarah', bg: '#bfe6c6', fg: '#0f2b16' },
    { num: '17', slug: 'INT. CAR — NIGHT', pp: '1 4/8', cast: 'Sarah · Riley', bg: '#cfe0ff', fg: '#10243f' } ] },
  { label: 'Day 3', sub: 'Wed · Diner', pp: '6.0 pp', ppTone: 'green', strips: [
    { num: '22', slug: 'INT. DINER — DAY', pp: '3 1/8', cast: 'Sarah · Leo', bg: '#f2ecd6', fg: '#2a2410' },
    { num: '23', slug: 'EXT. DINER — DAY', pp: '1 2/8', cast: 'Sarah', bg: '#f4d79a', fg: '#2e2208' } ] },
  { label: 'Day 4', sub: 'Thu · Bar', pp: '5.5 pp', ppTone: 'green', strips: [
    { num: '31', slug: 'INT. BAR — NIGHT', pp: '2 6/8', cast: 'Sarah · Broker', bg: '#cfe0ff', fg: '#10243f' },
    { num: '34', slug: 'INT. BACK ROOM — NIGHT', pp: '1 7/8', cast: 'Riley', bg: '#cfe0ff', fg: '#10243f' } ] },
];
const SAMPLE_BUDGET: SxBudRow[] = [
  { name: 'Cast (ATL)', val: '$312k / $300k', pct: 100, tone: 'var(--amber)' },
  { name: 'Crew', val: '$418k / $430k', pct: 88, tone: 'var(--green)' },
  { name: 'Locations', val: '$196k / $170k', pct: 100, tone: 'var(--red)' },
  { name: 'Equipment', val: '$184k / $200k', pct: 80, tone: 'var(--green)' },
  { name: 'Post', val: '$130k / $150k', pct: 74, tone: 'var(--green)' },
];
const SAMPLE_SUGGEST = { text: 'Merge the diner (Sc 22-23) and bar (Sc 31-34) into one location day.', saves: '1 shoot day · $42k', cost: '+1 company move (Sc 34 night)' };

const asArray = (x: any): any[] => Array.isArray(x) ? x : [];

export default function ScriptOnSchedulePage() {
  const router = useRouter();
  const vp = useViewport();
  const { t } = useLocale();
  const onBack = useScriptonBack();
  const [title, setTitle] = useState('Midnight Run');
  const [meta, setMeta] = useState(() => `${t('Schedule')} · 18 ${t('shoot days')} · EFC $1.24M`);
  const [kpis, setKpis] = useState<SxKpi[]>(SAMPLE_KPIS);
  const [days, setDays] = useState<SxDay[]>(SAMPLE_DAYS);
  const [budget, setBudget] = useState<SxBudRow[]>(SAMPLE_BUDGET);
  const [suggestion, setSuggestion] = useState<{ text: string; saves: string; cost: string } | null>(() => ({ text: t(SAMPLE_SUGGEST.text), saves: t(SAMPLE_SUGGEST.saves), cost: t(SAMPLE_SUGGEST.cost) }));
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeRev, setActiveRev] = useState<any>(null);
  const [surface, setSurface] = useState<null | 'budgetfit'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriptonProject(projects); if (!proj?.id) return;
        const bd: any = await productionApi.scheduling.board(proj.id).catch(() => null);
        const raw = bd?.data || {};
        let strips: any[] = asArray(raw.strips).length ? raw.strips : asArray(raw.items).length ? raw.items : Array.isArray(raw) ? raw : [];
        if (!strips.length && Array.isArray(raw.days)) strips = raw.days.flatMap((d: any) => asArray(d.strips).map((s: any) => ({ ...s, shootDay: s.shootDay ?? d.day ?? d.shootDay })));
        strips = strips.filter((s) => !s.isBanner);
        if (!alive) return;
        setProjectId(proj.id); setTitle(proj.name || proj.title || 'Project');
        try { const drr: any = await productionApi.script.list(proj.id); const doc = (Array.isArray(drr.data) ? drr.data : drr.data?.items ?? [])[0]; const revId = doc?.activeRevisionId || doc?.revisions?.[0]?.id; if (revId) { const rv: any = await productionApi.script.getRevision(revId); if (alive) setActiveRev(rv.data); } } catch { /* */ }

        if (strips.length) {
          const byDay = new Map<number, any[]>();
          for (const s of strips) { const d = Number(s.shootDay || 0); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(s); }
          const dayNums = Array.from(byDay.keys()).filter((d) => d > 0).sort((a, b) => a - b);
          const builtDays: SxDay[] = dayNums.map((dn) => {
            const list = byDay.get(dn)!.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            const pp = list.reduce((n, s) => n + Number(s.pages || 0), 0);
            const tone = pp <= 6.5 ? 'green' : pp <= 7.5 ? 'amber' : 'red';
            return {
              label: `Day ${dn}`, sub: list[0]?.location || list[0]?.setName || '—',
              pp: (Math.round(pp * 10) / 10) + ' pp', ppTone: tone,
              strips: list.map((s) => {
                const ie = String(s.intExt || 'INT'); const dnn = String(s.dayNight || 'DAY'); const col = STRIP_COLOR[`${ie}/${dnn}`] || STRIP_COLOR['INT/DAY'];
                const cast = Array.isArray(s.cast) ? s.cast.slice(0, 3).join(' · ') : '';
                return { num: String(s.sceneNumber || ''), slug: `${ie}. ${s.setName || s.location || s.description || 'SCENE'} — ${dnn}`.toUpperCase(), pp: eighths(Number(s.pages || 0)), cast, bg: col.bg, fg: col.fg };
              }),
            };
          });
          const totalPP = strips.reduce((n, s) => n + Number(s.pages || 0), 0);
          const overCap = builtDays.filter((d) => parseFloat(d.pp) > 6.5).length;
          const moves = builtDays.reduce((n, d, i) => n + (i > 0 && d.sub !== builtDays[i - 1].sub ? 1 : 0), 0);
          setDays(builtDays);
          setKpis([
            { label: 'SHOOT DAYS', value: String(dayNums.length), caption: 'scheduled' },
            { label: 'PAGES / DAY', value: dayNums.length ? (Math.round((totalPP / dayNums.length) * 10) / 10).toFixed(1) : '—', caption: 'target ≤ 6.5' },
            { label: 'EFC', value: '—', caption: 'from budget' },
            { label: 'OVER-CAP DAYS', value: String(overCap), caption: '> 6.5 pp', tone: overCap ? 'var(--amber)' : 'var(--green)' },
            { label: 'COMPANY MOVES', value: String(moves), caption: 'location changes', tone: 'var(--mute)' },
          ]);
          setMeta(`${t('Schedule')} · ${dayNums.length} ${t('shoot days')}`);
          setSuggestion(null);
        }

        try {
          const bp: any = await productionApi.breakdown.budgetPreview(proj.id);
          const d = bp?.data || {};
          const cats: any[] = asArray(d.categories).length ? d.categories : asArray(d.rows).length ? d.rows : asArray(d.lines).length ? d.lines : asArray(d.byCategory);
          if (cats.length) {
            const rows = cats.map((c: any) => ({ name: c.name || c.title || c.category || c.code || '—', amt: Number(c.est ?? c.amount ?? c.total ?? c.budget ?? 0) }));
            const max = Math.max(1, ...rows.map((r) => r.amt));
            if (alive) setBudget(rows.slice(0, 6).map((r) => ({ name: r.name, val: money(r.amt), pct: Math.round((100 * r.amt) / max), tone: 'var(--green)' })));
            const total = Number(d.total ?? d.efc ?? rows.reduce((n, r) => n + r.amt, 0));
            if (alive && total) setKpis((k) => k.map((x) => x.label === 'EFC' ? { ...x, value: money(total), caption: 'estimated' } : x));
          }
        } catch { /* keep sample budget */ }
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const onAction = (k: string) => {
    if (k === 'budgetfit') { if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to run Budget-fit.')); return; } return setSurface('budgetfit'); }
    if (k === 'optimise') { if (!projectId) { flash(t('Connect a project to optimise.')); return; } (async () => { try { const r: any = await productionApi.scheduling.optimize(projectId, { apply: false }); const d = r?.data || {}; const dn = d.days ?? d.shootDays ?? (Array.isArray(d.strips) ? new Set(d.strips.filter((s: any) => s.shootDay > 0).map((s: any) => s.shootDay)).size : undefined); flash(dn != null ? `${t('Optimiser preview:')} ${dn} ${t('shoot days. Apply on the classic Scheduling board.')}` : t('Optimiser ran — review on the classic Scheduling board.')); } catch (e: any) { flash(e?.response?.status ? `${t('Optimise failed')} (HTTP ${e.response.status}).` : t('Optimise failed — backend not reachable on :3001.')); } })(); return; }
    const m: Record<string, string> = { recalc: t('Recalc-from-breakdown ships in the next phase here.') };
    flash(m[k] || t('Coming soon.'));
  };
  const onNav = (k: string) => {
    if (k === 'schedule') return;
    if (k === 'home') return router.push('/scripton');
    if (k === 'reader') return router.push('/scripton/reader');
    if (k === 'breakdown') return router.push('/scripton/breakdown');
    if (k === 'doctor') return router.push('/scripton/doctor');
    if (k === 'library') return router.push('/scripton/library');
    if (k === 'settings') return router.push('/scripton/settings');
    if (k === 'reports') return router.push('/scripton/reports');
    if (k === 'coverage') return router.push('/scripton/doctor');
    if (k === 'studio') return router.push('/scripton/studio');
    if (k === 'greenlight') return router.push('/scripton/greenlight');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  const common = { title, meta, kpis, days, budget, suggestion, onAction, onNav, onBack, toast };
  const body = vp === 'mobile' ? <ScriptOnScheduleMobile {...common} /> : vp === 'tablet' ? <ScriptOnScheduleTablet {...common} /> : <ScriptOnSchedule {...common} />;
  return (<>{body}{surface === 'budgetfit' && activeRev?.id && (<ScriptOnBudgetFit projectId={projectId!} revisionId={activeRev.id} onClose={() => setSurface(null)} />)}</>);
}
