/**
 * Report template engine for the GrapesJS visual report builder.
 *
 *  - buildContext(): turns an invoice/quotation + company + bank into a flat
 *    map of PRE-FORMATTED strings (currency, dates already rendered) so the
 *    template only needs to drop tokens in.
 *  - renderTemplate(): substitutes {{ path }} tokens and expands a repeating
 *    line-items region marked with data-tfm-repeat="items".
 *  - DEFAULT_*_TEMPLATE: branded starter templates so the canvas isn't blank.
 *  - TOKENS / ITEM_TOKENS: lists used by the builder's merge-field blocks.
 */

const fmtAmt = (n: any) =>
  Number(n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export interface RenderContext {
  [k: string]: any;
}

/** Build a flat, pre-formatted context for token substitution. */
export function buildContext(type: 'invoice' | 'quotation', doc: any, company: any, bank: any): RenderContext {
  const co = company || {};
  const b = bank || {};
  const isQuote = type === 'quotation';
  const cur = doc?.currency ?? 'AED';
  const vatRate = Number(co?.vatRate ?? 5);
  const client = doc?.client || {};
  const billingEmail = co?.billingEmail || co?.email || '';

  const items = (doc?.items ?? []).map((it: any) => {
    const lineVat = Number(it.taxAmount ?? 0);
    return {
      description: it.description ?? '',
      details: it.details ?? '',
      qty: String(it.quantity ?? ''),
      days: String(it.days ?? 1),
      unit: it.unit ?? '',
      unitPrice: fmtAmt(it.unitPrice),
      lineTotal: fmtAmt(it.lineTotal),
      vatRate: lineVat > 0 ? `${vatRate}%` : '0%',
      vatAmount: fmtAmt(lineVat),
    };
  });

  const docTitle = isQuote ? 'Quotation' : (doc?.invoiceType === 'CREDIT_NOTE' ? 'Credit Note' : 'Tax Invoice');

  return {
    company: {
      name: co?.name ?? 'The Film Makers FZ LLC',
      address: co?.address ?? '',
      cityCountry: [co?.city, co?.country].filter(Boolean).join(', ') || 'Dubai, UAE',
      trn: co?.trn ?? '',
      phone: co?.phone ?? '',
      billingEmail,
      website: co?.website ?? '',
      logoUrl: co?.logoUrl || '/tfm-logo.svg',
    },
    client: {
      companyName: client?.companyName ?? '',
      address: client?.billingAddress ?? '',
      cityCountry: [client?.city, client?.country].filter(Boolean).join(', '),
      trn: client?.trn ?? '',
    },
    doc: {
      title: docTitle,
      titleUpper: docTitle.toUpperCase(),
      number: isQuote ? doc?.quotationNumber : doc?.invoiceNumber,
      issueDate: fmtDate(doc?.issueDate),
      dueDate: fmtDate(doc?.dueDate),
      validUntil: fmtDate(doc?.validUntil),
      status: (doc?.status ?? '').replace(/_/g, ' '),
      subject: doc?.subject ?? '',
      poNumber: doc?.poNumber ?? '',
      notes: doc?.notes ?? '',
      terms: doc?.termsConditions ?? '',
    },
    totals: {
      currency: cur,
      subtotal: fmtAmt(doc?.subtotal),
      discount: fmtAmt(doc?.discountAmount),
      deduction: fmtAmt(doc?.deductionAmount),
      deductionReason: doc?.deductionReason ?? '',
      vat: fmtAmt(doc?.vatAmount),
      total: fmtAmt(doc?.total),
      amountPaid: fmtAmt(doc?.amountPaid),
      amountDue: fmtAmt(doc?.amountDue),
    },
    bank: {
      accountName: b?.accountName ?? '',
      accountNumber: b?.accountNumber ?? '',
      iban: b?.iban ?? '',
      bankName: b?.bankName ?? '',
      swiftCode: b?.swiftCode ?? '',
      branch: b?.branch ?? '',
      currency: b?.currency ?? cur,
    },
    items,
  };
}

function getPath(ctx: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}

function substitute(html: string, ctx: any): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, p) => {
    const v = getPath(ctx, p.trim());
    return v == null ? '' : String(v);
  });
}

/**
 * Render a saved template against a context.
 * Expands any element with [data-tfm-repeat="items"] by cloning its first
 * child once per item, then substitutes remaining {{tokens}}.
 * Client-side only (uses DOMParser).
 */
export function renderTemplate(html: string, ctx: RenderContext): string {
  if (typeof window === 'undefined' || !html) return html || '';
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return substitute(html, ctx);
  }
  doc.querySelectorAll('[data-tfm-repeat]').forEach((el) => {
    const key = el.getAttribute('data-tfm-repeat') || 'items';
    const arr: any[] = Array.isArray(getPath(ctx, key)) ? getPath(ctx, key) : [];
    const rowEl = el.firstElementChild;
    const rowHtml = rowEl ? rowEl.outerHTML : el.innerHTML;
    el.innerHTML = arr.map((item, i) => substitute(rowHtml, { ...ctx, item, index: i + 1 })).join('');
  });
  return substitute(doc.body.innerHTML, ctx);
}

