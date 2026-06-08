'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { financeApi, approvalsApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import Link from 'next/link';
import { Plus, RefreshCw, CheckCircle, XCircle, DollarSign, GitBranch } from 'lucide-react';

const CATEGORIES = ['Fuel', 'Maintenance', 'Office', 'Crew', 'Catering', 'Equipment', 'Travel', 'Accommodation', 'Insurance', 'Legal', 'Marketing', 'Utilities', 'Other'];
const ACTIVITIES = ['RENTAL', 'PRODUCTION', 'BOTH'];

const STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED:         'bg-blue-100 text-blue-700',
  REJECTED:         'bg-red-100 text-red-600',
  PAID:             'bg-green-100 text-green-700',
};

export default function ExpensesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [form, setForm] = useState({
    category: 'Fuel',
    description: '',
    amount: '',
    vatAmount: '',
    activity: 'RENTAL',
    expenseDate: new Date().toISOString().slice(0, 10),
    vendorName: '',
    supplierId: '',
    supplierVatId: '',
    notes: '',
    projectRef: '',
    productionAccountCode: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      financeApi.expenses.list({ status: statusFilter || undefined, category: categoryFilter || undefined }),
      financeApi.expenses.summary(),
    ])
      .then(([er, sr]) => {
        setItems(er.data.items || []);
        setTotal(er.data.total || 0);
        setSummary(sr.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    financeApi.suppliers.list({ isActive: 'true' })
      .then(r => setSuppliers(r.data.items || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.description || !form.amount) { setError('Description and amount are required'); return; }
    setSaving(true); setError('');
    try {
      await financeApi.expenses.create({
        ...form,
        amount: Number(form.amount),
        vatAmount: Number(form.vatAmount) || 0,
        supplierId: form.supplierId || undefined,
        supplierVatId: form.supplierVatId || undefined,
      });
      setShowForm(false);
      setForm({ category: 'Fuel', description: '', amount: '', vatAmount: '', activity: 'RENTAL', expenseDate: new Date().toISOString().slice(0, 10), vendorName: '', supplierId: '', supplierVatId: '', notes: '', projectRef: '', productionAccountCode: '' });
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to submit expense');
    } finally { setSaving(false); }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'paid') => {
    if (action === 'approve') await financeApi.expenses.approve(id);
    else if (action === 'reject') await financeApi.expenses.reject(id);
    else await financeApi.expenses.markPaid(id);
    load();
  };

  const router = useRouter();
  const routeForApproval = async (id: string) => {
    await approvalsApi.routeExpense(id);
    router.push('/finance/approvals');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} records</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={14} className="mr-1" /> Log Expense
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Total Approved</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.total)}</p>
          </div>
          {(summary.byStatus || []).map((s: any) => (
            <div key={s.status} className="card">
              <p className="text-xs text-gray-400 mb-1">{s.status.replace(/_/g, ' ')}</p>
              <p className="text-base font-bold text-gray-800">{s._count.id} · {formatCurrency(s._sum.totalAmount || 0)}</p>
            </div>
          ))}
        </div>
      )}

      {/* New Expense Form */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Expense Claim</h3>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Activity</label>
              <select className="input w-full" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}>
                {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input w-full" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Description *</label>
              <input className="input w-full" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" />
            </div>
            <div>
              <label className="label">Supplier</label>
              <select className="input w-full" value={form.supplierId}
                onChange={e => {
                  const s = suppliers.find((x: any) => x.id === e.target.value);
                  setForm(f => ({
                    ...f,
                    supplierId: e.target.value,
                    vendorName: s?.name || f.vendorName,
                    supplierVatId: s?.vatId || s?.trn || f.supplierVatId,
                  }));
                }}>
                <option value="">— Select supplier or type below —</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}{s.trn ? ` (TRN: ${s.trn})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Vendor Name <span className="text-gray-400 font-normal">(if not in directory)</span></label>
              <input className="input w-full" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Supplier VAT ID / TRN</label>
              <input className="input w-full font-mono" value={form.supplierVatId}
                onChange={e => setForm(f => ({ ...f, supplierVatId: e.target.value }))}
                placeholder="Auto-filled from supplier directory" />
            </div>
            <div>
              <label className="label">Amount (AED) *</label>
              <input type="number" className="input w-full" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">VAT Amount (AED)</label>
              <input type="number" className="input w-full" value={form.vatAmount}
                onChange={e => setForm(f => ({ ...f, vatAmount: e.target.value }))}
                placeholder="0.00" />
            </div>
            <div>
              <label className="label">Project / Job Ref</label>
              <input className="input w-full" value={form.projectRef} onChange={e => setForm(f => ({ ...f, projectRef: e.target.value }))} placeholder="Production project ID (optional)" />
            </div>
            <div>
              <label className="label">Budget Account Code</label>
              <input className="input w-full font-mono" value={form.productionAccountCode} onChange={e => setForm(f => ({ ...f, productionAccountCode: e.target.value }))} placeholder="e.g. 2200 (optional)" />
            </div>
            <div className="col-span-3">
              <label className="label">Notes</label>
              <input className="input w-full" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? 'Submitting...' : 'Submit for Approval'}</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAID">Paid</option>
        </select>
        <select className="input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Ref</th>
              <th className="table-th">Date</th>
              <th className="table-th">Category</th>
              <th className="table-th">Description</th>
              <th className="table-th">Supplier / Vendor</th>
              <th className="table-th">Supplier VAT ID</th>
              <th className="table-th">Amount</th>
              <th className="table-th">VAT</th>
              <th className="table-th">Submitted By</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e: any) => (
              <tr key={e.id} className="table-row">
                <td className="table-td font-mono text-xs text-gray-400">{e.expenseNumber}</td>
                <td className="table-td text-sm text-gray-500">{formatDate(e.expenseDate)}</td>
                <td className="table-td"><span className="badge bg-gray-100 text-gray-600 text-xs">{e.category}</span></td>
                <td className="table-td text-sm text-gray-800 max-w-xs truncate">{e.description}</td>
                <td className="table-td text-xs text-gray-600">
                  {e.supplier ? (
                    <Link href={`/finance/suppliers/${e.supplier.id}`} className="hover:text-brand-600 font-medium">{e.supplier.name}</Link>
                  ) : e.vendorName || '—'}
                </td>
                <td className="table-td font-mono text-xs text-gray-400">{e.supplierVatId || e.supplier?.vatId || e.supplier?.trn || '—'}</td>
                <td className="table-td text-sm font-semibold">{formatCurrency(e.amount)}</td>
                <td className="table-td text-sm text-gray-500">{Number(e.vatAmount) > 0 ? formatCurrency(e.vatAmount) : '—'}</td>
                <td className="table-td text-xs text-gray-500">{e.createdBy?.fullName}</td>
                <td className="table-td">
                  <span className={cn('badge text-xs', STATUS_STYLE[e.status] || 'bg-gray-100 text-gray-500')}>
                    {e.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex gap-1 items-center">
                    {e.status === 'PENDING_APPROVAL' && (
                      <>
                        <button onClick={() => routeForApproval(e.id)} title="Route through approval chain" className="text-brand-600 hover:text-brand-700 text-xs font-medium inline-flex items-center gap-0.5"><GitBranch size={11} /> Route</button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => handleAction(e.id, 'approve')} className="text-green-600 hover:text-green-700 text-xs font-medium">Approve</button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => handleAction(e.id, 'reject')} className="text-red-500 hover:text-red-600 text-xs font-medium">Reject</button>
                      </>
                    )}
                    {e.status === 'APPROVED' && (
                      <button onClick={() => handleAction(e.id, 'paid')} className="text-blue-600 hover:text-blue-700 text-xs font-medium">Mark Paid</button>
                    )}
                    {(e.status === 'PAID' || e.status === 'REJECTED') && <span className="text-xs text-gray-300">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400">No expenses found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
