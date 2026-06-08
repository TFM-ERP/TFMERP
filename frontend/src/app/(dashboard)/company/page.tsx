'use client';

import { useEffect, useState, useCallback } from 'react';
import { companyApi, uploadFile } from '@/lib/api';
import {
  Save, Loader2, Building2, FileText, ShieldCheck, Percent,
  CreditCard, MapPin, FolderOpen, Palette, SlidersHorizontal,
} from 'lucide-react';
import {
  CLASSIFICATIONS, EMIRATES, MAINLAND_AUTHORITIES, FREE_ZONE_GROUPS,
  LICENSE_TYPES, LICENSE_STATUS, VAT_STATUS, CORPORATE_TAX_STATUS,
  DOCUMENT_TYPES, LOCATION_TYPES, showsMainland, showsFreeZone,
} from '@/lib/companyOptions';

type TabKey =
  | 'profile' | 'licensing' | 'regulatory' | 'tax'
  | 'banking' | 'locations' | 'documents' | 'branding' | 'preferences';

const TABS: { id: TabKey; label: string; icon: any }[] = [
  { id: 'profile',     label: 'Company Profile', icon: Building2 },
  { id: 'licensing',   label: 'Licensing',       icon: FileText },
  { id: 'regulatory',  label: 'Regulatory',      icon: ShieldCheck },
  { id: 'tax',         label: 'Tax',             icon: Percent },
  { id: 'banking',     label: 'Banking',         icon: CreditCard },
  { id: 'locations',   label: 'Locations',       icon: MapPin },
  { id: 'documents',   label: 'Documents',       icon: FolderOpen },
  { id: 'branding',    label: 'Branding',        icon: Palette },
  { id: 'preferences', label: 'Preferences',     icon: SlidersHorizontal },
];

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const fileSrc = (v?: string) => (!v ? '' : v.startsWith('http') ? v : `${apiBase.replace('/api/v1', '')}${v}`);

