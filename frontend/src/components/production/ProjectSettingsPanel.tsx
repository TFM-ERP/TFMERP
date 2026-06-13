'use client';

import { useEffect, useState } from 'react';
import { Settings, Upload, X, ImageIcon, RefreshCw, ArrowLeftRight, Clapperboard, Download, Calendar, Users, Wallet, BarChart3, Edit2, Mail } from 'lucide-react';
import { productionApi, uploadFile, assetUrl, fxApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import CoaMappingReviewTable from './CoaMappingReviewTable';
import ProjectGlobalsPanel from './ProjectGlobalsPanel';
import ProjectEmailPanel from './ProjectEmailPanel';

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'CAD', 'SAR'];

export default function ProjectSettingsPanel({ projectId, project, activeVersion, fringes = [], onChanged }:
  { projectId: string; project: any; activeVersion?: any; fringes?: any[]; onChanged?: () => void }) {
  const current = project?.currency || 'AED';
  const [section, setSection] = useState('branding');
  const [logoUrl, setLogoUrl] = useState<string>(project?.logoUrl || '');
  const [busy, setBusy] = useState(false);

  // currency conversion
  const [to, setTo] = useState(current === 'AED' ? 'USD' : 'AED');
  const [rate, setRate] = useState('');
  const [fx, setFx] = useState<Record<string, number>>({});
  useEffect(() => { fxApi.rates().then(r => { const m: Record<string, number> = {}; for (const x of (r.data || [])) m[x.currency] = Number(x.toBase); setFx(m); }).catch(() => {}); }, []);

  // suggest factor: rates[c] = base(AED) per 1 c. factor(cur→to) = rates[cur]/rates[to]
  useEffect(() => {
    const rc = current === 'AED' ? 1 : fx[current];
    const rt = to === 'AED' ? 1 : fx[to];
    if (rc && rt) setRate(String(Math.round((rc / rt) * 1e6) / 1e6));
  }, [to, fx, current]);

  const uploadLogo = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { const up = await uploadFile(file); setLogoUrl(up.url); await productionApi.projects.update(projectId, { logoUrl: up.url }); onChanged?.(); }
    catch { alert('Upload failed.'); }
  };
  const removeLogo = async () => { setLogoUrl(''); await productionApi.projects.update(projectId, { logoUrl: '' }); onChanged?.(); };

  // ── Tile poster (Projects grid branding) — framed exactly as the tile renders it.
  //    Transform = { x, y (% of stage), zoom (1..3), rot (deg) }, stored as posterTransform.
  const [posterUrl, setPosterUrl] = useState<string>(project?.posterUrl || '');
  const [pt, setPt] = useState<{ x: number; y: number; zoom: number; rot: number }>(
    { x: 0, y: 0, zoom: 1, rot: 0, ...((project?.posterTransform as any) || {}) });
  const [posterDirty, setPosterDirty] = useState(false);
  const posterDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!posterUrl) return;
    e.preventDefault();
    const stage = (e.currentTarget as HTMLElement);
    const start = { sx: e.clientX, sy: e.clientY, x: pt.x, y: pt.y };
    const sc = (stage.clientWidth || 330) / 100; // px per 1% of stage width
    const move = (ev: MouseEvent) => {
      setPt((p) => ({ ...p, x: Math.max(-60, Math.min(60, start.x + (ev.clientX - start.sx) / sc)), y: Math.max(-60, Math.min(60, start.y + (ev.clientY - start.sy) / sc)) }));
      setPosterDirty(true);
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const uploadPoster = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { const up = await uploadFile(file); setPosterUrl(up.url); setPt({ x: 0, y: 0, zoom: 1, rot: 0 }); setPosterDirty(true); }
    catch { alert('Upload failed.'); }
  };
  const savePoster = async () => {
    try {
      await productionApi.projects.update(projectId, { posterUrl: posterUrl || null, posterTransform: posterUrl ? pt : null });
      setPosterDirty(false); onChanged?.();
    } catch (e: any) { alert(e?.response?.data?.message || 'Could not save the poster.'); }
  };
  const removePoster = async () => {
    setPosterUrl(''); setPt({ x: 0, y: 0, zoom: 1, rot: 0 }); setPosterDirty(false);
    await productionApi.projects.update(projectId, { posterUrl: '', posterTransform: null }); onChanged?.();
  };

  // Production dates — shootStartDate is THE calendar anchor (Day 1 of Principal
  // Photography). Locking a budget derives shootEndDate from it + the locked shoot_days.
  const [shootStart, setShootStart] = useState<string>(project?.shootStartDate ? String(project.shootStartDate).slice(0, 10) : '');
  const [dateBusy, setDateBusy] = useState(false);
  const saveShootStart = async () => {
    setDateBusy(true);
    try {
      await productionApi.projects.update(projectId, { shootStartDate: shootStart || null });
      alert(shootStart ? `Shoot start anchored: ${shootStart}. Locking a budget will set the end date from its shoot_days.` : 'Shoot start cleared.');
      onChanged?.();
    } catch (e: any) { alert(e.response?.data?.message || 'Could not save the shoot start date.'); }
    finally { setDateBusy(false); }
  };

  // Per-project team & access (V1.2 slice 2): assign users a project role template.
  const [team, setTeam] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newRole, setNewRole] = useState<{ userId: string; templateId: string }>({ userId: '', templateId: '' });
  const [costOpen, setCostOpen] = useState(false);
  const [cost, setCost] = useState<{ treatment: string; coaCode: string; dailyRate: string }>({ treatment: 'COMPANY_OVERHEAD', coaCode: '', dailyRate: '' });
  const accounts: { code: string; title: string }[] = (activeVersion?.sections || []).flatMap((s: any) => (s.accounts || []).map((a: any) => ({ code: a.code, title: a.title })));
  const loadTeam = () => productionApi.projects.team(projectId).then(r => setTeam(r.data || [])).catch(() => {});
  useEffect(() => {
    loadTeam();
    productionApi.projects.permissionTemplates().then(r => setTemplates(r.data || [])).catch(() => {});
    import('@/lib/api').then(m => m.crewApi?.parentUsers?.().then((r: any) => setUsers(r.data || [])).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const assignRole = async () => {
    if (!newRole.userId || !newRole.templateId) return;
    if (cost.treatment === 'PROJECT_HIRE' && !cost.coaCode) return;
    const coaTitle = accounts.find(a => a.code === cost.coaCode)?.title;
    try {
      await productionApi.projects.assignRole(projectId, {
        ...newRole,
        costTreatment: cost.treatment,
        coaCode: cost.treatment === 'PROJECT_HIRE' ? cost.coaCode : undefined,
        coaTitle: cost.treatment === 'PROJECT_HIRE' ? coaTitle : undefined,
        dailyRate: cost.treatment === 'PROJECT_HIRE' && cost.dailyRate ? Number(cost.dailyRate) : undefined,
      });
      setNewRole({ userId: '', templateId: '' });
      setCost({ treatment: 'COMPANY_OVERHEAD', coaCode: '', dailyRate: '' });
      setCostOpen(false);
      loadTeam();
    } catch (e: any) { alert(e.response?.data?.message || 'Could not assign the role.'); }
  };
  const removeRole = async (userId: string) => { await productionApi.projects.removeRole(projectId, userId).catch(() => {}); loadTeam(); };

  // Dedicated production bank account (ADFC audit chain): detail half (payments/IBAN)
  // + reconciliation half (GL bank). Claim compliance shows red until both are linked.
  const [bank, setBank] = useState<any>(null);
  const [bankOpts, setBankOpts] = useState<any[]>([]);
  const [ledgerOpts, setLedgerOpts] = useState<any[]>([]);
  const [bankBusy, setBankBusy] = useState(false);
  const loadBank = () => {
    productionApi.projects.bank(projectId).then(r => setBank(r.data)).catch(() => {});
  };
  useEffect(() => {
    loadBank();
    import('@/lib/api').then(m => {
      m.financeApi?.bankAccounts?.list?.().then((r: any) => setBankOpts(r.data || [])).catch(() => {});
      m.accountingApi?.bankAccounts?.().then((r: any) => setLedgerOpts(r.data || [])).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const linkBank = async (patch: any) => {
    setBankBusy(true);
    try { const r = await productionApi.projects.linkBank(projectId, patch); setBank(r.data); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not update the bank link.'); }
    finally { setBankBusy(false); }
  };

  // Movie Magic import/export — one unified flow. Budget import method:
  //   AI_REVIEW (default)  — AI maps lines to the Master CoA, human reviews, push branches a working copy
  //   NEW_VERSION          — direct import, replaces the active version
  //   UPDATE_ACTIVE        — direct departmental upsert into the active unlocked version
  const [mmb, setMmb] = useState<File | null>(null);
  const [mms, setMms] = useState<File | null>(null);
  const [mmBusy, setMmBusy] = useState(false);
  const [mmStrategy, setMmStrategy] = useState<'AI_REVIEW' | 'NEW_VERSION' | 'UPDATE_ACTIVE'>('AI_REVIEW');
  const [aiReviewFile, setAiReviewFile] = useState<File | null>(null); // mounts the embedded review table
  const importMM = async () => {
    if (!mmb && !mms) { alert('Choose an MMB and/or MMS file first.'); return; }

    if (mmStrategy === 'AI_REVIEW') {
      // Schedule (.sex) has no account codes — always imports directly.
      if (mms) {
        setMmBusy(true);
        try {
          const r = await productionApi.movieMagic.import(projectId, null, mms);
          const d = r.data || {};
          if (d.schedule) alert(`Schedule imported: ${d.schedule.strips} strips · ${d.schedule.elements} elements`);
          setMms(null); onChanged?.();
        } catch (e: any) { alert(e.response?.data?.message || 'Schedule import failed.'); }
        finally { setMmBusy(false); }
      }
      // Budget goes through the AI review table below — nothing written until confirmed.
      if (mmb) setAiReviewFile(mmb);
      return;
    }

    const warn = mmStrategy === 'UPDATE_ACTIVE'
      ? 'Import into the ACTIVE budget? Sections/accounts are matched by code; line items are replaced only inside accounts present in the file.'
      : 'Import from Movie Magic? A budget import replaces the active budget version with a new "Movie Magic Import" working version.';
    if (!confirm(warn)) return;
    setMmBusy(true);
    try {
      const r = await productionApi.movieMagic.import(projectId, mmb, mms, mmStrategy);
      const d = r.data || {};
      const parts: string[] = [];
      if (d.budget) parts.push(`Budget: ${d.budget.sections} sections · ${d.budget.lineItems} lines${d.budget.legacyFringeProfiles?.length ? `\nLegacy fringes captured: ${d.budget.legacyFringeProfiles.join(', ')}` : ''}`);
      if (d.schedule) parts.push(`Schedule: ${d.schedule.strips} strips · ${d.schedule.elements} elements`);
      alert(`Imported from Movie Magic.\n${parts.join('\n')}`);
      setMmb(null); setMms(null); onChanged?.();
    } catch (e: any) { alert(e.response?.data?.message || 'Movie Magic import failed.'); }
    finally { setMmBusy(false); }
  };

  // Optional 6000–9000 distribution / P&A / revenue / corporate ledger
  const [distBusy, setDistBusy] = useState(false);
  const addDistribution = async () => {
    if (!confirm('Add the distribution & corporate ledger (6000–9000) to the active budget?\n6000 Marketing & P&A · 7000 Revenue · 8000 Cost of Goods Sold · 9000 Corporate Overhead.')) return;
    setDistBusy(true);
    try {
      const r = await productionApi.projects.injectDistribution(projectId);
      alert(`Added:\n${(r.data?.sections || []).join('\n')}`);
      onChanged?.();
    } catch (e: any) { alert(e.response?.data?.message || 'Could not add the distribution ledger.'); }
    finally { setDistBusy(false); }
  };
  const download = async (kind: 'mmb' | 'mms') => {
    try {
      const r = kind === 'mmb' ? await productionApi.movieMagic.exportMmb(projectId) : await productionApi.movieMagic.exportMms(projectId);
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = kind === 'mmb' ? 'budget_mmb.xml' : 'schedule.sex'; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) {
      const msg = e?.response?.data instanceof Blob ? 'Export failed — nothing to export yet.' : (e?.response?.data?.message || 'Export failed.');
      alert(msg);
    }
  };

  const convert = async () => {
    const f = Number(rate);
    if (!f || f <= 0) { alert('Enter a valid conversion rate.'); return; }
    if (to === current) { alert('Pick a different target currency.'); return; }
    if (!confirm(`Convert this ENTIRE project from ${current} to ${to} at 1 ${current} = ${f} ${to}?\n\nThis rewrites every amount (budget, costs, per-diems, POs, payroll, locations, incentives). It can't be auto-undone — re-convert back at the inverse rate if needed.`)) return;
    setBusy(true);
    try { const r = await productionApi.projects.convertCurrency(projectId, to, f); alert(`Converted ${r.data.budgetLines} budget lines + ${r.data.transactions} transactions to ${to}.`); onChanged?.(); }
    catch (e: any) { alert(e.response?.data?.message || 'Conversion failed.'); }
    finally { setBusy(false); }
  };

  const SECTIONS: [string, string, any][] = [
    ['branding', 'Identity & branding', ImageIcon],
    ['currency', 'Currency', ArrowLeftRight],
    ['schedule', 'Schedule', Calendar],
    ['globals', 'Globals', Edit2],
    ['team', 'Team & access', Users],
    ['bank', 'Banking', Wallet],
    ['mm', 'Movie Magic', Clapperboard],
    ['email', 'Email sender', Mail],
    ['dist', 'Distribution', BarChart3],
  ];

  return (
    <div className="font-sans">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={18} className="text-slate-900" />
        <div>
          <h3 className="text-base font-semibold text-slate-900">Project settings</h3>
          <p className="text-xs text-slate-500">Branding, currency, schedule anchor, team, banking and Movie Magic — for this project only.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start">
        {/* Section rail */}
        <nav className="md:w-52 w-full shrink-0 flex md:flex-col gap-1 overflow-x-auto pb-1" aria-label="Settings sections">
          {SECTIONS.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setSection(key)}
              className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap text-left transition-colors',
                section === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              <Icon size={16} className="shrink-0" /> {label}
            </button>
          ))}
        </nav>

        {/* Content pane */}
        <div className="flex-1 min-w-0 space-y-4">

          {section === 'branding' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1.5"><ImageIcon size={13} /> Project / studio logo</h4>
              <p className="text-[11px] text-gray-400 mb-3">Appears on this project's PDFs (budget, cost report, call sheets) next to the company (TFM) logo.</p>
              <div className="flex items-center gap-4">
                {logoUrl ? <img src={assetUrl(logoUrl)} alt="" className="h-14 max-w-[180px] object-contain border border-gray-200 rounded-lg p-1 bg-white" /> : <div className="h-14 w-28 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
                <div className="flex gap-2">
                  <label className="btn btn-secondary text-xs cursor-pointer inline-flex"><Upload size={13} className="mr-1" /> {logoUrl ? 'Replace' : 'Upload logo'}<input type="file" accept="image/*" className="hidden" onChange={uploadLogo} /></label>
                  {logoUrl && <button onClick={removeLogo} className="btn btn-secondary text-xs text-red-600"><X size={13} className="mr-1" /> Remove</button>}
                </div>
              </div>
            </div>
          )}

          {section === 'branding' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1.5"><ImageIcon size={13} /> Tile poster</h4>
              <p className="text-[11px] text-gray-400 mb-3">The branding image behind this project's tile on the Projects grid. Drag to position, zoom and rotate — the preview below IS the tile, so what you frame is what the grid shows.</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <div onMouseDown={posterDrag}
                    className="relative rounded-2xl overflow-hidden border border-gray-200 select-none"
                    style={{ width: 330, height: 205, cursor: posterUrl ? 'grab' : 'default', background: '#0b0f17' }}>
                    {/* Natural-proportion image (NOT pre-cropped): zoom out to see the whole
                        poster on the dark letterbox, zoom in to crop — full freedom. */}
                    {posterUrl ? (
                      <img src={assetUrl(posterUrl)} alt="" draggable={false} style={{
                        position: 'absolute', left: '50%', top: '50%', width: `${pt.zoom * 100}%`, height: 'auto', maxWidth: 'none',
                        transform: `translate(-50%, -50%) translate(${pt.x}%, ${pt.y}%) rotate(${pt.rot}deg)`,
                      }} />
                    ) : (
                      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a2b4a,#0e1726 55%,#3d2c12)' }} />
                    )}
                    <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,12,20,.05) 30%,rgba(8,12,20,.85))' }} />
                    <div className="absolute left-4 bottom-3 text-white pointer-events-none">
                      <div style={{ fontSize: 10, letterSpacing: '.14em', color: '#c9a96a', fontWeight: 700, textTransform: 'uppercase' }}>{(project?.projectType || '').replace(/_/g, ' ')}</div>
                      <div className="font-bold" style={{ fontSize: 16, textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>{project?.title}</div>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-gray-400 text-center mt-1">{posterUrl ? '↕↔ drag the image to reposition' : 'No poster yet — upload one to replace the gradient'}</p>
                </div>
                <div className="flex-1 min-w-[230px] space-y-4">
                  <div className="flex gap-2">
                    <label className="btn btn-secondary text-xs cursor-pointer inline-flex"><Upload size={13} className="mr-1" /> {posterUrl ? 'Replace poster' : 'Upload poster…'}<input type="file" accept="image/*" className="hidden" onChange={uploadPoster} /></label>
                    {posterUrl && <button onClick={removePoster} className="btn btn-secondary text-xs text-red-600"><X size={13} className="mr-1" /> Remove</button>}
                  </div>
                  <div>
                    <label className="label text-xs">Zoom — {Math.round(pt.zoom * 100)}% (under 100% = see the whole image)</label>
                    <input type="range" min="0.4" max="3" step="0.05" value={pt.zoom} disabled={!posterUrl}
                      onChange={(e) => { setPt(p => ({ ...p, zoom: Number(e.target.value) })); setPosterDirty(true); }} className="w-full" />
                  </div>
                  <div>
                    <label className="label text-xs">Rotate — {Math.round(pt.rot)}°</label>
                    <div className="flex items-center gap-2">
                      <button disabled={!posterUrl} onClick={() => { setPt(p => ({ ...p, rot: p.rot - 90 })); setPosterDirty(true); }} className="btn btn-secondary text-xs">⟲ −90°</button>
                      <button disabled={!posterUrl} onClick={() => { setPt(p => ({ ...p, rot: p.rot + 90 })); setPosterDirty(true); }} className="btn btn-secondary text-xs">⟳ +90°</button>
                      <input type="range" min="-45" max="45" step="1" disabled={!posterUrl} title="Fine rotation"
                        value={((pt.rot % 90) + 135) % 90 - 45}
                        onChange={(e) => { const base = Math.round(pt.rot / 90) * 90; setPt(p => ({ ...p, rot: base + Number(e.target.value) })); setPosterDirty(true); }} className="flex-1" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={savePoster} disabled={!posterDirty} className="btn btn-primary text-xs disabled:opacity-40">Save poster</button>
                    <button onClick={() => { setPt({ x: 0, y: 0, zoom: 1, rot: 0 }); setPosterDirty(true); }} disabled={!posterUrl} className="btn btn-secondary text-xs">Reset framing</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'currency' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1.5"><ArrowLeftRight size={13} /> Project currency</h4>
              <p className="text-[11px] text-gray-400 mb-3">Current currency: <b className="text-gray-700">{current}</b>. Converting rewrites every number in the project to the new currency.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
                <div><label className="label text-xs">Convert to</label>
                  <select className="input text-sm w-full" value={to} onChange={e => setTo(e.target.value)}>{CURRENCIES.filter(c => c !== current).map(c => <option key={c}>{c}</option>)}</select>
                </div>
                <div><label className="label text-xs">Rate · 1 {current} =</label>
                  <input type="number" step="0.0001" className="input text-sm w-full" value={rate} onChange={e => setRate(e.target.value)} placeholder={`? ${to}`} />
                  <p className="text-[10px] text-gray-400 mt-0.5">{Object.keys(fx).length ? 'Suggested from FX rates — edit if needed.' : 'Enter the rate manually.'}</p>
                </div>
                <div><button onClick={convert} disabled={busy} className="btn btn-primary text-sm w-full"><RefreshCw size={13} className={cn('mr-1', busy && 'animate-spin')} /> {busy ? 'Converting…' : `Convert to ${to}`}</button></div>
              </div>
              <p className="text-[11px] text-amber-600 mt-2">⚠ This bulk-rewrites all stored amounts. There's no auto-undo — to reverse, convert back at the inverse rate.</p>
            </div>
          )}

          {section === 'schedule' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Production dates</h4>
              <p className="text-[11px] text-gray-400 mb-3">
                <b>Shoot start = Day 1</b> of Principal Photography. The production calendar (prep/shoot/wrap), the Day-Out-of-Days
                dates and call sheets all ripple from this anchor. Locking a budget sets the shoot <b>end</b> date automatically from
                that version&apos;s <code>shoot_days</code> global.
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="label text-xs">Shoot start date (Day 1)</label>
                  <input type="date" className="input text-sm w-44" value={shootStart} onChange={e => setShootStart(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Shoot end date</label>
                  <input type="date" className="input text-sm w-44 bg-gray-50" value={project?.shootEndDate ? String(project.shootEndDate).slice(0, 10) : ''} readOnly title="Derived when a budget is LOCKED (anchor + shoot_days − 1)" />
                </div>
                <button onClick={saveShootStart} disabled={dateBusy} className="btn btn-primary text-xs">{dateBusy ? 'Saving…' : 'Save anchor'}</button>
              </div>
            </div>
          )}

          {section === 'globals' && <ProjectGlobalsPanel activeVersion={activeVersion} fringes={fringes} onChanged={onChanged} />}

          {section === 'team' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Project team &amp; access</h4>
              <p className="text-[11px] text-gray-400 mb-3">
                Give system users a role <b>on this project</b> (separate from their company-wide role). The same person can be
                Line Producer here and read-only elsewhere. Sensitive fields (pay, IBAN, PII) hide automatically for restricted roles.
              </p>
              {team.length > 0 && (
                <div className="divide-y divide-gray-100 mb-3">
                  {team.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-gray-800">{a.user?.fullName} <span className="text-[11px] text-gray-400">· {a.user?.email}</span></span>
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">{a.template?.name}</span>
                        <span className={`text-[11px] font-semibold rounded px-2 py-0.5 ${a.costTreatment === 'PROJECT_HIRE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`} title={a.costTreatment === 'PROJECT_HIRE' ? 'Cost charged to the project budget' : 'Company/HR overhead — not paid by this project'}>{a.costTreatment === 'PROJECT_HIRE' ? 'Project hire' : 'Overhead'}</span>
                        <button onClick={() => removeRole(a.userId)} className="text-gray-300 hover:text-red-500" title="Remove from project"><X size={14} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-44">
                  <label className="label text-xs">User</label>
                  <select className="input text-sm w-full" value={newRole.userId} onChange={e => setNewRole(v => ({ ...v, userId: e.target.value }))}>
                    <option value="">— select user —</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{`${u.fullName} · ${String(u.role).replace(/_/g, ' ')}`}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-44">
                  <label className="label text-xs">Project role</label>
                  <select className="input text-sm w-full" value={newRole.templateId} onChange={e => setNewRole(v => ({ ...v, templateId: e.target.value }))}>
                    <option value="">— select role —</option>
                    {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <button onClick={() => setCostOpen(true)} disabled={!newRole.userId || !newRole.templateId} className="btn btn-primary text-xs">Assign</button>
              </div>

              {costOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setCostOpen(false)}>
                  <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                      <h2 className="font-semibold text-slate-900 text-sm">How is this person’s cost handled on this project?</h2>
                      <button onClick={() => setCostOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
                    </div>
                    <div className="p-5 space-y-3">
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input type="radio" name="treat" checked={cost.treatment === 'COMPANY_OVERHEAD'} onChange={() => setCost(v => ({ ...v, treatment: 'COMPANY_OVERHEAD' }))} className="mt-1" />
                        <span><b>Company / HR overhead</b> — access only. Their cost stays with the company; <b>not</b> charged to this project and not payable from it.</span>
                      </label>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input type="radio" name="treat" checked={cost.treatment === 'PROJECT_HIRE'} onChange={() => setCost(v => ({ ...v, treatment: 'PROJECT_HIRE' }))} className="mt-1" />
                        <span><b>Project hire</b> — charge their cost to a budget line; payable as a crew hire on this project.</span>
                      </label>
                      {cost.treatment === 'PROJECT_HIRE' && (
                        <div className="grid grid-cols-2 gap-2 pl-6">
                          <div>
                            <label className="label text-xs">Budget line (Master CoA)</label>
                            <select className="input text-sm w-full" value={cost.coaCode} onChange={e => setCost(v => ({ ...v, coaCode: e.target.value }))}>
                              <option value="">— select account —</option>
                              {accounts.map(a => <option key={a.code} value={a.code}>{`${a.code} · ${a.title}`}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">Daily rate</label>
                            <input type="number" className="input text-sm w-full" value={cost.dailyRate} onChange={e => setCost(v => ({ ...v, dailyRate: e.target.value }))} />
                          </div>
                          {accounts.length === 0 && <p className="text-[11px] text-amber-600 col-span-2">No active budget version — create one first to charge a hire to a line.</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
                      <button onClick={() => setCostOpen(false)} className="btn btn-secondary text-xs">Cancel</button>
                      <button onClick={assignRole} disabled={cost.treatment === 'PROJECT_HIRE' && !cost.coaCode} className="btn btn-primary text-xs">Add to project</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'bank' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Dedicated production bank account</h4>
              <p className="text-[11px] text-gray-400 mb-3">
                Incentive auditors (e.g. ADFC) trace every qualifying dirham <b>bank statement → books → spend schedule</b>.
                Link both halves: the <b>payment account</b> (IBAN/SWIFT used on POs &amp; payment runs) and the <b>reconciliation
                account</b> (GL bank used in Finance ▸ Bank Reconciliation).
              </p>
              {bank?.requiredByPrograms?.length > 0 && (
                <div className={`text-xs rounded-lg px-3 py-2 mb-3 border ${bank.compliant ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  {bank.compliant
                    ? `Dedicated account linked — required by: ${bank.requiredByPrograms.join(', ')}.`
                    : `REQUIRED by ${bank.requiredByPrograms.join(', ')} — the claim cannot advance until a dedicated account is linked.`}
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Payment account (details / IBAN)</label>
                  <select className="input text-sm w-full" disabled={bankBusy} value={bank?.detail?.id || ''}
                    onChange={e => linkBank({ bankAccountId: e.target.value || null })}>
                    <option value="">— not linked —</option>
                    {bankOpts.map((b: any) => <option key={b.id} value={b.id}>{`${b.bankName} — ${b.accountName}${b.iban ? ` (${b.iban.slice(-6)})` : ''}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Reconciliation account (GL bank)</label>
                  <select className="input text-sm w-full" disabled={bankBusy} value={bank?.ledger?.id || ''}
                    onChange={e => linkBank({ ledgerBankAccountId: e.target.value || null })}>
                    <option value="">— not linked —</option>
                    {ledgerOpts.map((b: any) => <option key={b.id} value={b.id}>{`${b.name}${b.bankName ? ` — ${b.bankName}` : ''}`}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {bank?.lastReconciliation
                      ? `Last reconciliation: ${new Date(bank.lastReconciliation.statementDate).toLocaleDateString('en-GB')} · ${bank.lastReconciliation.status}`
                      : 'No reconciliation yet — run it in Finance ▸ Bank Reconciliation.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'mm' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1.5"><Clapperboard size={13} /> Movie Magic sync</h4>
              <p className="text-[11px] text-gray-400 mb-3">Import a Movie Magic <b>export</b> file — in Movie Magic use <i>File ▸ Export</i> to produce XML/CSV (Budgeting) or .sex (Scheduling). Native <code>.mmb</code>/<code>.mms</code> binary files aren't readable; export them first.</p>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">MMB budget export (.xml / .csv)</label>
                  <label className="btn btn-secondary text-xs cursor-pointer w-full justify-center inline-flex"><Upload size={13} className="mr-1" /> <span className="truncate max-w-[160px]">{mmb ? mmb.name : 'Choose file'}</span><input type="file" accept=".xml,.csv" className="hidden" onChange={e => setMmb(e.target.files?.[0] || null)} /></label>
                </div>
                <div>
                  <label className="label text-xs">MMS schedule (.sex)</label>
                  <label className="btn btn-secondary text-xs cursor-pointer w-full justify-center inline-flex"><Upload size={13} className="mr-1" /> <span className="truncate max-w-[160px]">{mms ? mms.name : 'Choose file'}</span><input type="file" accept=".sex,.xml" className="hidden" onChange={e => setMms(e.target.files?.[0] || null)} /></label>
                </div>
              </div>
              <div className="mt-3">
                <label className="label text-xs">Budget import method</label>
                <select className="input text-sm w-full md:w-96" value={mmStrategy} onChange={e => setMmStrategy(e.target.value as any)}>
                  <option value="AI_REVIEW">AI-mapped (recommended) — review every line before anything is written</option>
                  <option value="NEW_VERSION">Direct, new version — replace active budget with a fresh import</option>
                  <option value="UPDATE_ACTIVE">Direct, update active — merge by account code (departmental upsert)</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={importMM} disabled={mmBusy || (!mmb && !mms)} className="btn btn-primary text-xs disabled:opacity-50"><Upload size={13} className="mr-1" /> {mmBusy ? 'Importing…' : mmStrategy === 'AI_REVIEW' ? 'Analyze & review' : 'Import'}</button>
                <button onClick={() => download('mmb')} className="btn btn-secondary text-xs"><Download size={13} className="mr-1" /> Export MMB (.xml)</button>
                <button onClick={() => download('mms')} className="btn btn-secondary text-xs"><Download size={13} className="mr-1" /> Export schedule (.sex)</button>
              </div>
              <p className="text-[11px] text-amber-600 mt-2">
                {mmStrategy === 'AI_REVIEW'
                  ? 'AI-mapped: the AI suggests a Master CoA account + VAT treatment per line (grounded in this project’s filming-country tax rules). Nothing touches the budget until you confirm — pushing branches the active version into a new working copy. Schedules (.sex) import directly.'
                  : mmStrategy === 'UPDATE_ACTIVE'
                    ? 'Update active: only accounts present in the file are touched — your other departments stay as-is. The active budget must be unlocked.'
                    : 'New version: replaces the active version with a new "Movie Magic Import" working version.'}
                {mmStrategy !== 'AI_REVIEW' && ' Legacy fringe values are captured into "MMB Legacy Fringe" profiles so totals match the file to the penny.'}
              </p>

              {/* Embedded AI review (step 2 of the AI-mapped method) */}
              {aiReviewFile && (
                <CoaMappingReviewTable
                  projectId={projectId}
                  initialFile={aiReviewFile}
                  onClose={() => setAiReviewFile(null)}
                  onPushed={() => { setAiReviewFile(null); setMmb(null); onChanged?.(); }}
                />
              )}
            </div>
          )}

          {section === 'email' && <ProjectEmailPanel projectId={projectId} />}

          {section === 'dist' && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1.5"><ArrowLeftRight size={13} /> Distribution &amp; corporate ledger</h4>
              <p className="text-[11px] text-gray-400 mb-3">Adds the optional 6000–9000 sections to the active budget for projects that track sales and distribution: <b>6000</b> Marketing &amp; P&amp;A, <b>7000</b> Revenue, <b>8000</b> Cost of Goods Sold, <b>9000</b> Corporate Overhead. Safe to run once — it refuses if the sections already exist or the budget is locked.</p>
              <button onClick={addDistribution} disabled={distBusy} className="btn btn-primary text-xs disabled:opacity-50">{distBusy ? 'Adding…' : 'Add distribution ledger (6000–9000)'}</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
