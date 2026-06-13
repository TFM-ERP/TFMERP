'use client';

import { useEffect, useState, useCallback } from 'react';
import { Scale, Plus, Trash2, Edit2, Save, X, ExternalLink, Globe, Building2, FileText, Tag, BookOpen, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { laborApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const KINDS = ['UNION', 'GUILD', 'STATUTORY', 'PAYROLL_PROVIDER'];
const GEO_LEVELS = ['COUNTRY', 'STATE', 'REGION', 'DISTRICT', 'CITY', 'ZONE'];
const PROD_TYPES = ['FEATURE', 'TV_SERIES', 'SHORT', 'TVC', 'DOCUMENTARY', 'MUSIC_VIDEO', 'CORPORATE', 'OTHER'];
const RATE_TYPES = ['PENSION', 'HEALTH', 'PENSION_HEALTH', 'PAYROLL_TAX', 'WORKERS_COMP', 'UNEMPLOYMENT', 'VACATION_PAY', 'HOLIDAY_PAY', 'EMPLOYER_TAX', 'UNION_DUES', 'GUILD_CONTRIB', 'STATUTORY_GRATUITY', 'HANDLING_FEE', 'OTHER'];
const CALC_METHODS = ['PERCENT', 'FLAT_PER_DAY', 'FLAT_PER_WEEK', 'FLAT_PER_HOUR', 'PERCENT_WITH_CAP', 'TIERED'];
const BASES = ['', 'GROSS', 'STRAIGHT_TIME', 'TAXABLE', 'WORKED_DAYS'];
const CAP_PERIODS = ['', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'PER_PRODUCTION'];

export default function LaborMasterPage() {
  const [tab, setTab] = useState<'bodies' | 'geo' | 'incentives'>('bodies');
  const [geo, setGeo] = useState<any[]>([]);
  const [bodies, setBodies] = useState<any[]>([]);
  const [selBody, setSelBody] = useState<any>(null);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [selAgr, setSelAgr] = useState<any>(null);
  const countries = geo.filter((g) => g.level === 'COUNTRY');

  const loadBase = useCallback(async () => {
    const [g, b] = await Promise.all([laborApi.geoList(), laborApi.bodies()]);
    setGeo(g.data || []); setBodies(b.data || []);
  }, []);
  useEffect(() => { loadBase(); }, [loadBase]);

  const openBody = async (b: any) => {
    setSelBody(b); setSelAgr(null);
    const [a, s] = await Promise.all([laborApi.agreements(b.id), laborApi.sources(b.id)]);
    setAgreements(a.data || []); setSources(s.data || []);
  };
  const openAgr = async (a: any) => {
    const r = await laborApi.agreement(a.id);
    setSelAgr(r.data);
  };
  const reloadAgr = () => selAgr && openAgr(selAgr);
  const reloadBody = () => selBody && openBody(selBody);

  const [refreshing, setRefreshing] = useState(false);
  const doRefresh = async () => {
    if (!confirm('Refresh checks the approved official sources for changes and files review items in Rate Approvals. It never changes live rates automatically. Continue?')) return;
    setRefreshing(true);
    try {
      const ids = selBody ? [selBody.id] : [];
      const r = await laborApi.refresh(ids);
      alert(`Checked ${r.data.checked} source(s). ${r.data.changed} changed. Review items filed in Setup → Rate Approvals.`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Refresh failed.');
    } finally { setRefreshing(false); }
  };

  const [aiBusy, setAiBusy] = useState(false);
  const doAiUpdateAll = async () => {
    if (!confirm('AI-update ALL union/guild/statutory rates (US, Canada, UK, UAE) and the incentive programs (incl. Abu Dhabi) from their official sources? Findings are filed as proposals in Rate Approvals — nothing changes live until you approve. Needs the AI key configured.')) return;
    setAiBusy(true);
    try {
      const r = await laborApi.aiUpdateAll();
      alert(`AI checked ${r.data.agreementsRun} agreement(s) → ${r.data.proposalsFiled} rate proposal(s), and ${r.data.incentivesChecked} incentive program(s).${r.data.errorCount ? `\n${r.data.errorCount} source(s) couldn't be read.` : ''}\n\nReview & approve in Setup → Rate Approvals.`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'AI update failed.');
    } finally { setAiBusy(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Scale size={20} style={{ color: 'var(--gold)' }} />
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Masters</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Labor & Fringe Master</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={doAiUpdateAll} disabled={aiBusy} className="btn btn-primary text-xs">
            <Sparkles size={13} className={cn('mr-1', aiBusy && 'animate-pulse')} /> {aiBusy ? 'AI updating…' : 'AI update all rates'}
          </button>
          <button onClick={doRefresh} disabled={refreshing} className="btn btn-secondary text-xs">
            <RefreshCw size={13} className={cn('mr-1', refreshing && 'animate-spin')} /> {refreshing ? 'Checking…' : selBody ? `Refresh ${selBody.shortName || 'body'}` : 'Refresh all sources'}
          </button>
          <Link href="/setup/rate-approvals" className="btn btn-secondary text-xs">Rate Approvals →</Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">Global master data for unions, guilds, statutory bodies, agreements and rate rules. Changes here only affect <b>future</b> project snapshots — existing projects keep their frozen rates.</p>

      <div className="flex gap-1 mb-5">
        {(['bodies', 'geo', 'incentives'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg', tab === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
            {t === 'bodies' ? 'Labor Bodies & Agreements' : t === 'geo' ? 'Geography' : 'Incentives'}
          </button>
        ))}
      </div>

      {tab === 'geo' && <GeoManager geo={geo} reload={loadBase} />}
      {tab === 'incentives' && <IncentivesManager geo={geo} />}

      {tab === 'bodies' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Bodies list */}
          <div className="col-span-3">
            <BodiesList bodies={bodies} countries={countries} selId={selBody?.id} onSelect={openBody} reload={loadBase} />
          </div>

          {/* Agreements + sources for selected body */}
          <div className="col-span-4">
            {!selBody ? <div className="card text-sm text-gray-400">Select a labor body.</div> : (
              <>
                <AgreementsList body={selBody} agreements={agreements} sources={sources} selId={selAgr?.id} onSelect={openAgr} reload={reloadBody} />
                <SourcesList body={selBody} sources={sources} reload={reloadBody} />
              </>
            )}
          </div>

          {/* Agreement detail: classifications + rate rules */}
          <div className="col-span-5">
            {!selAgr ? <div className="card text-sm text-gray-400">Select an agreement to manage classifications & rate rules.</div> : (
              <AgreementDetail agr={selAgr} sources={sources} reload={reloadAgr} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bodies ────────────────────────────────────────────────────────────────────
function BodiesList({ bodies, countries, selId, onSelect, reload }: any) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ kind: 'UNION', name: '', shortName: '', countryId: '', website: '' });
  const add = async () => {
    if (!form.name) return;
    await laborApi.createBody({ ...form, countryId: form.countryId || null });
    setAdding(false); setForm({ kind: 'UNION', name: '', shortName: '', countryId: '', website: '' }); reload();
  };
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1"><Building2 size={13} /> Bodies</h3>
        <button onClick={() => setAdding(!adding)} className="text-brand-600 hover:text-brand-700"><Plus size={15} /></button>
      </div>
      {adding && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg space-y-1.5">
          <select className="input w-full text-xs" value={form.kind} onChange={(e) => setForm((f: any) => ({ ...f, kind: e.target.value }))}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <input className="input w-full text-xs" placeholder="Name" value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          <input className="input w-full text-xs" placeholder="Short name" value={form.shortName} onChange={(e) => setForm((f: any) => ({ ...f, shortName: e.target.value }))} />
          <select className="input w-full text-xs" value={form.countryId} onChange={(e) => setForm((f: any) => ({ ...f, countryId: e.target.value }))}>
            <option value="">— Country —</option>{countries.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input w-full text-xs" placeholder="Website" value={form.website} onChange={(e) => setForm((f: any) => ({ ...f, website: e.target.value }))} />
          <div className="flex gap-1"><button onClick={add} className="btn btn-primary text-xs py-1 flex-1">Add</button><button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1">Cancel</button></div>
        </div>
      )}
      <div className="space-y-1">
        {bodies.map((b: any) => (
          <button key={b.id} onClick={() => onSelect(b)} className={cn('w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center justify-between', selId === b.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50')}>
            <span>{b.shortName || b.name}</span>
            <span className="text-[9px] uppercase text-gray-400">{b.kind}</span>
          </button>
        ))}
        {!bodies.length && <p className="text-xs text-gray-400">No bodies yet.</p>}
      </div>
    </div>
  );
}

// ── Agreements ──────────────────────────────────────────────────────────────────
function AgreementsList({ body, agreements, sources, selId, onSelect, reload }: any) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ name: '', productionTypes: ['FEATURE'], effectiveDate: '', expirationDate: '', tier: '', sourceId: '' });
  const toggleType = (t: string) => setForm((f: any) => ({ ...f, productionTypes: f.productionTypes.includes(t) ? f.productionTypes.filter((x: string) => x !== t) : [...f.productionTypes, t] }));
  const add = async () => {
    if (!form.name || !form.effectiveDate) return;
    await laborApi.createAgreement({ ...form, laborBodyId: body.id, sourceId: form.sourceId || null });
    setAdding(false); setForm({ name: '', productionTypes: ['FEATURE'], effectiveDate: '', expirationDate: '', tier: '', sourceId: '' }); reload();
  };
  return (
    <div className="card p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1"><FileText size={13} /> {body.shortName || body.name} — Agreements</h3>
        <button onClick={() => setAdding(!adding)} className="text-brand-600 hover:text-brand-700"><Plus size={15} /></button>
      </div>
      {adding && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg space-y-1.5">
          <input className="input w-full text-xs" placeholder="Agreement name" value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          <div className="flex flex-wrap gap-1">
            {PROD_TYPES.map((t) => <button key={t} onClick={() => toggleType(t)} className={cn('text-[10px] px-1.5 py-0.5 rounded', form.productionTypes.includes(t) ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600')}>{t}</button>)}
          </div>
          <div className="flex gap-1">
            <input type="date" className="input w-full text-xs" value={form.effectiveDate} onChange={(e) => setForm((f: any) => ({ ...f, effectiveDate: e.target.value }))} title="Effective" />
            <input type="date" className="input w-full text-xs" value={form.expirationDate} onChange={(e) => setForm((f: any) => ({ ...f, expirationDate: e.target.value }))} title="Expiration" />
          </div>
          <input className="input w-full text-xs" placeholder="Tier (optional)" value={form.tier} onChange={(e) => setForm((f: any) => ({ ...f, tier: e.target.value }))} />
          <select className="input w-full text-xs" value={form.sourceId} onChange={(e) => setForm((f: any) => ({ ...f, sourceId: e.target.value }))}>
            <option value="">— Source —</option>{sources.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <div className="flex gap-1"><button onClick={add} className="btn btn-primary text-xs py-1 flex-1">Add</button><button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1">Cancel</button></div>
        </div>
      )}
      <div className="space-y-1">
        {agreements.map((a: any) => (
          <div key={a.id} className={cn('px-2 py-1.5 rounded-lg text-sm flex items-center justify-between', selId === a.id ? 'bg-brand-50' : 'hover:bg-gray-50')}>
            <button onClick={() => onSelect(a)} className="text-left flex-1">
              <span className="text-gray-800">{a.name}</span>
              <span className="block text-[10px] text-gray-400">{a._count?.rateRules || 0} rules · {new Date(a.effectiveDate).getFullYear()}{a.expirationDate ? `–${new Date(a.expirationDate).getFullYear()}` : ''}</span>
            </button>
            <button onClick={async () => { if (confirm('Delete agreement and its rules?')) { await laborApi.removeAgreement(a.id); reload(); } }} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
          </div>
        ))}
        {!agreements.length && <p className="text-xs text-gray-400">No agreements yet.</p>}
      </div>
    </div>
  );
}

// ── Sources ──────────────────────────────────────────────────────────────────────
function SourcesList({ body, sources, reload }: any) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ title: '', url: '', publisher: '' });
  const add = async () => {
    if (!form.title) return;
    await laborApi.createSource({ ...form, laborBodyId: body.id });
    setAdding(false); setForm({ title: '', url: '', publisher: '' }); reload();
  };
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1"><BookOpen size={13} /> Approved Sources</h3>
        <button onClick={() => setAdding(!adding)} className="text-brand-600 hover:text-brand-700"><Plus size={15} /></button>
      </div>
      {adding && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg space-y-1.5">
          <input className="input w-full text-xs" placeholder="Title" value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} />
          <input className="input w-full text-xs" placeholder="URL (official source)" value={form.url} onChange={(e) => setForm((f: any) => ({ ...f, url: e.target.value }))} />
          <input className="input w-full text-xs" placeholder="Publisher" value={form.publisher} onChange={(e) => setForm((f: any) => ({ ...f, publisher: e.target.value }))} />
          <div className="flex gap-1"><button onClick={add} className="btn btn-primary text-xs py-1 flex-1">Add</button><button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1">Cancel</button></div>
        </div>
      )}
      <div className="space-y-1">
        {sources.map((s: any) => (
          <div key={s.id} className="px-2 py-1 text-xs flex items-center justify-between">
            <span className="text-gray-600">{s.title}</span>
            {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-brand-600"><ExternalLink size={11} /></a>}
          </div>
        ))}
        {!sources.length && <p className="text-xs text-gray-400">No sources yet.</p>}
      </div>
    </div>
  );
}

// ── Agreement detail: classifications + rate rules ─────────────────────────────────
function AgreementDetail({ agr, sources, reload }: any) {
  const [addingClass, setAddingClass] = useState(false);
  const [cf, setCf] = useState<any>({ code: '', title: '', riskClass: '' });
  const [addingRule, setAddingRule] = useState(false);
  const [rf, setRf] = useState<any>(blankRule());
  const [proposing, setProposing] = useState<any>(null); // rule being changed
  const [pf, setPf] = useState<any>({ value: '', effectiveDate: '', notes: '', sourceId: '' });

  const submitProposal = async () => {
    if (pf.value === '' || !pf.effectiveDate) return;
    await laborApi.createProposal({
      ruleId: proposing.id, origin: 'MANUAL',
      payload: { value: Number(pf.value), effectiveDate: pf.effectiveDate, sourceId: pf.sourceId || proposing.sourceId || null, notes: pf.notes },
    });
    setProposing(null); setPf({ value: '', effectiveDate: '', notes: '', sourceId: '' });
    alert('Change proposed. It will go live only after approval in Setup → Rate Approvals.');
  };

  const [aiBusy, setAiBusy] = useState(false);
  const runAi = async () => {
    if (!confirm('Run the AI research assistant on this agreement\'s approved source? It extracts candidate figures with citations and files them as proposals for approval — it never changes live rates.')) return;
    setAiBusy(true);
    try {
      const r = await laborApi.aiResearch({ agreementId: agr.id });
      alert(`AI filed ${r.data.filed} candidate proposal(s) from ${r.data.candidates} extraction(s). Review them in Setup → Rate Approvals.`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'AI research failed.');
    } finally { setAiBusy(false); }
  };

  function blankRule() {
    return { label: '', rateType: 'PENSION', calcMethod: 'PERCENT', value: '', base: 'GROSS', capPeriod: '', capAmount: '', currency: 'USD', glAccountCode: '', classificationId: '', sourceId: '', effectiveDate: '', expirationDate: '', isEstimate: false, notes: '' };
  }
  const addClass = async () => {
    if (!cf.code) return;
    await laborApi.createClass({ ...cf, agreementId: agr.id });
    setAddingClass(false); setCf({ code: '', title: '', riskClass: '' }); reload();
  };
  const addRule = async () => {
    if (!rf.label || rf.value === '') return;
    await laborApi.createRule({
      ...rf, agreementId: agr.id,
      value: Number(rf.value),
      capAmount: rf.capAmount ? Number(rf.capAmount) : null,
      base: rf.base || null, capPeriod: rf.capPeriod || null,
      classificationId: rf.classificationId || null, sourceId: rf.sourceId || null,
      expirationDate: rf.expirationDate || null,
    });
    setAddingRule(false); setRf(blankRule()); reload();
  };
  const pct = (n: number) => `${(Number(n) * 100).toFixed(3)}%`;

  return (
    <div className="space-y-3">
      {/* Classifications */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1"><Tag size={13} /> Classifications</h3>
          <button onClick={() => setAddingClass(!addingClass)} className="text-brand-600 hover:text-brand-700"><Plus size={15} /></button>
        </div>
        {addingClass && (
          <div className="mb-2 p-2 bg-gray-50 rounded-lg flex gap-1">
            <input className="input text-xs flex-1" placeholder="Code (PERFORMER)" value={cf.code} onChange={(e) => setCf((f: any) => ({ ...f, code: e.target.value.toUpperCase() }))} />
            <input className="input text-xs flex-1" placeholder="Title" value={cf.title} onChange={(e) => setCf((f: any) => ({ ...f, title: e.target.value }))} />
            <input className="input text-xs w-20" placeholder="WC class" value={cf.riskClass} onChange={(e) => setCf((f: any) => ({ ...f, riskClass: e.target.value }))} />
            <button onClick={addClass} className="btn btn-primary text-xs py-1">Add</button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(agr.classifications || []).map((c: any) => (
            <span key={c.id} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 rounded px-1.5 py-0.5">
              <b className="text-gray-700">{c.code}</b> <span className="text-gray-400">{c.title}</span>
              <button onClick={async () => { if (confirm('Delete classification?')) { await laborApi.removeClass(c.id); reload(); } }} className="text-gray-300 hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
          {!agr.classifications?.length && <p className="text-xs text-gray-400">None. Statutory rules can apply to all without a classification.</p>}
        </div>
      </div>

      {/* Rate rules */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600 uppercase">Rate Rules</h3>
          <div className="flex items-center gap-2">
            <button onClick={runAi} disabled={aiBusy} title="AI research from approved source → cited proposals" className="text-[11px] text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 border border-brand-200 rounded px-1.5 py-0.5">
              <Sparkles size={12} className={cn(aiBusy && 'animate-pulse')} /> {aiBusy ? 'Researching…' : 'AI research'}
            </button>
            <button onClick={() => setAddingRule(!addingRule)} className="text-brand-600 hover:text-brand-700"><Plus size={15} /></button>
          </div>
        </div>
        {proposing && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">Propose change — {proposing.label}</p>
            <p className="text-[10px] text-amber-600">Current value: {proposing.calcMethod?.startsWith('PERCENT') ? `${(Number(proposing.value) * 100).toFixed(3)}%` : `${proposing.currency} ${Number(proposing.value)}`}. This is staged for approval — it does NOT change the live rate.</p>
            <div className="grid grid-cols-2 gap-1.5">
              <input className="input text-xs" placeholder="New value (0.205 or 38.5)" value={pf.value} onChange={(e) => setPf((f: any) => ({ ...f, value: e.target.value }))} />
              <input type="date" className="input text-xs" value={pf.effectiveDate} onChange={(e) => setPf((f: any) => ({ ...f, effectiveDate: e.target.value }))} title="Effective date" />
              <select className="input text-xs" value={pf.sourceId} onChange={(e) => setPf((f: any) => ({ ...f, sourceId: e.target.value }))}>
                <option value="">— Source —</option>{sources.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
              <input className="input text-xs" placeholder="Notes / reason" value={pf.notes} onChange={(e) => setPf((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-1"><button onClick={submitProposal} className="btn btn-primary text-xs py-1 flex-1">Submit for approval</button><button onClick={() => setProposing(null)} className="btn btn-secondary text-xs py-1">Cancel</button></div>
          </div>
        )}
        {addingRule && (
          <div className="mb-3 p-2 bg-gray-50 rounded-lg grid grid-cols-2 gap-1.5">
            <input className="input text-xs col-span-2" placeholder="Label (e.g. SAG-AFTRA Pension)" value={rf.label} onChange={(e) => setRf((f: any) => ({ ...f, label: e.target.value }))} />
            <select className="input text-xs" value={rf.rateType} onChange={(e) => setRf((f: any) => ({ ...f, rateType: e.target.value }))}>{RATE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <select className="input text-xs" value={rf.calcMethod} onChange={(e) => setRf((f: any) => ({ ...f, calcMethod: e.target.value }))}>{CALC_METHODS.map((t) => <option key={t}>{t}</option>)}</select>
            <input className="input text-xs" placeholder="Value (0.205 or 38.5)" value={rf.value} onChange={(e) => setRf((f: any) => ({ ...f, value: e.target.value }))} />
            <select className="input text-xs" value={rf.base} onChange={(e) => setRf((f: any) => ({ ...f, base: e.target.value }))}>{BASES.map((t) => <option key={t} value={t}>{t || 'base —'}</option>)}</select>
            <select className="input text-xs" value={rf.capPeriod} onChange={(e) => setRf((f: any) => ({ ...f, capPeriod: e.target.value }))}>{CAP_PERIODS.map((t) => <option key={t} value={t}>{t || 'cap period —'}</option>)}</select>
            <input className="input text-xs" placeholder="Cap amount" value={rf.capAmount} onChange={(e) => setRf((f: any) => ({ ...f, capAmount: e.target.value }))} />
            <input className="input text-xs" placeholder="Currency" value={rf.currency} onChange={(e) => setRf((f: any) => ({ ...f, currency: e.target.value.toUpperCase() }))} />
            <input className="input text-xs" placeholder="GL account code" value={rf.glAccountCode} onChange={(e) => setRf((f: any) => ({ ...f, glAccountCode: e.target.value }))} />
            <select className="input text-xs" value={rf.classificationId} onChange={(e) => setRf((f: any) => ({ ...f, classificationId: e.target.value }))}>
              <option value="">— All classifications —</option>{(agr.classifications || []).map((c: any) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
            <select className="input text-xs" value={rf.sourceId} onChange={(e) => setRf((f: any) => ({ ...f, sourceId: e.target.value }))}>
              <option value="">— Source —</option>{sources.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <input type="date" className="input text-xs" value={rf.effectiveDate} onChange={(e) => setRf((f: any) => ({ ...f, effectiveDate: e.target.value }))} title="Effective" />
            <input type="date" className="input text-xs" value={rf.expirationDate} onChange={(e) => setRf((f: any) => ({ ...f, expirationDate: e.target.value }))} title="Expiration" />
            <label className="text-xs flex items-center gap-1 col-span-2"><input type="checkbox" checked={rf.isEstimate} onChange={(e) => setRf((f: any) => ({ ...f, isEstimate: e.target.checked }))} /> Flag as estimate</label>
            <input className="input text-xs col-span-2" placeholder="Notes" value={rf.notes} onChange={(e) => setRf((f: any) => ({ ...f, notes: e.target.value }))} />
            <div className="col-span-2 flex gap-1"><button onClick={addRule} className="btn btn-primary text-xs py-1 flex-1">Add Rule</button><button onClick={() => setAddingRule(false)} className="btn btn-secondary text-xs py-1">Cancel</button></div>
          </div>
        )}
        <table className="w-full text-xs">
          <tbody>
            {(agr.rateRules || []).map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50">
                <td className="py-1.5">
                  <span className="text-gray-800">{r.label}</span>
                  {r.isEstimate && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 rounded px-1">est</span>}
                  <span className="block text-[10px] text-gray-400">{r.classification?.code || 'all'} · {r.rateType}</span>
                </td>
                <td className="py-1.5 text-gray-600">
                  {r.calcMethod.startsWith('PERCENT') ? pct(r.value) : `${r.currency} ${Number(r.value)}`}
                  {r.capAmount ? <span className="text-gray-400"> cap {Number(r.capAmount).toLocaleString()}</span> : ''}
                </td>
                <td className="py-1.5 text-gray-400">{new Date(r.effectiveDate).toLocaleDateString()}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <button onClick={() => { setProposing(r); setPf({ value: String(Number(r.value)), effectiveDate: new Date().toISOString().slice(0, 10), notes: '', sourceId: r.sourceId || '' }); }} title="Propose change (approval-gated)" className="text-gray-400 hover:text-brand-600 mr-2"><Edit2 size={12} /></button>
                  <button onClick={async () => { if (confirm('Delete this rate rule? Prefer proposing a change to preserve history.')) { await laborApi.removeRule(r.id); reload(); } }} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {!agr.rateRules?.length && <tr><td className="py-2 text-gray-400">No rate rules yet.</td></tr>}
          </tbody>
        </table>
        <p className="text-[10px] text-gray-400 mt-2 flex items-start gap-1"><AlertTriangle size={11} className="mt-0.5" /> Editing a rule's value should be done by adding a new version (effective-dated). Deleting removes history — prefer superseding.</p>
      </div>
    </div>
  );
}

// ── Incentives manager ─────────────────────────────────────────────────────────────
const INCENTIVE_TYPES = ['TAX_CREDIT', 'REBATE', 'CASH_REBATE', 'GRANT', 'EXEMPTION'];
const INCENTIVE_BASES = ['QUALIFIED', 'TOTAL', 'BTL', 'LABOR', 'WAGES'];

function IncentivesManager({ geo }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<any>({ name: '', authority: '', geoNodeId: '', incentiveType: 'TAX_CREDIT', ratePct: '', upliftPct: '', basis: 'QUALIFIED', minSpend: '', capAmount: '', currency: 'USD', sourceTitle: '', sourceUrl: '', effectiveDate: '', notes: '' });
  const load = useCallback(() => { laborApi.incentives().then((r) => setRows(r.data || [])).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!f.name || f.ratePct === '') return;
    await laborApi.createIncentive({
      ...f, geoNodeId: f.geoNodeId || null,
      ratePct: Number(f.ratePct), upliftPct: f.upliftPct === '' ? null : Number(f.upliftPct),
      minSpend: f.minSpend === '' ? null : Number(f.minSpend), capAmount: f.capAmount === '' ? null : Number(f.capAmount),
    });
    setAdding(false); setF({ name: '', authority: '', geoNodeId: '', incentiveType: 'TAX_CREDIT', ratePct: '', upliftPct: '', basis: 'QUALIFIED', minSpend: '', capAmount: '', currency: 'USD', sourceTitle: '', sourceUrl: '', effectiveDate: '', notes: '' });
    load();
  };
  const pct = (n: any) => `${(Number(n) * 100).toFixed(1)}%`;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Incentive Programs</h3>
        <button onClick={() => setAdding(!adding)} className="btn btn-primary text-xs py-1"><Plus size={12} className="mr-1" /> Add program</button>
      </div>
      {adding && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg grid grid-cols-3 gap-1.5">
          <input className="input text-xs col-span-2" placeholder="Name" value={f.name} onChange={(e) => setF((x: any) => ({ ...x, name: e.target.value }))} />
          <select className="input text-xs" value={f.geoNodeId} onChange={(e) => setF((x: any) => ({ ...x, geoNodeId: e.target.value }))}>
            <option value="">— Jurisdiction (any) —</option>{geo.map((g: any) => <option key={g.id} value={g.id}>{g.level}: {g.name}</option>)}
          </select>
          <input className="input text-xs" placeholder="Authority" value={f.authority} onChange={(e) => setF((x: any) => ({ ...x, authority: e.target.value }))} />
          <select className="input text-xs" value={f.incentiveType} onChange={(e) => setF((x: any) => ({ ...x, incentiveType: e.target.value }))}>{INCENTIVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <select className="input text-xs" value={f.basis} onChange={(e) => setF((x: any) => ({ ...x, basis: e.target.value }))}>{INCENTIVE_BASES.map((t) => <option key={t}>{t}</option>)}</select>
          <input className="input text-xs" placeholder="Rate (0.30)" value={f.ratePct} onChange={(e) => setF((x: any) => ({ ...x, ratePct: e.target.value }))} />
          <input className="input text-xs" placeholder="Uplift (0.10)" value={f.upliftPct} onChange={(e) => setF((x: any) => ({ ...x, upliftPct: e.target.value }))} />
          <input className="input text-xs" placeholder="Currency" value={f.currency} onChange={(e) => setF((x: any) => ({ ...x, currency: e.target.value.toUpperCase() }))} />
          <input className="input text-xs" placeholder="Min spend" value={f.minSpend} onChange={(e) => setF((x: any) => ({ ...x, minSpend: e.target.value }))} />
          <input className="input text-xs" placeholder="Cap amount" value={f.capAmount} onChange={(e) => setF((x: any) => ({ ...x, capAmount: e.target.value }))} />
          <input type="date" className="input text-xs" value={f.effectiveDate} onChange={(e) => setF((x: any) => ({ ...x, effectiveDate: e.target.value }))} />
          <input className="input text-xs col-span-2" placeholder="Source title" value={f.sourceTitle} onChange={(e) => setF((x: any) => ({ ...x, sourceTitle: e.target.value }))} />
          <input className="input text-xs col-span-3" placeholder="Source URL" value={f.sourceUrl} onChange={(e) => setF((x: any) => ({ ...x, sourceUrl: e.target.value }))} />
          <input className="input text-xs col-span-3" placeholder="Notes" value={f.notes} onChange={(e) => setF((x: any) => ({ ...x, notes: e.target.value }))} />
          <div className="col-span-3 flex gap-1"><button onClick={add} className="btn btn-primary text-xs py-1 flex-1">Add</button><button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1">Cancel</button></div>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100">
            <th className="py-2 text-left">Program</th><th className="py-2 text-left">Jurisdiction</th><th className="py-2 text-left">Type</th>
            <th className="py-2 text-right">Rate</th><th className="py-2 text-left">Basis</th><th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-50">
              <td className="py-1.5">{r.name}{r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-brand-600 inline-flex"><ExternalLink size={10} /></a>}{r.isEstimate && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 rounded px-1">est</span>}</td>
              <td className="py-1.5 text-xs text-gray-500">{r.geoNode?.name || 'Any'}</td>
              <td className="py-1.5 text-xs text-gray-500">{r.incentiveType?.replace('_', ' ')}</td>
              <td className="py-1.5 text-right">{pct(r.ratePct)}{r.upliftPct ? ` +${pct(r.upliftPct)}` : ''}</td>
              <td className="py-1.5 text-xs text-gray-500">{r.basis}</td>
              <td className="py-1.5 text-right"><button onClick={async () => { if (confirm('Delete program?')) { await laborApi.removeIncentive(r.id); load(); } }} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
            </tr>
          ))}
          {!rows.length && <tr><td className="py-2 text-gray-400 text-xs">No programs yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Geography manager ──────────────────────────────────────────────────────────────
function GeoManager({ geo, reload }: any) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ level: 'COUNTRY', name: '', code: '', parentId: '' });
  const add = async () => {
    if (!form.name) return;
    await laborApi.createGeo({ ...form, parentId: form.parentId || null });
    setAdding(false); setForm({ level: 'COUNTRY', name: '', code: '', parentId: '' }); reload();
  };
  const byLevel = (lvl: string) => geo.filter((g: any) => g.level === lvl);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Globe size={15} /> Geography</h3>
        <button onClick={() => setAdding(!adding)} className="btn btn-primary text-xs py-1"><Plus size={12} className="mr-1" /> Add</button>
      </div>
      {adding && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg grid grid-cols-5 gap-1.5">
          <select className="input text-xs" value={form.level} onChange={(e) => setForm((f: any) => ({ ...f, level: e.target.value }))}>{GEO_LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <input className="input text-xs" placeholder="Name" value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          <input className="input text-xs" placeholder="Code" value={form.code} onChange={(e) => setForm((f: any) => ({ ...f, code: e.target.value }))} />
          <select className="input text-xs" value={form.parentId} onChange={(e) => setForm((f: any) => ({ ...f, parentId: e.target.value }))}>
            <option value="">— Parent —</option>{geo.map((g: any) => <option key={g.id} value={g.id}>{g.level}: {g.name}</option>)}
          </select>
          <button onClick={add} className="btn btn-primary text-xs py-1">Save</button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {GEO_LEVELS.filter((l) => byLevel(l).length).map((lvl) => (
          <div key={lvl}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{lvl}</p>
            {byLevel(lvl).map((g: any) => (
              <div key={g.id} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-gray-700">{g.name} {g.code && <span className="text-gray-400">({g.code})</span>}</span>
                <button onClick={async () => { if (confirm('Delete node?')) { await laborApi.removeGeo(g.id); reload(); } }} className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
