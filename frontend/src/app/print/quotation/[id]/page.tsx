'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { financeApi, settingsApi } from '@/lib/api';
import DocumentLayout, { DEFAULT_DOC_SETTINGS } from '@/components/finance/DocumentLayout';
import { renderTemplate, buildContext } from '@/lib/reportTemplate';

const GOLD = '#0f172a';
const NAVY = '#1a1a2e';

export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ]       = useState<any>(null);
  const [co, setCo]     = useState<any>(null);
  const [bank, setBank] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      financeApi.quotations.get(id),
      settingsApi.get(),
      financeApi.bankAccounts.list(),
    ]).then(([qRes, coRes, bankRes]) => {
      setQ(qRes.data);
      setCo(coRes.data);
      const accs: any[] = bankRes.data ?? [];
      setBank(accs.find((b: any) => b.isDefaultQuotation && b.isActive) ?? accs.find((b: any) => b.isActive) ?? null);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && q) setTimeout(() => window.print(), 500);
  }, [loading, q]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', fontSize: 13 }}>
      Preparing document…
    </div>
  );
  if (!q) return <div style={{ padding: 32, color: 'red' }}>Quotation not found.</div>;

  const settings = co?.documentSettings || {};
  const title = settings.quotationTitle || DEFAULT_DOC_SETTINGS.quotationTitle;
  const tpl = settings?.templates?.quotation;
  const useTpl = !!(tpl && tpl.html);

  return (
    <>
      <div className="print:hidden" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
        background: NAVY, color: 'white', padding: '9px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => window.history.back()} style={{ color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>← Back</button>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{q.quotationNumber} — {title}</span>
        </div>
        <button onClick={() => window.print()} style={{ background: GOLD, color: 'white', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          🖨️ Print / Save as PDF
        </button>
      </div>

      <div style={{ background: 'white', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        {useTpl ? (
          <>
            <style dangerouslySetInnerHTML={{ __html: tpl.css || '' }} />
            <div dangerouslySetInnerHTML={{ __html: renderTemplate(tpl.html, buildContext('quotation', q, co, bank)) }} />
          </>
        ) : (
          <DocumentLayout type="quotation" doc={q} company={co} bank={bank} settings={settings} />
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm 10mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
          .print\\:pt-0  { padding-top: 0 !important; }
        }
      `}</style>
    </>
  );
}
