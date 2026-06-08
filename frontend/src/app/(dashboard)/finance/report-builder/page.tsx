'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Save, RotateCcw, Receipt, FileText, ExternalLink, Info } from 'lucide-react';
import { companyApi } from '@/lib/api';
import {
  TOKENS,
  DEFAULT_INVOICE_TEMPLATE,
  DEFAULT_QUOTATION_TEMPLATE,
} from '@/lib/reportTemplate';

const GJS_CSS = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css';
const GJS_JS = 'https://unpkg.com/grapesjs/dist/grapes.min.js';

function loadGrapes(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).grapesjs) return resolve((window as any).grapesjs);
    if (!document.querySelector(`link[href="${GJS_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = GJS_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${GJS_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).grapesjs));
      existing.addEventListener('error', reject);
      if ((window as any).grapesjs) resolve((window as any).grapesjs);
      return;
    }
    const s = document.createElement('script');
    s.src = GJS_JS; s.async = true;
    s.onload = () => resolve((window as any).grapesjs);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

const TABLE_BLOCK = `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd" data-gjs-name="Line Items">
<thead><tr style="background:#F2EAD3">
<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Description</th>
<th style="text-align:center;padding:6px 8px;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Qty</th>
<th style="text-align:center;padding:6px 8px;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Days</th>
<th style="text-align:right;padding:6px 8px;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Unit Price</th>
<th style="text-align:right;padding:6px 8px;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">Total</th>
<th style="text-align:center;padding:6px 8px;border-bottom:2px solid #0f172a;border-right:1px solid #ddd">VAT</th>
<th style="text-align:right;padding:6px 8px;border-bottom:2px solid #0f172a">VAT Amt</th>
</tr></thead>
<tbody data-tfm-repeat="items">
<tr>
<td style="padding:6px 8px;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.description}}</td>
<td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.qty}}</td>
<td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.days}}</td>
<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.unitPrice}}</td>
<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.lineTotal}}</td>
<td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee;border-right:1px solid #eee">{{item.vatRate}}</td>
<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee">{{item.vatAmount}}</td>
</tr>
</tbody></table>`;

const TOTALS_BLOCK = `<table style="border-collapse:collapse;border:1px solid #ddd">
<tr><td style="padding:5px 10px;font-weight:700;text-align:right;background:#fafafa;border-right:1px solid #eee;min-width:160px">Subtotal</td><td style="padding:5px 10px;text-align:right;min-width:110px">{{totals.subtotal}}</td></tr>
<tr><td style="padding:5px 10px;font-weight:700;text-align:right;background:#fafafa;border-right:1px solid #eee">VAT</td><td style="padding:5px 10px;text-align:right">{{totals.vat}}</td></tr>
<tr><td style="padding:6px 10px;font-weight:700;text-align:right;background:#F2EAD3;border-right:1px solid #eee">Total Incl. VAT</td><td style="padding:6px 10px;text-align:right;font-weight:700;background:#F2EAD3">{{totals.currency}} {{totals.total}}</td></tr>
</table>`;

export default function ReportBuilderPage() {
  const editorRef = useRef<any>(null);
  const tplRef = useRef<{ invoice?: { html: string; css: string }; quotation?: { html: string; css: string } }>({});
  const docSettingsRef = useRef<any>({});
  const [type, setType] = useState<'invoice' | 'quotation'>('invoice');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [msg, setMsg] = useState('');

  const defaultFor = (t: 'invoice' | 'quotation') =>
    ({ html: t === 'invoice' ? DEFAULT_INVOICE_TEMPLATE : DEFAULT_QUOTATION_TEMPLATE, css: '' });

  // init once
  useEffect(() => {
    let editor: any;
    (async () => {
      try {
        const grapesjs = await loadGrapes();
        // fetch saved templates
        let saved: any = {};
        try {
          const r = await companyApi.get();
          docSettingsRef.current = r.data?.documentSettings || {};
          saved = docSettingsRef.current?.templates || {};
        } catch { /* ignore */ }
        tplRef.current = {
          invoice: saved.invoice || defaultFor('invoice'),
          quotation: saved.quotation || defaultFor('quotation'),
        };

        editor = grapesjs.init({
          container: '#gjs',
          height: '100%',
          width: 'auto',
          fromElement: false,
          storageManager: false,
          assetManager: { embedAsBase64: true },
          canvas: { styles: [], scripts: [] },
        });
        editorRef.current = editor;

        // merge-field + section blocks
        const bm = editor.BlockManager;
        TOKENS.forEach(group => group.items.forEach(it => {
          bm.add(`tok-${it.token}`, {
            label: it.label,
            category: `Field · ${group.group}`,
            content: `<span>${it.token}</span>`,
          });
        }));
        bm.add('blk-items', { label: '▦ Line Items Table', category: 'Sections', content: TABLE_BLOCK });
        bm.add('blk-totals', { label: '∑ Totals Box', category: 'Sections', content: TOTALS_BLOCK });
        bm.add('blk-logo', { label: '🖼 Logo', category: 'Sections', content: '<img src="{{company.logoUrl}}" style="height:48px"/>' });
        bm.add('blk-divider', { label: '— Gold Divider', category: 'Sections', content: '<div style="border-top:2px solid #0f172a;margin:10px 0"></div>' });
        bm.add('blk-text', { label: '¶ Text', category: 'Sections', content: '<div style="font-size:9.5px">Text block</div>' });
        bm.add('blk-cols', { label: '▥ Two Columns', category: 'Sections', content: '<div style="display:flex;gap:16px"><div style="flex:1">Left</div><div style="flex:1">Right</div></div>' });

        // load current type
        editor.setComponents(tplRef.current[type]!.html);
        editor.setStyle(tplRef.current[type]!.css || '');
        setStatus('ready');
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    })();
    return () => { try { editor?.destroy(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // switch type — stash current edits, load the other
  const switchType = (t: 'invoice' | 'quotation') => {
    if (t === type || !editorRef.current) return;
    const ed = editorRef.current;
    tplRef.current[type] = { html: ed.getHtml(), css: ed.getCss() };
    ed.setComponents(tplRef.current[t]!.html);
    ed.setStyle(tplRef.current[t]!.css || '');
    setType(t);
  };

  const save = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    setMsg('');
    tplRef.current[type] = { html: ed.getHtml(), css: ed.getCss() };
    const documentSettings = {
      ...(docSettingsRef.current || {}),
      templates: { ...(docSettingsRef.current?.templates || {}), ...tplRef.current },
    };
    try {
      await companyApi.update({ documentSettings });
      docSettingsRef.current = documentSettings;
      setMsg('Saved — this template now renders on print & PDF.');
      setTimeout(() => setMsg(''), 4000);
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Save failed');
    }
  };

  const resetCurrent = () => {
    const ed = editorRef.current;
    if (!ed) return;
    if (!confirm('Reset this template to the default branded layout? Unsaved changes will be lost.')) return;
    ed.setComponents(defaultFor(type).html);
    ed.setStyle('');
  };

  // Remove the saved custom template for this type → print reverts to the
  // option-based Report Designer rendering.
  const revertToDesigner = async () => {
    if (!confirm('Remove the custom template for this document type? Printing will use the standard (Report Designer) layout again.')) return;
    setMsg('');
    const templates = { ...(docSettingsRef.current?.templates || {}) };
    delete templates[type];
    const documentSettings = { ...(docSettingsRef.current || {}), templates };
    try {
      await companyApi.update({ documentSettings });
      docSettingsRef.current = documentSettings;
      setMsg('Reverted — this document now uses the standard layout.');
      setTimeout(() => setMsg(''), 4000);
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Failed to revert');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">Report Builder</h1>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => switchType('invoice')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${type === 'invoice' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>
              <Receipt size={14} /> Invoice
            </button>
            <button onClick={() => switchType('quotation')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${type === 'quotation' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>
              <FileText size={14} /> Quotation
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-green-600">{msg}</span>}
          <Link href="/finance/report-designer" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
            <ExternalLink size={12} /> Quick designer
          </Link>
          <button onClick={revertToDesigner} className="btn-secondary text-xs">Use standard layout</button>
          <button onClick={resetCurrent} className="btn-secondary"><RotateCcw size={14} /> Reset</button>
          <button onClick={save} className="btn-primary"><Save size={14} /> Save Template</button>
        </div>
      </div>

      {/* Hint */}
      <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 flex items-center gap-2">
        <Info size={13} />
        Drag fields/blocks onto the canvas. Tokens like <code className="font-mono">{'{{client.companyName}}'}</code> are replaced with live data on print. The <b>Line Items Table</b> repeats per line automatically.
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 relative">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm z-10">Loading editor…</div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm z-10 px-6 text-center">
            Couldn’t load the editor (network blocked the GrapesJS CDN). Check your connection and reload.
          </div>
        )}
        <div id="gjs" className="h-full" />
      </div>
    </div>
  );
}
