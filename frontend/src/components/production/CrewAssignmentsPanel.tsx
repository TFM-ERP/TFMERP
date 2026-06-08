'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Users, Plane, MapPin, FileText, ExternalLink, X, Mail, Upload } from 'lucide-react';
import { productionApi, crewApi, uploadFile, assetUrl } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import DepartmentRolePicker from './DepartmentRolePicker';
import { PanelHeader, Btn, EmptyState, inputCls } from './ui';

const DEAL_META: Record<string, { label: string; cls: string }> = {
  NOT_SENT: { label: 'Not sent', cls: 'bg-slate-100 text-slate-600' },
  SENT: { label: 'Sent', cls: 'bg-amber-100 text-amber-700' },
  SIGNED: { label: 'Signed', cls: 'bg-emerald-100 text-emerald-700' },
};
const NDA_META: Record<string, { label: string; cls: string }> = {
  NOT_REQUIRED: { label: 'N/A', cls: 'bg-slate-100 text-slate-600' },
  SENT: { label: 'Sent', cls: 'bg-amber-100 text-amber-700' },
  SIGNED: { label: 'Signed', cls: 'bg-emerald-100 text-emerald-700' },
};

export default function CrewAssignmentsPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n || 0), currency);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [directory, setDirectory] = useState<any[]>([]);
  const blankForm = { crewMemberId: '', name: '', department: '', roleTitle: '', startDate: '', endDate: '', location: '', dailyRate: '', weeklyRate: '', totalDays: '', productionVehicle: false, driverLicenseNumber: '', driverLicenseExpiry: '', driverLicenseDocUrl: '' };
  const [form, setForm] = useState<any>({ ...blankForm });

  const load = useCallback(() => {
    setLoading(true);
    productionApi.crew.list(projectId).then(r => setRows(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { crewApi.list({}).then(r => setDirectory(r.data || [])).catch(() => {}); }, []);

  // Pick the rate matching the project currency (fallback to the other one if blank).
  const rateFor = (m: any, kind: 'day' | 'week') => {
    const usd = kind === 'day' ? m?.dayRateUsd : m?.weeklyRateUsd;
    const aed = kind === 'day' ? m?.dayRateAed : m?.weeklyRateAed;
    const primary = currency === 'USD' ? usd : aed;
    const v = primary ?? usd ?? aed;
    return v != null ? String(Number(v)) : '';
  };

  const pickFromDirectory = async (id: string) => {
    if (!id) { setForm((f: any) => ({ ...f, crewMemberId: '' })); return; }
    // fetch the full member so the whole rate card + role + department come across
    let m = directory.find(d => d.id === id);
    try { const r = await crewApi.get(id); m = { ...m, ...r.data }; } catch { /* use list row */ }
    setForm((f: any) => ({
      ...f, crewMemberId: id,
      name: m?.name || f.name,
      department: m?.department || f.department,
      roleTitle: m?.role || f.roleTitle,
      dailyRate: rateFor(m, 'day') || f.dailyRate,
      weeklyRate: rateFor(m, 'week') || f.weeklyRate,
    }));
  };

  const add = async () => {
    if (!form.crewMemberId && !form.name) return;
    await productionApi.crew.create({
      projectId, crewMemberId: form.crewMemberId || undefined,
      name: form.name || undefined,
      department: form.department || undefined, roleTitle: form.roleTitle || undefined,
      startDate: form.startDate || undefined, endDate: form.endDate || undefined,
      location: form.location || undefined,
      dailyRate: form.dailyRate ? Number(form.dailyRate) : undefined,
      weeklyRate: form.weeklyRate ? Number(form.weeklyRate) : undefined,
      totalDays: form.totalDays ? Number(form.totalDays) : undefined,
      productionVehicle: !!form.productionVehicle,
      driverLicenseNumber: form.driverLicenseNumber || undefined,
      driverLicenseExpiry: form.driverLicenseExpiry || undefined,
      driverLicenseDocUrl: form.driverLicenseDocUrl || undefined,
    });
    setAdding(false);
    setForm({ ...blankForm });
    load();
  };

  const uploadLicense = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { const up = await uploadFile(file); setForm((f: any) => ({ ...f, driverLicenseDocUrl: up.url })); } catch { /* ignore */ }
  };

  const setStatus = async (id: string, field: string, value: string) => {
    await productionApi.crew.update(id, { [field]: value });
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this assignment?')) return;
    await productionApi.crew.remove(id);
    load();
  };

  const emailMemo = async (r: any) => {
    const def = r.email || r.crewMember?.email || '';
    const to = prompt(`Email deal memo to:`, def);
    if (!to) return;
    try { await productionApi.mail.dealMemo(r.id, { recipients: to }); alert('Deal memo emailed.'); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not send — check Company Management → Email (SMTP) setup.'); }
  };

  return (
    <div className="space-y-4">
      <PanelHeader
        icon={Users}
        title={`Crew Assignments & Deal Memos (${rows.length})`}
        subtitle="Assign crew from the directory, set rate & dates, and track deal-memo / NDA status."
        actions={<>
          <a href="/production/settings/email" className="text-xs inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 border border-slate-200 text-slate-600 hover:border-slate-900 transition-colors"><Mail size={13} /> Email sender</a>
          <Btn variant="primary" onClick={() => setAdding(a => !a)}><Plus size={13} /> Assign crew</Btn>
        </>}
      />

      {adding && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="label text-xs">From Crew Directory</label>
              <select className={inputCls} value={form.crewMemberId} onChange={e => pickFromDirectory(e.target.value)}>
                <option value="">— Select freelancer —</option>
                {directory.map(d => <option key={d.id} value={d.id}>{d.name}{d.department ? ` · ${d.department}` : ''}{d.isLocal === false ? ' (abroad)' : ''}</option>)}
              </select>
            </div>
            <div><label className="label text-xs">Or name (ad-hoc)</label><input className={inputCls} value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value, crewMemberId: '' }))} placeholder="Manual entry" /></div>
            <DepartmentRolePicker compact department={form.department} role={form.roleTitle} onChange={(patch) => setForm((f: any) => ({ ...f, ...(patch.department !== undefined ? { department: patch.department } : {}), ...(patch.role !== undefined ? { roleTitle: patch.role } : {}) }))} />
            <div><label className="label text-xs">Start</label><input type="date" className={inputCls} value={form.startDate} onChange={e => setForm((f: any) => ({ ...f, startDate: e.target.value }))} /></div>
            <div><label className="label text-xs">End</label><input type="date" className={inputCls} value={form.endDate} onChange={e => setForm((f: any) => ({ ...f, endDate: e.target.value }))} /></div>
            <div><label className="label text-xs">Location</label><input className={inputCls} value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} placeholder="Dubai / Abu Dhabi" /></div>
            <div><label className="label text-xs">Daily rate ({currency}){form.crewMemberId && <span className="text-[9px] text-brand-500 ml-1">from directory</span>}</label><input type="number" className={inputCls} value={form.dailyRate} onChange={e => setForm((f: any) => ({ ...f, dailyRate: e.target.value }))} /></div>
            <div><label className="label text-xs">Weekly rate ({currency})</label><input type="number" className={inputCls} value={form.weeklyRate} onChange={e => setForm((f: any) => ({ ...f, weeklyRate: e.target.value }))} /></div>
            <div><label className="label text-xs">Days</label><input type="number" className={inputCls} value={form.totalDays} onChange={e => setForm((f: any) => ({ ...f, totalDays: e.target.value }))} /></div>
          </div>

          {/* Production vehicle / driver licence */}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={!!form.productionVehicle} onChange={e => setForm((f: any) => ({ ...f, productionVehicle: e.target.checked }))} />
              Uses a production vehicle (driving a production car)
            </label>
            {form.productionVehicle && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                <div><label className="label text-xs">Driver licence #</label><input className={inputCls} value={form.driverLicenseNumber} onChange={e => setForm((f: any) => ({ ...f, driverLicenseNumber: e.target.value }))} /></div>
                <div><label className="label text-xs">Licence expiry</label><input type="date" className={inputCls} value={form.driverLicenseExpiry} onChange={e => setForm((f: any) => ({ ...f, driverLicenseExpiry: e.target.value }))} /></div>
                <div><label className="label text-xs">Licence copy</label>
                  {form.driverLicenseDocUrl
                    ? <div className="flex items-center gap-2 text-sm h-9"><a href={assetUrl(form.driverLicenseDocUrl)} target="_blank" rel="noreferrer" className="text-brand-600 inline-flex items-center gap-1"><FileText size={13} /> View</a><button type="button" onClick={() => setForm((f: any) => ({ ...f, driverLicenseDocUrl: '' }))} className="text-gray-300 hover:text-red-500"><X size={13} /></button></div>
                    : <label className="text-xs inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 border border-slate-200 text-slate-600 hover:border-slate-900 transition-colors cursor-pointer"><Upload size={13} /> Attach<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={uploadLicense} /></label>}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <Btn variant="primary" onClick={add}>Add assignment</Btn>
            <Btn variant="secondary" onClick={() => setAdding(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          rows.length === 0 ? <div className="p-6"><EmptyState icon={Users}>No crew assigned yet.</EmptyState></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left">Crew</th><th className="px-3 py-2.5 text-left">Role</th>
                  <th className="px-3 py-2.5 text-left">Dates</th><th className="px-3 py-2.5 text-left">Location</th>
                  <th className="px-3 py-2.5 text-right">Rate</th><th className="px-3 py-2.5 text-left">Deal memo</th>
                  <th className="px-3 py-2.5 text-left">NDA</th><th className="px-3 py-2.5 text-right"></th>
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800 flex items-center gap-1.5">
                          {r.name}
                          {r.crewMember && r.crewMember.isLocal === false && <Plane size={11} className="text-blue-500" />}
                        </div>
                        {r.crewMember ? (
                          <Link href={`/production/crew/${r.crewMember.id}`} className="text-[11px] text-brand-600 hover:underline flex items-center gap-0.5">
                            {r.crewMember.department || 'Directory'} <ExternalLink size={9} />
                          </Link>
                        ) : <span className="text-[11px] text-gray-400">Ad-hoc</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{r.roleTitle || String(r.role).replace(/_/g, ' ')}{r.department && <span className="block text-[10px] text-gray-400">{r.department}</span>}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">
                        {r.startDate ? formatDate(r.startDate) : '—'}{r.endDate ? ` → ${formatDate(r.endDate)}` : ''}
                        {r.lifecycleState && r.lifecycleState !== 'UNDATED' && (
                          <span className={cn('ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                            r.lifecycleState === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700'
                            : r.lifecycleState === 'PRE_SHOOT' ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600')}>
                            {r.lifecycleState === 'PRE_SHOOT' ? 'Prep' : r.lifecycleState === 'ACTIVE' ? 'Active' : 'Wrapped'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{r.location || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">
                        {r.dailyRate ? `${money(r.dailyRate)}/day` : r.weeklyRate ? `${money(r.weeklyRate)}/wk` : '—'}
                        {r.dailyRate && r.totalDays ? <div className="text-[10px] text-gray-400">×{r.totalDays} = {money(Number(r.dailyRate) * r.totalDays)}</div> : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <select value={r.dealMemoStatus || 'NOT_SENT'} onChange={e => setStatus(r.id, 'dealMemoStatus', e.target.value)}
                          className={cn('text-[11px] rounded-full px-2 py-0.5 border-0 cursor-pointer', DEAL_META[r.dealMemoStatus || 'NOT_SENT'].cls)}>
                          {Object.keys(DEAL_META).map(k => <option key={k} value={k}>{DEAL_META[k].label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <select value={r.ndaStatus || 'NOT_REQUIRED'} onChange={e => setStatus(r.id, 'ndaStatus', e.target.value)}
                          className={cn('text-[11px] rounded-full px-2 py-0.5 border-0 cursor-pointer', NDA_META[r.ndaStatus || 'NOT_REQUIRED'].cls)}>
                          {Object.keys(NDA_META).map(k => <option key={k} value={k}>{NDA_META[k].label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => window.open(`/print/dealmemo/${r.id}`, '_blank')} title="Deal memo PDF" className="text-gray-400 hover:text-brand-600 mr-2"><FileText size={14} /></button>
                        <button onClick={() => emailMemo(r)} title="Email deal memo" className="text-gray-400 hover:text-brand-600 mr-2"><Mail size={14} /></button>
                        <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
