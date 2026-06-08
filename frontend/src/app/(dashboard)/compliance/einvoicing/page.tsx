'use client';

import { useEffect, useState } from 'react';
import { FileCheck2, RefreshCw, Check, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { complianceApi } from '@/lib/api';

export default function EInvoicingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); complianceApi.einvoicing().then(r => setData(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const score = data?.score ?? 0;
  const ring = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';

  const sevBadge = (s: string) => {
    const map: any = { high: 'bg-red-50 text-red-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-gray-100 text-gray-500' };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full ${map[s] || map.low}`}>{s}</span>;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><FileCheck2 size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">e-Invoicing Readiness</h1>
            <p className="text-sm text-gray-500">How prepared your data is for the UAE mandatory e-invoicing rollout.</p>
          </div>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {loading ? <div className="card h-40 animate-pulse bg-gray-50" /> : data && (
        <>
          {/* Score + checklist */}
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <div className="card p-5 flex flex-col items-center justify-center text-center">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#eee" strokeWidth="9" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={ring} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 264} 264`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{score}%</span>
                  <span className="text-[10px] text-gray-400">ready</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">{data.passed}/{data.total} checks passing</p>
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50"><h2 className="font-semibold text-gray-800 text-sm">Readiness checklist</h2></div>
              <div className="divide-y divide-gray-50">
                {data.checks.map((c: any) => (
                  <div key={c.key} className="flex items-center gap-3 px-5 py-2.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${c.ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {c.ok ? <Check size={13} /> : <X size={13} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 flex items-center gap-2">{c.label} {!c.ok && sevBadge(c.severity)}</div>
                      <div className="text-xs text-gray-400">{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">UAE rollout timeline</h2>
            </div>
            <div className="p-5 space-y-3">
              {data.timeline.map((t: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-500 mt-1.5" />
                    {i < data.timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                  </div>
                  <div className="pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{t.phase}</span>
                      <span className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{t.date}</span>
                      <span className="text-[11px] text-gray-400">{t.who}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model note */}
          <div className="card p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="text-gray-800 font-medium">How it will work</p>
              <p className="mt-0.5">{data.model} Invoices are exchanged through an Accredited Service Provider (ASP) — your ERP prepares the structured invoice; the ASP transmits it on the Peppol network and reports to the FTA. This page keeps your data export-ready; full transmission requires appointing an ASP closer to your phase.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
