'use client';
/** ScripON Greenlight route. P5 Market + P7 Decision — live engines; tabs render Market/Audience/Cost/Decision panels. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { pickScriponProject } from '@/components/scripon/useScriponProject';
import ScripOnGreenlight, { SxComp, SxFcast, SxRoi, SxDecision } from '@/components/scripon/ScripOnGreenlight';
import ScripOnGreenlightTablet from '@/components/scripon/ScripOnGreenlightTablet';
import ScripOnGreenlightMobile from '@/components/scripon/ScripOnGreenlightMobile';
import { useViewport } from '@/components/scripon/useViewport';
import { useLocale } from '@/lib/i18n';

const SAMPLE_COMPS: SxComp[] = [
  { name: 'Collateral', sim: 82, gross: '$220M' }, { name: 'Nightcrawler', sim: 76, gross: '$50M' },
  { name: 'Drive', sim: 71, gross: '$81M' }, { name: 'The Town', sim: 66, gross: '$154M' },
];
const SAMPLE_FCAST: SxFcast[] = [
  { label: 'Theatrical', pct: 55, color: 'var(--blue)', bandLeft: 46, bandWidth: 18, value: '$38M' },
  { label: 'Streaming', pct: 68, color: 'var(--violet)', bandLeft: 60, bandWidth: 16, value: '$51M' },
  { label: 'International', pct: 44, color: 'var(--green)', bandLeft: 36, bandWidth: 16, value: '$29M' },
  { label: 'Total (P50)', pct: 60, color: 'linear-gradient(90deg,var(--gold),var(--gold2))', value: '$118M', gold: true },
];
const SAMPLE_ROI: SxRoi[] = [
  { case: 'Base', rev: '$118M', margin: '+$41M', roi: '3.3×' }, { case: 'High', rev: '$190M', margin: '+$78M', roi: '5.1×' },
  { case: 'Downside', rev: '$54M', margin: '+$9M', roi: '1.4×', tone: 'var(--amber)' },
];
const SAMPLE_DECISION: SxDecision = {
  scorecard: [
    { criterion: 'Story', weight: 0.25, score: 8, note: 'Strong one-night engine' },
    { criterion: 'Cast-ability', weight: 0.15, score: 7, note: 'Lead-driven' },
    { criterion: 'Market', weight: 0.2, score: 7, note: 'Proven thriller comps' },
    { criterion: 'Budget-fit', weight: 0.15, score: 8, note: 'Lean on a real negative' },
    { criterion: 'Differentiation', weight: 0.15, score: 7, note: 'Fresh setting' },
    { criterion: 'Risk', weight: 0.1, score: 6, note: 'Act-2 soft' },
  ],
  audience: [
    { quadrant: 'Younger / Male', appeal: 'High — kinetic, propulsive thriller with a hard clock.' },
    { quadrant: 'Younger / Female', appeal: 'Med-high — a capable lead and a moral hook.' },
    { quadrant: 'Older / Male', appeal: 'Med-high — grounded genre in the Collateral lineage.' },
    { quadrant: 'Older / Female', appeal: 'Med — the loyalty / betrayal core travels.' },
  ],
  costOps: [
    { item: 'Shoot on a GCC incentive', saving: '-$180k', note: 'About 30% rebate on local spend' },
    { item: 'Consolidate 3 night exteriors', saving: '-$95k', note: 'One unit move saved' },
    { item: 'Virtual production for the dock', saving: '-$60k', note: 'Avoids a water permit' },
  ],
  roi: SAMPLE_ROI, probability: 64, verdict: 'CONDITIONAL',
  memo: 'A strong genre engine on a lean negative. Greenlight is conditional on an Act-2 tightening pass and one bankable attach; downside is cushioned by a streaming floor and a GCC incentive that lowers the negative.',
};
const NAVMAP: Record<string, string> = { home: '/scripon', reader: '/scripon/reader', breakdown: '/scripon/breakdown', schedule: '/scripon/schedule', doctor: '/scripon/doctor', coverage: '/scripon/doctor', studio: '/scripon/studio', greenlight: '/scripon/greenlight', reports: '/scripon/reports', library: '/scripon/library', settings: '/scripon/settings', revisions: '/scripon/revisions', notes: '/scripon/notes', approvals: '/scripon/approvals' };
const money = (s: any) => { const n = parseFloat(String(s || '').replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; };
const fcColor = (label: string) => { const u = label.toUpperCase(); if (u.includes('THEATR')) return 'var(--blue)'; if (u.includes('STREAM')) return 'var(--violet)'; if (u.includes('INTL') || u.includes('INTERNATION')) return 'var(--green)'; if (u.includes('TOTAL')) return 'linear-gradient(90deg,var(--gold),var(--gold2))'; return 'var(--blue)'; };

export default function GreenlightPage() {
  const router = useRouter();
  const vp = useViewport();
  const { t } = useLocale();
  const [title, setTitle] = useState('Midnight Run');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [mode, setMode] = useState('market');
  const [comps, setComps] = useState<SxComp[]>(SAMPLE_COMPS);
  const [forecast, setForecast] = useState<SxFcast[]>(SAMPLE_FCAST);
  const [prob, setProb] = useState({ pct: 64, verdict: 'CONDITIONAL', note: 'Above the slate hurdle — pending Act-2 fix & one cast attach.' });
  const [roi, setRoi] = useState<SxRoi[]>(SAMPLE_ROI);
  const [prescription, setPrescription] = useState('Prescription: tighten Act 2 (+6% P50) and shoot GCC-incentive (−$180k negative).');
  const [decision, setDecision] = useState<SxDecision>(SAMPLE_DECISION);
  const [toast, setToast] = useState<string | null>(null);
  const tT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(tT.current); tT.current = setTimeout(() => setToast(null), 3600); };
  useEffect(() => { let alive = true; (async () => { try { const pr: any = await productionApi.projects.list(); const ps = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []); const p = pickScriponProject(ps); if (alive && p?.id) { setProjectId(p.id); if (p.name || p.title) setTitle(p.name || p.title); } } catch { /* sample */ } })(); return () => { alive = false; }; }, []);

  const mapForecast = (arr: any[]): SxFcast[] => { const max = Math.max(1, ...arr.map((f) => money(f.p50))); return arr.map((f, i) => ({ label: String(f.window || f.label || ('Window ' + (i + 1))), pct: Math.max(8, Math.round(money(f.p50) / max * 100)), color: fcColor(String(f.window || '')), value: String(f.p50 || ''), gold: /total/i.test(String(f.window || '')) })); };

  const runForecast = async () => {
    if (!projectId) { flash(t('Connect a project with a script to forecast.')); return; }
    flash(t('Running market forecast…'));
    try {
      const res: any = await productionApi.scripton.marketForecast(projectId, {});
      const d: any = res.data || {};
      if (Array.isArray(d.comps) && d.comps.length) setComps(d.comps.map((c: any) => ({ name: String(c.name || ''), sim: Number(c.sim) || 0, gross: String(c.gross || '') })));
      if (Array.isArray(d.forecast) && d.forecast.length) setForecast(mapForecast(d.forecast));
      if (d.probability != null) setProb({ pct: Number(d.probability) || 0, verdict: String(d.verdict || 'CONDITIONAL'), note: (d.drivers && d.drivers[0]) ? String(d.drivers[0]) : (d.risks && d.risks[0] ? String(d.risks[0]) : 'Probabilistic estimate — not a guarantee.') });
      setMode('market');
      flash(t('Forecast: P(greenlight)') + ' ' + (d.probability ?? '—') + '% · ' + (d.verdict || ''));
    } catch (e: any) { flash(e?.response?.data?.message || t('Forecast needs a parsed script — import or break one down first.')); }
  };

  const runDecision = async () => {
    if (!projectId) { flash(t('Connect a project with a script for a decision pack.')); setMode('decision'); return; }
    flash(t('Assembling decision pack…'));
    try {
      const res: any = await productionApi.scripton.greenlightDecision(projectId, {});
      const d: any = res.data || {};
      const next: SxDecision = {
        scorecard: Array.isArray(d.scorecard) && d.scorecard.length ? d.scorecard.map((x: any) => ({ criterion: String(x.criterion || ''), weight: Number(x.weight) || 0, score: Number(x.score) || 0, note: x.note ? String(x.note) : '' })) : decision.scorecard,
        audience: Array.isArray(d.audience) && d.audience.length ? d.audience.map((x: any) => ({ quadrant: String(x.quadrant || ''), appeal: String(x.appeal || '') })) : decision.audience,
        costOps: Array.isArray(d.costOps) && d.costOps.length ? d.costOps.map((x: any) => ({ item: String(x.item || ''), saving: String(x.saving || ''), note: x.note ? String(x.note) : '' })) : decision.costOps,
        roi: Array.isArray(d.roi) && d.roi.length ? d.roi.map((x: any) => ({ case: String(x.case || ''), rev: String(x.rev || ''), margin: String(x.margin || ''), roi: String(x.roi || ''), tone: /down/i.test(String(x.case || '')) ? 'var(--amber)' : undefined })) : decision.roi,
        probability: d.probability != null ? Number(d.probability) : decision.probability,
        verdict: String(d.verdict || decision.verdict), memo: String(d.memo || decision.memo),
      };
      setDecision(next);
      if (next.roi.length) setRoi(next.roi);
      setProb((p) => ({ pct: next.probability || p.pct, verdict: next.verdict || p.verdict, note: p.note }));
      if (next.memo) setPrescription(next.memo);
      setMode('decision');
      flash(t('Decision:') + ' ' + next.verdict + ' · ' + next.probability + '%');
    } catch (e: any) { setMode('decision'); flash(e?.response?.data?.message || t('Decision pack needs a parsed script first.')); }
  };

  const onTab = (k: string) => setMode(k);
  const onNav = (k: string) => { if (NAVMAP[k]) return router.push(NAVMAP[k]); flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`); };
  const onAction = (k: string) => {
    if (k === 'forecast') return void runForecast();
    if (k === 'memo' || k === 'tab-decision') return void runDecision();
    if (k === 'tab-market') return setMode('market');
    if (k === 'tab-audience') return setMode('audience');
    if (k === 'tab-cost') return setMode('cost');
    if (k === 'cmdk') return flash(t('Press ⌘K anywhere in the workspace.'));
    flash(t('Coming soon.'));
  };

  const RC: any = vp === 'mobile' ? ScripOnGreenlightMobile : vp === 'tablet' ? ScripOnGreenlightTablet : ScripOnGreenlight;
  return <RC title={title} meta={`${t('Greenlight')} · ${t('market & decision')}`} mode={mode} onTab={onTab} comps={comps} forecast={forecast} prob={prob} roi={roi} prescription={prescription} decision={decision} onNav={onNav} onBack={() => router.push('/home')} onAction={onAction} toast={toast} />;
}
