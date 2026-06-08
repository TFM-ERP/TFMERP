'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { hrApi } from '@/lib/api';
import { NATIONALITIES } from '@/lib/countries';
import {
  ArrowLeft, Save, Loader2, Edit2, Trash2, User, ShieldCheck,
  Wallet, FolderOpen, Package, Award, Car,
} from 'lucide-react';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

type TabKey = 'overview' | 'compliance' | 'payroll' | 'documents' | 'assets' | 'certifications' | 'driver';

const DEPARTMENTS = ['Administration','Finance','Accounting','Operations','Dispatch','Fleet','Maintenance','Logistics','Drivers','Production','Sales','Marketing','HR','Management'];
const EMP_TYPES = ['FullTime','PartTime','Freelancer','Contractor','Temporary','Consultant'];
const STATUSES = ['Active','OnLeave','Suspended','Resigned','Terminated','Retired'];

const empFullName = (e: any) => e?.displayName || `${e?.firstName || ''} ${e?.lastName || ''}`.trim();

function F({ label, k, form, set, type = 'text' }: any) {
  const isEmail = type === 'email' || /email/i.test(k);
  const isPhone = type !== 'number' && /phone|mobile|landline|whatsapp|fax|tel/i.test(k);
  return (
    <div>
      <label className="label">{label}</label>
      {isPhone
        ? <PhoneInput value={form[k] ?? ''} onChange={(v: string) => set(k, v)} />
        : isEmail
          ? <EmailInput className="input w-full" value={form[k] ?? ''} onChange={(e: any) => set(k, e.target.value)} />
          : <input type={type} className="input w-full" value={form[k] ?? ''}
              onChange={e => set(k, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
    </div>
  );
}
function S({ label, k, form, set, options }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input w-full" value={form[k] ?? ''} onChange={e => set(k, e.target.value)}>
        <option value="">—</option>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
// Searchable nationality field (world list, excludes Israel)
function Nat({ label, k, form, set }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <input list="nationality-options" className="input w-full" placeholder="Search nationality…"
        value={form[k] ?? ''} onChange={e => set(k, e.target.value)} />
      <datalist id="nationality-options">
        {NATIONALITIES.map((n: string) => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
}
function View({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value || '—'}</p>
    </div>
  );
}

const TABS: { id: TabKey; label: string; icon: any }[] = [
  { id: 'overview',       label: 'Overview',       icon: User },
  { id: 'compliance',     label: 'Compliance',     icon: ShieldCheck },
  { id: 'payroll',        label: 'Payroll',        icon: Wallet },
  { id: 'documents',      label: 'Documents',      icon: FolderOpen },
  { id: 'assets',         label: 'Assets',         icon: Package },
  { id: 'certifications', label: 'Certifications', icon: Award },
  { id: 'driver',         label: 'Driver',         icon: Car },
];

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [emp, setEmp] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => { setToast({ msg, error }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    hrApi.employees.get(id).then(r => { setEmp(r.data); setForm(r.data); }).catch(() => {});
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!emp) return <div className="p-8 text-gray-400 flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading…</div>;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const name = empFullName(emp);
  const allowances = (emp.housingAllowance||0)+(emp.transportAllowance||0)+(emp.foodAllowance||0)+(emp.mobileAllowance||0)+(emp.fuelAllowance||0)+(emp.otherAllowance||0);
  const gross = (emp.basicSalary||0)+allowances;

  const save = async () => {
    setSaving(true);
    try {
      await hrApi.employees.update(id, form);
      showToast('Employee saved');
      setEditing(false);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Save failed', true);
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (confirm(`Delete ${name}? This cannot be undone.`)) {
      await hrApi.employees.remove(id);
      router.push('/hr/employees');
    }
  };

  const addItem = async (kind: 'doc' | 'cert' | 'asset') => {
    if (kind === 'doc') {
      const title = prompt('Document title?'); if (!title) return;
      const type = prompt('Type (e.g. Visa, Passport)?') || '';
      const expiryDate = prompt('Expiry date (YYYY-MM-DD)?') || undefined;
      await hrApi.employees.addDocument(id, { title, type, expiryDate });
    } else if (kind === 'cert') {
      const cname = prompt('Certification name?'); if (!cname) return;
      const expiryDate = prompt('Expiry date (YYYY-MM-DD)?') || undefined;
      await hrApi.employees.addCertification(id, { name: cname, expiryDate });
    } else {
      const assetName = prompt('Asset name?'); if (!assetName) return;
      const assetType = prompt('Asset type?') || '';
      await hrApi.employees.assignAsset(id, { assetName, assetType, assignmentDate: new Date().toISOString() });
    }
    load();
  };

  const visibleTabs = TABS.filter(t => t.id !== 'driver' || emp.isDriver);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/hr/employees" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
            <p className="text-sm text-gray-400">
              {[emp.position || emp.jobTitle, emp.department, emp.employmentType].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {toast && <span className={`text-sm ${toast.error ? 'text-red-600' : 'text-green-600'}`}>{toast.msg}</span>}
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm(emp); }} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary text-sm disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="btn btn-primary text-sm"><Edit2 size={14} /> Edit</button>
              <button onClick={del} className="btn btn-secondary text-sm text-red-600"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Employee Information</h3>
          {editing ? (
            <div className="grid grid-cols-3 gap-4">
              <F label="First Name" k="firstName" form={form} set={set} />
              <F label="Middle Name" k="middleName" form={form} set={set} />
              <F label="Last Name" k="lastName" form={form} set={set} />
              <F label="Display Name" k="displayName" form={form} set={set} />
              <F label="Employee Number" k="employeeNumber" form={form} set={set} />
              <S label="Status" k="status" form={form} set={set} options={STATUSES} />
              <S label="Gender" k="gender" form={form} set={set} options={['Male','Female']} />
              <F label="Date of Birth" k="dateOfBirth" form={form} set={set} type="date" />
              <Nat label="Nationality" k="nationality" form={form} set={set} />{/* searchable */}
              <S label="Marital Status" k="maritalStatus" form={form} set={set} options={['Single','Married','Divorced','Widowed']} />
              <F label="Mobile" k="mobile" form={form} set={set} />
              <F label="WhatsApp" k="whatsapp" form={form} set={set} />
              <F label="Email" k="email" form={form} set={set} />
              <F label="Personal Email" k="personalEmail" form={form} set={set} />
              <F label="Home Address" k="homeAddress" form={form} set={set} />
              <S label="Department" k="department" form={form} set={set} options={DEPARTMENTS} />
              <F label="Position" k="position" form={form} set={set} />
              <F label="Job Title" k="jobTitle" form={form} set={set} />
              <S label="Employment Type" k="employmentType" form={form} set={set} options={EMP_TYPES} />
              <F label="Work Location" k="workLocation" form={form} set={set} />
              <F label="Joining Date" k="joiningDate" form={form} set={set} type="date" />
              <F label="Contract Start" k="contractStart" form={form} set={set} type="date" />
              <F label="Contract End" k="contractEnd" form={form} set={set} type="date" />
              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" checked={!!form.isDriver} onChange={e => set('isDriver', e.target.checked)} />
                <span className="text-sm text-gray-600">Is a driver</span>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-y-4 gap-x-6">
              <View label="Employee #" value={emp.employeeNumber} />
              <View label="Status" value={emp.status} />
              <View label="Gender" value={emp.gender} />
              <View label="Nationality" value={emp.nationality} />
              <View label="Date of Birth" value={emp.dateOfBirth?.slice(0,10)} />
              <View label="Marital Status" value={emp.maritalStatus} />
              <View label="Mobile" value={emp.mobile} />
              <View label="WhatsApp" value={emp.whatsapp} />
              <View label="Email" value={emp.email} />
              <View label="Department" value={emp.department} />
              <View label="Position" value={emp.position || emp.jobTitle} />
              <View label="Employment Type" value={emp.employmentType} />
              <View label="Joining Date" value={emp.joiningDate?.slice(0,10)} />
              <View label="Contract End" value={emp.contractEnd?.slice(0,10)} />
              <View label="Manager" value={emp.manager ? empFullName(emp.manager) : '—'} />
              <View label="Work Location" value={emp.workLocation} />
              <View label="Home Address" value={emp.homeAddress} />
            </div>
          )}
        </div>
      )}

      {/* ── Compliance ── */}
      {tab === 'compliance' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Identity & UAE Compliance</h3>
          {editing ? (
            <div className="grid grid-cols-3 gap-4">
              <F label="Emirates ID" k="emiratesId" form={form} set={set} />
              <F label="Emirates ID Expiry" k="emiratesIdExpiry" form={form} set={set} type="date" />
              <F label="Passport Number" k="passportNumber" form={form} set={set} />
              <F label="Passport Expiry" k="passportExpiry" form={form} set={set} type="date" />
              <F label="Visa Number" k="visaNumber" form={form} set={set} />
              <F label="Visa Expiry" k="visaExpiry" form={form} set={set} type="date" />
              <F label="Labour Card #" k="labourCardNumber" form={form} set={set} />
              <F label="Work Permit #" k="workPermitNumber" form={form} set={set} />
              <F label="Work Permit Expiry" k="workPermitExpiryDate" form={form} set={set} type="date" />
              <F label="Employment Card #" k="employmentCardNumber" form={form} set={set} />
              <F label="Employment Card Expiry" k="employmentCardExpiryDate" form={form} set={set} type="date" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-y-4 gap-x-6">
              <View label="Emirates ID" value={emp.emiratesId} />
              <View label="Emirates ID Expiry" value={emp.emiratesIdExpiry?.slice(0,10)} />
              <View label="Passport" value={emp.passportNumber} />
              <View label="Passport Expiry" value={emp.passportExpiry?.slice(0,10)} />
              <View label="Visa" value={emp.visaNumber} />
              <View label="Visa Expiry" value={emp.visaExpiry?.slice(0,10)} />
              <View label="Labour Card #" value={emp.labourCardNumber} />
              <View label="Work Permit #" value={emp.workPermitNumber} />
              <View label="Work Permit Expiry" value={emp.workPermitExpiryDate?.slice(0,10)} />
              <View label="Employment Card #" value={emp.employmentCardNumber} />
              <View label="Employment Card Expiry" value={emp.employmentCardExpiryDate?.slice(0,10)} />
            </div>
          )}
        </div>
      )}

      {/* ── Payroll ── */}
      {tab === 'payroll' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Payroll & Banking</h3>
          {editing ? (
            <div className="grid grid-cols-3 gap-4">
              <S label="Pay Structure" k="payStructure" form={form} set={set} options={['Monthly','Daily','Weekly','Hourly','Project']} />
              <F label="Basic Salary" k="basicSalary" form={form} set={set} type="number" />
              <F label="Housing Allowance" k="housingAllowance" form={form} set={set} type="number" />
              <F label="Transport Allowance" k="transportAllowance" form={form} set={set} type="number" />
              <F label="Food Allowance" k="foodAllowance" form={form} set={set} type="number" />
              <F label="Mobile Allowance" k="mobileAllowance" form={form} set={set} type="number" />
              <F label="Fuel Allowance" k="fuelAllowance" form={form} set={set} type="number" />
              <F label="Other Allowance" k="otherAllowance" form={form} set={set} type="number" />
              <F label="Daily Rate" k="dailyRate" form={form} set={set} type="number" />
              <F label="Hourly Rate" k="hourlyRate" form={form} set={set} type="number" />
              <F label="Bank Name" k="bankName" form={form} set={set} />
              <F label="Account Name" k="bankAccountName" form={form} set={set} />
              <F label="IBAN" k="iban" form={form} set={set} />
              <F label="Account Number" k="accountNumber" form={form} set={set} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-y-4 gap-x-6">
              <View label="Pay Structure" value={emp.payStructure} />
              <View label="Basic Salary" value={emp.basicSalary ? `AED ${emp.basicSalary.toLocaleString()}` : '—'} />
              <View label="Total Allowances" value={`AED ${allowances.toLocaleString()}`} />
              <View label="Gross (Monthly)" value={`AED ${gross.toLocaleString()}`} />
              <View label="Daily Rate" value={emp.dailyRate ? `AED ${emp.dailyRate.toLocaleString()}` : '—'} />
              <View label="Bank" value={emp.bankName} />
              <View label="IBAN" value={emp.iban} />
            </div>
          )}
        </div>
      )}

      {/* ── Documents / Certifications / Assets ── */}
      {tab === 'documents' && (
        <div className="card">
          <ListBlock title="Documents" items={emp.documents} onAdd={() => addItem('doc')}
            onRemove={(d: any) => hrApi.employees.removeDocument(d.id).then(load)}
            render={(d: any) => `${d.title}${d.type ? ` (${d.type})` : ''}${d.expiryDate ? ` · exp ${d.expiryDate.slice(0,10)}` : ''}`} />
        </div>
      )}
      {tab === 'certifications' && (
        <div className="card">
          <ListBlock title="Certifications" items={emp.certifications} onAdd={() => addItem('cert')}
            onRemove={(c: any) => hrApi.employees.removeCertification(c.id).then(load)}
            render={(c: any) => `${c.name}${c.expiryDate ? ` · exp ${c.expiryDate.slice(0,10)}` : ''}`} />
        </div>
      )}
      {tab === 'assets' && (
        <div className="card">
          <ListBlock title="Assigned Assets" items={emp.assets} onAdd={() => addItem('asset')} removeLabel="Return"
            onRemove={(a: any) => hrApi.employees.returnAsset(a.id).then(load)}
            render={(a: any) => `${a.assetName}${a.assetType ? ` (${a.assetType})` : ''} · ${a.status}`} />
        </div>
      )}

      {/* ── Driver ── */}
      {tab === 'driver' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Driver Profile</h3>
          {emp.driverProfile ? (
            <div className="grid grid-cols-3 gap-y-4 gap-x-6">
              <View label="Driver Type" value={emp.driverProfile.driverType} />
              <View label="License Number" value={emp.driverProfile.licenseNumber} />
              <View label="License Category" value={emp.driverProfile.licenseCategory} />
              <View label="License Expiry" value={emp.driverProfile.licenseExpiryDate?.slice(0,10)} />
              <View label="Status" value={emp.driverProfile.driverStatus} />
              <View label="Daily Rate" value={emp.driverProfile.dailyRate ? `AED ${emp.driverProfile.dailyRate.toLocaleString()}` : '—'} />
            </div>
          ) : <p className="text-sm text-gray-400">No driver profile.</p>}
        </div>
      )}
    </div>
  );
}

function ListBlock({ title, items, onAdd, onRemove, render, removeLabel = 'Delete' }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <button onClick={onAdd} className="btn btn-primary text-xs">+ Add</button>
      </div>
      <div className="space-y-2">
        {(items || []).map((it: any) => (
          <div key={it.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <span className="text-sm text-gray-700">{render(it)}</span>
            <button onClick={() => onRemove(it)} className="text-xs text-red-500 hover:text-red-700">{removeLabel}</button>
          </div>
        ))}
        {(!items || items.length === 0) && <p className="text-sm text-gray-400">Nothing here yet.</p>}
      </div>
    </div>
  );
}
