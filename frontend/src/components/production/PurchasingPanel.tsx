'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, FileText, Building2, CheckCircle, Ban, Receipt, GitBranch, Link2, RefreshCw, Search, X, Download, ScanLine, Copy } from 'lucide-react';
import { productionApi, approvalsApi, assetUrl } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Btn, Chip, EmptyState, inputCls } from './ui';

const PO_TONE: Record<string, string> = {
  DRAFT: 'slate', SUBMITTED: 'need', REJECTED: 'risk',
  APPROVED: 'money', PARTIALLY_INVOICED: 'need', CLOSED: 'money', CANCELLED: 'risk',
};

export default function PurchasingPanel({ projectId, currency = 'AED', accounts = [] }:
  { projectId: string; currency?: string; accounts?: { code: string; title: string }[] }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [view, setView] = useState<'pos' | 'vendors' | 'onboarding'>('pos');
  const [pos, setPos] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPo, setAddingPo] = useState(false);
  const [addingVendor, setAddingVendor] = useState(false);
  const [po, setPo] = useState<any>({ vendorId: '', costCenterCode: '', description: '', amount: '', taxAmount: '', expectedDate: '', status: 'APPROVED' });
  const [vendor, setVendor] = useState<any>({ name: '', category: '', contactName: '', phone: '', email: '', trn: '' });
  // Add-from-suppliers picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  // Vendor self-onboarding
  const [pending, setPending] = useState<any[]>([]);
  const [invite, setInvite] = useState<any>(null);
  const [inviting, setInviting] = useState(false);

  const loadPending = useCallback(() => {
    productionApi.vendorOnboarding.pending(projectId).then(r => setPending(r.data || [])).catch(() => {});
  }, [projectId]);
  const genInvite = async () => {
    setInviting(true);
    try { const r = await productionApi.vendorOnboarding.invite(projectId, 72); setInvite(r.data); }
    catch (e: any) { alert(e?.response?.data?.message || 'Could not generate link.'); }
    finally { setInviting(false); }
  };
  const copyInvite = () => { if (invite?.url) { navigator.clipboard?.writeText(invite.url); alert('Onboarding link copied to clipboard.'); } };
  const approvePending = async (id: string) => {
    if (!confirm('Approve this vendor? A company supplier record and a linked project vendor will be created.')) return;
    try { await productionApi.vendorOnboarding.approve(id); loadPending(); load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Approval failed.'); }
  };
  const rejectPending = async (id: string) => { if (confirm('Reject this submission?')) { await productionApi.vendorOnboarding.reject(id); loadPending(); } };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productionApi.costing.pos(projectId), productionApi.costing.vendors(projectId)])
      .then(([p, v]) => { setPos(p.data || []); setVendors(v.data || []); }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (view === 'onboarding') loadPending(); }, [view, loadPending]);

  const savePo = async () => {
    if (!po.description || !po.amount) return;
    const acct = accounts.find(a => a.code === po.costCenterCode);
    await productionApi.costing.createPo({
      projectId, currency, vendorId: po.vendorId || undefined, description: po.description,
      costCenterCode: po.costCenterCode || undefined, costCenterTitle: acct?.title || undefined,
      amount: Number(po.amount), taxAmount: Number(po.taxAmount) || 0,
      expectedDate: po.expectedDate || undefined, status: po.status,
    });
    setAddingPo(false); setPo({ vendorId: '', costCenterCode: '', description: '', amount: '', taxAmount: '', expectedDate: '', status: 'APPROVED' });
    load();
  };
  const setPoStatus = async (id: string, status: string) => { await productionApi.costing.setPoStatus(id, status); load(); };
  const invoice = async (p: any) => {
    const remaining = Number(p.total) - Number(p.invoicedAmount);
    const num = prompt(`Vendor invoice number (required):`, '');
    if (num == null) return;
    if (!num.trim()) { alert('An invoice number is required to record the payable.'); return; }
    const raw = prompt(`Invoice amount (remaining ${money(remaining)}):`, String(remaining));
    if (raw == null) return;
    const date = prompt('Invoice date (YYYY-MM-DD, blank = today):', '') || undefined;
    try { await productionApi.costing.invoicePo(p.id, { amount: Number(raw), invoiceNumber: num.trim(), invoiceDate: date }); alert('Payable recorded. Attach the vendor invoice file on the cost in the Ledger, then it can be paid.'); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not record the invoice.'); }
  };
  const removePo = async (id: string) => { if (confirm('Delete this PO?')) { await productionApi.costing.removePo(id); load(); } };
  const scanInvoice = (p: any) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf,image/*';
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      try {
        const r = await productionApi.costing.uploadInvoice(p.id, f);
        const ex = r.data.extracted || {}, m = r.data.match || {};
        alert(
          `Invoice read & drafted for review:\n\n` +
          `Vendor: ${ex.vendorName || '—'}\n` +
          `Total: ${money(ex.total)}\n` +
          `Invoice #: ${ex.invoiceNumber || '—'}\n` +
          `PO ref on invoice: ${m.poRefOnInvoice || '—'} ${m.poRefMatches ? '✓ matches' : '⚠ verify'}\n` +
          `Within PO remaining: ${m.amountWithinRemaining ? 'yes' : '⚠ exceeds'}\n\n` +
          `It's a DRAFT cost — review & approve it in the Accounting tab.`
        );
        load();
      } catch (e: any) { alert(e?.response?.data?.message || 'Invoice OCR failed.'); }
    };
    inp.click();
  };
  const routePo = async (id: string) => {
    try {
      await productionApi.costing.submitPoApproval(id);
      alert('Submitted to the approval workflow. Approvers see it in Production → My Approvals; the PO is committed once every step approves, or returns as REJECTED.');
      load();
    } catch (e: any) { alert(e.response?.data?.message || 'Could not submit for approval.'); }
  };
  const revisePo = async (id: string) => { try { await productionApi.costing.revisePo(id); load(); } catch (e: any) { alert(e.response?.data?.message || 'Failed.'); } };

  const saveVendor = async () => {
    if (!vendor.name) return;
    await productionApi.costing.createVendor({ projectId, ...vendor });
    setAddingVendor(false); setVendor({ name: '', category: '', contactName: '', phone: '', email: '', trn: '' });
    load();
  };
  const removeVendor = async (id: string) => { if (confirm('Delete vendor?')) { await productionApi.costing.removeVendor(id); load(); } };
  const refreshVendor = async (id: string) => {
    try { await productionApi.costing.refreshVendor(id); load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Could not refresh from supplier.'); }
  };

  const openPicker = async () => {
    setPickerOpen(true); setSelected(new Set()); setSearch(''); setCatalogLoading(true);
    try { const r = await productionApi.costing.supplierCatalog(projectId); setCatalog(r.data || []); }
    catch { setCatalog([]); } finally { setCatalogLoading(false); }
  };
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filtered = catalog.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.tradeName, s.supplierCode, s.category, ...(s.categories || []), s.city].filter(Boolean).join(' ').toLowerCase().includes(q);
  });
  const importSuppliers = async (ids: string[]) => {
    if (ids.length === 0) return;
    setImporting(true);
    try {
      const r = await productionApi.costing.addFromSuppliers(projectId, ids);
      setPickerOpen(false);
      const added = r.data?.added ?? 0, skipped = r.data?.skipped ?? 0;
      if (skipped > 0) alert(`Imported ${added} supplier${added === 1 ? '' : 's'}. ${skipped} already linked — skipped.`);
      load();
    } catch (e: any) { alert(e?.response?.data?.message || 'Import failed.'); }
    finally { setImporting(false); }
  };
  const selectableCount = filtered.filter(s => !s.linked).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setView('pos')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'pos' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Purchase Orders</button>
          <button onClick={() => setView('vendors')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'vendors' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Vendors</button>
          <button onClick={() => setView('onboarding')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'onboarding' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Onboarding{pending.length > 0 ? ` (${pending.length})` : ''}</button>
        </div>
        {view === 'pos' && <Btn variant="primary" onClick={() => setAddingPo(a => !a)}><Plus size={13} /> New PO</Btn>}
        {view === 'vendors' && (
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={openPicker}><Building2 size={13} /> Add from suppliers</Btn>
            <Btn variant="primary" onClick={() => setAddingVendor(a => !a)}><Plus size={13} /> Add one-off</Btn>
          </div>
        )}
        {view === 'onboarding' && <Btn variant="primary" onClick={genInvite} disabled={inviting}><Link2 size={13} /> {inviting ? 'Generating…' : 'Generate invite link'}</Btn>}
      </div>

      {view === 'pos' && (
        <>
          {addingPo && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="label text-xs">Vendor</label>
                  <select className={inputCls} value={po.vendorId} onChange={e => setPo((f: any) => ({ ...f, vendorId: e.target.value }))}>
                    <option value="">— Select —</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2"><label className="label text-xs">Description *</label><input className={inputCls} value={po.description} onChange={e => setPo((f: any) => ({ ...f, description: e.target.value }))} /></div>
                <div><label className="label text-xs">Cost center</label>
                  <select className={inputCls} value={po.costCenterCode} onChange={e => setPo((f: any) => ({ ...f, costCenterCode: e.target.value }))}>
                    <option value="">— None —</option>{accounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}
                  </select>
                </div>
                <div><label className="label text-xs">Amount ({currency})</label><input type="number" className={inputCls} value={po.amount} onChange={e => setPo((f: any) => ({ ...f, amount: e.target.value }))} /></div>
                <div><label className="label text-xs">Tax</label><input type="number" className={inputCls} value={po.taxAmount} onChange={e => setPo((f: any) => ({ ...f, taxAmount: e.target.value }))} /></div>
                <div><label className="label text-xs">Expected</label><input type="date" className={inputCls} value={po.expectedDate} onChange={e => setPo((f: any) => ({ ...f, expectedDate: e.target.value }))} /></div>
                <div><label className="label text-xs">Status</label>
                  <select className={inputCls} value={po.status} onChange={e => setPo((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="DRAFT">Draft</option><option value="APPROVED">Approved (committed)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-3"><Btn variant="primary" onClick={savePo}>Create PO</Btn><Btn variant="secondary" onClick={() => setAddingPo(false)}>Cancel</Btn></div>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
              pos.length === 0 ? <div className="p-6"><EmptyState icon={FileText}>No purchase orders yet.</EmptyState></div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left">PO</th><th className="px-3 py-2.5 text-left">Vendor</th>
                    <th className="px-3 py-2.5 text-left">Cost Center</th><th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-3 py-2.5 text-right">Invoiced</th><th className="px-3 py-2.5 text-left">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
                  </tr></thead>
                  <tbody>
                    {pos.map(p => {
                      const remaining = Number(p.total) - Number(p.invoicedAmount);
                      return (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                          <td className="px-4 py-2.5"><div className="font-mono text-xs text-gray-700">{p.poNumber}</div><div className="text-[11px] text-gray-400">{p.description}</div></td>
                          <td className="px-3 py-2.5 text-gray-600 text-xs">{p.vendorName || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{p.costCenterCode ? `${p.costCenterCode} · ${p.costCenterTitle || ''}` : '—'}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-800">{money(p.total)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-500">{money(p.invoicedAmount)}</td>
                          <td className="px-3 py-2.5"><Chip tone={PO_TONE[p.status] || 'slate'}>{p.status.replace(/_/g, ' ')}</Chip></td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            {p.status === 'DRAFT' && <button onClick={() => routePo(p.id)} title="Route for approval" className="text-brand-600 hover:text-brand-700 mr-2"><GitBranch size={14} /></button>}
                            {p.status === 'DRAFT' && <button onClick={() => setPoStatus(p.id, 'APPROVED')} title="Approve directly (skip workflow)" className="text-blue-500 hover:text-blue-700 mr-2"><CheckCircle size={14} /></button>}
                            {p.status === 'SUBMITTED' && <span className="text-[10px] text-indigo-600 mr-2" title="Awaiting approvers in My Approvals">in approval…</span>}
                            {p.status === 'REJECTED' && <button onClick={() => revisePo(p.id)} title="Rejected — revise & resubmit" className="text-amber-600 hover:text-amber-700 mr-2 text-[11px] font-semibold">Revise</button>}
                            {['APPROVED', 'PARTIALLY_INVOICED'].includes(p.status) && <button onClick={() => scanInvoice(p)} title="Scan invoice (OCR → draft cost)" className="text-violet-500 hover:text-violet-700 mr-2"><ScanLine size={14} /></button>}
                            {['APPROVED', 'PARTIALLY_INVOICED'].includes(p.status) && remaining > 0 && <button onClick={() => invoice(p)} title="Invoice" className="text-green-600 hover:text-green-700 mr-2"><Receipt size={14} /></button>}
                            {!['CLOSED', 'CANCELLED'].includes(p.status) && <button onClick={() => setPoStatus(p.id, 'CANCELLED')} title="Cancel" className="text-gray-400 hover:text-red-600 mr-2"><Ban size={13} /></button>}
                            <button onClick={() => removePo(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}

      {view === 'vendors' && (
        <>
          {addingVendor && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className="label text-xs">Name *</label><input className={inputCls} value={vendor.name} onChange={e => setVendor((f: any) => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label text-xs">Category</label><input className={inputCls} value={vendor.category} onChange={e => setVendor((f: any) => ({ ...f, category: e.target.value }))} placeholder="Equipment, Catering…" /></div>
                <div><label className="label text-xs">Contact</label><input className={inputCls} value={vendor.contactName} onChange={e => setVendor((f: any) => ({ ...f, contactName: e.target.value }))} /></div>
                <div><label className="label text-xs">Phone</label><input className={inputCls} value={vendor.phone} onChange={e => setVendor((f: any) => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="label text-xs">Email</label><input className={inputCls} value={vendor.email} onChange={e => setVendor((f: any) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label text-xs">TRN</label><input className={inputCls} value={vendor.trn} onChange={e => setVendor((f: any) => ({ ...f, trn: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 mt-3"><Btn variant="primary" onClick={saveVendor}>Add vendor</Btn><Btn variant="secondary" onClick={() => setAddingVendor(false)}>Cancel</Btn></div>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
              vendors.length === 0 ? <div className="p-6"><EmptyState icon={Building2}>No vendors yet.</EmptyState></div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left">Vendor</th><th className="px-3 py-2.5 text-left">Category</th>
                    <th className="px-3 py-2.5 text-left">Contact</th><th className="px-3 py-2.5 text-left">TRN</th>
                    <th className="px-3 py-2.5 text-left">Source</th><th className="px-3 py-2.5"></th>
                  </tr></thead>
                  <tbody>
                    {vendors.map(v => (
                      <tr key={v.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{v.name}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{v.category || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{[v.contactName, v.phone || v.email].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs font-mono">{v.trn || '—'}</td>
                        <td className="px-3 py-2.5">
                          {v.supplierId
                            ? <Chip tone="money"><span className="inline-flex items-center gap-1"><Link2 size={11} /> Linked supplier</span></Chip>
                            : <Chip tone="slate">One-off</Chip>}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {v.supplierId && <button onClick={() => refreshVendor(v.id)} title="Refresh details from supplier master" className="text-gray-300 hover:text-brand-600 mr-2"><RefreshCw size={13} /></button>}
                          <button onClick={() => removeVendor(v.id)} title="Remove from project" className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}

      {view === 'onboarding' && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-gray-600">Send a vendor a secure, time-limited link to submit their own company, TRN, banking and document details. Submissions land below for your approval — no manual data entry.</p>
            {invite && (
              <div className="mt-2 flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <input readOnly value={invite.url} className={cn(inputCls, 'flex-1 font-mono')} onFocus={e => e.currentTarget.select()} />
                <Btn variant="secondary" onClick={copyInvite}><Copy size={12} /> Copy</Btn>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">expires in {invite.hours}h</span>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {pending.length === 0 ? <div className="p-6"><EmptyState icon={Building2}>No vendor submissions waiting.</EmptyState></div> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left">Company</th><th className="px-3 py-2.5 text-left">TRN</th>
                  <th className="px-3 py-2.5 text-left">Banking</th><th className="px-3 py-2.5 text-left">Docs</th><th className="px-3 py-2.5 text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {pending.map(v => (
                    <tr key={v.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5"><div className="font-medium text-gray-800">{v.tradeName || v.name}</div><div className="text-[11px] text-gray-400">{[v.contactName, v.email || v.phone].filter(Boolean).join(' · ')}</div></td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs font-mono">{v.trn || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{v.iban ? <span className="font-mono">{v.iban}</span> : '—'}{v.bankName ? <div className="text-[10px] text-gray-400">{v.bankName}</div> : null}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {v.trnCertUrl ? <a href={assetUrl(v.trnCertUrl)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline mr-2">TRN</a> : null}
                        {v.tradeLicenseUrl ? <a href={assetUrl(v.tradeLicenseUrl)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Licence</a> : null}
                        {!v.trnCertUrl && !v.tradeLicenseUrl && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => approvePending(v.id)} title="Approve → create vendor" className="text-green-600 hover:text-green-700 mr-2"><CheckCircle size={15} /></button>
                        <button onClick={() => rejectPending(v.id)} title="Reject" className="text-gray-300 hover:text-red-500"><Ban size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !importing && setPickerOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div>
                <div className="font-semibold text-gray-800 text-sm">Add from company suppliers</div>
                <div className="text-[11px] text-gray-400">Suppliers stay managed on the Partners tab. Imported vendors link back to that master.</div>
              </div>
              <button onClick={() => setPickerOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-3 border-b border-gray-50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 z-10" />
                <input autoFocus className={cn(inputCls, 'pl-8')} placeholder="Search suppliers by name, code, category…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {catalogLoading ? <div className="p-10 text-center text-gray-400 text-sm">Loading suppliers…</div> :
                filtered.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm"><Building2 size={22} className="mx-auto mb-2 opacity-30" />{catalog.length === 0 ? 'No active suppliers on the Partners tab yet.' : 'No suppliers match your search.'}</div> : (
                  <ul className="divide-y divide-gray-50">
                    {filtered.map(s => (
                      <li key={s.id}>
                        <label className={cn('flex items-center gap-3 px-5 py-2.5', s.linked ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50/60')}>
                          <input type="checkbox" disabled={s.linked} checked={s.linked || selected.has(s.id)} onChange={() => toggle(s.id)} className="accent-brand-600" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 font-medium truncate">{s.tradeName || s.name}{s.supplierCode && <span className="text-[10px] text-gray-300 font-mono ml-2">{s.supplierCode}</span>}</div>
                            <div className="text-[11px] text-gray-400 truncate">{[(s.categories && s.categories[0]) || s.category, s.city, s.trn && `TRN ${s.trn}`].filter(Boolean).join(' · ') || '—'}</div>
                          </div>
                          {s.linked && <Chip tone="money"><span className="inline-flex items-center gap-1"><CheckCircle size={10} /> Added</span></Chip>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100">
              <div className="text-xs text-gray-400">{selected.size > 0 ? `${selected.size} selected` : `${selectableCount} available to add`}</div>
              <div className="flex gap-2">
                <Btn variant="secondary" disabled={importing || selectableCount === 0} onClick={() => importSuppliers(filtered.filter(s => !s.linked).map(s => s.id))}><Download size={13} /> Add all{search ? ' shown' : ''}</Btn>
                <Btn variant="primary" disabled={importing || selected.size === 0} onClick={() => importSuppliers([...selected])}>{importing ? 'Adding…' : `Add selected${selected.size ? ` (${selected.size})` : ''}`}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
