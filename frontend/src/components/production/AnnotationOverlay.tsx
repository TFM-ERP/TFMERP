'use client';

import { useState, useRef } from 'react';
import type { OverlayCtx } from './ScriptViewer';

export type Tool = 'CURSOR' | 'HIGHLIGHT' | 'PEN' | 'TEXT' | 'STICKY' | 'TAG';

/**
 * SYS-13 · D2 — annotation overlay. Renders existing annotations (normalized coords → screen)
 * and captures new ones with the active tool. On create it captures `anchorText` from the page's
 * pdfjs text items intersecting the mark (the seed for the D3 transfer algorithm).
 */
export default function AnnotationOverlay({
  ctx, annotations, tool, color, layerVisible, onCreate, onDelete, placingId, onPlace, tagCategory,
}: {
  ctx: OverlayCtx;
  annotations: any[];               // for the current page
  tool: Tool;
  color: string;
  layerVisible: (layerId: string) => boolean;
  onCreate: (a: any) => void;
  onDelete: (id: string) => void;
  placingId?: string | null;        // D3 — an orphan armed for placement
  onPlace?: (id: string, pos: { page: number; x: number; y: number }) => void;
  tagCategory?: { key: string; label: string; color: string } | null; // P3 — selected tag category
}) {
  const { width, height, textItems, page } = ctx;
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [path, setPath] = useState<[number, number][]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const rel = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
  };

  // Concatenate text items intersecting a screen-space rect → anchorText + surroundingContext.
  const captureAnchor = (px: number, py: number, pw: number, ph: number) => {
    const hits = textItems.filter((t) => t.x < px + pw && t.x + t.w > px && t.y < py + ph && t.y + t.h > py);
    const anchorText = hits.map((h) => h.str).join(' ').trim().slice(0, 120);
    // surrounding context = a wider band on the same lines
    const band = textItems.filter((t) => t.y < py + ph + 24 && t.y + t.h > py - 24).map((t) => t.str).join(' ').trim();
    const idx = band.indexOf(anchorText.slice(0, 30));
    const surroundingContext = idx >= 0 ? band.slice(Math.max(0, idx - 100), idx + anchorText.length + 100) : band.slice(0, 240);
    return { anchorText: anchorText || null, surroundingContext: surroundingContext || null };
  };

  const norm = (px: number, py: number, pw: number, ph: number) => ({ x: px / width, y: py / height, w: pw / width, h: ph / height });

  // ── Mouse handlers (tool-dependent) ────────────────────────────────────────────
  const down = (e: React.MouseEvent) => {
    const { x: cx, y: cy } = rel(e);
    if (placingId && onPlace) { onPlace(placingId, { page, x: cx / width, y: cy / height }); return; }
    if (tool === 'CURSOR') return;
    const { x, y } = rel(e);
    if (tool === 'PEN') { setPath([[x, y]]); return; }
    if (tool === 'HIGHLIGHT') { setDrag({ x0: x, y0: y, x1: x, y1: y }); return; }
    if (tool === 'TEXT' || tool === 'STICKY' || tool === 'TAG') {
      const input = tool === 'TAG'
        ? prompt(tagCategory ? `Tag (${tagCategory.label}) — element name:` : 'Tag label (e.g. Prop: Vintage watch)')
        : prompt('Note text');
      if (input == null) return;
      const w = tool === 'TAG' ? 14 : 4, h = tool === 'TAG' ? 14 : 4; // anchor footprint
      const anc = captureAnchor(x, y, 80, 16);
      const useCat = tool === 'TAG' && !!tagCategory;
      const tagKey = tool === 'TAG' ? (tagCategory?.key || (input.split(':')[0] || 'tag')) : undefined;
      const tagColor = useCat ? tagCategory!.color : color;
      const text = useCat ? `${tagCategory!.label}: ${input}` : input;
      onCreate({ tool, page, ...norm(x, y, w, h), payload: { text, color: tagColor, tagKey }, ...anc });
    }
  };
  const move = (e: React.MouseEvent) => {
    if (tool === 'PEN' && path.length) { const { x, y } = rel(e); setPath((p) => [...p, [x, y]]); }
    else if (tool === 'HIGHLIGHT' && drag) { const { x, y } = rel(e); setDrag({ ...drag, x1: x, y1: y }); }
  };
  const up = () => {
    if (tool === 'HIGHLIGHT' && drag) {
      const px = Math.min(drag.x0, drag.x1), py = Math.min(drag.y0, drag.y1);
      const pw = Math.abs(drag.x1 - drag.x0), ph = Math.abs(drag.y1 - drag.y0);
      setDrag(null);
      if (pw > 4 && ph > 4) { const anc = captureAnchor(px, py, pw, ph); onCreate({ tool: 'HIGHLIGHT', page, ...norm(px, py, pw, ph), payload: { color }, ...anc }); }
    } else if (tool === 'PEN' && path.length > 1) {
      const xs = path.map((p) => p[0]), ys = path.map((p) => p[1]);
      const px = Math.min(...xs), py = Math.min(...ys), pw = Math.max(...xs) - px, ph = Math.max(...ys) - py;
      const pts = path.map(([x, y]) => [(x - px) / (pw || 1), (y - py) / (ph || 1)]); // normalized within bbox
      setPath([]);
      const anc = captureAnchor(px, py, pw, ph);
      onCreate({ tool: 'PEN', page, ...norm(px, py, pw, ph), payload: { color, points: pts }, ...anc });
    } else { setPath([]); setDrag(null); }
  };

  return (
    <div ref={ref} className={placingId ? 'cursor-copy' : tool === 'CURSOR' ? '' : 'cursor-crosshair'} style={{ position: 'absolute', inset: 0 }}
      onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={() => { setPath([]); setDrag(null); }}>
      <svg width={width} height={height} className="absolute inset-0 pointer-events-none">
        {/* live drag preview */}
        {drag && <rect x={Math.min(drag.x0, drag.x1)} y={Math.min(drag.y0, drag.y1)} width={Math.abs(drag.x1 - drag.x0)} height={Math.abs(drag.y1 - drag.y0)} fill={color} opacity={0.3} />}
        {path.length > 1 && <polyline points={path.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2} />}

        {/* existing annotations */}
        {annotations.filter((a) => layerVisible(a.layerId)).map((a) => {
          const x = a.x * width, y = a.y * height, w = a.w * width, h = a.h * height;
          const c = a.payload?.color || a.layer?.color || color;
          if (a.tool === 'HIGHLIGHT') return <rect key={a.id} x={x} y={y} width={w} height={h} fill={c} opacity={0.35} className="pointer-events-auto cursor-pointer" onDoubleClick={() => onDelete(a.id)} />;
          if (a.tool === 'PEN' && a.payload?.points) {
            const pts = a.payload.points.map(([nx, ny]: number[]) => `${x + nx * w},${y + ny * h}`).join(' ');
            return <polyline key={a.id} points={pts} fill="none" stroke={c} strokeWidth={2} className="pointer-events-auto cursor-pointer" onDoubleClick={() => onDelete(a.id)} />;
          }
          return null;
        })}
      </svg>

      {/* text / sticky / tag rendered as HTML for legibility */}
      {annotations.filter((a) => layerVisible(a.layerId) && ['TEXT', 'STICKY', 'TAG'].includes(a.tool)).map((a) => {
        const x = a.x * width, y = a.y * height;
        const c = a.payload?.color || a.layer?.color || color;
        return (
          <div key={a.id} className="absolute pointer-events-auto group" style={{ left: x, top: y }}>
            {a.tool === 'TAG' ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white shadow" style={{ background: c }} onDoubleClick={() => onDelete(a.id)}>{a.payload?.text}</span>
            ) : (
              <div className="text-[11px] max-w-[180px] rounded-md shadow border border-black/10 px-2 py-1" style={{ background: a.tool === 'STICKY' ? '#fef9c3' : 'white' }} onDoubleClick={() => onDelete(a.id)}>{a.payload?.text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
