'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { productionApi, laborApi, castingApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import CallSheetsPanel from '@/components/production/CallSheetsPanel';
import CrewAssignmentsPanel from '@/components/production/CrewAssignmentsPanel';
import PerDiemPanel from '@/components/production/PerDiemPanel';
import OveragesPanel from '@/components/production/OveragesPanel';
import EndCreditsPanel from '@/components/production/EndCreditsPanel';
import AccountingPanel from '@/components/production/AccountingPanel';
import CostReportPanel from '@/components/production/CostReportPanel';
import PurchasingPanel from '@/components/production/PurchasingPanel';
import CashPanel from '@/components/production/CashPanel';
import FinanceSummaryStrip from '@/components/production/FinanceSummaryStrip';
import StripboardPanel from '@/components/production/StripboardPanel';
import OverviewPanel from '@/components/production/OverviewPanel';
import DocumentsPanel from '@/components/production/DocumentsPanel';
import ProjectEmailPanel from '@/components/production/ProjectEmailPanel';
import ProjectLaborPanel from '@/components/production/ProjectLaborPanel';
import FringeDetailPanel from '@/components/production/FringeDetailPanel';
import IncentivesPanel from '@/components/production/IncentivesPanel';
import WorkflowChecklist from '@/components/production/WorkflowChecklist';
import LocationsPanel from '@/components/production/LocationsPanel';
import LaborBlockEditor from '@/components/production/LaborBlockEditor';
import ProjectSettingsPanel from '@/components/production/ProjectSettingsPanel';
import TopsheetComparisonPanel from '@/components/production/TopsheetComparisonPanel';
import TravelPanel from '@/components/production/TravelPanel';
import ContractsPanel from '@/components/production/ContractsPanel';
import CastingPanel from '@/components/production/CastingPanel';
import AccommodationPanel from '@/components/production/AccommodationPanel';
import TransportPanel from '@/components/production/TransportPanel';
import ShuttlePanel from '@/components/production/ShuttlePanel';
import ArrivalsPanel from '@/components/production/ArrivalsPanel';
import LogisticsReportsPanel from '@/components/production/LogisticsReportsPanel';
import FuelPanel from '@/components/production/FuelPanel';
import BreakdownsTab from '@/components/production/BreakdownsTab';

// Stored section tier wins; fallback follows the industry numbering (1=ATL, 2–4=BTL, 5=POST, 6+=OTHER)
const tierOf = (code?: string, tier?: string | null) => tier || (!code ? 'OTHER' : code.startsWith('1') ? 'ATL' : ['2', '3', '4'].includes(code[0]) ? 'BTL' : code.startsWith('5') ? 'POST' : 'OTHER');
const TIER_CLS: Record<string, string> = { ATL: 'bg-purple-100 text-purple-700', BTL: 'bg-cyan-100 text-cyan-700', POST: 'bg-indigo-100 text-indigo-700', OTHER: 'bg-gray-100 text-gray-500' };
// ── Labor classification → budget tier heuristic (drives the per-section dropdown) ──
const CLASS_TIER: Record<string, string> = {
  DIRECTOR: 'ATL', WRITER: 'ATL', PRODUCER: 'ATL', PERFORMER: 'ATL', CAST: 'ATL',
  BG: 'BTL', STUNT: 'BTL', CREW: 'BTL', 'IATSE-CREW': 'BTL', DRIVER: 'BTL', ADSM: 'BTL', TEAMSTER: 'BTL',
  EDITOR: 'POST', POST: 'POST', VFX: 'POST',
};
const classTier = (code: string) =>
  CLASS_TIER[code] || (/IATSE|LOCAL|CREW|GRIP|ELEC|CAMERA|SOUND/i.test(code) ? 'BTL' : 'ANY');
const DEFAULT_CLASSES = ['PERFORMER', 'BG', 'STUNT', 'DIRECTOR', 'ADSM', 'WRITER', 'IATSE-CREW', 'CREW', 'DRIVER'];

