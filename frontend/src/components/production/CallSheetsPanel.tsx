'use client';

import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Save, Printer, Send, FileText, Clock, MapPin, Phone,
  AlertTriangle, ChevronRight, Users, CalendarCheck, Mail,
} from 'lucide-react';
import { PanelHeader, Btn, Chip, SectionLabel, EmptyState, inputCls } from './ui';

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

type Row = Record<string, string>;

export default function CallSheetsPanel({ projectId }: { projectId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [locations, setLocations] = useState<any[]>([]);

  const loadList = useCallback(() => {
    setLoading(true);
    productionApi.callsheets.list(projectId)
      .then(r => setList(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { productionApi.locations.list(projectId).then(r => setLocations(r.data || [])).catch(() => {}); }, [projectId]);

  const applyLocation = (locId: string) => {
    const l = locations.find((x: any) => x.id === locId);
    if (!l) { setSheet((s: any) => ({ ...s, locationId: '' })); return; }
    const map = l.googleMapsUrl || (l.lat && l.lng ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : (l.fullAddress ? `https://www.google.com/maps?q=${encodeURIComponent(l.fullAddress)}` : ''));
    setSheet((s: any) => ({
      ...s, locationId: l.id,
      locationName: l.name || s.locationName,
      locationAddress: [l.fullAddress, l.area, l.emirate].filter(Boolean).join(', ') || s.locationAddress,
      locationMapUrl: map || s.locationMapUrl,
      parkingNotes: l.parkingNotes || s.parkingNotes,
      basecampNotes: l.basecampNotes || s.basecampNotes,
      hospitalName: l.nearestHospitalName || s.hospitalName,
      hospitalAddress: l.nearestHospitalAddress || s.hospitalAddress,
      hospitalPhone: l.nearestHospitalPhone || s.hospitalPhone,
    }));
  };

  const openSheet = async (id: string) => {
    setSelectedId(id);
    const r = await productionApi.callsheets.get(id);
    setSheet(normalize(r.data));
  };

  function normalize(s: any) {
    return {
      ...s,
      keyContacts: s.keyContacts || [],
      scheduleItems: s.scheduleItems || [],
      castCalls: s.castCalls || [],
      backgroundCalls: s.backgroundCalls || [],
      crewCalls: s.crewCalls || [],
      advanceSchedule: s.advanceSchedule || [],
      hotelShuttles: s.hotelShuttles || [],
      transportPickups: s.transportPickups || [],
      transportFleet: s.transportFleet || [],
      cateringTimes: s.cateringTimes || [],
      walkieChannels: s.walkieChannels || [],
      shootingElements: s.shootingElements || {},
      hospitalAlt: s.hospitalAlt || {},
    };
  }

  const handleCreate = async () => {
    setCreating(true);
    try {
      const r = await productionApi.callsheets.create({ projectId, shootDate: newDate });
      await loadList();
      await openSheet(r.data.id);
    } finally { setCreating(false); }
  };

  const save = async () => {
    if (!sheet) return;
    setSaving(true);
    try {
      await productionApi.callsheets.update(sheet.id, sheet);
      await loadList();
    } finally { setSaving(false); }
  };

  const publish = async () => {
    if (!sheet) return;
    await productionApi.callsheets.update(sheet.id, sheet);
    await productionApi.callsheets.publish(sheet.id);
    await openSheet(sheet.id);
    loadList();
  };

  const emailCrew = async () => {
    if (!sheet) return;
    const r = prompt('Recipient emails (comma-separated). Leave blank to send to all crew with an email on file:', '');
    if (r === null) return;
    try {
      const res = await productionApi.mail.callsheet(sheet.id, { recipients: r || undefined });
      alert(`Call sheet emailed to ${res.data.sent} recipient(s).`);
    } catch (e: any) { alert(e.response?.data?.message || 'Could not send — check Company Management → Email (SMTP) setup.'); }
  };

  const pullSchedule = async () => {
    if (!sheet) return;
    if (!confirm(`Get from schedule for Day ${sheet.dayNumber}? Pulls scenes, cast, crew, advance schedule, and fills the linked location + sun-path + weather + a suggested hospital (empty fields only).`)) return;
    await productionApi.callsheets.update(sheet.id, sheet); // keep current edits
    await productionApi.callsheets.pullSchedule(sheet.id);
    await openSheet(sheet.id);
  };

  const autofillDaylight = async () => {
    if (!sheet) return;
    if (!sheet.locationId) { alert('Link a location to this call sheet first, then autofill daylight.'); return; }
    await productionApi.callsheets.update(sheet.id, sheet); // keep current edits
    try { await productionApi.callsheets.autofillDaylight(sheet.id); await openSheet(sheet.id); }
    catch (e: any) { alert(e?.response?.data?.message || 'Could not compute sun-path (location may have no coordinates).'); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this call sheet?')) return;
    await productionApi.callsheets.remove(id);
    if (selectedId === id) { setSelectedId(null); setSheet(null); }
    loadList();
  };

  const set = (k: string, v: any) => setSheet((s: any) => ({ ...s, [k]: v }));
  const setRow = (key: string, idx: number, field: string, v: string) =>
    setSheet((s: any) => ({ ...s, [key]: s[key].map((r: Row, i: number) => i === idx ? { ...r, [field]: v } : r) }));
  const addRow = (key: string, blank: Row) => setSheet((s: any) => ({ ...s, [key]: [...s[key], blank] }));
  const delRow = (key: string, idx: number) => setSheet((s: any) => ({ ...s, [key]: s[key].filter((_: Row, i: number) => i !== idx) }));
  const setObj = (key: string, field: string, v: any) => setSheet((s: any) => ({ ...s, [key]: { ...(s[key] || {}), [field]: v } }));
  const suggestHospital = async () => {
    const l = locations.find((x: any) => x.id === sheet.locationId);
    const lat = l?.lat, lng = l?.lng;
    if (lat == null || lng == null) { alert('Pick a saved location with coordinates first (needs lat/lng on the location).'); return; }
    try {
      const r = await productionApi.sunPath.hospitalsNear(Number(lat), Number(lng));
      const items = r.data?.items || [];
      if (!items.length) { alert('No hospitals found near the pin.'); return; }
      setSheet((s: any) => ({ ...s, hospitalName: items[0].name, hospitalAddress: items[0].address || '', hospitalPhone: items[0].phone || '', hospitalAlt: items[1] ? { name: items[1].name, address: items[1].address || '', phone: items[1].phone || '' } : (s.hospitalAlt || {}) }));
    } catch { alert('Could not fetch hospital suggestions (backend offline?).'); }
  };

  return (
    <div className="grid grid-cols-[230px_1fr] gap-5">
      {/* List of call sheets */}
      <div>
        <div className="mb-3">
          <SectionLabel>Shoot Days</SectionLabel>
        </div>
        <div className="space-y-1.5 mb-3">
          {loading ? <p className="text-xs text-gray-400 px-2">Loading…</p> :
            list.length === 0 ? <p className="text-xs text-gray-400 px-2">No call sheets yet.</p> :
              list.map(cs => (
                <button key={cs.id} onClick={() => openSheet(cs.id)}
                  className={cn('w-full text-start px-3 py-2 rounded-lg border text-sm flex items-center justify-between group',
                    selectedId === cs.id ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50')}>
                  <div>
                    <div className="font-medium text-gray-800">Day {cs.dayNumber}{cs.totalDays ? ` / ${cs.totalDays}` : ''}</div>
                    <div className="text-[11px] text-gray-400">{fmtDay(cs.shootDate)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Chip tone={cs.status === 'PUBLISHED' ? 'money' : 'slate'}>{cs.status === 'PUBLISHED' ? 'Live' : 'Draft'}</Chip>
                    <ChevronRight size={13} className="text-gray-300" />
                  </div>
                </button>
              ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <label className="text-[10px] text-gray-500 uppercase font-semibold">Shoot date</label>
          <input type="date" className={cn(inputCls, 'mb-2 mt-1')} value={newDate} onChange={e => setNewDate(e.target.value)} />
          <Btn variant="primary" onClick={handleCreate} disabled={creating} className="w-full">
            <Plus size={12} /> {creating ? 'Creating…' : 'New call sheet'}
          </Btn>
          <p className="text-[10px] text-gray-400 mt-2">Auto-fills key contacts &amp; crew calls from the project crew.</p>
        </div>
      </div>

      {/* Editor */}
      <div>
        {!sheet ? (
          <EmptyState icon={FileText}>Select a call sheet or create one for a shoot day.</EmptyState>
        ) : (
          <div className="space-y-4">
            {/* Action bar */}
            <PanelHeader
              icon={FileText}
              title={`Day ${sheet.dayNumber} Call Sheet`}
              actions={<>
                <Chip tone={sheet.status === 'PUBLISHED' ? 'money' : 'slate'}>{sheet.status}</Chip>
                <Btn variant="danger" onClick={() => remove(sheet.id)}><Trash2 size={12} /></Btn>
                <Btn variant="secondary" onClick={pullSchedule} title="Auto-fill scenes, cast, crew, advance, location, sun & weather from the schedule"><CalendarCheck size={12} /> Get from schedule</Btn>
                <Btn variant="secondary" onClick={autofillDaylight} title="Compute sunrise/sunset/golden hour from the linked location"><CalendarCheck size={12} /> Autofill daylight</Btn>
                <Btn variant="secondary" onClick={() => window.open(`/print/callsheet/${sheet.id}`, '_blank')}><Printer size={12} /> Print / PDF</Btn>
                <Btn variant="secondary" onClick={emailCrew}><Mail size={12} /> Email crew</Btn>
                <Btn variant="secondary" onClick={publish}><Send size={12} /> Publish</Btn>
                <Btn variant="primary" onClick={save} disabled={saving}><Save size={12} /> {saving ? 'Saving…' : 'Save'}</Btn>
              </>}
            />

            {/* Header card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionLabel icon={Clock}>Day &amp; Times</SectionLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Day #"><input type="number" className={inputCls} value={sheet.dayNumber ?? ''} onChange={e => set('dayNumber', Number(e.target.value))} /></Field>
                <Field label="Total days"><input type="number" className={inputCls} value={sheet.totalDays ?? ''} onChange={e => set('totalDays', e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Shoot date"><input type="date" className={inputCls} value={sheet.shootDate?.slice(0, 10) || ''} onChange={e => set('shootDate', e.target.value)} /></Field>
                <Field label="General call"><input className={inputCls} value={sheet.generalCall || ''} onChange={e => set('generalCall', e.target.value)} placeholder="06:00" /></Field>
                <Field label="Shooting call"><input className={inputCls} value={sheet.shootingCall || ''} onChange={e => set('shootingCall', e.target.value)} placeholder="07:30" /></Field>
                <Field label="Est. wrap"><input className={inputCls} value={sheet.estWrap || ''} onChange={e => set('estWrap', e.target.value)} placeholder="19:00" /></Field>
                <Field label="Sunrise"><input className={inputCls} value={sheet.sunrise || ''} onChange={e => set('sunrise', e.target.value)} /></Field>
                <Field label="Sunset"><input className={inputCls} value={sheet.sunset || ''} onChange={e => set('sunset', e.target.value)} /></Field>
                <Field label="Golden AM"><input className={inputCls} value={sheet.goldenHourAm || ''} onChange={e => set('goldenHourAm', e.target.value)} placeholder="auto" /></Field>
                <Field label="Golden PM"><input className={inputCls} value={sheet.goldenHourPm || ''} onChange={e => set('goldenHourPm', e.target.value)} placeholder="auto" /></Field>
                <Field label="Weather"><input className={inputCls} value={sheet.weather || ''} onChange={e => set('weather', e.target.value)} placeholder="Sunny, light wind" /></Field>
                <Field label="Temp high"><input className={inputCls} value={sheet.tempHigh || ''} onChange={e => set('tempHigh', e.target.value)} placeholder="38°C" /></Field>
                <Field label="Temp low"><input className={inputCls} value={sheet.tempLow || ''} onChange={e => set('tempLow', e.target.value)} placeholder="27°C" /></Field>
                <Field label="Lunch"><input className={inputCls} value={sheet.lunch || ''} onChange={e => set('lunch', e.target.value)} placeholder="12:30" /></Field>
                <Field label="Unit"><input className={inputCls} value={sheet.unitName || ''} onChange={e => set('unitName', e.target.value)} placeholder="Main Unit" /></Field>
                <Field label="Script version"><input className={inputCls} value={sheet.scriptVersion || ''} onChange={e => set('scriptVersion', e.target.value)} placeholder="Blue a/o…" /></Field>
                <Field label="Schedule version"><input className={inputCls} value={sheet.scheduleVersion || ''} onChange={e => set('scheduleVersion', e.target.value)} placeholder="White a/o…" /></Field>
                <Field label="Director (header)"><input className={inputCls} value={sheet.directorName || ''} onChange={e => set('directorName', e.target.value)} placeholder="Dir. name" /></Field>
                <Field label="Advance tent call"><input className={inputCls} value={sheet.advanceTentCall || ''} onChange={e => set('advanceTentCall', e.target.value)} placeholder="next-day call" /></Field>
              </div>
            </div>

            {/* Location + Hospital */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <SectionLabel icon={MapPin}>Location</SectionLabel>
                <div className="space-y-2">
                  {locations.length > 0 && (
                    <select className={inputCls} value={sheet.locationId || ''} onChange={e => applyLocation(e.target.value)}>
                      <option value="">— Pick a saved location (auto-fills) —</option>
                      {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}{l.emirate ? ` · ${l.emirate}` : ''}</option>)}
                    </select>
                  )}
                  <input className={inputCls} value={sheet.locationName || ''} onChange={e => set('locationName', e.target.value)} placeholder="Location name" />
                  <input className={inputCls} value={sheet.locationAddress || ''} onChange={e => set('locationAddress', e.target.value)} placeholder="Address" />
                  <input className={inputCls} value={sheet.locationMapUrl || ''} onChange={e => set('locationMapUrl', e.target.value)} placeholder="Map link (Google Maps URL)" />
                  <input className={inputCls} value={sheet.parkingNotes || ''} onChange={e => set('parkingNotes', e.target.value)} placeholder="Parking / unit base notes" />
                  <input className={inputCls} value={sheet.basecampNotes || ''} onChange={e => set('basecampNotes', e.target.value)} placeholder="Basecamp / catering notes" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <SectionLabel icon={AlertTriangle}>Nearest Hospital</SectionLabel>
                <div className="space-y-2">
                  <input className={inputCls} value={sheet.hospitalName || ''} onChange={e => set('hospitalName', e.target.value)} placeholder="Hospital name" />
                  <input className={inputCls} value={sheet.hospitalAddress || ''} onChange={e => set('hospitalAddress', e.target.value)} placeholder="Hospital address" />
                  <input className={inputCls} value={sheet.hospitalPhone || ''} onChange={e => set('hospitalPhone', e.target.value)} placeholder="Hospital phone" />
                  <button type="button" onClick={suggestHospital} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 py-1"><MapPin size={11} /> Suggest nearest from pin</button>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold pt-1 block">Alternate hospital</label>
                  <input className={inputCls} value={sheet.hospitalAlt?.name || ''} onChange={e => setObj('hospitalAlt', 'name', e.target.value)} placeholder="Alt hospital name" />
                  <input className={inputCls} value={sheet.hospitalAlt?.address || ''} onChange={e => setObj('hospitalAlt', 'address', e.target.value)} placeholder="Alt hospital address" />
                  <input className={inputCls} value={sheet.hospitalAlt?.phone || ''} onChange={e => setObj('hospitalAlt', 'phone', e.target.value)} placeholder="Alt hospital phone" />
                  <label className="text-[10px] text-gray-500 uppercase font-semibold pt-1 block">Safety notes</label>
                  <textarea className={inputCls} rows={2} value={sheet.safetyNotes || ''} onChange={e => set('safetyNotes', e.target.value)} placeholder="Safety briefing, hazards, COVID, etc." />
                </div>
              </div>
            </div>

            {/* Key contacts */}
            <RowsCard title="Key Contacts" icon={<Phone size={12} />}
              cols={['Role', 'Name', 'Phone']}
              rows={sheet.keyContacts} keys={['role', 'name', 'phone']}
              onAdd={() => addRow('keyContacts', { role: '', name: '', phone: '' })}
              onChange={(i, f, v) => setRow('keyContacts', i, f, v)}
              onDel={(i) => delRow('keyContacts', i)} />

            {/* Schedule */}
            <RowsCard title="Shooting Schedule" icon={<Clock size={12} />}
              cols={['Time', 'Scene', 'I/E', 'Description', 'Pages', 'Cast', 'Location']}
              rows={sheet.scheduleItems} keys={['time', 'scene', 'intExt', 'description', 'pages', 'cast', 'location']}
              onAdd={() => addRow('scheduleItems', { time: '', scene: '', intExt: '', description: '', pages: '', cast: '', location: '' })}
              onChange={(i, f, v) => setRow('scheduleItems', i, f, v)}
              onDel={(i) => delRow('scheduleItems', i)} />

            {/* Cast calls */}
            <RowsCard title="Cast Calls" icon={<FileText size={12} />}
              cols={['Cast', 'Character', 'Call', 'H/M/W', 'On set', 'Remarks']}
              rows={sheet.castCalls} keys={['cast', 'character', 'callTime', 'hmw', 'onSet', 'remarks']}
              onAdd={() => addRow('castCalls', { cast: '', character: '', callTime: '', hmw: '', onSet: '', remarks: '' })}
              onChange={(i, f, v) => setRow('castCalls', i, f, v)}
              onDel={(i) => delRow('castCalls', i)} />

            {/* Background / Extras */}
            <RowsCard title="Background / Extras" icon={<Users size={12} />}
              cols={['Scene', 'Description', 'Count', 'RPT', 'Ready', 'Location']}
              rows={sheet.backgroundCalls} keys={['scene', 'description', 'count', 'rpt', 'ready', 'location']}
              onAdd={() => addRow('backgroundCalls', { scene: '', description: '', count: '', rpt: '', ready: '', location: '' })}
              onChange={(i, f, v) => setRow('backgroundCalls', i, f, v)}
              onDel={(i) => delRow('backgroundCalls', i)} />

            {/* Crew calls */}
            <RowsCard title="Crew Calls" icon={<FileText size={12} />}
              cols={['Department', 'Name', 'Role', 'Call']}
              rows={sheet.crewCalls} keys={['department', 'name', 'role', 'callTime']}
              onAdd={() => addRow('crewCalls', { department: '', name: '', role: '', callTime: '' })}
              onChange={(i, f, v) => setRow('crewCalls', i, f, v)}
              onDel={(i) => delRow('crewCalls', i)} />

            {/* Advance schedule (next day) */}
            <RowsCard title="Advance Schedule (Next Day)" icon={<Clock size={12} />}
              cols={['Time', 'Scene', 'Description', 'Location']}
              rows={sheet.advanceSchedule} keys={['time', 'scene', 'description', 'location']}
              onAdd={() => addRow('advanceSchedule', { time: '', scene: '', description: '', location: '' })}
              onChange={(i, f, v) => setRow('advanceSchedule', i, f, v)}
              onDel={(i) => delRow('advanceSchedule', i)} />

            {/* Hotel shuttles (transport) */}
            <RowsCard title="Hotel Shuttles" icon={<Clock size={12} />}
              cols={['Hotel', 'Leave (lobby → set)']}
              rows={sheet.hotelShuttles} keys={['hotel', 'leave']}
              onAdd={() => addRow('hotelShuttles', { hotel: '', leave: '' })}
              onChange={(i, f, v) => setRow('hotelShuttles', i, f, v)}
              onDel={(i) => delRow('hotelShuttles', i)} />

            {/* Transport pickups */}
            <RowsCard title="Transport — Pick-ups / VIP" icon={<MapPin size={12} />}
              cols={['Label', 'From', 'Leave']}
              rows={sheet.transportPickups} keys={['label', 'from', 'leave']}
              onAdd={() => addRow('transportPickups', { label: '', from: '', leave: '' })}
              onChange={(i, f, v) => setRow('transportPickups', i, f, v)}
              onDel={(i) => delRow('transportPickups', i)} />

            {/* Transport fleet */}
            <RowsCard title="Transport — Fleet on unit" icon={<MapPin size={12} />}
              cols={['Vehicle / unit', 'Qty / note']}
              rows={sheet.transportFleet} keys={['label', 'qty']}
              onAdd={() => addRow('transportFleet', { label: '', qty: '' })}
              onChange={(i, f, v) => setRow('transportFleet', i, f, v)}
              onDel={(i) => delRow('transportFleet', i)} />

            {/* Shooting elements */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionLabel>Shooting Elements (per day)</SectionLabel>
              <div className="grid md:grid-cols-2 gap-2">
                {([['props', 'Props'], ['art', 'Art'], ['ge', 'G&E / Camera'], ['hmu', 'HMU / Costume / Stills'], ['sound', 'Sound / VFX / SFX'], ['animals', 'Animals'], ['vehicles', 'Vehicles (picture)']] as [string, string][]).map(([k, label]) => (
                  <Field key={k} label={label}><input className={inputCls} value={sheet.shootingElements?.[k] || ''} onChange={e => setObj('shootingElements', k, e.target.value)} /></Field>
                ))}
              </div>
            </div>

            {/* Catering ready times */}
            <RowsCard title="Catering — Ready Times & Counts" icon={<Users size={12} />}
              cols={['Meal', 'Pax', 'Ready']}
              rows={sheet.cateringTimes} keys={['meal', 'pax', 'ready']}
              onAdd={() => addRow('cateringTimes', { meal: '', pax: '', ready: '' })}
              onChange={(i, f, v) => setRow('cateringTimes', i, f, v)}
              onDel={(i) => delRow('cateringTimes', i)} />

            {/* Walkie channels */}
            <RowsCard title="Walkie Channels (by department)" icon={<Phone size={12} />}
              cols={['Department', 'Channel']}
              rows={sheet.walkieChannels} keys={['department', 'channel']}
              onAdd={() => addRow('walkieChannels', { department: '', channel: '' })}
              onChange={(i, f, v) => setRow('walkieChannels', i, f, v)}
              onDel={(i) => delRow('walkieChannels', i)} />

            {/* Notes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionLabel>General Notes</SectionLabel>
              <textarea className={inputCls} rows={3} value={sheet.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Notes for cast & crew…" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase font-semibold">{label}</label>
      {children}
    </div>
  );
}

function RowsCard({ title, icon, cols, rows, keys, onAdd, onChange, onDel }: {
  title: string; icon: React.ReactNode; cols: string[]; rows: Row[]; keys: string[];
  onAdd: () => void; onChange: (i: number, f: string, v: string) => void; onDel: (i: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">{icon} {title}</h4>
        <button onClick={onAdd} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><Plus size={11} /> Add row</button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No rows. Click "Add row".</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-400 uppercase tracking-wide">
                {cols.map(c => <th key={c} className="text-start px-1.5 py-1">{c}</th>)}
                <th className="w-7"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {keys.map(k => (
                    <td key={k} className="px-1 py-0.5">
                      <input className="input text-xs h-7 w-full min-w-20" value={r[k] || ''} onChange={e => onChange(i, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="px-1">
                    <button onClick={() => onDel(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
