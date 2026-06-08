'use client';

import { useEffect, useState } from 'react';
import { Save, RotateCcw, FileText, Receipt, Palette, ChevronUp, ChevronDown } from 'lucide-react';
import { settingsApi, companyApi } from '@/lib/api';
import DocumentLayout, {
  DEFAULT_DOC_SETTINGS, DocumentSettings,
  ALL_SECTIONS, SECTION_LABELS, COLUMN_DEFS, SectionKey, ColumnSetting,
} from '@/components/finance/DocumentLayout';

/* ── Sample data for the live preview ── */
const SAMPLE_BANK = {
  accountName: 'The Film Makers FZ LLC', accountNumber: '0123456789012',
  iban: 'AE12 3456 7890 1234 5678 901', bankName: 'Abu Dhabi Commercial Bank',
  swiftCode: 'ADCBAEAA', branch: 'Dubai Main', currency: 'AED',
};
const SAMPLE_CLIENT = {
  companyName: 'Sample Client Productions LLC', billingAddress: 'Office 1204, Business Bay Tower',
  city: 'Dubai', country: 'UAE', trn: '100123456700003',
};
const SAMPLE_ITEMS = [
  { id: 1, description: 'Star Trailer — 2 Axle with A/C', details: 'Full setup with generator connection', quantity: 2, days: 5, unitPrice: 1500, lineTotal: 15000, taxAmount: 750 },
  { id: 2, description: 'Base Camp Supervisor', details: '', quantity: 1, days: 5, unitPrice: 800, lineTotal: 4000, taxAmount: 200 },
];
const today = new Date();
const plus = (d: number) => new Date(today.getTime() + d * 86400000);
const SAMPLE_INVOICE = {
  invoiceNumber: 'INV-2026-0001', invoiceType: 'TAX_INVOICE', status: 'SENT', currency: 'AED',
  issueDate: today, dueDate: plus(30), client: SAMPLE_CLIENT, items: SAMPLE_ITEMS,
  subtotal: 19000, discountAmount: 0, deductionAmount: 500, deductionReason: 'Goodwill', vatAmount: 925,
  total: 19425, amountPaid: 0, amountDue: 19425, notes: 'Thank you for your business.',
};
const SAMPLE_QUOTATION = {
  quotationNumber: 'QT-2026-0001', status: 'SENT', currency: 'AED',
  issueDate: today, validUntil: plus(30), subject: 'Base Camp Package — Desert Shoot', client: SAMPLE_CLIENT, items: SAMPLE_ITEMS,
  subtotal: 19000, discountAmount: 0, deductionAmount: 500, deductionReason: 'Goodwill', vatAmount: 925, total: 19425,
};

const FONTS = [
  'Arial, Helvetica, sans-serif', 'Helvetica, Arial, sans-serif', 'Georgia, serif',
  '"Times New Roman", Times, serif', '"Trebuchet MS", sans-serif', 'Verdana, sans-serif',
  'Tahoma, sans-serif', '"Courier New", monospace',
];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}

function move<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const a = [...arr]; const j = idx + dir;
  if (j < 0 || j >= a.length) return a;
  [a[idx], a[j]] = [a[j], a[idx]];
  return a;
}

