'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { hrApi } from '@/lib/api';
import { NATIONALITIES } from '@/lib/countries';

const DEPARTMENTS = [
  'Administration', 'Finance', 'Accounting', 'Operations', 'Dispatch', 'Fleet',
  'Maintenance', 'Logistics', 'Drivers', 'Production', 'Sales', 'Marketing', 'HR', 'Management',
];
const EMP_TYPES = ['FullTime', 'PartTime', 'Freelancer', 'Contractor', 'Temporary', 'Consultant'];
const STATUSES = ['Active', 'OnLeave', 'Suspended', 'Resigned', 'Terminated', 'Retired'];
const STEPS = ['Basic details', 'Contact', 'Employment', 'Identity & compliance', 'Payroll & banking', 'Driver details'];

function F({ label, k, form, set, type = 'text', span }: any) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="label">{label}</label>
      <input type={type} className="input w-full" value={form[k] ?? ''}
        onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)} />
    </div>
  );
}
function S({ label, k, form, set, options }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input w-full" value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
        <option value="">—</option>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Nat({ label, k, form, set }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <input list="nationality-options" className="input w-full" value={form[k] ?? ''} placeholder="Search nationality…"
        onChange={(e) => set(k, e.target.value)} />
      <datalist id="nationality-options">{NATIONALITIES.map((n: string) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState<any>({ status: 'Active', employmentType: 'FullTime', isDriver: false });
  const [step, setStep] = useState(0);
  const [id, setId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const visibleSteps = STEPS.filter((s) => s !== 'Driver details' || form.isDriver);
  const current = visibleSteps[step];
  const isLast = step === visibleSteps.length - 1;

  const payload = () => {
    const p: any = { ...form };
    if (form.isDriver) {
      p.driverProfile = {
        driverType: form.driverType || 'EmployeeDriver',
        licenseNumber: form.licenseNumber,
        licenseCategory: form.licenseCategory,
        licenseExpiryDate: form.licenseExpiryDate || undefined,
      };
    }
    return p;
  };

  // Persist current data; optionally advance or exit.
  const save = async (mode: 'continue' | 'later' | 'finish') => {
    if (!form.firstName) { setError('First name is required before saving'); setStep(0); return; }
    setSaving(true); setError('');
    try {
      let recId = id;
      if (!recId) { const res = await hrApi.employees.create(payload()); recId = res.data.id; setId(recId); }
      else { await hrApi.employees.update(recId, payload()); }
      if (mode === 'continue') setStep((s) => Math.min(visibleSteps.length - 1, s + 1));
      else router.push(`/hr/employees/${recId}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error saving employee');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/hr/employees" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{id ? 'Edit Employee' : 'New Employee'}</h1>
          <p className="text-sm text-gray-500">Step {step + 1} of {visibleSteps.length} — {current}{id ? ' · saved' : ''}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-5">
        {visibleSteps.map((s, i) => (
          <div key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? '#0f172a' : '#e5e7eb' }} title={s} />
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{current}</h3>

        {current === 'Basic details' && (
          <div className="grid grid-cols-2 gap-4">
            <F label="First name *" k="firstName" form={form} set={set} />
            <F label="Middle name" k="middleName" form={form} set={set} />
            <F label="Last name" k="lastName" form={form} set={set} />
            <F label="Display name" k="displayName" form={form} set={set} />
            <F label="Employee number" k="employeeNumber" form={form} set={set} />
            <S label="Gender" k="gender" form={form} set={set} options={['Male', 'Female']} />
            <F label="Date of birth" k="dateOfBirth" form={form} set={set} type="date" />
            <Nat label="Nationality" k="nationality" form={form} set={set} />
            <S label="Marital status" k="maritalStatus" form={form} set={set} options={['Single', 'Married', 'Divorced', 'Widowed']} />
            <S label="Status" k="status" form={form} set={set} options={STATUSES} />
          </div>
        )}

        {current === 'Contact' && (
          <div className="grid grid-cols-2 gap-4">
            <F label="Mobile" k="mobile" form={form} set={set} />
            <F label="WhatsApp" k="whatsapp" form={form} set={set} />
            <F label="Email" k="email" form={form} set={set} />
            <F label="Personal email" k="personalEmail" form={form} set={set} />
            <F label="Home address" k="homeAddress" form={form} set={set} span />
            <F label="Emergency contact name" k="emergencyContactName" form={form} set={set} />
            <F label="Emergency contact number" k="emergencyContactNumber" form={form} set={set} />
            <F label="Emergency relationship" k="emergencyContactRelationship" form={form} set={set} />
          </div>
        )}

        {current === 'Employment' && (
          <div className="grid grid-cols-2 gap-4">
            <S label="Department" k="department" form={form} set={set} options={DEPARTMENTS} />
            <F label="Position" k="position" form={form} set={set} />
            <F label="Job title" k="jobTitle" form={form} set={set} />
            <F label="Grade" k="grade" form={form} set={set} />
            <S label="Employment type" k="employmentType" form={form} set={set} options={EMP_TYPES} />
            <F label="Work location" k="workLocation" form={form} set={set} />
            <F label="Joining date" k="joiningDate" form={form} set={set} type="date" />
            <F label="Probation end" k="probationEnd" form={form} set={set} type="date" />
            <F label="Contract start" k="contractStart" form={form} set={set} type="date" />
            <F label="Contract end" k="contractEnd" form={form} set={set} type="date" />
            <label className="col-span-2 flex items-center gap-2 mt-1 cursor-pointer">
              <input type="checkbox" checked={!!form.isDriver} onChange={(e) => set('isDriver', e.target.checked)} />
              <span className="text-sm text-gray-700">This employee is also a driver</span>
            </label>
          </div>
        )}

        {current === 'Identity & compliance' && (
          <div className="grid grid-cols-2 gap-4">
            <F label="Emirates ID" k="emiratesId" form={form} set={set} />
            <F label="Emirates ID expiry" k="emiratesIdExpiry" form={form} set={set} type="date" />
            <F label="Passport number" k="passportNumber" form={form} set={set} />
            <F label="Passport expiry" k="passportExpiry" form={form} set={set} type="date" />
            <F label="Visa number" k="visaNumber" form={form} set={set} />
            <F label="Visa expiry" k="visaExpiry" form={form} set={set} type="date" />
            <F label="Labour card number (Mainland)" k="labourCardNumber" form={form} set={set} />
            <F label="Work permit number" k="workPermitNumber" form={form} set={set} />
            <F label="Work permit expiry" k="workPermitExpiryDate" form={form} set={set} type="date" />
            <F label="Employment card number (Free Zone)" k="employmentCardNumber" form={form} set={set} />
            <F label="Employment card expiry" k="employmentCardExpiryDate" form={form} set={set} type="date" />
          </div>
        )}

        {current === 'Payroll & banking' && (
          <div className="grid grid-cols-2 gap-4">
            <S label="Pay structure" k="payStructure" form={form} set={set} options={['Monthly', 'Daily', 'Weekly', 'Hourly', 'Project']} />
            <F label="Basic salary" k="basicSalary" form={form} set={set} type="number" />
            <F label="Housing allowance" k="housingAllowance" form={form} set={set} type="number" />
            <F label="Transport allowance" k="transportAllowance" form={form} set={set} type="number" />
            <F label="Food allowance" k="foodAllowance" form={form} set={set} type="number" />
            <F label="Mobile allowance" k="mobileAllowance" form={form} set={set} type="number" />
            <F label="Fuel allowance" k="fuelAllowance" form={form} set={set} type="number" />
            <F label="Other allowance" k="otherAllowance" form={form} set={set} type="number" />
            <F label="Daily rate" k="dailyRate" form={form} set={set} type="number" />
            <F label="Hourly rate" k="hourlyRate" form={form} set={set} type="number" />
            <F label="Bank name" k="bankName" form={form} set={set} />
            <F label="Account name" k="bankAccountName" form={form} set={set} />
            <F label="IBAN" k="iban" form={form} set={set} />
            <F label="Account number" k="accountNumber" form={form} set={set} />
            <F label="SWIFT" k="swift" form={form} set={set} />
          </div>
        )}

        {current === 'Driver details' && (
          <div className="grid grid-cols-2 gap-4">
            <S label="Driver type" k="driverType" form={form} set={set} options={['EmployeeDriver', 'FreelanceDriver']} />
            <F label="License number" k="licenseNumber" form={form} set={set} />
            <F label="License category" k="licenseCategory" form={form} set={set} />
            <F label="License expiry" k="licenseExpiryDate" form={form} set={set} type="date" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-5">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}
          className="btn btn-secondary disabled:opacity-40">← Back</button>
        <div className="flex gap-2">
          <button onClick={() => save('later')} disabled={saving} className="btn btn-secondary">
            {saving ? 'Saving…' : 'Save & finish later'}
          </button>
          {isLast ? (
            <button onClick={() => save('finish')} disabled={saving} className="btn btn-primary"><Check size={14} /> {saving ? 'Saving…' : 'Save & done'}</button>
          ) : (
            <button onClick={() => save('continue')} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save & continue →'}</button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">Tip: after Basic details you can <b>Save &amp; finish later</b> — the employee is created and you can complete the rest anytime from their profile.</p>
    </div>
  );
}
