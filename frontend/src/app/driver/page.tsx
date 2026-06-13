'use client';

import { useEffect, useState } from 'react';
import { Navigation, MapPin, Fuel, Check, Camera, X, ClipboardList, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { driverAppApi, rentalApi, conditionApi, pmApi, uploadFile } from '@/lib/api';

const STATUSES = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'DELIVERED', 'PICKED_UP', 'COMPLETED'];
const NEXT: Record<string, string> = { ASSIGNED: 'EN_ROUTE', EN_ROUTE: 'ARRIVED', ARRIVED: 'DELIVERED', DELIVERED: 'COMPLETED', PICKED_UP: 'COMPLETED' };
const SUB_TYPES = ['FUEL', 'TOLL', 'PARKING', 'FOOD', 'OTHER'];

function navUrl(job: any) {
  const b = job.booking || {};
  return job.destinationUrl || b.deliveryLocationUrl || b.client?.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.deliveryAddress || b.client?.companyName || '')}`;
}
const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function DriverHome() {
  const [driver, setDriver] = useState<any>(null);
  const [notDriver, setNotDriver] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fuelFor, setFuelFor] = useState<any>(null);
  const [inspectFor, setInspectFor] = useState<any>(null);
  const [incidentFor, setIncidentFor] = useState<any>(null);

  const load = () => {
    driverAppApi.me().then(r => { setDriver(r.data.driver); setNotDriver(!r.data.isDriver); });
    driverAppApi.jobs().then(r => setJobs(r.data || [])).finally(() => setLoading(false));
    driverAppApi.mySubmissions().then(r => setSubs(r.data || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const advance = async (job: any) => {
    const next = NEXT[job.status]; if (!next) return;
    let gps = '';
    if (next === 'ARRIVED' && navigator.geolocation) {
      try { gps = await new Promise<string>((res) => navigator.geolocation.getCurrentPosition(p => res(`${p.coords.latitude},${p.coords.longitude}`), () => res(''), { timeout: 5000 })); } catch {}
    }
    await rentalApi.drivers.updateJobStatus(job.id, next);
    if (gps) { try { await rentalApi.drivers.updateJob(job.id, { gpsOnArrival: gps }); } catch {} }
    load();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading…</div>;
  if (notDriver) return <div className="card" style={{ padding: 20, textAlign: 'center', color: '#666' }}>Your account isn't linked to a driver profile. Ask an admin to link you.</div>;

  const active = jobs.filter(j => j.status !== 'COMPLETED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '4px 2px' }}>My jobs ({active.length})</h1>

      {active.length === 0 && <div className="card" style={{ padding: 20, textAlign: 'center', color: '#999' }}>No active jobs right now.</div>}

      {active.map(job => (
        <div key={job.id} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, background: '#eef', color: '#33c', borderRadius: 20, padding: '2px 8px' }}>{job.jobType}</span>
            <span style={{ fontSize: 11, color: '#888' }}>{job.status.replace('_', ' ')}</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{job.booking?.client?.companyName}</div>
          <div style={{ fontSize: 13, color: '#555' }}>{job.asset?.name}{job.asset?.plateNumber ? ` · ${job.asset.plateNumber}` : ''}</div>
          <div style={{ fontSize: 12, color: '#888', margin: '2px 0 6px' }}>{fmt(job.scheduledAt)}</div>
          {(job.booking?.deliveryAddress || job.dropoffLocation) && (
            <div style={{ fontSize: 12.5, color: '#444', display: 'flex', gap: 6 }}><MapPin size={14} style={{ flexShrink: 0, marginTop: 1 }} />{job.dropoffLocation || job.booking?.deliveryAddress}</div>
          )}

          {/* Location schedule (multi-site) */}
          {(job.booking?.locations || []).length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid #eee', paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Route</div>
              {job.booking.locations.map((l: any, i: number) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '2px 0' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 9, background: '#eef', color: '#33c', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ flex: 1 }}>{l.siteName || l.address}</span>
                  {l.locationUrl && <a href={l.locationUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}><Navigation size={14} /></a>}
                </div>
              ))}
            </div>
          )}

          {/* Couplings — driver confirms what each trailer is hitched to */}
          {(() => {
            const items = job.booking?.items || [];
            const towed = items.filter((i: any) => i.asset && !i.asset.tracksMileage);
            const vehicles = items.filter((i: any) => i.asset?.tracksMileage);
            if (!towed.length) return null;
            return (
              <div style={{ marginTop: 8, borderTop: '1px solid #eee', paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Couplings — confirm what's hitched</div>
                {towed.map((t: any) => {
                  const towName = t.towedById ? (items.find((x: any) => x.id === t.towedById)?.asset?.name || 'hitched') : null;
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '3px 0' }}>
                      <span style={{ flex: 1 }}>🚐 {t.asset?.name}</span>
                      {towName
                        ? <button onClick={async () => { await rentalApi.logistics.unhitch(t.id); load(); }} style={{ fontSize: 11, borderRadius: 20, padding: '2px 8px', border: 'none', background: '#ede9fe', color: '#6d28d9' }}>🔗 {towName} ✕</button>
                        : <select defaultValue="" onChange={async (e) => { const v = e.target.value; if (!v) return; await rentalApi.logistics.confirmHitch(t.id, v === 'EXTERNAL' ? { externalTow: true } : { towVehicleItemId: v }); load(); }}
                            className="input" style={{ fontSize: 12, padding: '3px 6px', width: 'auto' }}>
                            <option value="">hitch to…</option>
                            {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.asset?.name}</option>)}
                            <option value="EXTERNAL">External / 3rd-party</option>
                          </select>}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <a href={navUrl(job)} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', minWidth: 120 }}><Navigation size={15} /> Navigate</a>
            {NEXT[job.status] && <button onClick={() => advance(job)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', minWidth: 120 }}><Check size={15} /> {NEXT[job.status].replace('_', ' ')}</button>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setFuelFor(job)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}><Fuel size={14} /> Fuel</button>
            <button onClick={() => setInspectFor(job)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}><ClipboardCheck size={14} /> Inspect</button>
            <button onClick={() => setIncidentFor(job)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}><AlertTriangle size={14} /> Issue</button>
          </div>
        </div>
      ))}

      {/* My submissions */}
      {subs.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={15} /> My submissions</div>
          {subs.slice(0, 8).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid #f3f3f3' }}>
              <span>{s.type} · AED {Number(s.amount).toLocaleString()}</span>
              <span style={{ color: s.status === 'APPROVED' ? '#16a34a' : s.status === 'REJECTED' ? '#dc2626' : '#d97706' }}>{s.status}</span>
            </div>
          ))}
        </div>
      )}

      {fuelFor && <FuelModal job={fuelFor} onClose={() => setFuelFor(null)} onDone={() => { setFuelFor(null); load(); }} />}
      {inspectFor && <InspectionModal job={inspectFor} onClose={() => setInspectFor(null)} onDone={() => setInspectFor(null)} />}
      {incidentFor && <IncidentModal job={incidentFor} driver={driver} onClose={() => setIncidentFor(null)} onDone={() => setIncidentFor(null)} />}
    </div>
  );
}

const CHECK = ['Body / panels', 'Tyres', 'Lights', 'Interior', 'A/C / electrical', 'Accessories'];
function Sheet({ title, onClose, children }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', borderRadius: '16px 16px 0 0', padding: 16, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><b>{title}</b><button onClick={onClose} style={{ background: 'none', border: 'none' }}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function InspectionModal({ job, onClose, onDone }: any) {
  const [form, setForm] = useState<any>({ type: 'DELIVERY', odometer: '', fuelLevel: '1/2', notes: '', signatureName: '', photos: [] as string[] });
  const [checklist, setChecklist] = useState(CHECK.map(item => ({ item, ok: true, note: '' })));
  const [busy, setBusy] = useState(false);
  const addPhoto = async (f?: File) => { if (!f) return; try { const r = await uploadFile(f); setForm((s: any) => ({ ...s, photos: [...s.photos, r.url] })); } catch { alert('Upload failed'); } };
  const submit = async () => {
    setBusy(true);
    try {
      await conditionApi.create({ bookingId: job.booking?.id, assetId: job.asset?.id, type: form.type, odometer: form.odometer, fuelLevel: form.fuelLevel, checklist, notes: form.notes, signatureName: form.signatureName, photos: form.photos });
      if (form.odometer && job.asset?.id) { try { await pmApi.readings(job.asset.id, { currentOdometer: form.odometer }); } catch {} }
      onDone();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Inspection" onClose={onClose}>
      <label className="label">Type</label>
      <select className="input w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
        <option value="PRETRIP">Pre-trip check</option><option value="DELIVERY">Delivery</option><option value="RETURN">Return</option>
      </select>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}><label className="label">Odometer</label><input type="number" inputMode="numeric" className="input w-full" value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} /></div>
        <div style={{ flex: 1 }}><label className="label">Fuel</label><select className="input w-full" value={form.fuelLevel} onChange={e => setForm({ ...form, fuelLevel: e.target.value })}>{['Empty', '1/4', '1/2', '3/4', 'Full'].map(f => <option key={f}>{f}</option>)}</select></div>
      </div>
      <label className="label" style={{ marginTop: 8 }}>Checklist</label>
      <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 6 }}>
        {checklist.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <button onClick={() => setChecklist(cl => cl.map((x, j) => j === i ? { ...x, ok: !x.ok } : x))} style={{ fontSize: 11, borderRadius: 20, padding: '2px 8px', border: 'none', width: 56, background: c.ok ? '#dcfce7' : '#fee2e2', color: c.ok ? '#16a34a' : '#dc2626' }}>{c.ok ? 'OK' : 'Issue'}</button>
            <span style={{ fontSize: 13 }}>{c.item}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <label className="label">Photos</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {form.photos.map((p: string, i: number) => <span key={i} style={{ fontSize: 11, color: '#16a34a' }}>✓</span>)}
          <label className="btn btn-secondary" style={{ justifyContent: 'center' }}><Camera size={14} /> Add<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => addPhoto(e.target.files?.[0])} /></label>
        </div>
      </div>
      <div style={{ marginTop: 8 }}><label className="label">Signed by</label><input className="input w-full" value={form.signatureName} onChange={e => setForm({ ...form, signatureName: e.target.value })} placeholder="Client / site name" /></div>
      <div style={{ marginTop: 8 }}><label className="label">Notes</label><input className="input w-full" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      <button onClick={submit} disabled={busy} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>{busy ? 'Saving…' : 'Save inspection'}</button>
    </Sheet>
  );
}

const INCIDENT_TYPES = ['VEHICLE_BREAKDOWN', 'TRAILER_ISSUE', 'GENERATOR_FAILURE', 'ACCIDENT', 'DELAY', 'SITE_ACCESS_ISSUE', 'EQUIPMENT_DAMAGE', 'OTHER'];
function IncidentModal({ job, driver, onClose, onDone }: any) {
  const [form, setForm] = useState<any>({ incidentType: 'VEHICLE_BREAKDOWN', urgency: 'MEDIUM', title: '', description: '', photos: [] as string[], gpsLocation: '' });
  const [busy, setBusy] = useState(false);
  const addPhoto = async (f?: File) => { if (!f) return; try { const r = await uploadFile(f); setForm((s: any) => ({ ...s, photos: [...s.photos, r.url] })); } catch { alert('Upload failed'); } };
  const grabGps = () => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setForm((s: any) => ({ ...s, gpsLocation: `${p.coords.latitude},${p.coords.longitude}` }))); };
  const submit = async () => {
    if (!form.title) { alert('Add a short title'); return; }
    setBusy(true);
    try {
      await rentalApi.incidents.create({ ...form, description: form.description || form.title, assetId: job.asset?.id, bookingId: job.booking?.id, driverId: driver?.id });
      onDone();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Report an issue" onClose={onClose}>
      <label className="label">Type</label>
      <select className="input w-full" value={form.incidentType} onChange={e => setForm({ ...form, incidentType: e.target.value })}>{INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}><label className="label">Urgency</label><select className="input w-full" value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(u => <option key={u}>{u}</option>)}</select></div>
        <button onClick={grabGps} className="btn btn-secondary" style={{ alignSelf: 'flex-end' }}><MapPin size={14} /> {form.gpsLocation ? 'Located' : 'GPS'}</button>
      </div>
      <div style={{ marginTop: 8 }}><label className="label">Title</label><input className="input w-full" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Flat tyre on E11" /></div>
      <div style={{ marginTop: 8 }}><label className="label">Description</label><textarea className="input w-full" style={{ height: 70 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
      <div style={{ marginTop: 8 }}>
        <label className="label">Photos</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {form.photos.map((_: string, i: number) => <span key={i} style={{ fontSize: 11, color: '#16a34a' }}>✓</span>)}
          <label className="btn btn-secondary" style={{ justifyContent: 'center' }}><Camera size={14} /> Add<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => addPhoto(e.target.files?.[0])} /></label>
        </div>
      </div>
      <button onClick={submit} disabled={busy} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>{busy ? 'Reporting…' : 'Report issue'}</button>
    </Sheet>
  );
}

function FuelModal({ job, onClose, onDone }: any) {
  const [form, setForm] = useState<any>({ type: 'FUEL', amount: '', litres: '', odometer: '', notes: '', receiptUrl: '' });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (f: File | undefined) => {
    if (!f) return; setUploading(true);
    try { const r = await uploadFile(f); setForm((s: any) => ({ ...s, receiptUrl: r.url })); } catch { alert('Upload failed'); } finally { setUploading(false); }
  };
  const submit = async () => {
    if (!form.amount) return; setBusy(true);
    try {
      await driverAppApi.createSubmission({ ...form, driverJobId: job.id, bookingId: job.booking?.id, assetId: job.asset?.id });
      onDone();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', borderRadius: '16px 16px 0 0', padding: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b>Log fuel / expense</b><button onClick={onClose} style={{ background: 'none', border: 'none' }}><X size={18} /></button>
        </div>
        <label className="label">Type</label>
        <select className="input w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}><label className="label">Amount (AED)</label><input type="number" inputMode="decimal" className="input w-full" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          {form.type === 'FUEL' && <div style={{ flex: 1 }}><label className="label">Litres</label><input type="number" inputMode="decimal" className="input w-full" value={form.litres} onChange={e => setForm({ ...form, litres: e.target.value })} /></div>}
        </div>
        {form.type === 'FUEL' && <div style={{ marginTop: 8 }}><label className="label">Odometer (km)</label><input type="number" inputMode="numeric" className="input w-full" value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} /></div>}
        <div style={{ marginTop: 8 }}>
          <label className="label">Receipt photo</label>
          {form.receiptUrl
            ? <div style={{ fontSize: 12, color: '#16a34a' }}>✓ Attached</div>
            : <label className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}><Camera size={15} /> {uploading ? 'Uploading…' : 'Take / choose photo'}<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => upload(e.target.files?.[0])} /></label>}
        </div>
        <div style={{ marginTop: 8 }}><label className="label">Notes</label><input className="input w-full" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <button onClick={submit} disabled={busy} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>{busy ? 'Submitting…' : 'Submit for approval'}</button>
      </div>
    </div>
  );
}
