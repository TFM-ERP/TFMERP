'use client';
/** ScripON Doctor — Doctor workspace route /scripon/doctor. Coverage + diagnostics from productionApi.scripton. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriponProject } from '@/components/scripon/useScriponProject';
import ScripOnDoctor, { SxGauge, SxCoverage, SxDiag, SxPt, SxTab } from '@/components/scripon/ScripOnDoctor';
import ScripOnDoctorTablet from '@/components/scripon/ScripOnDoctorTablet';
import ScripOnDoctorMobile from '@/components/scripon/ScripOnDoctorMobile';
import { useViewport } from '@/components/scripon/useViewport';
import ScripOnBudgetFit from '@/components/scripon/ScripOnBudgetFit';
import ScripOnRewriteSlate from '@/components/scripon/ScripOnRewriteSlate';
import ScripOnCoverageHistory from '@/components/scripon/ScripOnCoverageHistory';
import ScripOnCompsDeck from '@/components/scripon/ScripOnCompsDeck';
import ScripOnPackagePanel from '@/components/scripon/ScripOnPackagePanel';
import ScripOnFormatPanel from '@/components/scripon/ScripOnFormatPanel';
import { useScriponBack } from '@/components/scripon/useScriponBack';

const GRADE: Record<string, { v: string; c: string; p: number }> = {
  EXCELLENT: { v: 'A', c: 'var(--green)', p: 92 }, GOOD: { v: 'B', c: 'var(--gold2)', p: 78 },
  FAIR: { v: 'C', c: 'var(--amber)', p: 55 }, POOR: { v: 'D', c: 'var(--red)', p: 35 },
};
const REC: Record<string, { c: string; p: number }> = { RECOMMEND: { c: 'var(--green)', p: 90 }, CONSIDER: { c: 'var(--amber)', p: 58 }, PASS: { c: 'var(--red)', p: 30 } };
const NEUTRAL = { v: '—', c: 'var(--faint)', p: 0 };
const g = (grade?: string) => GRADE[String(grade || '').toUpperCase()] || NEUTRAL;
const first = (s?: string) => { if (!s) return ''; const m = String(s).split(/(?<=[.!?])\s/)[0]; return m.length > 130 ? m.slice(0, 127) + '…' : m; };

const SAMPLE_GAUGES: SxGauge[] = [
  { label: 'OVERALL', value: 'CONSIDER', color: 'var(--amber)', pct: 58 },
  { label: 'STRUCTURE', value: 'B', color: 'var(--gold2)', pct: 78 },
  { label: 'CHARACTER', value: 'A–', color: 'var(--green)', pct: 90 },
  { label: 'DIALOGUE', value: 'A–', color: 'var(--green)', pct: 88 },
  { label: 'MARKET', value: 'B+', color: 'var(--gold2)', pct: 83 },
  { label: 'PACE', value: 'C', color: 'var(--red)', pct: 52 },
];
const SAMPLE_COV: SxCoverage = {
  logline: 'A burned-out fixer has one night to move a witness across a city that wants them both dead — before the man hunting them turns out to be the only one she trusts.',
  synopsis: 'Sarah Chen runs errands no one admits to. When a routine pickup becomes a manhunt, she and Detective Riley cross a nocturnal city of brokers, bartenders and bad debts. The first act is taut and the dialogue crackles; momentum stalls at the midpoint before a strong, well-earned third act.',
  strengths: [{ text: 'Distinct, propulsive voice — dialogue lands across 38 speaking scenes.', tone: 'good' }, { text: 'Clear external clock (one night) drives Acts 1 and 3.', tone: 'good' }, { text: 'Lead has a real arc; Sc 1 vs Sc 64 contrast is sharp.', tone: 'good' }],
  concerns: [{ text: 'Midpoint (pp 51–63) reads flat — long Sarah-only stretch.', tone: 'warn' }, { text: "The Broker's motive is asserted but never dramatised.", tone: 'warn' }, { text: 'Pace runs ~6 pages long in Act 2 vs comps.', tone: 'bad' }],
  comps: ['Collateral', 'Nightcrawler', 'Drive', 'The Town'],
};
const SAMPLE_ACT = [
  { label: 'Act 1', pct: 88, tone: 'var(--green)', note: 'Strong' },
  { label: 'Act 2', pct: 48, tone: 'var(--amber)', note: 'Flat mid' },
  { label: 'Act 3', pct: 84, tone: 'var(--green)', note: 'Strong' },
];
const MUTED_ACT = ['Act 1', 'Act 2', 'Act 3'].map((label) => ({ label, pct: 0, tone: 'var(--faint)', note: '—' }));
const NEUTRAL_GAUGES: SxGauge[] = ['OVERALL', 'STRUCTURE', 'CHARACTER', 'DIALOGUE', 'MARKET', 'PACE'].map((label) => ({ label, value: '—', color: 'var(--faint)', pct: 0 }));

const CATS: [string, string][] = [['plot', 'Plot'], ['characters', 'Characters'], ['dialogue', 'Dialogue'], ['structure', 'Structure'], ['marketability', 'Marketability']];

function buildCoverage(c: any): SxCoverage {
  const grades = c.grades || {}; const comments = c.comments || {};
  const strengths: SxPt[] = []; const concerns: SxPt[] = [];
  for (const [key, label] of CATS) {
    const gr = String(grades[key] || '').toUpperCase(); if (!gr) continue;
    const snippet = first(comments[key]); const text = `${label}${snippet ? ' — ' + snippet : ' (' + gr.toLowerCase() + ')'}`;
    if (gr === 'EXCELLENT' || gr === 'GOOD') strengths.push({ text, tone: 'good' });
    else concerns.push({ text, tone: gr === 'POOR' ? 'bad' : 'warn' });
  }
  return { logline: c.logline || '', synopsis: c.synopsis || '', strengths, concerns, comps: (c.comps || []).map((x: any) => x?.title || x).filter(Boolean) };
}
function buildGauges(c: any): SxGauge[] {
  const sc = c.scores || {}; const gr = c.grades || {}; const rec = String(c.recommendation || '').toUpperCase();
  const clr = (v: number) => v >= 8 ? 'var(--green)' : v >= 6 ? 'var(--gold2)' : v >= 4 ? 'var(--amber)' : 'var(--red)';
  const dim = (label: string, sv: any, gv: any): SxGauge => { const v = Number(sv); if (isFinite(v) && v > 0) return { label, value: String(v), color: clr(v), pct: v * 10 }; const gg = g(gv); return { label, value: gg.v, color: gg.c, pct: gg.p }; };
  const ov = Number(sc.overall);
  const overall: SxGauge = (isFinite(ov) && ov > 0) ? { label: 'OVERALL', value: ov.toFixed(1), color: clr(ov), pct: ov * 10 } : { label: 'OVERALL', value: rec || '—', color: (REC[rec] || NEUTRAL).c, pct: (REC[rec] || NEUTRAL).p };
  return [overall, dim('PREMISE', sc.premise, gr.structure), dim('PLOT', sc.plot, gr.structure), dim('CHARACTER', sc.characters, gr.characters), dim('DIALOGUE', sc.dialogue, gr.dialogue), dim('MARKET', sc.marketability, gr.marketability)];
}

export default function ScripOnDoctorPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBack = useScriponBack();
  const [title, setTitle] = useState('Midnight Run');
  const [revLabel, setRevLabel] = useState('BLUE · v4');
  const [revColor, setRevColor] = useState('#5b8def');
  const [gauges, setGauges] = useState<SxGauge[]>(SAMPLE_GAUGES);
  const [cov, setCov] = useState<SxCoverage>(SAMPLE_COV);
  const [actHealth, setActHealth] = useState(SAMPLE_ACT);
  const [tab, setTab] = useState<SxTab>('Coverage');
  const [covLoading, setCovLoading] = useState(false);
  const [diag, setDiag] = useState<SxDiag[] | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [surface, setSurface] = useState<null | 'compare' | 'budgetfit' | 'rewrite' | 'history' | 'comps' | 'package' | 'format'>(null);
  const [rwKind, setRwKind] = useState('tighten');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeRev, setActiveRev] = useState<any>(null);
  const [an, setAn] = useState<any | null>(null);
  const [notesV2, setNotesV2] = useState<any[] | null>(null);
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
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0];
        const revId = doc?.activeRevisionId || doc?.revisions?.[0]?.id;
        if (revId) { try { const rv: any = await productionApi.script.getRevision(revId); if (alive) setActiveRev(rv.data); } catch { /* */ } }
        const rev = doc?.revisions?.find((r: any) => r.id === revId) || doc?.revisions?.[0];
        let c: any = null; try { const cr: any = await productionApi.scripton.latestCoverage(proj.id); c = cr.data || null; } catch { /* */ }
        let aData: any = null; try { const a: any = await productionApi.scripton.analytics(proj.id); aData = a.data; } catch { /* */ }
        let nData: any[] = []; try { const nn: any = await productionApi.scripton.notes(proj.id); nData = Array.isArray(nn.data) ? nn.data : []; } catch { /* */ }
        if (!alive) return;
        setProjectId(proj.id); setTitle(proj.name || proj.title || 'Project');
        if (rev) { setRevLabel(rev.revisionLabel || 'CURRENT'); setRevColor(rev.colorCode || '#5b8def'); }
        setActHealth(MUTED_ACT);
        if (c) { setCov(buildCoverage(c)); setGauges(buildGauges(c)); } else { setCov(null); setGauges(NEUTRAL_GAUGES); }
        setAn(aData); setNotesV2(nData);
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const generate = async () => {
    if (!projectId || !activeRev?.id) { flash(t('Connect a project with a parsed script to generate coverage.')); return; }
    setCovLoading(true);
    try { const r: any = await productionApi.scripton.coverage(projectId, { revisionId: activeRev.id }); setCov(buildCoverage(r.data)); setGauges(buildGauges(r.data)); try { const a: any = await productionApi.scripton.analytics(projectId); setAn(a.data); } catch { /* */ } }
    catch (e: any) { flash(e?.response?.status ? `${t('Coverage failed (HTTP')} ${e.response.status}).` : t('Coverage failed — backend not reachable on :3001.')); }
    finally { setCovLoading(false); }
  };
  const runDiag = async () => {
    setTab('Diagnostics');
    if (!projectId || !activeRev?.id) { flash(t('Connect a project with a parsed script to run diagnostics.')); return; }
    setDiagLoading(true);
    try { const r: any = await productionApi.scripton.diagnostics(projectId, { revisionId: activeRev.id }); setDiag(r.data?.scenes || []); }
    catch (e: any) { flash(e?.response?.status ? `${t('Diagnostics failed (HTTP')} ${e.response.status}).` : t('Diagnostics failed — backend not reachable on :3001.')); }
    finally { setDiagLoading(false); }
  };
  const onAction = (k: string) => {
    if (k === 'diagnose') return runDiag();
    if (k === 'compare') return router.push('/scripon/revisions');
    if (k === 'budgetfit') { if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to run this.')); return; } return setSurface('budgetfit'); }
    if (k === 'rewrite') { if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to rewrite.')); return; } setRwKind('tighten'); return setSurface('rewrite'); }
    if (k === 'punchup') { if (!projectId || !activeRev?.id) { flash(t('Connect a project with a script to rewrite.')); return; } setRwKind('punchup'); return setSurface('rewrite'); }
    if (k === 'history') { if (!projectId) { flash(t('Connect a project to see coverage history.')); return; } return setSurface('history'); }
    if (k === 'exportpdf') { if (!projectId) { flash(t('Connect a project to export coverage.')); return; } window.open('/print/coverage?projectId=' + projectId, '_blank'); return; }
    if (k === 'comps') { if (!projectId) { flash(t('Connect a project to generate market comps.')); return; } return setSurface('comps'); }
    if (k === 'package') { if (!projectId) { flash(t('Connect a project to open the coverage package.')); return; } return setSurface('package'); }
    if (k === 'format') { if (!projectId) { flash(t('Connect a project with a script to convert format.')); return; } return setSurface('format'); }
    const m: Record<string, string> = { rewrite: t('Rewrite slate ships in engine phase P2.'), punchup: t('Dialogue punch-up ships in P2.') };
    flash(m[k] || t('Coming soon.'));
  };
  const onNav = (k: string) => {
    if (k === 'doctor') return;
    if (k === 'home') return router.push('/scripon');
    if (k === 'reader') return router.push('/scripon/reader');
    if (k === 'breakdown') return router.push('/scripon/breakdown');
    if (k === 'library') return router.push('/scripon/library');
    if (k === 'settings') return router.push('/scripon/settings');
    if (k === 'reports') return router.push('/scripon/reports');
    if (k === 'coverage') return;
    if (k === 'studio') return router.push('/scripon/studio');
    if (k === 'greenlight') return router.push('/scripon/greenlight');
    if (k === 'schedule') return router.push('/scripon/schedule');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  const NCLR = ['rgba(91,141,239,.85)', 'rgba(139,124,240,.8)', 'rgba(87,179,104,.8)', 'rgba(224,162,59,.8)', 'rgba(214,100,154,.8)', 'rgba(122,166,245,.8)'];
  let analyticsNode: any = undefined;
  if (an) {
    const net = an.network || {}; const dia = an.dialogue || {}; const pac = an.pacing || {}; const stru = an.structure || {};
    const W = 300, H = 150, ccx = W / 2, ccy = H / 2;
    const nds: any[] = (net.nodes || []).slice(0, 7);
    const pos: Record<string, any> = {};
    nds.forEach((nd: any, i: number) => { if (i === 0) { pos[nd.name] = { x: ccx, y: ccy, r: 18, c: 'rgba(198,164,99,.9)' }; return; } const rest = nds.length - 1; const ang = ((i - 1) / Math.max(1, rest)) * Math.PI * 2 - Math.PI / 2; pos[nd.name] = { x: ccx + 62 * Math.cos(ang), y: ccy + 62 * Math.sin(ang), r: Math.max(7, Math.min(13, 7 + (nd.degree || 1) * 2)), c: NCLR[(i - 1) % NCLR.length] }; });
    const maxW = Math.max(1, ...(dia.characters || []).map((c: any) => c.words || 0));
    const totD = (dia.characters || []).reduce((su: number, c: any) => su + (c.words || 0), 0) || 1;
    const maxP = Math.max(0.1, ...(pac.perScene || []).map((x: number) => x || 0));
    const pts = (pac.perScene || []).map((p: number, i: number, arr: number[]) => ((i / Math.max(1, arr.length - 1)) * 220) + ',' + (40 - ((p || 0) / maxP) * 34)).join(' ');
    analyticsNode = (
      <div className="panelcard" style={{ flex: 1, overflow: 'auto' }}>
        <div className="pc-h"><span className="t">{t('Analytics')}</span><span className="eyebrow">{t('COMPUTED FROM SCENES')}</span></div>
        <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto' }}>
          <g stroke="rgba(198,164,99,.28)" strokeWidth="1.3">{(net.edges || []).slice(0, 50).map((e: any, i: number) => (pos[e.a] && pos[e.b]) ? <line key={i} x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y} /> : null)}</g>
          <g fontFamily="Inter" fontWeight="700" textAnchor="middle">{nds.map((nd: any) => { const p = pos[nd.name]; if (!p) return null; return (<g key={nd.name}><circle cx={p.x} cy={p.y} r={p.r} fill={p.c} /><text x={p.x} y={p.y + 3} fontSize={p.r > 15 ? 8 : 6.5} fill="#0b0c0f">{String(nd.name).slice(0, 7)}</text></g>); })}</g>
        </svg>
        <div style={{ fontSize: 10, color: 'var(--faint)' }}>{t('Network · protagonist')} {net.protagonist || (nds[0] && nds[0].name) || '—'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
          {(dia.characters || []).slice(0, 5).map((c: any, i: number) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}><span style={{ width: 70, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span><span style={{ flex: 1, height: 7, borderRadius: 5, background: '#23262e', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: ((c.words || 0) / maxW * 100) + '%', background: 'linear-gradient(90deg,#5b8def,#7aa6f5)' }} /></span><span style={{ width: 30, textAlign: 'right', color: 'var(--faint)', fontWeight: 700 }}>{Math.round((c.words || 0) / totD * 100)}%</span></div>))}
        </div>
        {pts ? <svg viewBox="0 0 220 44" style={{ width: '100%', height: 34, marginTop: 4 }}><polyline fill="none" stroke="var(--gold)" strokeWidth="2" points={pts} /></svg> : null}
        <div style={{ fontSize: 10, color: 'var(--faint)' }}>{(stru.turningPoints || []).slice(0, 5).map((tp: any) => tp.name + ' ' + t('Sc') + tp.atScene).join(' · ') || t('Pacing & structure')}</div>
      </div>
    );
  }
  let notesNode: any = undefined;
  if (notesV2 && notesV2.length) {
    notesNode = (
      <div className="rsec"><h3>{t('LIVING NOTES · SCENE-ANCHORED')}</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notesV2.slice(0, 6).map((n: any) => (<div key={n.id} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}><span style={{ fontFamily: '"Courier Prime",monospace', fontSize: 10, color: 'var(--gold2)', flex: 'none' }}>{t('Sc')} {n.sceneNumber || '—'}</span><span>{n.body}</span></div>))}
      </div></div>
    );
  }
  const common = { title, revisionLabel: revLabel, revisionColor: revColor, meta: t('Doctor · grounded in your pages'), gauges, activeTab: tab, onTab: setTab, coverage: cov, covLoading, onGenerate: generate, diagnostics: diag, diagLoading, onRunDiag: runDiag, actHealth, onAction, onNav, onBack, analyticsNode, notesNode, toast };
  const body = vp === 'mobile' ? <ScripOnDoctorMobile {...common} /> : vp === 'tablet' ? <ScripOnDoctorTablet {...common} /> : <ScripOnDoctor {...common} />;
  return (<>{body}{surface === 'budgetfit' && activeRev?.id && (<ScripOnBudgetFit projectId={projectId!} revisionId={activeRev.id} onClose={() => setSurface(null)} />)}{surface === 'rewrite' && activeRev?.id && (<ScripOnRewriteSlate projectId={projectId!} revisionId={activeRev.id} initialKind={rwKind} onClose={() => setSurface(null)} />)}{surface === 'history' && projectId && (<ScripOnCoverageHistory projectId={projectId} onOpen={(r: any) => { setCov(buildCoverage(r)); setGauges(buildGauges(r)); setActHealth(MUTED_ACT); setTab('Coverage'); setSurface(null); }} onClose={() => setSurface(null)} />)}{surface === 'comps' && projectId && (<ScripOnCompsDeck projectId={projectId} onClose={() => setSurface(null)} />)}{surface === 'package' && projectId && (<ScripOnPackagePanel projectId={projectId} onClose={() => setSurface(null)} />)}{surface === 'format' && projectId && (<ScripOnFormatPanel projectId={projectId} onClose={() => setSurface(null)} />)}</>);
}
