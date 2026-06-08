'use client';

/**
 * SupplierSelect — reusable searchable supplier dropdown with quick-add popup.
 *
 * Props:
 *   value       — currently selected supplier id (or '')
 *   onChange    — called with (supplierId, supplierObject | null)
 *   placeholder — optional placeholder text
 *   required    — HTML required attribute
 *   disabled    — disable the control
 *   label       — label text (if omitted, caller renders their own label)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { financeApi, uploadFile } from '@/lib/api';
import { Search, Plus, X, ChevronDown, Loader2, Building2 } from 'lucide-react';

// ── Category list ──────────────────────────────────────────────────────────────
export const SUPPLIER_CATEGORIES = [
  'Maintenance Workshop',
  'Spare Parts Supplier',
  'Fuel Supplier',
  'Tire Supplier',
  'Equipment Rental',
  'Transportation',
  'Cleaning Services',
  'Production Supplier',
  'Catering',
  'Utility Supplier',
  'Freelancer / Vendor',
  'Insurance',
  'Legal',
  'IT & Software',
  'Office Supplies',
  'Post Production',
  'Printing',
  'General Supplier',
  'Other',
];

// ── Quick-Add Modal ────────────────────────────────────────────────────────────

function QuickAddModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (supplier: any) => void;
}) {
  const [form, setForm] = useState({
    name: initialName,
    tradeName: '',
    category: '',
    trn: '',
    contactName: '',
    email: '',
    phone: '',
    paymentTermDays: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const f = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value })),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await financeApi.suppliers.create({
        ...form,
        paymentTermDays: form.paymentTermDays ? Number(form.paymentTermDays) : undefined,
      });
      onCreated(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create supplier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">Add New Supplier</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Supplier Name *</label>
              <input className="input w-full" required {...f('name')} autoFocus />
            </div>
            <div>
              <label className="label">Trade Name</label>
              <input className="input w-full" {...f('tradeName')} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input w-full" {...f('category')}>
                <option value="">— Select —</option>
                {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">TRN (UAE Tax Reg.)</label>
              <input className="input w-full font-mono" {...f('trn')} placeholder="100XXXXXXXXX00003" />
            </div>
            <div>
              <label className="label">Payment Terms (days)</label>
              <input type="number" className="input w-full" {...f('paymentTermDays')} placeholder="30" min={0} />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input w-full" {...f('contactName')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input w-full" {...f('phone')} placeholder="+971 4 XXX XXXX" />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input type="email" className="input w-full" {...f('email')} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input w-full" rows={2} {...f('notes')} />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            You can add banking details, documents, and additional contacts from the full supplier profile.
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Creating…' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main SupplierSelect Component ─────────────────────────────────────────────

interface SupplierSelectProps {
  value:       string;
  onChange:    (supplierId: string, supplier: any | null) => void;
  placeholder?: string;
  required?:    boolean;
  disabled?:    boolean;
  label?:       string;
  className?:   string;
}

export default function SupplierSelect({
  value,
  onChange,
  placeholder = 'Search suppliers…',
  required,
  disabled,
  label,
  className = '',
}: SupplierSelectProps) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [selected,    setSelected]    = useState<any | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Load selected supplier name on mount / value change
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    financeApi.suppliers.get(value)
      .then(r => setSelected(r.data))
      .catch(() => setSelected(null));
  }, [value]);

  // Search debounce
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      financeApi.suppliers.search(query)
        .then(r => setResults(r.data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (s: any) => {
    setSelected(s);
    setOpen(false);
    setQuery('');
    onChange(s.id, s);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
    setQuery('');
    onChange('', null);
  };

  const handleCreated = (supplier: any) => {
    setShowQuickAdd(false);
    select(supplier);
  };

  return (
    <>
      <div ref={containerRef} className={`relative ${className}`}>
        {label && <label className="label">{label}{required && ' *'}</label>}

        {/* Trigger */}
        <div
          onClick={() => { if (!disabled) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); } }}
          className={`input w-full flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${open ? 'ring-2 ring-brand-500' : ''}`}
        >
          {selected ? (
            <>
              <Building2 size={14} className="text-gray-400 shrink-0" />
              <span className="flex-1 truncate text-gray-800">
                {selected.name}
                {selected.supplierCode && (
                  <span className="ml-1.5 text-xs text-gray-400">{selected.supplierCode}</span>
                )}
              </span>
              {!disabled && (
                <button type="button" onClick={clear} className="shrink-0 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              <Search size={14} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-gray-400 text-sm">{placeholder}</span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  className="input w-full pl-8 py-1.5 text-sm"
                  placeholder="Type to search…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Results */}
            <ul className="max-h-60 overflow-y-auto">
              {loading && (
                <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-400">
                  <Loader2 size={13} className="animate-spin" /> Searching…
                </li>
              )}
              {!loading && results.map(s => (
                <li
                  key={s.id}
                  onClick={() => select(s)}
                  className="flex items-center gap-2 px-3 py-2.5 hover:bg-brand-50 cursor-pointer"
                >
                  <Building2 size={14} className="text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {s.supplierCode && <span className="mr-2">{s.supplierCode}</span>}
                      {s.category && <span className="mr-2">{s.category}</span>}
                      {s.trn && <span className="font-mono">TRN: {s.trn}</span>}
                    </p>
                  </div>
                  {s.paymentTermDays && (
                    <span className="text-xs text-gray-400 shrink-0">{s.paymentTermDays}d</span>
                  )}
                </li>
              ))}
              {!loading && results.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-gray-400">No suppliers found</li>
              )}
            </ul>

            {/* Quick-add footer */}
            <div className="border-t p-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setShowQuickAdd(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-lg"
              >
                <Plus size={14} />
                Add "{query || 'new supplier'}" to directory
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick-Add Modal */}
      {showQuickAdd && (
        <QuickAddModal
          initialName={query}
          onClose={() => setShowQuickAdd(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
