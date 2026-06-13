'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rentalApi, assetUrl } from '@/lib/api';
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

/** Tile fallback gradients per category (no photo tagged yet) — per theme. */
const ASSET_FALLBACK: Record<string, string> = {
  VEHICLE: 'linear-gradient(135deg,#23272d,#141416 60%,#1a1d22)',
  GENERATOR: 'linear-gradient(150deg,#3a2c12,#1c1407 60%,#0d0a05)',
  TRAILER: 'linear-gradient(160deg,#1d2b26,#121416 60%,#1b2330)',
  MOBILE_OFFICE: 'linear-gradient(140deg,#262033,#141118 60%,#101418)',
  EQUIPMENT: 'linear-gradient(135deg,#2a2a2e,#121214 55%,#3a2c12)',
  OTHER: 'linear-gradient(135deg,#26262a,#121214 60%,#1d1d21)',
};
const ASSET_FALLBACK_LIGHT: Record<string, string> = {
  VEHICLE: 'linear-gradient(135deg,#E0E3E7,#F0F1F4 60%,#E9ECEF)',
  GENERATOR: 'linear-gradient(150deg,#F0E6D5,#F8F3E8 60%,#F2EBD8)',
  TRAILER: 'linear-gradient(160deg,#DCEAE4,#EFF4F1 60%,#E5EEE8)',
  MOBILE_OFFICE: 'linear-gradient(140deg,#E4E0EC,#F2F0F6 60%,#EBE9F0)',
  EQUIPMENT: 'linear-gradient(135deg,#E6E4DF,#F3F1EC 55%,#F2EBD8)',
  OTHER: 'linear-gradient(135deg,#E6E4DF,#F2F1EE 60%,#EBEAE6)',
};

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
  const [category, setCategory] = useState(''); // marquee chips — server-side filter
  // Tiles view (cinematic, like the Projects grid) alongside the classic list.
  const [view, setView] = useState<'list' | 'tiles'>(() =>
    (typeof window !== 'undefined' && window.localStorage.getItem('assets-view') as any) || 'list');
  const switchView = (v: 'list' | 'tiles') => { setView(v); try { window.localStorage.setItem('assets-view', v); } catch {} };
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'availability'>('type');
  // Theme: marquee + tiles follow the global mode (Graphite light · Charcoal Black dark).
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  const MQ = isDark ? {
    panel: 'linear-gradient(120deg,#141416 0%,#0E0E10 55%,#1c1407 130%)', border: '#232326',
    glow: 'radial-gradient(circle,rgba(201,169,106,.16),transparent 70%)', kicker: '#c9a96a',
    title: '#fff', count: 'rgba(255,255,255,.55)',
    fieldBg: 'rgba(255,255,255,.07)', fieldBd: '1px solid rgba(255,255,255,.14)', fieldText: 'rgba(255,255,255,.85)',
    searchText: '#fff', searchPh: 'placeholder-white/40', icon: 'rgba(255,255,255,.45)',
    btnBg: 'linear-gradient(135deg,#c9a96a,#a87f3d)', btnText: '#1a1206', btnShadow: '0 4px 14px rgba(176,141,79,.35)',
    chipBd: '1px solid rgba(255,255,255,.16)', chipText: 'rgba(255,255,255,.7)',
    chipOnBg: '#c9a96a', chipOnBd: '1px solid #c9a96a', chipOnText: '#1a1206',
    colorScheme: 'dark' as const,
  } : {
    panel: 'linear-gradient(120deg,#FCFCFB 0%,#F3F2EF 70%,#EFEBE2 130%)', border: '#E3E1DB',
    glow: 'radial-gradient(circle,rgba(176,141,79,.14),transparent 70%)', kicker: '#b08d4f',
    title: '#1C2433', count: '#8B97A6',
    fieldBg: '#fff', fieldBd: '1px solid #E3E1DB', fieldText: '#3C4656',
    searchText: '#1C2433', searchPh: 'placeholder-gray-400', icon: '#8B97A6',
    btnBg: 'linear-gradient(135deg,#1C2433,#0F1722)', btnText: '#fff', btnShadow: '0 4px 14px rgba(28,36,51,.25)',
    chipBd: '1px solid #E1E4EA', chipText: '#5B6B7E',
    chipOnBg: '#1C2433', chipOnBd: '1px solid #1C2433', chipOnText: '#fff',
    colorScheme: 'light' as const,
  };
  const TL = isDark ? {
    scrim: 'linear-gradient(180deg, rgba(10,10,11,.06) 32%, rgba(10,10,11,.84) 80%, rgba(10,10,11,.94))',
    ink: '#fff', meta: 'rgba(255,255,255,.8)', code: 'rgba(255,255,255,.75)', gold: '#c9a96a',
    glass: { background: 'rgba(8,12,20,.55)', backdropFilter: 'blur(6px)', color: '#fff' } as any,
    availBg: 'rgba(22,101,52,.62)', hireBg: 'rgba(146,64,14,.62)', otherBg: 'rgba(8,12,20,.55)',
    chipText: '#fff', fallback: ASSET_FALLBACK, border: 'border-gray-200',
  } : {
    scrim: 'linear-gradient(180deg, rgba(255,255,255,0) 35%, rgba(255,255,255,.88) 75%, rgba(255,255,255,.96))',
    ink: '#1C2433', meta: '#5B6B7E', code: '#6A7077', gold: '#b08d4f',
    glass: { background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(6px)', color: '#1C2433', border: '1px solid rgba(0,0,0,.07)' } as any,
    availBg: '#E2F2E8', hireBg: '#F6E8D8', otherBg: 'rgba(255,255,255,.72)',
    chipText: '#1C2433', fallback: ASSET_FALLBACK_LIGHT, border: 'border-[#E3E1DB]',
  };
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setListError('');
    rentalApi.assets.list({ search: search || undefined, assetType: assetType || undefined, status: status || undefined, category: category || undefined, page, limit: 25 })
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch((e: any) => {
        const msg = e.response?.data?.message || e.message || 'Failed to load assets';
        setListError(Array.isArray(msg) ? msg.join(', ') : msg);
      })
      .finally(() => setLoading(false));
  }, [search, assetType, status, category, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { rentalApi.assets.expiryAlerts().then(r => setAlerts(r.data)).catch(() => {}); }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Marquee header — theme-aware, same language as the Film Slate ── */}
      <div className="relative rounded-[20px] overflow-hidden mb-6" style={{ background: MQ.panel, border: `1px solid ${MQ.border}`, color: MQ.title }}>
        <div aria-hidden className="absolute pointer-events-none" style={{ right: -60, top: -80, width: 300, height: 300, borderRadius: '50%', background: MQ.glow }} />
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-center gap-3.5">
            <div>
              <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.22em', color: MQ.kicker }}>The Film Makers · Fleet &amp; Equipment</div>
              <div className="text-[20px] font-extrabold leading-tight" style={{ color: MQ.title }}>Assets <span className="text-[11.5px] font-normal ml-1" style={{ color: MQ.count }}>{total} total</span></div>
            </div>
            <span className="flex-1" />
            <button onClick={() => setShowWizard(true)} className="rounded-xl px-4 py-2 text-[12.5px] font-bold cursor-pointer"
              style={{ background: MQ.btnBg, color: MQ.btnText, boxShadow: MQ.btnShadow }}>
              + Add Asset
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-xl px-3 py-2" style={{ background: MQ.fieldBg, border: MQ.fieldBd }}>
              <Search size={13} className="shrink-0" style={{ color: MQ.icon }} />
              <input className={`bg-transparent outline-none border-none text-[12.5px] flex-1 ${MQ.searchPh}`}
                style={{ color: MQ.searchText }}
                placeholder="Search by name, plate, serial, VIN…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="rounded-xl px-2.5 py-2 text-[12px] outline-none max-w-[170px]" style={{ background: MQ.fieldBg, border: MQ.fieldBd, color: MQ.fieldText, colorScheme: MQ.colorScheme }}
              value={assetType} onChange={e => { setAssetType(e.target.value); setPage(1); }}>
              <option value="">Type: All</option>
              {ALL_TYPES.map(t => <option key={t} value={t}>{ASSET_TYPE_LABELS[t] || t}</option>)}
            </select>
            <select className="rounded-xl px-2.5 py-2 text-[12px] outline-none" style={{ background: MQ.fieldBg, border: MQ.fieldBd, color: MQ.fieldText, colorScheme: MQ.colorScheme }}
              value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Status: All</option>
              <option value="AVAILABLE">Available</option>
              <option value="ON_HIRE">On Hire</option>
              <option value="IN_MAINTENANCE">In Maintenance</option>
              <option value="RESERVED">Reserved</option>
              <option value="RETIRED">Retired</option>
            </select>
            {view === 'tiles' && (
              <select className="rounded-xl px-2.5 py-2 text-[12px] outline-none" style={{ background: MQ.fieldBg, border: MQ.fieldBd, color: MQ.fieldText, colorScheme: MQ.colorScheme }}
                value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                <option value="type">Sort: Type</option>
                <option value="availability">Sort: Availability</option>
                <option value="name">Sort: Name</option>
              </select>
            )}
            <div className="inline-flex rounded-xl overflow-hidden" style={{ border: MQ.fieldBd }}>
              <button onClick={() => switchView('list')} className="px-3 py-2 text-[11.5px] font-semibold cursor-pointer"
                style={view === 'list' ? { background: MQ.chipOnBg, color: MQ.chipOnText } : { background: 'transparent', color: MQ.chipText }}>List</button>
              <button onClick={() => switchView('tiles')} className="px-3 py-2 text-[11.5px] font-semibold cursor-pointer"
                style={view === 'tiles' ? { background: MQ.chipOnBg, color: MQ.chipOnText } : { background: 'transparent', color: MQ.chipText }}>Tiles</button>
            </div>
            <button onClick={load} title="Refresh" className="rounded-xl p-2 cursor-pointer" style={{ border: MQ.fieldBd, color: MQ.count }}>
              <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[['', 'All'], ...CATEGORIES.map((c: any) => [c.value, c.label])].map(([val, label]) => (
              <button key={val || 'all'} onClick={() => { setCategory(val as string); setPage(1); }}
                className="rounded-full px-3 py-1 text-[11px] font-semibold cursor-pointer transition-colors"
                style={category === val
                  ? { background: MQ.chipOnBg, border: MQ.chipOnBd, color: MQ.chipOnText }
                  : { background: 'transparent', border: MQ.chipBd, color: MQ.chipText }}>
                {label}
              </button>
            ))}
          </div>
        </div>
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


      {/* ── Tiles view — cinematic cards (poster = tagged tile photo › first photo › gradient) ── */}
      {view === 'tiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...items].sort((a: any, b: any) => {
            if (sortBy === 'name') return String(a.name).localeCompare(String(b.name));
            if (sortBy === 'availability') return String(a.status).localeCompare(String(b.status)) || String(a.name).localeCompare(String(b.name));
            return String(a.assetType).localeCompare(String(b.assetType)) || String(a.name).localeCompare(String(b.name));
          }).map((item: any) => {
            const photo = item.tilePhoto || (item.photos || [])[0];
            const cat = item.category || categoryForType(item.assetType);
            const avail = item.status === 'AVAILABLE';
            const anyExpired = (item.registrationExpiry && new Date(item.registrationExpiry) < new Date())
              || (item.insuranceExpiry && new Date(item.insuranceExpiry) < new Date())
              || (item.warrantyExpiry && new Date(item.warrantyExpiry) < new Date());
            return (
              <Link key={item.id} href={`/rental/assets/${item.id}`}
                className={cn('group relative rounded-2xl overflow-hidden border min-h-[185px] flex flex-col justify-end shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all', TL.border)}
                style={{ color: TL.ink }}>
                <div aria-hidden style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: photo ? `url(${assetUrl(photo)})` : (TL.fallback[cat] || TL.fallback.OTHER),
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
                <div aria-hidden className="absolute inset-0" style={{ background: TL.scrim }} />
                <div className="absolute top-3 left-3">
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{ ...TL.glass, background: avail ? TL.availBg : item.status === 'ON_HIRE' ? TL.hireBg : TL.otherBg, color: TL.chipText }}>
                    {String(item.status).replace(/_/g, ' ')}
                  </span>
                </div>
                {anyExpired && <span className="absolute top-3 right-3 rounded-lg px-2 py-1 text-[10.5px] font-semibold" style={{ ...TL.glass, color: isDark ? '#FCD34D' : '#B45309' }}>⚠ compliance</span>}
                <div className="relative p-4">
                  <div className="text-[9.5px] tracking-[.08em] font-mono" style={{ color: TL.code }}>{item.plateNumber || item.serialNumber || item.vinNumber || ''}</div>
                  <div className="text-[13.5px] font-bold leading-tight" style={{ color: TL.ink, textShadow: isDark ? '0 1px 8px rgba(0,0,0,.4)' : 'none' }}>{item.name}</div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[.14em] mb-1" style={{ color: TL.gold }}>{ASSET_TYPE_LABELS[item.assetType] || item.assetType}</div>
                  <div className="flex gap-3 text-[10.5px]" style={{ color: TL.meta }}>
                    <span>{CATEGORIES.find(c => c.value === cat)?.label || cat}</span>
                    {item.condition && <span>{item.condition}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
          {items.length === 0 && !loading && (
            <div className="col-span-3 text-center py-16 text-gray-400 text-sm">No assets found. Click "Add Asset" to get started.</div>
          )}
        </div>
      )}

      {/* Table */}
      {view === 'list' && (
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
      )}

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