/** Merge fields exposed in the builder. */
export const TOKENS: { group: string; items: { label: string; token: string }[] }[] = [
  { group: 'Document', items: [
    { label: 'Title', token: '{{doc.title}}' },
    { label: 'Number', token: '{{doc.number}}' },
    { label: 'Issue Date', token: '{{doc.issueDate}}' },
    { label: 'Due Date', token: '{{doc.dueDate}}' },
    { label: 'Valid Until', token: '{{doc.validUntil}}' },
    { label: 'Status', token: '{{doc.status}}' },
    { label: 'Subject', token: '{{doc.subject}}' },
    { label: 'PO Number', token: '{{doc.poNumber}}' },
    { label: 'Notes', token: '{{doc.notes}}' },
  ]},
  { group: 'Company', items: [
    { label: 'Name', token: '{{company.name}}' },
    { label: 'Address', token: '{{company.address}}' },
    { label: 'City / Country', token: '{{company.cityCountry}}' },
    { label: 'TRN', token: '{{company.trn}}' },
    { label: 'Phone', token: '{{company.phone}}' },
    { label: 'Billing Email', token: '{{company.billingEmail}}' },
    { label: 'Website', token: '{{company.website}}' },
  ]},
  { group: 'Client', items: [
    { label: 'Company Name', token: '{{client.companyName}}' },
    { label: 'Address', token: '{{client.address}}' },
    { label: 'City / Country', token: '{{client.cityCountry}}' },
    { label: 'TRN', token: '{{client.trn}}' },
  ]},
  { group: 'Totals', items: [
    { label: 'Currency', token: '{{totals.currency}}' },
    { label: 'Subtotal', token: '{{totals.subtotal}}' },
    { label: 'Discount', token: '{{totals.discount}}' },
    { label: 'Deduction', token: '{{totals.deduction}}' },
    { label: 'VAT', token: '{{totals.vat}}' },
    { label: 'Total', token: '{{totals.total}}' },
    { label: 'Amount Paid', token: '{{totals.amountPaid}}' },
    { label: 'Amount Due', token: '{{totals.amountDue}}' },
  ]},
  { group: 'Bank', items: [
    { label: 'Account Name', token: '{{bank.accountName}}' },
    { label: 'Account Number', token: '{{bank.accountNumber}}' },
    { label: 'IBAN', token: '{{bank.iban}}' },
    { label: 'Bank', token: '{{bank.bankName}}' },
    { label: 'SWIFT', token: '{{bank.swiftCode}}' },
  ]},
];

const ROW = `<tr>
  <td style="padding:6px 8px;border-bottom:1px solid #eee;border-right:1px solid #eee;vertical-align:top">{{item.description}}<div style="color:#999;font-size:8px">{{item.details}}</div></td>
  <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.qty}}</td>
  <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.days}}</td>
  <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.unitPrice}}</td>
  <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.lineTotal}}</td>
  <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.vatRate}}</td>
  <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee">{{item.vatAmount}}</td>
</tr>`;

