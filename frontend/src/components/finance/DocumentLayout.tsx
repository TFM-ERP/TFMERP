'use client';

import React from 'react';

/**
 * Shared commercial-document renderer for Invoices and Quotations.
 * Used by the print/PDF pages AND the Report Designer live preview, so the
 * preview is guaranteed identical to the printed output.
 *
 * All visual options come from `settings` (CompanyProfile.documentSettings).
 * When a setting is missing the component falls back to the original look.
 */

export type SectionKey = 'header' | 'parties' | 'items' | 'totals' | 'bank' | 'signature' | 'notes' | 'footer';
export type ColumnKey = 'desc' | 'qty' | 'days' | 'price' | 'total' | 'vatrate' | 'vatamt';

export interface ColumnSetting { key: ColumnKey; show: boolean; width?: string }

export interface DocumentSettings {
  accentColor?: string;
  navyColor?: string;
  invoiceTitle?: string;
  quotationTitle?: string;
  showLogo?: boolean;
  logoHeight?: number;
  logoPosition?: 'left' | 'center' | 'right';
  showBankBlock?: boolean;
  showSignature?: boolean;
  showDays?: boolean;
  showVatRate?: boolean;
  showVatAmount?: boolean;
  invoiceFooter?: string;
  quotationFooter?: string;
  // structured layout
  fontFamily?: string;
  baseFontSize?: number;
  pageMarginX?: number;
  pageMarginY?: number;
  sectionOrder?: SectionKey[];
  columns?: ColumnSetting[];
}

export const ALL_SECTIONS: SectionKey[] = ['header', 'parties', 'items', 'totals', 'bank', 'signature', 'notes', 'footer'];
export const SECTION_LABELS: Record<SectionKey, string> = {
  header: 'Header (title + logo)', parties: 'Company & client info', items: 'Line items table',
  totals: 'Totals', bank: 'Bank / payment details', signature: 'Signature (quotation)',
  notes: 'Notes', footer: 'Footer',
};

export const COLUMN_DEFS: { key: ColumnKey; label: string; align: 'left' | 'center' | 'right'; width: string }[] = [
  { key: 'desc', label: 'Description', align: 'left', width: '' },
  { key: 'qty', label: 'Qty', align: 'center', width: '6%' },
  { key: 'days', label: 'Days', align: 'center', width: '6%' },
  { key: 'price', label: 'Unit Price', align: 'right', width: '12%' },
  { key: 'total', label: 'Total', align: 'right', width: '12%' },
  { key: 'vatrate', label: 'VAT Rate', align: 'center', width: '8%' },
  { key: 'vatamt', label: 'VAT Amount', align: 'right', width: '12%' },
];

export const DEFAULT_DOC_SETTINGS: Required<Omit<DocumentSettings, 'columns'>> & { columns: ColumnSetting[] } = {
  accentColor: '#0f172a',
  navyColor: '#1a1a2e',
  invoiceTitle: 'Tax Invoice',
  quotationTitle: 'Quotation',
  showLogo: true,
  logoHeight: 48,
  logoPosition: 'right',
  showBankBlock: true,
  showSignature: true,
  showDays: true,
  showVatRate: true,
  showVatAmount: true,
  invoiceFooter:
    'This is a computer-generated invoice. No stamp or signature is required. ' +
    'Any discrepancy found in this invoice should be brought to our notice in writing within 5 working days.',
  quotationFooter:
    'This is a computer-generated quotation. Prices are valid until the date specified above. ' +
    'Any discrepancy should be brought to our notice in writing within 5 working days.',
  fontFamily: 'Arial, Helvetica, sans-serif',
  baseFontSize: 9.5,
  pageMarginX: 38,
  pageMarginY: 28,
  sectionOrder: [...ALL_SECTIONS],
  columns: COLUMN_DEFS.map(c => ({ key: c.key, show: true, width: c.width })),
};

