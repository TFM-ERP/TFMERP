'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { maintenanceApi, rentalApi, uploadFile } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import {
  ArrowLeft, Edit2, Save, X, Camera, Upload, Loader2,
  Wrench, DollarSign, Package, Plus, Trash2, FileText, Eye,
  ChevronDown, History,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import StatusTimeline from '@/components/StatusTimeline';
import StatusChangeModal from '@/components/StatusChangeModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

const CONDITION_LABELS: Record<string, string> = { NEW: 'New', GOOD: 'Good', FAIR: 'Fair', WORN: 'Worn' };

export default function MaintenanceJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<'details' | 'parts' | 'invoices' | 'photos'>('details');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Add part
  const [showPartForm, setShowPartForm] = useState(false);
  const [partForm, setPartForm] = useState({ name: '', partNumber: '', manufacturer: '', purchasePrice: '', warrantyEnd: '', notes: '' });
  const [savingPart, setSavingPart] = useState(false);

  // Add invoice
  const [showInvForm, setShowInvForm] = useState(false);
  const [invForm, setInvForm] = useState({ laborCost: '', partsCost: '', subtotal: '', vendorInvoiceRef: '', notes: '' });
  const [savingInv, setSavingInv] = useState(false);
  const [invDocUrl, setInvDocUrl] = useState('');
  const [uploadingInvDoc, setUploadingInvDoc] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const invDocInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    maintenanceApi.jobs.get(id)
      .then(r => { setJob(r.data); setEditForm(r.data); })
      .catch(() => router.push('/maintenance/jobs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await maintenanceApi.jobs.update(id, {
        category: editForm.category,
        priority: editForm.priority,
        problemDescription: editForm.problemDescription,
        internalNotes: editForm.internalNotes,
        estimatedCompletion: editForm.estimatedCompletion || undefined,
        currentOdometer: editForm.currentOdometer ? Number(editForm.currentOdometer) : undefined,
        laborCost: editForm.laborCost ? Number(editForm.laborCost) : undefined,
        partsCost: editForm.partsCost ? Number(editForm.partsCost) : undefined,
      });
      setEditing(false); load();
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (status: string, notes: string) => {
    await maintenanceApi.jobs.updateStatus(id, status, notes);
    load();
  };

  const handleAddPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const result = await uploadFile(file);
      await maintenanceApi.jobs.addPhoto(id, result.url);
      load();
    } finally { setUploadingPhoto(false); }
  };

  const handleRemovePhoto = async (url: string) => {
    await maintenanceApi.jobs.removePhoto(id, url);
    load();
  };

  const handleAddPart = async () => {
    if (!partForm.name) return;
    setSavingPart(true);
    try {
      await maintenanceApi.parts.create({
        ...partForm,
        jobId: id,
        assetId: job.assetId || undefined,
        vendorId: job.vendorId,
        purchasePrice: partForm.purchasePrice ? Number(partForm.purchasePrice) : undefined,
        warrantyEnd: partForm.warrantyEnd || undefined,
        installationDate: new Date().toISOString(),
      });
      setShowPartForm(false);
      setPartForm({ name: '', partNumber: '', manufacturer: '', purchasePrice: '', warrantyEnd: '', notes: '' });
      load();
    } finally { setSavingPart(false); }
  };

  const handleInvDocUpload = async (file: File) => {
    setUploadingInvDoc(true);
    try { const r = await uploadFile(file); setInvDocUrl(r.url); }
    finally { setUploadingInvDoc(false); }
  };

  const handleAddInvoice = async () => {
    setSavingInv(true);
    try {
      const labor = Number(invForm.laborCost || 0);
      const parts = Number(invForm.partsCost || 0);
      const subtotal = labor + parts;
      await maintenanceApi.invoices.create({
        vendorId: job.vendorId,
        jobId: id,
        laborCost: labor,
        partsCost: parts,
        subtotal,
        vendorInvoiceRef: invForm.vendorInvoiceRef || undefined,
        docUrl: invDocUrl || undefined,
        notes: invForm.notes || undefined,
      });
      setShowInvForm(false);
      setInvForm({ laborCost: '', partsCost: '', subtotal: '', vendorInvoiceRef: '', notes: '' });
      setInvDocUrl('');
      load();
    } finally { setSavingInv(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!job) return null;

  return (
    <>
    {showStatusModal && (
      <StatusChangeModal
        module="Maintenance"
        currentStatus={job.status}
        recordRef={job.jobNumber}
        onConfirm={handleStatusChange}
        onClose={() => setShowStatusModal(false)}
      />
    )}
    <div className="p-6 max-w-6xl mx-auto">
      {showHistory && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><History size={15} /> Status History</h3>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <StatusTimeline module="Maintenance" recordId={id} />
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/maintenance/jobs" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{job.jobNumber}</h1>
            <StatusBadge module="Maintenance" status={job.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.vendor?.name} {job.asset ? `· ${job.asset.name}` : ''}
            {job.category ? ` · ${job.category}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn btn-secondary text-sm">
              <Edit2 size={13} className="mr-1" /> Edit
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm disabled:opacity-50">
                <Save size={13} className="mr-1" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditForm(job); }} className="btn btn-secondary text-sm"><X size={13} /></button>
            </>
          )}
          <button onClick={() => setShowStatusModal(true)} className="btn btn-secondary text-sm">
            <ChevronDown size={13} /> Change Status
          </button>
          <button onClick={() => setShowHistory(h => !h)} className={cn('btn btn-secondary text-sm', showHistory && 'bg-gray-100')}>
            <History size={13} /> History
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {[
          { key: 'details', label: 'Details' },
          { key: 'parts', label: `Spare Parts (${job.spareParts?.length || 0})` },
          { key: 'invoices', label: `Invoices (${job.invoices?.length || 0})` },
          { key: 'photos', label: `Photos (${job.photos?.length || 0})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DETAILS ── */}
      {tab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Wrench size={14} />Job Information</h3>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Category</label>
                    <input className="input w-full" value={editForm.category || ''} onChange={e => setEditForm((f: any) => ({ ...f, category: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select className="input w-full" value={editForm.priority || 'NORMAL'} onChange={e => setEditForm((f: any) => ({ ...f, priority: e.target.value }))}>
                      {['LOW','NORMAL','HIGH','URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Est. Completion</label>
                    <input type="date" className="input w-full" value={editForm.estimatedCompletion ? new Date(editForm.estimatedCompletion).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, estimatedCompletion: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Odometer at Open (km)</label>
                    <input type="number" className="input w-full" value={editForm.currentOdometer || ''} onChange={e => setEditForm((f: any) => ({ ...f, currentOdometer: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Problem Description</label>
                    <textarea className="input w-full" rows={3} value={editForm.problemDescription || ''} onChange={e => setEditForm((f: any) => ({ ...f, problemDescription: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Internal Notes</label>
                    <textarea className="input w-full" rows={2} value={editForm.internalNotes || ''} onChange={e => setEditForm((f: any) => ({ ...f, internalNotes: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Problem Description</p>
                    <p className="text-gray-800">{job.problemDescription}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Category', value: job.category },
                      { label: 'Priority', value: job.priority },
                      { label: 'Odometer', value: job.currentOdometer ? `${job.currentOdometer.toLocaleString()} km` : null },
                      { label: 'Opened', value: formatDate(job.openedAt) },
                      { label: 'Est. Completion', value: job.estimatedCompletion ? formatDate(job.estimatedCompletion) : null },
                      { label: 'Actual Completion', value: job.actualCompletion ? formatDate(job.actualCompletion) : null },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label}>
                        <p className="text-xs text-gray-400">{f.label}</p>
                        <p className="font-medium text-gray-800 mt-0.5">{f.value}</p>
                      </div>
                    ))}
                  </div>
                  {job.internalNotes && <div className="p-2 bg-amber-50 rounded text-xs text-amber-800 border border-amber-100">{job.internalNotes}</div>}
                </div>
              )}
            </div>

            {/* Costs */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><DollarSign size={14} />Cost Breakdown</h3>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Labour Cost (AED)</label><input type="number" className="input w-full" value={editForm.laborCost || ''} onChange={e => setEditForm((f: any) => ({ ...f, laborCost: e.target.value }))} /></div>
                  <div><label className="label">Parts Cost (AED)</label><input type="number" className="input w-full" value={editForm.partsCost || ''} onChange={e => setEditForm((f: any) => ({ ...f, partsCost: e.target.value }))} /></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Labour', value: job.laborCost },
                    { label: 'Parts', value: job.partsCost },
                    { label: 'Subtotal', value: job.subtotal },
                    { label: 'VAT (5%)', value: job.vatAmount },
                    { label: 'Total', value: job.totalCost, bold: true },
                  ].map(r => (
                    <div key={r.label} className={cn('flex justify-between text-sm py-1', r.bold && 'border-t border-gray-200 mt-1 pt-2 font-semibold')}>
                      <span className={r.bold ? 'text-gray-900' : 'text-gray-500'}>{r.label}</span>
                      <span className={r.bold ? 'text-gray-900 text-base' : 'text-gray-800'}>
                        {r.value ? formatCurrency(r.value) : <span className="text-gray-300">—</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Vendor</h3>
              <Link href={`/maintenance/vendors/${job.vendorId}`} className="text-brand-600 hover:underline text-sm font-medium">{job.vendor?.name}</Link>
              {job.vendor?.mobile && <p className="text-xs text-gray-500 mt-1">{job.vendor.mobile}</p>}
            </div>
            {job.asset && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Asset</h3>
                <Link href={`/rental/assets/${job.assetId}`} className="text-brand-600 hover:underline text-sm font-medium">{job.asset.name}</Link>
                <p className="text-xs text-gray-500 mt-1">{job.asset.plateNumber || job.asset.vinNumber || job.asset.assetType}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SPARE PARTS ── */}
      {tab === 'parts' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Package size={14} />Spare Parts Used</h3>
            <button onClick={() => setShowPartForm(!showPartForm)} className="btn btn-secondary text-xs"><Plus size={12} className="mr-1" />Add Part</button>
          </div>
          {showPartForm && (
            <div className="card mb-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><label className="label">Part Name *</label><input className="input w-full" value={partForm.name} onChange={e => setPartForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Part Number / SKU</label><input className="input w-full font-mono" value={partForm.partNumber} onChange={e => setPartForm(f => ({ ...f, partNumber: e.target.value }))} /></div>
                <div><label className="label">Manufacturer</label><input className="input w-full" value={partForm.manufacturer} onChange={e => setPartForm(f => ({ ...f, manufacturer: e.target.value }))} /></div>
                <div><label className="label">Purchase Price (AED)</label><input type="number" className="input w-full" value={partForm.purchasePrice} onChange={e => setPartForm(f => ({ ...f, purchasePrice: e.target.value }))} /></div>
                <div><label className="label">Warranty End Date</label><input type="date" className="input w-full" value={partForm.warrantyEnd} onChange={e => setPartForm(f => ({ ...f, warrantyEnd: e.target.value }))} /></div>
                <div><label className="label">Notes</label><input className="input w-full" value={partForm.notes} onChange={e => setPartForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddPart} disabled={savingPart} className="btn btn-primary text-sm disabled:opacity-50">{savingPart ? 'Saving...' : 'Add Part'}</button>
                <button onClick={() => setShowPartForm(false)} className="btn btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead><tr>
                <th className="table-th">Part Name</th>
                <th className="table-th">Part No.</th>
                <th className="table-th">Manufacturer</th>
                <th className="table-th">Installed</th>
                <th className="table-th">Warranty Until</th>
                <th className="table-th text-right">Price</th>
              </tr></thead>
              <tbody>
                {job.spareParts?.map((part: any) => (
                  <tr key={part.id} className="table-row">
                    <td className="table-td font-medium text-sm">{part.name}</td>
                    <td className="table-td font-mono text-xs text-gray-500">{part.partNumber || '—'}</td>
                    <td className="table-td text-sm text-gray-600">{part.manufacturer || '—'}</td>
                    <td className="table-td text-xs text-gray-500">{part.installationDate ? formatDate(part.installationDate) : '—'}</td>
                    <td className="table-td text-xs">
                      {part.warrantyEnd ? (
                        <span className={new Date(part.warrantyEnd) < new Date() ? 'text-red-600' : 'text-gray-600'}>
                          {formatDate(part.warrantyEnd)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td text-right text-sm">{part.purchasePrice ? formatCurrency(part.purchasePrice) : '—'}</td>
                  </tr>
                ))}
                {(!job.spareParts || job.spareParts.length === 0) && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No spare parts recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── INVOICES ── */}
      {tab === 'invoices' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><DollarSign size={14} />Vendor Invoices</h3>
            <button onClick={() => setShowInvForm(!showInvForm)} className="btn btn-secondary text-xs"><Plus size={12} className="mr-1" />Add Invoice</button>
          </div>
          {showInvForm && (
            <div className="card mb-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><label className="label">Labour Cost (AED)</label><input type="number" className="input w-full" value={invForm.laborCost} onChange={e => setInvForm(f => ({ ...f, laborCost: e.target.value }))} /></div>
                <div><label className="label">Parts Cost (AED)</label><input type="number" className="input w-full" value={invForm.partsCost} onChange={e => setInvForm(f => ({ ...f, partsCost: e.target.value }))} /></div>
                <div><label className="label">Vendor Invoice Ref</label><input className="input w-full" value={invForm.vendorInvoiceRef} onChange={e => setInvForm(f => ({ ...f, vendorInvoiceRef: e.target.value }))} /></div>
                <div className="col-span-3"><label className="label">Notes</label><input className="input w-full" value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div className="mb-3">
                <label className={cn('flex items-center justify-center gap-2 w-full py-2 rounded-lg border-2 border-dashed text-xs font-medium cursor-pointer transition-colors',
                  uploadingInvDoc ? 'border-gray-200 text-gray-400' : invDocUrl ? 'border-green-300 text-green-700' : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50')}>
                  {uploadingInvDoc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploadingInvDoc ? 'Uploading...' : invDocUrl ? '✓ Invoice Uploaded' : 'Upload Invoice Document'}
                  <input ref={invDocInputRef} type="file" className="hidden" accept="image/*,.pdf" disabled={uploadingInvDoc}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleInvDocUpload(f); }} />
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddInvoice} disabled={savingInv} className="btn btn-primary text-sm disabled:opacity-50">{savingInv ? 'Saving...' : 'Add Invoice'}</button>
                <button onClick={() => setShowInvForm(false)} className="btn btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {job.invoices?.map((inv: any) => (
              <div key={inv.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-mono text-sm font-semibold text-gray-900">{inv.invoiceNumber}</span>
                    {inv.vendorInvoiceRef && <span className="text-xs text-gray-400 ml-2">Ref: {inv.vendorInvoiceRef}</span>}
                  </div>
                  <span className={cn('badge', inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>{inv.status}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-gray-400">Labour</p><p>{formatCurrency(inv.laborCost)}</p></div>
                  <div><p className="text-xs text-gray-400">Parts</p><p>{formatCurrency(inv.partsCost)}</p></div>
                  <div><p className="text-xs text-gray-400">VAT (5%)</p><p>{formatCurrency(inv.vatAmount)}</p></div>
                  <div><p className="text-xs text-gray-400">Total</p><p className="font-semibold">{formatCurrency(inv.total)}</p></div>
                </div>
                {Number(inv.amountDue) > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs text-red-600">
                    <span>Outstanding: {formatCurrency(inv.amountDue)}</span>
                  </div>
                )}
                {inv.docUrl && (
                  <a href={`${API_BASE}${inv.docUrl}`} target="_blank" rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:underline">
                    <FileText size={11} /> View Invoice Document
                  </a>
                )}
                {/* Payments for this invoice */}
                {inv.payments?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Payments</p>
                    {inv.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span className="text-gray-600">{formatDate(p.paymentDate)} · {p.method.replace(/_/g,' ')}</span>
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(!job.invoices || job.invoices.length === 0) && (
              <p className="text-center py-8 text-gray-400 text-sm">No invoices recorded yet</p>
            )}
          </div>
        </div>
      )}

      {/* ── PHOTOS ── */}
      {tab === 'photos' && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {job.photos?.map((url: string, i: number) => {
              const full = `${API_BASE}${url}`;
              return (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                  <a href={full} target="_blank" rel="noopener noreferrer">
                    <img src={full} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                  </a>
                  <button onClick={() => handleRemovePhoto(url)}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          <label className={cn('flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium cursor-pointer transition-colors',
            uploadingPhoto ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50')}>
            {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {uploadingPhoto ? 'Uploading...' : 'Add Photo'}
            <input ref={photoInputRef} type="file" className="hidden" accept="image/*,.heic" disabled={uploadingPhoto}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAddPhoto(f); if (photoInputRef.current) photoInputRef.current.value = ''; }} />
          </label>
        </div>
      )}
    </div>
    </>
  );
}
