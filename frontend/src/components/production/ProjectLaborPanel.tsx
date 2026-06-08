'use client';

import { useEffect, useState, useCallback } from 'react';
import { Scale, Save, Snowflake, RefreshCw, AlertTriangle, CheckCircle, Info, ExternalLink, Sparkles } from 'lucide-react';
import { laborApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const PROD_TYPES = ['FEATURE', 'TV_SERIES', 'SHORT', 'TVC', 'DOCUMENTARY', 'MUSIC_VIDEO', 'CORPORATE', 'OTHER'];
const UNION_STATUS = [
  { v: 'NON_UNION', l: 'Non-Union' },
  { v: 'UNION', l: 'Union' },
  { v: 'MIXED', l: 'Mixed' },
];

const RATE_TYPE_LABEL: Record<string, string> = {
  PENSION: 'Pension', HEALTH: 'Health', PENSION_HEALTH: 'Pension & Health',
  PAYROLL_TAX: 'Payroll Tax', WORKERS_COMP: "Workers' Comp", UNEMPLOYMENT: 'Unemployment',
  VACATION_PAY: 'Vacation', HOLIDAY_PAY: 'Holiday', EMPLOYER_TAX: 'Employer Tax',
  UNION_DUES: 'Union Dues', GUILD_CONTRIB: 'Guild Contribution', STATUTORY_GRATUITY: 'Gratuity',
  HANDLING_FEE: 'Handling Fee', OTHER: 'Other',
};

export default function ProjectLaborPanel({ projectId, projectType }: { projectId: string; projectType?: string }) {
  const [geo, setGeo] = useState<any[]>([]);
  const [bodies, setBodies] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    geoNodeId: '', productionType: projectType || 'FEATURE', unionStatus: 'NON_UNION',
    laborBodyIds: [] as string[], asOfDate: new Date().toISOString().slice(0, 10),
  });
  const [countryId, setCountryId] = useState('');
  const [subId, setSubId] = useState('');
  const [frozen, setFrozen] = useState<any[]>([]);
  const [updatesAvailable, setUpdatesAvailable] = useState(0);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const countries = geo.filter((g) => g.level === 'COUNTRY');
  const subNodes = geo.filter((g) => g.parentId === countryId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([laborApi.geoList(), laborApi.projectConfig(projectId)]);
      setGeo(g.data || []);
      const cfg = c.data?.config;
      if (cfg) {
        setConfig({
          geoNodeId: cfg.geoNodeId || '',
          productionType: cfg.productionType || projectType || 'FEATURE',
          unionStatus: cfg.unionStatus || 'NON_UNION',
          laborBodyIds: (cfg.laborBodyIds as string[]) || [],
          asOfDate: cfg.asOfDate ? new Date(cfg.asOfDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
        // resolve country/sub from saved node
        const node = (g.data || []).find((x: any) => x.id === cfg.geoNodeId);
        if (node) {
          if (node.level === 'COUNTRY') setCountryId(node.id);
          else { setSubId(node.id); setCountryId(node.parentId || ''); }
        }
      }
      setFrozen(c.data?.rules || []);
      setUpdatesAvailable(c.data?.updatesAvailable || 0);
      setSnapshotAt(cfg?.snapshotAt || null);
    } finally { setLoading(false); }
  }, [projectId, projectType]);

  useEffect(() => { load(); }, [load]);

  // load bodies for the chosen country
  useEffect(() => {
    if (!countryId) { setBodies([]); return; }
    laborApi.bodies({ countryId }).then((r) => setBodies(r.data || [])).catch(() => setBodies([]));
  }, [countryId]);

  const effectiveGeo = subId || countryId || '';
  const toggleBody = (id: string) =>
    setConfig((c: any) => ({ ...c, laborBodyIds: c.laborBodyIds.includes(id) ? c.laborBodyIds.filter((x: string) => x !== id) : [...c.laborBodyIds, id] }));

  const saveDraft = async () => {
    setBusy(true);
    try { await laborApi.saveConfig(projectId, { ...config, geoNodeId: effectiveGeo || null }); }
    finally { setBusy(false); }
  };

  const doPreview = async () => {
    setBusy(true);
    try {
      const r = await laborApi.resolve({ ...config, geoNodeId: effectiveGeo || null });
      setPreview(r.data); setExcluded(new Set());
    } finally { setBusy(false); }
  };

  const freeze = async () => {
    if (!preview) { await doPreview(); }
    if (!confirm('Freeze these rates into the project? This becomes the immutable snapshot used by the budget. You can re-freeze later.')) return;
    setBusy(true);
    try {
      await laborApi.saveConfig(projectId, { ...config, geoNodeId: effectiveGeo || null });
      const selections: any[] = [];
      (preview?.groups || []).forEach((g: any) => g.rules.forEach((r: any) => {
        if (excluded.has(r.sourceRuleId)) selections.push({ sourceRuleId: r.sourceRuleId, enabled: false });
      }));
      const res = await laborApi.snapshot(projectId, { selections });
      alert(`Frozen ${res.data.frozen} rate rules into the project.`);
      setPreview(null);
      load();
    } finally { setBusy(false); }
  };

  const applyUpdates = async () => {
    if (!confirm('Apply available master-rate updates to this project? Historical figures will be replaced with the newer approved rates.')) return;
    setBusy(true);
    try { const r = await laborApi.applyUpdates(projectId, []); alert(`Applied ${r.data.applied} update(s).`); load(); }
    finally { setBusy(false); }
  };

  const toggleFrozen = async (id: string, enabled: boolean) => { await laborApi.toggleRule(id, enabled); load(); };

  const aiUpdateAll = async () => {
    if (!confirm('AI-update all union/guild/statutory rates (US, Canada, UK, UAE) and incentive programs (incl. Abu Dhabi) from their official sources? Findings are filed in Setup → Rate Approvals — nothing changes live until you approve. Needs the AI key configured.')) return;
    setBusy(true);
    try {
      const r = await laborApi.aiUpdateAll();
      alert(`AI checked ${r.data.agreementsRun} agreement(s) → ${r.data.proposalsFiled} rate proposal(s), and ${r.data.incentivesChecked} incentive program(s).${r.data.errorCount ? `\n${r.data.errorCount} source(s) couldn't be read.` : ''}\n\nReview & approve in Setup → Rate Approvals.`);
    } catch (e: any) { alert(e.response?.data?.message || 'AI update failed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>;

  const pct = (n: number) => `${(Number(n) * 100).toFixed(2)}%`;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Scale size={18} className="text-brand-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Labor & Union Configuration</h3>
            <p className="text-xs text-gray-400">Determine the union/guild and statutory burdens for this project, then freeze them into an immutable snapshot the budget uses.</p>
          </div>
        </div>
        <button onClick={aiUpdateAll} disabled={busy} className="btn btn-secondary text-xs shrink-0" title="AI-update all union/guild/statutory rates + incentives (incl. Abu Dhabi) from official sources → Rate Approvals">
          <Sparkles size={13} className={cn('mr-1', busy && 'animate-pulse')} /> AI update rates
        </button>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="label text-xs">Country</label>
            <select className="input w-full" value={countryId} onChange={(e) => { setCountryId(e.target.value); setSubId(''); }}>
              <option value="">— Select —</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">State / Region (optional)</label>
            <select className="input w-full" value={subId} onChange={(e) => setSubId(e.target.value)} disabled={!subNodes.length}>
              <option value="">— All —</option>
              {subNodes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Production Type</label>
            <select className="input w-full" value={config.productionType} onChange={(e) => setConfig((c: any) => ({ ...c, productionType: e.target.value }))}>
              {PROD_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Union Status</label>
            <select className="input w-full" value={config.unionStatus} onChange={(e) => setConfig((c: any) => ({ ...c, unionStatus: e.target.value }))}>
              {UNION_STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">As-of Date</label>
            <input type="date" className="input w-full" value={config.asOfDate} onChange={(e) => setConfig((c: any) => ({ ...c, asOfDate: e.target.value }))} />
            <p className="text-[10px] text-gray-400 mt-0.5">Rates valid on this date are resolved.</p>
          </div>
        </div>

        <div>
          <label className="label text-xs">Applicable Unions / Guilds / Statutory Bodies</label>
          {!countryId ? (
            <p className="text-xs text-gray-400">Select a country to see available bodies.</p>
          ) : !bodies.length ? (
            <p className="text-xs text-gray-400">No bodies registered for this country yet. Add them under Setup → Labor & Fringe Master.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
              {bodies.map((b) => (
                <label key={b.id} className={cn('flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg border cursor-pointer',
                  config.laborBodyIds.includes(b.id) ? 'border-brand-300 bg-brand-50' : 'border-gray-200')}>
                  <input type="checkbox" checked={config.laborBodyIds.includes(b.id)} onChange={() => toggleBody(b.id)} />
                  <span className="flex-1">{b.shortName || b.name}</span>
                  <span className="text-[9px] uppercase text-gray-400">{b.kind}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-1.5">Statutory bodies (e.g. payroll taxes, UAE gratuity) apply to all classifications automatically when selected.</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={saveDraft} disabled={busy} className="btn btn-secondary text-xs"><Save size={13} className="mr-1" /> Save draft</button>
          <button onClick={doPreview} disabled={busy || !config.laborBodyIds.length} className="btn btn-secondary text-xs"><RefreshCw size={13} className={cn('mr-1', busy && 'animate-spin')} /> Preview rates</button>
          <button onClick={freeze} disabled={busy} className="btn btn-primary text-xs"><Snowflake size={13} className="mr-1" /> Freeze snapshot</button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Resolved rates preview <span className="text-xs font-normal text-gray-400">({preview.count} rules · as of {new Date(preview.asOf).toLocaleDateString()})</span></h4>
          <p className="text-[11px] text-gray-400 mb-3">Untick any rule to exclude it from the snapshot. Estimates are flagged — confirm with your accountant.</p>
          {(preview.groups || []).map((g: any) => (
            <div key={g.laborBody} className="mb-3">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">{g.laborBody}</p>
              <table className="w-full text-sm">
                <tbody>
                  {g.rules.map((r: any) => (
                    <tr key={r.sourceRuleId} className="border-b border-gray-50">
                      <td className="py-1.5 w-8">
                        <input type="checkbox" checked={!excluded.has(r.sourceRuleId)}
                          onChange={() => setExcluded((s) => { const n = new Set(s); n.has(r.sourceRuleId) ? n.delete(r.sourceRuleId) : n.add(r.sourceRuleId); return n; })} />
                      </td>
                      <td className="py-1.5">
                        <span className="text-gray-800">{r.label}</span>
                        {r.classificationCode && <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 rounded px-1">{r.classificationCode}</span>}
                        {r.isEstimate && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded px-1">estimate</span>}
                      </td>
                      <td className="py-1.5 text-xs text-gray-500">{RATE_TYPE_LABEL[r.rateType] || r.rateType}</td>
                      <td className="py-1.5 text-xs text-gray-600">{r.humanText}</td>
                      <td className="py-1.5 text-right">
                        {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-600 inline-flex items-center gap-0.5 text-[11px]" title={r.sourceTitle}><ExternalLink size={11} /></a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Frozen snapshot */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Snowflake size={14} className="text-blue-500" /> Frozen Snapshot
            {snapshotAt && <span className="text-xs font-normal text-gray-400">— {new Date(snapshotAt).toLocaleString()}</span>}
          </h4>
          {updatesAvailable > 0 && (
            <button onClick={applyUpdates} disabled={busy} className="btn btn-secondary text-xs text-amber-700 border-amber-300">
              <AlertTriangle size={12} className="mr-1" /> {updatesAvailable} rate update(s) available
            </button>
          )}
        </div>
        {!frozen.length ? (
          <p className="text-xs text-gray-400 flex items-center gap-1"><Info size={12} /> No rates frozen yet. Configure above and click <b>Freeze snapshot</b>.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="py-2 text-left">On</th>
                <th className="py-2 text-left">Body</th>
                <th className="py-2 text-left">Burden</th>
                <th className="py-2 text-left">Class</th>
                <th className="py-2 text-left">Basis</th>
                <th className="py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {frozen.map((r: any) => (
                <tr key={r.id} className={cn('border-b border-gray-50', !r.enabled && 'opacity-40')}>
                  <td className="py-1.5"><input type="checkbox" checked={r.enabled} onChange={(e) => toggleFrozen(r.id, e.target.checked)} /></td>
                  <td className="py-1.5 text-xs text-gray-500">{r.laborBodyName}</td>
                  <td className="py-1.5 text-gray-800">{r.label}
                    {r.isEstimate && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded px-1">est</span>}</td>
                  <td className="py-1.5 text-xs text-gray-500">{r.classificationCode || '— all —'}</td>
                  <td className="py-1.5 text-xs text-gray-600">
                    {r.calcMethod === 'PERCENT' || r.calcMethod === 'PERCENT_WITH_CAP'
                      ? pct(r.value) : `${r.currency} ${Number(r.value)}`}
                    {r.capAmount ? <span className="text-gray-400"> (cap {Number(r.capAmount).toLocaleString()})</span> : ''}
                  </td>
                  <td className="py-1.5">{r.sourceUrl
                    ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-600 text-[11px] inline-flex items-center gap-0.5"><ExternalLink size={10} /> {r.sourceTitle ? r.sourceTitle.slice(0, 24) : 'link'}</a>
                    : <span className="text-gray-300 text-[11px]">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-gray-400 mt-3 flex items-start gap-1">
          <CheckCircle size={12} className="mt-0.5 text-green-500" />
          This snapshot is frozen to the project. Master-rate changes never alter it automatically — apply updates explicitly above. Tag budget lines with a matching <b>classification code</b> to apply these burdens, then run <b>Apply fringes</b> on the Fringe Detail tab.
        </p>
      </div>
    </div>
  );
}