function defaultTemplate(opts: { metaRows: string; afterTotals: string }): string {
  return `<div style="max-width:794px;margin:0 auto;padding:28px 38px;font-family:Arial,Helvetica,sans-serif;font-size:9.5px;color:#222;line-height:1.45;background:#fff">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div style="padding-top:6px;font-size:16px;font-weight:700;color:#1a1a2e;letter-spacing:.8px">{{doc.titleUpper}}</div>
    <img src="{{company.logoUrl}}" alt="Logo" style="height:48px;width:auto;object-fit:contain"/>
  </div>
  <div style="border-top:2px solid #0f172a;margin:10px 0 16px"></div>

  <div style="display:flex;align-items:stretch;margin-bottom:20px">
    <div style="flex:0 0 220px;padding-right:14px">
      <div style="font-weight:700;color:#8B6914">Name</div><div style="font-weight:700">{{company.name}}</div>
      <div style="font-weight:700;color:#8B6914;margin-top:4px">Address</div><div>{{company.address}}</div>
      <div style="font-weight:700;color:#8B6914;margin-top:4px">City / Country</div><div>{{company.cityCountry}}</div>
      <div style="font-weight:700;color:#8B6914;margin-top:4px">TRN</div><div>{{company.trn}}</div>
      <div style="font-weight:700;color:#8B6914;margin-top:4px">Billing Email</div><div>{{company.billingEmail}}</div>
    </div>
    <div style="width:2px;background:#0f172a;margin:0 14px"></div>
    <div style="flex:1">
      <table style="width:100%;border-collapse:collapse">${opts.metaRows}</table>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;border:1px solid #ddd">
    <thead><tr style="background:#F2EAD3">
      <th style="text-align:left;padding:6px 8px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Description</th>
      <th style="text-align:center;padding:6px 8px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Qty</th>
      <th style="text-align:center;padding:6px 8px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Days</th>
      <th style="text-align:right;padding:6px 8px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Unit Price</th>
      <th style="text-align:right;padding:6px 8px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Total</th>
      <th style="text-align:center;padding:6px 8px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">VAT</th>
      <th style="text-align:right;padding:6px 8px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #0f172a">VAT Amt</th>
    </tr></thead>
    <tbody data-tfm-repeat="items">${ROW}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
    <table style="border-collapse:collapse;border:1px solid #ddd">
      <tbody>
        <tr><td style="padding:5px 10px;font-weight:700;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee;background:#fafafa;color:#1a1a2e;min-width:200px">Total Amount</td><td style="padding:5px 10px;text-align:right;border-bottom:1px solid #eee;min-width:120px">{{totals.subtotal}}</td></tr>
        <tr><td style="padding:5px 10px;font-weight:700;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee;background:#fafafa;color:#1a1a2e">VAT</td><td style="padding:5px 10px;text-align:right;border-bottom:1px solid #eee">{{totals.vat}}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:700;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee;background:#F2EAD3;color:#1a1a2e">Total Incl. VAT</td><td style="padding:6px 10px;text-align:right;font-weight:700;border-bottom:1px solid #eee;background:#F2EAD3">{{totals.currency}} {{totals.total}}</td></tr>
        ${opts.afterTotals}
      </tbody>
    </table>
  </div>

  <div style="margin-bottom:24px">
    <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:8px">Payment / Bank Details</div>
    <table style="border-collapse:collapse">
      <tbody>
        <tr><td style="font-weight:700;color:#1a1a2e;padding-right:10px">Account Name:</td><td>{{bank.accountName}}</td></tr>
        <tr><td style="font-weight:700;color:#1a1a2e;padding-right:10px">IBAN:</td><td>{{bank.iban}}</td></tr>
        <tr><td style="font-weight:700;color:#1a1a2e;padding-right:10px">Bank:</td><td>{{bank.bankName}}</td></tr>
        <tr><td style="font-weight:700;color:#1a1a2e;padding-right:10px">SWIFT:</td><td>{{bank.swiftCode}}</td></tr>
      </tbody>
    </table>
  </div>

  <div style="border-top:1px solid #ddd;padding-top:8px;display:flex;justify-content:space-between;color:#999;font-size:8px">
    <div style="max-width:65%">This is a computer-generated document.</div>
    <div style="text-align:right">{{company.website}}<br/>{{company.billingEmail}}<br/>{{company.phone}}</div>
  </div>
</div>`;
}

export const DEFAULT_INVOICE_TEMPLATE = defaultTemplate({
  metaRows: `
    <tr style="background:#F9F6EE"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8;width:44%">Invoice To:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8"><b>{{client.companyName}}</b><br/>{{client.address}}<br/>{{client.cityCountry}}</td></tr>
    <tr style="background:#FDF9F4"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Customer TRN:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{client.trn}}</td></tr>
    <tr style="background:#F9F6EE"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Invoice Number:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{doc.number}}</td></tr>
    <tr style="background:#FDF9F4"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Invoice Date:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{doc.issueDate}}</td></tr>
    <tr style="background:#F9F6EE"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Due Date:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{doc.dueDate}}</td></tr>`,
  afterTotals: `
    <tr><td style="padding:5px 10px;font-weight:700;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee;background:#fafafa;color:#1a1a2e">Amount Settled</td><td style="padding:5px 10px;text-align:right;border-bottom:1px solid #eee">{{totals.amountPaid}}</td></tr>
    <tr><td style="padding:7px 10px;font-weight:700;text-align:right;background:#1a1a2e;color:#fff">Balance Due</td><td style="padding:7px 10px;text-align:right;font-weight:700;background:#0f172a;color:#fff">{{totals.currency}} {{totals.amountDue}}</td></tr>`,
});

export const DEFAULT_QUOTATION_TEMPLATE = defaultTemplate({
  metaRows: `
    <tr style="background:#F9F6EE"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8;width:44%">Prepared For:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8"><b>{{client.companyName}}</b><br/>{{client.address}}<br/>{{client.cityCountry}}</td></tr>
    <tr style="background:#FDF9F4"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Customer TRN:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{client.trn}}</td></tr>
    <tr style="background:#F9F6EE"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Quotation Number:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{doc.number}}</td></tr>
    <tr style="background:#FDF9F4"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Issue Date:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{doc.issueDate}}</td></tr>
    <tr style="background:#F9F6EE"><td style="font-weight:700;color:#1a1a2e;padding:4px 8px;border-bottom:1px solid #EEE8D8">Valid Until:</td><td style="padding:4px 8px;border-bottom:1px solid #EEE8D8">{{doc.validUntil}}</td></tr>`,
  afterTotals: `
    <tr><td colspan="2" style="padding:5px 10px;text-align:right;font-style:italic;color:#999;background:#FDFAF4;border-top:1px solid #eee">Valid until {{doc.validUntil}}. Prices subject to change after this date.</td></tr>`,
});
