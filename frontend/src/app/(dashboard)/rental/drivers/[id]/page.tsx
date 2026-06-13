'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { rentalApi, uploadFile } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import {
  ArrowLeft, Edit2, Save, X, Phone, Mail, CreditCard,
  FileText, Calendar, Shield, Upload, Eye, Trash2, Loader2,
} from 'lucide-react';
import DriverPayments from '@/components/rental/DriverPayments';
import EmailInput from '@/components/EmailInput';
import PhoneInput from '@/components/PhoneInput';

const JOB_STATUS_STYLE: Record<string, string> = {
  ASSIGNED: 'bg-blue-100 text-blue-700',
  EN_ROUTE: 'bg-indigo-100 text-indigo-700',
  ARRIVED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  PICKED_UP: 'bg-cyan-100 text-cyan-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const INCIDENT_URGENCY_STYLE: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

// ── Availability calendar ────────────────────────────────────────────────────
function AvailabilityCalendar({ jobs }: { jobs: any[] }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const busy = new Set<string>();
  jobs.forEach(j => {
    if (j.status === 'CANCELLED') return;
    const d = new Date(j.scheduledAt);
    busy.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(new Date(year, m - 1, 1))} className="p-1 hover:bg-gray-100 rounded text-gray-500 text-sm">‹</button>
        <p className="text-sm font-semibold text-gray-700">{monthNames[m]} {year}</p>
        <button onClick={() => setMonth(new Date(year, m + 1, 1))} className="p-1 hover:bg-gray-100 rounded text-gray-500 text-sm">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[10px] text-gray-400 font-semibold py-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = `${year}-${m}-${d}`;
          const isToday = today.getFullYear() === year && today.getMonth() === m && today.getDate() === d;
          const isBusy = busy.has(key);
          return (
            <div key={i} className={cn(
              'text-center text-xs py-1.5 rounded',
              isBusy ? 'bg-red-100 text-red-700 font-semibold' : 'text-gray-600 hover:bg-gray-50',
              isToday && !isBusy ? 'ring-1 ring-brand-500 font-semibold text-brand-700' : '',
              isToday && isBusy ? 'ring-1 ring-red-500' : '',
            )}>
              {d}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-[10px]">
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded inline-block" /> Busy</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block ring-1 ring-brand-500" /> Today</div>
      </div>
    </div>
  );
}

// ── Doc expiry badge ─────────────────────────────────────────────────────────
function ExpiryBadge({ label, date }: { label: string; date?: string | null }) {
  if (!date) return <div className="flex justify-between text-sm"><span className="text-gray-400">{label}</span><span className="text-gray-300">—</span></div>;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  const expired = daysLeft < 0;
  const warn = daysLeft >= 0 && daysLeft <= 30;
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={cn('text-xs font-medium', expired ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-700')}>
        {formatDate(date)}{expired ? ' ⚠ Expired' : warn ? ` (${daysLeft}d)` : ''}
      </span>
    </div>
  );
}

// ── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const r = 28, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="text-lg font-bold -mt-12 mb-6" style={{ color }}>{score}</div>
      <p className="text-[10px] text-gray-400 -mt-4">Reliability</p>
    </div>
  );
}

// ── Document upload card ─────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

function DocUploadCard({
  label, docUrl, field, driverId, onUploaded,
}: {
  label: string;
  docUrl?: string | null;
  field: string;
  driverId: string;
  onUploaded: (field: string, url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const isPdf = docUrl?.toLowerCase().endsWith('.pdf');
  const fullUrl = docUrl ? `${API_BASE}${docUrl}` : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const result = await uploadFile(file);
      // Save the URL back to the driver
      await rentalApi.drivers.update(driverId, { [field]: result.url });
      onUploaded(field, result.url);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove this document?')) return;
    await rentalApi.drivers.update(driverId, { [field]: null });
    onUploaded(field, null);
  };

  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        {docUrl && (
          <div className="flex gap-1">
            <a href={fullUrl!} target="_blank" rel="noopener noreferrer"
              className="p-1 text-brand-600 hover:text-brand-700 rounded hover:bg-brand-50 transition-colors"
              title="View document">
              <Eye size={13} />
            </a>
            <button onClick={handleRemove}
              className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
              title="Remove document">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      {fullUrl && !isPdf && (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          <img src={fullUrl} alt={label}
            className="w-full h-28 object-cover rounded-lg mb-2 border border-gray-200 hover:opacity-90 transition-opacity" />
        </a>
      )}
      {fullUrl && isPdf && (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg mb-2 text-sm text-brand-700 hover:bg-brand-50 transition-colors">
          <FileText size={14} />
          <span className="truncate text-xs">View PDF</span>
          <Eye size={12} className="ml-auto shrink-0 opacity-60" />
        </a>
      )}

      {/* Upload button */}
      <label className={cn(
        'flex items-center justify-center gap-2 w-full py-2 rounded-lg border-2 border-dashed text-xs font-medium cursor-pointer transition-colors',
        uploading
          ? 'border-gray-200 text-gray-400 cursor-not-allowed'
          : docUrl
            ? 'border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-600'
            : 'border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50',
      )}>
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? 'Uploading...' : docUrl ? 'Replace' : 'Upload'}
        <input type="file" className="hidden" accept="image/*,.pdf,.heic"
          disabled={uploading} onChange={handleFileChange} />
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'overview' | 'jobs' | 'incidents' | 'payments' | 'invoice'>('overview');
  const [editForm, setEditForm] = useState<any>({});
  const [invoiceJobIds, setInvoiceJobIds] = useState<string[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dr, pr] = await Promise.all([
        rentalApi.drivers.get(id),
        rentalApi.drivers.performance(id),
      ]);
      setDriver(dr.data);
      setPerf(pr.data);
      setEditForm(dr.data);
    } catch { router.push('/rental/drivers'); }
    finally { setLoading(false); }
  }, [id, router]);

  const handleDocUploaded = (field: string, url: string | null) => {
    setDriver((prev: any) => prev ? { ...prev, [field]: url } : prev);
  };

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await rentalApi.drivers.update(id, editForm);
      setEditing(false);
      load();
    } finally { setSaving(false); }
  };

  const toggleJobForInvoice = (jobId: string) => {
    setInvoiceJobIds(prev =>
      prev.includes(jobId) ? prev.filter(i => i !== jobId) : [...prev, jobId]
    );
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceJobIds.length) return;
    setGenerating(true);
    try {
      const r = await rentalApi.drivers.generateInvoice(id, invoiceJobIds);
      setInvoice(r.data);
    } finally { setGenerating(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!driver) return null;

  const completedJobs = (driver.jobs || []).filter((j: any) => j.status === 'COMPLETED');

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/rental/drivers" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{driver.fullName}</h1>
          <p className="text-sm text-gray-400">
            <span className={cn('badge text-xs mr-2', driver.driverType === 'EMPLOYEE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
              {driver.driverType}
            </span>
            {driver.licenseClass && `Class ${driver.licenseClass} · `}
            {driver.mobile}
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
              <button onClick={() => { setEditing(false); setEditForm(driver); }} className="btn btn-secondary text-sm">
                <X size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['overview', 'jobs', 'incidents', 'payments', ...(driver.driverType === 'FREELANCE' ? ['invoice'] : [])] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={cn('px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t === 'invoice' ? 'Freelancer Invoice' : t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: details */}
          <div className="lg:col-span-2 space-y-5">

            {/* Personal & Contact */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={15} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-gray-700">Personal Details</h3>
              </div>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Full Name</label><input className="input w-full" value={editForm.fullName || ''} onChange={e => setEditForm((f: any) => ({ ...f, fullName: e.target.value }))} /></div>
                  <div><label className="label">Driver Type</label>
                    <select className="input w-full" value={editForm.driverType || 'EMPLOYEE'} onChange={e => setEditForm((f: any) => ({ ...f, driverType: e.target.value }))}>
                      <option value="EMPLOYEE">Employee</option><option value="FREELANCE">Freelance</option>
                    </select>
                  </div>
                  <div><label className="label">Mobile</label><PhoneInput value={editForm.mobile || ''} onChange={(v) => setEditForm((f: any) => ({ ...f, mobile: v }))} /></div>
                  <div><label className="label">Email</label><EmailInput className="input w-full" value={editForm.email || ''} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                  <div><label className="label">Emirates ID</label><input className="input w-full font-mono" value={editForm.emiratesId || ''} onChange={e => setEditForm((f: any) => ({ ...f, emiratesId: e.target.value }))} /></div>
                  <div><label className="label">Emirates ID Expiry</label><input type="date" className="input w-full" value={editForm.emiratesIdExpiry ? new Date(editForm.emiratesIdExpiry).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, emiratesIdExpiry: e.target.value }))} /></div>
                  <div><label className="label">Passport No.</label><input className="input w-full font-mono" value={editForm.passportNumber || ''} onChange={e => setEditForm((f: any) => ({ ...f, passportNumber: e.target.value }))} /></div>
                  <div><label className="label">Passport Expiry</label><input type="date" className="input w-full" value={editForm.passportExpiry ? new Date(editForm.passportExpiry).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, passportExpiry: e.target.value }))} /></div>
                  <div><label className="label">Visa Expiry</label><input type="date" className="input w-full" value={editForm.visaExpiry ? new Date(editForm.visaExpiry).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, visaExpiry: e.target.value }))} /></div>
                  <div><label className="label">License No.</label><input className="input w-full font-mono" value={editForm.licenseNumber || ''} onChange={e => setEditForm((f: any) => ({ ...f, licenseNumber: e.target.value }))} /></div>
                  <div><label className="label">License Class</label><input className="input w-full" value={editForm.licenseClass || ''} onChange={e => setEditForm((f: any) => ({ ...f, licenseClass: e.target.value }))} /></div>
                  <div><label className="label">License Expiry</label><input type="date" className="input w-full" value={editForm.licenseExpiry ? new Date(editForm.licenseExpiry).toISOString().slice(0,10) : ''} onChange={e => setEditForm((f: any) => ({ ...f, licenseExpiry: e.target.value }))} /></div>
                  <div><label className="label">Daily Rate (AED)</label><input type="number" className="input w-full" value={editForm.dailyRate || ''} onChange={e => setEditForm((f: any) => ({ ...f, dailyRate: e.target.value }))} /></div>
                  <div><label className="label">Weekly Rate (AED)</label><input type="number" className="input w-full" value={editForm.weeklyRate || ''} onChange={e => setEditForm((f: any) => ({ ...f, weeklyRate: e.target.value }))} /></div>
                  <div className="col-span-2"><label className="label">Notes</label><textarea className="input w-full" rows={2} value={editForm.notes || ''} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {driver.mobile && <div><p className="text-xs text-gray-400">Mobile</p><p className="font-medium flex items-center gap-1"><Phone size={12} className="text-gray-400" />{driver.mobile}</p></div>}
                  {driver.email && <div><p className="text-xs text-gray-400">Email</p><p className="font-medium flex items-center gap-1"><Mail size={12} className="text-gray-400" />{driver.email}</p></div>}
                  {driver.emiratesId && <div><p className="text-xs text-gray-400">Emirates ID</p><p className="font-mono font-medium">{driver.emiratesId}</p></div>}
                  {driver.passportNumber && <div><p className="text-xs text-gray-400">Passport</p><p className="font-mono font-medium">{driver.passportNumber}</p></div>}
                  {driver.licenseNumber && <div><p className="text-xs text-gray-400">License No.</p><p className="font-mono font-medium">{driver.licenseNumber}{driver.licenseClass && ` · Class ${driver.licenseClass}`}</p></div>}
                  {driver.dailyRate && <div><p className="text-xs text-gray-400">Daily Rate</p><p className="font-semibold text-gray-900">{formatCurrency(driver.dailyRate)}</p></div>}
                  {driver.weeklyRate && <div><p className="text-xs text-gray-400">Weekly Rate</p><p className="font-semibold text-gray-900">{formatCurrency(driver.weeklyRate)}</p></div>}
                  {driver.notes && <div className="col-span-2"><p className="text-xs text-gray-400">Notes</p><p className="text-gray-600">{driver.notes}</p></div>}
                </div>
              )}
            </div>

            {/* Bank details */}
            {!editing && (driver.bankName || driver.iban) && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={15} className="text-brand-600" />
                  <h3 className="text-sm font-semibold text-gray-700">Bank Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {driver.bankName && <div><p className="text-xs text-gray-400">Bank</p><p className="font-medium">{driver.bankName}</p></div>}
                  {driver.bankAccount && <div><p className="text-xs text-gray-400">Account No.</p><p className="font-mono">{driver.bankAccount}</p></div>}
                  {driver.iban && <div className="col-span-2"><p className="text-xs text-gray-400">IBAN</p><p className="font-mono text-sm">{driver.iban}</p></div>}
                </div>
              </div>
            )}
            {editing && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={15} className="text-brand-600" />
                  <h3 className="text-sm font-semibold text-gray-700">Bank Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Bank Name</label><input className="input w-full" value={editForm.bankName || ''} onChange={e => setEditForm((f: any) => ({ ...f, bankName: e.target.value }))} /></div>
                  <div><label className="label">Account No.</label><input className="input w-full font-mono" value={editForm.bankAccount || ''} onChange={e => setEditForm((f: any) => ({ ...f, bankAccount: e.target.value }))} /></div>
                  <div className="col-span-2"><label className="label">IBAN</label><input className="input w-full font-mono" value={editForm.iban || ''} onChange={e => setEditForm((f: any) => ({ ...f, iban: e.target.value }))} /></div>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Performance */}
            {perf && (
              <div className="card text-center">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance</h3>
                <ScoreRing score={perf.reliabilityScore} />
                <div className="grid grid-cols-2 gap-2 mt-3 text-left">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-400">Jobs Done</p>
                    <p className="text-base font-bold text-gray-900">{perf.completedJobs}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-400">Delay Rate</p>
                    <p className={cn('text-base font-bold', perf.delayRate > 20 ? 'text-red-600' : 'text-gray-900')}>{perf.delayRate}%</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-400">Incidents</p>
                    <p className={cn('text-base font-bold', perf.incidentCount > 0 ? 'text-orange-600' : 'text-gray-900')}>{perf.incidentCount}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-400">Avg Duration</p>
                    <p className="text-base font-bold text-gray-900">{perf.avgJobDurationHrs}h</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2 col-span-2">
                    <p className="text-xs text-gray-400">Total Expenses</p>
                    <p className="text-base font-bold text-gray-900">{formatCurrency(perf.totalExpenses)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Document expiry */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Expiry</h3>
              <div className="space-y-2.5">
                <ExpiryBadge label="Emirates ID" date={driver.emiratesIdExpiry} />
                <ExpiryBadge label="Passport" date={driver.passportExpiry} />
                <ExpiryBadge label="Visa" date={driver.visaExpiry} />
                <ExpiryBadge label="Driver's License" date={driver.licenseExpiry} />
              </div>
            </div>

            {/* Document uploads */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                <Upload size={13} className="inline mr-1 text-brand-600" />Documents
              </h3>
              <div className="space-y-3">
                <DocUploadCard
                  label="Emirates ID Copy"
                  docUrl={driver.emiratesIdDocUrl}
                  field="emiratesIdDocUrl"
                  driverId={id}
                  onUploaded={handleDocUploaded}
                />
                <DocUploadCard
                  label="Passport Copy"
                  docUrl={driver.passportDocUrl}
                  field="passportDocUrl"
                  driverId={id}
                  onUploaded={handleDocUploaded}
                />
                <DocUploadCard
                  label="Driving License Copy"
                  docUrl={driver.licenseDocUrl}
                  field="licenseDocUrl"
                  driverId={id}
                  onUploaded={handleDocUploaded}
                />
              </div>
            </div>

            {/* Availability calendar */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                <Calendar size={13} className="inline mr-1 text-brand-600" />Availability
              </h3>
              <AvailabilityCalendar jobs={driver.jobs || []} />
            </div>
          </div>
        </div>
      )}

      {/* ── JOBS TAB ── */}
      {tab === 'jobs' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Type</th>
                <th className="table-th">Asset</th>
                <th className="table-th">Booking</th>
                <th className="table-th">Route</th>
                <th className="table-th">Status</th>
                <th className="table-th">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {(driver.jobs || []).map((j: any) => {
                const expenses = Number(j.fuelExpense || 0) + Number(j.tollExpense || 0) + Number(j.parkingExpense || 0) + Number(j.foodAllowance || 0);
                return (
                  <tr key={j.id} className="table-row">
                    <td className="table-td text-xs text-gray-500">{formatDate(j.scheduledAt)}</td>
                    <td className="table-td"><span className="badge bg-gray-100 text-gray-600 text-xs">{j.jobType}</span></td>
                    <td className="table-td text-xs text-gray-700">{j.asset?.name || '—'}</td>
                    <td className="table-td text-xs">
                      {j.booking ? (
                        <Link href={`/rental/bookings/${j.booking.id}`} className="text-brand-600 hover:underline">{j.booking.bookingNumber}</Link>
                      ) : '—'}
                    </td>
                    <td className="table-td text-xs text-gray-500 max-w-xs">
                      {j.pickupLocation && <p className="truncate">↑ {j.pickupLocation}</p>}
                      {j.dropoffLocation && <p className="truncate">↓ {j.dropoffLocation}</p>}
                    </td>
                    <td className="table-td">
                      <span className={cn('badge text-xs', JOB_STATUS_STYLE[j.status] || 'bg-gray-100 text-gray-500')}>
                        {j.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="table-td text-xs text-gray-600">{expenses > 0 ? formatCurrency(expenses) : '—'}</td>
                  </tr>
                );
              })}
              {(driver.jobs || []).length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No jobs assigned yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── INCIDENTS TAB ── */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{(driver.incidents || []).length} incidents on record</p>
            <Link href={`/rental/incidents?driverId=${id}`} className="btn btn-secondary text-sm">
              View All Incidents
            </Link>
          </div>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Ref</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Title</th>
                  <th className="table-th">Urgency</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {(driver.incidents || []).map((inc: any) => (
                  <tr key={inc.id} className="table-row">
                    <td className="table-td font-mono text-xs text-gray-400">{inc.incidentNumber}</td>
                    <td className="table-td text-xs text-gray-500">{formatDate(inc.occurredAt)}</td>
                    <td className="table-td text-xs text-gray-600">{inc.incidentType.replace(/_/g, ' ')}</td>
                    <td className="table-td text-sm text-gray-800">{inc.title}</td>
                    <td className="table-td">
                      <span className={cn('badge text-xs', INCIDENT_URGENCY_STYLE[inc.urgency] || 'bg-gray-100 text-gray-500')}>{inc.urgency}</span>
                    </td>
                    <td className="table-td">
                      <span className={cn('badge text-xs', inc.status === 'RESOLVED' || inc.status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                        {inc.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(driver.incidents || []).length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No incidents recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === 'payments' && (
        <div className="max-w-3xl">
          <DriverPayments driver={driver} />
        </div>
      )}

      {/* ── INVOICE TAB (freelance only) ── */}
      {tab === 'invoice' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="card mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Completed Jobs</h3>
              <p className="text-xs text-gray-400 mb-3">Select jobs to include in the invoice</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {completedJobs.map((j: any) => (
                  <label key={j.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={invoiceJobIds.includes(j.id)}
                      onChange={() => toggleJobForInvoice(j.id)} className="rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{j.jobType} · {j.asset?.name || 'No asset'}</p>
                      <p className="text-xs text-gray-400">{formatDate(j.scheduledAt)} · {j.booking?.bookingNumber}</p>
                    </div>
                    <span className="text-xs text-gray-500">{formatCurrency(
                      Number(driver.dailyRate || 0) + Number(j.fuelExpense || 0) + Number(j.tollExpense || 0) +
                      Number(j.parkingExpense || 0) + Number(j.foodAllowance || 0) + Number(j.bonusAmount || 0)
                    )}</span>
                  </label>
                ))}
                {completedJobs.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No completed jobs to invoice</p>}
              </div>
              <button onClick={handleGenerateInvoice} disabled={generating || !invoiceJobIds.length}
                className="btn btn-primary w-full mt-4 disabled:opacity-50">
                {generating ? 'Generating...' : `Generate Invoice (${invoiceJobIds.length} jobs)`}
              </button>
            </div>
          </div>

          {invoice && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Invoice Preview</h3>
                <span className="text-xs text-gray-400">{formatDate(invoice.generatedAt)}</span>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-semibold text-gray-900">{invoice.driver.fullName}</p>
                {invoice.driver.mobile && <p className="text-gray-500 text-xs">{invoice.driver.mobile}</p>}
                {invoice.driver.iban && <p className="font-mono text-xs text-gray-500">{invoice.driver.iban}</p>}
              </div>
              <div className="space-y-2 mb-4">
                {invoice.lineItems.map((l: any, i: number) => (
                  <div key={i} className="flex justify-between items-start text-sm py-1.5 border-b border-gray-50">
                    <div>
                      <p className="font-medium text-gray-800">{l.jobType} · {formatDate(l.scheduledAt)}</p>
                      {l.bookingRef && <p className="text-xs text-gray-400">{l.bookingRef}</p>}
                    </div>
                    <span className="font-semibold text-gray-900">{formatCurrency(l.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span className="text-lg">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
