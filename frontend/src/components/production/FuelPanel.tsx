'use client';

import { useState, useEffect, useCallback } from 'react';
import { transportApi } from '@/lib/api';
import { Droplet, Plus, X, Loader2, Trash2, Coins, Gauge, FileCheck2, CheckCircle2 } from 'lucide-react';
import { PanelHeader, StatRow, Btn, DataTable, EmptyState, SectionLabel, inputCls } from './ui';

const money = (n?: number | null) => (n == null ? '—' : `AED ${Number(n).toLocaleString()}`);

export default function FuelPanel({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [add, setAdd] = useState(false);

  const load = useCallback(() => {
    transportApi.fuelReport(projectId).then((r) => setReport(r.data)).catch(() => setReport(false));
    transportApi.fuel({ projectId }).then((r) => setLogs(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { transportApi.vehicles().then((r) => setVehicles(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);

  const remove = async (id: string) => { await transportApi.delFuel(id); load(); };

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Droplet}
        title="Fuel & car rental"
        subtitle="Fuel logs across hired & in-house vehicles. Hire commitments post to the project ledger from the Transport registry."
        actions={<Btn variant="primary" onClick={() => setAdd(true)}><Plus size={14} /> Log fuel</Btn>}
      />

      {/* Report cards */}
      <StatRow stats={[
        ['Total litres', report?.litres ?? 0],
        ['Fuel cost', money(report?.cost)],
        ['Entries', report?.entries ?? 0],
        ['Vehicles', report?.byVehicle?.length ?? 0],
      ]} />

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card title="Fuel by vehicle">
          {(report?.byVehicle || []).length === 0 ? <Empty /> : (
            <DataTable
              minWidth={0}
              cols={['Vehicle', 'Litres', 'Cost', '/km']}
              align={{ 1: 'right', 2: 'right', 3: 'right' }}
              rows={report.byVehicle.map((v: any) => [v.label, v.litres, money(v.cost), v.costPerKm != null ? `AED ${v.costPerKm}` : '—'])}
            />
          )}
        </Card>
        <Card title="Fuel by driver">
          {(report?.byDriver || []).length === 0 ? <Empty /> : (
            <div className="space-y-1.5">{report.byDriver.map((d: any, i: number) => <div key={i} className="flex items-center justify-between text-sm"><span className="text-slate-700">{d.label}</span><span className="text-[11px] text-slate-500">{d.litres} L · {money(d.cost)}</span></div>)}</div>
          )}
        </Card>
      </div>

      {/* Entries */}
      <SectionLabel>Fuel entries ({logs.length})</SectionLabel>
      <div className="grid gap-1.5">
        {logs.length === 0 ? <EmptyState icon={Droplet}>No fuel logged yet.</EmptyState> : logs.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm text-slate-800">{l.transportVehicle ? ([l.transportVehicle.make, l.transportVehicle.model].filter(Boolean).join(' ') || l.transportVehicle.vehicleType) : (l.asset?.name || '—')}{l.transportVehicle?.plateNumber ? ` · ${l.transportVehicle.plateNumber}` : ''}</div>
              <div className="text-[11px] text-slate-500">{new Date(l.logDate).toLocaleDateString()} · {Number(l.litres)} L @ AED {Number(l.costPerLitre)} {l.odometer ? `· ${l.odometer} km` : ''}{l.transportDriver ? ` · ${l.transportDriver.fullName}` : ''}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0"><span className="text-sm font-medium text-slate-700">{money(Number(l.totalCost))}</span><button onClick={() => remove(l.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button></div>
          </div>
        ))}
      </div>

      {add && <FuelModal projectId={projectId} vehicles={vehicles} onClose={() => setAdd(false)} onDone={() => { setAdd(false); load(); }} />}
    </div>
  );
}

function Card({ title, children }: any) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><SectionLabel>{title}</SectionLabel>{children}</div>; }
function Empty() { return <EmptyState>No data yet.</EmptyState>; }

function FuelModal({ projectId, vehicles, onClose, onDone }: any) {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [f, setF] = useState<any>({ transportVehicleId: '', transportDriverId: '', litres: '', costPerLitre: '', totalCost: '', odometer: '', logDate: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  useEffect(() => { transportApi.drivers().then((r) => setDrivers(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const auto = f.litres && f.costPerLitre ? (Number(f.litres) * Number(f.costPerLitre)).toFixed(2) : '';
  const submit = async () => { if (!f.transportVehicleId || !f.litres) return; setBusy(true); try { await transportApi.addFuel({ ...f, projectId, totalCost: f.totalCost || auto || undefined }); onDone(); } finally { setBusy(false); } };
  const inp = inputCls;
  const L = ({ label, children, full }: any) => <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Log fuel</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Vehicle *" full><select className={inp} value={f.transportVehicleId} onChange={(e) => set('transportVehicleId', e.target.value)}><option value="">Select…</option>{vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.source === 'IN_HOUSE' ? '🏠' : '🔑'} {[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}{v.plateNumber ? ` · ${v.plateNumber}` : ''}</option>)}</select></L>
          <L label="Driver"><select className={inp} value={f.transportDriverId} onChange={(e) => set('transportDriverId', e.target.value)}><option value="">—</option>{drivers.map((d: any) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></L>
          <L label="Date"><input type="date" className={inp} value={f.logDate} onChange={(e) => set('logDate', e.target.value)} /></L>
          <L label="Litres *"><input type="number" className={inp} value={f.litres} onChange={(e) => set('litres', e.target.value)} /></L>
          <L label="Cost / litre"><input type="number" step="0.001" className={inp} value={f.costPerLitre} onChange={(e) => set('costPerLitre', e.target.value)} /></L>
          <L label={`Total cost ${auto ? `(auto AED ${auto})` : ''}`}><input type="number" className={inp} value={f.totalCost} onChange={(e) => set('totalCost', e.target.value)} placeholder={auto} /></L>
          <L label="Odometer (km)"><input type="number" className={inp} value={f.odometer} onChange={(e) => set('odometer', e.target.value)} /></L>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || !f.transportVehicleId || !f.litres}>{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Log</Btn>
        </div>
      </div>
    </div>
  );
}
