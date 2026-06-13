'use client';

import { useState } from 'react';
import { financeApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Search, FileText, AlertCircle, CheckCircle } from 'lucide-react';

function quarterDates(year: number, q: number) {
  const starts = ['01-01', '04-01', '07-01', '10-01'];
  const ends   = ['03-31', '06-30', '09-30', '12-31'];
  return { start: `${year}-${starts[q - 1]}`, end: `${year}-${ends[q - 1]}` };
}

export default function VatReturnPage() {
  const currentYear = new Date().getFullYear();
  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQ > 1 ? currentQ - 1 : 1); // default to last quarter
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const { start, end } = useCustom
      ? { start: customStart, end: customEnd }
      : quarterDates(year, quarter);
    if (!start || !end) { setError('Please set a valid date range'); return; }
    setLoading(true); setError(''); setReport(null);
    try {
      const r = await financeApi.reports.vatReturn(start, end);
      setReport(r.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to generate VAT return');
    } finally { setLoading(false); }
  };

  const Box = ({ num, label, value, highlight = false }: { num: string; label: string; value: number; highlight?: boolean }) => (
    <div className={cn('flex items-center justify-between py-3 px-4 rounded-lg border', highlight ? 'border-brand-200 bg-brand-50' : 'border-gray-100 bg-white')}>
      <div className="flex items-center gap-3">
        <span className={cn('text-xs font-bold w-12 text-center py-1 rounded', highlight ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500')}>
          Box {num}
        </span>
        <span className={cn('text-sm', highlight ? 'font-semibold text-brand-800' : 'text-gray-700')}>{label}</span>
      </div>
      <span className={cn('font-bold text-sm', highlight ? 'text-brand-900 text-base' : 'text-gray-900')}>
        AED {formatCurrency(value)}
      </span>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="marquee-panel flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Finance · Tax</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>VAT Return</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>UAE VAT 201 — quarterly filing summary</p>
        </div>
        {report && (
          <div className="flex gap-2 print:hidden">
            <button onClick={() => {
              const rows = [
                ['Box', 'Description', 'Amount (AED)'],
                ['1', 'Standard-rated supplies', report.box1_standardRatedSales],
                ['4', 'Zero-rated supplies', report.box2_zeroRatedSales],
                ['5', 'Exempt supplies', report.box3_exemptSales],
                ['', 'Total supplies', report.box4_totalSales],
                ['6', 'Output VAT', report.box6_outputVat],
                ['9', 'Input VAT (recoverable)', report.box9_inputVat],
                ['', 'Net VAT payable / (refundable)', report.box11_netVatPayable],
              ];
              const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              const a = document.createElement('a'); a.href = url;
              a.download = `vat-201-${report.period?.startDate}_${report.period?.endDate}.csv`; a.click();
              URL.revokeObjectURL(url);
            }} className="btn btn-secondary text-sm">Export CSV</button>
            <button onClick={() => window.print()} className="btn btn-secondary text-sm">Print / PDF</button>
          </div>
        )}
      </div>

      {/* Period selector */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Select Tax Period</h3>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!useCustom} onChange={() => setUseCustom(false)} />
            <span className="text-sm text-gray-700">Quarter</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={useCustom} onChange={() => setUseCustom(true)} />
            <span className="text-sm text-gray-700">Custom range</span>
          </label>
        </div>

        {!useCustom ? (
          <div className="flex gap-3">
            <div>
              <label className="label">Year</label>
              <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Quarter</label>
              <select className="input" value={quarter} onChange={e => setQuarter(Number(e.target.value))}>
                <option value={1}>Q1 — Jan–Mar</option>
                <option value={2}>Q2 — Apr–Jun</option>
                <option value={3}>Q3 — Jul–Sep</option>
                <option value={4}>Q4 — Oct–Dec</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        {error && <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

        <div className="mt-4">
          <button onClick={run} disabled={loading} className="btn btn-primary disabled:opacity-50">
            <Search size={14} className="mr-1" />
            {loading ? 'Calculating...' : 'Generate VAT Return'}
          </button>
        </div>
      </div>

      {/* Results */}
      {report && (
        <>
          {/* Header */}
          <div className="card mb-4 bg-gray-900 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">UAE VAT 201 Return</p>
                <p className="font-bold text-lg mt-0.5">The Film Makers FZ LLC</p>
                <p className="text-sm text-gray-400">Period: {report.period.startDate} to {report.period.endDate}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Based on</p>
                <p className="font-semibold">{report.invoiceCount} invoices</p>
                <p className="text-sm text-gray-400">{report.expenseCount} expense records</p>
              </div>
            </div>
          </div>

          {/* Part 1 — Sales */}
          <div className="card mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Part 1 — Sales & All Other Outputs</h3>
            <div className="space-y-2">
              <Box num="1" label="Standard Rated Sales (5%)" value={report.box1_standardRatedSales} />
              <Box num="2" label="Zero Rated Sales (0%)" value={report.box2_zeroRatedSales} />
              <Box num="3" label="Exempt Sales" value={report.box3_exemptSales} />
              <Box num="4" label="Total Sales (Box 1 + 2 + 3)" value={report.box4_totalSales} />
            </div>
          </div>

          {/* Part 2 — VAT */}
          <div className="card mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Part 2 — VAT on Sales & Purchases</h3>
            <div className="space-y-2">
              <Box num="6" label="Output VAT (VAT on sales)" value={report.box6_outputVat} />
              <Box num="9" label="Input VAT (Recoverable VAT on expenses)" value={report.box9_inputVat} />
              <Box num="10" label="Other Adjustments" value={report.box10_adjustments} />
              <Box num="11"
                label={report.box11_netVatPayable >= 0 ? 'Net VAT Payable to FTA' : 'VAT Refund Due from FTA'}
                value={Math.abs(report.box11_netVatPayable)}
                highlight />
            </div>
          </div>

          {/* Net indicator */}
          <div className={cn('rounded-xl p-4 mb-6 flex items-center gap-3',
            report.box11_netVatPayable >= 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200')}>
            {report.box11_netVatPayable >= 0
              ? <AlertCircle size={20} className="text-red-500 shrink-0" />
              : <CheckCircle size={20} className="text-green-600 shrink-0" />}
            <div>
              <p className={cn('font-semibold text-sm', report.box11_netVatPayable >= 0 ? 'text-red-700' : 'text-green-700')}>
                {report.box11_netVatPayable >= 0
                  ? `AED ${formatCurrency(report.box11_netVatPayable)} due to FTA`
                  : `AED ${formatCurrency(Math.abs(report.box11_netVatPayable))} refund claimable`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Output VAT {formatCurrency(report.box6_outputVat)} − Input VAT {formatCurrency(report.box9_inputVat)}
              </p>
            </div>
          </div>

          {/* Client breakdown */}
          {report.clientBreakdown?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales by Client</h3>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Client</th>
                    <th className="table-th">TRN</th>
                    <th className="table-th text-right">Sales (excl. VAT)</th>
                    <th className="table-th text-right">VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {report.clientBreakdown.map((c: any) => (
                    <tr key={c.companyName} className="table-row">
                      <td className="table-td font-medium text-sm">{c.companyName}</td>
                      <td className="table-td text-xs text-gray-500 font-mono">{c.trn || '—'}</td>
                      <td className="table-td text-sm text-right">{formatCurrency(c.sales)}</td>
                      <td className="table-td text-sm text-right font-semibold">{formatCurrency(c.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
