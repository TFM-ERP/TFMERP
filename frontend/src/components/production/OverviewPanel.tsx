'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Calendar, Users, ClipboardList, AlertTriangle, ArrowRight, ShoppingCart } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

export default function OverviewPanel({ projectId, project, currency = 'AED', onNavigate }:
  { projectId: string; project: any; currency?: string; onNavigate: (tab: string) => void }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [sum, setSum] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [board, setBoard] = useState<any>(null);
  const [crew, setCrew] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);

  useEffect(() => {
    productionApi.ledger.summary(projectId).then(r => setSum(r.data)).catch(() => {});
    productionApi.costing.report(projectId).then(r => setReport(r.data)).catch(() => {});
    productionApi.scheduling.board(projectId).then(r => setBoard(r.data)).catch(() => {});
    productionApi.crew.list(projectId).then(r => setCrew(r.data || [])).catch(() => {});
    productionApi.callsheets.list(projectId).then(r => setSheets(r.data || [])).catch(() => {});
    productionApi.costing.pos(projectId).then(r => setPos(r.data || [])).catch(() => {});
  }, [projectId]);

  const efc = report?.totals?.efc ?? 0;
  const variance = report?.totals?.variance ?? 0;
  const nextDay = board?.board?.find((d: any) => d.date && new Date(d.date) >= new Date()) || board?.board?.[0];
  const draftPos = pos.filter((p: any) => p.status === 'DRAFT').length;
  const openPos = pos.filter((p: any) => ['APPROVED', 'PARTIALLY_INVOICED'].includes(p.status)).length;
  const published = sheets.filter((s: any) => s.status === 'PUBLISHED').length;

  const Tile = ({ label, value, sub, color, icon: Icon }: any) => (
    <div className="card">
      <div className="flex items-center gap-2 mb-1"><Icon size={14} className={color || 'text-gray-400'} /><p className="text-xs text-gray-400">{label}</p></div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
  const Card = ({ title, tab, children }: any) => (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <button onClick={() => onNavigate(tab)} className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">Open <ArrowRight size={12} /></button>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Financial snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Tile label="Budget" value={money(sum?.budget)} icon={DollarSign} />
        <Tile label="Est. Final Cost" value={money(efc)} sub={report ? `${report.totals.actual ? Math.round((report.totals.actual / (sum?.budget || 1)) * 100) : 0}% spent` : ''} icon={TrendingUp} color="text-amber-500" />
        <Tile label="Variance" value={money(Math.abs(variance))} sub={variance < 0 ? 'over budget' : 'under budget'} icon={variance < 0 ? TrendingDown : TrendingUp} color={variance < 0 ? 'text-red-500' : 'text-green-500'} />
        <Tile label="Revenue" value={money(sum?.income)} icon={DollarSign} color="text-green-500" />
        <Tile label="Net P&L" value={money(sum?.net)} icon={Wallet} color={sum?.net >= 0 ? 'text-green-500' : 'text-red-500'} />
        <Tile label="Cash" value={money(sum?.cashPosition)} icon={Wallet} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Schedule */}
        <Card title="Schedule" tab="schedule">
          {board ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Scenes / pages</span><span className="font-medium">{board.totalScenes} · {board.totalPages?.toFixed?.(1) ?? board.totalPages} pg</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shoot days</span><span className="font-medium">{board.shootDays}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Next day</span><span className="font-medium">{nextDay ? `Day ${nextDay.dayNumber}${nextDay.date ? ` · ${formatDate(nextDay.date)}` : ''}` : '—'}</span></div>
            </div>
          ) : <p className="text-xs text-gray-400">No schedule yet.</p>}
        </Card>

        {/* Call sheets */}
        <Card title="Call Sheets" tab="callsheets">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-medium">{sheets.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Published</span><span className="font-medium text-green-600">{published}</span></div>
          </div>
        </Card>

        {/* Purchasing */}
        <Card title="Purchasing & Commitments" tab="purchasing">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Committed (open POs)</span><span className="font-medium text-blue-600">{money(report?.totals?.committed)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Open / draft POs</span><span className="font-medium">{openPos} / {draftPos}</span></div>
          </div>
          {draftPos > 0 && <div className="mt-2 text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle size={11} /> {draftPos} PO(s) awaiting approval</div>}
        </Card>

        {/* Crew */}
        <Card title="Crew" tab="crew">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Assigned</span><span className="font-medium">{crew.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Deal memos signed</span><span className="font-medium">{crew.filter((c: any) => c.dealMemoStatus === 'SIGNED').length} / {crew.length}</span></div>
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Jump to</h3>
        <div className="flex flex-wrap gap-2">
          {[['Budget', 'budget', DollarSign], ['Cost Report', 'costreport', TrendingUp], ['Purchasing', 'purchasing', ShoppingCart], ['Cash', 'cash', Wallet], ['Schedule', 'schedule', Calendar], ['Call Sheets', 'callsheets', ClipboardList], ['Crew', 'crew', Users]].map(([l, t, Ic]: any) => (
            <button key={t} onClick={() => onNavigate(t)} className="btn btn-secondary text-xs py-1.5 px-3"><Ic size={13} className="mr-1" /> {l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
