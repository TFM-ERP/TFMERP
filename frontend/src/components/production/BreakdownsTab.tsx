'use client';

/**
 * Breakdowns hub — one tab that hosts every breakdown view as inner tabs:
 *   • Scenes   — the scene-by-scene element breakdown (hub; existing BreakdownPanel)
 *   • Elements — every tagged element grouped by category (computed)
 *   • Locations— the RK-style location breakdown (existing LocationBreakdownPanel)
 *   • By Day   — per shoot-day call-sheet rollup (computed; gated on a schedule)
 * All views share the production kit, so the chrome is identical across tabs.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { productionApi } from '@/lib/api';
import { Loader2, Layers, MapPin, CalendarDays, ListChecks, Printer, Users, Package, Clapperboard } from 'lucide-react';
import { PanelHeader, StatRow, Tabs, ClusterCard, Chip, DataTable, EmptyState, SectionLabel, Btn } from './ui';
import BreakdownPanel from './BreakdownPanel';
import LocationBreakdownPanel from './LocationBreakdownPanel';

const catLabel = (c: string) => c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const sd = (d: number) => (d > 0 ? `SD ${d}` : '—');
// Semantic tone per element family (re-uses the kit's chip tones).
const CAT_TONE: Record<string, string> = {
  CAST: 'cast', BACKGROUND: 'cast', STUNTS: 'risk', VEHICLES: 'link', ANIMALS: 'need', ANIMAL_WRANGLER: 'need',
  PROPS: 'slate', SET_DRESSING: 'slate', WARDROBE: 'cast', MAKEUP_HAIR: 'cast', SFX: 'risk', MECHANICAL_FX: 'risk',
  VFX: 'link', SPECIAL_EQUIPMENT: 'need', CAMERA: 'link', ADDITIONAL_LABOR: 'need', SOUND_MUSIC: 'link',
  ART: 'slate', GREENERY: 'money', SECURITY: 'risk', OTHER: 'slate',
};

export default function BreakdownsTab({ projectId, currency = 'AED', accounts = [] }:
  { projectId: string; currency?: string; accounts?: { code: string; title: string }[] }) {
  const [inner, setInner] = useState('scenes');
  const [board, setBoard] = useState<any>(null);

  useEffect(() => { productionApi.scheduling.board(projectId).then((r) => setBoard(r.data)).catch(() => setBoard(false)); }, [projectId]);
  const scenes = useMemo(() => {
    const list: any[] = [];
    for (const d of board?.board || []) for (const s of d.strips) list.push({ ...s, shootDay: d.dayNumber });
    for (const s of board?.unscheduled || []) list.push({ ...s, shootDay: 0 });
    return list;
  }, [board]);

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Layers}
        title="Breakdowns"
        subtitle="Scene, element, location and day views — all generated from the AI script breakdown."
      />
      <Tabs
        active={inner}
        onChange={setInner}
        tabs={[['scenes', 'Scenes'], ['elements', 'Elements'], ['locations', 'Locations'], ['byday', 'By Day']]}
      />

      {inner === 'scenes' && (
        <BreakdownPanel projectId={projectId} currency={currency} accounts={accounts} scenes={scenes} />
      )}
      {inner === 'elements' && <ElementBreakdownView projectId={projectId} />}
      {inner === 'locations' && <LocationBreakdownPanel projectId={projectId} />}
      {inner === 'byday' && <DayRollupView projectId={projectId} />}
    </div>
  );
}

// ── Elements: every tagged element grouped by category ─────────────────────────
function ElementBreakdownView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('ALL');

  const load = useCallback(() => {
    setLoading(true);
    productionApi.breakdown.categoryBreakdown(projectId)
      .then((r) => setData(r.data)).catch(() => setData(false)).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (!data) return <p className="text-xs text-rose-500">Could not load. Run the AI script breakdown first.</p>;
  const categories: any[] = data.categories || [];
  if (categories.length === 0) return <EmptyState icon={Package}>No elements tagged yet. Import a script on the Scenes tab — elements are pulled automatically.</EmptyState>;

  const shown = cat === 'ALL' ? categories : categories.filter((c) => c.category === cat);
  const catTabs: [string, string][] = [['ALL', `All (${data.totalElements})`], ...categories.map((c) => [c.category, `${catLabel(c.category)} ${c.itemCount}`] as [string, string])];

  return (
    <div>
      <StatRow stats={[['Categories', data.categoryCount], ['Distinct elements', data.totalElements], ['Total quantity', categories.reduce((n, c) => n + c.totalQty, 0)]]} />
      <Tabs active={cat} onChange={setCat} tabs={catTabs} />
      <div className="space-y-2">
        {shown.map((c) => (
          <ClusterCard
            key={c.category}
            defaultOpen={shown.length <= 3}
            title={<span className="inline-flex items-center gap-2">{catLabel(c.category)} <Chip tone={CAT_TONE[c.category] || 'slate'}>{c.itemCount} item{c.itemCount === 1 ? '' : 's'}</Chip></span>}
            meta={<span>qty {c.totalQty}{c.estCost ? ` · est. ${currencyLabel(c.estCost)}` : ''}</span>}
          >
            <DataTable
              cols={['Element', 'Qty', 'Scenes', 'Shoot days', 'Cost center', 'Est. cost']}
              align={{ 1: 'right', 5: 'right' }}
              rows={c.items.map((it: any) => [
                it.name,
                it.qty,
                it.scenes.length ? it.scenes.join(', ') : '—',
                it.days.length ? it.days.map(sd).join(', ') : '—',
                it.costCenters.length ? it.costCenters.join('; ') : '—',
                it.estCost ? currencyLabel(it.estCost) : '—',
              ])}
            />
          </ClusterCard>
        ))}
      </div>
    </div>
  );
}

// ── By Day: per-shoot-day call-sheet rollup ────────────────────────────────────
function DayRollupView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.breakdown.dayRollup(projectId)
      .then((r) => setData(r.data)).catch(() => setData(false)).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (!data) return <p className="text-xs text-rose-500">Could not load the day rollup.</p>;

  const days: any[] = data.days || [];
  if (!data.hasSchedule) return (
    <EmptyState icon={CalendarDays}>
      No shoot days scheduled yet. Auto-schedule the scenes (Scenes → Schedule) {data.shootStartDate ? '' : 'and set a shoot start date on the project '}to roll scenes up into per-day call sheets.
    </EmptyState>
  );

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null);

  return (
    <div>
      <StatRow stats={[
        ['Shoot days', data.dayCount],
        ['Scenes scheduled', days.reduce((n, d) => n + d.sceneCount, 0)],
        ['Unscheduled', data.unscheduledCount],
      ]} />
      <div className="flex justify-end mb-3">
        <Btn variant="primary" onClick={() => printDays(`Call-sheet rollup`, days)}><Printer size={13} /> Print rollup</Btn>
      </div>
      <div className="space-y-2">
        {days.map((d) => (
          <ClusterCard
            key={d.day}
            defaultOpen={days.length <= 2}
            title={<span className="inline-flex items-center gap-2"><Clapperboard size={14} className="text-slate-400" /> Day {d.day}{d.date ? <span className="text-slate-400 font-normal text-[13px]">· {fmtDate(d.date)}</span> : null}</span>}
            badges={d.locations.map((l: string) => <Chip key={l} tone="link">{l}</Chip>)}
            meta={<span>{d.sceneCount} scene{d.sceneCount === 1 ? '' : 's'} · {d.pages.toFixed(1)} pg</span>}
          >
            <div>
              <SectionLabel icon={Users}>Cast needed ({d.cast.length})</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {d.cast.length === 0 ? <span className="text-xs text-slate-400">None specified</span> : d.cast.map((c: string) => <Chip key={c} tone="cast">{c}</Chip>)}
              </div>
            </div>
            <DataTable
              cols={['Scene', 'Set', 'I/E', 'D/N', 'Cast', 'Pages']}
              align={{ 5: 'right' }}
              rows={d.scenes.map((s: any) => [
                s.sceneNumber || '—', s.set || s.location || '—', s.intExt || '—', s.dayNight || '—',
                (s.cast || []).join(', ') || '—', Number(s.pages || 0).toFixed(2),
              ])}
            />
            {d.elementsByCategory.length > 0 && (
              <div>
                <SectionLabel icon={Package}>Everything needed this day</SectionLabel>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {d.elementsByCategory.map((c: any) => (
                    <div key={c.category} className="rounded-xl bg-slate-50 p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{catLabel(c.category)}</div>
                      <div className="flex flex-wrap gap-1">
                        {c.items.map((it: any) => <span key={it.name} className="text-[11px] text-slate-600">{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}</span>).reduce((acc: any[], el: any, i: number) => (i ? [...acc, <span key={`s${i}`} className="text-slate-300">·</span>, el] : [el]), [])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ClusterCard>
        ))}
      </div>

      {data.unscheduledCount > 0 && (
        <p className="text-[11px] text-amber-700 mt-3 inline-flex items-center gap-1">
          <CalendarDays size={12} /> {data.unscheduledCount} scene{data.unscheduledCount === 1 ? '' : 's'} not yet assigned to a shoot day.
        </p>
      )}
    </div>
  );
}

function currencyLabel(n: number) { return `AED ${Number(n).toLocaleString()}`; }

// Lightweight print of the day rollup (mirrors the Location Breakdown print helper).
function printDays(title: string, days: any[]) {
  const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
  const body = days.map((d) => `
    <section style="margin-bottom:22px;page-break-inside:avoid">
      <h2 style="font-size:15px;margin:0 0 4px">Day ${d.day}${d.date ? ` — ${esc(new Date(d.date).toDateString())}` : ''}</h2>
      <div style="font-size:11px;color:#475569;margin-bottom:6px">${d.sceneCount} scenes · ${Number(d.pages).toFixed(1)} pages · Locations: ${esc(d.locations.join(', ') || '—')}</div>
      <div style="font-size:11px;margin-bottom:6px"><b>Cast:</b> ${esc(d.cast.join(', ') || '—')}</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b">
          <th style="padding:3px">Scene</th><th>Set</th><th>I/E</th><th>D/N</th><th>Cast</th><th style="text-align:right">Pages</th></tr></thead>
        <tbody>${d.scenes.map((s: any) => `<tr style="border-bottom:1px solid #eef2f7">
          <td style="padding:3px">${esc(s.sceneNumber || '—')}</td><td>${esc(s.set || s.location || '—')}</td><td>${esc(s.intExt || '—')}</td>
          <td>${esc(s.dayNight || '—')}</td><td>${esc((s.cast || []).join(', ') || '—')}</td><td style="text-align:right">${Number(s.pages || 0).toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>
      ${d.elementsByCategory.length ? `<div style="font-size:11px;margin-top:6px">${d.elementsByCategory.map((c: any) => `<div><b>${esc(catLabel(c.category))}:</b> ${esc(c.items.map((i: any) => i.name + (i.quantity > 1 ? ` ×${i.quantity}` : '')).join(', '))}</div>`).join('')}</div>` : ''}
    </section>`).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>${esc(title)}</title></head><body style="font-family:Inter,Arial,sans-serif;color:#0f172a;padding:24px">
    <h1 style="font-size:18px;margin:0 0 16px">${esc(title)}</h1>${body}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
