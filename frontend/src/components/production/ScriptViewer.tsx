'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { assetUrl } from '@/lib/api';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertTriangle, List, LayoutGrid, RotateCw } from 'lucide-react';

/**
 * SYS-13 · D1 — PDF viewer (HTML5 canvas via pdfjs-dist, dynamically imported so the bundle
 * never breaks if the lib isn't installed yet). Renders the active revision, page nav + zoom,
 * a scene outline that jumps to pages, and a numbered thumbnail grid. The annotation overlay
 * (D2) mounts as an absolutely-positioned layer over `#script-canvas-wrap`.
 */
export type OverlayCtx = { page: number; width: number; height: number; scale: number; textItems: { str: string; x: number; y: number; w: number; h: number }[] };

export default function ScriptViewer({ pdfUrl, pdfData, scenes = [], page, onPageChange, renderOverlay }: {
  pdfUrl: string;
  pdfData?: ArrayBuffer;            // D7 — offline bytes (preferred over the URL when present)
  scenes?: any[];
  page?: number;
  onPageChange?: (p: number) => void;
  renderOverlay?: (ctx: OverlayCtx) => ReactNode;
}) {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [cur, setCur] = useState(page || 1);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);   // user-applied 0/90/180/270 to correct mis-rotated PDFs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<'scenes' | 'thumbs'>('scenes');
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [textItems, setTextItems] = useState<OverlayCtx['textItems']>([]);
  const [imgSrc, setImgSrc] = useState('');   // rendered page as an image (no live DOM canvas to flip)

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setPdf(null);
    (async () => {
      try {
        const pdfjsLib: any = await import('pdfjs-dist').catch(() => null);
        if (!pdfjsLib) { if (!cancelled) setError('NOT_INSTALLED'); return; }
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const doc = await pdfjsLib.getDocument(pdfData ? { data: pdfData.slice(0) } : assetUrl(pdfUrl)).promise;
        if (cancelled) return;
        setPdf(doc); setNumPages(doc.numPages); setCur((c) => Math.min(c, doc.numPages));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not open the PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // Render the current page whenever page/scale changes.
  const renderPage = useCallback(async () => {
    if (!pdf) return;
    try {
      const p = await pdf.getPage(cur);
      // Honour the page's own /Rotate, then add the user's correction.
      const viewport = p.getViewport({ scale, rotation: (((p.rotate || 0) + rotation) % 360 + 360) % 360 });
      // Render to an OFF-SCREEN canvas (never mounted in the DOM) so no global/extension CSS
      // transform can mirror or flip it, then hand the result to an <img>.
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width; canvas.height = viewport.height;
      setDims({ width: viewport.width, height: viewport.height });
      await p.render({ canvasContext: ctx, viewport }).promise;
      setImgSrc(canvas.toDataURL('image/png'));
      // Text items mapped to viewport (top-left) coords — fuels anchor capture (D2/D3).
      // convertToViewportPoint respects rotation so anchors stay aligned at any orientation.
      if (renderOverlay) {
        const tc = await p.getTextContent();
        const items = tc.items.map((it: any) => {
          const tx = it.transform; // [a,b,c,d,e,f]
          const h = Math.hypot(tx[2], tx[3]) * scale || 10;
          const [vx, vy] = viewport.convertToViewportPoint(tx[4], tx[5]);
          const w = (it.width || 0) * scale;
          return { str: it.str as string, x: vx, y: vy - h, w, h };
        });
        setTextItems(items);
      }
    } catch { /* render race on fast nav — ignore */ }
  }, [pdf, cur, scale, rotation, renderOverlay]);
  useEffect(() => { renderPage(); }, [renderPage]);

  const go = (p: number) => { const n = Math.max(1, Math.min(numPages || 1, p)); setCur(n); onPageChange?.(n); };

  if (error === 'NOT_INSTALLED') return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
      <AlertTriangle size={18} className="inline mr-1.5" /> The PDF renderer isn’t installed yet. Run
      <code className="mx-1 px-1.5 py-0.5 rounded bg-white border">npm i pdfjs-dist@^4</code> in <b>frontend/</b>, then reload.
    </div>
  );
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"><AlertTriangle size={16} className="inline mr-1.5" /> {error}</div>;

  return (
    <div className="flex gap-3 font-sans">
      {/* Left rail — scenes / thumbnails */}
      <div className="w-52 shrink-0 rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col" style={{ maxHeight: '78vh' }}>
        <div className="flex border-b border-slate-100 text-xs">
          <button onClick={() => setSide('scenes')} className={`flex-1 py-2 inline-flex items-center justify-center gap-1 ${side === 'scenes' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><List size={13} /> Scenes</button>
          <button onClick={() => setSide('thumbs')} className={`flex-1 py-2 inline-flex items-center justify-center gap-1 ${side === 'thumbs' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><LayoutGrid size={13} /> Pages</button>
        </div>
        <div className="overflow-y-auto p-2">
          {side === 'scenes' ? (
            scenes.length === 0 ? <p className="text-[11px] text-slate-400 p-2">No scenes parsed.</p> :
            scenes.map((s) => (
              <button key={s.id} onClick={() => go(s.pageStart)} className={`block w-full text-left px-2 py-1.5 rounded-lg text-xs mb-0.5 ${cur >= s.pageStart && cur <= s.pageEnd ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span className="text-slate-400">{s.sceneNumber || '•'}</span> {s.slugline || '—'}
                <span className="block text-[10px] text-slate-400">p.{s.pageStart}{s.pageEnd > s.pageStart ? `–${s.pageEnd}` : ''}</span>
              </button>
            ))
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => go(n)} className={`aspect-[3/4] rounded-md border text-xs flex items-center justify-center ${n === cur ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>{n}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center — canvas */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="inline-flex items-center gap-1">
            <button onClick={() => go(cur - 1)} disabled={cur <= 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:border-slate-900"><ChevronLeft size={15} /></button>
            <span className="text-xs text-slate-500 px-1">Page {cur} / {numPages || '…'}</span>
            <button onClick={() => go(cur + 1)} disabled={cur >= numPages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:border-slate-900"><ChevronRight size={15} /></button>
          </div>
          <div className="inline-flex items-center gap-1">
            <button onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate 90° (fix a flipped script)" className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-900"><RotateCw size={15} /></button>
            <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-900"><ZoomOut size={15} /></button>
            <span className="text-[11px] text-slate-400 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(3, s + 0.2))} className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-900"><ZoomIn size={15} /></button>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-auto p-4 flex justify-center" style={{ maxHeight: '78vh' }}>
          {loading ? <div className="py-20"><Loader2 className="animate-spin text-slate-400" /></div> : (
            <div id="script-canvas-wrap" className="relative shadow-lg" style={{ width: dims.width || undefined, height: dims.height || undefined }}>
              {imgSrc && <img src={imgSrc} alt={`Script page ${cur}`} className="block bg-white" style={{ width: dims.width || undefined, height: dims.height || undefined }} draggable={false} />}
              {renderOverlay && dims.width > 0 && (
                <div className="absolute inset-0">
                  {renderOverlay({ page: cur, width: dims.width, height: dims.height, scale, textItems })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