export default function CompanyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.get();
      setData(res.data);
    } catch {
      // ignore — backend may be warming up
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const save = async (section: string) => {
    setSaving(true);
    try {
      const res = await companyApi.update(data);
      setData(res.data);
      showToast(`${section} saved`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Save failed', true);
    } finally {
      setSaving(false);
    }
  };

  const cls = data?.classification;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
        <p className="text-gray-500 text-sm mt-0.5">Master legal record &amp; configuration for all ERP modules</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 border ${
          toast.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <span className={`w-2 h-2 rounded-full inline-block ${toast.error ? 'bg-red-500' : 'bg-green-500'}`} />
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading company profile…
        </div>
      ) : (
        <>
          {/* ── Company Profile ── */}
          {activeTab === 'profile' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Company Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="label">Legal Company Name *</label>
                  <input className="input w-full" value={data.legalName ?? ''} onChange={e => set('legalName', e.target.value)} />
                </div>
                <div>
                  <label className="label">Trade Name</label>
                  <input className="input w-full" value={data.tradeName ?? ''} onChange={e => set('tradeName', e.target.value)} />
                </div>
                <div>
                  <label className="label">Company Classification</label>
                  <select className="input w-full" value={data.classification ?? ''} onChange={e => set('classification', e.target.value)}>
                    <option value="">—</option>
                    {CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Registration Number</label>
                  <input className="input w-full" value={data.registrationNumber ?? ''} onChange={e => set('registrationNumber', e.target.value)} />
                </div>
                <div>
                  <label className="label">TRN / VAT Number</label>
                  <input className="input w-full" value={data.trn ?? ''} onChange={e => set('trn', e.target.value)} placeholder="100XXXXXXXXX00003" />
                </div>
                <div>
                  <label className="label">Corporate Tax Number</label>
                  <input className="input w-full" value={data.corporateTaxNumber ?? ''} onChange={e => set('corporateTaxNumber', e.target.value)} />
                </div>
                <div>
                  <label className="label">P.O. Box</label>
                  <input className="input w-full" value={data.poBox ?? ''} onChange={e => set('poBox', e.target.value)} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input className="input w-full" value={data.website ?? ''} onChange={e => set('website', e.target.value)} />
                </div>
                <div>
                  <label className="label">Main Email</label>
                  <input type="email" className="input w-full" value={data.mainEmail ?? ''} onChange={e => set('mainEmail', e.target.value)} />
                </div>
                <div>
                  <label className="label">Billing Email</label>
                  <input type="email" className="input w-full" value={data.billingEmail ?? ''} onChange={e => set('billingEmail', e.target.value)} />
                </div>
                <div>
                  <label className="label">Main Phone</label>
                  <input className="input w-full" value={data.mainPhone ?? ''} onChange={e => set('mainPhone', e.target.value)} placeholder="+971 4 XXX XXXX" />
                </div>
                <div>
                  <label className="label">Emergency Phone</label>
                  <input className="input w-full" value={data.emergencyPhone ?? ''} onChange={e => set('emergencyPhone', e.target.value)} />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input w-full" value={data.city ?? ''} onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <label className="label">Emirate</label>
                  <select className="input w-full" value={data.emirate ?? ''} onChange={e => set('emirate', e.target.value)}>
                    <option value="">—</option>
                    {EMIRATES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Country</label>
                  <input className="input w-full" value={data.country ?? ''} onChange={e => set('country', e.target.value)} />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <input className="input w-full" value={data.currency ?? ''} onChange={e => set('currency', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Physical Address</label>
                  <textarea className="input w-full" rows={2} value={data.address ?? ''} onChange={e => set('address', e.target.value)} />
                </div>
              </div>
              <SaveBar saving={saving} onClick={() => save('Company profile')} label="Save Company Profile" />
            </div>
          )}

          {/* ── Licensing ── */}
          {activeTab === 'licensing' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Licensing &amp; Registration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Licensing Authority</label>
                  {cls === 'FreeZone' ? (
                    <select className="input w-full" value={data.licensingAuthority ?? ''} onChange={e => set('licensingAuthority', e.target.value)}>
                      <option value="">—</option>
                      {FREE_ZONE_GROUPS.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <select className="input w-full" value={data.licensingAuthority ?? ''} onChange={e => set('licensingAuthority', e.target.value)}>
                      <option value="">—</option>
                      {MAINLAND_AUTHORITIES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="label">License Type</label>
                  <select className="input w-full" value={data.licenseType ?? ''} onChange={e => set('licenseType', e.target.value)}>
                    <option value="">—</option>
                    {LICENSE_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Business Activity</label>
                  <input className="input w-full" value={data.businessActivity ?? ''} onChange={e => set('businessActivity', e.target.value)} />
                </div>
                <div>
                  <label className="label">Trade License Number</label>
                  <input className="input w-full" value={data.tradeLicenseNumber ?? ''} onChange={e => set('tradeLicenseNumber', e.target.value)} />
                </div>
                <div>
                  <label className="label">Issue Date</label>
                  <input type="date" className="input w-full" value={data.licenseIssueDate?.slice(0, 10) ?? ''} onChange={e => set('licenseIssueDate', e.target.value)} />
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input type="date" className="input w-full" value={data.licenseExpiryDate?.slice(0, 10) ?? ''} onChange={e => set('licenseExpiryDate', e.target.value)} />
                </div>
                <div>
                  <label className="label">License Status</label>
                  <select className="input w-full" value={data.licenseStatus ?? ''} onChange={e => set('licenseStatus', e.target.value)}>
                    <option value="">—</option>
                    {LICENSE_STATUS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="col-span-2 text-xs text-gray-400">
                  Upload the Trade License, Certificate of Incorporation, registrations, renewals &amp; amendments under the
                  <button onClick={() => setActiveTab('documents')} className="mx-1 text-brand-700 underline">Documents</button>
                  tab — each requires a type selection.
                </div>
              </div>
              <SaveBar saving={saving} onClick={() => save('Licensing')} label="Save Licensing" />
            </div>
          )}

          {/* ── Regulatory ── */}
          {activeTab === 'regulatory' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">UAE Regulatory Information</h3>
              {showsMainland(cls) && (
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Mainland (MOHRE / Authorities)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">MOHRE Establishment Number</label><input className="input w-full" value={data.mohreEstablishmentNumber ?? ''} onChange={e => set('mohreEstablishmentNumber', e.target.value)} /></div>
                    <div><label className="label">Labour File Number</label><input className="input w-full" value={data.labourFileNumber ?? ''} onChange={e => set('labourFileNumber', e.target.value)} /></div>
                    <div><label className="label">Immigration Establishment Number</label><input className="input w-full" value={data.immigrationEstablishmentNumber ?? ''} onChange={e => set('immigrationEstablishmentNumber', e.target.value)} /></div>
                    <div><label className="label">Chamber of Commerce Number</label><input className="input w-full" value={data.chamberOfCommerceNumber ?? ''} onChange={e => set('chamberOfCommerceNumber', e.target.value)} /></div>
                    <div><label className="label">Economic Dept Registration</label><input className="input w-full" value={data.economicDeptRegistration ?? ''} onChange={e => set('economicDeptRegistration', e.target.value)} /></div>
                  </div>
                </div>
              )}
              {showsFreeZone(cls) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Free Zone</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Free Zone Authority</label>
                      <select className="input w-full" value={data.freeZoneAuthority ?? ''} onChange={e => set('freeZoneAuthority', e.target.value)}>
                        <option value="">—</option>
                        {FREE_ZONE_GROUPS.map(g => (
                          <optgroup key={g.group} label={g.group}>
                            {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div><label className="label">Registration Number</label><input className="input w-full" value={data.freeZoneRegistrationNumber ?? ''} onChange={e => set('freeZoneRegistrationNumber', e.target.value)} /></div>
                    <div><label className="label">Establishment Card Number</label><input className="input w-full" value={data.establishmentCardNumber ?? ''} onChange={e => set('establishmentCardNumber', e.target.value)} /></div>
                    <div><label className="label">Immigration File Number</label><input className="input w-full" value={data.immigrationFileNumber ?? ''} onChange={e => set('immigrationFileNumber', e.target.value)} /></div>
                  </div>
                </div>
              )}
              {!showsMainland(cls) && !showsFreeZone(cls) && (
                <p className="text-sm text-gray-400">Select a Company Classification on the Profile tab to see the relevant regulatory fields.</p>
              )}
              <SaveBar saving={saving} onClick={() => save('Regulatory info')} label="Save Regulatory Info" />
            </div>
          )}

          {/* ── Tax ── */}
          {activeTab === 'tax' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Tax Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">VAT Status</label>
                  <select className="input w-full" value={data.vatStatus ?? ''} onChange={e => set('vatStatus', e.target.value)}>
                    <option value="">—</option>
                    {VAT_STATUS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div><label className="label">VAT Registration Date</label><input type="date" className="input w-full" value={data.vatRegistrationDate?.slice(0, 10) ?? ''} onChange={e => set('vatRegistrationDate', e.target.value)} /></div>
                <div><label className="label">Default VAT Rate (%)</label><input type="number" className="input w-full" value={data.defaultVatRate ?? 5} onChange={e => set('defaultVatRate', Number(e.target.value))} /></div>
                <div>
                  <label className="label">Corporate Tax Status</label>
                  <select className="input w-full" value={data.corporateTaxStatus ?? ''} onChange={e => set('corporateTaxStatus', e.target.value)}>
                    <option value="">—</option>
                    {CORPORATE_TAX_STATUS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div><label className="label">Corporate Tax Reg. Date</label><input type="date" className="input w-full" value={data.corporateTaxRegistrationDate?.slice(0, 10) ?? ''} onChange={e => set('corporateTaxRegistrationDate', e.target.value)} /></div>
                <div><label className="label">Default Corporate Tax Rate (%)</label><input type="number" className="input w-full" value={data.defaultCorporateTaxRate ?? 9} onChange={e => set('defaultCorporateTaxRate', Number(e.target.value))} /></div>
              </div>
              <SaveBar saving={saving} onClick={() => save('Tax configuration')} label="Save Tax Configuration" />
            </div>
          )}

          {/* ── Banking ── */}
          {activeTab === 'banking' && (
            <div className="card">
              <BankingTab accounts={data.bankAccounts || []} reload={load} />
            </div>
          )}

          {/* ── Locations ── */}
          {activeTab === 'locations' && (
            <div className="card">
              <LocationsTab locations={data.locations || []} reload={load} />
            </div>
          )}

          {/* ── Documents ── */}
          {activeTab === 'documents' && (
            <div className="card">
              <DocumentsTab documents={data.documents || []} reload={load} />
            </div>
          )}

          {/* ── Branding ── */}
          {activeTab === 'branding' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Brand Assets</h3>
              <div className="grid grid-cols-2 gap-4">
                <ImageUpload label="Company Logo" value={data.logoUrl} onChange={(v) => set('logoUrl', v)} />
                <ImageUpload label="Invoice Logo" value={data.invoiceLogoUrl} onChange={(v) => set('invoiceLogoUrl', v)} />
                <ImageUpload label="Watermark" value={data.watermarkUrl} onChange={(v) => set('watermarkUrl', v)} />
                <ImageUpload label="Company Stamp" value={data.stampUrl} onChange={(v) => set('stampUrl', v)} />
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-4">Brand Colors</h3>
              <div className="grid grid-cols-3 gap-4">
                <ColorPicker label="Primary" value={data.brandPrimaryColor} onChange={(v) => set('brandPrimaryColor', v)} />
                <ColorPicker label="Secondary" value={data.brandSecondaryColor} onChange={(v) => set('brandSecondaryColor', v)} />
                <ColorPicker label="Accent" value={data.brandAccentColor} onChange={(v) => set('brandAccentColor', v)} />
              </div>

              <div className="mt-6">
                <label className="label">Email Signature</label>
                <textarea className="input w-full" rows={4} value={data.emailSignature ?? ''} onChange={e => set('emailSignature', e.target.value)} />
              </div>
              <SaveBar saving={saving} onClick={() => save('Branding')} label="Save Branding" />
            </div>
          )}

          {/* ── Preferences (system & document defaults — consolidated from Settings) ── */}
          {activeTab === 'preferences' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Regional &amp; Finance Defaults</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Default Currency</label>
                  <select className="input w-full" value={data.currency ?? 'AED'} onChange={e => set('currency', e.target.value)}>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="SAR">SAR — Saudi Riyal</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date Format</label>
                  <select className="input w-full" value={data.dateFormat ?? 'DD/MM/YYYY'} onChange={e => set('dateFormat', e.target.value)}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div><label className="label">Default VAT Rate (%)</label><input type="number" className="input w-full" value={data.defaultVatRate ?? 5} onChange={e => set('defaultVatRate', Number(e.target.value))} /></div>
                <div><label className="label">Default Payment Terms (days)</label><input type="number" className="input w-full" value={data.defaultPaymentTermDays ?? 30} onChange={e => set('defaultPaymentTermDays', Number(e.target.value))} /></div>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-4">Document Numbering</h3>
              <p className="text-xs text-gray-400 mb-3">Prefixes used when generating new documents across the system.</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Invoice Prefix</label><input className="input w-full" value={data.invoicePrefix ?? ''} onChange={e => set('invoicePrefix', e.target.value)} placeholder="INV" /></div>
                <div><label className="label">Quotation Prefix</label><input className="input w-full" value={data.quotationPrefix ?? ''} onChange={e => set('quotationPrefix', e.target.value)} placeholder="QT" /></div>
                <div><label className="label">Booking Prefix</label><input className="input w-full" value={data.bookingPrefix ?? ''} onChange={e => set('bookingPrefix', e.target.value)} placeholder="RB" /></div>
                <div><label className="label">Receipt Prefix</label><input className="input w-full" value={data.receiptPrefix ?? ''} onChange={e => set('receiptPrefix', e.target.value)} placeholder="RCP" /></div>
              </div>

              <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                These values feed Invoices, Quotations, Bookings and other modules. This is the single source of truth — the old Settings module has been merged here.
              </div>
              <SaveBar saving={saving} onClick={() => save('Preferences')} label="Save Preferences" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SaveBar({ saving, onClick, label }: { saving: boolean; onClick: () => void; label: string }) {
  return (
    <div className="mt-5 flex justify-end">
      <button onClick={onClick} disabled={saving} className="btn btn-primary disabled:opacity-50 flex items-center gap-1.5">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

function ImageUpload({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { const res = await uploadFile(file); onChange(res.url); }
    catch (err: any) { alert(err?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };
  const src = fileSrc(value);
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <label className="label">{label}</label>
      <div className="mt-1 flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
          {src ? <img src={src} alt={label} className="h-full w-full object-contain" /> : <span className="text-[10px] text-gray-400">None</span>}
        </div>
        <div className="flex-1">
          <label className="inline-block cursor-pointer btn btn-primary text-xs">
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handle} disabled={busy} />
          </label>
          {value && <button onClick={() => onChange('')} className="ml-2 text-xs text-red-500 hover:text-red-700">Remove</button>}
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  const v = value || '#000000';
  return (
    <div>
      <label className="label">{label}</label>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
        <input type="color" value={v} onChange={e => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
        <input type="text" value={value ?? ''} placeholder="#000000" onChange={e => onChange(e.target.value)} className="w-full text-sm outline-none bg-transparent" />
      </div>
    </div>
  );
}

// ── Banking ──────────────────────────────────────────────────────────────────
function BankingTab({ accounts, reload }: { accounts: any[]; reload: () => void }) {
  const [form, setForm] = useState<any>(null);
  const blank = { accountName: '', bankName: '', branch: '', accountNumber: '', iban: '', swift: '', currency: 'AED', isDefault: false };
  const save = async () => {
    if (form.id) await companyApi.bankAccounts.update(form.id, form);
    else await companyApi.bankAccounts.create(form);
    setForm(null); reload();
  };
  const remove = async (id: string) => { if (confirm('Delete this bank account?')) { await companyApi.bankAccounts.remove(id); reload(); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Company Bank Accounts</h3>
        <button onClick={() => setForm({ ...blank })} className="btn btn-primary text-xs">+ Add Bank Account</button>
      </div>
      <div className="space-y-2">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <div className="text-sm font-medium text-gray-800">{a.bankName} {a.isDefault && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">Default</span>}</div>
              <div className="text-xs text-gray-400">{a.accountName} · {a.iban || a.accountNumber} · {a.currency}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setForm(a)} className="text-xs text-gray-500 hover:text-gray-800">Edit</button>
              <button onClick={() => remove(a.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <p className="text-sm text-gray-400">No bank accounts yet.</p>}
      </div>
      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl p-6 w-[480px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{form.id ? 'Edit' : 'Add'} Bank Account</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Account Name</label><input className="input w-full" value={form.accountName ?? ''} onChange={e => setForm({ ...form, accountName: e.target.value })} /></div>
              <div><label className="label">Bank Name</label><input className="input w-full" value={form.bankName ?? ''} onChange={e => setForm({ ...form, bankName: e.target.value })} /></div>
              <div><label className="label">Branch</label><input className="input w-full" value={form.branch ?? ''} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
              <div><label className="label">Account Number</label><input className="input w-full" value={form.accountNumber ?? ''} onChange={e => setForm({ ...form, accountNumber: e.target.value })} /></div>
              <div><label className="label">IBAN</label><input className="input w-full" value={form.iban ?? ''} onChange={e => setForm({ ...form, iban: e.target.value })} /></div>
              <div><label className="label">SWIFT</label><input className="input w-full" value={form.swift ?? ''} onChange={e => setForm({ ...form, swift: e.target.value })} /></div>
              <div><label className="label">Currency</label><input className="input w-full" value={form.currency ?? ''} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
              <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={!!form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /><span className="text-sm text-gray-600">Default account</span></label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Locations ────────────────────────────────────────────────────────────────
function LocationsTab({ locations, reload }: { locations: any[]; reload: () => void }) {
  const [form, setForm] = useState<any>(null);
  const blank = { name: '', type: 'Head Office', address: '', googleMapsUrl: '', contactNumber: '', manager: '', notes: '' };
  const save = async () => {
    if (form.id) await companyApi.locations.update(form.id, form);
    else await companyApi.locations.create(form);
    setForm(null); reload();
  };
  const remove = async (id: string) => { if (confirm('Delete this location?')) { await companyApi.locations.remove(id); reload(); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Operational Locations</h3>
        <button onClick={() => setForm({ ...blank })} className="btn btn-primary text-xs">+ Add Location</button>
      </div>
      <div className="space-y-2">
        {locations.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <div className="text-sm font-medium text-gray-800">{l.name} <span className="ml-1 text-xs text-gray-400">({l.type})</span></div>
              <div className="text-xs text-gray-400">{l.address} {l.manager && `· ${l.manager}`}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setForm(l)} className="text-xs text-gray-500 hover:text-gray-800">Edit</button>
              <button onClick={() => remove(l.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        ))}
        {locations.length === 0 && <p className="text-sm text-gray-400">No locations yet.</p>}
      </div>
      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl p-6 w-[480px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{form.id ? 'Edit' : 'Add'} Location</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Name</label><input className="input w-full" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <label className="label">Type</label>
                <select className="input w-full" value={form.type ?? ''} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {LOCATION_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label className="label">Address</label><input className="input w-full" value={form.address ?? ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><label className="label">Google Maps URL</label><input className="input w-full" value={form.googleMapsUrl ?? ''} onChange={e => setForm({ ...form, googleMapsUrl: e.target.value })} /></div>
              <div><label className="label">Contact Number</label><input className="input w-full" value={form.contactNumber ?? ''} onChange={e => setForm({ ...form, contactNumber: e.target.value })} /></div>
              <div><label className="label">Manager</label><input className="input w-full" value={form.manager ?? ''} onChange={e => setForm({ ...form, manager: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Documents (type selection required) ──────────────────────────────────────
function DocumentsTab({ documents, reload }: { documents: any[]; reload: () => void }) {
  const [form, setForm] = useState<any>(null);
  const blank = { title: '', type: '', typeOther: '', fileUrl: '', issueDate: '', expiryDate: '', notes: '' };
  const resolvedType = (f: any) => (f.type === 'Other' ? (f.typeOther || 'Other') : f.type);

  const save = async () => {
    if (!form.type) { alert('Please select a document type.'); return; }
    if (form.type === 'Other' && !form.typeOther?.trim()) { alert('Please specify the document type.'); return; }
    const payload = {
      title: form.title || resolvedType(form), type: resolvedType(form),
      fileUrl: form.fileUrl, issueDate: form.issueDate, expiryDate: form.expiryDate, notes: form.notes,
    };
    if (form.id) await companyApi.documents.update(form.id, payload);
    else await companyApi.documents.create(payload);
    setForm(null); reload();
  };
  const remove = async (id: string) => { if (confirm('Delete this document?')) { await companyApi.documents.remove(id); reload(); } };
  const openEdit = (d: any) => {
    const known = DOCUMENT_TYPES.includes(d.type);
    setForm({ ...d, type: known ? d.type : 'Other', typeOther: known ? '' : d.type });
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const res = await uploadFile(file); setForm((f: any) => ({ ...f, fileUrl: res.url })); }
    catch (err: any) { alert(err?.message || 'Upload failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Company Documents</h3>
        <button onClick={() => setForm({ ...blank })} className="btn btn-primary text-xs">+ Add Document</button>
      </div>
      <div className="space-y-2">
        {documents.map((d) => {
          const expired = d.expiryDate && new Date(d.expiryDate) < new Date();
          return (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="text-sm font-medium text-gray-800">{d.title} <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{d.type}</span></div>
                <div className="text-xs text-gray-400">{d.expiryDate && <span className={expired ? 'text-red-600' : ''}>Expires {d.expiryDate.slice(0, 10)}</span>}</div>
              </div>
              <div className="flex gap-2">
                {d.fileUrl && <a href={fileSrc(d.fileUrl)} target="_blank" className="text-xs text-gray-500 hover:text-gray-800">View</a>}
                <button onClick={() => openEdit(d)} className="text-xs text-gray-500 hover:text-gray-800">Edit</button>
                <button onClick={() => remove(d.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            </div>
          );
        })}
        {documents.length === 0 && <p className="text-sm text-gray-400">No documents yet.</p>}
      </div>
      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl p-6 w-[480px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{form.id ? 'Edit' : 'Add'} Document</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Document Type *</label>
                <select className="input w-full" value={form.type ?? ''} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="">—</option>
                  {DOCUMENT_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {form.type === 'Other'
                ? <div><label className="label">Specify Type *</label><input className="input w-full" value={form.typeOther ?? ''} onChange={e => setForm({ ...form, typeOther: e.target.value })} /></div>
                : <div><label className="label">Title / Reference</label><input className="input w-full" value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>}
              <div className="col-span-2">
                <label className="label">Attachment</label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="cursor-pointer btn btn-primary text-xs">
                    {form.fileUrl ? 'Replace File' : 'Upload File'}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={upload} />
                  </label>
                  {form.fileUrl && <a href={fileSrc(form.fileUrl)} target="_blank" className="text-xs text-gray-500 underline">View current</a>}
                </div>
              </div>
              <div><label className="label">Issue Date</label><input type="date" className="input w-full" value={form.issueDate?.slice(0, 10) ?? ''} onChange={e => setForm({ ...form, issueDate: e.target.value })} /></div>
              <div><label className="label">Expiry Date</label><input type="date" className="input w-full" value={form.expiryDate?.slice(0, 10) ?? ''} onChange={e => setForm({ ...form, expiryDate: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
