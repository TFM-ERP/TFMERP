'use client';

import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import {
  Users as UsersIcon, Plus, Search, Edit2, X, Check,
  Mail, Building2, Loader2, KeyRound, UserCircle, ChevronRight,
} from 'lucide-react';
import EmailInput from '@/components/EmailInput';

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'System Administrator',
  FINANCE_MANAGER: 'Finance Manager',
  ACCOUNTANT: 'Accountant',
  RENTAL_MANAGER: 'Rental Manager',
  RENTAL_COORDINATOR: 'Rental Coordinator',
  DISPATCHER: 'Dispatcher',
  DRIVER: 'Driver',
  MAINTENANCE: 'Maintenance Staff',
  PRODUCTION_MANAGER: 'Production Manager',
  PRODUCTION_COORDINATOR: 'Production Coordinator',
  CREW: 'Crew',
  HR_MANAGER: 'HR Manager',
  SALES: 'Sales',
};
const ROLES = Object.keys(ROLE_LABELS);
const ACTIVITIES = ['BOTH', 'RENTAL', 'PRODUCTION'];

const empName = (e: any) => e?.displayName || `${e?.firstName || ''} ${e?.lastName || ''}`.trim();

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const loadUsers = () => {
    setLoading(true);
    usersApi.list(search || undefined)
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon size={22} /> User Accounts
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">System access for employees — personnel data lives in HR</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> New User Account
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9 w-full" placeholder="Search by name or email…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">User</th>
              <th className="table-th">Employee</th>
              <th className="table-th">Role</th>
              <th className="table-th">Access</th>
              <th className="table-th">Last Login</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No user accounts yet.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="table-row">
                <td className="table-td">
                  <div className="font-medium text-gray-900">{u.fullName}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1"><Mail size={11} /> {u.email}</div>
                </td>
                <td className="table-td text-sm text-gray-600">
                  {u.employee ? (
                    <span className="inline-flex items-center gap-1">
                      <UserCircle size={13} className="text-gray-400" />
                      {empName(u.employee)}
                      {u.employee.department && <span className="text-xs text-gray-400">· {u.employee.department}</span>}
                    </span>
                  ) : <span className="text-xs text-amber-600">Not linked</span>}
                </td>
                <td className="table-td"><span className="badge bg-indigo-50 text-indigo-700">{ROLE_LABELS[u.role] || u.role}</span></td>
                <td className="table-td">
                  {u.isActive
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Enabled</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><X size={12} /> Disabled</span>}
                </td>
                <td className="table-td text-xs text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                <td className="table-td text-right">
                  <button onClick={() => setEditing(u)} className="text-gray-400 hover:text-gray-700"><Edit2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); loadUsers(); }} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); loadUsers(); }} />}
    </div>
  );
}

// ── Create: select employee → grant access ──────────────────────────────────────
function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ email: '', password: '', role: 'ACCOUNTANT', activity: 'BOTH', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingEmp(true);
    const t = setTimeout(() => {
      usersApi.availableEmployees(search || undefined)
        .then(r => setEmployees(r.data))
        .catch(() => {})
        .finally(() => setLoadingEmp(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const pick = (emp: any) => {
    setSelected(emp);
    setForm(f => ({ ...f, email: emp.email || '' }));
    setStep(2);
  };

  const save = async () => {
    if (!form.password || form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true); setError('');
    try {
      await usersApi.create({
        employeeId: selected.id,
        email: form.email || undefined,
        password: form.password,
        role: form.role,
        activity: form.activity,
        isActive: form.isActive,
      });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create user account');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New User Account</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2 — {step === 1 ? 'Select Employee' : 'Access & Credentials'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {/* Step 1 — employee picker (no manual entry) */}
          {step === 1 && (
            <div>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 w-full" placeholder="Search employees by name, number, email…" autoFocus
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <p className="text-xs text-gray-400 mb-3">Only employees without an existing account are shown. Need someone new? Add them in HR → Employees first.</p>
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {loadingEmp ? (
                  <div className="text-center py-8 text-gray-400"><Loader2 className="animate-spin inline" size={18} /></div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No available employees found.</div>
                ) : employees.map(emp => (
                  <button key={emp.id} onClick={() => pick(emp)}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-semibold">
                        {empName(emp).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{empName(emp)}</div>
                        <div className="text-xs text-gray-400">
                          {[emp.position || emp.jobTitle, emp.department, emp.employeeNumber].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — access & credentials only (personnel data auto-filled, read-only) */}
          {step === 2 && selected && (
            <div className="space-y-5">
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Employee (from HR — read only)</p>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
                  <div><span className="text-gray-400 text-xs">Name</span><div className="text-gray-800">{empName(selected)}</div></div>
                  <div><span className="text-gray-400 text-xs">Position</span><div className="text-gray-800">{selected.position || selected.jobTitle || '—'}</div></div>
                  <div><span className="text-gray-400 text-xs">Department</span><div className="text-gray-800">{selected.department || '—'}</div></div>
                  <div><span className="text-gray-400 text-xs">Mobile</span><div className="text-gray-800">{selected.mobile || '—'}</div></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Login Credentials</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Login Email *</label>
                    <EmailInput className="input w-full" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="defaults to employee email" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Temporary Password *</label>
                    <input type="text" className="input w-full font-mono" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="min 8 characters" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Roles & Access</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Role</label>
                    <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Activity Scope</label>
                    <select className="input w-full" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}>
                      {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <label className="col-span-2 flex items-center gap-2 mt-1">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                    <span className="text-sm text-gray-600">Enable system access immediately</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
          <button onClick={step === 1 ? onClose : () => setStep(1)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100">
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step === 2 && (
            <button onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? 'Creating…' : 'Create User Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit: account-only fields ────────────────────────────────────────────────────
function EditUserModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    role: user.role, activity: user.activity, isActive: user.isActive, email: user.email, password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      await usersApi.update(user.id, {
        role: form.role,
        activity: form.activity,
        isActive: form.isActive,
        email: form.email,
        password: form.password || undefined,
      });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update user');
    } finally { setSaving(false); }
  };

  const empName2 = user.employee ? (user.employee.displayName || `${user.employee.firstName} ${user.employee.lastName || ''}`.trim()) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user.fullName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{empName2 || 'Account settings'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Building2 size={12} /> Name, department & contact details are managed in HR → Employees.
          </p>
          <div>
            <label className="label">Login Email</label>
            <EmailInput className="input w-full" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Activity Scope</label>
            <select className="input w-full" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}>
              {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1"><KeyRound size={12} /> Reset Password</label>
            <input type="text" className="input w-full font-mono" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="leave blank to keep current" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
            <span className="text-sm text-gray-600">System access enabled</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}
