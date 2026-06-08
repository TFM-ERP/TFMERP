'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, Trash2, Save, X, Upload, FileText, ExternalLink, Coins, Phone, Building2, Library, Search, History, ClipboardCheck, BarChart3 } from 'lucide-react';
import { productionApi, uploadFile, assetUrl, locationLibraryApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { AssessModal, CompareModal } from './LocationAssessment';

const TYPES = ['INT', 'EXT', 'STUDIO', 'BACKLOT', 'OTHER'];
const STATUSES = ['SCOUTING', 'OPTION', 'CONFIRMED', 'RELEASED'];
const STATUS_CLS: Record<string, string> = { SCOUTING: 'bg-gray-100 text-gray-500', OPTION: 'bg-amber-50 text-amber-700', CONFIRMED: 'bg-green-100 text-green-700', RELEASED: 'bg-blue-50 text-blue-700' };
const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const PERMIT = ['NONE', 'APPLIED', 'APPROVED', 'REJECTED'];
const mapUrl = (l: any) => l.googleMapsUrl || (l.lat && l.lng ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : (l.fullAddress ? `https://www.google.com/maps?q=${encodeURIComponent(l.fullAddress)}` : ''));

export default function LocationsPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [crew, setCrew] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>(null); // location being edited (or {} for new)
  const [picker, setPicker] = useState(false); // library link picker open
  const [assess, setAssess] = useState<any>(null); // location being assessed
  const [compare, setCompare] = useState(false); // compare modal open

  const load = useCallback(() => {
    setLoading(true);
    productionApi.locations.list(projectId).then(r => setRows(r.data || [])).catch(() => setRows([])).finally(() => setLoading(false));
    productionApi.crew.list(projectId).then(r => setCrew(r.data || [])).catch(() => {});
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const crewName = (id?: string) => crew.find((c: any) => c.id === id)?.name || '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <MapPin size={18} className="text-brand-600 mt-0.5" />
          <div><h3 className="text-sm font-semibold text-gray-700">Locations</h3><p className="text-xs text-gray-400">Per-project location binder — address, map pin, contacts, permits, safety & fees.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/locations/pack/${projectId}`} target="_blank" rel="noreferrer" className="btn btn-secondary text-xs"><FileText size={13} className="mr-1" /> Location pack</a>
          <button onClick={() => setCompare(true)} className="btn btn-secondary text-xs"><BarChart3 size={13} className="mr-1" /> Compare</button>
          <button onClick={() => setPicker(true)} className="btn btn-secondary text-xs"><Library size={13} className="mr-1" /> Link from Library</button>
          <button onClick={() => setEdit({ type: 'EXT', status: 'SCOUTING', country: 'United Arab Emirates', currency })} className="btn btn-primary text-xs"><Plus size={13} className="mr-1" /> New location</button>
        </div>
      </div>

      {edit && <LocationForm projectId={projectId} currency={currency} crew={crew} initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {picker && <LibraryPicker projectId={projectId} onClose={() => setPicker(false)} onLinked={() => { setPicker(false); load(); }} />}
      {assess && <AssessModal location={assess} onClose={() => setAssess(null)} />}
      {compare && <CompareModal projectId={projectId} onClose={() => setCompare(false)} />}

      {loading ? <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div> :
        !rows.length ? <div className="card p-10 text-center text-gray-400 text-sm">No locations yet.</div> : (
          <div className="grid md:grid-cols-2 gap-3">
            {rows.map((l: any) => (
              <div key={l.id} className="card hover:border-brand-300 cursor-pointer" onClick={() => setEdit(l)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 text-sm">{l.name}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1">{l.type}</span>
                      {l.masterLocationId
                        ? <span className="text-[10px] bg-[#0f172a]/15 text-[#8a6d2f] rounded px-1 inline-flex items-center gap-0.5" title="Linked to Master Library"><Library size={10} /> Library</span>
                        : <button onClick={(e) => { e.stopPropagation(); locationLibraryApi.promote(l.id).then(load); }} className="text-[10px] text-[#8a6d2f] underline" title="Promote into Master Library">+ Save to Library</button>}
                    </div>
                    <p className="text-xs text-gray-400">{[l.area, l.emirate, l.country === 'United Arab Emirates' ? 'UAE' : l.country].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className={cn('badge text-xs', STATUS_CLS[l.status])}>{l.status}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                  <button onClick={e => { e.stopPropagation(); setAssess(l); }} className="text-[#8a6d2f] inline-flex items-center gap-0.5"><ClipboardCheck size={11} /> Assess</button>
                  {mapUrl(l) && <a href={mapUrl(l)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-brand-600 inline-flex items-center gap-0.5"><MapPin size={11} /> Map</a>}
                  {l.locationManagerId && <span className="inline-flex items-center gap-0.5"><Building2 size={11} /> LM: {crewName(l.locationManagerId) || '—'}</span>}
                  {l.locationFeePerDay ? <span className="inline-flex items-center gap-0.5"><Coins size={11} /> {formatCurrency(Number(l.locationFeePerDay), l.currency || currency)}/day</span> : null}
                  {l.permitRequired && <span className={cn('rounded px-1', l.permitStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>Permit {l.permitStatus || 'NONE'}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function LocationForm({ projectId, currency, crew, initial, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ ...initial });
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState('');
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const fac = f.facilities || {};
  const setFac = (k: string, v: boolean) => set('facilities', { ...fac, [k]: v });

  const save = async () => {
    if (!f.name) { alert('Location name required.'); return; }
    setBusy(true);
    try {
      if (f.id) await productionApi.locations.update(f.id, f);
      else { const r = await productionApi.locations.create(projectId, f); setF((x: any) => ({ ...x, id: r.data.id })); }
      onSaved();
    } catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); } finally { setBusy(false); }
  };
  const del = async () => { if (f.id && confirm('Delete this location?')) { await productionApi.locations.remove(f.id); onSaved(); } };
  const uploadPermit = async (e: any) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; try { const up = await uploadFile(file); set('permitDocUrl', up.url); } catch {} };
  const postFee = async () => {
    if (!f.id) { alert('Save the location first.'); return; }
    const d = Number(days); if (!d) { alert('Enter the number of days.'); return; }
    try { const r = await productionApi.locations.postFee(f.id, d); alert(`Posted location cost ${formatCurrency(r.data.amount, f.currency || currency)}${r.data.coded ? '' : ' (uncoded — tag it in Accounting)'}.`); }
    catch (e: any) { alert(e.response?.data?.message || 'Post failed.'); }
  };

  const L = (label: string, k: string, type = 'text', span?: boolean) => (
    <div className={span ? 'col-span-2' : ''}><label className="label text-xs">{label}</label><input type={type} className="input text-sm h-8 w-full" value={f[k] ?? ''} onChange={e => set(k, e.target.value)} /></div>
  );

  return (
    <div className="card border-brand-200 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><MapPin size={14} className="text-brand-600" /> {f.id ? 'Edit location' : 'New location'}</h4>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn btn-primary text-xs"><Save size={13} className="mr-1" /> {busy ? 'Saving…' : 'Save'}</button>
          {f.id && <button onClick={del} className="btn btn-secondary text-xs text-red-600"><Trash2 size={13} /></button>}
          <button onClick={onClose} className="btn btn-secondary text-xs"><X size={13} /></button>
        </div>
      </div>

      {/* Identity + geo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {L('Name *', 'name', 'text', true)}
        <div><label className="label text-xs">Type</label><select className="input text-sm h-8 w-full" value={f.type} onChange={e => set('type', e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label text-xs">Status</label><select className="input text-sm h-8 w-full" value={f.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label text-xs">Emirate / City</label><input list="emirates" className="input text-sm h-8 w-full" value={f.emirate ?? ''} onChange={e => set('emirate', e.target.value)} /><datalist id="emirates">{EMIRATES.map(e => <option key={e} value={e} />)}</datalist></div>
        {L('Area / District', 'area')}
        {L('Country', 'country')}
        {L('Full address', 'fullAddress', 'text', true)}
        {L('Latitude', 'lat')}
        {L('Longitude', 'lng')}
        {L('Google Maps URL', 'googleMapsUrl', 'text', true)}
        {L('what3words', 'what3words')}
        {mapUrl(f) && <div className="flex items-end"><a href={mapUrl(f)} target="_blank" rel="noreferrer" className="btn btn-secondary text-xs"><MapPin size={12} className="mr-1" /> Open map</a></div>}
      </div>

      {/* People */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Contacts</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="label text-xs">Location Manager</label><select className="input text-sm h-8 w-full" value={f.locationManagerId ?? ''} onChange={e => set('locationManagerId', e.target.value || null)}><option value="">—</option>{crew.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label text-xs">LM Assistant</label><select className="input text-sm h-8 w-full" value={f.locationAssistantId ?? ''} onChange={e => set('locationAssistantId', e.target.value || null)}><option value="">—</option>{crew.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          {L('On-site contact', 'ownerContactName')}
          {L('Contact phone', 'ownerPhone')}
          {L('Contact email', 'ownerEmail')}
        </div>
      </div>

      {/* Logistics + facilities */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Logistics</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {L('Parking notes', 'parkingNotes')}
          {L('Basecamp notes', 'basecampNotes')}
          {L('Access notes', 'accessNotes')}
          {L('Restrictions (noise curfew…)', 'restrictions', 'text', true)}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-600">
          {['power', 'water', 'toilets', 'wifi'].map(k => (
            <label key={k} className="flex items-center gap-1.5 capitalize"><input type="checkbox" checked={!!fac[k]} onChange={e => setFac(k, e.target.checked)} /> {k}</label>
          ))}
        </div>
      </div>

      {/* Safety */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Safety — nearest hospital</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {L('Hospital name', 'nearestHospitalName')}
          {L('Hospital address', 'nearestHospitalAddress')}
          {L('Hospital phone', 'nearestHospitalPhone')}
        </div>
      </div>

      {/* Permit + fee */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Permit & fee</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 h-8"><input type="checkbox" checked={!!f.permitRequired} onChange={e => set('permitRequired', e.target.checked)} /> Permit required</label>
          <div><label className="label text-xs">Permit status</label><select className="input text-sm h-8 w-full" value={f.permitStatus ?? 'NONE'} onChange={e => set('permitStatus', e.target.value)}>{PERMIT.map(p => <option key={p}>{p}</option>)}</select></div>
          {L('Permit number', 'permitNumber')}
          {L('Permit expiry', 'permitExpiry', 'date')}
          <div><label className="label text-xs">Permit doc</label>
            {f.permitDocUrl ? <div className="flex items-center gap-1 text-sm h-8"><a href={assetUrl(f.permitDocUrl)} target="_blank" rel="noreferrer" className="text-brand-600 inline-flex items-center gap-1"><FileText size={13} /> View</a><button onClick={() => set('permitDocUrl', '')} className="text-gray-300 hover:text-red-500"><X size={12} /></button></div>
              : <label className="btn btn-secondary text-xs cursor-pointer inline-flex h-8 items-center"><Upload size={12} className="mr-1" /> Attach<input type="file" className="hidden" onChange={uploadPermit} /></label>}
          </div>
          {L(`Fee / day (${f.currency || currency})`, 'locationFeePerDay', 'number')}
          {L('Currency', 'currency')}
        </div>
        {f.id && Number(f.locationFeePerDay) > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <input type="number" className="input text-sm h-8 w-24" placeholder="days" value={days} onChange={e => setDays(e.target.value)} />
            <button onClick={postFee} className="btn btn-secondary text-xs"><Coins size={12} className="mr-1" /> Post fee to budget</button>
            <span className="text-[11px] text-gray-400">Posts fee/day × days as a coded location cost.</span>
          </div>
        )}
      </div>

      <div><label className="label text-xs">Notes</label><textarea className="input text-sm w-full h-14 resize-none" value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} /></div>
    </div>
  );
}

// ── Master Library picker — link an existing library location into this project ──
function LibraryPicker({ projectId, onClose, onLinked }: { projectId: string; onClose: () => void; onLinked: () => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const search = useCallback(() => {
    setLoading(true);
    locationLibraryApi.list({ search: q || undefined })
      .then(r => setRows((r.data || []).filter((m: any) => m.status !== 'ARCHIVED')))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [q]);
  useEffect(() => { const t = setTimeout(search, 250); return () => clearTimeout(t); }, [search]);

  const link = async (m: any) => {
    setBusyId(m.id);
    try { await locationLibraryApi.linkToProject(m.id, projectId, {}); onLinked(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Library size={16} className="text-[#0f172a]" /> Link from Master Library</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search the library…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div className="overflow-y-auto p-2">
          {loading ? <p className="text-sm text-gray-400 text-center py-8">Searching…</p>
            : !rows.length ? <p className="text-sm text-gray-400 text-center py-8">No library locations match. Add one in the Locations module.</p>
            : rows.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                <div className="h-12 w-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {m.media?.[0] ? <img src={m.media[0].url} alt="" className="w-full h-full object-cover" /> : <MapPin size={16} className="text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-xs text-gray-400 truncate">{[m.city, m.region, m.country].filter(Boolean).join(', ')}</div>
                  <div className="text-[11px] text-gray-400 inline-flex items-center gap-1"><History size={10} /> {m.timesUsed || 0} prior uses</div>
                </div>
                <button onClick={() => link(m)} disabled={busyId === m.id} className="btn btn-primary text-xs shrink-0">{busyId === m.id ? 'Linking…' : 'Link'}</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
