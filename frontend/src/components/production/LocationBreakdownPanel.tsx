'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { productionApi } from '@/lib/api';
import { MapPin, Search, ChevronRight, Film, Users, Printer, FileText, Loader2, Package, Mail, Share2 } from 'lucide-react';
import { SendEmailModal, ShareModal } from './BreakdownsTab';

const catLabel = (c: string) => c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const sdLabel = (d: number) => (d > 0 ? `SD ${d}` : '—');
const mapsUrl = (loc: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;

export default function LocationBreakdownPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [share, setShare] = useState<{ kind: string; refKey?: string; title: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.breakdown.locationBreakdown(projectId)
      .then((r) => { setData(r.data); setExpanded(new Set((r.data?.locations || []).map((l: any) => l.location))); })
      .catch(() => setData(false))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const locations = data?.locations || [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return locations;
    return locations.filter((l: any) => l.location.toLowerCase().includes(q) || (l.sets || []).some((s: string) => s.toLowerCase().includes(q)) || (l.cast || []).some((c: string) => c.toLowerCase().includes(q)));
  }, [locations, search]);

  const allExpanded = filtered.length > 0 && filtered.every((l: any) => expanded.has(l.location));
  const toggle = (k: string) => setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const printAll = () => printLocations('Location Breakdown', filtered);
  const printOne = (loc: any) => printLocations(`Location Call Sheet — ${loc.location}`, [loc]);

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (!data) return <p className="text-xs text-rose-500">Could not load. Generate the script breakdown first (Breakdown → import script).</p>;
  if (locations.length === 0) return (
    <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200">
      <MapPin className="mx-auto text-slate-300" size={36} />
      <p className="text-slate-500 mt-2 text-sm">No locations yet. Run the AI script breakdown — locations are grouped automatically from the scenes.</p>
    </div>
  );

  return (
    <div className="font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2"><MapPin size={18} className="text-[#0f172a]" /> Location Breakdown</h3>
          <p className="text-xs text-slate-500 mt-0.5">{data.locationCount} locations · {data.totalSets} sets · {data.totalScenes} scenes — generated from the script breakdown.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search location, set, cast…" className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-sm w-56 focus:border-[#0f172a] outline-none" />
          </div>
          <button onClick={() => setExpanded(allExpanded ? new Set() : new Set(filtered.map((l: any) => l.location)))} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-[#0f172a]">{allExpanded ? 'Collapse all' : 'Expand all'}</button>
          <button onClick={() => setShare({ kind: 'REPORT', title: 'Location Breakdown' })} className="text-xs inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-[#0f172a]"><Share2 size={13} /> Share</button>
          <button onClick={() => setEmail({ subject: 'Location Breakdown', body: locationsBody(filtered) })} className="text-xs inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-[#0f172a]"><Mail size={13} /> Email</button>
          <button onClick={printAll} className="text-xs inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-1.5"><Printer size={13} /> PDF report</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[['Locations', data.locationCount], ['Sets', data.totalSets], ['Scenes', data.totalScenes]].map(([label, val]: any) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-2xl font-semibold text-slate-900">{val}</div><div className="text-[11px] text-slate-500 mt-0.5">{label}</div></div>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((loc: any) => {
          const isOpen = expanded.has(loc.location);
          return (
            <div key={loc.location} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button onClick={() => toggle(loc.location)} className="flex-1 flex items-center gap-2.5 text-left min-w-0">
                  <ChevronRight size={15} className={`text-slate-300 transition shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="font-semibold text-slate-900 text-[15px] truncate">{loc.location}</span>
                  <a href={mapsUrl(loc.location)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Open in Google Maps" className="text-rose-600 hover:text-rose-700 shrink-0"><MapPin size={15} /></a>
                  {loc.intExt.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">{loc.intExt.join(' / ')}</span>}
                  {loc.sets.length > 0 && <span className="text-[11px] text-slate-400 truncate hidden md:inline">Sets: {loc.sets.join(', ')}</span>}
                </button>
                <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500">
                  <span>{loc.sceneCount} scene{loc.sceneCount === 1 ? '' : 's'}</span>
                  <span className="font-medium text-slate-700">{loc.shootingDays.map(sdLabel).join(', ') || '—'}</span>
                  <button onClick={() => setShare({ kind: 'LOCATION', refKey: loc.location, title: `Location call sheet — ${loc.location}` })} title="Share with project users" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-[#0f172a]"><Share2 size={12} /> Share</button>
                  <button onClick={() => setEmail({ subject: `Location call sheet — ${loc.location}`, body: locationsBody([loc]) })} title="Email this location" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-[#0f172a]"><Mail size={12} /> Email</button>
                  <button onClick={() => printOne(loc)} title="Location call sheet" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:border-[#0f172a]"><FileText size={12} /> Call sheet</button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                  {/* Cast needed */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1"><Users size={12} /> Cast needed ({loc.cast.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {loc.cast.length === 0 ? <span className="text-xs text-slate-400">None specified</span> : loc.cast.map((c: string) => <span key={c} className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full">{c}</span>)}
                    </div>
                  </div>

                  {/* Everything needed here */}
                  {loc.elementsByCategory.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1"><Package size={12} /> Everything needed here</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {loc.elementsByCategory.map((cat: any) => (
                          <div key={cat.category} className="rounded-xl bg-slate-50 p-2.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{catLabel(cat.category)}</div>
                            <div className="flex flex-wrap gap-1">
                              {cat.items.map((it: any, i: number) => <span key={i} className="text-[11px] bg-white ring-1 ring-slate-200 px-1.5 py-0.5 rounded text-slate-700">{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scenes table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px] min-w-[760px]">
                      <thead><tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                        <th className="text-left py-1.5 px-2">SD</th><th className="text-left py-1.5 px-2">Scene</th><th className="text-left py-1.5 px-2">Set</th><th className="text-left py-1.5 px-2">D/N</th><th className="text-left py-1.5 px-2">I/E</th><th className="text-left py-1.5 px-2">Synopsis</th><th className="text-left py-1.5 px-2">Cast</th><th className="text-right py-1.5 px-2">Pages</th><th className="text-right py-1.5 px-2">Est.</th>
                      </tr></thead>
                      <tbody>
                        {loc.scenes.map((s: any, i: number) => (
                          <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                            <td className="py-1.5 px-2 font-medium whitespace-nowrap">{sdLabel(s.shootDay)}</td>
                            <td className="py-1.5 px-2 font-medium">{s.sceneNumber || '—'}</td>
                            <td className="py-1.5 px-2 text-xs">{s.set || '—'}</td>
                            <td className="py-1.5 px-2">{s.dayNight}</td>
                            <td className="py-1.5 px-2">{s.intExt}</td>
                            <td className="py-1.5 px-2 text-xs max-w-md">{s.synopsis || '—'}</td>
                            <td className="py-1.5 px-2 text-xs">{s.cast.join(', ') || '—'}</td>
                            <td className="py-1.5 px-2 text-right text-xs text-slate-500">{s.pages ? s.pages.toFixed(2) : '—'}</td>
                            <td className="py-1.5 px-2 text-right text-xs text-slate-500">{s.estMinutes ? `${s.estMinutes}m` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {email && <SendEmailModal projectId={projectId} subject={email.subject} body={email.body} onClose={() => setEmail(null)} />}
      {share && <ShareModal projectId={projectId} kind={share.kind} refKey={share.refKey} title={share.title} onClose={() => setShare(null)} />}
    </div>
  );
}

// Inline-styled location section(s) — reused by the email body (the project sender wraps it).
function locationsBody(locations: any[]) {
  const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
  const cat = (c: string) => c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  return locations.map((loc) => `
    <section style="margin-bottom:18px;page-break-inside:avoid;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
      <h2 style="font-size:14px;margin:0 0 4px">${esc(loc.location)} <span style="font-weight:400;color:#64748b;font-size:11px">${esc(loc.intExt.join(' / '))} · ${loc.sceneCount} scene(s) · ${loc.shootingDays.map((d: number) => 'SD ' + d).join(', ') || '—'}</span></h2>
      ${loc.sets.length ? `<div style="font-size:11px;color:#334155;margin:2px 0"><b>Sets:</b> ${esc(loc.sets.join(', '))}</div>` : ''}
      <div style="font-size:11px;color:#334155;margin:2px 0"><b>Cast needed:</b> ${esc(loc.cast.join(', ') || 'None specified')}</div>
      ${loc.elementsByCategory.length ? `<div style="font-size:11px;color:#334155;margin:2px 0"><b>Needed on location:</b> ${loc.elementsByCategory.map((c: any) => `${esc(cat(c.category))}: ${esc(c.items.map((i: any) => i.name + (i.quantity > 1 ? ' ×' + i.quantity : '')).join(', '))}`).join(' | ')}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px">
        <thead><tr style="border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b">
          <th style="padding:3px">SD</th><th>Scene</th><th>Set</th><th>D/N</th><th>I/E</th><th>Cast</th><th style="text-align:right">Pages</th></tr></thead>
        <tbody>${loc.scenes.map((s: any) => `<tr style="border-bottom:1px solid #eef2f7"><td style="padding:3px">${s.shootDay || '—'}</td><td>${esc(s.sceneNumber)}</td><td>${esc(s.set)}</td><td>${esc(s.dayNight)}</td><td>${esc(s.intExt)}</td><td>${esc(s.cast.join(', '))}</td><td style="text-align:right">${s.pages ? s.pages.toFixed(2) : ''}</td></tr>`).join('')}</tbody>
      </table>
    </section>`).join('');
}

// Build a clean standalone printable doc (browser → Save as PDF).
function printLocations(title: string, locations: any[]) {
  const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const cat = (c: string) => c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const body = locations.map((loc) => `
    <section class="loc">
      <h2>${esc(loc.location)} <span class="meta">${esc(loc.intExt.join(' / '))} · ${loc.sceneCount} scene(s) · ${loc.shootingDays.map((d: number) => 'SD ' + d).join(', ') || '—'}</span></h2>
      ${loc.sets.length ? `<p class="line"><b>Sets:</b> ${esc(loc.sets.join(', '))}</p>` : ''}
      <p class="line"><b>Cast needed:</b> ${esc(loc.cast.join(', ') || 'None specified')}</p>
      ${loc.elementsByCategory.length ? `<p class="line"><b>Needed on location:</b> ${loc.elementsByCategory.map((c: any) => `${cat(c.category)}: ${esc(c.items.map((i: any) => i.name + (i.quantity > 1 ? ' ×' + i.quantity : '')).join(', '))}`).join(' &nbsp;|&nbsp; ')}</p>` : ''}
      <table><thead><tr><th>SD</th><th>Scene</th><th>Set</th><th>D/N</th><th>I/E</th><th>Synopsis</th><th>Cast</th><th>Pages</th></tr></thead>
      <tbody>${loc.scenes.map((s: any) => `<tr><td>${s.shootDay || '—'}</td><td>${esc(s.sceneNumber)}</td><td>${esc(s.set)}</td><td>${esc(s.dayNight)}</td><td>${esc(s.intExt)}</td><td>${esc(s.synopsis)}</td><td>${esc(s.cast.join(', '))}</td><td>${s.pages ? s.pages.toFixed(2) : ''}</td></tr>`).join('')}</tbody></table>
    </section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body{font-family:Inter,Arial,sans-serif;color:#0f172a;margin:24px;}
      h1{font-size:18px;margin:0 0 4px;} .sub{color:#64748b;font-size:11px;margin-bottom:16px;}
      .loc{page-break-inside:avoid;margin-bottom:22px;border:1px solid #e2e8f0;border-radius:8px;padding:14px;}
      h2{font-size:14px;margin:0 0 6px;} .meta{font-weight:400;color:#64748b;font-size:11px;}
      .line{font-size:11px;margin:2px 0;color:#334155;}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px;}
      th,td{border-bottom:1px solid #eef2f7;text-align:left;padding:3px 5px;vertical-align:top;}
      th{color:#64748b;text-transform:uppercase;font-size:9px;letter-spacing:.04em;}
    </style></head><body>
    <h1>${esc(title)}</h1><div class="sub">${new Date().toLocaleString()}</div>${body}
    <script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