const fmtAmt = (n: any) =>
  Number(n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const GOLD_D = '#8B6914';

interface Props {
  type: 'invoice' | 'quotation';
  doc: any;
  company: any;
  bank: any;
  settings?: DocumentSettings | null;
  logoSrc?: string;
}

export default function DocumentLayout({ type, doc, company, bank, settings, logoSrc = '/tfm-logo.svg' }: Props) {
  const S = { ...DEFAULT_DOC_SETTINGS, ...(settings || {}) };
  const GOLD = S.accentColor;
  const NAVY = S.navyColor;
  const BASE = Number(S.baseFontSize) || 9.5;

  const co = company || {};
  const isQuote = type === 'quotation';

  const cur = doc.currency ?? 'AED';
  const vatRate = Number(co?.vatRate ?? 5);
  const items: any[] = doc.items ?? [];
  const subtotal = Number(doc.subtotal ?? 0);
  const vatAmount = Number(doc.vatAmount ?? 0);
  const total = Number(doc.total ?? 0);
  const discountAmt = Number(doc.discountAmount ?? 0);
  const deductionAmt = Number(doc.deductionAmount ?? 0);
  const amountPaid = Number(doc.amountPaid ?? 0);
  const amountDue = Number(doc.amountDue ?? 0);
  const billingEmail = co?.billingEmail || co?.email;

  const docNumber = isQuote ? doc.quotationNumber : doc.invoiceNumber;
  const docTitle = isQuote ? S.quotationTitle : (doc.invoiceType === 'CREDIT_NOTE' ? 'Credit Note' : S.invoiceTitle);
  const client = doc.client || {};

  // ── effective columns (config or legacy toggles) ──
  let cols: { key: ColumnKey; label: string; align: string; width?: string }[];
  if (settings?.columns && settings.columns.length) {
    cols = settings.columns.filter(c => c.show).map(c => {
      const def = COLUMN_DEFS.find(d => d.key === c.key)!;
      return { key: c.key, label: def.label, align: def.align, width: c.width ?? def.width };
    });
  } else {
    cols = COLUMN_DEFS.filter(d =>
      (d.key !== 'days' || S.showDays) &&
      (d.key !== 'vatrate' || S.showVatRate) &&
      (d.key !== 'vatamt' || S.showVatAmount)
    ).map(d => ({ key: d.key, label: d.label, align: d.align, width: d.width }));
  }

  const order: SectionKey[] = (S.sectionOrder && S.sectionOrder.length ? S.sectionOrder : ALL_SECTIONS)
    .filter(k => ALL_SECTIONS.includes(k));

  const GoldRule = () => (
    <div style={{ width: 2, background: GOLD, flexShrink: 0, alignSelf: 'stretch', margin: '0 14px' }} />
  );

  const clientNode = (
    <>
      <div style={{ fontWeight: 700 }}>{client?.companyName}</div>
      {client?.billingAddress && <div>{client.billingAddress}</div>}
      {[client?.city, client?.country].filter(Boolean).length > 0 && (
        <div>{[client?.city, client?.country].filter(Boolean).join(', ')}</div>
      )}
    </>
  );

  const metaRows: any[] = isQuote
    ? [
        { label: 'Prepared For', node: clientNode, multiline: true },
        { label: 'Customer TRN Number', value: client?.trn ?? '—' },
        { label: 'Quotation Number', value: docNumber },
        { label: 'Issue Date', value: fmtDate(doc.issueDate) },
        { label: 'Valid Until', value: fmtDate(doc.validUntil) },
        { label: 'Status', value: (doc.status ?? '').replace('_', ' ') },
        ...(doc.subject ? [{ label: 'Subject', value: doc.subject }] : []),
      ]
    : [
        { label: 'Invoice To', node: clientNode, multiline: true },
        { label: 'Customer TRN Number', value: client?.trn ?? '—' },
        { label: `${docTitle} Number`, value: docNumber },
        { label: 'Invoice Date', value: fmtDate(doc.issueDate) },
        { label: 'Due Date', value: fmtDate(doc.dueDate) },
        { label: 'Status', value: (doc.status ?? '').replace('_', ' ') },
        ...(doc.bookingId ? [{ label: 'Reference', value: doc.bookingId }] : []),
      ];

  const cellVal = (item: any, key: ColumnKey) => {
    const lineVat = Number(item.taxAmount ?? 0);
    switch (key) {
      case 'desc': return (<>{item.description}{item.details && <div style={{ color: '#999', fontSize: BASE - 1, marginTop: 1 }}>{item.details}</div>}</>);
      case 'qty': return Number(item.quantity);
      case 'days': return item.days ?? 1;
      case 'price': return fmtAmt(item.unitPrice);
      case 'total': return fmtAmt(item.lineTotal);
      case 'vatrate': return lineVat > 0 ? `${vatRate}%` : '0%';
      case 'vatamt': return fmtAmt(lineVat);
      default: return '';
    }
  };

  // ── section renderers ──
  const Section: Record<SectionKey, React.ReactNode> = {
    header: (
      <div key="header">
        <div style={{ display: 'flex', justifyContent: S.logoPosition === 'left' ? 'flex-start' : S.logoPosition === 'center' ? 'center' : 'space-between', alignItems: 'flex-start', gap: 12, flexDirection: S.logoPosition === 'left' ? 'row-reverse' : 'row' }}>
          <div style={{ paddingTop: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, letterSpacing: 0.8 }}>{docTitle.toUpperCase()}</div>
          </div>
          {S.showLogo && (
            <img src={logoSrc} alt="Logo" style={{ height: S.logoHeight, width: 'auto', objectFit: 'contain', display: 'block', ...(S.logoPosition === 'center' ? { position: 'absolute', left: '50%', transform: 'translateX(-50%)' } : {}) }} />
          )}
        </div>
        <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 16px' }} />
      </div>
    ),
    parties: (
      <div key="parties" style={{ display: 'flex', alignItems: 'stretch', marginBottom: 20 }}>
        <div style={{ flex: '0 0 220px', paddingRight: 4 }}>
          {[
            { k: 'Name', v: co?.name ?? 'The Film Makers FZ LLC', bold: true },
            { k: 'Address', v: co?.address },
            { k: 'City / Country', v: [co?.city, co?.country].filter(Boolean).join(', ') || 'Dubai, UAE' },
            { k: 'TRN', v: co?.trn },
            { k: 'Phone', v: co?.phone },
            { k: 'Billing Email', v: billingEmail },
          ].filter(r => r.v).map((r: any, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: GOLD_D, fontSize: BASE - 0.5 }}>{r.k}</span>
              <div style={{ color: '#333', fontWeight: r.bold ? 700 : 400 }}>{r.v}</div>
            </div>
          ))}
        </div>
        <GoldRule />
        <div style={{ flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {metaRows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#F9F6EE' : '#FDF9F4' }}>
                  <td style={{ fontWeight: 700, color: NAVY, padding: '4px 8px', borderBottom: '1px solid #EEE8D8', verticalAlign: 'top', width: '44%', fontSize: BASE, whiteSpace: 'nowrap' }}>{row.label}:</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #EEE8D8', verticalAlign: 'top', fontSize: BASE, whiteSpace: row.multiline ? 'pre-line' : 'normal' }}>{row.node || row.value || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    items: (
      <table key="items" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, border: '1px solid #ddd', fontSize: BASE }}>
        <thead>
          <tr style={{ background: '#F2EAD3' }}>
            {cols.map((h, i) => (
              <th key={h.key} style={{ textAlign: h.align as any, padding: '6px 8px', fontWeight: 700, color: NAVY, borderBottom: `2px solid ${GOLD}`, width: h.width || undefined, borderRight: i < cols.length - 1 ? '1px solid #ddd' : undefined, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, ri: number) => (
            <tr key={item.id ?? ri} style={{ background: ri % 2 === 0 ? '#fff' : '#FDFAF4' }}>
              {cols.map((c, ci) => (
                <td key={c.key} style={{ padding: '6px 8px', textAlign: c.align as any, borderBottom: '1px solid #eee', borderRight: ci < cols.length - 1 ? '1px solid #eee' : undefined, verticalAlign: 'top' }}>{cellVal(item, c.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    totals: (
      <div key="totals" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <table style={{ borderCollapse: 'collapse', border: '1px solid #ddd', fontSize: BASE }}>
          <tbody>
            <tr>
              <td style={{ padding: '5px 10px', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #eee', borderRight: '1px solid #eee', background: '#fafafa', color: NAVY, minWidth: 200 }}>Total Amount</td>
              <td style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #eee', borderRight: '1px solid #eee', minWidth: 100 }}>{fmtAmt(subtotal)}</td>
              <td style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #eee', minWidth: 90 }}>{fmtAmt(vatAmount)}</td>
            </tr>
            {discountAmt > 0 && (
              <tr>
                <td style={{ padding: '5px 10px', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #eee', borderRight: '1px solid #eee', background: '#fafafa', color: NAVY }}>Discount</td>
                <td colSpan={2} style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #eee', color: '#c0392b' }}>− {fmtAmt(discountAmt)}</td>
              </tr>
            )}
            {deductionAmt > 0 && (
              <tr>
                <td style={{ padding: '5px 10px', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #eee', borderRight: '1px solid #eee', background: '#fafafa', color: NAVY }}>Deduction{doc.deductionReason ? ` (${doc.deductionReason})` : ''}</td>
                <td colSpan={2} style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #eee', color: '#c0392b' }}>− {fmtAmt(deductionAmt)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #eee', borderRight: '1px solid #eee', background: '#F2EAD3', color: NAVY }}>Total Amount Inclusive of VAT</td>
              <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #eee', background: '#F2EAD3' }}>{cur} {fmtAmt(total)}</td>
            </tr>
            {!isQuote && (
              <>
                <tr>
                  <td style={{ padding: '5px 10px', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #eee', borderRight: '1px solid #eee', background: '#fafafa', color: NAVY }}>Amount Settled / Adjusted</td>
                  <td colSpan={2} style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{fmtAmt(amountPaid)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'right', borderRight: '1px solid #555', background: NAVY, color: 'white' }}>Balance Due Amount</td>
                  <td colSpan={2} style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: BASE + 1, background: GOLD, color: 'white' }}>{cur} {fmtAmt(amountDue)}</td>
                </tr>
              </>
            )}
            {isQuote && (
              <tr>
                <td colSpan={3} style={{ padding: '5px 10px', textAlign: 'right', fontStyle: 'italic', color: '#999', fontSize: BASE - 0.5, background: '#FDFAF4', borderTop: '1px solid #eee' }}>Valid until {fmtDate(doc.validUntil)}. Prices subject to change after this date.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    ),
    bank: (S.showBankBlock && bank) ? (
      <div key="bank" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 12 }}>{isQuote ? 'Bank Details (for reference)' : 'Payment Method'}</div>
        <div style={{ display: 'flex', alignItems: 'stretch', fontSize: BASE }}>
          <div style={{ flex: '0 0 200px', paddingRight: 4 }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 3 }}>Cheques Payable to</div>
            <div style={{ marginBottom: 14, color: '#333', fontWeight: 700 }}>{co?.name ?? 'The Film Makers FZ LLC'}</div>
            {!isQuote && (
              <>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: 3 }}>Bank Transfer</div>
                <div style={{ color: '#777', fontSize: BASE - 0.5, lineHeight: 1.4 }}>Please use the invoice number as payment reference.</div>
              </>
            )}
          </div>
          <GoldRule />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 6 }}>Transfer Funds to</div>
            <table style={{ borderCollapse: 'collapse', fontSize: BASE }}>
              <tbody>
                {[
                  { label: 'Account Name', value: bank.accountName },
                  { label: 'Account Number', value: bank.accountNumber },
                  { label: 'IBAN', value: bank.iban },
                  { label: 'Bank', value: bank.bankName },
                  { label: 'Swift Code', value: bank.swiftCode },
                  { label: 'Branch', value: bank.branch },
                  { label: 'Currency', value: bank.currency },
                ].filter(r => r.value).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: NAVY, paddingRight: 10, paddingBottom: 3, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.label}:</td>
                    <td style={{ paddingBottom: 3, color: '#444' }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ) : null,
    signature: (isQuote && S.showSignature) ? (
      <div key="signature" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, marginTop: 28, marginBottom: 16 }}>
        {[`Authorised Signature — ${co?.name ?? 'The Film Makers FZ LLC'}`, `Client Acceptance — ${client?.companyName ?? ''}`].map((label, i) => (
          <div key={i}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: 5 }}>
              <div style={{ fontSize: 8.5, color: '#888' }}>{label}</div>
              <div style={{ fontSize: 8.5, color: '#bbb', marginTop: 2 }}>Name, Stamp &amp; Date</div>
            </div>
          </div>
        ))}
      </div>
    ) : null,
    notes: (!isQuote && doc.notes) ? (
      <div key="notes" style={{ marginBottom: 18, padding: '8px 12px', background: '#FDFAF4', border: '1px solid #EEE8D8', borderRadius: 3, fontSize: BASE }}>
        <div style={{ fontWeight: 700, color: GOLD_D, marginBottom: 2, fontSize: BASE - 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</div>
        <div style={{ color: '#555' }}>{doc.notes}</div>
      </div>
    ) : null,
    footer: (
      <div key="footer" style={{ borderTop: '1px solid #ddd', marginTop: 20, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ color: '#999', fontSize: 8, maxWidth: '65%', lineHeight: 1.5 }}>{isQuote ? S.quotationFooter : S.invoiceFooter}</div>
        <div style={{ textAlign: 'right', color: '#999', fontSize: 8, lineHeight: 1.6 }}>
          {co?.website && <div>{co.website}</div>}
          {billingEmail && <div>{billingEmail}</div>}
          {co?.phone && <div>{co.phone}</div>}
        </div>
      </div>
    ),
  };

  return (
    <div style={{ maxWidth: 794, margin: '0 auto', padding: `${S.pageMarginY}px ${S.pageMarginX}px`, background: '#fff', position: 'relative', fontFamily: S.fontFamily, fontSize: BASE, color: '#222', lineHeight: 1.45 }}>
      {order.map(k => Section[k])}
    </div>
  );
}
