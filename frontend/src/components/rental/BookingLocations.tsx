'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus, X, Trash2, ExternalLink, ArrowDown } from 'lucide-react';
import { rentalApi } from '@/lib/api';

const STATUS = ['PLANNED', 'CURRENT', 'DONE'];
const STATUS_CLS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-600', CURRENT: 'bg-green-50 text-green-700', DONE: 'bg-blue-50 text-blue-700',
};
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

export default function BookingLocations({ bookingId }: { bookingId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ siteName: '', address: '', locationUrl: '', fromDate: '', toDate: '', notes: '' });

  const load = () => rentalApi.bookings.locations(bookingId).then(r => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, [bookingId]);

  const save = async () => {
    if (!form.siteName && !form.address) return;
    await rentalApi.bookings.addLocation(bookingId, form);
    setForm({ siteName: '', address: '', locationUrl: '', fromDate: '', toDate: '', notes: '' });
    setOpen(false); load();
  };
  const setStatus = async (id: string, status: string) => { await rentalApi.bookings.updateLocation(id, { status }); load(); };
  const del = async (id: string) => { if (confirm('Remove this stop?')) { await rentalApi.bookings.removeLocation(id); load(); } };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><MapPin size={15} /> Location Schedule</h2>
        <button onClick={() => setOpen(true)} className="btn-secondary text-xs"><Plus size={12} /> Add stop</button>
      </div>

      {list.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">Single-site hire. Add stops if the asset moves between locations.</div>
      ) : (
        <div className="p-4">
          {list.map((l, i) => (
            <div key={l.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">{i + 1}</div>
                {i < list.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
              </div>
              <div className="flex-1 pb-4 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-800 text-sm">{l.siteName || l.address || 'Site'}</span>
                  <select value={l.status} onChange={e => setStatus(l.id, e.target.value)}
                    className={`text-[10px] rounded-full px-2 py-0.5 border-0 cursor-pointer ${STATUS_CLS[l.status]}`}>
                    {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {l.locationUrl && <a href={l.locationUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700 text-xs flex items-center gap-0.5"><ExternalLink size={11} /> Map</a>}
                  <button onClick={() => del(l.id)} className="text-gray-300 hover:text-red-500 ml-auto"><Trash2 size={13} /></button>
                </div>
                {l.address && <div className="text-xs text-gray-500">{l.address}</div>}
                <div className="text-[11px] text-gray-400">{fmt(l.fromDate)} → {fmt(l.toDate)}{l.notes ? ` · ${l.notes}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Add location stop</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div><label className="label">Site name</label><input className="input w-full" value={form.siteName} onChange={e => setForm({ ...form, siteName: e.target.value })} placeholder="e.g. Desert Base Camp" /></div>
              <div><label className="label">Address</label><input className="input w-full" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><label className="label">Google Maps link</label><input className="input w-full" value={form.locationUrl} onChange={e => setForm({ ...form, locationUrl: e.target.value })} placeholder="https://maps.google.com/…" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">From</label><input type="date" className="input w-full" value={form.fromDate} onChange={e => setForm({ ...form, fromDate: e.target.value })} /></div>
                <div><label className="label">To</label><input type="date" className="input w-full" value={form.toDate} onChange={e => setForm({ ...form, toDate: e.target.value })} /></div>
              </div>
              <div><label className="label">Notes</label><input className="input w-full" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} className="btn-primary flex-1">Add stop</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
