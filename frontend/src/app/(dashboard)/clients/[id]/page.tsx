'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientsApi, uploadFile } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, Ban, CheckCircle2, FileText, Receipt, CreditCard, Loader2,
  Edit2, Save, Trash2, Upload, User, Building2,
} from 'lucide-react';
import ContactPicker from '@/components/ContactPicker';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  BLOCKED: 'bg-red-100 text-red-700',
};
const DOC_TYPES = ['TRADE_LICENSE', 'VAT_CERTIFICATE', 'CONTRACT', 'LPO', 'AGREEMENT', 'OTHER'];
const DOC_LABELS: Record<string, string> = {
  TRADE_LICENSE: 'Trade License', VAT_CERTIFICATE: 'VAT Certificate', CONTRACT: 'Contract',
  LPO: 'LPO', AGREEMENT: 'Agreement', OTHER: 'Other',
};
const aed = (n: any) => formatCurrency(Number(n || 0));
type Tab = 'overview' | 'contacts' | 'documents' | 'financials';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [fin, setFin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(() => {
    Promise.all([clientsApi.get(id), clientsApi.financialSummary(id)])
      .then(([cr, fr]) => { setClient(cr.data); setEdit(cr.data); setFin(fr.data); })
      .catch(() => router.push('/clients'))
      .finally(() => setLoading(false));
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={22} /></div>;
  if (!client) return null;

  const status = client.status || (client.isActive ? 'ACTIVE' : 'INACTIVE');
  const set = (k: string, v: any) => setEdit((d: any) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await clientsApi.update(id, edit);
      setClient(res.data); setEdit(res.data); setEditing(false);
      showToast('Client updated');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const setStatus = async (next: string) => {
    let reason: string | undefined;
    if (next === 'BLOCKED') reason = prompt('Reason for blocking this client?') || 'Blocked';
    await clientsApi.updateStatus(id, next, reason);
    showToast(next === 'BLOCKED' ? 'Client blocked' : 'Client activated');
    load();
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'contacts', label: `Contacts (${client.contacts?.length || 0})` },
    { id: 'documents', label: `Documents (${client.documents?.length || 0})` },
    { id: 'financials', label: 'Financials' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{client.companyName}</h1>
            <span className={cn('badge', STATUS_COLORS[status])}>{status}</span>
          </div>
          {client.tradeName && <p className="text-sm text-gray-500">{client.tradeName}</p>}
        </div>
        <div className="flex items-center gap-2">
          {toast && <span className="text-sm text-green-600">{toast}</span>}
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setEdit(client); }} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary text-sm disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="btn btn-primary text-sm"><Edit2 size={14} /> Edit</button>
              {status === 'BLOCKED'
                ? <button onClick={() => setStatus('ACTIVE')} className="btn btn-secondary text-sm text-green-600"><CheckCircle2 size={14} /> Activate</button>
                : <button onClick={() => setStatus('BLOCKED')} className="btn btn-secondary text-sm text-red-600"><Ban size={14} /> Block</button>}
            </>
          )}
        </div>
      </div>

      {status === 'BLOCKED' && client.blockReason && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-semibold">Blocked:</span> {client.blockReason}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Sales" value={aed(fin?.totalSales)} />
        <KpiCard label="Total Paid" value={aed(fin?.totalPaid)} tone="green" />
        <KpiCard label="Outstanding" value={aed(fin?.outstanding)} tone="red" />
        <KpiCard label="Open Quotations" value={`${fin?.pendingQuotations?.length ?? 0}`} sub={aed(fin?.quotationsValue)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap',
              tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview (editable) ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Company & Contact</h3>
            <div className="grid grid-cols-3 gap-4">
              <EF label="Company Name" k="companyName" editing={editing} edit={edit} set={set} view={client.companyName} />
              <EF label="Trade Name" k="tradeName" editing={editing} edit={edit} set={set} view={client.tradeName} />
              <EF label="TRN" k="trn" editing={editing} edit={edit} set={set} view={client.trn} />
              <EF label="Contact Name" k="contactName" editing={editing} edit={edit} set={set} view={client.contactName} />
              <EF label="Email" k="email" editing={editing} edit={edit} set={set} view={client.email} />
              <EF label="Phone" k="phone" editing={editing} edit={edit} set={set} view={client.phone} />
              <EF label="Website" k="website" editing={editing} edit={edit} set={set} view={client.website} />
              <EF label="City" k="city" editing={editing} edit={edit} set={set} view={client.city} />
              <EF label="Country" k="country" editing={editing} edit={edit} set={set} view={client.country} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <EF label="Billing Address" k="billingAddress" editing={editing} edit={edit} set={set} view={client.billingAddress} textarea />
              <EF label="Physical Address" k="address" editing={editing} edit={edit} set={set} view={client.address} textarea />
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">UAE Compliance</h3>
            <div className="grid grid-cols-3 gap-4">
              <EF label="VAT ID" k="vatId" editing={editing} edit={edit} set={set} view={client.vatId} />
              <EF label="Trade License No." k="tradeLicenseNumber" editing={editing} edit={edit} set={set} view={client.tradeLicenseNumber} />
              <EF label="Trade License Expiry" k="tradeLicenseExpiry" editing={editing} edit={edit} set={set} view={client.tradeLicenseExpiry?.slice(0,10)} type="date" />
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Bank Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <EF label="Bank Name" k="bankName" editing={editing} edit={edit} set={set} view={client.bankName} />
              <EF label="Branch" k="bankBranch" editing={editing} edit={edit} set={set} view={client.bankBranch} />
              <EF label="Account Number" k="bankAccount" editing={editing} edit={edit} set={set} view={client.bankAccount} />
              <EF label="IBAN" k="iban" editing={editing} edit={edit} set={set} view={client.iban} />
              <EF label="SWIFT" k="swiftCode" editing={editing} edit={edit} set={set} view={client.swiftCode} />
              <EF label="Bank Address" k="bankAddress" editing={editing} edit={edit} set={set} view={client.bankAddress} />
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Terms</h3>
            <div className="grid grid-cols-3 gap-4">
              <EF label="Payment Terms (days)" k="paymentTermDays" editing={editing} edit={edit} set={set} view={client.paymentTermDays} type="number" />
              <EF label="Credit Limit" k="creditLimit" editing={editing} edit={edit} set={set} view={client.creditLimit ? aed(client.creditLimit) : ''} type="number" />
              <EF label="Currency" k="currency" editing={editing} edit={edit} set={set} view={client.currency} />
            </div>
            <div className="mt-4">
              <EF label="Notes" k="notes" editing={editing} edit={edit} set={set} view={client.notes} textarea />
            </div>
          </div>
        </div>
      )}

      {tab === 'contacts' && <ContactPicker clientId={id} contactType="CLIENT_EMPLOYEE" />}
      {tab === 'documents' && <DocumentsTab client={client} reload={load} />}

      {/* ── Financials ── */}
      {tab === 'financials' && (
        <div className="space-y-6">
          <FinTable title="Pending Invoices" icon={<Receipt size={15} />} empty="No pending invoices."
            rows={fin?.pendingInvoices} cols={['Invoice', 'Status', 'Total', 'Due']}
            render={(i: any) => (
              <tr key={i.id}>
                <td className="py-2"><Link href={`/finance/invoices/${i.id}`} className="text-brand-600 hover:underline">{i.invoiceNumber}</Link></td>
                <td><span className="badge bg-amber-100 text-amber-700 text-xs">{i.status}</span></td>
                <td className="text-right">{aed(i.total)}</td>
                <td className="text-right font-medium text-red-600">{aed(i.amountDue)}</td>
              </tr>
            )} />
          <FinTable title="Open Quotations" icon={<FileText size={15} />} empty="No open quotations."
            rows={fin?.pendingQuotations} cols={['Quotation', 'Status', 'Total']}
            render={(q: any) => (
              <tr key={q.id}>
                <td className="py-2"><Link href={`/finance/quotations/${q.id}`} className="text-brand-600 hover:underline">{q.quotationNumber}</Link></td>
                <td><span className="badge bg-blue-100 text-blue-700 text-xs">{q.status}</span></td>
                <td className="text-right">{aed(q.total)}</td>
              </tr>
            )} />
          <FinTable title="Recent Payments" icon={<CreditCard size={15} />} empty="No payments recorded."
            rows={fin?.recentPayments} cols={['Receipt', 'Date', 'Method', 'Status', 'Amount']}
            render={(p: any) => (
              <tr key={p.id}>
                <td className="py-2">{p.paymentNumber}</td>
                <td className="text-gray-500">{formatDate(p.paymentDate)}</td>
                <td className="text-gray-500">{p.method}</td>
                <td><span className={cn('badge text-xs', p.status === 'CLEARED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>{p.status}</span></td>
                <td className="text-right font-medium">{aed(p.amount)}</td>
              </tr>
            )} />
          <div className="flex gap-2">
            <Link href={`/finance/invoices/new?clientId=${id}`} className="btn btn-secondary text-sm">New Invoice</Link>
            <Link href={`/finance/quotations/new?clientId=${id}`} className="btn btn-secondary text-sm">New Quotation</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Editable field — input when editing, label/value when viewing
function EF({ label, k, editing, edit, set, view, type = 'text', textarea }: any) {
  const isEmail = type === 'email' || /email/i.test(k);
  const isPhone = /phone|mobile|landline|whatsapp|fax|tel/i.test(k);
  return (
    <div>
      <label className="label">{label}</label>
      {editing ? (
        textarea
          ? <textarea className="input w-full" rows={2} value={edit[k] ?? ''} onChange={e => set(k, e.target.value)} />
          : isPhone
            ? <PhoneInput value={edit[k] ?? ''} onChange={(v) => set(k, v)} />
            : isEmail
              ? <EmailInput className="input w-full" value={edit[k] ?? ''} onChange={e => set(k, e.target.value)} />
              : <input type={type} className="input w-full" value={type === 'date' ? (edit[k]?.slice?.(0,10) ?? edit[k] ?? '') : (edit[k] ?? '')} onChange={e => set(k, e.target.value)} />
      ) : (
        <p className="text-sm text-gray-800 mt-0.5">{view || '—'}</p>
      )}
    </div>
  );
}

function ContactsTab({ client, reload }: { client: any; reload: () => void }) {
  const [form, setForm] = useState<any>(null);
  const blank = { name: '', title: '', email: '', mobile: '', isPrimary: false };
  const save = async () => {
    if (form.id) await clientsApi.updateContact(form.id, { ...form, clientId: client.id });
    else await clientsApi.addContact(client.id, form);
    setForm(null); reload();
  };
  const remove = async (cid: string) => { if (confirm('Delete this contact?')) { await clientsApi.removeContact(cid); reload(); } };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Contacts</h3>
        <button onClick={() => setForm({ ...blank })} className="btn btn-primary text-xs"><Plus size={12} className="mr-1" /> Add Contact</button>
      </div>
      <div className="space-y-2">
        {(client.contacts || []).map((c: any) => (
          <div key={c.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-800 flex items-center gap-1"><User size={12} className="text-gray-400" /> {c.name} {c.isPrimary && <span className="badge bg-brand-100 text-brand-700 text-xs">Primary</span>}</p>
              {c.title && <p className="text-xs text-gray-400">{c.title}</p>}
              {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
              {c.mobile && <p className="text-xs text-gray-500">{c.mobile}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setForm(c)} className="text-xs text-gray-500 hover:text-gray-800">Edit</button>
              <button onClick={() => remove(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        ))}
        {(!client.contacts || client.contacts.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No contacts added.</p>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl p-6 w-[440px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{form.id ? 'Edit' : 'Add'} Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Name</label><input className="input w-full" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Title</label><input className="input w-full" value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="label">Email</label><EmailInput className="input w-full" value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Mobile</label><PhoneInput value={form.mobile || ''} onChange={(v) => setForm({ ...form, mobile: v })} /></div>
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm text-gray-600">
              <input type="checkbox" checked={!!form.isPrimary} onChange={e => setForm({ ...form, isPrimary: e.target.checked })} /> Primary contact
            </label>
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

function DocumentsTab({ client, reload }: { client: any; reload: () => void }) {
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const blank = { docType: 'TRADE_LICENSE', name: '', expiryDate: '', fileUrl: '' };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try { const res = await uploadFile(file); setForm((f: any) => ({ ...f, fileUrl: res.url, name: f.name || file.name })); }
    catch (err: any) { alert(err?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!form.fileUrl) { alert('Please upload a file.'); return; }
    await clientsApi.addDocument(client.id, form);
    setForm(null); reload();
  };
  const remove = async (docId: string) => { if (confirm('Delete this document?')) { await clientsApi.removeDocument(docId); reload(); } };
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const src = (u: string) => u.startsWith('http') ? u : `${apiBase.replace('/api/v1', '')}${u}`;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
        <button onClick={() => setForm({ ...blank })} className="btn btn-primary text-xs"><Plus size={12} className="mr-1" /> Add Document</button>
      </div>
      <div className="space-y-2">
        {(client.documents || []).map((d: any) => {
          const expired = d.expiryDate && new Date(d.expiryDate) < new Date();
          return (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{d.name} <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{DOC_LABELS[d.docType] || d.docType}</span></p>
                {d.expiryDate && <p className={cn('text-xs', expired ? 'text-red-600' : 'text-gray-400')}>Expires {d.expiryDate.slice(0,10)}</p>}
              </div>
              <div className="flex gap-2">
                <a href={src(d.fileUrl)} target="_blank" className="text-xs text-gray-500 hover:text-gray-800">View</a>
                <button onClick={() => remove(d.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            </div>
          );
        })}
        {(!client.documents || client.documents.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No documents uploaded.</p>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl p-6 w-[460px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Add Document</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Document Type *</label>
                <select className="input w-full" value={form.docType} onChange={e => setForm({ ...form, docType: e.target.value })}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_LABELS[t]}</option>)}
                </select>
              </div>
              <div><label className="label">Name / Reference</label><input className="input w-full" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="col-span-2">
                <label className="label">Attachment *</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer btn btn-primary text-xs">
                    {busy ? 'Uploading…' : form.fileUrl ? 'Replace File' : 'Upload File'}
                    <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={upload} />
                  </label>
                  {form.fileUrl && <a href={src(form.fileUrl)} target="_blank" className="text-xs text-gray-500 underline">View</a>}
                </div>
              </div>
              <div><label className="label">Expiry Date</label><input type="date" className="input w-full" value={form.expiryDate ?? ''} onChange={e => setForm({ ...form, expiryDate: e.target.value })} /></div>
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

function FinTable({ title, icon, rows, cols, render, empty }: any) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">{icon} {title}</h3>
      {rows?.length ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-400 uppercase">
            {cols.map((c: string, i: number) => <th key={c} className={cn('py-1.5', i >= 2 && 'text-right')}>{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">{rows.map(render)}</tbody>
        </table>
      ) : <p className="text-sm text-gray-400">{empty}</p>}
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="card">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={cn('text-xl font-bold mt-1', color)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
