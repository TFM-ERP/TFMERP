'use client';
/** ScripON Doctor — Reports & Exports route /scripon/reports. Gallery ⇄ reports.catalog, preview ⇄ scripton.latestCoverage. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriponProject } from '@/components/scripon/useScriponProject';
import ScripOnReports, { SxReport, SxPreview } from '@/components/scripon/ScripOnReports';
import ScripOnReportsTablet from '@/components/scripon/ScripOnReportsTablet';
import ScripOnReportsMobile from '@/components/scripon/ScripOnReportsMobile';
import { useViewport } from '@/components/scripon/useViewport';

const fmtClass = (f: string) => /xls|excel|csv/i.test(f) ? 'green' : /fdx|final/i.test(f) ? 'blue' : 'blue';
const SAMPLE_REPORTS: (SxReport & { cat: string })[] = [
  { key: 'coverage', title: 'Coverage Report', badge: 'CONSIDER', badgeClass: 'amber', meta: 'Blue v4 · 2h ago', cat: 'Coverage' },
  { key: 'oneline', title: 'One-Line Schedule', badge: 'PDF · XLSX', badgeClass: 'green', meta: '18 days · today', cat: 'Schedule' },
  { key: 'topsheet', title: 'Budget Top Sheet', badge: 'XLSX', badgeClass: 'green', meta: 'EFC $1.24M · today', cat: 'Budget' },
  { key: 'dpr', title: 'Daily Production Report', badge: 'PDF', badgeClass: 'blue', meta: 'template · ready', cat: 'DPR' },
  { key: 'dood', title: 'Day-Out-of-Days', badge: 'XLSX', badgeClass: 'green', meta: '18 cast · 1d ago', cat: 'Cast' },
  { key: 'locsum', title: 'Location Summary', badge: 'PDF', badgeClass: 'green', meta: '11 locations · 2d', cat: 'Schedule' },
  { key: 'sides', title: 'Script Sides', badge: 'PDF', badgeClass: 'blue', meta: 'per scene · ready', cat: 'Schedule' },
  { key: 'charrep', title: 'Character Report', badge: 'PDF', badgeClass: 'green', meta: '18 roles · 1d', cat: 'Cast' },
];
const SAMPLE_PREVIEW: SxPreview = {
  title: 'COVERAGE — MIDNIGHT RUN', badge: 'CONSIDER', badgeTone: 'amber',
  lines: [
    { label: 'LOGLINE.', text: 'A burned-out fixer has one night to move a witness across a city that wants them both dead.' },
    { label: 'GRADES', text: 'STRUCTURE B · CHARACTER A– · DIALOGUE A– · PACE C' },
    { text: 'STRENGTHS — propulsive voice; clear one-night clock.' },
    { text: 'CONCERNS — flat midpoint (pp 51–63); Broker motive thin.' },
    { text: '— Generated from Blue v4 · 17 scene citations —' },
  ],
};

export default function ScripOnReportsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const [title, setTitle] = useState('Midnight Run');
  const [meta, setMeta] = useState(`${t('Reports')} · 8 ${t('ready')}`);
  const [reports, setReports] = useState<(SxReport & { cat: string })[]>(SAMPLE_REPORTS);
  const [cov, setCov] = useState<any>(null);
  const [activeKey, setActiveKey] = useState('coverage');
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
        let c: any = null; try { const cr: any = await productionApi.scripton.latestCoverage(proj.id); c = cr.data || null; } catch { /* */ }
        let cat: any[] = []; try { const ct: any = await productionApi.reports.catalog(); const d = ct?.data; cat = Array.isArray(d) ? d : (d?.reports ?? d?.catalog ?? d?.items ?? (Array.isArray(d?.categories) ? d.categories.flatMap((g: any) => (g.reports || []).map((r: any) => ({ ...r, category: r.category || g.name }))) : [])); } catch { /* */ }
        if (!alive) return;
        setTitle(proj.name || proj.title || 'Project');
        setCov(c);
        const rec = c?.recommendation;
        const coverageCard: SxReport & { cat: string } = { key: 'coverage', title: 'Coverage Report', badge: rec || 'PDF', badgeClass: rec === 'RECOMMEND' ? 'green' : rec === 'PASS' ? 'red' : rec ? 'amber' : 'blue', meta: c ? 'latest · ready' : 'not run yet', cat: 'Coverage' };
        if (cat.length) {
          const cards = cat.map((r: any, i: number): SxReport & { cat: string } => {
            const fmt = r.format || (Array.isArray(r.formats) ? r.formats.join(' · ') : '') || 'PDF';
            return { key: r.key || r.id || ('r' + i), title: r.name || r.title || r.key || 'Report', badge: String(fmt).toUpperCase().slice(0, 12), badgeClass: fmtClass(String(fmt)), meta: r.description || r.category || r.group || 'ready', cat: r.category || r.group || 'Reports' };
          });
          setReports([coverageCard, ...cards]);
          setMeta(`${t('Reports')} · ${cards.length + 1} ${t('ready')}`);
        } else {
          setReports([coverageCard, ...SAMPLE_REPORTS.slice(1)]);
        }
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const filters = useMemo(() => ['All', ...Array.from(new Set(reports.map((r) => r.cat)))].slice(0, 7), [reports]);
  const shown = activeFilter === 'All' ? reports : reports.filter((r) => r.cat === activeFilter);
  const active = reports.find((r) => r.key === activeKey) || reports[0];

  const preview: SxPreview = useMemo(() => {
    if (active?.key === 'coverage') {
      if (cov) {
        const g = cov.grades || {};
        const gradeline = ['plot', 'characters', 'dialogue', 'structure', 'marketability'].map((k) => `${k.slice(0, 4).toUpperCase()} ${String(g[k] || '—').slice(0, 4)}`).join(' · ');
        return { title: `COVERAGE — ${(title || '').toUpperCase()}`, badge: cov.recommendation || 'DRAFT', badgeTone: 'amber', lines: [
          cov.logline ? { label: 'LOGLINE.', text: cov.logline } : { text: 'No logline.' },
          { label: 'GRADES', text: gradeline },
          cov.synopsis ? { text: String(cov.synopsis).slice(0, 220) + (cov.synopsis.length > 220 ? '…' : '') } : { text: '' },
          { text: `— Generated coverage · ${(cov.facts?.sceneCount ?? '—')} scenes —` },
        ].filter((l) => l.text) };
      }
      return { ...SAMPLE_PREVIEW, title: `COVERAGE — ${(title || '').toUpperCase()}` };
    }
    return { title: (active?.title || 'REPORT').toUpperCase(), badge: active?.badge || 'PDF', badgeTone: 'blue', lines: [
      { text: active?.meta || '' },
      { label: 'INCLUDES', text: 'Generated from live production data — formatted to the industry standard for this report type.' },
      { text: '— Export to PDF / Excel / Final Draft below —' },
    ] };
  }, [active, cov, title]);

  const onExport = (fmt: string) => {
    try {
      const data: any = (active?.key === 'coverage' && cov) ? cov : { report: active?.title, key: active?.key, meta: active?.meta, note: 'Live data snapshot — server-side ' + fmt.toUpperCase() + ' rendering pending.' };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = (active?.key || 'report') + (fmt === 'all' ? '-all' : '') + '.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      flash(t('Downloaded') + ' ' + (active?.title || t('report')) + ' ' + t('data (JSON).'));
    } catch { flash(t('Export failed.')); }
  };
  const onAction = (k: string) => flash(k === 'schedule' ? t('Scheduled reports ship in the next phase.') : t('New report builder ships in the next phase.'));
  const onNav = (k: string) => {
    if (k === 'reports') return;
    if (k === 'studio') return router.push('/scripon/studio');
    if (k === 'greenlight') return router.push('/scripon/greenlight');
    if (k === 'home') return router.push('/scripon');
    if (k === 'reader') return router.push('/scripon/reader');
    if (k === 'breakdown') return router.push('/scripon/breakdown');
    if (k === 'doctor') return router.push('/scripon/doctor');
    if (k === 'coverage') return router.push('/scripon/doctor');
    if (k === 'schedule') return router.push('/scripon/schedule');
    if (k === 'library') return router.push('/scripon/library');
    if (k === 'settings') return router.push('/scripon/settings');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  const RC: any = vp === 'mobile' ? ScripOnReportsMobile : vp === 'tablet' ? ScripOnReportsTablet : ScripOnReports;
  return <RC title={title} meta={meta} filters={filters} activeFilter={activeFilter} onFilter={setActiveFilter}
    reports={shown} activeKey={active?.key} onSelect={setActiveKey} preview={preview}
    onExport={onExport} onAction={onAction} onNav={onNav} onBack={() => router.push('/home')} toast={toast} />;
}
