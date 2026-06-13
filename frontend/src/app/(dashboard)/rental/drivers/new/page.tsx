'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Briefcase, UserCheck } from 'lucide-react';
import { rentalApi, hrApi } from '@/lib/api';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

export default function NewDriverPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);

  const [form, setForm] = useState<any>({
    driverType: 'EMPLOYEE',
    employeeId: '',
    fullName: '', mobile: '', email: '',
    licenseNumber: '', licenseClass: '', licenseExpiry: '',
    emiratesId: '', emiratesIdExpiry: '',
    passportNumber: '', passportExpiry: '',
    visaExpiry: '',
    dailyRate: '', weeklyRate: '',
    bankName: '', bankAccount: '', iban: '',
    notes: '',
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    hrApi.employees.list().then(r => setEmployees(r.data.items || r.data || [])).catch(() => {});
  }, []);

  const pickEmployee = (id: string) => {
    const e = employees.find((x: any) => x.id === id);
    if (!e) { set('employeeId', ''); return; }
    setForm((f: any) => ({
      ...f,
      employeeId: id,
      fullName: e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || f.fullName,
      mobile: e.mobile || e.phone || f.mobile,
      email: e.email || f.email,
      emiratesId: e.emiratesId || f.emiratesId,
      emiratesIdExpiry: e.emiratesIdExpiry ? String(e.emiratesIdExpiry).slice(0, 10) : f.emiratesIdExpiry,
      passportNumber: e.passportNumber || f.passportNumber,
      passportExpiry: e.passportExpiry ? String(e.passportExpiry).slice(0, 10) : f.passportExpiry,
      visaExpiry: e.visaExpiry ? String(e.visaExpiry).slice(0, 10) : f.visaExpiry,
    }));
  };

  const save = async () => {
    if (!form.fullName) { setError('Driver name is required'); return; }
    if (form.driverType === 'EMPLOYEE' && !form.employeeId) { setError('Select the employee for a direct-hire driver'); return; }
    setSaving(true); setError('');
    try {
      const res = await rentalApi.drivers.create({
        ...form,
        employeeId: form.driverType === 'EMPLOYEE' ? form.employeeId : undefined,
        dailyRate: form.dailyRate || undefined,
        weeklyRate: form.weeklyRate || undefined,
      });
      router.push(`/rental/drivers/${res.data.id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to add driver');
    } finally { setSaving(false); }
  };

  const isHire = form.driverType === 'EMPLOYEE';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/rental/drivers" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Driver</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Hire type */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { v: 'EMPLOYEE', label: 'Direct hire', desc: 'On staff — linked to an employee, paid via payroll', icon: UserCheck },
          { v: 'FREELANCE', label: 'Freelancer', desc: 'External — own rate card, paid per job via payout', icon: Briefcase },
        ].map(o => (
          <button key={o.v} onClick={() => set('driverType', o.v)}
            className={`text-left rounded-xl border p-4 transition-all ${form.driverType === o.v ? 'border-brand-400 ring-1 ring-brand-200 bg-brand-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
            <o.icon size={18} className={form.driverType === o.v ? 'text-brand-600' : 'text-gray-400'} />
            <div className="font-medium text-gray-900 mt-1.5">{o.label}</div>
            <div className="text-xs text-gray-500">{o.desc}</div>
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {isHire && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Link to employee *</h3>
            <select className="input w-full" value={form.employeeId} onChange={e => pickEmployee(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ')}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">Pulls their name, contact and documents. Salary is handled in payroll; per-job allowances/bonus push to payslips.</p>
          </div>
        )}

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Driver details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Full name *</label><input className="input w-full" value={form.fullName} onChange={e => set('fullName', e.target.value)} disabled={isHire && !!form.employeeId} /></div>
            <div><label className="label">Mobile</label><PhoneInput value={form.mobile || ''} onChange={(v) => set('mobile', v)} /></div>
            <div><label className="label">Email</label><EmailInput className="input w-full" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">License number</label><input className="input w-full" value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} /></div>
            <div><label className="label">License class</label><input className="input w-full" value={form.licenseClass} onChange={e => set('licenseClass', e.target.value)} placeholder="e.g. 3 (Light)" /></div>
            <div><label className="label">License expiry</label><input type="date" className="input w-full" value={form.licenseExpiry} onChange={e => set('licenseExpiry', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Identity documents</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Emirates ID</label><input className="input w-full" value={form.emiratesId} onChange={e => set('emiratesId', e.target.value)} /></div>
            <div><label className="label">Emirates ID expiry</label><input type="date" className="input w-full" value={form.emiratesIdExpiry} onChange={e => set('emiratesIdExpiry', e.target.value)} /></div>
            <div><label className="label">Passport number</label><input className="input w-full" value={form.passportNumber} onChange={e => set('passportNumber', e.target.value)} /></div>
            <div><label className="label">Passport expiry</label><input type="date" className="input w-full" value={form.passportExpiry} onChange={e => set('passportExpiry', e.target.value)} /></div>
            <div><label className="label">Visa expiry</label><input type="date" className="input w-full" value={form.visaExpiry} onChange={e => set('visaExpiry', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{isHire ? 'Job rate card (optional)' : 'Rate card & payment'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Daily rate (AED)</label><input type="number" className="input w-full" value={form.dailyRate} onChange={e => set('dailyRate', e.target.value)} /></div>
            <div><label className="label">Weekly rate (AED)</label><input type="number" className="input w-full" value={form.weeklyRate} onChange={e => set('weeklyRate', e.target.value)} /></div>
            {!isHire && <>
              <div><label className="label">Bank name</label><input className="input w-full" value={form.bankName} onChange={e => set('bankName', e.target.value)} /></div>
              <div><label className="label">Account name / no.</label><input className="input w-full" value={form.bankAccount} onChange={e => set('bankAccount', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">IBAN</label><input className="input w-full" value={form.iban} onChange={e => set('iban', e.target.value)} /></div>
            </>}
          </div>
          {isHire && <p className="text-xs text-gray-400 mt-2">Bank details and salary come from the employee/payroll record.</p>}
        </div>

        <div className="card">
          <label className="label">Notes</label>
          <textarea className="input w-full h-20 resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Add driver'}</button>
          <Link href="/rental/drivers" className="btn btn-secondary flex-1 justify-center">Cancel</Link>
        </div>
      </div>
    </div>
  );
}
