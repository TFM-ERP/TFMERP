'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { hrApi } from '@/lib/api';
import { Search, Plus, Users as UsersIcon } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  OnLeave: 'bg-amber-100 text-amber-700',
  Suspended: 'bg-orange-100 text-orange-700',
  Resigned: 'bg-gray-100 text-gray-600',
  Terminated: 'bg-red-100 text-red-700',
  Retired: 'bg-gray-100 text-gray-600',
};

const empName = (e: any) => e.displayName || `${e.firstName} ${e.lastName || ''}`.trim();

export default function EmployeesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dept, setDept] = useState('');

  const load = () => {
    hrApi.employees
      .list({ search: search || undefined, status: status || undefined, department: dept || undefined })
      .then((r) => setRows(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, status, dept]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon size={22} /> Employees
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{rows.length} employees</p>
        </div>
        <Link href="/hr/employees/new" className="btn btn-primary">
          <Plus size={14} className="mr-1" /> New Employee
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search name, number, email…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="input w-44" placeholder="Department" value={dept} onChange={(e) => setDept(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">Employee #</th>
              <th className="table-th">Department</th>
              <th className="table-th">Position</th>
              <th className="table-th">Type</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="table-row">
                <td className="table-td">
                  <Link href={`/hr/employees/${e.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                    {empName(e)}
                  </Link>
                  {e.isDriver && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">Driver</span>}
                </td>
                <td className="table-td text-sm text-gray-500">{e.employeeNumber || '—'}</td>
                <td className="table-td text-sm text-gray-500">{e.department || '—'}</td>
                <td className="table-td text-sm text-gray-500">{e.position || e.jobTitle || '—'}</td>
                <td className="table-td text-sm text-gray-500">{e.employmentType}</td>
                <td className="table-td">
                  <span className={`badge ${STATUS_COLORS[e.status] || 'bg-gray-100 text-gray-600'}`}>{e.status}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No employees found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
