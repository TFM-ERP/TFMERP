'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rentalApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  Search, RefreshCw, AlertTriangle, Plus, X, CheckCircle2, ChevronRight,
} from 'lucide-react';
import PlateNumberInput from '@/components/PlateNumberInput';
import StatusBadge from '@/components/StatusBadge';
import {
  CATEGORIES, TYPES_BY_CATEGORY, ASSET_TYPE_LABELS, FEATURES, SPEC_GROUPS,
  categoryForType, type AssetCategory,
} from '@/lib/assetCategories';

const ALL_TYPES = Object.values(TYPES_BY_CATEGORY).flat();

const EMPTY_FORM = {
  category: 'VEHICLE' as AssetCategory,
  name: '', assetType: 'SUPPORT_VEHICLE',
  plateNumber: '', plateEmirate: 'DXB', vinNumber: '',
  serialNumber: '', condition: 'GOOD', notes: '',
  registrationExpiry: '', insuranceExpiry: '', insurancePolicyRef: '',
  warrantyExpiry: '', warrantyProvider: '',
  purchaseDate: '', purchaseValue: '', currentValue: '',
};

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
              )}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : idx}
              </div>
              <span className={cn('text-xs font-medium whitespace-nowrap',
                active ? 'text-indigo-700' : done ? 'text-green-600' : 'text-gray-400')}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={cn('flex-1 h-px mx-3', done ? 'bg-green-400' : 'bg-gray-200')} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Add Asset Wizard (category-driven) ──────────────────────────────────────────
function AddAssetWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [specs, setSpecs] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const feat = FEATURES[form.category];
  const specGroups = SPEC_GROUPS[form.category] || [];
  const steps = ['Category & Identity', 'Specifications & Compliance', 'Done'];

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setSpec = (k: string, v: any) => setSpecs(s => ({ ...s, [k]: v }));

  // When category changes, reset the asset type to the first of that category.
  const changeCategory = (cat: AssetCategory) => {
    setForm(f => ({ ...f, category: cat, assetType: TYPES_BY_CATEGORY[cat][0] }));
    setSpecs({});
  };

  const inputCls = 'input w-full';
  const labelCls = 'label';

  const save = async () => {
    if (!form.name.trim()) { setError('Asset name is required'); return; }
    setSaving(true); setError('');
    try {
      await rentalApi.assets.create({
        name: form.name,
        category: form.category,
        assetType: form.assetType,
        condition: form.condition || undefined,
        notes: form.notes || undefined,
        // Identifiers — only the ones relevant to the category
        plateNumber: feat.plateAndVin ? (form.plateNumber || undefined) : undefined,
        plateEmirate: feat.plateAndVin ? (form.plateEmirate || undefined) : undefined,
        vinNumber: feat.plateAndVin ? (form.vinNumber || undefined) : undefined,
        serialNumber: feat.serialNumber ? (form.serialNumber || undefined) : undefined,
        // Compliance — only relevant ones
        registrationExpiry: feat.registration ? (form.registrationExpiry || undefined) : undefined,
        insuranceExpiry: feat.insurance ? (form.insuranceExpiry || undefined) : undefined,
        insurancePolicyRef: feat.insurance ? (form.insurancePolicyRef || undefined) : undefined,
        warrantyExpiry: feat.warranty ? (form.warrantyExpiry || undefined) : undefined,
        warrantyProvider: feat.warranty ? (form.warrantyProvider || undefined) : undefined,
        // Category-specific specs
        specs: Object.keys(specs).length ? specs : undefined,
        // Valuation
        purchaseDate: form.purchaseDate || undefined,
        purchaseValue: form.purchaseValue ? Number(form.purchaseValue) : undefined,
        currentValue: form.currentValue ? Number(form.currentValue) : undefined,
      });
      setStep(3);
    } catch (e: any) {
      setError(
        (Array.isArray(e.response?.data?.message) ? e.response.data.message.join(', ') : e.response?.data?.message)
        || 'Failed to create asset'
      );
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add New Asset</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of {steps.length}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepIndicator steps={steps} current={step} />
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {/* ── Step 1: Category & Identity ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Asset Category</p>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => changeCategory(c.value)}
                      className={cn('px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-colors',
                        form.category === c.value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identity</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Asset Name *</label>
                    <input className={inputCls} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Generator A, Star Trailer 01" />
                  </div>
                  <div>
                    <label className={labelCls}>Asset Type *</label>
                    <select className={inputCls} value={form.assetType} onChange={e => setF('assetType', e.target.value)}>
                      {TYPES_BY_CATEGORY[form.category].map(t => <option key={t} value={t}>{ASSET_TYPE_LABELS[t] || t}</option>)}
                    </select>
                  </div>

                  {/* Vehicle / trailer identifiers */}
                  {feat.plateAndVin && (
                    <>
                      <div className="col-span-3">
                        <PlateNumberInput value={form.plateNumber} emirate={form.plateEmirate}
                          onChange={v => setF('plateNumber', v)} onEmirateChange={e => setF('plateEmirate', e)} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>VIN / Chassis No.</label>
                        <input className={`${inputCls} font-mono`} value={form.vinNumber} onChange={e => setF('vinNumber', e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* Serial number for non-vehicles */}
                  {feat.serialNumber && (
                    <div className="col-span-2">
                      <label className={labelCls}>Serial Number</label>
                      <input className={`${inputCls} font-mono`} value={form.serialNumber} onChange={e => setF('serialNumber', e.target.value)} />
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Condition</label>
                    <select className={inputCls} value={form.condition} onChange={e => setF('condition', e.target.value)}>
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="POOR">Poor</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Specifications & Compliance ── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Category-specific spec groups */}
              {specGroups.map(group => (
                <div key={group.title}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{group.title}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {group.fields.map(fld => (
                      <div key={fld.key}>
                        <label className={labelCls}>{fld.label}</label>
                        {fld.type === 'select' ? (
                          <select className={inputCls} value={specs[fld.key] ?? ''} onChange={e => setSpec(fld.key, e.target.value)}>
                            <option value="">—</option>
                            {(fld.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={fld.type} className={inputCls} value={specs[fld.key] ?? ''} placeholder={fld.placeholder}
                            onChange={e => setSpec(fld.key, fld.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Compliance — only what applies to this category */}
              {(feat.registration || feat.insurance || feat.warranty) && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Compliance</p>
                  <div className="grid grid-cols-3 gap-3">
                    {feat.registration && (
                      <div>
                        <label className={labelCls}>Registration Expiry (Mulkiya)</label>
                        <input type="date" className={inputCls} value={form.registrationExpiry} onChange={e => setF('registrationExpiry', e.target.value)} />
                      </div>
                    )}
                    {feat.insurance && (
                      <>
                        <div>
                          <label className={labelCls}>Insurance Expiry</label>
                          <input type="date" className={inputCls} value={form.insuranceExpiry} onChange={e => setF('insuranceExpiry', e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Insurance Policy Ref</label>
                          <input className={inputCls} value={form.insurancePolicyRef} onChange={e => setF('insurancePolicyRef', e.target.value)} />
                        </div>
                      </>
                    )}
                    {feat.warranty && (
                      <>
                        <div>
                          <label className={labelCls}>Warranty Expiry</label>
                          <input type="date" className={inputCls} value={form.warrantyExpiry} onChange={e => setF('warrantyExpiry', e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Warranty Provider</label>
                          <input className={inputCls} value={form.warrantyProvider} onChange={e => setF('warrantyProvider', e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Valuation — applies to all */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Valuation</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={labelCls}>Purchase Date</label><input type="date" className={inputCls} value={form.purchaseDate} onChange={e => setF('purchaseDate', e.target.value)} /></div>
                  <div><label className={labelCls}>Purchase Value (AED)</label><input type="number" className={inputCls} value={form.purchaseValue} onChange={e => setF('purchaseValue', e.target.value)} /></div>
                  <div><label className={labelCls}>Current Value (AED)</label><input type="number" className={inputCls} value={form.currentValue} onChange={e => setF('currentValue', e.target.value)} /></div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Asset created successfully!</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">Open the asset record to upload photos and documents.</p>
              </div>
              <button onClick={onDone} className="btn btn-primary">Done — back to assets list</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 3 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
            <button onClick={step === 1 ? onClose : () => setStep(step - 1)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100">
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step === 1 ? (
              <button onClick={() => { if (!form.name.trim()) { setError('Asset name is required'); return; } setError(''); setStep(2); }}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Create Asset'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setListError('');
    rentalApi.assets.list({ search: search || undefined, assetType: assetType || undefined, status: status || undefined, page, limit: 25 })
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch((e: any) => {
        const msg = e.response?.data?.message || e.message || 'Failed to load assets';
        setListError(Array.isArray(msg) ? msg.join(', ') : msg);
      })
      .finally(() => setLoading(false));
  }, [search, assetType, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { rentalApi.assets.expiryAlerts().then(r => setAlerts(r.data)).catch(() => {}); }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total assets</p>
        </div>
        <button onClick={() => setShowWizard(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> Add Asset
        </button>
      </div>

      {listError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-red-700">
            <span className="font-semibold">Could not load assets:</span> {listError}
            {listError.toLowerCase().includes('column') && (
              <span className="block mt-1 text-xs text-red-500">
                The database schema needs updating. Stop the backend and run:&nbsp;
                <code className="bg-red-100 px-1 rounded">npx prisma db push</code>
              </span>
            )}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">{alerts.length} asset(s)</span> have registration, insurance or warranty expiring within 60 days.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search by name, plate, serial, VIN..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-44" value={assetType} onChange={e => { setAssetType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {ALL_TYPES.map(t => <option key={t} value={t}>{ASSET_TYPE_LABELS[t] || t}</option>)}
        </select>
        <select className="input w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="ON_HIRE">On Hire</option>
          <option value="IN_MAINTENANCE">In Maintenance</option>
          <option value="RESERVED">Reserved</option>
          <option value="RETIRED">Retired</option>
        </select>
        <button onClick={load} className="btn btn-secondary p-2"><RefreshCw size={14} className={cn(loading && 'animate-spin')} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Asset</th>
              <th className="table-th">Category</th>
              <th className="table-th">Type</th>
              <th className="table-th">Plate / Serial</th>
              <th className="table-th">Compliance</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const cat = item.category || categoryForType(item.assetType);
              const regExpired = item.registrationExpiry && new Date(item.registrationExpiry) < new Date();
              const insExpired = item.insuranceExpiry && new Date(item.insuranceExpiry) < new Date();
              const warExpired = item.warrantyExpiry && new Date(item.warrantyExpiry) < new Date();
              const complianceBits: string[] = [];
              if (item.registrationExpiry) complianceBits.push(`Reg ${formatDate(item.registrationExpiry)}`);
              if (item.insuranceExpiry) complianceBits.push(`Ins ${formatDate(item.insuranceExpiry)}`);
              if (item.warrantyExpiry) complianceBits.push(`Wty ${formatDate(item.warrantyExpiry)}`);
              const anyExpired = regExpired || insExpired || warExpired;
              return (
                <tr key={item.id} className="table-row">
                  <td className="table-td">
                    <Link href={`/rental/assets/${item.id}`} className="font-medium text-gray-900 hover:text-brand-600">{item.name}</Link>
                    {item.condition && <div className="text-xs text-gray-400">{item.condition}</div>}
                  </td>
                  <td className="table-td text-sm text-gray-600">{CATEGORIES.find(c => c.value === cat)?.label || cat}</td>
                  <td className="table-td text-sm text-gray-600">{ASSET_TYPE_LABELS[item.assetType] || item.assetType}</td>
                  <td className="table-td text-sm font-mono text-gray-600">{item.plateNumber || item.serialNumber || item.vinNumber || '—'}</td>
                  <td className="table-td text-xs">
                    {complianceBits.length ? (
                      <span className={cn(anyExpired ? 'text-red-600 font-semibold' : 'text-gray-600')}>
                        {anyExpired && '⚠ '}{complianceBits.join(' · ')}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td"><StatusBadge module="Asset" status={item.status} size="sm" showIcon={false} showDot /></td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No assets found. Click "Add Asset" to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {showWizard && <AddAssetWizard onClose={() => setShowWizard(false)} onDone={() => { setShowWizard(false); load(); }} />}
    </div>
  );
}