export default function ReportDesignerPage() {
  const [co, setCo] = useState<any>(null);
  const [s, setS] = useState<DocumentSettings>(DEFAULT_DOC_SETTINGS);
  const [preview, setPreview] = useState<'invoice' | 'quotation'>('invoice');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    settingsApi.get().then(r => {
      setCo(r.data);
      const saved = r.data?.documentSettings || {};
      setS({
        ...DEFAULT_DOC_SETTINGS,
        ...saved,
        // ensure arrays are present & complete
        sectionOrder: (saved.sectionOrder?.length ? saved.sectionOrder : DEFAULT_DOC_SETTINGS.sectionOrder)
          .filter((k: SectionKey) => ALL_SECTIONS.includes(k)),
        columns: (saved.columns?.length ? saved.columns : DEFAULT_DOC_SETTINGS.columns),
      });
    }).finally(() => setLoading(false));
  }, []);

  const set = (k: keyof DocumentSettings, v: any) => setS(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true); setSavedMsg('');
    try {
      // preserve any GrapesJS templates already stored
      const current = (await companyApi.get()).data?.documentSettings || {};
      const documentSettings = { ...current, ...s };
      await companyApi.update({ documentSettings });
      setSavedMsg('Saved — applies to all invoices & quotations.');
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (e: any) {
      setSavedMsg(e.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const reset = () => setS(DEFAULT_DOC_SETTINGS);

  if (loading) return <div className="p-6"><div className="card h-64 animate-pulse bg-gray-50" /></div>;

  const sampleDoc = preview === 'invoice' ? SAMPLE_INVOICE : SAMPLE_QUOTATION;
  const sectionOrder = (s.sectionOrder && s.sectionOrder.length ? s.sectionOrder : DEFAULT_DOC_SETTINGS.sectionOrder) as SectionKey[];
  const columns = (s.columns && s.columns.length ? s.columns : DEFAULT_DOC_SETTINGS.columns) as ColumnSetting[];

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Palette size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Report Designer</h1>
            <p className="text-sm text-gray-500">Structured layout controls with live preview — applies to every invoice & quotation.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
          <button onClick={reset} className="btn-secondary"><RotateCcw size={14} /> Reset</button>
          <button onClick={save} disabled={saving} className="btn-primary"><Save size={14} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* ── Controls ── */}
        <div className="space-y-4">
          {/* Branding & page */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">Branding & Page</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Accent color</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-10 rounded border border-gray-200" value={s.accentColor} onChange={e => set('accentColor', e.target.value)} />
                  <input className="input text-xs" value={s.accentColor} onChange={e => set('accentColor', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Heading color</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-10 rounded border border-gray-200" value={s.navyColor} onChange={e => set('navyColor', e.target.value)} />
                  <input className="input text-xs" value={s.navyColor} onChange={e => set('navyColor', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Font</label>
                <select className="input text-xs" value={s.fontFamily} onChange={e => set('fontFamily', e.target.value)}>
                  {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/"/g, '')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Base font size (px)</label>
                <input type="number" min={7} max={14} step={0.5} className="input" value={s.baseFontSize} onChange={e => set('baseFontSize', parseFloat(e.target.value) || 9.5)} />
              </div>
              <div>
                <label className="label">Page margin X (px)</label>
                <input type="number" min={0} max={80} className="input" value={s.pageMarginX} onChange={e => set('pageMarginX', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="label">Page margin Y (px)</label>
                <input type="number" min={0} max={80} className="input" value={s.pageMarginY} onChange={e => set('pageMarginY', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="label">Logo position</label>
                <select className="input" value={s.logoPosition} onChange={e => set('logoPosition', e.target.value)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="label">Logo height (px)</label>
                <input type="number" min={20} max={120} className="input" value={s.logoHeight} onChange={e => set('logoHeight', parseInt(e.target.value) || 48)} />
              </div>
            </div>
            <Toggle label="Show logo" checked={!!s.showLogo} onChange={v => set('showLogo', v)} />
          </div>

          {/* Titles */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">Document Titles</h2>
            <div><label className="label">Invoice title</label><input className="input" value={s.invoiceTitle} onChange={e => set('invoiceTitle', e.target.value)} /></div>
            <div><label className="label">Quotation title</label><input className="input" value={s.quotationTitle} onChange={e => set('quotationTitle', e.target.value)} /></div>
          </div>

          {/* Section order */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2 mb-2">Section Order</h2>
            <p className="text-[11px] text-gray-400 mb-2">Reorder how sections stack on the page. Bank & signature can also be hidden.</p>
            <div className="space-y-1">
              {sectionOrder.map((key, i) => (
                <div key={key} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                  <span className="text-sm text-gray-700">{SECTION_LABELS[key]}</span>
                  <div className="flex items-center gap-1">
                    {key === 'bank' && <input type="checkbox" title="Show" checked={!!s.showBankBlock} onChange={e => set('showBankBlock', e.target.checked)} />}
                    {key === 'signature' && <input type="checkbox" title="Show" checked={!!s.showSignature} onChange={e => set('showSignature', e.target.checked)} />}
                    <button className="p-1 rounded hover:bg-gray-200 disabled:opacity-30" disabled={i === 0} onClick={() => set('sectionOrder', move(sectionOrder, i, -1))}><ChevronUp size={14} /></button>
                    <button className="p-1 rounded hover:bg-gray-200 disabled:opacity-30" disabled={i === sectionOrder.length - 1} onClick={() => set('sectionOrder', move(sectionOrder, i, 1))}><ChevronDown size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2 mb-2">Line-item Columns</h2>
            <p className="text-[11px] text-gray-400 mb-2">Reorder, show/hide, and set width (e.g. 12% or 80px). Blank width = auto.</p>
            <div className="space-y-1">
              {columns.map((col, i) => {
                const def = COLUMN_DEFS.find(d => d.key === col.key)!;
                return (
                  <div key={col.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                    <input type="checkbox" checked={col.show} onChange={e => {
                      const next = columns.map(c => c.key === col.key ? { ...c, show: e.target.checked } : c);
                      set('columns', next);
                    }} />
                    <span className="text-sm text-gray-700 flex-1">{def.label}</span>
                    <input className="input text-xs w-16 py-1" placeholder="auto" value={col.width ?? ''} onChange={e => {
                      const next = columns.map(c => c.key === col.key ? { ...c, width: e.target.value } : c);
                      set('columns', next);
                    }} />
                    <button className="p-1 rounded hover:bg-gray-200 disabled:opacity-30" disabled={i === 0} onClick={() => set('columns', move(columns, i, -1))}><ChevronUp size={14} /></button>
                    <button className="p-1 rounded hover:bg-gray-200 disabled:opacity-30" disabled={i === columns.length - 1} onClick={() => set('columns', move(columns, i, 1))}><ChevronDown size={14} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footers */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">Footer Text</h2>
            <div><label className="label">Invoice footer</label><textarea className="input h-20 resize-none text-xs" value={s.invoiceFooter} onChange={e => set('invoiceFooter', e.target.value)} /></div>
            <div><label className="label">Quotation footer</label><textarea className="input h-20 resize-none text-xs" value={s.quotationFooter} onChange={e => set('quotationFooter', e.target.value)} /></div>
          </div>
        </div>

        {/* ── Live preview ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setPreview('invoice')} className={`btn-secondary ${preview === 'invoice' ? 'bg-brand-50 text-brand-700 border-brand-200' : ''}`}><Receipt size={14} /> Invoice</button>
            <button onClick={() => setPreview('quotation')} className={`btn-secondary ${preview === 'quotation' ? 'bg-brand-50 text-brand-700 border-brand-200' : ''}`}><FileText size={14} /> Quotation</button>
            <span className="text-xs text-gray-400 ml-2">Live preview — sample data</span>
          </div>
          <div className="bg-gray-100 rounded-xl p-4 border border-gray-200 overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <div style={{ width: 794, margin: '0 auto', boxShadow: '0 2px 16px rgba(0,0,0,0.12)' }}>
              <DocumentLayout type={preview} doc={sampleDoc} company={co} bank={SAMPLE_BANK} settings={s} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
