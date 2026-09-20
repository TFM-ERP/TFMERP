'use client';

/**
 * Receipt document — the acknowledgement of money received.
 *
 * A receipt has no line items, so it does not go through DocumentLayout (which is
 * built around an items table). It borrows the same page geometry and print
 * chrome so it comes out of the printer identical in size and margins to an
 * invoice, and it reads the same company profile.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { financeApi, settingsApi, companyLogoUrl } from '@/lib/api';
import { PRINT_CHROME_CSS, buildDocPrintCss } from '@/components/finance/DocumentLayout';

const GOLD = '#0f172a';
const NAVY = '#1a1a2e';

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  CARD: 'Card',
  ONLINE: 'Online',
};

function money(n: any): string {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function day(d: any): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Amount in words — UAE dirhams and fils, as a receipt is expected to carry. */
function inWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function under1000(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '');
    return `${ones[Math.floor(n / 100)]} Hundred` + (n % 100 ? ` and ${under1000(n % 100)}` : '');
  }

  function whole(n: number): string {
    if (n === 0) return 'Zero';
    const parts: string[] = [];
    const units: [number, string][] = [[1000000000, 'Billion'], [1000000, 'Million'], [1000, 'Thousand']];
    let rest = n;
    for (const [value, name] of units) {
      if (rest >= value) {
        parts.push(`${under1000(Math.floor(rest / value))} ${name}`);
        rest %= value;
      }
    }
    if (rest > 0) parts.push(under1000(rest));
    return parts.join(' ');
  }

  const dirhams = Math.floor(Math.abs(amount));
  const fils = Math.round((Math.abs(amount) - dirhams) * 100);
  const head = `UAE Dirhams ${whole(dirhams)}`;
  return fils > 0 ? `${head} and ${whole(fils)} Fils only` : `${head} only`;
}

