'use client';
/** ScriptON — Settings/Governance route /scripon/settings. Under the `new` shell
 *  flag it renders the consolidated Studio (export · security · access · AI gov);
 *  `old` keeps the existing tabbed settings. AI-gov runs are illustrative defaults
 *  (no runs API yet); Review Protection + the export flows are live. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScriptOnSettings, { SxRun } from '@/components/scripton/ScriptOnSettings';
import ScriptOnSettingsTablet from '@/components/scripton/ScriptOnSettingsTablet';
import ScriptOnSettingsMobile from '@/components/scripton/ScriptOnSettingsMobile';
import { useViewport } from '@/components/scripton/useViewport';
import { useLocale, getLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import { useScriptonShellFlag } from '@/components/scripton/osShellFlag';
import { pickScriptonProject, resolveScriptonProjectId } from '@/components/scripton/useScriptonProject';
import { productionApi } from '@/lib/api';
import { buildScriptPrintHtml } from '@/components/scripton/scriptPaper';
import ProtectedExportDialog, { ProtectedExportTarget } from '@/components/scripton/ProtectedExportDialog';
import ScriptonStudio from '@/components/scripton/studio/ScriptonStudio';

const RUNS: SxRun[] = [
  { surface: 'Coverage report', model: 'claude-opus-4', tokens: '18.4k', conf: 0.84, status: 'APPROVED', statusClass: 'green', when: '2h' },
  { surface: 'Scene diagnostics', model: 'claude-opus-4', tokens: '9.1k', conf: 0.88, status: 'APPROVED', statusClass: 'green', when: '2h' },
  { surface: 'Budget-fit · apply', model: 'claude-opus-4', tokens: '12.7k', conf: 0.71, status: 'PENDING', statusClass: 'amber', when: '1d' },
  { surface: 'Breakdown tagging', model: 'claude-sonnet-4', tokens: '6.3k', conf: 0.92, status: 'APPROVED', statusClass: 'green', when: '1d' },
  { surface: 'Version compare', model: 'claude-opus-4', tokens: '7.8k', conf: 0.86, status: 'APPROVED', statusClass: 'green', when: '1d' },
  { surface: 'Culture screen', model: 'claude-opus-4', tokens: '5.2k', conf: 0.69, status: 'PENDING', statusClass: 'amber', when: '2d' },
];

function downloadBlob(data: any, filename: string) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ScriptOnSettingsPage() {
  const router = useRouter();
  const vp = useViewport();
  const { t } = useLocale();
  const onBack = useScriptonBack();
  const flag = useScriptonShellFlag();
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  // Active script context — for the Export & interop flows (protected PDF / .docx).
  const [projectId, setProjectId] = useState<string | null>(null);
  const [docId, setDocId] = useState('');
  const [revId, setRevId] = useState('');
  const [title, setTitle] = useState('');
  const [revLabel, setRevLabel] = useState('WHITE');
  const [revColor, setRevColor] = useState('#cfd3da');
  const [text, setText] = useState('');
  const [info, setInfo] = useState<any>({});
  const [protOpen, setProtOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const wsId = await resolveScriptonProjectId();
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = (wsId && projects.find((p: any) => p.id === wsId)) || pickScriptonProject(projects) || (wsId ? { id: wsId, name: 'ScriptON Library' } : null);
        if (!proj?.id || !alive) return;
        setProjectId(proj.id); setTitle(proj.name || proj.title || 'ScriptON');
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0]; if (!doc) return;
        const rid = doc.activeRevisionId || doc.revisions?.[0]?.id;
        if (alive) { setDocId(doc.id || ''); setRevId(rid || ''); setTitle(doc.title || proj.name || 'ScriptON'); }
        if (rid) {
          try {
            const rv: any = await productionApi.script.getRevision(rid);
            const d = rv.data || {};
            const pt: any[] = Array.isArray(d.pageText) ? d.pageText : [];
            const joined = pt.map((p: any) => String(p.text || '')).join('\n');
            if (alive) { setText(joined); setRevLabel(d.revisionLabel || 'WHITE'); setRevColor(d.colorCode || '#cfd3da'); setInfo({ projectTitle: proj.name, scriptTitle: doc.title, scriptVersion: d.revisionLabel }); }
          } catch { /* no parsed revision text */ }
        }
      } catch { /* keep neutral */ }
    })();
    return () => { alive = false; };
  }, []);

  const onAction = (k: string) => {
    const m: Record<string, string> = { save: t('Saving governance settings ships in the next phase — values shown are the live defaults.'), discard: t('Reverted.'), toggle: t('Confidence/approval gates are read-only here for now — wiring ships next.'), subnav: t('This settings section ships in the next phase.') };
    flash(m[k] || t('Coming soon.'));
  };
  const onNav = (k: string) => {
    if (k === 'settings' || k === 'studio') return;
    if (k === 'home') return router.push('/scripon');
    if (k === 'reader') return router.push('/scripon/reader');
    if (k === 'breakdown') return router.push('/scripon/breakdown');
    if (k === 'doctor') return router.push('/scripon/doctor');
    if (k === 'schedule') return router.push('/scripon/schedule');
    if (k === 'reports') return router.push('/scripon/reports');
    if (k === 'coverage') return router.push('/scripon/doctor');
    if (k === 'greenlight') return router.push('/scripon/greenlight');
    if (k === 'library') return router.push('/scripon/library');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  const onExport = async (kind: 'fdx' | 'fountain' | 'pdf' | 'word') => {
    if (kind === 'pdf') { if (!docId && !revId) { flash(t('Develop or open a script first to export a protected copy.')); return; } setProtOpen(true); return; }
    if (kind === 'word') {
      if (!docId) { flash(t('No developed script to export yet.')); return; }
      flash(t('Building Word copy…'));
      try { const r: any = await productionApi.scripton.development.packageDocx({ docId, projectId }); downloadBlob(r.data, `${title || 'script'}.docx`); flash(t('Word copy downloaded.')); }
      catch { flash(t('Word export failed — needs the backend on :3001.')); }
      return;
    }
    flash(t('FDX & Fountain interop ship next — protected PDF and Word are live.'));
  };

  if (flag === 'new') {
    const exportTarget: ProtectedExportTarget = {
      projectId: projectId || undefined, scriptDocumentId: docId || undefined, revisionId: revId || undefined,
      getBaseHtml: () => buildScriptPrintHtml(text, title || 'Script', { ...info, lang: getLocale() }),
      docTitle: title, meta: { projectTitle: info.projectTitle, scriptTitle: title, scriptVersion: revLabel },
    };
    return (
      <>
        <ScriptonStudio
          title={title || 'ScriptON'} revisionLabel={revLabel} revisionColor={revColor}
          companyName="The Film Makers" model="claude-opus-4" promptSet={t('Prompt set v3')} confidence={0.75} humanApproval
          runs={RUNS} runsMeta={t('All AI flows through one service · 142 runs today')} projectId={projectId}
          onExport={onExport} onAction={onAction} onNav={onNav} onBack={onBack} toast={toast} vp={vp}
        />
        <ProtectedExportDialog open={protOpen} onClose={() => setProtOpen(false)} target={exportTarget} />
      </>
    );
  }

  const RC: any = vp === 'mobile' ? ScriptOnSettingsMobile : vp === 'tablet' ? ScriptOnSettingsTablet : ScriptOnSettings;
  return <RC companyName="The Film Makers" model="claude-opus-4" promptSet={t('Prompt set v3')} confidence={0.75} humanApproval={true}
    runs={RUNS} runsMeta={t('All AI flows through one service · 142 runs today')} onAction={onAction} onNav={onNav} onBack={onBack} toast={toast} />;
}
