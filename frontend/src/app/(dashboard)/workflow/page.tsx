'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { statusApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Columns, BarChart3, AlertTriangle, RefreshCw,
  TrendingUp, Clock, Wrench, Truck, FileText, DollarSign,
  CheckCircle2, AlertCircle, ChevronRight, ArrowRight,
} from 'lucide-react';
import {
  StatusModule, getStatusDef, getAllowedTransitions,
  WORKFLOW_TRANSITIONS, STATUS_CONFIGS,
} from '@/lib/statusConfig';
import StatusChangeModal from '@/components/StatusChangeModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MODULE_TABS: { id: StatusModule; label: string; icon: any; color: string; detailPath: string }[] = [
  { id: 'Quotation',   label: 'Quotations',   icon: FileText,  color: 'text-blue-600',   detailPath: '/finance/quotations' },
  { id: 'Invoice',     label: 'Invoices',     icon: DollarSign,color: 'text-green-600',  detailPath: '/finance/invoices' },
  { id: 'Booking',     label: 'Bookings',     icon: Truck,     color: 'text-purple-600', detailPath: '/rental/bookings' },
  { id: 'Asset',       label: 'Assets',       icon: Truck,     color: 'text-orange-600', detailPath: '/rental/assets' },
  { id: 'Maintenance', label: 'Maintenance',  icon: Wrench,    color: 'text-red-600',    detailPath: '/maintenance/jobs' },
];

const VIEWS = ['kanban', 'analytics', 'kpi'] as const;
type View = typeof VIEWS[number];

function daysAgo(n: number) {
  if (n === 0) return 'today';
  if (n === 1) return '1 day';
  return `${n} days`;
}

