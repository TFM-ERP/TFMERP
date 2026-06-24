'use client';

/**
 * SYS-LOC V2 · Milestone 1 — the redesigned Locations module shell.
 * Six lifecycle surfaces (Board · Map · Scouting · Clearance · Logistics · Reports).
 * Board is wired to live data (productionApi.locations + locationNeeds) and renders the
 * pipeline (Needs → Sourcing → Clearing ▣ → Confirmed → Wrapped) with gates + KPIs.
 * The other surfaces land in M2–M6; for now they route to the existing panels so nothing
 * regresses. Token-driven (themes across the app); additive — the legacy inner tabs stay.
 */
import { useEffect, useMemo, useState } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import LocationsMap from './LocationsMap';
import LocationsClearance from './LocationsClearance';
import LocationsScouting from './LocationsScouting';
import LocationsLogistics from './LocationsLogistics';
import LocationsReports from './LocationsReports';
import LocationDetail from './LocationDetail';
import LocationNeedsPanel from './LocationNeedsPanel';
import LocationsPanel from './LocationsPanel';
import ReadinessPanel from './ReadinessPanel';

const STYLE = `
.lw-tabs{display:flex;gap:4px;overflow-x:auto;padding:2px 0 12px;border-bottom:1px solid var(--border-1);margin-bottom:14px}
.lw-t{font-size:12.5px;font-weight:600;color:var(--text-3);padding:7px 13px;border-radius:999px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;border:1px solid transparent}
.lw-t:hover{background:var(--surface-2);color:var(--text-1)}
.lw-t.on{background:var(--accent-soft);color:var(--accent);font-weight:700}
.lw-t .ct{font-size:9.5px;font-weight:800;background:var(--surface-2);border:1px solid var(--border-1);border-radius:999px;padding:0 6px}
.lw-ph{display:flex;align-items:flex-end;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.lw-ph .k{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:var(--accent)}
.lw-ph h2{font-family:var(--font-display,inherit);font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.lw-ph .s{font-size:12px;color:var(--text-3);margin-top:2px}
.lw-btn{border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:12px;padding:8px 13px;border-radius:9px;background:var(--accent);color:var(--accent-on);display:inline-flex;align-items:center;gap:6px}
.lw-btn.ghost{background:var(--surface-2);color:var(--text-2);border:1px solid var(--border-1)}
.lw-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}
.lw-stat{background:var(--surface-1);border:1px solid var(--border-1);border-radius:11px;padding:10px 12px}
.lw-stat .k{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);font-weight:700}
.lw-stat .v{font-size:20px;font-weight:800;margin-top:3px;letter-spacing:-.02em}
.lw-stat .d{font-size:10px;color:var(--text-3);margin-top:1px}
.lw-kanban{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;align-items:start}
.lw-col{background:var(--surface-2);border:1px solid var(--border-1);border-radius:12px;padding:9px;min-height:80px}
.lw-chd{display:flex;align-items:center;justify-content:space-between;padding:3px 5px 9px;font-size:11px;font-weight:800;color:var(--text-2)}
.lw-chd .ct{font-size:9px;color:var(--text-3);background:var(--surface-1);border:1px solid var(--border-1);border-radius:999px;padding:1px 6px}
.lw-card{background:var(--surface-1);border:1px solid var(--border-1);border-radius:9px;padding:9px 10px;margin-bottom:7px;cursor:pointer;transition:all .15s}
.lw-card:hover{border-color:var(--accent);transform:translateY(-1px)}
.lw-card .t{font-size:12.5px;font-weight:700}
.lw-card .s{font-size:10.5px;color:var(--text-3);margin-top:2px}
.lw-row2{display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap}
.lw-bdg{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px}
.b-ok{background:var(--ok-soft);color:var(--ok)}.b-warn{background:var(--warn-soft);color:var(--warn)}.b-dn{background:var(--danger-soft);color:var(--danger)}.b-ac{background:var(--accent-soft);color:var(--accent)}.b-n{background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-1)}
.lw-empty{font-size:11px;color:var(--text-3);padding:10px 4px;text-align:center}
.lw-soon{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;padding:26px 22px;text-align:center}
.lw-soon .ic{font-size:30px}
.lw-soon h3{font-size:16px;font-weight:800;margin:8px 0 5px}
.lw-soon p{font-size:13px;color:var(--text-3);max-width:520px;margin:0 auto 14px}
.lw-soon .ms{font-size:10px;font-weight:800;color:var(--accent);background:var(--accent-soft);padding:3px 9px;border-radius:999px;display:inline-block;margin-bottom:10px}
.lw-sub{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px}
.lw-st{font-size:11.5px;font-weight:600;color:var(--text-3);padding:5px 11px;border-radius:8px;cursor:pointer;border:1px solid var(--border-1);background:var(--surface-1);white-space:nowrap}
.lw-st:hover{color:var(--text-1);border-color:var(--accent)}
.lw-st.on{background:var(--accent);color:var(--accent-on);border-color:var(--accent);font-weight:700}
@media(max-width:1024px){.lw-kpis{grid-template-columns:repeat(2,1fr)}.lw-kanban{grid-template-columns:1fr 1fr}}
`;

