'use client';
/** ScriptON Doctor — Breakdown route /scripton/breakdown. Six lenses + gated element edit (routes through approval). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi, approvalsApi } from '@/lib/api';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import ScriptOnBreakdown, { SxEl, SxLens, SxDetail } from '@/components/scripton/ScriptOnBreakdown';
import ScriptOnBreakdownTablet from '@/components/scripton/ScriptOnBreakdownTablet';
import ScriptOnBreakdownMobile from '@/components/scripton/ScriptOnBreakdownMobile';
import { useViewport } from '@/components/scripton/useViewport';
import { useLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import { useScriptonMode } from '@/components/scripton/useScriptonMode';

type Item = { name: string; qty: number; estCost: number; scenes: string[]; days: number[]; costCenters: string[]; ids?: string[] };
type Cat = { category: string; itemCount: number; items: Item[] };

const LENSES: { key: string; label: string; color: string; match: string[] }[] = [
  { key: 'cast', label: 'Cast', color: 'var(--blue)', match: ['CAST', 'CHARACTER', 'BACKGROUND', 'EXTRA', 'STUNT'] },
  { key: 'props', label: 'Props', color: 'var(--gold)', match: ['PROP'] },
  { key: 'locations', label: 'Locations', color: 'var(--green)', match: ['LOCATION', 'SET'] },
  { key: 'wardrobe', label: 'Wardrobe', color: 'var(--violet)', match: ['WARDROBE', 'COSTUME', 'MAKEUP', 'HAIR'] },
  { key: 'vehicles', label: 'Vehicles', color: 'var(--amber)', match: ['VEHICLE', 'PICTURE_VEHICLE', 'ANIMAL'] },
  { key: 'vfx', label: 'VFX', color: 'var(--pink)', match: ['VFX', 'SPECIAL', 'SFX', 'EFFECT'] },
];

const SAMPLE: Cat[] = [
  { category: 'CAST', itemCount: 18, items: [
    { name: 'SARAH CHEN', qty: 1, estCost: 0, scenes: ['1', '3', '6', '8', '14', '17', '22', '28', '34', '41', '47', '52', '58', '64'], days: [1, 2, 3, 4, 5], costCenters: ['1101 · Lead Cast'] },
    { name: 'DET. MARCUS RILEY', qty: 1, estCost: 0, scenes: ['2', '6', '14', '17', '23', '31', '44', '59'], days: [1, 2, 4], costCenters: ['1102 · Principal'] },
    { name: 'THE BROKER', qty: 1, estCost: 0, scenes: ['11', '31', '34', '47'], days: [4], costCenters: ['1103 · Supporting'] },
  ] },
  { category: 'PROPS', itemCount: 46, items: [{ name: 'Burner phone', qty: 3, estCost: 120, scenes: ['7', '13', '14'], days: [1], costCenters: ['2201 · Props'] }] },
  { category: 'LOCATION', itemCount: 11, items: [{ name: 'Warehouse', qty: 1, estCost: 8000, scenes: ['14', '15'], days: [2], costCenters: ['3301 · Locations'] }] },
  { category: 'WARDROBE', itemCount: 23, items: [{ name: 'Sarah — wet coat', qty: 1, estCost: 400, scenes: ['14', '15', '16'], days: [2], costCenters: ['4401 · Costume'] }] },
  { category: 'VEHICLE', itemCount: 7, items: [{ name: 'Surveillance van', qty: 1, estCost: 1500, scenes: ['13'], days: [2], costCenters: ['5501 · Picture vehicles'] }] },
  { category: 'VFX', itemCount: 9, items: [{ name: 'Muzzle flash', qty: 4, estCost: 2200, scenes: ['44', '59'], days: [], costCenters: ['6601 · VFX'] }] },
];

const lensOf = (catName: string) => LENSES.find((l) => l.match.some((m) => catName.toUpperCase().includes(m)))?.key;
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, color: '#8b8f98', margin: '8px 0 3px' };
const inp: React.CSSProperties = { width: '100%', background: '#0b0c0f', color: '#E7E3D8', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 10px', fontSize: 13 };

export default function ScriptOnBreakdownPage() {
  const router = useRouter();
  const vp = useViewport();
  const { dir, t } = useLocale();
  const onBack = useScriptonBack();
  const mode = useScriptonMode();
  const [cats, setCats] = useState<Cat[]>(SAMPLE);
  const [title, setTitle] = useState('Midnight Run');
  const [revLabel, setRevLabel] = useState('BLUE · v4');
  const [revColor, setRevColor] = useState('#5b8def');
  const [activeLens, setActiveLens] = useState('cast');
  const [activeName, setActiveName] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState<any>({});
  const [saving, setSaving] = useState(false);
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
        if (alive) setProjectId(proj.id);
        const cb: any = await productionApi.breakdown.categoryBreakdown(proj.id);
        const list: Cat[] = cb.data?.categories ?? [];
        if (!alive || !list.length) return;
        setCats(list);
        setTitle(proj.name || proj.title || 'Project');
        try {
          const dr: any = await productionApi.script.list(proj.id);
          const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
          const doc = docs[0];
          const rev = doc?.revisions?.find((r: any) => r.id === doc.activeRevisionId) || doc?.revisions?.[0];
          if (rev) { setRevLabel(rev.revisionLabel || 'CURRENT'); setRevColor(rev.colorCode || '#5b8def'); }
        } catch { /* keep */ }
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const lensCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cats) { const k = lensOf(c.category); if (k) counts[k] = (counts[k] || 0) + c.itemCount; }
    return counts;
  }, [cats]);

  const lenses: SxLens[] = LENSES.map((l) => ({ key: l.key, label: l.label, color: l.color, count: lensCounts[l.key] || 0 }));
  const totalElements = cats.reduce((n, c) => n + c.itemCount, 0);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const c of cats) if (lensOf(c.category) === activeLens) out.push(...c.items);
    return out.sort((a, b) => b.scenes.length - a.scenes.length || a.name.localeCompare(b.name));
  }, [cats, activeLens]);

  const elements: SxEl[] = items.map((it) => ({
    name: it.name,
    sub: `${it.scenes.length} ${it.scenes.length === 1 ? t('scene') : t('scenes')}${it.days.length ? ' · ' + it.days.length + ' ' + (it.days.length === 1 ? t('day') : t('days')) : ''}`,
    scenes: it.scenes.length, second: '×' + it.qty, badge: t('TAGGED'), badgeClass: 'green',
  }));

  const active = items.find((i) => i.name === activeName) || items[0];
  const lensLabel = (LENSES.find((l) => l.key === activeLens)?.label || '').toUpperCase();
  const detail: SxDetail = active ? {
    name: active.name, badge: lensLabel,
    kv: [
      { k: t('Lens'), v: LENSES.find((l) => l.key === activeLens)?.label || '—' },
      { k: t('Scenes'), v: String(active.scenes.length) },
      { k: t('Days'), v: active.days.length ? active.days.join(', ') : '—' },
      { k: t('Quantity'), v: '×' + active.qty },
      { k: t('Est. cost'), v: active.estCost ? '$' + active.estCost.toLocaleString() : '—' },
      { k: t('Cost center'), v: active.costCenters[0] || '—' },
    ],
    scenes: active.scenes, ids: active.ids,
  } : null;

  const saveEdit = async () => {
    if (!projectId || !active?.ids?.length) { flash(t('Connect a project to edit elements.')); setEditing(false); return; }
    const data: any = {};
    if (ef.quantity !== '' && ef.quantity != null && Number(ef.quantity) !== active.qty) data.quantity = Number(ef.quantity);
    if (ef.estCost !== '' && ef.estCost != null && Number(ef.estCost) !== active.estCost) data.estCost = Number(ef.estCost);
    if (ef.costCenterTitle) data.costCenterTitle = String(ef.costCenterTitle);
    if (!Object.keys(data).length) { flash(t('No changes to send.')); setEditing(false); return; }
    setSaving(true);
    try {
      if (mode === 'solo') {
        // Apply directly to EVERY selected element (team mode routes all of active.ids;
        // solo must too — applying only ids[0] silently dropped the rest).
        await Promise.all(active.ids.map((id: string) => productionApi.breakdown.update(id, data)));
        // Refresh so the edited values show immediately (no stale cats).
        try { const cb: any = await productionApi.breakdown.categoryBreakdown(projectId); const list: Cat[] = cb.data?.categories ?? []; if (list.length) setCats(list); } catch { /* keep */ }
        flash(t('Saved.')); setEditing(false);
      } else {
        await approvalsApi.routeChange({ projectId, entityType: 'BREAKDOWN_ELEMENT', entityId: active.ids[0], title: 'Edit element: ' + active.name, payload: { ids: active.ids, data } });
        flash(t('Edit sent for sign-off → Approvals.')); setEditing(false);
      }
    } catch (e: any) { flash(e?.response?.data?.message || t('Could not route the edit — backend on :3001?')); }
    finally { setSaving(false); }
  };

  const onAction = (k: string) => {
    if (k === 'assign') {
      if (!active) return;
      if (!projectId) { flash(t('Connect a project to edit elements.')); return; }
      setEf({ quantity: active.qty, estCost: active.estCost, costCenterTitle: '' }); setEditing(true); return;
    }
    const m: Record<string, string> = {
      retag: t('Re-tagging changed scenes ships in the next phase of this workspace.'),
      sync: t('Sync to Schedule ships in the next phase here.'),
      tagdoctor: t('Running the AI breakdown from here ships next — use the classic Script Hub to tag for now.'),
      filter: t('Element filtering ships next.'),
      wardrobe: t('Linking wardrobe ships in the next phase.'), strips: t('Add-to-strips ships in the next phase.'),
      tag: t('Tag-in-scene editing ships in the next phase.'), merge: t('Merging duplicates ships in the next phase.'),
      flag: t('Flagging for Doctor ships in the next phase.'),
    };
    flash(m[k] || t('Coming soon.'));
  };
  const onNav = (k: string) => {
    if (k === 'breakdown') return;
    if (k === 'home') return router.push('/scripton');
    if (k === 'reader') return router.push('/scripton/reader');
    if (k === 'library') return router.push('/scripton/library');
    if (k === 'settings') return router.push('/scripton/settings');
    if (k === 'reports') return router.push('/scripton/reports');
    if (k === 'coverage') return router.push('/scripton/doctor');
    if (k === 'studio') return router.push('/scripton/studio');
    if (k === 'greenlight') return router.push('/scripton/greenlight');
    if (k === 'doctor') return router.push('/scripton/doctor');
    if (k === 'schedule') return router.push('/scripton/schedule');
    flash(`${k} ${t('is a later screen in the build order.')}`);
  };

  const overlay = editing && active ? (
    <div dir={dir} onClick={() => setEditing(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(6,7,10,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--sx-body)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 360, maxWidth: '100%', background: '#0e1014', border: '1px solid rgba(198,164,99,0.3)', borderRadius: 16, padding: 18, color: '#E7E3D8', boxShadow: '0 24px 70px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#E6D2A2' }}>{t('Edit')} {active.name}</div>
          <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: 'none', color: '#8b8f98', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <label style={lbl}>{t('Quantity')}</label>
        <input type="number" value={ef.quantity ?? ''} onChange={(e) => setEf((f: any) => ({ ...f, quantity: e.target.value }))} style={inp} />
        <label style={lbl}>{t('Est. cost')}</label>
        <input type="number" value={ef.estCost ?? ''} onChange={(e) => setEf((f: any) => ({ ...f, estCost: e.target.value }))} style={inp} />
        <label style={lbl}>{t('Cost center title')}</label>
        <input value={ef.costCenterTitle ?? ''} placeholder={active.costCenters[0] || t('e.g. Lead Cast')} onChange={(e) => setEf((f: any) => ({ ...f, costCenterTitle: e.target.value }))} style={inp} />
        <div style={{ fontSize: 11, color: '#8b8f98', margin: '10px 0', lineHeight: 1.5 }}>{t('Edits route through approval before they apply (Approvals screen).')}</div>
        <button disabled={saving} onClick={saveEdit} style={{ width: '100%', background: 'linear-gradient(180deg,#E6D2A2,#C6A463)', color: '#1a1509', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? t('Sending…') : t('Send edit for sign-off')}</button>
      </div>
    </div>
  ) : null;

  if (vp === 'mobile') return (<>{overlay}<ScriptOnBreakdownMobile title={title} lenses={lenses} activeLens={activeLens} onLens={(k) => { setActiveLens(k); setActiveName(undefined); }} elements={elements} activeName={active?.name} onSelect={setActiveName} detail={detail} onAction={onAction} onNav={onNav} onBack={onBack} /></>);
  if (vp === 'tablet') return (<>{overlay}<ScriptOnBreakdownTablet title={title} revisionLabel={revLabel} revisionColor={revColor} lenses={lenses} activeLens={activeLens} onLens={(k) => { setActiveLens(k); setActiveName(undefined); }} elements={elements} activeName={active?.name} onSelect={setActiveName} lensLabel={lensLabel} detail={detail} onAction={onAction} onNav={onNav} onBack={onBack} /></>);
  return (
    <>
      {overlay}
      <ScriptOnBreakdown
        title={title} revisionLabel={revLabel} revisionColor={revColor} meta={`${t('Breakdown')} · ${totalElements} ${t('elements')}`}
        lenses={lenses} activeLens={activeLens} onLens={(k) => { setActiveLens(k); setActiveName(undefined); }}
        elements={elements} activeName={active?.name} onSelect={setActiveName} lensLabel={lensLabel}
        detail={detail} onAction={onAction} onNav={onNav} onBack={onBack} toast={toast}
      />
    </>
  );
}