function cardTitle(m: StatusModule, r: any) {
  switch (m) {
    case 'Invoice':     return r.invoiceNumber;
    case 'Quotation':   return r.quotationNumber;
    case 'Booking':     return r.bookingNumber;
    case 'Asset':       return r.name;
    case 'Maintenance': return r.jobNumber;
  }
}
function cardSub(m: StatusModule, r: any) {
  switch (m) {
    case 'Invoice':     return r.client?.companyName;
    case 'Quotation':   return r.client?.companyName;
    case 'Booking':     return r.client?.companyName;
    case 'Asset':       return r.assetType?.replace(/_/g, ' ');
    case 'Maintenance': return r.asset?.name ?? r.vendor?.name;
  }
}
function cardAmount(m: StatusModule, r: any) {
  if (m === 'Invoice')   return formatCurrency(r.amountDue > 0 ? r.amountDue : r.total);
  if (m === 'Quotation') return formatCurrency(r.total);
  if (m === 'Booking')   return formatCurrency(r.total);
  return null;
}
function detailPath(m: StatusModule, r: any) {
  const base = MODULE_TABS.find(t => t.id === m)!.detailPath;
  return `${base}/${r.id}`;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, urgent }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; urgent?: boolean;
}) {
  return (
    <div className={`card p-5 flex items-start gap-4 ${urgent ? 'border-red-200 bg-red-50' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${urgent ? 'bg-red-100' : 'bg-gray-100'}`}>
        <Icon size={18} className={urgent ? 'text-red-600' : color} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({ module, record, onDragStart }: {
  module: StatusModule; record: any; onDragStart: (r: any) => void;
}) {
  const title = cardTitle(module, record);
  const sub   = cardSub(module, record);
  const amt   = cardAmount(module, record);
  const days  = record.daysInStatus ?? 0;
  const isStuck = days > 7;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(record)}
      className={`bg-white rounded-lg border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none
        ${isStuck ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-gray-900 leading-snug truncate">{title}</p>
        <Link href={detailPath(module, record)} className="text-gray-300 hover:text-brand-500 flex-shrink-0" title="Open">
          <ChevronRight size={12} />
        </Link>
      </div>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{sub}</p>}
      <div className="flex items-center justify-between mt-2 gap-2">
        {amt && <span className="text-[10px] font-semibold text-gray-700">{amt}</span>}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto ${isStuck ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
          {daysAgo(days)}
        </span>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ module, status, records, onDrop, isDragTarget, onDragOver, onDragLeave, onDragStart }: {
  module: StatusModule; status: string; records: any[];
  onDrop: (status: string) => void;
  isDragTarget: boolean;
  onDragOver: (status: string) => void;
  onDragLeave: () => void;
  onDragStart: (r: any) => void;
}) {
  const def = getStatusDef(module, status);
  return (
    <div
      className={`flex flex-col min-w-[200px] max-w-[220px] rounded-xl border-2 transition-all ${
        isDragTarget ? 'border-brand-400 bg-brand-50 scale-[1.01]' : 'border-gray-200 bg-gray-50'
      }`}
      onDragOver={e => { e.preventDefault(); onDragOver(status); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(status); }}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-gray-200">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: def.dot }} />
        <span className="text-xs font-bold text-gray-700 truncate flex-1">{def.label}</span>
        <span className="text-[10px] font-semibold bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-gray-500 flex-shrink-0">
          {records.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 80 }}>
        {records.map(r => (
          <KanbanCard key={r.id} module={module} record={r} onDragStart={onDragStart} />
        ))}
        {records.length === 0 && (
          <div className="text-center text-[10px] text-gray-300 py-6">Empty</div>
        )}
      </div>
    </div>
  );
}

// ── Analytics Bar Chart ───────────────────────────────────────────────────────

function AnalyticsView({ module }: { module: StatusModule }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    statusApi.analytics(module)
      .then(r => setData(r.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [module]);

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading analytics…</div>;
  if (!data.length) return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
      <Clock size={32} className="opacity-30" />
      <p className="text-sm">No status change history yet. Analytics populate as records move through workflow.</p>
    </div>
  );

  const max = Math.max(...data.map(d => d.avgDays), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{data.length}</p>
          <p className="text-xs text-gray-500">Statuses tracked</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-brand-700">{data[0]?.status.replace(/_/g,' ')}</p>
          <p className="text-xs text-gray-500">Longest avg wait</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-green-600">{data[0]?.avgDays}d</p>
          <p className="text-xs text-gray-500">Avg days (worst)</p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <BarChart3 size={15} /> Average Days Per Status
        </h3>
        <div className="space-y-3">
          {data.map(d => {
            const def = getStatusDef(module, d.status);
            const pct = Math.round((d.avgDays / max) * 100);
            const isBottleneck = d.avgDays > 5;
            return (
              <div key={d.status}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{def.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{def.label}</span>
                    {isBottleneck && <AlertTriangle size={11} className="text-orange-500" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>avg <strong className="text-gray-900">{d.avgDays}d</strong></span>
                    <span>max {d.maxDays}d</span>
                    <span>{d.count} transitions</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: isBottleneck ? '#f97316' : def.dot,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowPage() {
  const [view, setView]         = useState<View>('kpi');
  const [module, setModule]     = useState<StatusModule>('Quotation');
  const [kpi, setKpi]           = useState<any>(null);
  const [kanbanData, setKanban] = useState<any[]>([]);
  const [loadingKpi, setLKpi]   = useState(true);
  const [loadingKanban, setLK]  = useState(false);

  // Drag state
  const [dragging, setDragging]       = useState<any>(null);
  const [dragTarget, setDragTarget]   = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ record: any; toStatus: string } | null>(null);

  // Load KPI once
  useEffect(() => {
    statusApi.kpi()
      .then(r => setKpi(r.data))
      .catch(() => {})
      .finally(() => setLKpi(false));
  }, []);

  // Load Kanban when module changes (and view is kanban)
  useEffect(() => {
    if (view !== 'kanban') return;
    setLK(true);
    statusApi.kanban(module)
      .then(r => setKanban(Array.isArray(r.data) ? r.data : []))
      .catch(() => setKanban([]))
      .finally(() => setLK(false));
  }, [module, view]);

  // Group kanban records by status
  const statuses = Object.keys(STATUS_CONFIGS[module] ?? {});
  const byStatus = statuses.reduce<Record<string, any[]>>((acc, s) => {
    acc[s] = kanbanData.filter(r => r.status === s);
    return acc;
  }, {});

  const handleDrop = (toStatus: string) => {
    if (!dragging || dragging.status === toStatus) { setDragging(null); setDragTarget(null); return; }
    const allowed = getAllowedTransitions(module, dragging.status);
    if (!allowed.includes(toStatus)) { setDragging(null); setDragTarget(null); return; }
    setStatusModal({ record: dragging, toStatus });
    setDragging(null); setDragTarget(null);
  };

  const handleStatusConfirm = async (newStatus: string, notes: string) => {
    if (!statusModal) return;
    await statusApi.updateStatus(module, statusModal.record.id, newStatus, notes);
    // Update local kanban state
    setKanban(prev => prev.map(r =>
      r.id === statusModal.record.id ? { ...r, status: newStatus, daysInStatus: 0 } : r
    ));
    setStatusModal(null);
  };

  const pendingApprovalCount = kpi
    ? kpi.finance.pendingApprovalInvoices + kpi.finance.pendingApprovalExpenses
    : 0;

  return (
    <div className="p-6 max-w-full">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Columns size={22} className="text-brand-600" /> Workflow
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Status boards · KPI dashboard · Analytics</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['kpi','KPI Dashboard'], ['kanban','Kanban Board'], ['analytics','Analytics']] as [View,string][]).map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ══ KPI DASHBOARD ══ */}
      {view === 'kpi' && (
        <div className="space-y-6">
          {loadingKpi ? (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}
            </div>
          ) : kpi ? (
            <>
              {/* Alerts row */}
              {(kpi.finance.overdueInvoices > 0 || pendingApprovalCount > 0) && (
                <div className="flex gap-3 flex-wrap">
                  {kpi.finance.overdueInvoices > 0 && (
                    <Link href="/finance/invoices" className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-100 transition-colors">
                      <AlertCircle size={15} />
                      <strong>{kpi.finance.overdueInvoices}</strong> overdue invoice{kpi.finance.overdueInvoices !== 1 ? 's' : ''} need attention
                      <ArrowRight size={13} />
                    </Link>
                  )}
                  {pendingApprovalCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                      <AlertTriangle size={15} />
                      <strong>{pendingApprovalCount}</strong> items pending approval
                    </div>
                  )}
                </div>
              )}

              {/* Finance KPIs */}
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Finance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Overdue Invoices"    value={kpi.finance.overdueInvoices}    icon={AlertCircle}  color="text-red-500"   urgent={kpi.finance.overdueInvoices > 0} />
                  <KpiCard label="Pending Approval"    value={kpi.finance.pendingApprovalInvoices} icon={Clock}   color="text-amber-500" />
                  <KpiCard label="Outstanding (AED)"   value={`AED ${(kpi.finance.totalOutstandingAED/1000).toFixed(0)}k`} icon={DollarSign} color="text-blue-500" sub="Invoices not yet paid" />
                  <KpiCard label="Collected (30 days)" value={`AED ${(kpi.finance.paidLast30dAED/1000).toFixed(0)}k`} icon={TrendingUp}  color="text-green-500" sub="Revenue last 30 days" />
                </div>
              </div>

              {/* Rental KPIs */}
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Rental</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Active Hires"   value={kpi.rental.activeHires}     icon={Truck}         color="text-green-500" sub="Currently on hire" />
                  <KpiCard label="Scheduled"      value={kpi.rental.scheduledBookings} icon={CheckCircle2} color="text-blue-500"  sub="Upcoming deliveries" />
                  <KpiCard label="Available Fleet" value={kpi.assets?.availableAssets ?? 0} icon={Truck}         color="text-teal-500"  sub="Assets ready to hire" />
                  <KpiCard label="Damaged / OOS"  value={kpi.assets?.damagedAssets ?? 0}    icon={AlertTriangle} color="text-red-500"   urgent={(kpi.assets?.damagedAssets ?? 0) > 0} sub="Need attention" />
                </div>
              </div>

              {/* Maintenance KPIs */}
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Maintenance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Open Jobs"        value={kpi.maintenance.openJobs}          icon={Wrench}       color="text-purple-500" />
                  <KpiCard label="Waiting for Parts" value={kpi.maintenance.waitingForParts}  icon={Clock}        color="text-orange-500" urgent={kpi.maintenance.waitingForParts > 0} />
                  <KpiCard label="Status Changes (7d)" value={kpi.activity.statusChangesLast7d} icon={BarChart3} color="text-gray-500" sub="Workflow activity" />
                  <KpiCard label="Expense Approvals" value={kpi.finance.pendingApprovalExpenses} icon={FileText}  color="text-amber-500" />
                </div>
              </div>

              {/* Quick links */}
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Access</h2>
                <div className="flex flex-wrap gap-3">
                  {MODULE_TABS.map(t => (
                    <button key={t.id} onClick={() => { setModule(t.id); setView('kanban'); }}
                      className="btn-secondary flex items-center gap-2 text-sm">
                      <Columns size={13} />
                      {t.label} Board
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-12 space-y-3">
              <BarChart3 size={36} className="mx-auto opacity-20" />
              <p className="text-sm">Could not load KPI data.</p>
              <p className="text-xs">Make sure the backend is running and run <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">npx prisma db push</code> in the backend folder to apply the latest schema changes.</p>
              <button onClick={() => { setLKpi(true); statusApi.kpi().then(r => setKpi(r.data)).catch(() => {}).finally(() => setLKpi(false)); }}
                className="btn-secondary text-sm mx-auto flex items-center gap-2">
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ KANBAN BOARD ══ */}
      {view === 'kanban' && (
        <div className="space-y-4">
          {/* Module selector */}
          <div className="flex gap-1 flex-wrap">
            {MODULE_TABS.map(t => (
              <button key={t.id} onClick={() => setModule(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  module === t.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <t.icon size={13} className={module === t.id ? 'text-white' : t.color} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-300 inline-block" /> Stuck &gt; 7 days</span>
            <span className="flex items-center gap-1"><span className="text-gray-400">Drag card → drop on column to change status</span></span>
          </div>

          {loadingKanban ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="min-w-[200px] h-64 card animate-pulse bg-gray-50 flex-shrink-0" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 min-w-max">
                {statuses.map(s => (
                  <KanbanColumn
                    key={s}
                    module={module}
                    status={s}
                    records={byStatus[s] ?? []}
                    isDragTarget={dragTarget === s}
                    onDragOver={setDragTarget}
                    onDragLeave={() => setDragTarget(null)}
                    onDrop={handleDrop}
                    onDragStart={r => setDragging(r)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ANALYTICS ══ */}
      {view === 'analytics' && (
        <div className="space-y-4">
          {/* Module selector */}
          <div className="flex gap-1 flex-wrap">
            {MODULE_TABS.map(t => (
              <button key={t.id} onClick={() => setModule(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  module === t.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <t.icon size={13} className={module === t.id ? 'text-white' : t.color} />
                {t.label}
              </button>
            ))}
          </div>
          <AnalyticsView key={module} module={module} />
        </div>
      )}

      {/* ── Status change modal (from Kanban drag) ── */}
      {statusModal && (
        <StatusChangeModal
          module={module}
          currentStatus={statusModal.record.status}
          recordRef={cardTitle(module, statusModal.record) ?? ''}
          onConfirm={handleStatusConfirm}
          onClose={() => setStatusModal(null)}
        />
      )}
    </div>
  );
}
