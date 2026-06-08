'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { rentalApi, servicesApi } from '@/lib/api';

export interface LineItem {
  id: string;
  kind: 'ASSET' | 'SERVICE';
  description: string;
  details: string;
  quantity: number;
  unit: string;
  days: number;
  unitPrice: number;
  discountPct: number;
  taxRateId: string;
  taxAmount: number;
  lineTotal: number;
}

interface Props {
  items: LineItem[];
  vatRates: { id: string; name: string; rate: number }[];
  onChange: (items: LineItem[]) => void;
  currency?: string;
}

function newItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    kind: 'ASSET',
    description: '',
    details: '',
    quantity: 1,
    unit: 'day',
    days: 1,
    unitPrice: 0,
    discountPct: 0,
    taxRateId: '',
    taxAmount: 0,
    lineTotal: 0,
  };
}

function calcLine(item: LineItem, vatRates: Props['vatRates']): LineItem {
  const lineSubtotal = item.quantity * item.days * item.unitPrice * (1 - item.discountPct / 100);
  const vat = vatRates.find(v => v.id === item.taxRateId);
  const taxAmount = vat ? lineSubtotal * (vat.rate / 100) : 0;
  return {
    ...item,
    lineTotal: Math.round(lineSubtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
  };
}

// grid: kind | description | qty | unit | days | unitPrice | disc% | vat | lineTotal | delete
const COLS = '92px 3fr 64px 80px 64px 110px 64px 110px 100px 36px';

export default function LineItemsEditor({ items, vatRates, onChange, currency = 'AED' }: Props) {
  const [assets, setAssets] = useState<{ id: string; name: string; assetType?: string }[]>([]);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    rentalApi.assets.list({ limit: 500 })
      .then(r => setAssets(r.data.items || r.data || []))
      .catch(() => {});
    servicesApi.list({ isActive: 'true' })
      .then(r => setServices(r.data || []))
      .catch(() => {});
  }, []);

  const update = (id: string, patch: Partial<LineItem>) => {
    onChange(items.map(item => {
      if (item.id !== id) return item;
      return calcLine({ ...item, ...patch }, vatRates);
    }));
  };

  const add    = () => onChange([...items, newItem()]);
  const remove = (id: string) => onChange(items.filter(i => i.id !== id));

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const totalVat = items.reduce((s, i) => s + i.taxAmount, 0);

  return (
    <div className="space-y-2">

      {/* Asset + service options */}
      <datalist id="lie-asset-options">
        {assets.map(a => (
          <option key={a.id} value={a.name}>{a.assetType ? String(a.assetType).replace(/_/g, ' ') : ''}</option>
        ))}
      </datalist>
      <datalist id="lie-service-options">
        {services.map(s => (
          <option key={s.id} value={s.name}>{s.category || ''}</option>
        ))}
      </datalist>
      <div className="flex justify-end gap-3">
        <a href="/rental/assets" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><ExternalLink size={12} /> Manage assets</a>
        <a href="/finance/services" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><ExternalLink size={12} /> Manage services</a>
      </div>

      {/* ── Column headers ── */}
      <div
        className="grid gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1"
        style={{ gridTemplateColumns: COLS }}
      >
        <span>Type</span>
        <span>Asset / Service / Description</span>
        <span>Unit</span>
        <span>Unit/Duration</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit Price</span>
        <span className="text-right">Disc %</span>
        <span>VAT</span>
        <span className="text-right">Line Total</span>
        <span />
      </div>

      {/* ── Rows ── */}
      {items.map((item) => (
        <div
          key={item.id}
          className="group grid gap-2 items-start bg-white border border-gray-200 rounded-lg p-2.5 hover:border-brand-300 transition-colors"
          style={{ gridTemplateColumns: COLS }}
        >
          {/* Kind selector */}
          <select
            className="input text-xs"
            value={item.kind}
            onChange={e => update(item.id, { kind: e.target.value as 'ASSET' | 'SERVICE' })}
          >
            <option value="ASSET">Asset</option>
            <option value="SERVICE">Service</option>
          </select>

          {/* Description + details (asset or service picker) */}
          <div className="space-y-1">
            <input
              list={item.kind === 'SERVICE' ? 'lie-service-options' : 'lie-asset-options'}
              className="input text-sm font-medium"
              placeholder={item.kind === 'SERVICE' ? 'Select service or type…' : 'Select asset or type description…'}
              value={item.description}
              onChange={e => {
                const v = e.target.value;
                if (item.kind === 'SERVICE') {
                  const svc = services.find(s => s.name === v);
                  if (svc) {
                    update(item.id, {
                      description: svc.name,
                      details: svc.description || item.details,
                      unit: svc.unitOfMeasure || item.unit,
                      unitPrice: Number(svc.unitPrice || 0) || item.unitPrice,
                      taxRateId: svc.taxRateId || item.taxRateId,
                    });
                  } else {
                    update(item.id, { description: v });
                  }
                } else {
                  const match = assets.find(a => a.name === v);
                  if (match && !item.details) {
                    update(item.id, { description: match.name, details: String(match.assetType || '').replace(/_/g, ' ') });
                  } else {
                    update(item.id, { description: v });
                  }
                }
              }}
            />
            <input
              className="input text-xs text-gray-500"
              placeholder="Additional details (optional)"
              value={item.details}
              onChange={e => update(item.id, { details: e.target.value })}
            />
          </div>

          {/* Unit (0.5 step: 0.5, 1, 1.5, 2 …) */}
          <input
            type="number" min="0.5" step="0.5"
            className="input text-right text-sm"
            value={item.quantity}
            onChange={e => update(item.id, { quantity: parseFloat(e.target.value) || 0 })}
          />

          {/* Unit */}
          <select
            className="input text-sm"
            value={item.unit}
            onChange={e => update(item.id, { unit: e.target.value })}
          >
            {['day','week','month','hour','unit','trip','job','set','kg','m','pcs'].map(u =>
              <option key={u} value={u}>{u}</option>
            )}
          </select>

          {/* Days — per-item rental duration */}
          <input
            type="number" min="1" step="1"
            className="input text-right text-sm font-semibold text-brand-700"
            title="Number of days this item is rented"
            value={item.days}
            onChange={e => update(item.id, { days: Math.max(1, parseInt(e.target.value) || 1) })}
          />

          {/* Unit Price */}
          <input
            type="number" min="0" step="0.01"
            className="input text-right text-sm"
            value={item.unitPrice}
            onChange={e => update(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
          />

          {/* Discount % */}
          <input
            type="number" min="0" max="100" step="0.1"
            className="input text-right text-sm"
            value={item.discountPct}
            onChange={e => update(item.id, { discountPct: parseFloat(e.target.value) || 0 })}
          />

          {/* VAT */}
          <select
            className="input text-xs"
            value={item.taxRateId}
            onChange={e => update(item.id, { taxRateId: e.target.value })}
          >
            <option value="">No VAT</option>
            {vatRates.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>

          {/* Line Total */}
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 pt-2">
              {formatCurrency(item.lineTotal, currency)}
            </p>
            {item.days > 1 && (
              <p className="text-[10px] text-gray-400">
                {item.quantity} × {item.days} days × {Number(item.unitPrice).toLocaleString('en-AE', { minimumFractionDigits: 0 })}
              </p>
            )}
            {item.taxAmount > 0 && (
              <p className="text-[10px] text-gray-400">+VAT {formatCurrency(item.taxAmount, currency)}</p>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => remove(item.id)}
            className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-1.5"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {/* ── Add row ── */}
      <button
        onClick={add}
        className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium py-2 px-3 rounded-lg hover:bg-brand-50 transition-colors"
      >
        <Plus size={14} /> Add Line Item
      </button>

      {/* ── Totals summary ── */}
      {items.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="w-72 space-y-1.5 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
            </div>
            {totalVat > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT</span>
                <span className="font-medium">{formatCurrency(totalVat, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
              <span>Total</span>
              <span>{formatCurrency(subtotal + totalVat, currency)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
