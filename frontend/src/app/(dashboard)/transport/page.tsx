'use client';

import { useState, useEffect, useCallback } from 'react';
import { transportApi } from '@/lib/api';
import { Car, Bus, Plus, X, Loader2, Trash2, User, Building2, Home, Key, FileCheck2, Coins } from 'lucide-react';

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'VAN', 'MINIBUS', 'BUS', 'LUXURY', 'PICKUP', 'TRUCK', 'PRODUCTION_VEHICLE', 'OTHER'];
const RANK: Record<string, string> = { PREFERRED: 'bg-emerald-100 text-emerald-700', APPROVED: 'bg-blue-100 text-blue-700', RESTRICTED: 'bg-amber-100 text-amber-700', BLACKLISTED: 'bg-rose-100 text-rose-700' };
const VSTATUS: Record<string, string> = { AVAILABLE: 'bg-emerald-100 text-emerald-700', ASSIGNED: 'bg-blue-100 text-blue-700', MAINTENANCE: 'bg-amber-100 text-amber-700', OFF_HIRE: 'bg-slate-100 text-slate-500' };

export default function TransportMaster() {
  const [view, setView] = useState<'vehicles' | 'drivers'>('vehicles');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [addV, setAddV] = useState(false);
  const [addD, setAddD] = useState(false);

  const load = useCallback(() => {
    transportApi.vehicles().then((r) => setVehicles(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.drivers().then((r) => setDrivers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const delV = async (id: string) => { await transportApi.delVehicle(id); load(); };
  const delD = async (id: string) => { await transportApi.delDriver(id); load(); };
  const commitV = async (id: string) => { try { const r = await transportApi.commitVehicle(id); alert(`Committed — PO ${r.data?.poNumber || ''} (AED ${Number(r.data?.amount || 0).toLocaleString()})`); load(); } catch (e: any) { alert(e?.response?.data?.message || 'Could not commit'); } };
  const postV = async (id: string) => { if (!confirm('Post this hire as an actual to the project ledger? (Blocked if the period is locked.)')) return; try { const r = await transportApi.postVehicle(id); alert(`Posted actual — AED ${Number(r.data?.amount || 0).toLocaleString()}`); load(); } catch (e: any) { alert(e?.response?.data?.message || 'Could not post (period may be locked)'); } };

  return (
    <div className="font-sans p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Car className="text-[#0f172a]" /> Transport</h1>
        <button onClick={() => (view === 'vehicles' ? setAddV(true) : setAddD(true))} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"><Plus size={16} /> {view === 'vehicles' ? 'Add vehicle' : 'Add driver'}</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Vehicles &amp; drivers <span className="font-medium">hired for productions</span> — in-house fleet (🏠) or hired from rental companies (🔑). Separate from the Rentals business that rents out in-house vehicles.</p>

      <div className="flex gap-1 mb-4">
        {(['vehicles', 'drivers'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`text-sm px-3 py-1.5 rounded-lg ${view === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{v === 'vehicles' ? `Vehicles (${vehicles.length})` : `Drivers (${drivers.length})`}</button>
        ))}
      </div>

      {view === 'vehicles' ? (
        <div className="grid gap-2">
          {vehicles.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No vehicles yet.</p> : vehicles.map((v) => (
            <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {v.vehicleType === 'BUS' || v.vehicleType === 'MINIBUS' ? <Bus size={18} className="text-slate-400 shrink-0" /> : <Car size={18} className="text-slate-400 shrink-0" />}
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                    {v.source === 'IN_HOUSE' ? <Home size={12} className="text-slate-400" /> : <Key size={12} className="text-amber-500" />}
                    {[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType.replace(/_/g, ' ')}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{v.vehicleType.replace(/_/g, ' ')}</span>
                    {v.plateNumber && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{[v.plateEmirate, v.plateNumber].filter(Boolean).join(' ')}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${VSTATUS[v.status] || 'bg-slate-100'}`}>{v.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{[v.source === 'HIRED' ? v.supplier?.name : (v.asset?.name || 'In-house fleet'), v.capacity ? `${v.capacity} seats` : null, v.dailyRate ? `${v.currency} ${Number(v.dailyRate).toLocaleString()}/day` : null].filter(Boolean).join(' · ') || '—'}{v.supplier?.ranking && <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${RANK[v.supplier.ranking]}`}>{v.supplier.ranking}</span>}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {v.source === 'HIRED' && (
                  v.purchaseOrderId
                    ? <span className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700"><FileCheck2 size={12} /> Committed</span>
                    : <button onClick={() => commitV(v.id)} className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><FileCheck2 size={12} /> Commit PO</button>
                )}
                {v.source === 'HIRED' && (
                  v.postedTxnId
                    ? <span className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700"><Coins size={12} /> Posted</span>
                    : <button onClick={() => postV(v.id)} className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Coins size={12} /> Post actual</button>
                )}
                <button onClick={() => delV(v.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {drivers.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No drivers yet.</p> : drivers.map((d) => (
            <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User size={18} className="text-slate-400" />
                <div>
                  <div className="font-medium text-slate-900 flex items-center gap-2">{d.source === 'IN_HOUSE' ? <Home size={12} className="text-slate-400" /> : <Key size={12} className="text-amber-500" />}{d.fullName}<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{d.source}</span></div>
                  <div className="text-xs text-slate-500 mt-0.5">{[d.mobile, d.licenseNumber, d.supplier?.name, (d.languages || []).join('/')].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              </div>
              <button onClick={() => delD(d.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {addV && <VehicleModal onClose={() => setAddV(false)} onDone={() => { setAddV(false); load(); }} />}
      {addD && <DriverModal onClose={() => setAddD(false)} onDone={() => { setAddD(false); load(); }} />}
    </div>
  );
}

const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/20 outline-none';
function L({ label, full, children }: any) { return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>; }

function VehicleModal({ onClose, onDone }: any) {
  const [f, setF] = useState<any>({ source: 'HIRED', assetId: '', supplierId: '', vehicleType: 'SEDAN', make: '', model: '', plateNumber: '', plateEmirate: '', capacity: '4', dailyRate: '', currency: 'AED', rentalStart: '', rentalEnd: '' });
  const [assets, setAssets] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    transportApi.fleetVehicles().then((r) => setAssets(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.suppliers().then((r) => setSuppliers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const valid = f.source === 'IN_HOUSE' ? !!f.assetId : !!f.supplierId;
  const submit = async () => { if (!valid) return; setBusy(true); try { await transportApi.addVehicle(f); onDone(); } finally { setBusy(false); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Add vehicle</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            {(['HIRED', 'IN_HOUSE'] as const).map((s) => (
              <button key={s} onClick={() => set('source', s)} className={`flex-1 rounded-xl border px-3 py-2 text-sm flex items-center justify-center gap-2 ${f.source === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>{s === 'IN_HOUSE' ? <Home size={14} /> : <Key size={14} />}{s === 'IN_HOUSE' ? 'In-house fleet' : 'Hired (rental co.)'}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {f.source === 'IN_HOUSE' ? (
              <L label="Fleet vehicle *" full><select className={inp} value={f.assetId} onChange={(e) => set('assetId', e.target.value)}><option value="">Select an Asset…</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.plateNumber ? ` · ${a.plateNumber}` : ''}</option>)}</select></L>
            ) : (
              <L label="Rental company *" full><select className={inp} value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}><option value="">Select a Supplier…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.ranking ? ` · ${s.ranking}` : ''}</option>)}</select></L>
            )}
            <L label="Type"><select className={inp} value={f.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></L>
            <L label="Capacity (seats)"><input type="number" className={inp} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></L>
            <L label="Make"><input className={inp} value={f.make} onChange={(e) => set('make', e.target.value)} placeholder="Toyota…" /></L>
            <L label="Model"><input className={inp} value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="Hiace…" /></L>
            <L label="Plate no."><input className={inp} value={f.plateNumber} onChange={(e) => set('plateNumber', e.target.value)} /></L>
            <L label="Emirate"><input className={inp} value={f.plateEmirate} onChange={(e) => set('plateEmirate', e.target.value)} placeholder="AUH / DXB" /></L>
            {f.source === 'HIRED' && <>
              <L label="Daily rate"><input type="number" className={inp} value={f.dailyRate} onChange={(e) => set('dailyRate', e.target.value)} /></L>
              <L label="Currency"><input className={inp} value={f.currency} onChange={(e) => set('currency', e.target.value)} /></L>
              <L label="Hire start"><input type="date" className={inp} value={f.rentalStart} onChange={(e) => set('rentalStart', e.target.value)} /></L>
              <L label="Hire end"><input type="date" className={inp} value={f.rentalEnd} onChange={(e) => set('rentalEnd', e.target.value)} /></L>
            </>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !valid} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}

function DriverModal({ onClose, onDone }: any) {
  const [f, setF] = useState<any>({ source: 'HIRED', driverId: '', supplierId: '', fullName: '', mobile: '', licenseNumber: '', languages: '' });
  const [fleet, setFleet] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    transportApi.fleetDrivers().then((r) => setFleet(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.suppliers().then((r) => setSuppliers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const valid = f.source === 'IN_HOUSE' ? !!f.driverId : (!!f.fullName && (f.source !== 'HIRED' || !!f.supplierId));
  const submit = async () => { if (!valid) return; setBusy(true); try { await transportApi.addDriver({ ...f, languages: f.languages ? f.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : [] }); onDone(); } finally { setBusy(false); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Add driver</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            {(['HIRED', 'IN_HOUSE', 'FREELANCE'] as const).map((s) => (
              <button key={s} onClick={() => set('source', s)} className={`flex-1 rounded-xl border px-2 py-2 text-xs flex items-center justify-center gap-1 ${f.source === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>{s === 'IN_HOUSE' ? <Home size={13} /> : <Key size={13} />}{s === 'IN_HOUSE' ? 'In-house' : s === 'HIRED' ? 'Hired' : 'Freelance'}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {f.source === 'IN_HOUSE' ? (
              <L label="Fleet driver *" full><select className={inp} value={f.driverId} onChange={(e) => set('driverId', e.target.value)}><option value="">Select a Driver…</option>{fleet.map((d) => <option key={d.id} value={d.id}>{d.fullName}{d.mobile ? ` · ${d.mobile}` : ''}</option>)}</select></L>
            ) : (
              <>
                <L label="Full name *" full><input className={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></L>
                {f.source === 'HIRED' && <L label="Company *" full><select className={inp} value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}><option value="">Select a Supplier…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></L>}
                <L label="Mobile"><input className={inp} value={f.mobile} onChange={(e) => set('mobile', e.target.value)} /></L>
                <L label="License no."><input className={inp} value={f.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} /></L>
                <L label="Languages (comma sep)" full><input className={inp} value={f.languages} onChange={(e) => set('languages', e.target.value)} placeholder="English, Arabic" /></L>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={submit} disabled={busy || !valid} className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}