export default function ReceiptPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [rcp, setRcp] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([financeApi.payments.get(id), settingsApi.get()])
      .then(([rRes, coRes]) => {
        setRcp(rRes.data);
        setCo(coRes.data);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [id]);

  // The document logo first, the general one next, the bundled file last.
  const logo = companyLogoUrl(co?.invoiceLogoUrl) || companyLogoUrl(co?.logoUrl) || '/tfm-logo.png';

  useEffect(() => {
    if (!loading && rcp) setTimeout(() => window.print(), 500);
  }, [loading, rcp]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', fontSize: 13 }}>
        Preparing receipt…
      </div>
    );
  }
  if (failed || !rcp) {
    return <div style={{ padding: 32, color: '#b91c1c' }}>Receipt not found.</div>;
  }

  const settings = co?.documentSettings || {};
  // /settings returns the company under legacy field names: `name` is the legal
  // entity, `tradeName` the trading name.
  const companyName = co?.name || co?.tradeName || 'The Film Makers FZ LLC';
  const currency = rcp.currency || rcp.invoice?.currency || 'AED';
  const amount = Number(rcp.amount ?? 0);
  const client = rcp.client;
  const invoice = rcp.invoice;
  const bank = rcp.bankAccount;
  const isCash = rcp.method === 'CASH';
  const dueAfter = invoice?.amountDue != null ? Number(invoice.amountDue) : null;

  // The stored address usually already names the emirate, so only add city and
  // country when they say something the address line does not.
  const addressLine: string = co?.address || '';
  const place = [co?.city, co?.country]
    .filter((p: string | undefined): p is string => !!p && !addressLine.toLowerCase().includes(p.toLowerCase()))
    .join(', ');

  // "Cleared" only earns a row when it tells you something the date does not.
  const clearedDay = day(rcp.clearedAt);
  const showCleared = !!rcp.clearedAt && clearedDay !== day(rcp.paymentDate);

  const cell: React.CSSProperties = { padding: '7px 0', fontSize: 12, color: '#1f2937', verticalAlign: 'top' };
  const label: React.CSSProperties = { ...cell, color: '#6b7280', width: 150, paddingRight: 14 };

  return (
    <>
      <div
        className="print:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: NAVY, color: 'white', padding: '9px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => window.history.back()}
            style={{ color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            ← Back
          </button>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{rcp.paymentNumber} — Receipt</span>
        </div>
        <button
          onClick={() => window.print()}
          style={{ background: GOLD, color: 'white', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Print / Save as PDF
        </button>
      </div>

      <div style={{ background: 'white', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        {/* Same wrapper class and geometry as DocumentLayout, so the receipt
            prints at the identical A4 size and margins as an invoice. */}
        {/* A4 at 96dpi is 794 x 1123. Giving the page that height and laying it
            out as a column lets the footer sit at the foot of the sheet rather
            than trailing the content. */}
        <div
          className="tfm-doc tfm-receipt"
          style={{
            maxWidth: 794,
            minHeight: 1123,
            margin: '0 auto',
            padding: `${settings.pageMarginY ?? 40}px ${settings.pageMarginX ?? 48}px`,
            background: '#fff',
            fontFamily: settings.fontFamily || 'Helvetica, Arial, sans-serif',
            color: '#111827',
            lineHeight: 1.45,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt=""
                style={{ height: settings.logoHeight ?? 52, width: 'auto', objectFit: 'contain', display: 'block', marginBottom: 10 }}
              />
              <div style={{ fontSize: 12, fontWeight: 700 }}>{companyName}</div>
              {addressLine && <div style={{ fontSize: 10.5, color: '#6b7280', maxWidth: 280, lineHeight: 1.5 }}>{addressLine}</div>}
              {place && <div style={{ fontSize: 10.5, color: '#6b7280' }}>{place}</div>}
              {co?.trn && <div style={{ fontSize: 10.5, color: '#6b7280' }}>TRN: {co.trn}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: 3, textTransform: 'uppercase', color: '#111827' }}>
                Receipt
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                No.: <strong style={{ color: '#111827' }}>{rcp.paymentNumber}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Date: {day(rcp.paymentDate)}</div>
              {rcp.status !== 'CLEARED' && (
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#b45309' }}>
                  {rcp.status}
                </div>
              )}
            </div>
          </div>

          {/* Received from */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 9.5, letterSpacing: 1.4, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>
              Received with thanks from
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{client?.companyName || '—'}</div>
            {client?.billingAddress && (
              <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.6, maxWidth: 320 }}>{client.billingAddress}</div>
            )}
            {(client?.trn || client?.vatId) && (
              <div style={{ fontSize: 11, color: '#6b7280' }}>TRN: {client.trn || client.vatId}</div>
            )}
          </div>

          {/* The sum */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '18px 20px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: '#9ca3af' }}>
                Amount received
              </span>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{currency} {money(amount)}</span>
            </div>
            {/* The words form is written in dirhams and fils, so it is only
                correct for AED. Another currency shows figures alone. */}
            {currency === 'AED' && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#4b5563', fontStyle: 'italic' }}>{inWords(amount)}</div>
            )}
          </div>

          {/* Detail */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28 }}>
            <tbody>
              <tr>
                <td style={label}>Payment method</td>
                <td style={cell}>{METHOD_LABEL[rcp.method] || rcp.method}</td>
              </tr>
              {rcp.reference && (
                <tr>
                  <td style={label}>{rcp.method === 'CHEQUE' ? 'Cheque no.' : 'Reference'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace' }}>{rcp.reference}</td>
                </tr>
              )}
              {invoice && (
                <tr>
                  <td style={label}>Against invoice</td>
                  <td style={cell}>
                    <strong>{invoice.invoiceNumber}</strong>
                    {invoice.total != null && (
                      <span style={{ color: '#6b7280' }}>
                        {' · invoice total '}{currency} {money(invoice.total)}
                        {dueAfter != null && dueAfter > 0.005
                          ? <> · still due {currency} {money(dueAfter)}</>
                          : <> · settled in full</>}
                      </span>
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <td style={label}>Received into</td>
                <td style={cell}>
                  {isCash
                    ? 'Cash'
                    : bank
                      ? `${bank.bankName || bank.accountName || 'Bank'}${bank.accountNumber ? ` — ${bank.accountNumber}` : ''}`
                      : '—'}
                </td>
              </tr>
              {showCleared && (
                <tr>
                  <td style={label}>Cleared</td>
                  <td style={cell}>{clearedDay}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Signature */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 54 }}>
            <div style={{ textAlign: 'center', minWidth: 210 }}>
              <div style={{ borderTop: '1px solid #9ca3af', paddingTop: 7, fontSize: 11, color: '#4b5563' }}>
                For {companyName}
              </div>
            </div>
          </div>

          {/* Everything above is content; this pushes the closing band to the
              foot of the sheet. */}
          <div style={{ flex: '1 1 auto', minHeight: 24 }} />

          <div style={{ paddingTop: 12, borderTop: '1px solid #f3f4f6', fontSize: 9.5, color: '#9ca3af', lineHeight: 1.6 }}>
            This receipt acknowledges the sum shown as received. It is not a tax invoice.
            {invoice?.invoiceNumber ? ` The tax invoice for this supply is ${invoice.invoiceNumber}.` : ''}
          </div>

          {/* The same contact band the invoices carry, so a receipt filed next
              to one looks like it came from the same company. */}
          <div
            className="tfm-doc__footer"
            style={{
              marginTop: 20, paddingTop: 10, borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              gap: 16, fontSize: 9, color: '#9ca3af',
            }}
          >
            <div style={{ lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: '#6b7280' }}>{companyName}</div>
              {addressLine && <div>{addressLine}</div>}
              {[co?.phone, co?.billingEmail || co?.email].filter(Boolean).length > 0 && (
                <div>{[co?.phone, co?.billingEmail || co?.email].filter(Boolean).join('  ·  ')}</div>
              )}
            </div>
            {co?.website && (
              <div style={{ letterSpacing: 2.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {String(co.website).replace(/^https?:\/\//, '')}
              </div>
            )}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html:
            PRINT_CHROME_CSS +
            buildDocPrintCss(settings) +
            `
/* Chrome prints its own header and footer — the page URL and "1/1" — whenever
   the page has a non-zero @page margin. Taking that margin to zero suppresses
   them, so the receipt a client receives carries no localhost address. The
   margin the document actually needs is then applied as padding on the sheet
   itself, which prints identically. This overrides the shared geometry for the
   receipt only; invoices are untouched. */
@media print {
  @page { size: A4; margin: 0; }
  .tfm-receipt {
    padding: ${settings.pageMarginY ?? 40}px ${settings.pageMarginX ?? 48}px !important;
    min-height: 1123px;
    box-sizing: border-box;
  }
}`,
        }}
      />
    </>
  );
}
