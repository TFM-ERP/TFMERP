'use client';

/**
 * Statutory reporting — the year-end and tax filing screen.
 *
 * One page, four tabs: the IFRS for SMEs statement set, the VAT 201 return, the
 * corporate tax computation, and the management reports. Everything on it is
 * computed from posted journal entries, so nothing here can disagree with the
 * trial balance.
 *
 * Reconciliation differences and caveats are shown, never hidden. A report that
 * quietly disagrees with the ledger is worse than one that says so.
 */

import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Download, AlertTriangle, CheckCircle2, Receipt, Landmark, Activity } from 'lucide-react';
import { accountingApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

type Tab = 'statements' | 'vat' | 'tax' | 'management';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'statements', label: 'Financial Statements', icon: FileText },
  { id: 'vat', label: 'VAT 201', icon: Receipt },
  { id: 'tax', label: 'Corporate Tax', icon: Landmark },
  { id: 'management', label: 'Management', icon: Activity },
];

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : formatCurrency(n);

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm py-1">
      {ok ? (
        <CheckCircle2 size={15} className="text-green-600 mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
      )}
      <span style={{ color: ok ? 'var(--text-2)' : 'var(--text-1)' }}>{children}</span>
    </div>
  );
}

/** A headed group of statement lines with its own total. */
function StatementBlock({ group }: { group: any }) {
  return (
    <div className="mb-4">
      <div
        className="text-[10px] font-bold uppercase px-3 py-1.5 rounded"
        style={{ letterSpacing: '.14em', background: 'var(--surface-2)', color: 'var(--text-2)' }}
      >
        {group.label}
      </div>
      {group.lines.map((l: any) => (
        <div key={l.code} className="flex items-baseline gap-3 px-3 py-1.5 text-sm border-b" style={{ borderColor: 'var(--border-1)' }}>
          <span className="w-12 text-xs shrink-0" style={{ color: 'var(--text-4)' }}>{l.code}</span>
          <span className="flex-1" style={{ color: 'var(--text-2)' }}>{l.name}</span>
          <span className="tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{money(l.amount)}</span>
        </div>
      ))}
      <div className="flex items-baseline gap-3 px-3 py-2 text-sm font-bold">
        <span className="flex-1" style={{ color: 'var(--text-1)' }}>Total {group.label.toLowerCase()}</span>
        <span className="tabular-nums" style={{ color: 'var(--text-1)' }}>{money(group.total)}</span>
      </div>
    </div>
  );
}

