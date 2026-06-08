'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { companyApi } from '@/lib/api';
import {
  CLASSIFICATIONS, EMIRATES, MAINLAND_AUTHORITIES, FREE_ZONE_GROUPS,
  LICENSE_TYPES, LICENSE_STATUS, VAT_STATUS, CORPORATE_TAX_STATUS,
} from '@/lib/companyOptions';

const STEPS = ['Company', 'Licensing', 'Tax', 'Review'];

function F({ label, k, form, set, type = 'text' }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input type={type} value={form[k] ?? ''} onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
    </label>
  );
}

function S({ label, k, form, set, options }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-slate-400 focus:outline-none">
        <option value="">—</option>
        {options.map((o: any) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </label>
  );
}

function GS({ label, k, form, set, groups }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-slate-400 focus:outline-none">
        <option value="">—</option>
        {groups.map((g: any) => (
          <optgroup key={g.group} label={g.group}>
            {g.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>({ classification: 'Mainland', defaultVatRate: 5, defaultCorporateTaxRate: 9, country: 'United Arab Emirates', currency: 'AED' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    companyApi.get().then((r) => {
      if (r.data?.setupComplete) { router.replace('/'); return; }
      setForm((f: any) => ({ ...f, ...r.data }));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  const finish = async () => {
    setSaving(true);
    try { await companyApi.completeSetup(form); router.replace('/'); }
    catch (e: any) { alert(e?.response?.data?.message || 'Error saving'); setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  const current = STEPS[step];
  const isFreeZone = form.classification === 'FreeZone';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Welcome — Let's set up your company</h1>
          <p className="text-sm text-slate-400">This is required before using the ERP. Step {step + 1} of {STEPS.length} — {current}</p>
        </div>

        <div className="flex gap-1 mb-6">
          {STEPS.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-slate-800' : 'bg-slate-200'}`} />)}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {current === 'Company' && (
            <div className="grid grid-cols-2 gap-4">
              <F label="Legal Company Name *" k="legalName" form={form} set={set} />
              <F label="Trade Name" k="tradeName" form={form} set={set} />
              <S label="Company Classification" k="classification" form={form} set={set} options={CLASSIFICATIONS} />
              <F label="Main Email" k="mainEmail" form={form} set={set} />
              <F label="Main Phone" k="mainPhone" form={form} set={set} />
              <F label="City" k="city" form={form} set={set} />
              <S label="Emirate" k="emirate" form={form} set={set} options={EMIRATES} />
              <F label="Currency" k="currency" form={form} set={set} />
            </div>
          )}

          {current === 'Licensing' && (
            <div className="grid grid-cols-2 gap-4">
              {isFreeZone
                ? <GS label="Licensing Authority" k="licensingAuthority" form={form} set={set} groups={FREE_ZONE_GROUPS} />
                : <S label="Licensing Authority" k="licensingAuthority" form={form} set={set} options={MAINLAND_AUTHORITIES} />}
              <S label="License Type" k="licenseType" form={form} set={set} options={LICENSE_TYPES} />
              <F label="Business Activity" k="businessActivity" form={form} set={set} />
              <F label="Trade License Number" k="tradeLicenseNumber" form={form} set={set} />
              <F label="License Issue Date" k="licenseIssueDate" form={form} set={set} type="date" />
              <F label="License Expiry Date" k="licenseExpiryDate" form={form} set={set} type="date" />
              <S label="License Status" k="licenseStatus" form={form} set={set} options={LICENSE_STATUS} />
              <F label="Registration Number" k="registrationNumber" form={form} set={set} />
              {isFreeZone && <F label="Establishment Card Number" k="establishmentCardNumber" form={form} set={set} />}
              {isFreeZone && <F label="Immigration File Number" k="immigrationFileNumber" form={form} set={set} />}
            </div>
          )}

          {current === 'Tax' && (
            <div className="grid grid-cols-2 gap-4">
              <F label="TRN / VAT Number" k="trn" form={form} set={set} />
              <S label="VAT Status" k="vatStatus" form={form} set={set} options={VAT_STATUS} />
              <F label="VAT Registration Date" k="vatRegistrationDate" form={form} set={set} type="date" />
              <F label="Default VAT Rate (%)" k="defaultVatRate" form={form} set={set} type="number" />
              <F label="Corporate Tax Number" k="corporateTaxNumber" form={form} set={set} />
              <S label="Corporate Tax Status" k="corporateTaxStatus" form={form} set={set} options={CORPORATE_TAX_STATUS} />
              <F label="Default Corporate Tax Rate (%)" k="defaultCorporateTaxRate" form={form} set={set} type="number" />
            </div>
          )}

          {current === 'Review' && (
            <div className="text-sm text-slate-600 space-y-1">
              <p><span className="text-slate-400">Company:</span> {form.legalName || '—'} ({form.classification})</p>
              <p><span className="text-slate-400">Authority:</span> {form.licensingAuthority || '—'}</p>
              <p><span className="text-slate-400">License:</span> {form.tradeLicenseNumber || '—'} · {form.licenseType || '—'} · {form.licenseStatus || '—'}</p>
              <p><span className="text-slate-400">TRN:</span> {form.trn || '—'} · VAT {form.defaultVatRate}% · CT {form.defaultCorporateTaxRate}%</p>
              <p className="text-slate-400 pt-2">Finish to unlock the ERP. You can edit everything later under Settings › Company Management.</p>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-lg px-4 py-2 text-sm text-slate-500 disabled:opacity-40">← Back</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={current === 'Company' && !form.legalName} className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">Next →</button>
          ) : (
            <button onClick={finish} disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Saving…' : 'Finish Setup'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
