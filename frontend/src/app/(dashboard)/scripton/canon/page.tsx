'use client';
/** ScriptON — Canon route /scripton/canon. Under the `new` shell flag it renders
 *  the bi-temporal canon graph from the merged kernel's CanonFact store; `old`
 *  keeps the previous stub. Real kernel data — no mock. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { pickScriptonProject, resolveScriptonProjectId } from '@/components/scripton/useScriptonProject';
import { useViewport } from '@/components/scripton/useViewport';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import ScriptonCanon from '@/components/scripton/canon/ScriptonCanon';
import type { Fact } from '@/components/scripton/canon/scripton-canon.logic';

export default function ScriptOnCanonPage() {
  const router = useRouter();
  const { t } = useLocale();
  const vp = useViewport();
  const onBack = useScriptonBack();
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [title, setTitle] = useState('ScriptON');
  const [revLabel, setRevLabel] = useState('WHITE');
  const [revColor, setRevColor] = useState('#cfd3da');
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const wsId = await resolveScriptonProjectId();
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = (wsId && projects.find((p: any) => p.id === wsId)) || pickScriptonProject(projects) || (wsId ? { id: wsId, name: 'ScriptON Library' } : null);
        if (!proj?.id) { if (alive) setFacts([]); return; }
        if (alive) setTitle(proj.name || proj.title || 'ScriptON');
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0];
        if (!doc) { if (alive) setFacts([]); return; }
        if (alive) setTitle(doc.title || proj.name || 'ScriptON');
        const rid = doc.activeRevisionId || doc.revisions?.[0]?.id;
        if (rid) { try { const rv: any = await productionApi.script.getRevision(rid); if (alive && rv.data) { setRevLabel(rv.data.revisionLabel || 'WHITE'); setRevColor(rv.data.colorCode || '#cfd3da'); } } catch { /* */ } }
        try {
          const cr: any = await productionApi.scripton.canon(doc.id);
          if (alive) setFacts(Array.isArray(cr.data) ? cr.data : []);
        } catch { if (alive) setFacts([]); }
      } catch { if (alive) setFacts([]); }
    })();
    return () => { alive = false; };
  }, []);

  const onNav = (k: string) => {
    if (k === 'canon') return;
    if (k === 'home') return router.push('/scripton');
    if (k === 'reader' || k === 'write') return router.push('/scripton/reader');
    if (k === 'develop') return router.push('/scripton/studio?tab=builds');
    if (k === 'doctor') return router.push('/scripton/doctor');
    if (k === 'versions') return router.push('/scripton/revisions');
    if (k === 'room') return router.push('/scripton/notes');
    if (k === 'slate' || k === 'library') return router.push('/scripton/library');
    if (k === 'studio' || k === 'settings') return router.push('/scripton/settings');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  return (
    <ScriptonCanon
      title={title} revisionLabel={revLabel} revisionColor={revColor}
      facts={facts || []} versionLabel={revLabel} loading={facts === null}
      onNav={onNav} onBack={onBack} toast={toast} vp={vp}
    />
  );
}
