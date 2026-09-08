'use client';
/** ScriptON — Revisions & Compare route /scripton/revisions. Always the new OS: the Versions
 *  timeline + Render→Compare (?pass). The legacy revision picker (desktop/tablet/mobile) is retired. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import { useViewport } from '@/components/scripton/useViewport';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import ScriptonCompare, { type CompareResult } from '@/components/scripton/compare/ScriptonCompare';
import ScriptonVersions, { type VersionsData, type VersionNode } from '@/components/scripton/versions/ScriptonVersions';

export default function ScriptOnRevisionsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBack = useScriptonBack();
  // Render→Compare mode: landed here from Write's Render with ?pass=<id>.
  const [passId, setPassId] = useState('');
  const [cmp, setCmp] = useState<CompareResult | null>(null);
  const [cmpBusy, setCmpBusy] = useState<string | null>(null);
  // Versions (cold view): the BuildVersion timeline + decision log + the selected node's diff.
  const [docId, setDocId] = useState('');
  const [versData, setVersData] = useState<VersionsData | null>(null);
  const [selVerId, setSelVerId] = useState('');
  const [verDiff, setVerDiff] = useState<CompareResult | null>(null);
  const [verLoading, setVerLoading] = useState(false);
  const [title, setTitle] = useState('Midnight Run');
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  // Resolve the active script doc — the Versions timeline + diff load off docId.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriptonProject(projects); if (!proj?.id) return;
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0];
        if (alive && doc?.id) { setDocId(doc.id); setTitle(proj.name || proj.title || doc.title || 'Project'); }
      } catch { /* keep neutral */ }
    })();
    return () => { alive = false; };
  }, []);

  // NOT THE PATTERN. CANONICAL IS useSearchParams INSIDE A SUSPENSE BOUNDARY — see
  // app/(dashboard)/scripton/studio/page.tsx, which wraps its export in <Suspense> and derives
  // state in studio-view.logic.ts.
  //
  // Reading the query post-mount avoids the boundary, but it is the same defect as the bug fixed in
  // Studio on 8 Sep: a `[]` effect never re-runs on a query-ONLY navigation, because the pathname
  // does not change and the component does not remount. Clicking Build on the rail while a build was
  // open did nothing for exactly this reason. Here it means arriving at ?pass=X from a screen that
  // is already /scripton/revisions leaves passId stale.
  //
  // THIS FILE IS THE ONE STILL TO CONVERT. Not done in the Studio commit because it is a behaviour
  // change to a screen that fix did not touch, and it was not exercised — convert it deliberately,
  // with the Compare flow actually run, rather than as a drive-by.
  useEffect(() => { if (typeof window !== 'undefined') setPassId(new URLSearchParams(window.location.search).get('pass') || ''); }, []);
  useEffect(() => {
    if (!passId) return;
    let alive = true;
    (async () => { try { const rr: any = await productionApi.scripton.renderResult(passId); if (alive) setCmp(rr.data || null); } catch { /* keep loading */ } })();
    return () => { alive = false; };
  }, [passId]);

  // Versions (cold) — load the timeline + decision log, default-select the latest rendered node, fetch its diff.
  const loadVerDiff = async (node: VersionNode | null) => {
    if (!node?.passId) { setVerDiff(null); return; }
    setVerLoading(true);
    try { const rr: any = await productionApi.scripton.renderResult(node.passId); setVerDiff(rr.data || null); }
    catch { setVerDiff(null); }
    finally { setVerLoading(false); }
  };
  useEffect(() => {
    if (passId || !docId) return;
    let alive = true;
    (async () => {
      try {
        const r: any = await productionApi.scripton.versions(docId);
        const data: VersionsData = r.data || { versions: [], pending: null, decisions: [] };
        if (!alive) return;
        setVersData(data);
        const rendered = data.versions.filter((v) => v.passId);
        const def = data.versions.find((v) => v.active && v.passId) || rendered[rendered.length - 1] || null;
        if (def) { setSelVerId(def.id); loadVerDiff(def); }
      } catch { /* keep empty */ }
    })();
    return () => { alive = false; };
  }, [passId, docId]);
  const selectVer = (node: VersionNode) => { setSelVerId(node.id); loadVerDiff(node); };
  const openCompare = (pid: string) => router.push('/scripton/revisions?pass=' + encodeURIComponent(pid));

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
    try { await productionApi.scripton.development.discardVersion(cmp.version.id); flash(`${newLbl} ${t('discarded —')} ${prevLbl} ${t('is active.')}`); }
    catch (e: any) { flash(e?.response?.data?.message || t('Could not discard the version.')); }
    finally { setCmpBusy(null); }
  };

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

  if (passId) {
    if (!cmp) return <div style={{ position: 'fixed', inset: 0, background: '#0a0b0e', color: '#9aa1ab', display: 'grid', placeItems: 'center', fontSize: 13, zIndex: 50 }}>{t('Loading the render…')}</div>;
    return <ScriptonCompare title={title} result={cmp} vp={vp} onNav={onNav} onBack={onBack}
      onSetActive={setActive} onKeep={keepPrev} onDiscard={discardNew} busy={cmpBusy} toast={toast} />;
  }
  return <ScriptonVersions title={title} data={versData || { versions: [], pending: null, decisions: [] }} vp={vp}
    selectedId={selVerId} onSelect={selectVer} diff={verDiff} diffLoading={verLoading}
    onOpenCompare={openCompare} onNav={onNav} onBack={onBack} toast={toast} />;
}
