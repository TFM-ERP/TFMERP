'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { productionApi, assetUrl } from '@/lib/api';
import { Image as ImageIcon, Upload, Trash2, Loader2, Printer, BookOpen, Camera, Sunrise, Sunset, Sun, CheckCircle2, XCircle } from 'lucide-react';
import { PanelHeader, StatRow, Chip, Btn, EmptyState, SectionLabel } from './ui';

const todayISO = () => new Date().toISOString().slice(0, 10);

// Sun-path + schedule-gating strip for the selected location (SYS-07 V2 · Slice 7).
function SunGating({ locationId }: { locationId: string }) {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    if (!locationId) return;
    setLoading(true);
    productionApi.sunPath.gating(locationId, date).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [locationId, date]);
  useEffect(() => { load(); }, [load]);
  const sun = data?.sun;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <SectionLabel icon={Sun}>Sun-path & schedule gating</SectionLabel>
        <input type="date" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {loading ? <p className="text-xs text-slate-400"><Loader2 size={13} className="animate-spin inline" /> computing…</p>
        : !sun ? <p className="text-xs text-slate-400">No coordinates on this location — add lat/lng to compute the sun window.</p>
        : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-600"><Sunrise size={14} className="text-amber-500" /> {sun.sunrise}</span>
              <span className="inline-flex items-center gap-1 text-slate-500">Golden AM {sun.goldenHourAm}</span>
              <span className="inline-flex items-center gap-1 text-slate-600"><Sun size={14} className="text-amber-400" /> Noon {sun.solarNoon}</span>
              <span className="inline-flex items-center gap-1 text-slate-500">Golden PM {sun.goldenHourPm}</span>
              <span className="inline-flex items-center gap-1 text-slate-600"><Sunset size={14} className="text-orange-500" /> {sun.sunset}</span>
              <Chip tone="slate">Day {sun.dayLength}</Chip>
            </div>
            {data.gates?.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Chip tone={data.cleared ? 'money' : 'risk'}>{data.cleared ? 'Cleared to shoot' : 'Gated'}</Chip>
                {data.gates.map((g: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    {g.ok ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />} {g.label}{g.detail ? `: ${g.detail}` : ''}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  );
}

const PURPOSES = ['APPROACH', 'WIDE', 'FEATURE', 'SIGHTLINE', 'INFRASTRUCTURE', 'PROBLEM', 'AMBIENT', 'REFERENCE'];
const PURPOSE_TONE: Record<string, string> = { APPROACH: 'slate', WIDE: 'link', FEATURE: 'money', SIGHTLINE: 'link', INFRASTRUCTURE: 'slate', PROBLEM: 'risk', AMBIENT: 'need', REFERENCE: 'cast' };
const TIMES = ['', 'morning', 'midday', 'afternoon', 'goldenHour', 'night'];
const inp = 'rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-slate-900 outline-none';
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export default function LocationReportPanel({ projectId }: { projectId: string }) {
  const [locs, setLocs] = useState<any[]>([]);
  const [locId, setLocId] = useState('');
  const [plates, setPlates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purpose, setPurpose] = useState('WIDE');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    productionApi.locations.list(projectId)
      .then((r) => { const l = Array.isArray(r.data) ? r.data : []; setLocs(l); if (l[0]) setLocId(l[0].id); })
      .finally(() => setLoading(false));
  }, [projectId]);

  const loadPlates = useCallback(() => {
    if (!locId) { setPlates([]); return; }
    productionApi.locationReports.plates({ locationId: locId }).then((r) => setPlates(Array.isArray(r.data) ? r.data : []));
  }, [locId]);
  useEffect(() => { loadPlates(); }, [loadPlates]);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !locId) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('locationId', locId);
        fd.append('projectId', projectId);
        fd.append('purpose', purpose);
        await productionApi.locationReports.uploadPlate(fd);
      }
      loadPlates();
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const updatePlate = async (id: string, data: any) => { await productionApi.locationReports.updatePlate(id, data); loadPlates(); };
  const removePlate = async (id: string) => { await productionApi.locationReports.removePlate(id); loadPlates(); };

  const loc = locs.find((l) => l.id === locId);

  const printReport = async () => {
    if (!locId) return;
    const { data: rep } = await productionApi.locationReports.report(locId);
    const w = window.open('', '_blank'); if (!w) return;
    const section = (title: string, items: any[]) => items.length ? `
      <h2>${esc(title)} <span style="color:#94a3b8;font-weight:400">(${items.length})</span></h2>
      <div class="grid">${items.map((p: any) => `
        <figure><img src="${esc(assetUrl(p.url))}"/><figcaption>${esc(p.caption || '')}${p.sceneRef ? ` · Sc ${esc(p.sceneRef)}` : ''}${p.timeOfDay ? ` · ${esc(p.timeOfDay)}` : ''}</figcaption></figure>`).join('')}</div>` : '';
    const L = rep.location;
    w.document.write(`<html><head><title>Location Report — ${esc(L.name)}</title>
      <style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;padding:28px;font-size:12px}
      h1{font-size:20px;margin:0 0 2px}.sub{color:#64748b;margin:0 0 14px}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:18px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      figure{margin:0}img{width:100%;height:130px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}
      figcaption{font-size:10px;color:#64748b;margin-top:3px}
      .meta{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px}.meta div span{display:block;font-size:10px;color:#94a3b8;text-transform:uppercase}
      .warn{color:#e11d48} ul{margin:4px 0;padding-left:18px}</style></head><body>
      <h1>Location Report</h1><p class="sub">${esc(L.name)}${L.area ? ` · ${esc(L.area)}` : ''}${L.emirate ? `, ${esc(L.emirate)}` : ''}</p>
      <div class="meta">
        <div><span>Scenes</span>${esc(L.scenes || '—')}</div>
        <div><span>Type</span>${esc(L.type || '—')}</div>
        <div><span>Recces</span>${rep.recceCount}</div>
        <div><span>Plates</span>${rep.plateCount}</div>
        <div><span>Fee/day</span>${rep.money.feePerDay ? `${rep.money.currency} ${rep.money.feePerDay}` : '—'}</div>
      </div>
      ${rep.blockers.length ? `<p class="warn"><b>Blockers:</b> ${rep.blockers.map((b: any) => `${esc(b.department)} — ${esc(b.note || '')}`).join('; ')}</p>` : ''}
      ${rep.openActions.length ? `<p><b>Open actions:</b><ul>${rep.openActions.map((a: any) => `<li>${esc(a.department)}: ${esc(a.actionItem)}</li>`).join('')}</ul></p>` : ''}
      <h2>Logistics</h2>
      <p>${L.fullAddress ? `<b>Address:</b> ${esc(L.fullAddress)}<br>` : ''}
      ${rep.logistics.parkingNotes ? `<b>Parking/holding:</b> ${esc(rep.logistics.parkingNotes)}<br>` : ''}
      ${rep.logistics.accessNotes ? `<b>Access:</b> ${esc(rep.logistics.accessNotes)}<br>` : ''}
      ${rep.logistics.hospital?.name ? `<b>Nearest hospital:</b> ${esc(rep.logistics.hospital.name)} ${esc(rep.logistics.hospital.phone || '')}<br>` : ''}</p>
      ${PURPOSES.map((p) => section(p.charAt(0) + p.slice(1).toLowerCase(), rep.platesByPurpose[p] || [])).join('')}
      </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const openLookbook = async () => {
    if (!locId) return;
    const { data } = await productionApi.locationReports.lookbook({ locationId: locId });
    const w = window.open('', '_blank'); if (!w) return;
    const scenes = Object.entries(data.byScene || {});
    w.document.write(`<html><head><title>Lookbook — ${esc(loc?.name || '')}</title>
      <style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;padding:28px}
      h1{font-size:20px;margin:0 0 16px}h2{font-size:14px;margin:18px 0 8px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      img{width:100%;height:110px;object-fit:cover;border-radius:6px}
      figcaption{font-size:10px;color:#64748b}</style></head><body>
      <h1>Lookbook — ${esc(loc?.name || '')}</h1>
      ${scenes.length ? scenes.map(([sc, items]: any) => `<h2>Scene ${esc(sc)}</h2><div class="grid">${items.map((p: any) => `<figure style="margin:0"><img src="${esc(assetUrl(p.url))}"/><figcaption>${esc(p.shotRef || '')} ${esc(p.caption || '')}</figcaption></figure>`).join('')}</div>`).join('') : '<p style="color:#94a3b8">No scene-tagged plates yet. Tag plates with a scene reference to build the lookbook.</p>'}
      </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;
  if (locs.length === 0) return <EmptyState icon={ImageIcon}>Add locations to this project first, then capture photo plates and build the report here.</EmptyState>;

  const byPurpose: Record<string, any[]> = {};
  for (const p of plates) (byPurpose[p.purpose] ||= []).push(p);
  const tagged = plates.filter((p) => p.sceneRef).length;

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Camera}
        title="Photo plates & location report"
        subtitle="Capture purpose-tagged field plates, build the tagged Location Report, and export a scene lookbook for previs/storyboard."
        actions={
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" value={locId} onChange={(e) => setLocId(e.target.value)}>
              {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <Btn variant="secondary" onClick={printReport}><Printer size={13} /> Report</Btn>
            <Btn variant="secondary" onClick={openLookbook}><BookOpen size={13} /> Lookbook</Btn>
          </div>
        }
      />

      <StatRow stats={[['Plates', plates.length], ['Scene-tagged', tagged], ['Purposes used', Object.keys(byPurpose).length]]} />

      {locId && <SunGating locationId={locId} />}

      {/* Upload bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <SectionLabel icon={Upload}>Add plates as</SectionLabel>
        <select className={inp} value={purpose} onChange={(e) => setPurpose(e.target.value)}>{PURPOSES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}</select>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload images</Btn>
      </div>

      {plates.length === 0 ? (
        <EmptyState icon={Camera}>No plates for this location yet. Choose a purpose and upload field photos.</EmptyState>
      ) : (
        <div className="space-y-4">
          {PURPOSES.filter((p) => byPurpose[p]?.length).map((p) => (
            <div key={p}>
              <SectionLabel><Chip tone={PURPOSE_TONE[p] || 'slate'}>{p.charAt(0) + p.slice(1).toLowerCase()}</Chip> <span className="ml-1">{byPurpose[p].length}</span></SectionLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {byPurpose[p].map((pl) => (
                  <div key={pl.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="relative">
                      <img src={assetUrl(pl.url)} alt={pl.caption || ''} className="w-full h-32 object-cover" />
                      <button onClick={() => removePlate(pl.id)} className="absolute top-1 right-1 bg-white/90 rounded-lg p-1 text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                    <div className="p-2 space-y-1.5">
                      <input className={`${inp} w-full`} placeholder="Caption" defaultValue={pl.caption || ''} onBlur={(e) => e.target.value !== (pl.caption || '') && updatePlate(pl.id, { caption: e.target.value })} />
                      <div className="flex gap-1.5">
                        <input className={`${inp} w-1/2`} placeholder="Scene" defaultValue={pl.sceneRef || ''} onBlur={(e) => e.target.value !== (pl.sceneRef || '') && updatePlate(pl.id, { sceneRef: e.target.value })} />
                        <input className={`${inp} w-1/2`} placeholder="Shot" defaultValue={pl.shotRef || ''} onBlur={(e) => e.target.value !== (pl.shotRef || '') && updatePlate(pl.id, { shotRef: e.target.value })} />
                      </div>
                      <div className="flex gap-1.5">
                        <select className={`${inp} w-1/2`} value={pl.purpose} onChange={(e) => updatePlate(pl.id, { purpose: e.target.value })}>{PURPOSES.map((x) => <option key={x} value={x}>{x.charAt(0) + x.slice(1).toLowerCase()}</option>)}</select>
                        <select className={`${inp} w-1/2`} value={pl.timeOfDay || ''} onChange={(e) => updatePlate(pl.id, { timeOfDay: e.target.value })}>{TIMES.map((t) => <option key={t} value={t}>{t || 'time…'}</option>)}</select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
