'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { rentalApi, clientsApi } from '@/lib/api';
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface LineItem {
  assetId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  days: number;
  taxAmount: number;
}

const emptyItem = (): LineItem => ({
  assetId: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  days: 1,
  taxAmount: 0,
});

export default function NewBookingPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [allowOverride, setAllowOverride] = useState(false);

  const [form, setForm] = useState({
    clientId: '',
    startDate: '',
    endDate: '',
    deliveryDate: '',
    pickupDate: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryNotes: '',
    pickupAddress: '',
    currency: 'AED',
    depositAmount: '',
    discountAmount: '',
    poNumber: '',
    notes: '',
    internalNotes: '',
  });

  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  useEffect(() => {
    clientsApi.list().then(r => setClients(r.data.items || r.data)).catch(console.error);
    rentalApi.assets.list({ status: 'AVAILABLE', limit: 100 }).then(r => setAssets(r.data.items)).catch(console.error);
  }, []);

  // Live double-booking check
  useEffect(() => {
    const assetIds = items.map(i => i.assetId).filter(Boolean);
    if (!form.startDate || !form.endDate || assetIds.length === 0) { setConflicts([]); return; }
    const t = setTimeout(() => {
      rentalApi.bookings.checkConflicts(assetIds, form.startDate, form.endDate)
        .then(r => setConflicts(r.data.conflicts || []))
        .catch(() => setConflicts([]));
    }, 400);
    return () => clearTimeout(t);
  }, [form.startDate, form.endDate, items]);

  const setField = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const setItemField = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const calcLine = (item: LineItem) => item.unitPrice * item.days * item.quantity;

  const subtotal = items.reduce((s, i) => s + calcLine(i), 0);
  const discount = Number(form.discountAmount) || 0;
  const vat = items.reduce((s, i) => s + (i.taxAmount || 0), 0);
  const total = subtotal - discount + vat;

  const handleSave = async () => {
    if (!form.clientId || !form.startDate || !form.endDate) {
      setError('Client, start date, and end date are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await rentalApi.bookings.create({
        ...form,
        allowConflicts: allowOverride,
        discountAmount: Number(form.discountAmount) || 0,
        depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined,
        items: items.filter(i => i.description || i.assetId).map(i => ({
          ...i,
          lineTotal: calcLine(i),
        })),
      });
      router.push(`/rental/bookings/${res.data.id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create booking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/rental/bookings" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <h1 className="text-2xl font-bold text-gray-900">New Rental Booking</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {conflicts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-800 mb-1.5">
            <AlertTriangle size={15} /> Scheduling conflict — {conflicts.length} asset{conflicts.length > 1 ? 's are' : ' is'} already booked in these dates
          </div>
          <ul className="text-amber-700 text-xs space-y-0.5 ml-6 list-disc">
            {conflicts.map((c, i) => (
              <li key={i}><b>{c.assetName}</b> is on {c.bookingNumber} ({c.client}) — {new Date(c.startDate).toLocaleDateString('en-GB')} → {new Date(c.endDate).toLocaleDateString('en-GB')} [{String(c.status).replace(/_/g, ' ')}]</li>
            ))}
          </ul>
          <label className="flex items-center gap-2 mt-2 text-xs text-amber-800 cursor-pointer">
            <input type="checkbox" checked={allowOverride} onChange={e => setAllowOverride(e.target.checked)} />
            I understand — book anyway (override the conflict)
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client & Dates */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Booking Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Client *</label>
                <select className="input w-full" value={form.clientId} onChange={e => setField('clientId', e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start Date *</label>
                <input type="date" className="input w-full" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
              </div>
              <div>
                <label className="label">End Date *</label>
                <input type="date" className="input w-full" value={form.endDate} onChange={e => setField('endDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Delivery Date</label>
                <input type="date" className="input w-full" value={form.deliveryDate} onChange={e => setField('deliveryDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Pickup Date</label>
                <input type="date" className="input w-full" value={form.pickupDate} onChange={e => setField('pickupDate', e.target.value)} />
              </div>
              <div>
                <label className="label">PO Number</label>
                <input className="input w-full" value={form.poNumber} onChange={e => setField('poNumber', e.target.value)} placeholder="Client's PO reference" />
              </div>
              <div>
                <label className="label">Deposit Amount (AED)</label>
                <input type="number" className="input w-full" value={form.depositAmount} onChange={e => setField('depositAmount', e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Delivery / Pickup</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Delivery Address</label>
                <input className="input w-full" value={form.deliveryAddress} onChange={e => setField('deliveryAddress', e.target.value)} />
              </div>
              <div>
                <label className="label">Delivery City</label>
                <input className="input w-full" value={form.deliveryCity} onChange={e => setField('deliveryCity', e.target.value)} placeholder="Dubai" />
              </div>
              <div>
                <label className="label">Pickup Address</label>
                <input className="input w-full" value={form.pickupAddress} onChange={e => setField('pickupAddress', e.target.value)} />
              </div>
              <div>
                <label className="label">Delivery Notes</label>
                <input className="input w-full" value={form.deliveryNotes} onChange={e => setField('deliveryNotes', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Rental Items</h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-6 gap-2 mb-2">
                    <div className="col-span-3">
                      <label className="label text-[10px]">Asset</label>
                      <select
                        className="input w-full text-xs"
                        value={item.assetId}
                        onChange={e => {
                          const asset = assets.find((a: any) => a.id === e.target.value);
                          setItemField(idx, 'assetId', e.target.value);
                          if (asset) {
                            setItemField(idx, 'description', asset.name);
                            setItemField(idx, 'unitPrice', Number(asset.dailyRate) || 0);
                          }
                        }}
                      >
                        <option value="">Select asset...</option>
                        {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label text-[10px]">Days</label>
                      <input type="number" min="1" className="input w-full text-xs" value={item.days}
                        onChange={e => setItemField(idx, 'days', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Rate/Day</label>
                      <input type="number" min="0" step="0.01" className="input w-full text-xs" value={item.unitPrice}
                        onChange={e => setItemField(idx, 'unitPrice', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">VAT (AED)</label>
                      <input type="number" min="0" step="0.01" className="input w-full text-xs" value={item.taxAmount}
                        onChange={e => setItemField(idx, 'taxAmount', Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input flex-1 text-xs"
                      placeholder="Description..."
                      value={item.description}
                      onChange={e => setItemField(idx, 'description', e.target.value)}
                    />
                    <span className="text-xs font-semibold text-gray-700 w-28 text-right">
                      AED {calcLine(item).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setItems(prev => [...prev, emptyItem()])} className="mt-3 flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700">
              <Plus size={14} /> Add Item
            </button>
          </div>

          {/* Notes */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Notes</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Client Notes</label>
                <textarea className="input w-full" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Visible to client..." />
              </div>
              <div>
                <label className="label">Internal Notes</label>
                <textarea className="input w-full" rows={2} value={form.internalNotes} onChange={e => setField('internalNotes', e.target.value)} placeholder="Internal use only..." />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-4">
          <div className="card sticky top-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>AED {subtotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Discount</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">AED</span>
                  <input
                    type="number" min="0" step="0.01"
                    className="input w-24 text-right text-xs py-0.5"
                    value={form.discountAmount}
                    onChange={e => setField('discountAmount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VAT</span>
                <span>AED {vat.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-gray-900">
                <span>Total</span>
                <span>AED {total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button onClick={handleSave} disabled={saving || (conflicts.length > 0 && !allowOverride)} className="btn btn-primary w-full disabled:opacity-50">
                {saving ? 'Creating...' : conflicts.length > 0 && !allowOverride ? 'Resolve conflict to continue' : 'Create Booking'}
              </button>
              <Link href="/rental/bookings" className="btn btn-secondary w-full text-center">Cancel</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
