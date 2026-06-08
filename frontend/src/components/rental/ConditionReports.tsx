'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, Plus, X, Trash2, Camera, Truck, Undo2 } from 'lucide-react';
import { conditionApi, uploadFile } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const fileSrc = (v: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);

const CHECK_ITEMS = [
  'Exterior body / panels', 'Tyres & wheels', 'Lights & indicators', 'Windscreen / glass',
  'Interior / cabin', 'A/C & electrical', 'Generator / engine', 'Accessories & cables',
  'Cleanliness', 'Documents & keys',
];
const FUEL = ['Empty', '1/4', '1/2', '3/4', 'Full'];

export default function ConditionReports({ bookingId, assets }: { bookingId: string; assets: { id: string; name: string }[] }) {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<any>(null);

  const load = () => conditionApi.listByBooking(bookingId).then(r => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, [bookingId]);

  const startNew = (type: 'DELIVERY' | 'RETURN') => {
    setForm({
      bookingId, type, assetId: assets[0]?.id || '', inspectedBy: '', odometer: '', fuelLevel: '1/2',
      checklist: CHECK_ITEMS.map(item => ({ item, ok: true, note: '' })),
      damageNotes: '', photos: [] as string[], signatureName: '', notes: '',
    });
    setOpen(true);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) { const r = await uploadFile(f); urls.push(r.url); }
      setForm((s: any) => ({ ...s, photos: [...s.photos, ...urls] }));
    } catch { alert('Photo upload failed'); } finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try { await conditionApi.create(form); setOpen(false); setForm(null); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed to save inspection'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => { if (confirm('Delete this inspection?')) { await conditionApi.remove(id); load(); } };

  const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><ClipboardCheck size={15} /> Condition Reports</h2>
        <div className="flex gap-2">
          <button onClick={() => startNew('DELIVERY')} className="btn-secondary text-xs"><Truck size={12} /> Delivery</button>
          <button onClick={() => startNew('RETURN')} className="btn-secondary text-xs"><Undo2 size={12} /> Return</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">No inspections yet. Record a delivery or return condition report with photos.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {list.map(r => {
            const issues = (r.checklist || []).filter((c: any) => !c.ok).length;
            return (
              <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/60">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.type === 'RETURN' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{r.type}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800">{r.asset?.name || 'Asset'} <span className="text-gray-400 text-xs">· {fmt(r.inspectedAt)}</span></div>
                  <div className="text-xs text-gray-400">
                    {r.odometer != null && `${r.odometer} km · `}{r.fuelLevel && `Fuel ${r.fuelLevel} · `}
                    {(r.photos?.length || 0)} photo{(r.photos?.length || 0) !== 1 ? 's' : ''}
                    {issues > 0 && <span className="text-amber-600"> · {issues} issue{issues > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <button onClick={() => setView(r)} className="text-brand-600 text-xs hover:text-brand-700">View</button>
                <button onClick={() => del(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* New inspection modal */}
      {open && form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{form.type === 'RETURN' ? 'Return' : 'Delivery'} inspection</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Asset</label>
                  <select className="input w-full" value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })}>
                    <option value="">—</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Inspected by</label><input className="input w-full" value={form.inspectedBy} onChange={e => setForm({ ...form, inspectedBy: e.target.value })} /></div>
                <div><label className="label">Odometer (km)</label><input type="number" className="input w-full" value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} /></div>
                <div><label className="label">Fuel level</label>
                  <select className="input w-full" value={form.fuelLevel} onChange={e => setForm({ ...form, fuelLevel: e.target.value })}>
                    {FUEL.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Checklist</label>
                <div className="space-y-1 border border-gray-100 rounded-lg p-2">
                  {form.checklist.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <button onClick={() => setForm((s: any) => { const cl = [...s.checklist]; cl[i] = { ...cl[i], ok: !cl[i].ok }; return { ...s, checklist: cl }; })}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium w-12 ${c.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.ok ? 'OK' : 'Issue'}
                      </button>
                      <span className="text-xs text-gray-700 flex-1">{c.item}</span>
                      {!c.ok && <input className="input text-xs flex-1 py-1" placeholder="note" value={c.note}
                        onChange={e => setForm((s: any) => { const cl = [...s.checklist]; cl[i] = { ...cl[i], note: e.target.value }; return { ...s, checklist: cl }; })} />}
                    </div>
                  ))}
                </div>
              </div>

              <div><label className="label">Damage notes</label><textarea className="input w-full h-16 resize-none text-sm" value={form.damageNotes} onChange={e => setForm({ ...form, damageNotes: e.target.value })} /></div>

              <div>
                <label className="label">Photos</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.photos.map((p: string, i: number) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                      <img src={fileSrc(p)} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setForm((s: any) => ({ ...s, photos: s.photos.filter((_: any, j: number) => j !== i) }))}
                        className="absolute top-0 right-0 bg-black/50 text-white rounded-bl px-1"><X size={11} /></button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:bg-gray-50">
                    <Camera size={16} /><span className="text-[9px]">{uploading ? '…' : 'Add'}</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => addPhotos(e.target.files)} />
                  </label>
                </div>
              </div>

              <div><label className="label">Signed by (name)</label><input className="input w-full" value={form.signatureName} onChange={e => setForm({ ...form, signatureName: e.target.value })} placeholder="Client / driver name" /></div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setOpen(false)} disabled={saving} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save inspection'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {view && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setView(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{view.type} inspection — {view.asset?.name}</h2>
              <button onClick={() => setView(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <div>Inspected: {fmt(view.inspectedAt)}</div>
                <div>By: {view.inspectedBy || '—'}</div>
                <div>Odometer: {view.odometer ?? '—'} km</div>
                <div>Fuel: {view.fuelLevel || '—'}</div>
              </div>
              {view.checklist?.length > 0 && (
                <div className="border border-gray-100 rounded-lg p-2 space-y-1">
                  {view.checklist.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full w-12 text-center ${c.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.ok ? 'OK' : 'Issue'}</span>
                      <span className="flex-1 text-gray-700">{c.item}</span>
                      {c.note && <span className="text-gray-400">{c.note}</span>}
                    </div>
                  ))}
                </div>
              )}
              {view.damageNotes && <div><span className="text-gray-400 text-xs">Damage notes</span><p className="text-gray-700">{view.damageNotes}</p></div>}
              {view.photos?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {view.photos.map((p: string, i: number) => (
                    <a key={i} href={fileSrc(p)} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                      <img src={fileSrc(p)} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {view.signatureName && <div className="text-xs text-gray-500">Signed by: <b>{view.signatureName}</b></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