const CLEARING = ['NOC_REQUESTED', 'AGREEMENT_SENT', 'PERMIT_APPLIED', 'INSURANCE_RECEIVED'];
function colOf(loc: any): string {
  const s = loc.pipelineStage || (loc.status === 'CONFIRMED' ? 'CONFIRMED' : loc.status === 'RELEASED' ? 'WRAPPED' : 'SOURCING');
  if (s === 'CONFIRMED' || loc.status === 'CONFIRMED') return 'confirmed';
  if (s === 'WRAPPED' || loc.status === 'RELEASED') return 'wrapped';
  if (CLEARING.includes(s)) return 'clearing';
  return 'sourcing';
}
const permitBadge = (p?: string) => {
  const v = (p || 'NONE').toUpperCase();
  if (v === 'APPROVED') return <span className="lw-bdg b-ok">permit ✓</span>;
  if (v === 'APPLIED') return <span className="lw-bdg b-warn">permit ⧗</span>;
  if (v === 'REJECTED') return <span className="lw-bdg b-dn">permit ✗</span>;
  return <span className="lw-bdg b-n">no permit</span>;
};

export default function LocationsWorkspace({ projectId, currency = 'AED', onNavigateInner }:
  { projectId: string; currency?: string; onNavigateInner?: (t: string) => void }) {
  const [tab, setTab] = useState('board');
  const [locs, setLocs] = useState<any[]>([]);
  const [needs, setNeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLocId, setOpenLocId] = useState<string | null>(null);
  const [boardView, setBoardView] = useState<'pipeline' | 'needs' | 'library' | 'readiness'>('pipeline');

  useEffect(() => {
    let alive = true; setLoading(true);
    Promise.allSettled([productionApi.locations.list(projectId), productionApi.locationNeeds.list(projectId)])
      .then(([l, n]) => {
        if (!alive) return;
        if (l.status === 'fulfilled') { const d: any = l.value.data; setLocs(Array.isArray(d) ? d : (d?.items || [])); }
        if (n.status === 'fulfilled') { const d: any = n.value.data; setNeeds(Array.isArray(d) ? d : (d?.items || [])); }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId]);

  const groups = useMemo(() => {
    const g: Record<string, any[]> = { sourcing: [], clearing: [], confirmed: [], wrapped: [] };
    for (const l of locs) g[colOf(l)].push(l);
    return g;
  }, [locs]);
  const openNeeds = useMemo(() => needs.filter((n: any) => (n.status || '').toUpperCase() !== 'LOCKED'), [needs]);
  const feeTotal = useMemo(() => locs.reduce((a, l) => a + (Number(l.locationFeePerDay) || 0), 0), [locs]);
  const money = (n: number) => formatCurrency(n || 0, currency);
  // Remap legacy inner-tab routes onto the 6-surface workspace (so nothing dead-ends).
  const go = (key?: string) => {
    if (!key) return;
    if (key === 'library') { setTab('board'); setBoardView('library'); }
    else if (key === 'needs') { setTab('board'); setBoardView('needs'); }
    else if (key === 'readiness') { setTab('board'); setBoardView('readiness'); }
    else if (key === 'scouts') setTab('scouting');
    else if (key === 'clearance') setTab('clearance');
    else if (key === 'report' || key === 'reports') setTab('reports');
    else onNavigateInner?.(key);
  };

  const Card = ({ l }: { l: any }) => (
    <div className="lw-card" onClick={() => setOpenLocId(l.id)}>
      <div className="t">{l.name || 'Untitled'}</div>
      <div className="s">{l.type || '—'}{l.scenes ? ` · Sc ${l.scenes}` : ''}{l.emirate ? ` · ${l.emirate}` : ''}</div>
      <div className="lw-row2">{permitBadge(l.permitStatus)}{Number(l.locationFeePerDay) > 0 && <span className="lw-bdg b-n">{money(Number(l.locationFeePerDay))}/day</span>}</div>
    </div>
  );
  const Col = ({ title, items, render }: any) => (
    <div className="lw-col">
      <div className="lw-chd">{title} <span className="ct">{items.length}</span></div>
      {items.length === 0 ? <div className="lw-empty">—</div> : items.map(render)}
    </div>
  );

  const TABS: [string, string, number?][] = [
    ['board', '▦ Board'], ['map', '🗺 Map & Routes'], ['scouting', '🧭 Scouting'],
    ['clearance', '🛡 Clearance & Compliance'], ['logistics', '🚚 Logistics & Unit Moves'], ['reports', '📊 Reports'],
  ];
  const Soon = ({ icon, ms, title, desc, to, cta }: any) => (
    <div className="lw-soon">
      <div className="ic">{icon}</div>
      <div className="ms">{ms}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      {to && <button className="lw-btn ghost" onClick={() => go(to)}>{cta}</button>}
    </div>
  );

  if (openLocId) return <LocationDetail locationId={openLocId} projectId={projectId} currency={currency} onBack={() => setOpenLocId(null)} onNavigateInner={go} />;

  return (
    <div>
      <style>{STYLE}</style>
      <div className="lw-tabs">
        {TABS.map(([k, lbl]) => (
          <div key={k} className={`lw-t ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{lbl}</div>
        ))}
      </div>

      {tab === 'board' && (
        <div>
          <div className="lw-sub">
            {([['pipeline', '▦ Pipeline'], ['needs', '⟲ Needs & options'], ['library', '📍 Library'], ['readiness', '✓ Readiness']] as [string, string][]).map(([k, lbl]) => (
              <div key={k} className={`lw-st ${boardView === k ? 'on' : ''}`} onClick={() => setBoardView(k as any)}>{lbl}</div>
            ))}
          </div>
          {boardView === 'pipeline' && (<>
          <div className="lw-ph">
            <div><div className="k">Locations · Pipeline</div><h2>Location Board</h2>
              <div className="s">{locs.length} locations · {needs.length} needs · {groups.clearing.length} clearing</div></div>
            <span style={{ flex: 1 }} />
            <button className="lw-btn ghost" onClick={() => setBoardView('needs')}>⟲ Needs & options</button>
            <button className="lw-btn" onClick={() => setBoardView('library')}>＋ New location</button>
          </div>
          <div className="lw-kpis">
            <div className="lw-stat"><div className="k">Needs open</div><div className="v">{openNeeds.length}</div><div className="d">of {needs.length}</div></div>
            <div className="lw-stat"><div className="k">Sourcing</div><div className="v">{groups.sourcing.length}</div><div className="d">candidates</div></div>
            <div className="lw-stat"><div className="k">Clearing ▣</div><div className="v">{groups.clearing.length}</div><div className="d">in gate</div></div>
            <div className="lw-stat"><div className="k">Confirmed</div><div className="v">{groups.confirmed.length}</div><div className="d">locked</div></div>
            <div className="lw-stat"><div className="k">Fees / day</div><div className="v">{feeTotal >= 1000 ? `${(feeTotal / 1000).toFixed(0)}k` : feeTotal}</div><div className="d">{currency} sum</div></div>
          </div>
          {loading ? <div className="lw-empty">Loading board…</div> : (
            <div className="lw-kanban">
              <Col title="① Need · sourcing" items={openNeeds} render={(n: any) => (
                <div key={n.id} className="lw-card" onClick={() => setBoardView('needs')}>
                  <div className="t">{n.name || 'Need'}</div>
                  <div className="s">{n.intExt || ''}{n.sceneRefs ? ` · Sc ${n.sceneRefs}` : ''}{n.options?.length ? ` · ${n.options.length} options` : ''}</div>
                  <div className="lw-row2"><span className="lw-bdg b-ac">{(n.status || 'SOURCING').toLowerCase()}</span></div>
                </div>)} />
              <Col title="② Sourcing / recce" items={groups.sourcing} render={(l: any) => <Card key={l.id} l={l} />} />
              <Col title="③ Clearing ▣" items={groups.clearing} render={(l: any) => <Card key={l.id} l={l} />} />
              <Col title="④ Confirmed" items={groups.confirmed} render={(l: any) => <Card key={l.id} l={l} />} />
              <Col title="⑤ Wrapped" items={groups.wrapped} render={(l: any) => <Card key={l.id} l={l} />} />
            </div>
          )}
          </>)}
          {boardView === 'needs' && <LocationNeedsPanel projectId={projectId} />}
          {boardView === 'library' && <LocationsPanel projectId={projectId} currency={currency} />}
          {boardView === 'readiness' && <ReadinessPanel projectId={projectId} />}
        </div>
      )}

      {tab === 'map' && (
        <div>
          <div className="lw-ph"><div><div className="k">Locations · GIS</div><h2>Map &amp; Routes</h2><div className="s">Unit base · {locs.length} locations · routes &amp; estimated drive time</div></div></div>
          <LocationsMap locations={locs} currency={currency} />
        </div>
      )}
      {tab === 'scouting' && <LocationsScouting projectId={projectId} onNavigateInner={go} />}
      {tab === 'clearance' && <LocationsClearance projectId={projectId} locations={locs} onNavigateInner={go} />}
      {tab === 'logistics' && <LocationsLogistics projectId={projectId} locations={locs} currency={currency} />}
      {tab === 'reports' && <LocationsReports projectId={projectId} locations={locs} currency={currency} onNavigateInner={go} />}
    </div>
  );
}