/** A bold figure with a caption, used for the headline numbers. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card">
      <p className="text-xs" style={{ color: 'var(--text-4)' }}>{label}</p>
      <p
        className={cn('text-lg font-bold tabular-nums', tone === 'good' && 'text-green-600', tone === 'bad' && 'text-red-600')}
        style={tone ? undefined : { color: 'var(--text-1)' }}
      >
        {value}
      </p>
    </div>
  );
}

export default function StatutoryReportingPage() {
  const { t: tr } = useLocale();
  const [tab, setTab] = useState<Tab>('statements');
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(false);

  const [set, setSet] = useState<any>(null);
  const [vat, setVat] = useState<any>(null);
  const [tax, setTax] = useState<any>(null);
  const [electRelief, setElectRelief] = useState(false);
  const [mgmt, setMgmt] = useState<any>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      accountingApi.fullSet({ year }),
      accountingApi.vat201Year({ year }),
      accountingApi.corporateTax({ year, electSmallBusinessRelief: String(electRelief) }),
      accountingApi.executiveSummary({ year }),
    ])
      .then(([a, b, c, d]) => { setSet(a.data); setVat(b.data); setTax(c.data); setMgmt(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [year, electRelief]); // eslint-disable-line

  const saveBlob = (data: BlobPart, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadDocx = async () => {
    const res = await accountingApi.fullSetDocx({ year, draft: true });
    saveBlob(
      res.data,
      `Financial-Statements-${year}-DRAFT.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  };

  const downloadFaf = async () => {
    const res = await accountingApi.auditFile({ from: `${year}-01-01`, to: `${year}-12-31` });
    saveBlob(res.data.csv, res.data.filename, 'text/csv');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <FileText size={18} className="text-brand-600" />
          </div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>
              {tr('Accounting · Statutory')}
            </div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>
              {tr('Year End and Tax Filing')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              {tr('Built from posted journal entries. IFRS for SMEs presentation.')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="label text-xs">{tr('Year')}</label>
            <input type="number" className="input w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
          <button onClick={downloadDocx} className="btn btn-primary gap-1.5">
            <Download size={14} /> {tr('Word')}
          </button>
          <button onClick={downloadFaf} className="btn btn-secondary gap-1.5" title={tr('FTA Audit File')}>
            <Download size={14} /> FAF
          </button>
          <button onClick={load} className="btn btn-secondary p-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--border-1)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent',
            )}
            style={tab === t.id ? undefined : { color: 'var(--text-3)' }}
          >
            <t.icon size={14} /> {tr(t.label)}
          </button>
        ))}
      </div>

      {tab === 'statements' && set && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label={tr('Revenue')} value={money(set.incomeStatement.revenue)} />
            <Stat label={tr('Gross profit')} value={money(set.incomeStatement.grossProfit)} />
            <Stat
              label={set.incomeStatement.profitForThePeriod >= 0 ? tr('Profit for the year') : tr('Loss for the year')}
              value={money(set.incomeStatement.profitForThePeriod)}
              tone={set.incomeStatement.profitForThePeriod >= 0 ? 'good' : 'bad'}
            />
            <Stat label={tr('Net assets')} value={money(set.statementOfFinancialPosition.totalAssets - set.statementOfFinancialPosition.totalLiabilities)} />
          </div>

          <div className="card mb-5">
            <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-1)' }}>{tr('Integrity checks')}</h3>
            <Check ok={set.checks.positionBalances}>
              {set.checks.positionBalances
                ? tr('The statement of financial position balances.')
                : `${tr('The statement of financial position is out by')} ${money(set.checks.positionDifference)}.`}
            </Check>
            <Check ok={set.checks.cashFlowReconciles}>
              {set.checks.cashFlowReconciles
                ? tr('Cash flows reconcile to the movement on cash and bank.')
                : `${tr('Cash flows are out by')} ${money(set.checks.cashFlowDifference)}.`}
            </Check>
            <Check ok={set.checks.equityTiesToPosition}>
              {set.checks.equityTiesToPosition
                ? tr('Closing equity agrees to the balance sheet.')
                : `${tr('Closing equity is out by')} ${money(set.checks.equityDifference)}.`}
            </Check>
            <Check ok={set.checks.draftJournalsInPeriod === 0}>
              {set.checks.draftJournalsInPeriod === 0
                ? tr('No draft journals dated inside the period.')
                : `${set.checks.draftJournalsInPeriod} ${tr('draft journals inside the period are excluded from these figures.')}`}
            </Check>
          </div>

          <h2 className="font-bold mb-2" style={{ color: 'var(--text-1)' }}>{tr('Income Statement')}</h2>
          {set.incomeStatement.groups.map((g: any) => <StatementBlock key={g.section} group={g} />)}

          <h2 className="font-bold mb-2 mt-6" style={{ color: 'var(--text-1)' }}>{tr('Statement of Financial Position')}</h2>
          {set.statementOfFinancialPosition.groups.map((g: any) => <StatementBlock key={g.section} group={g} />)}

          <h2 className="font-bold mb-2 mt-6" style={{ color: 'var(--text-1)' }}>{tr('Statement of Cash Flows')}</h2>
          <div className="card text-sm space-y-1">
            <div className="flex justify-between"><span>{tr('Net cash from operating activities')}</span><span className="tabular-nums font-medium">{money(set.statementOfCashFlows.operating.net)}</span></div>
            <div className="flex justify-between"><span>{tr('Net cash used in investing activities')}</span><span className="tabular-nums font-medium">{money(set.statementOfCashFlows.investing.net)}</span></div>
            <div className="flex justify-between"><span>{tr('Net cash from financing activities')}</span><span className="tabular-nums font-medium">{money(set.statementOfCashFlows.financing.net)}</span></div>
            <div className="flex justify-between font-bold pt-1 border-t" style={{ borderColor: 'var(--border-1)' }}>
              <span>{tr('Cash at 31 December')}</span><span className="tabular-nums">{money(set.statementOfCashFlows.closingCash)}</span>
            </div>
          </div>
        </>
      )}

      {tab === 'vat' && vat && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Stat label={tr('Output tax for the year')} value={money(vat.annual.totalOutputTax)} />
            <Stat label={tr('Recoverable input tax')} value={money(vat.annual.totalInputTax)} />
            <Stat label={tr('Net VAT payable')} value={money(vat.annual.netVatDue)} tone={vat.annual.netVatDue > 0 ? 'bad' : 'good'} />
          </div>

          {vat.quarters.map((q: any) => (
            <div key={q.quarter} className="card mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>{q.quarter} {year}</h3>
                <span className={cn('text-xs font-medium', q.reconciliation.agrees ? 'text-green-600' : 'text-amber-600')}>
                  {q.reconciliation.agrees ? tr('Agrees with the ledger') : tr('Does not agree with the ledger')}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ color: 'var(--text-4)' }}>
                    <th className="text-left font-medium pb-1 w-10">{tr('Box')}</th>
                    <th className="text-left font-medium pb-1">{tr('Description')}</th>
                    <th className="text-right font-medium pb-1">{tr('Amount (AED)')}</th>
                    <th className="text-right font-medium pb-1">{tr('VAT (AED)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.boxes.map((b: any, i: number) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border-1)' }}>
                      <td className="py-1 text-xs" style={{ color: 'var(--text-4)' }}>{b.box}</td>
                      <td className="py-1" style={{ color: 'var(--text-2)' }}>{b.label}</td>
                      <td className="py-1 text-right tabular-nums">{b.amount === null ? '—' : money(b.amount)}</td>
                      <td className="py-1 text-right tabular-nums font-medium">{b.vat === null ? '—' : money(b.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {q.caveats.map((c: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-1)', color: 'var(--text-3)' }}>
                  <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                  <span><strong>{tr('Box')} {c.box}:</strong> {c.detail}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {tab === 'tax' && tax && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Stat label={tr('Taxable income')} value={money(tax.computation.find((l: any) => l.line === 'Taxable income')?.amount ?? 0)} />
            <Stat label={tr('Corporate tax payable')} value={money(tax.taxPayable)} tone={tax.taxPayable > 0 ? 'bad' : 'good'} />
            <Stat label={tr('Filing deadline')} value={tax.filingDeadline} />
          </div>

          <div className="card mb-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={electRelief} onChange={e => setElectRelief(e.target.checked)} />
              <span style={{ color: 'var(--text-1)' }}>{tr('Elect Small Business Relief')}</span>
              <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                {tax.smallBusinessRelief.available ? tr('(available)') : tr('(not available for this period)')}
              </span>
            </label>
            <ul className="mt-2 space-y-1">
              {tax.smallBusinessRelief.conditions.map((c: string, i: number) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-3)' }}>
                  <span style={{ color: 'var(--gold)' }}>·</span>{c}
                </li>
              ))}
            </ul>
            {tax.smallBusinessRelief.lossForfeitedByElecting > 0 && (
              <div className="flex items-start gap-2 text-xs mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-1)' }}>
                <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                <span style={{ color: 'var(--text-1)' }}>
                  {tr('Electing forfeits a loss of')} {money(tax.smallBusinessRelief.lossForfeitedByElecting)} {tr('that could otherwise be carried forward.')}
                </span>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-1)' }}>
              {tr('Computation — accounting profit to tax payable')}
            </h3>
            {tax.computation.map((l: any, i: number) => (
              <div
                key={i}
                className={cn('flex justify-between text-sm py-1.5 border-b', (l.subtotal || l.total) && 'font-bold')}
                style={{ borderColor: 'var(--border-1)' }}
              >
                <span style={{ color: 'var(--text-2)' }}>{l.line}</span>
                <span className="tabular-nums" style={{ color: 'var(--text-1)' }}>{money(l.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'management' && mgmt && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label={tr('Gross margin')} value={mgmt.grossMargin === null ? '—' : `${mgmt.grossMargin}%`} />
            <Stat label={tr('Net margin')} value={mgmt.netMargin === null ? '—' : `${mgmt.netMargin}%`} />
            <Stat label={tr('Current ratio')} value={mgmt.currentRatio === null ? '—' : String(mgmt.currentRatio)} />
            <Stat
              label={tr('Cash runway (months)')}
              value={mgmt.cashRunwayMonths === null ? '—' : String(mgmt.cashRunwayMonths)}
              tone={mgmt.cashRunwayMonths !== null && mgmt.cashRunwayMonths < 3 ? 'bad' : undefined}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-1)' }}>{tr('Owed to us')}</h3>
              <div className="flex justify-between text-sm py-1">
                <span style={{ color: 'var(--text-2)' }}>{tr('Total outstanding')}</span>
                <span className="tabular-nums font-bold">{money(mgmt.receivables.total)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span style={{ color: 'var(--text-2)' }}>{tr('Over 90 days')}</span>
                <span className="tabular-nums font-medium text-amber-600">{money(mgmt.receivables.overNinetyDays)}</span>
              </div>
            </div>
            <div className="card">
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-1)' }}>{tr('Owed by us')}</h3>
              <div className="flex justify-between text-sm py-1">
                <span style={{ color: 'var(--text-2)' }}>{tr('Total outstanding')}</span>
                <span className="tabular-nums font-bold">{money(mgmt.payables.total)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span style={{ color: 'var(--text-2)' }}>{tr('Over 90 days')}</span>
                <span className="tabular-nums font-medium text-amber-600">{money(mgmt.payables.overNinetyDays)}</span>
              </div>
            </div>
          </div>

          <div className="card mt-4">
            <Check ok={mgmt.balanceSheetBalances}>
              {mgmt.balanceSheetBalances
                ? tr('The balance sheet balances.')
                : tr('The balance sheet does not balance — see the Financial Statements tab.')}
            </Check>
            <Check ok={mgmt.workingCapital >= 0}>
              {mgmt.workingCapital >= 0
                ? `${tr('Working capital is positive at')} ${money(mgmt.workingCapital)}.`
                : `${tr('Working capital is negative at')} ${money(mgmt.workingCapital)} — ${tr('current liabilities exceed current assets.')}`}
            </Check>
          </div>
        </>
      )}

      {loading && !set && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-4)' }}>{tr('Loading…')}</div>
      )}
    </div>
  );
}