/** Classification dropdown: project-snapshot codes, grouped by the section's tier, with Custom escape. */
function ClassificationSelect({ value, onChange, tier, options }:
  { value: string; onChange: (v: string) => void; tier: string; options: string[] }) {
  const [custom, setCustom] = useState(false);
  const all = Array.from(new Set([...(options.length ? options : DEFAULT_CLASSES), ...(value && !options.includes(value) ? [value] : [])]));
  const suggested = all.filter(c => { const t = classTier(c); return t === tier || t === 'ANY'; });
  const rest = all.filter(c => !suggested.includes(c));
  if (custom) return (
    <div className="flex items-center gap-1">
      <input autoFocus className="input text-[10px] py-0.5 h-6 w-full font-mono" placeholder="custom code"
        value={value} onChange={e => onChange(e.target.value.toUpperCase())} />
      <button type="button" onClick={() => setCustom(false)} className="text-[9px] text-gray-400 hover:text-gray-600 shrink-0">list</button>
    </div>
  );
  return (
    <select className="input text-[10px] py-0.5 h-6 w-full font-mono"
      value={all.includes(value) ? value : ''}
      onChange={e => { const v = e.target.value; if (v === '__custom__') setCustom(true); else onChange(v); }}>
      <option value="">— none (non-labor) —</option>
      {suggested.length > 0 && <optgroup label={`Suggested · ${tier}`}>{suggested.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>}
      {rest.length > 0 && <optgroup label="All classifications">{rest.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>}
      <option value="__custom__">Custom…</option>
    </select>
  );
}

/** Crew assignment dropdown for budget lines — lists project crew, stores the directory link. */
function CrewSelect({ value, onChange, crew }:
  { value: string; onChange: (crewId: string, assignment: any | null) => void; crew: any[] }) {
  return (
    <select className="input text-[10px] py-0.5 h-6 w-full" value={value || ''}
      onChange={e => { const v = e.target.value; const a = crew.find((c: any) => (c.crewMemberId || c.id) === v) || null; onChange(v, a); }}>
      <option value="">— assign crew —</option>
      {crew.map((c: any) => (
        <option key={c.id} value={c.crewMemberId || c.id}>
          {c.name}{c.roleTitle || c.department ? ` · ${c.roleTitle || c.department}` : ''}{c.dailyRate ? ` · ${Number(c.dailyRate)}/day` : ''}
        </option>
      ))}
    </select>
  );
}

/** Cast performer picker — links the line to a talent; backend auto-sets classificationCode from their union. */
function TalentSelect({ value, onChange, talent }:
  { value: string; onChange: (talentId: string) => void; talent: any[] }) {
  return (
    <select className="input text-[10px] py-0.5 h-6 w-full" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">— cast talent —</option>
      {talent.map((t: any) => (
        <option key={t.id} value={t.id}>{t.stageName || t.fullName}{t.unionStatus ? ` · ${t.unionStatus}` : ''}</option>
      ))}
    </select>
  );
}

const ORIGIN_META: Record<string, { label: string; cls: string }> = {
  AI_GENERATED: { label: 'AI', cls: 'bg-violet-100 text-violet-700' },
  SCRIPT_IMPORT: { label: 'Script', cls: 'bg-sky-100 text-sky-700' },
  AUTO_BREAKDOWN: { label: 'Breakdown', cls: 'bg-teal-100 text-teal-700' },
  MANUAL_OVERRIDE: { label: 'Edited', cls: 'bg-amber-100 text-amber-700' },
};
const stageSummary = (stages: any) => Array.isArray(stages) && stages.length
  ? stages.map((s: any) => `${({ PREP: 'Prep', SHOOT: 'Shoot', WRAP: 'Wrap', POST: 'Post' } as any)[s.stage] || s.stage} ${Number(s.qty)}${(s.unit || '').charAt(0).toLowerCase()}`).join(' · ')
  : '';
import {
  ArrowLeft, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Lock, Unlock, CheckCircle, Edit2, X, Save, Calculator, Users, Calendar,
  TrendingUp, FileDown, Printer, ClipboardList, Wallet, AlertTriangle, Film, BarChart3, ShoppingCart, Banknote, LayoutDashboard, FolderOpen, Mail, Scale, Layers, Gift, MapPin,
  Plane, FileSignature, Clapperboard, BedDouble, Car, Bus, Droplet,
} from 'lucide-react';

type Tab = 'settings' | 'overview' | 'budget' | 'topsheet' | 'actual' | 'costreport' | 'purchasing' | 'accounting' | 'cash' | 'callsheets' | 'globals' | 'crew' | 'perdiem' | 'overages' | 'credits' | 'schedule' | 'documents' | 'projectemail' | 'labor' | 'fringe' | 'incentives' | 'locations' | 'travel' | 'contracts' | 'casting' | 'accommodation' | 'transport' | 'shuttle' | 'arrivals' | 'fuel' | 'logistics' | 'breakdowns';

const TAB_META: Record<string, { label: string; icon: any }> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  budget: { label: 'Budget', icon: Calculator },
  topsheet: { label: 'Top Sheet', icon: CheckCircle },
  actual: { label: 'Budget vs Actual', icon: TrendingUp },
  costreport: { label: 'Cost Report', icon: BarChart3 },
  purchasing: { label: 'Purchasing', icon: ShoppingCart },
  accounting: { label: 'Ledger', icon: Wallet },
  cash: { label: 'Cash', icon: Banknote },
  fringe: { label: 'Fringe Detail', icon: Layers },
  incentives: { label: 'Incentives', icon: Gift },
  overages: { label: 'Overages', icon: AlertTriangle },
  labor: { label: 'Labor & Union', icon: Scale },
  globals: { label: 'Globals', icon: Edit2 },
  schedule: { label: 'Schedule', icon: Calendar },
  breakdowns: { label: 'Breakdowns', icon: Layers },
  callsheets: { label: 'Call Sheets', icon: ClipboardList },
  locations: { label: 'Locations', icon: MapPin },
  travel: { label: 'Travel & Visas', icon: Plane },
  contracts: { label: 'Contracts', icon: FileSignature },
  casting: { label: 'Casting', icon: Clapperboard },
  accommodation: { label: 'Accommodation', icon: BedDouble },
  transport: { label: 'Transport', icon: Car },
  shuttle: { label: 'Shuttle', icon: Bus },
  arrivals: { label: 'Arrivals', icon: Plane },
  fuel: { label: 'Fuel & rental', icon: Droplet },
  logistics: { label: 'Logistics report', icon: BarChart3 },
  crew: { label: 'Crew', icon: Users },
  perdiem: { label: 'Per Diem', icon: Wallet },
  credits: { label: 'End Credits', icon: Film },
  documents: { label: 'Documents', icon: FolderOpen },
  projectemail: { label: 'Email Sender', icon: Mail },
  settings: { label: 'Project Settings', icon: Edit2 },
};
// Domain-aligned grouping (SYS-06): each group = a business system, not a loose tab bin.
const TAB_GROUPS: { key: string; label: string; tabs: Tab[] }[] = [
  { key: 'overview', label: 'Overview', tabs: ['overview'] },
  { key: 'planning', label: 'Planning', tabs: ['schedule', 'breakdowns', 'callsheets'] },
  { key: 'money', label: 'Budget & Cost', tabs: ['budget', 'topsheet', 'fringe', 'incentives', 'overages'] },
  { key: 'acct', label: 'Accounting', tabs: ['actual', 'costreport', 'purchasing', 'accounting', 'cash'] },
  { key: 'workforce', label: 'Workforce', tabs: ['crew', 'perdiem'] },
  { key: 'locations', label: 'Locations', tabs: ['locations'] },
  { key: 'engagements', label: 'Engagements', tabs: ['travel', 'contracts', 'casting', 'accommodation', 'transport', 'shuttle', 'arrivals', 'fuel', 'logistics'] },
  { key: 'setup', label: 'Setup & Output', tabs: ['settings', 'labor', 'documents', 'credits'] },
];

const STATUS_COLORS: Record<string, string> = {
  DEVELOPMENT: 'bg-gray-100 text-gray-600',
  PRE_PRODUCTION: 'bg-blue-100 text-blue-700',
  PRODUCTION: 'bg-yellow-100 text-yellow-700',
  POST_PRODUCTION: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [activeVersion, setActiveVersion] = useState<any>(null);
  const [finKey, setFinKey] = useState(0);
  // Project crew (for the crew-to-budget-line dropdown)
  const [crewList, setCrewList] = useState<any[]>([]);
  useEffect(() => { productionApi.crew.list(id).then(r => setCrewList(r.data || [])).catch(() => {}); }, [id]);
  // Cast talent (for the cast-to-budget-line dropdown → auto-classifies the line by union)
  const [talentList, setTalentList] = useState<any[]>([]);
  useEffect(() => { castingApi.talent().then(r => setTalentList(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, [id]);
  const crewName = (cid?: string | null) => {
    if (!cid) return null;
    const c = crewList.find((x: any) => x.crewMemberId === cid || x.id === cid);
    return c?.name || null;
  };

  // Labor classification options from the project's frozen snapshot (drives the per-section dropdown)
  const [classOptions, setClassOptions] = useState<string[]>([]);
  useEffect(() => {
    laborApi.projectConfig(id).then(r => {
      const codes = Array.from(new Set((r.data?.rules || [])
        .filter((x: any) => x.enabled !== false && x.classificationCode)
        .map((x: any) => String(x.classificationCode)))) as string[];
      setClassOptions(codes.sort());
    }).catch(() => setClassOptions([]));
  }, [id]);
  const [topSheet, setTopSheet] = useState<any>(null);
  const [bva, setBva] = useState<any>(null);
  const [bvaLoading, setBvaLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Line item add form state
  const [addingItem, setAddingItem] = useState<string | null>(null); // accountId
  const [newItem, setNewItem] = useState<Record<string, any>>({ description: '', quantityFormula: '', quantity: '1', units: 'days', rate: '', fringePct: '0', fringeProfileId: '', classificationCode: '', crewMemberId: '', castTalentId: '', notes: '' });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [laborLine, setLaborLine] = useState<any>(null); // line open in the labour-block editor
  // Detailed lines: show labour-block stages as aligned sub-rows (remembered per browser)
  const [detailedLines, setDetailedLines] = useState(false);
  useEffect(() => { try { setDetailedLines(localStorage.getItem('tfm_budget_detailed') === '1'); } catch {} }, []);
  const toggleDetailed = () => setDetailedLines(v => { const n = !v; try { localStorage.setItem('tfm_budget_detailed', n ? '1' : '0'); } catch {} return n; });

  // Global add form
  const [addingGlobal, setAddingGlobal] = useState(false);
  const [newGlobal, setNewGlobal] = useState({ key: '', label: '', value: '', unit: 'days' });


  const loadProject = useCallback(async () => {
    try {
      const r = await productionApi.projects.get(id);
      setProject(r.data);
      // Find active budget version
      const active = r.data.budgetVersions?.find((v: any) => v.isActive) || r.data.budgetVersions?.[0];
      if (active) {
        const vr = await productionApi.budget.getVersion(active.id);
        setActiveVersion(vr.data);
        const tr = await productionApi.budget.topSheet(active.id);
        setTopSheet(tr.data);
      }
    } catch {
      router.push('/production/projects');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const reload = () => { setLoading(true); loadProject(); };

  const loadBva = useCallback(() => {
    if (!activeVersion) return;
    setBvaLoading(true);
    productionApi.budget.budgetVsActual(activeVersion.id)
      .then(r => setBva(r.data)).catch(() => {}).finally(() => setBvaLoading(false));
  }, [activeVersion]);

  useEffect(() => { if (tab === 'actual') loadBva(); }, [tab, loadBva]);

  // ── Exports ──────────────────────────────────────────────────────────────────
  const exportCsv = () => {
    if (!activeVersion) return;
    const rows: string[][] = [['Section Code', 'Section', 'Cost Center', 'Cost Center Title', 'Sub-Account', 'Sub-Account Title', 'Description', 'Qty', 'Units', 'Rate', 'Fringe %', 'Subtotal', 'Total']];
    for (const s of activeVersion.sections) {
      for (const a of s.accounts) {
        if (a.lineItems.length === 0) {
          rows.push([s.code, s.title, a.code, a.title, '', '', '', '', '', '', '', '', '']);
        }
        for (const i of a.lineItems) {
          rows.push([s.code, s.title, a.code, a.title, i.code || '', i.subTitle || '', i.description, String(Number(i.quantity)), i.units || '', String(Number(i.rate)), String(Number(i.fringePct)), String(Number(i.subtotal)), String(Number(i.total))]);
        }
      }
    }
    const grand = activeVersion.sections.reduce((t: number, s: any) => t + s.accounts.reduce((x: number, a: any) => x + a.lineItems.reduce((y: number, i: any) => y + Number(i.total), 0), 0), 0);
    rows.push([]);
    rows.push(['', '', '', '', '', '', '', '', '', '', '', 'GRAND TOTAL', String(grand)]);
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.projectNumber}-${activeVersion.versionName.replace(/\s+/g, '-')}-budget.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openPrint = () => {
    if (activeVersion) window.open(`/print/budget/${activeVersion.id}`, '_blank');
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  // ── Line Items ─────────────────────────────────────────────────────────────

  const handleAddItem = async (accountId: string) => {
    if (!newItem.description || !newItem.rate) return;
    await productionApi.budget.createItem(accountId, {
      description: newItem.description,
      quantityFormula: newItem.quantityFormula || undefined,
      quantity: newItem.quantityFormula ? undefined : Number(newItem.quantity),
      units: newItem.units,
      rate: Number(newItem.rate),
      fringePct: Number(newItem.fringePct),
      fringeProfileId: newItem.fringeProfileId || undefined,
      classificationCode: newItem.classificationCode || undefined,
      crewMemberId: newItem.crewMemberId || undefined,
      castTalentId: newItem.castTalentId || undefined,
      notes: newItem.notes,
    });
    setAddingItem(null);
    setNewItem({ description: '', quantityFormula: '', quantity: '1', units: 'days', rate: '', fringePct: '0', fringeProfileId: '', classificationCode: '', crewMemberId: '', castTalentId: '', notes: '' });
    reload();
  };

  const handleUpdateItem = async (itemId: string) => {
    await productionApi.budget.updateItem(itemId, editValues);
    setEditingItem(null);
    setEditValues({});
    reload();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this line item?')) return;
    await productionApi.budget.deleteItem(itemId);
    reload();
  };

  // ── Globals ────────────────────────────────────────────────────────────────

  const handleUpsertGlobal = async () => {
    if (!newGlobal.key || !newGlobal.label || !newGlobal.value) return;
    await productionApi.budget.upsertGlobal(activeVersion.id, {
      key: newGlobal.key.toLowerCase().replace(/\s+/g, '_'),
      label: newGlobal.label,
      value: Number(newGlobal.value),
      unit: newGlobal.unit,
    });
    setAddingGlobal(false);
    setNewGlobal({ key: '', label: '', value: '', unit: 'days' });
    reload();
  };

  const handleUpdateGlobal = async (g: any, newValue: number) => {
    await productionApi.budget.upsertGlobal(activeVersion.id, { key: g.key, label: g.label, value: newValue, unit: g.unit });
    reload();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" /></div>;
  if (!project) return null;

  const globals = activeVersion?.globals || [];
  const globalsMap = Object.fromEntries(globals.map((g: any) => [g.key, Number(g.value)]));
  const fringes = activeVersion?.fringes || [];
  const cur = project.currency || 'AED';
  const money = (n: any) => formatCurrency(n, cur);

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/production/projects" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
            <span className="text-sm text-gray-400">{project.projectNumber}</span>
            <span className={cn('badge text-xs', STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-600')}>
              {project.status.replace(/_/g, ' ')}
            </span>
          </div>
          {project.client && <p className="text-sm text-gray-500">{project.client.companyName} · {project.projectType}</p>}
        </div>
        {project.totalBudget && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Total Budget</p>
            <p className="text-lg font-bold text-gray-900">{money(project.totalBudget)}</p>
          </div>
        )}
      </div>

      {/* Budget version selector */}
      {activeVersion && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <span className="text-gray-400">Active budget:</span>
          <span className="font-medium">{activeVersion.versionName}</span>
          <span className={cn('badge text-xs', activeVersion.status === 'LOCKED' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700')}>
            {activeVersion.status}
          </span>
          {activeVersion.status !== 'LOCKED' ? (
            <button onClick={async () => { if (confirm('Lock this budget? It becomes read-only — changes will require a working copy or an approved transfer.')) { await productionApi.budget.lockVersion(activeVersion.id); reload(); } }}
              className="btn btn-secondary text-xs py-1 px-2 ml-2">
              <Lock size={11} className="mr-1" /> Lock baseline
            </button>
          ) : (
            <button onClick={async () => {
              const name = prompt('Name for the working copy:', `${activeVersion.versionName} (Working Copy)`);
              if (name === null) return;
              const r = await productionApi.budget.cloneVersion(activeVersion.id, name || undefined);
              await productionApi.budget.activateVersion(r.data.id);
              reload();
            }} className="btn btn-primary text-xs py-1 px-2 ml-2">
              <Plus size={11} className="mr-1" /> Create working copy
            </button>
          )}
          <button onClick={async () => { await productionApi.budget.recalculate(activeVersion.id); reload(); }}
            className="btn btn-secondary text-xs py-1 px-2">
            <RefreshCw size={11} className="mr-1" /> Recalc
          </button>
          <div className="flex-1" />
          <button onClick={exportCsv} className="btn btn-secondary text-xs py-1 px-2">
            <FileDown size={11} className="mr-1" /> CSV
          </button>
          <button onClick={openPrint} className="btn btn-secondary text-xs py-1 px-2">
            <Printer size={11} className="mr-1" /> Print / PDF
          </button>
        </div>
      )}

      {/* Tab groups */}
      {(() => {
        const activeGroup = TAB_GROUPS.find(g => g.tabs.includes(tab)) || TAB_GROUPS[0];
        return (
          <>
            <div className="flex gap-1 mb-2 flex-wrap">
              {TAB_GROUPS.map(g => (
                <button key={g.key} onClick={() => setTab(g.tabs[0])}
                  className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                    activeGroup.key === g.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                  {g.label}
                </button>
              ))}
            </div>
            {activeGroup.tabs.length > 1 && (
              <div className="flex gap-1 mb-6 border-b border-gray-200 flex-wrap">
                {activeGroup.tabs.map(id => {
                  const m = TAB_META[id];
                  return (
                    <button key={id} onClick={() => setTab(id)}
                      className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                        tab === id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                      <m.icon size={14} />{m.label}
                    </button>
                  );
                })}
              </div>
            )}
            {activeGroup.tabs.length <= 1 && <div className="mb-6" />}
          </>
        );
      })()}

      {/* ── Overview ───────────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <WorkflowChecklist projectId={id} onNavigate={(t) => setTab(t as Tab)} />
          <OverviewPanel projectId={id} project={project} currency={cur} onNavigate={(t) => setTab(t as Tab)} />
        </div>
      )}

      {/* ── Budget Spreadsheet ──────────────────────────────────────────────────── */}
      {tab === 'budget' && activeVersion && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={toggleDetailed}
              className={cn('btn text-xs', detailedLines ? 'bg-indigo-50 text-indigo-700 border border-indigo-300' : 'btn-secondary')}>
              <Layers size={13} className="mr-1" /> Detailed lines: {detailedLines ? 'ON' : 'OFF'}
            </button>
          </div>
          {activeVersion.status === 'LOCKED' && (
            <div className="card bg-amber-50 border-amber-200 flex items-center gap-3 py-3">
              <Lock size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1 text-xs text-amber-800">
                This is the <strong>locked baseline budget</strong> — line items are read-only so your starting numbers stay intact. To change the plan, create a working copy. To move money between lines, use an approved transfer in the Cost Report.
              </div>
            </div>
          )}
          {activeVersion.sections.map((section: any) => {
            const collapsed = collapsedSections.has(section.id);
            const sectionTotal = section.accounts.reduce((sum: number, acc: any) =>
              sum + acc.lineItems.reduce((s: number, i: any) => s + Number(i.total), 0), 0);

            return (
              <div key={section.id} className="card overflow-hidden p-0">
                {/* Section header */}
                <button onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  style={{ borderLeft: `3px solid ${section.color || '#6366f1'}` }}>
                  <div className="flex items-center gap-2">
                    {collapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    <span className="font-semibold text-gray-800 text-sm">{section.code} — {section.title}</span>
                    <span className={cn('text-[9px] font-bold rounded px-1 py-0.5', TIER_CLS[tierOf(section.code, section.tier)])}>{tierOf(section.code, section.tier)}</span>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">{money(sectionTotal)}</span>
                </button>

                {!collapsed && (
                  <div className="divide-y divide-gray-100">
                    {section.accounts.map((account: any) => {
                      const accountTotal = account.lineItems.reduce((s: number, i: any) => s + Number(i.total), 0);
                      return (
                        <div key={account.id}>
                          {/* Account header row (cost center) */}
                          <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                              <span className="text-[9px] font-bold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">CC</span>
                              {account.code} · {account.title}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-gray-700">{money(accountTotal)}</span>
                              {activeVersion.status !== 'LOCKED' && (
                                <button onClick={() => { setAddingItem(account.id); setNewItem(v => ({ ...v, description: '' })); }}
                                  className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                                  <Plus size={11} /> Add item
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Column headers */}
                          {account.lineItems.length > 0 && (
                            <div className="grid gap-x-2 px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-white border-b border-gray-100" style={{ gridTemplateColumns: '56px 2fr 1fr 0.7fr 1fr 1fr 0.8fr 1fr 40px' }}>
                              <span>Code</span>
                              <span>Description</span>
                              <span>Qty / Formula</span>
                              <span>Units</span>
                              <span>Rate ({cur})</span>
                              <span>Subtotal</span>
                              <span>Fringe %</span>
                              <span>Total</span>
                              <span></span>
                            </div>
                          )}

                          {/* Line items (grouped by sub-account) */}
                          {account.lineItems.map((item: any) => {
                            return (
                            <Fragment key={item.id}>
                            <div>
                              {editingItem === item.id ? (
                                /* Edit row */
                                <div className="grid gap-x-2 px-4 py-2 items-center bg-blue-50" style={{ gridTemplateColumns: '56px 2fr 1fr 0.7fr 1fr 1fr 0.8fr 1fr 40px' }}>
                                  <span className="text-xs font-mono font-semibold text-brand-600" title={item.subTitle || ''}>{item.code || ''}</span>
                                  <div className="space-y-1">
                                    <input className="input text-xs py-1 h-7 w-full" value={editValues.description ?? item.description}
                                      onChange={e => setEditValues((v: any) => ({ ...v, description: e.target.value }))} />
                                    <ClassificationSelect
                                      value={editValues.classificationCode ?? item.classificationCode ?? ''}
                                      onChange={v => setEditValues((ev: any) => ({ ...ev, classificationCode: v }))}
                                      tier={tierOf(section.code, section.tier)} options={classOptions} />
                                    <CrewSelect crew={crewList}
                                      value={editValues.crewMemberId ?? item.crewMemberId ?? ''}
                                      onChange={(cid, a) => {
                                        setEditValues((ev: any) => ({ ...ev, crewMemberId: cid || null }));
                                        if (a?.dailyRate && confirm(`Pull ${a.name}'s daily rate of ${Number(a.dailyRate).toLocaleString()} into this line?`)) {
                                          setEditValues((ev: any) => ({ ...ev, rate: Number(a.dailyRate) }));
                                        }
                                      }} />
                                    <TalentSelect talent={talentList}
                                      value={editValues.castTalentId ?? item.castTalentId ?? ''}
                                      onChange={(tid) => setEditValues((ev: any) => ({ ...ev, castTalentId: tid || null }))} /></div>
                                  <input className="input text-xs py-1 h-7" placeholder="qty or =formula"
                                    value={editValues.quantityFormula ?? item.quantityFormula ?? String(item.quantity)}
                                    onChange={e => setEditValues((v: any) => ({ ...v, quantityFormula: e.target.value }))} />
                                  <select className="input text-xs py-1 h-7" value={editValues.units ?? item.units ?? 'units'}
                                    onChange={e => setEditValues((v: any) => ({ ...v, units: e.target.value }))}>
                                    {(() => {
                                      const opts = ['days', 'weeks', 'hours', 'units', 'lump', 'shoot days'];
                                      const cur = editValues.units ?? item.units;
                                      if (cur && !opts.includes(cur)) opts.unshift(cur); // keep legacy value selectable
                                      return opts.map(u => <option key={u} value={u}>{u}</option>);
                                    })()}
                                  </select>
                                  <input type="number" className="input text-xs py-1 h-7" value={editValues.rate ?? item.rate}
                                    onChange={e => setEditValues((v: any) => ({ ...v, rate: Number(e.target.value) }))} />
                                  <span className="text-xs text-gray-500">{money(Number(item.subtotal))}</span>
                                  <input type="number" className="input text-xs py-1 h-7" value={editValues.fringePct ?? item.fringePct}
                                    onChange={e => setEditValues((v: any) => ({ ...v, fringePct: Number(e.target.value) }))} />
                                  <span className="text-xs font-semibold">{money(Number(item.total))}</span>
                                  <div className="flex gap-1">
                                    <button onClick={() => handleUpdateItem(item.id)} className="text-green-600 hover:text-green-700"><Save size={12} /></button>
                                    <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                                  </div>
                                </div>
                              ) : (
                                /* Display row */
                                /* Display row (+ optional detailed stage rows) */
                                (() => {
                                  const stages = Array.isArray(item.stages) ? item.stages : [];
                                  const showStages = detailedLines && stages.length > 0;
                                  return (
                                <>
                                <div className="grid gap-x-2 px-4 py-2 items-center hover:bg-gray-50 group" style={{ gridTemplateColumns: '56px 2fr 1fr 0.7fr 1fr 1fr 0.8fr 1fr 40px' }}>
                                  <span className="text-xs font-mono font-semibold text-brand-600" title={item.subTitle || ''}>{item.code || ''}</span>
                                  <span className="text-sm text-gray-800">{item.description}
                                    {crewName(item.crewMemberId) && <span className="ml-1.5 text-[9px] font-semibold bg-sky-100 text-sky-700 rounded px-1 py-0.5">{crewName(item.crewMemberId)}</span>}
                                    {item.classificationCode && <span className="ml-1.5 text-[9px] font-mono bg-indigo-100 text-indigo-700 rounded px-1 py-0.5">{item.classificationCode}</span>}
                                    {item.origin && ORIGIN_META[item.origin] && (
                                      <span className={cn('ml-1.5 text-[9px] font-semibold rounded px-1 py-0.5', ORIGIN_META[item.origin].cls)}
                                        title={item.origin === 'MANUAL_OVERRIDE' && item.aiSuggestedRate != null ? `AI/import suggested rate ${money(Number(item.aiSuggestedRate))}${item.aiSuggestedQuantity != null ? `, qty ${Number(item.aiSuggestedQuantity)}` : ''}` : 'Source of this line'}>
                                        {ORIGIN_META[item.origin].label}
                                      </span>
                                    )}
                                    {!showStages && stageSummary(item.stages) && <span className="block text-[10px] text-cyan-700">{stageSummary(item.stages)}</span>}</span>
                                  {showStages ? (
                                    <>
                                      <span className="text-[11px] text-gray-400">{stages.length} stages</span>
                                      <span className="text-xs text-gray-400">—</span>
                                      <span className="text-xs text-gray-400">—</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-sm text-gray-600 font-mono">
                                        {item.quantityFormula ? (
                                          <span className="text-purple-600" title={item.quantityFormula}>
                                            {Number(item.quantity).toFixed(1)} <span className="text-[10px] text-purple-400">f(x)</span>
                                          </span>
                                        ) : Number(item.quantity).toFixed(2)}
                                      </span>
                                      <span className="text-xs text-gray-500">{item.units || '—'}</span>
                                      <span className="text-sm text-gray-700">{money(Number(item.rate))}</span>
                                    </>
                                  )}
                                  <span className="text-sm text-gray-600">{money(Number(item.subtotal))}</span>
                                  <span className="text-xs text-gray-500">{Number(item.fringePct) > 0 ? `${item.fringePct}%` : '—'}</span>
                                  <span className="text-sm font-semibold text-gray-900">{money(Number(item.total))}</span>
                                  {activeVersion.status !== 'LOCKED' && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                      <button onClick={() => setLaborLine(item)} title="Stages (prep/shoot/wrap)" className={cn('hover:text-brand-600', stageSummary(item.stages) ? 'text-brand-500' : 'text-gray-400')}><Layers size={12} /></button>
                                      <button onClick={() => { setEditingItem(item.id); setEditValues({}); }} className="text-gray-400 hover:text-gray-600"><Edit2 size={12} /></button>
                                      <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                    </div>
                                  )}
                                </div>
                                {showStages && stages.map((s: any, si: number) => (
                                  <div key={si} className="grid gap-x-2 px-4 py-0.5 items-center" style={{ gridTemplateColumns: '56px 2fr 1fr 0.7fr 1fr 1fr 0.8fr 1fr 40px' }}>
                                    <span className="justify-self-end"><span className="inline-block w-0.5 h-4 bg-indigo-300" /></span>
                                    <span className="pl-1.5 text-[11px] font-semibold tracking-wider text-indigo-600">{String(s.stage || '').toUpperCase()}</span>
                                    <span className="text-xs text-gray-500 font-mono">{Number(s.qty)}</span>
                                    <span className="text-xs text-gray-500">{s.unit || ''}</span>
                                    <span className="text-xs text-gray-500 font-mono">{money(Number(s.rate))}</span>
                                    <span className="text-xs text-gray-500 font-mono">{money((Number(s.qty) || 0) * (Number(s.rate) || 0))}</span>
                                    <span /><span /><span />
                                  </div>
                                ))}
                                </>
                                  );
                                })()
                              )}
                            </div>
                            </Fragment>
                            ); })}

                          {/* Account total row */}
                          {account.lineItems.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-1.5 text-xs"
                              style={{ background: `${section.color || '#6366f1'}14` }}>
                              <span className="font-semibold text-gray-600">Account total for {account.code}</span>
                              <span className="font-bold font-mono text-gray-800">{money(accountTotal)}</span>
                            </div>
                          )}

                          {/* Add item form */}
                          {addingItem === account.id && (
                            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                              <div className="grid grid-cols-[2fr_1fr_0.7fr_1fr_0.8fr_0.8fr] gap-2 mb-2">
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Description</label>
                                  <input className="input text-sm h-8 w-full" value={newItem.description}
                                    onChange={e => setNewItem(v => ({ ...v, description: e.target.value }))}
                                    placeholder="e.g. Camera Package Rental" autoFocus />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Qty or Formula</label>
                                  <input className="input text-sm h-8 w-full font-mono" value={newItem.quantityFormula || newItem.quantity}
                                    onChange={e => {
                                      const v = e.target.value;
                                      if (/^[0-9.]+$/.test(v)) setNewItem(n => ({ ...n, quantity: v, quantityFormula: '' }));
                                      else setNewItem(n => ({ ...n, quantityFormula: v, quantity: '1' }));
                                    }}
                                    placeholder="e.g. shoot_days" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Units</label>
                                  <select className="input text-sm h-8 w-full" value={newItem.units} onChange={e => setNewItem(v => ({ ...v, units: e.target.value }))}>
                                    {['days', 'weeks', 'hours', 'units', 'lump', 'shoot days'].map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Rate ({cur})</label>
                                  <input type="number" className="input text-sm h-8 w-full" value={newItem.rate}
                                    onChange={e => setNewItem(v => ({ ...v, rate: e.target.value }))} placeholder="0.00" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Fringe %</label>
                                  <input type="number" className="input text-sm h-8 w-full" value={newItem.fringePct}
                                    onChange={e => setNewItem(v => ({ ...v, fringePct: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Fringe Profile</label>
                                  <select className="input text-sm h-8 w-full" value={newItem.fringeProfileId}
                                    onChange={e => setNewItem(v => ({ ...v, fringeProfileId: e.target.value }))}>
                                    <option value="">None</option>
                                    {fringes.map((f: any) => <option key={f.id} value={f.id}>{f.name} ({f.percentage}%)</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="mb-2 grid sm:grid-cols-2 gap-3 max-w-2xl">
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Labor Classification (for fringes)</label>
                                  <ClassificationSelect
                                    value={newItem.classificationCode}
                                    onChange={v => setNewItem((n: any) => ({ ...n, classificationCode: v }))}
                                    tier={tierOf(section.code, section.tier)} options={classOptions} />
                                  <p className="text-[10px] text-gray-400 mt-0.5">Suggestions match this section's tier ({tierOf(section.code, section.tier)}) from the project's frozen labor snapshot. Choose none for non-labor lines.</p>
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Assign crew (optional)</label>
                                  <CrewSelect crew={crewList} value={newItem.crewMemberId}
                                    onChange={(cid, a) => {
                                      setNewItem((n: any) => ({ ...n, crewMemberId: cid }));
                                      if (a?.dailyRate && confirm(`Pull ${a.name}'s daily rate of ${Number(a.dailyRate).toLocaleString()} into this line?`)) {
                                        setNewItem((n: any) => ({ ...n, rate: String(a.dailyRate), units: 'days' }));
                                      }
                                    }} />
                                  <TalentSelect talent={talentList} value={newItem.castTalentId}
                                    onChange={(tid) => setNewItem((n: any) => ({ ...n, castTalentId: tid }))} />
                                  <p className="text-[10px] text-gray-400 mt-0.5">Crew links a day rate; cast talent auto-applies their union fringe (P&amp;H) to the line.</p>
                                </div>
                              </div>
                              {/* Global variables hint */}
                              {globals.length > 0 && (
                                <div className="mb-2 text-[10px] text-purple-600">
                                  <span className="font-semibold">Available globals: </span>
                                  {globals.map((g: any) => (
                                    <button key={g.key} onClick={() => setNewItem(v => ({ ...v, quantityFormula: v.quantityFormula ? v.quantityFormula + ' + ' + g.key : g.key }))}
                                      className="mr-2 bg-purple-100 text-purple-700 rounded px-1 hover:bg-purple-200">
                                      {g.key}={Number(g.value)}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button onClick={() => handleAddItem(account.id)} className="btn btn-primary text-xs py-1">Add Line Item</button>
                                <button onClick={() => setAddingItem(null)} className="btn btn-secondary text-xs py-1">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Section total row */}
                    <div className="flex items-center justify-between px-4 py-2"
                      style={{ background: `${section.color || '#6366f1'}33` }}>
                      <span className="text-xs font-bold tracking-wide text-gray-800 uppercase">Total {section.title}</span>
                      <span className="text-sm font-bold font-mono text-gray-900">{money(sectionTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Budget totals (ATL / BTL / combined / grand) ── */}
          {(() => {
            const tiers: Record<string, number> = { ATL: 0, BTL: 0, POST: 0, OTHER: 0 };
            for (const s of activeVersion.sections) {
              const sum = s.accounts.reduce((t: number, a: any) => t + a.lineItems.reduce((x: number, i: any) => x + Number(i.total), 0), 0);
              tiers[tierOf(s.code, s.tier)] = (tiers[tierOf(s.code, s.tier)] || 0) + sum;
            }
            const grand = Object.values(tiers).reduce((a, b) => a + b, 0);
            return (
              <div className="card overflow-hidden p-0">
                <div className="px-4 py-2 bg-gray-50 text-xs font-bold tracking-wide text-gray-500 uppercase">Budget Totals</div>
                <div className="flex items-center justify-between px-4 py-2 text-sm border-t border-gray-100">
                  <span className="text-gray-700">Total Above-The-Line</span>
                  <span className="font-mono text-gray-800">{money(tiers.ATL)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2 text-sm border-t border-gray-100">
                  <span className="text-gray-700">Total Below-The-Line</span>
                  <span className="font-mono text-gray-800">{money(tiers.BTL)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2 text-sm border-t border-gray-100 font-semibold">
                  <span className="text-gray-800">Total Above and Below-The-Line</span>
                  <span className="font-mono text-gray-900">{money(tiers.ATL + tiers.BTL)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-t-2 border-amber-400">
                  <span className="text-sm font-bold tracking-wide text-gray-900 uppercase">Grand Total</span>
                  <span className="text-sm font-bold font-mono text-gray-900">{money(grand)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Top Sheet (dual-column comparison: locked baseline vs working copy) ── */}
      {tab === 'topsheet' && <TopsheetComparisonPanel projectId={id} currency={cur} onChanged={reload} />}

      {/* ── Budget vs Actual ───────────────────────────────────────────────────── */}
      {tab === 'actual' && activeVersion && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 max-w-xl">
              Actuals are approved &amp; paid expenses tagged to this project. Tag an expense to a budget
              account (e.g. 2200) when recording it to track it here.
            </p>
            <button onClick={loadBva} className="btn btn-secondary text-xs py-1 px-2">
              <RefreshCw size={11} className={cn('mr-1', bvaLoading && 'animate-spin')} /> Refresh
            </button>
          </div>

          {!bva ? (
            <div className="card p-10 text-center text-gray-400 text-sm">{bvaLoading ? 'Loading…' : 'No data yet.'}</div>
          ) : (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card">
                  <p className="text-xs text-gray-400">Budget</p>
                  <p className="text-lg font-bold text-gray-900">{money(bva.grandRevised ?? bva.grandBudget)}</p>
                  {Math.abs((bva.grandRevised ?? bva.grandBudget) - bva.grandBudget) > 0.01 && <p className="text-[10px] text-gray-400">orig {money(bva.grandBudget)}</p>}
                </div>
                <div className="card">
                  <p className="text-xs text-gray-400">Actual (committed)</p>
                  <p className="text-lg font-bold text-gray-900">{money(bva.grandActual)}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-400">Variance</p>
                  <p className={cn('text-lg font-bold', bva.grandVariance < 0 ? 'text-red-600' : 'text-green-600')}>
                    {bva.grandVariance < 0 ? '-' : ''}{money(Math.abs(bva.grandVariance))}
                  </p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-400">Spent</p>
                  <p className="text-lg font-bold text-gray-900">
                    {(bva.grandRevised ?? bva.grandBudget) > 0 ? Math.round((bva.grandActual / (bva.grandRevised ?? bva.grandBudget)) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left">Account</th>
                      <th className="px-3 py-2.5 text-right">Orig Budget</th>
                      <th className="px-3 py-2.5 text-right">Revised</th>
                      <th className="px-3 py-2.5 text-right">Actual</th>
                      <th className="px-3 py-2.5 text-right">Variance</th>
                      <th className="px-3 py-2.5 text-left w-40">Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bva.sections.map((s: any) => (
                      <Fragment key={s.code}>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 font-semibold text-gray-800" style={{ borderLeft: `3px solid ${s.color || '#6366f1'}` }}>
                            {s.code} — {s.title}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-500">{money(s.budget)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">{money(s.revisedBudget ?? s.budget)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">{money(s.actual)}</td>
                          <td className={cn('px-3 py-2 text-right font-semibold', s.variance < 0 ? 'text-red-600' : 'text-gray-600')}>
                            {s.variance < 0 ? '-' : ''}{money(Math.abs(s.variance))}
                          </td>
                          <td className="px-3 py-2"></td>
                        </tr>
                        {s.accounts.map((a: any) => {
                          const pct = Math.min(a.usedPct, 100);
                          const revised = a.revisedBudget ?? a.budget;
                          const over = a.actual > revised;
                          const adjusted = Math.abs(revised - a.budget) > 0.01;
                          return (
                            <tr key={a.code} className="border-b border-gray-50">
                              <td className="px-4 py-2 pl-8 text-gray-600 text-xs">{a.code} · {a.title}</td>
                              <td className="px-3 py-2 text-right text-gray-400">{money(a.budget)}</td>
                              <td className={cn('px-3 py-2 text-right', adjusted ? 'text-gray-800 font-medium' : 'text-gray-600')} title={adjusted ? `Transfers ${money(a.transfer)} · Approved overages ${money(a.approvedChange)}` : undefined}>{money(revised)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{a.actual ? money(a.actual) : '—'}</td>
                              <td className={cn('px-3 py-2 text-right', a.variance < 0 ? 'text-red-600' : 'text-gray-500')}>
                                {a.actual ? `${a.variance < 0 ? '-' : ''}${money(Math.abs(a.variance))}` : '—'}
                              </td>
                              <td className="px-3 py-2">
                                {revised > 0 || a.actual > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={cn('h-full rounded-full', over ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-green-500')}
                                        style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={cn('text-[10px] tabular-nums', over ? 'text-red-600' : 'text-gray-400')}>{a.usedPct}%</span>
                                  </div>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-500">{money(bva.grandBudget)}</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-900">{money(bva.grandRevised ?? bva.grandBudget)}</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-900">{money(bva.grandActual)}</td>
                      <td className={cn('px-3 py-3 text-right font-bold', bva.grandVariance < 0 ? 'text-red-600' : 'text-green-600')}>
                        {bva.grandVariance < 0 ? '-' : ''}{money(Math.abs(bva.grandVariance))}
                      </td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {bva.unallocated?.length > 0 && (
                <div className="card">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Untagged / unmatched expenses</h4>
                  <p className="text-[11px] text-gray-400 mb-3">These project expenses aren't matched to a budget account. Tag them with an account code to include them above.</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {bva.unallocated.map((u: any) => (
                        <tr key={u.code} className="border-b border-gray-50">
                          <td className="py-1.5 text-gray-600">{u.code === 'Untagged' ? 'Untagged (no account code)' : `Code ${u.code} (no matching account)`}</td>
                          <td className="py-1.5 text-right text-gray-700">{money(u.actual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Fringe & Burden Detail ─────────────────────────────────────────────── */}
      {tab === 'fringe' && <FringeDetailPanel versionId={activeVersion?.id} currency={cur} />}

      {/* ── Incentives & Tax Credits ───────────────────────────────────────────── */}
      {tab === 'incentives' && <IncentivesPanel projectId={id} currency={cur} onNavigate={(t) => setTab(t as Tab)} />}

      {/* ── Labor & Union Configuration ────────────────────────────────────────── */}
      {tab === 'labor' && <ProjectLaborPanel projectId={id} projectType={project.projectType} />}

      {/* ── Cost Report (EFC) ──────────────────────────────────────────────────── */}
      {tab === 'costreport' && (
        <div className="space-y-4">
          <FinanceSummaryStrip projectId={id} currency={cur} refreshKey={finKey} />
          <CostReportPanel projectId={id} currency={cur} onMutate={() => setFinKey(k => k + 1)} />
        </div>
      )}

      {/* ── Purchasing (POs + Vendors) ─────────────────────────────────────────── */}
      {tab === 'purchasing' && (
        <div className="space-y-4">
          <FinanceSummaryStrip projectId={id} currency={cur} refreshKey={finKey} />
          <PurchasingPanel projectId={id} currency={cur}
            accounts={(activeVersion?.sections || []).flatMap((s: any) => s.accounts.map((a: any) => ({ code: a.code, title: a.title })))} />
        </div>
      )}

      {/* ── Accounting (per-project books) ─────────────────────────────────────── */}
      {tab === 'accounting' && (
        <div className="space-y-4">
          <FinanceSummaryStrip projectId={id} currency={cur} refreshKey={finKey} />
          <AccountingPanel projectId={id} currency={cur}
            accounts={(activeVersion?.sections || []).flatMap((s: any) => s.accounts.map((a: any) => ({ code: a.code, title: a.title })))} />
        </div>
      )}

      {/* ── Cash (forecast + petty cash) ───────────────────────────────────────── */}
      {tab === 'cash' && (
        <div className="space-y-4">
          <FinanceSummaryStrip projectId={id} currency={cur} refreshKey={finKey} />
          <CashPanel projectId={id} currency={cur}
            accounts={(activeVersion?.sections || []).flatMap((s: any) => s.accounts.map((a: any) => ({ code: a.code, title: a.title })))} />
        </div>
      )}

      {/* ── Call Sheets ────────────────────────────────────────────────────────── */}
      {tab === 'callsheets' && <CallSheetsPanel projectId={id} />}

      {/* ── Locations ──────────────────────────────────────────────────────────── */}
      {tab === 'locations' && <LocationsPanel projectId={id} currency={cur} />}

      {/* ── Engagements: Travel / Contracts / Casting (this project only) ───────── */}
      {tab === 'travel' && <TravelPanel projectId={id} />}
      {tab === 'contracts' && <ContractsPanel projectId={id} />}
      {tab === 'casting' && <CastingPanel projectId={id} />}
      {tab === 'accommodation' && <AccommodationPanel projectId={id} />}
      {tab === 'transport' && <TransportPanel projectId={id} />}
      {tab === 'shuttle' && <ShuttlePanel projectId={id} />}
      {tab === 'arrivals' && <ArrivalsPanel projectId={id} />}
      {tab === 'fuel' && <FuelPanel projectId={id} />}
      {tab === 'logistics' && <LogisticsReportsPanel projectId={id} />}
      {tab === 'breakdowns' && (
        <BreakdownsTab projectId={id} currency={cur}
          accounts={(activeVersion?.sections || []).flatMap((s: any) => s.accounts.map((a: any) => ({ code: a.code, title: a.title })))} />
      )}

      {/* ── Globals ────────────────────────────────────────────────────────────── */}
      {tab === 'globals' && activeVersion && (
        <div className="max-w-3xl space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Production Globals</h3>
                <p className="text-xs text-gray-400 mt-0.5">Variables referenced in budget formulas (e.g. shoot_days × daily_rate)</p>
              </div>
              <button onClick={() => setAddingGlobal(true)} className="btn btn-primary text-xs py-1 px-3">
                <Plus size={12} className="mr-1" /> Add Global
              </button>
            </div>

            {addingGlobal && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div>
                    <label className="label text-xs">Key (variable name)</label>
                    <input className="input w-full text-sm font-mono" value={newGlobal.key}
                      onChange={e => setNewGlobal(v => ({ ...v, key: e.target.value }))} placeholder="shoot_days" />
                  </div>
                  <div>
                    <label className="label text-xs">Label</label>
                    <input className="input w-full text-sm" value={newGlobal.label}
                      onChange={e => setNewGlobal(v => ({ ...v, label: e.target.value }))} placeholder="Shoot Days" />
                  </div>
                  <div>
                    <label className="label text-xs">Value</label>
                    <input type="number" className="input w-full text-sm" value={newGlobal.value}
                      onChange={e => setNewGlobal(v => ({ ...v, value: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label text-xs">Unit</label>
                    <select className="input w-full text-sm" value={newGlobal.unit}
                      onChange={e => setNewGlobal(v => ({ ...v, unit: e.target.value }))}>
                      {['days', 'weeks', 'hours', 'people', ''].map(u => <option key={u} value={u}>{u || '—'}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUpsertGlobal} className="btn btn-primary text-xs py-1">Save Global</button>
                  <button onClick={() => setAddingGlobal(false)} className="btn btn-secondary text-xs py-1">Cancel</button>
                </div>
              </div>
            )}

            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Variable</th>
                  <th className="table-th">Label</th>
                  <th className="table-th">Value</th>
                  <th className="table-th">Unit</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {globals.map((g: any) => (
                  <tr key={g.id} className="table-row">
                    <td className="table-td font-mono text-purple-700 text-sm">{g.key}</td>
                    <td className="table-td text-sm text-gray-700">{g.label}</td>
                    <td className="table-td">
                      <input type="number" className="input text-sm py-1 w-24"
                        defaultValue={Number(g.value)}
                        onBlur={e => { if (Number(e.target.value) !== Number(g.value)) handleUpdateGlobal(g, Number(e.target.value)); }} />
                    </td>
                    <td className="table-td text-sm text-gray-500">{g.unit || '—'}</td>
                    <td className="table-td">
                      <button onClick={async () => { await productionApi.budget.deleteGlobal(g.id); reload(); }}
                        className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fringe Profiles */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Fringe / Overhead Profiles</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">%</th>
                  <th className="table-th">Description</th>
                </tr>
              </thead>
              <tbody>
                {fringes.map((f: any) => (
                  <tr key={f.id} className="table-row">
                    <td className="table-td font-medium text-sm">{f.name}</td>
                    <td className="table-td text-sm text-gray-700">{f.percentage}%</td>
                    <td className="table-td text-sm text-gray-500">{f.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Crew Assignments & Deal Memos ──────────────────────────────────────── */}
      {tab === 'crew' && <CrewAssignmentsPanel projectId={id} currency={cur} />}

      {/* ── Per Diem ───────────────────────────────────────────────────────────── */}
      {tab === 'perdiem' && <PerDiemPanel projectId={id} currency={cur} />}

      {/* ── Overages ───────────────────────────────────────────────────────────── */}
      {tab === 'overages' && (
        <div className="space-y-4">
          <FinanceSummaryStrip projectId={id} currency={cur} refreshKey={finKey} />
          <OveragesPanel projectId={id} activeVersionId={activeVersion?.id} currency={cur} />
        </div>
      )}

      {/* ── Schedule (stripboard + DOOD) ───────────────────────────────────────── */}
      {tab === 'schedule' && (
        <StripboardPanel projectId={id} currency={cur}
          accounts={(activeVersion?.sections || []).flatMap((s: any) => s.accounts.map((a: any) => ({ code: a.code, title: a.title })))} />
      )}

      {/* ── Documents ──────────────────────────────────────────────────────────── */}
      {tab === 'documents' && <DocumentsPanel projectId={id} />}

      {/* ── Project Settings (logo + currency convert) ─────────────────────────── */}
      {tab === 'settings' && <ProjectSettingsPanel projectId={id} project={project} activeVersion={activeVersion} fringes={fringes} onChanged={reload} />}

      {/* ── Project Email Sender ───────────────────────────────────────────────── */}
      {tab === 'projectemail' && <ProjectEmailPanel projectId={id} />}

      {/* ── End Credits ────────────────────────────────────────────────────────── */}
      {tab === 'credits' && <EndCreditsPanel projectId={id} />}

      {/* Labour-block editor (prep/shoot/wrap stages with rate-card auto-fill) */}
      {laborLine && (
        <LaborBlockEditor line={laborLine} currency={cur}
          onClose={() => setLaborLine(null)}
          onSaved={() => { setLaborLine(null); reload(); }} />
      )}
    </div>
  );
}
