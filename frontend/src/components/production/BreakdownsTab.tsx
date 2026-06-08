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
import { Loader2, Layers, MapPin, CalendarDays, ListChecks, Printer, Users, Package, Clapperboard, Search, FileText, Mail, X, Share2, Inbox } from 'lucide-react';
import { PanelHeader, StatRow, Tabs, ClusterCard, Chip, DataTable, EmptyState, SectionLabel, Btn, inputCls } from './ui';
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
      <SharedWithYou projectId={projectId} />
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
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [share, setShare] = useState<{ kind: string; title: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.breakdown.categoryBreakdown(projectId)
      .then((r) => { setData(r.data); setExpanded(new Set((r.data?.categories || []).map((c: any) => c.category))); })
      .catch(() => setData(false)).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (!data) return <p className="text-xs text-rose-500">Could not load. Run the AI script breakdown first.</p>;
  const categories: any[] = data.categories || [];
  if (categories.length === 0) return <EmptyState icon={Package}>No elements tagged yet. Import a script on the Scenes tab — elements are pulled automatically.</EmptyState>;

  const q = search.toLowerCase();
  const matchCat = (c: any) => !q || c.category.toLowerCase().includes(q)
    || c.items.some((it: any) => it.name.toLowerCase().includes(q)
      || it.scenes.some((s: string) => s.toLowerCase().includes(q))
      || it.costCenters.some((cc: string) => cc.toLowerCase().includes(q)));
  const filtered = (cat === 'ALL' ? categories : categories.filter((c) => c.category === cat)).filter(matchCat);
  const allOpen = filtered.length > 0 && filtered.every((c) => expanded.has(c.category));
  const toggle = (k: string) => setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const catTabs: [string, string][] = [['ALL', `All (${data.totalElements})`], ...categories.map((c) => [c.category, `${catLabel(c.category)} ${c.itemCount}`] as [string, string])];

  return (
    <div>
      <StatRow stats={[['Categories', data.categoryCount], ['Distinct elements', data.totalElements], ['Total quantity', categories.reduce((n, c) => n + c.totalQty, 0)]]} />
      <BreakdownToolbar search={search} onSearch={setSearch} allOpen={allOpen}
        onToggleAll={() => setExpanded(allOpen ? new Set() : new Set(filtered.map((c) => c.category)))}
        onPrint={() => printElements('Element Breakdown', filtered)}
        onEmail={() => setEmail({ subject: 'Element Breakdown', body: elementsBody(filtered) })}
        onShare={() => setShare({ kind: 'ELEMENTS', title: 'Element Breakdown' })}
        placeholder="Search element, scene, cost center…" />
      <Tabs active={cat} onChange={setCat} tabs={catTabs} />
      <div className="space-y-2">
        {filtered.map((c) => (
          <ClusterCard
            key={c.category}
            open={expanded.has(c.category)}
            onToggle={() => toggle(c.category)}
            title={<span className="inline-flex items-center gap-2">{catLabel(c.category)} <Chip tone={CAT_TONE[c.category] || 'slate'}>{c.itemCount} item{c.itemCount === 1 ? '' : 's'}</Chip></span>}
            meta={<span>qty {c.totalQty}{c.estCost ? ` · est. ${currencyLabel(c.estCost)}` : ''}</span>}
            right={<button onClick={() => printElements(`${catLabel(c.category)} — pull list`, [c])} title="Print this category" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900"><Printer size={12} /> Print</button>}
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
        {filtered.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No elements match “{search}”.</p>}
      </div>
      {email && <SendEmailModal projectId={projectId} subject={email.subject} body={email.body} onClose={() => setEmail(null)} />}
      {share && <ShareModal projectId={projectId} kind={share.kind} title={share.title} onClose={() => setShare(null)} />}
    </div>
  );
}

// ── By Day: per-shoot-day call-sheet rollup ────────────────────────────────────
function DayRollupView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [share, setShare] = useState<{ kind: string; refKey?: string; title: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.breakdown.dayRollup(projectId)
      .then((r) => { setData(r.data); setExpanded(new Set((r.data?.days || []).map((d: any) => d.day))); })
      .catch(() => setData(false)).finally(() => setLoading(false));
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
  const q = search.toLowerCase();
  const matchDay = (d: any) => !q || String(d.day).includes(q) || (d.date || '').includes(q)
    || d.locations.some((l: string) => l.toLowerCase().includes(q))
    || d.sets.some((s: string) => s.toLowerCase().includes(q))
    || d.cast.some((c: string) => c.toLowerCase().includes(q))
    || d.scenes.some((s: any) => String(s.sceneNumber).toLowerCase().includes(q));
  const filtered = days.filter(matchDay);
  const allOpen = filtered.length > 0 && filtered.every((d) => expanded.has(d.day));
  const toggle = (k: number) => setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div>
      <StatRow stats={[
        ['Shoot days', data.dayCount],
        ['Scenes scheduled', days.reduce((n, d) => n + d.sceneCount, 0)],
        ['Unscheduled', data.unscheduledCount],
      ]} />
      <BreakdownToolbar search={search} onSearch={setSearch} allOpen={allOpen}
        onToggleAll={() => setExpanded(allOpen ? new Set() : new Set(filtered.map((d) => d.day)))}
        onPrint={() => printDays('Call-sheet rollup', filtered)}
        onEmail={() => setEmail({ subject: 'Call-sheet rollup', body: daysBody(filtered) })}
        onShare={() => setShare({ kind: 'REPORT', title: 'Call-sheet rollup' })}
        placeholder="Search day, date, location, cast…" />
      <div className="space-y-2">
        {filtered.map((d) => (
          <ClusterCard
            key={d.day}
            open={expanded.has(d.day)}
            onToggle={() => toggle(d.day)}
            title={<span className="inline-flex items-center gap-2"><Clapperboard size={14} className="text-slate-400" /> Day {d.day}{d.date ? <span className="text-slate-400 font-normal text-[13px]">· {fmtDate(d.date)}</span> : null}</span>}
            badges={d.locations.map((l: string) => <Chip key={l} tone="link">{l}</Chip>)}
            meta={<span>{d.sceneCount} scene{d.sceneCount === 1 ? '' : 's'} · {d.pages.toFixed(1)} pg</span>}
            right={<>
              <button onClick={() => setShare({ kind: 'DAY', refKey: String(d.day), title: `Call sheet — Day ${d.day}` })} title="Share this day with project users" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900"><Share2 size={12} /> Share</button>
              <button onClick={() => setEmail({ subject: `Call sheet — Day ${d.day}`, body: daysBody([d]) })} title="Email this day's call sheet" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900"><Mail size={12} /> Email</button>
              <button onClick={() => printDays(`Call sheet — Day ${d.day}`, [d])} title="Print this day's call sheet" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-slate-900"><FileText size={12} /> Call sheet</button>
            </>}
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
                      <div className="text-[11px] text-slate-600">{c.items.map((it: any) => `${it.name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ClusterCard>
        ))}
        {filtered.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No days match “{search}”.</p>}
      </div>

      {data.unscheduledCount > 0 && (
        <p className="text-[11px] text-amber-700 mt-3 inline-flex items-center gap-1">
          <CalendarDays size={12} /> {data.unscheduledCount} scene{data.unscheduledCount === 1 ? '' : 's'} not yet assigned to a shoot day.
        </p>
      )}
      {email && <SendEmailModal projectId={projectId} subject={email.subject} body={email.body} onClose={() => setEmail(null)} />}
      {share && <ShareModal projectId={projectId} kind={share.kind} refKey={share.refKey} title={share.title} onClose={() => setShare(null)} />}
    </div>
  );
}

function currencyLabel(n: number) { return `AED ${Number(n).toLocaleString()}`; }

// Shared toolbar across the cluster-card breakdown views (Elements, By Day) — mirrors
// the Locations panel's search · expand/collapse · print controls so the chrome matches.
function BreakdownToolbar({ search, onSearch, allOpen, onToggleAll, onPrint, onEmail, onShare, placeholder }:
  { search: string; onSearch: (v: string) => void; allOpen: boolean; onToggleAll: () => void; onPrint: () => void; onEmail?: () => void; onShare?: () => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder}
          className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-sm w-60 focus:border-slate-900 outline-none" />
      </div>
      <Btn variant="secondary" onClick={onToggleAll}>{allOpen ? 'Collapse all' : 'Expand all'}</Btn>
      <div className="flex-1" />
      {onShare && <Btn variant="secondary" onClick={onShare}><Share2 size={13} /> Share</Btn>}
      {onEmail && <Btn variant="secondary" onClick={onEmail}><Mail size={13} /> Email</Btn>}
      <Btn variant="primary" onClick={onPrint}><Printer size={13} /> Print report</Btn>
    </div>
  );
}

const escHtml = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
const moneyHtml = (n: any) => `AED ${Number(n).toLocaleString()}`;

// Inner-HTML builders — shared by browser print and email so both render identically.
function elementsBody(categories: any[]) {
  return categories.map((c) => `
    <section style="margin-bottom:18px;page-break-inside:avoid">
      <h2 style="font-size:14px;margin:0 0 4px">${escHtml(catLabel(c.category))} <span style="font-weight:400;color:#64748b">(${c.itemCount} items · qty ${c.totalQty}${c.estCost ? ` · est. ${moneyHtml(c.estCost)}` : ''})</span></h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b">
          <th style="padding:3px">Element</th><th style="text-align:right">Qty</th><th>Scenes</th><th>Shoot days</th><th>Cost center</th><th style="text-align:right">Est. cost</th></tr></thead>
        <tbody>${c.items.map((it: any) => `<tr style="border-bottom:1px solid #eef2f7">
          <td style="padding:3px">${escHtml(it.name)}</td><td style="text-align:right">${it.qty}</td><td>${escHtml(it.scenes.join(', ') || '—')}</td>
          <td>${escHtml(it.days.map((d: number) => (d > 0 ? `SD ${d}` : '—')).join(', ') || '—')}</td><td>${escHtml(it.costCenters.join('; ') || '—')}</td>
          <td style="text-align:right">${it.estCost ? moneyHtml(it.estCost) : '—'}</td></tr>`).join('')}</tbody>
      </table>
    </section>`).join('');
}
function daysBody(days: any[]) {
  return days.map((d) => `
    <section style="margin-bottom:22px;page-break-inside:avoid">
      <h2 style="font-size:15px;margin:0 0 4px">Day ${d.day}${d.date ? ` — ${escHtml(new Date(d.date).toDateString())}` : ''}</h2>
      <div style="font-size:11px;color:#475569;margin-bottom:6px">${d.sceneCount} scenes · ${Number(d.pages).toFixed(1)} pages · Locations: ${escHtml(d.locations.join(', ') || '—')}</div>
      <div style="font-size:11px;margin-bottom:6px"><b>Cast:</b> ${escHtml(d.cast.join(', ') || '—')}</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b">
          <th style="padding:3px">Scene</th><th>Set</th><th>I/E</th><th>D/N</th><th>Cast</th><th style="text-align:right">Pages</th></tr></thead>
        <tbody>${d.scenes.map((s: any) => `<tr style="border-bottom:1px solid #eef2f7">
          <td style="padding:3px">${escHtml(s.sceneNumber || '—')}</td><td>${escHtml(s.set || s.location || '—')}</td><td>${escHtml(s.intExt || '—')}</td>
          <td>${escHtml(s.dayNight || '—')}</td><td>${escHtml((s.cast || []).join(', ') || '—')}</td><td style="text-align:right">${Number(s.pages || 0).toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>
      ${d.elementsByCategory.length ? `<div style="font-size:11px;margin-top:6px">${d.elementsByCategory.map((c: any) => `<div><b>${escHtml(catLabel(c.category))}:</b> ${escHtml(c.items.map((i: any) => i.name + (i.quantity > 1 ? ` ×${i.quantity}` : '')).join(', '))}</div>`).join('')}</div>` : ''}
    </section>`).join('');
}
function openPrint(title: string, body: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>${escHtml(title)}</title></head><body style="font-family:Inter,Arial,sans-serif;color:#0f172a;padding:24px"><h1 style="font-size:18px;margin:0 0 16px">${escHtml(title)}</h1>${body}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
// Email body = a titled report fragment; the project sender wraps it in the branded shell.
function reportEmailHtml(title: string, body: string) { return `<h2 style="font-size:15px;margin:0 0 10px;color:#0f172a">${escHtml(title)}</h2>${body}`; }
function printElements(title: string, categories: any[]) { openPrint(title, elementsBody(categories)); }
function printDays(title: string, days: any[]) { openPrint(title, daysBody(days)); }

// Email-to-team modal — recipients are the project's assigned users (PII stays in-system).
function SendEmailModal({ projectId, subject, body, onClose }:
  { projectId: string; subject: string; body: string; onClose: () => void }) {
  const [team, setTeam] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    productionApi.projects.team(projectId).then((r) => {
      const people = (Array.isArray(r.data) ? r.data : [])
        .map((t: any) => ({ id: t.user?.id, name: t.user?.fullName, email: t.user?.email }))
        .filter((p: any) => p.email);
      setTeam(people);
    }).catch(() => setTeam([]));
  }, [projectId]);

  const toggle = (email: string) => setSel((p) => { const n = new Set(p); n.has(email) ? n.delete(email) : n.add(email); return n; });
  const send = async () => {
    if (sel.size === 0) return;
    setBusy(true);
    try {
      const r = await productionApi.mail.sendBreakdown(projectId, { subject, html: reportEmailHtml(subject, body), recipients: Array.from(sel), message: message || undefined });
      setDone(`Sent to ${r.data?.sent ?? sel.size} recipient(s).`);
    } catch (e: any) {
      setDone(e?.response?.data?.message || 'Send failed — check the project’s email settings (Setup → Email).');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 inline-flex items-center gap-2 text-sm"><Mail size={16} className="text-slate-900" /> Email — {subject}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <SectionLabel icon={Users}>Recipients · project team</SectionLabel>
            {team.length === 0 ? <p className="text-xs text-slate-400">No team members with an email on file. Add them under the project’s Setup → Team.</p> : (
              <div className="space-y-1">
                {team.map((p) => (
                  <label key={p.id || p.email} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={sel.has(p.email)} onChange={() => toggle(p.email)} />
                    <span>{p.name || p.email}</span><span className="text-[11px] text-slate-400">{p.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <SectionLabel>Message (optional)</SectionLabel>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={inputCls} placeholder="A note to include above the report…" />
          </div>
          {done && <p className="text-xs text-emerald-700">{done}</p>}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">{sel.size} selected · sends via the project email sender</span>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Close</Btn>
            <Btn variant="primary" onClick={send} disabled={busy || sel.size === 0}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// In-app share modal — pick project users; they see it in the "Shared with you" strip.
function ShareModal({ projectId, kind, refKey, title, onClose }:
  { projectId: string; kind: string; refKey?: string; title: string; onClose: () => void }) {
  const [team, setTeam] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    productionApi.projects.team(projectId).then((r) => {
      setTeam((Array.isArray(r.data) ? r.data : [])
        .map((t: any) => ({ id: t.user?.id, name: t.user?.fullName, email: t.user?.email }))
        .filter((p: any) => p.id));
    }).catch(() => setTeam([]));
  }, [projectId]);

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const submit = async () => {
    if (sel.size === 0) return;
    setBusy(true);
    try {
      const r = await productionApi.breakdown.shareBreakdown({ projectId, kind, refKey, title, message: message || undefined, toUserIds: Array.from(sel) });
      setDone(`Shared with ${r.data?.shared ?? sel.size} user(s) — they’ll see it on this project’s Breakdowns tab.`);
    } catch (e: any) {
      setDone(e?.response?.data?.message || 'Share failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 inline-flex items-center gap-2 text-sm"><Share2 size={16} className="text-slate-900" /> Share — {title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <SectionLabel icon={Users}>Share with · project team</SectionLabel>
            {team.length === 0 ? <p className="text-xs text-slate-400">No team members on this project yet. Add them under the project’s Setup → Team.</p> : (
              <div className="space-y-1">
                {team.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                    <span>{p.name || p.email}</span>{p.email && <span className="text-[11px] text-slate-400">{p.email}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <SectionLabel>Note (optional)</SectionLabel>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className={inputCls} placeholder="Add a note…" />
          </div>
          {done && <p className="text-xs text-emerald-700">{done}</p>}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">{sel.size} selected · in-app, no email sent</span>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Close</Btn>
            <Btn variant="primary" onClick={submit} disabled={busy || sel.size === 0}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Share</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Strip at the top of the Breakdowns tab showing items shared with the current user on this project.
function SharedWithYou({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { productionApi.breakdown.myShares(projectId).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  if (rows.length === 0) return null;
  const unread = rows.filter((r) => !r.readAt).length;
  const dismiss = async (id: string) => { await productionApi.breakdown.markShareRead(id); load(); };
  return (
    <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
      <SectionLabel icon={Inbox}><span className="inline-flex items-center gap-2">Shared with you {unread > 0 && <Chip tone="link">{unread} new</Chip>}</span></SectionLabel>
      <div className="space-y-1">
        {rows.slice(0, 6).map((s) => (
          <div key={s.id} className={`flex items-center justify-between text-sm rounded-lg px-2 py-1 ${s.readAt ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>
            <span className="truncate"><Share2 size={12} className="inline text-slate-400 mr-1.5" />{s.title}<span className="text-[11px] text-slate-400 ml-1.5">from {s.sharedBy?.fullName || '—'}{s.message ? ` · ${s.message}` : ''}</span></span>
            {!s.readAt && <button onClick={() => dismiss(s.id)} className="text-[11px] text-blue-700 hover:underline shrink-0">Mark read</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
