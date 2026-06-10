'use client';

import { useState, useRef, useEffect } from 'react';
import type { OverlayCtx } from './ScriptViewer';

export type Tool = 'CURSOR' | 'HIGHLIGHT' | 'PEN' | 'TEXT' | 'STICKY' | 'TAG';

/**
 * A real-looking sticky note: paper colour + shadow + folded corner, draggable to move,
 * with a corner handle to resize and a top handle to rotate. Commits via onUpdate on release.
 */
function StickyNote({ a, pageW, pageH, readOnly, onUpdate, onDelete }: {
  a: any; pageW: number; pageH: number; readOnly?: boolean;
  onUpdate?: (id: string, patch: any) => void; onDelete: (id: string) => void;
}) {
  const base = { x: a.x * pageW, y: a.y * pageH, w: Math.max(80, (a.w || 0) * pageW), h: Math.max(60, (a.h || 0) * pageH), rot: Number(a.payload?.rotation ?? -2) };
  const [live, setLive] = useState<typeof base | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const v = live || base;
  const gesture = useRef<{ mode: 'move' | 'resize' | 'rotate'; sx: number; sy: number; start: typeof base } | null>(null);

  const begin = (mode: 'move' | 'resize' | 'rotate') => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editing || readOnly) return;
    e.preventDefault();
    gesture.current = { mode, sx: e.clientX, sy: e.clientY, start: live || base };
    setLive(live || base);
  };
  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    gesture.current = null;
    setText(a.payload?.text || '');
    setEditing(true);
  };
  const commitEdit = () => {
    setEditing(false);
    if (onUpdate && text.trim() && text !== a.payload?.text) onUpdate(a.id, { payload: { ...a.payload, text: text.trim() } });
  };
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      const g = gesture.current; if (!g) return;
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      if (g.mode === 'move') setLive({ ...g.start, x: g.start.x + dx, y: g.start.y + dy });
      else if (g.mode === 'resize') setLive({ ...g.start, w: Math.max(80, g.start.w + dx), h: Math.max(60, g.start.h + dy) });
      else { // rotate: angle of pointer around the note centre
        const cx = g.start.x + g.start.w / 2, cy = g.start.y + g.start.h / 2;
        // pointer position relative to the page: derive from the drag delta + handle's start pos (top-centre)
        const hx = cx + dx, hy = g.start.y - 18 + dy;
        const ang = Math.atan2(hy - cy, hx - cx) * 180 / Math.PI + 90;
        setLive({ ...g.start, rot: Math.round(((ang + 540) % 360) - 180) });
      }
    };
    const up = () => {
      const g = gesture.current; if (!g) return;
      gesture.current = null;
      setLive((cur) => {
        // Only commit if something actually changed — a plain click is not an edit.
        const moved = cur && (Math.abs(cur.x - g.start.x) > 1 || Math.abs(cur.y - g.start.y) > 1 || Math.abs(cur.w - g.start.w) > 1 || Math.abs(cur.h - g.start.h) > 1 || cur.rot !== g.start.rot);
        if (moved && cur && onUpdate) onUpdate(a.id, { x: cur.x / pageW, y: cur.y / pageH, w: cur.w / pageW, h: cur.h / pageH, payload: { ...a.payload, rotation: cur.rot } });
        return moved ? cur : null; // keep optimistic position until the reload lands
      });
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [a.id, a.payload, onUpdate, pageW, pageH]);

  const paper = a.payload?.color && a.payload.color !== '#fde047' && /^#/.test(a.payload.color) ? a.payload.color : '#fde047';
  return (
    <div className="absolute pointer-events-auto group" onMouseDown={begin('move')}
      style={{ left: v.x, top: v.y, width: v.w, height: v.h, transform: `rotate(${v.rot}deg)`, transformOrigin: 'center', cursor: readOnly ? 'default' : 'grab', zIndex: 5 }}>
      <div className="w-full h-full overflow-hidden select-none" onDoubleClick={startEdit} title={readOnly ? 'Another user’s note' : 'Double-click to edit'}
        style={{ background: `linear-gradient(160deg, ${paper} 0%, ${paper} 78%, rgba(0,0,0,0.07) 100%)`,
          boxShadow: '2px 8px 14px rgba(0,0,0,.28), 0 1px 2px rgba(0,0,0,.12)',
          padding: '12px 12px 16px', fontFamily: '"Segoe Print","Comic Sans MS",cursive',
          fontSize: 13, lineHeight: 1.35, color: '#3f3000' }}>
        {editing ? (
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={commitEdit}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitEdit(); }}
            style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit' }} />
        ) : a.payload?.text}
      </div>
      {/* folded corner */}
      <div className="absolute bottom-0 right-0" style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 0 16px 16px', borderColor: `transparent transparent rgba(0,0,0,0.18) transparent` }} />
      {/* handles (hover, author only) */}
      {!readOnly && <>
        <button title="Delete note" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
          className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] shadow">✕</button>
        <div title="Rotate" onMouseDown={begin('rotate')}
          className="absolute left-1/2 -translate-x-1/2 hidden group-hover:block w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-500 shadow" style={{ top: -18, cursor: 'grab' }} />
        <div title="Resize" onMouseDown={begin('resize')}
          className="absolute hidden group-hover:block w-3.5 h-3.5 rounded-sm bg-white border-2 border-slate-500 shadow" style={{ right: -7, bottom: -7, cursor: 'nwse-resize' }} />
      </>}
    </div>
  );
}

/**
 * SYS-13 · D2 — annotation overlay. Renders existing annotations (normalized coords → screen)
 * and captures new ones with the active tool. On create it captures `anchorText` from the page's
 * pdfjs text items intersecting the mark (the seed for the D3 transfer algorithm).
 */
export default function AnnotationOverlay({
  ctx, annotations, tool, color, layerVisible, onCreate, onDelete, onUpdate, canModify, placingId, onPlace, tagCategory,
}: {
  ctx: OverlayCtx;
  annotations: any[];               // for the current page
  tool: Tool;
  color: string;
  layerVisible: (layerId: string) => boolean;
  onCreate: (a: any) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, patch: any) => void; // move/resize/rotate commits
  canModify?: (a: any) => boolean;  // only the author edits/deletes their own notes
  placingId?: string | null;        // D3 — an orphan armed for placement
  onPlace?: (id: string, pos: { page: number; x: number; y: number }) => void;
  tagCategory?: { key: string; label: string; color: string } | null; // P3 — selected tag category
}) {
  const mayEdit = (a: any) => (canModify ? canModify(a) : true);
  const { width, height, textItems, page } = ctx;
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [path, setPath] = useState<[number, number][]>([]);
  // In-place draft (no popup dialogs): sticky = type directly in the note; text/tag = inline composer
  const [draft, setDraft] = useState<{ tool: 'TEXT' | 'STICKY' | 'TAG'; x: number; y: number; text: string } | null>(null);
  const draftRef = useRef<typeof draft>(null); // commit guard: blur + click must not double-create
  const [selected, setSelected] = useState<string | null>(null); // click a highlight/pen mark → floating delete button
  const ref = useRef<HTMLDivElement>(null);
  const setDraftText = (text: string) => setDraft((d) => {
    const next = d ? { ...d, text } : d;
    draftRef.current = next;
    return next;
  });

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
    setSelected(null); // clicking the page clears any highlight selection
    const { x: cx, y: cy } = rel(e);
    if (placingId && onPlace) { onPlace(placingId, { page, x: cx / width, y: cy / height }); return; }
    if (tool === 'CURSOR') return;
    const { x, y } = rel(e);
    if (tool === 'PEN') { setPath([[x, y]]); return; }
    if (tool === 'HIGHLIGHT') { setDrag({ x0: x, y0: y, x1: x, y1: y }); return; }
    if (tool === 'TEXT' || tool === 'STICKY' || tool === 'TAG') {
      // Place-and-type: open an in-place editor at the click point — no popup dialog.
      // preventDefault stops the browser's default mousedown focus-steal, which would
      // blur (and instantly cancel) the editor we're about to mount.
      e.preventDefault();
      if (draftRef.current) { commitDraft(); return; }
      const d = { tool, x, y, text: '' } as const;
      draftRef.current = d as any; setDraft(d as any);
    }
  };

  /** Save the in-place draft (sticky textarea / inline composer) as a real annotation.
   *  Reads through a ref and nulls it first, so blur + click can't double-create. */
  const commitDraft = () => {
    const d = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!d) return;
    const input = d.text.trim();
    if (!input) return; // empty = cancel
    const w = d.tool === 'STICKY' ? 170 : d.tool === 'TAG' ? 14 : 4;
    const h = d.tool === 'STICKY' ? 120 : d.tool === 'TAG' ? 14 : 4;
    const anc = captureAnchor(d.x, d.y, 80, 16);
    const useCat = d.tool === 'TAG' && !!tagCategory;
    const tagKey = d.tool === 'TAG' ? (tagCategory?.key || (input.split(':')[0] || 'tag')) : undefined;
    const tagColor = useCat ? tagCategory!.color : color;
    const text = useCat ? `${tagCategory!.label}: ${input}` : input;
    const extra = d.tool === 'STICKY' ? { rotation: -2 } : {};
    onCreate({ tool: d.tool, page, ...norm(d.x, d.y, w, h), payload: { text, color: tagColor, tagKey, ...extra }, ...anc });
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
          const mine = mayEdit(a);
          const cls = mine ? 'pointer-events-auto cursor-pointer' : '';
          const del = mine ? () => { onDelete(a.id); setSelected(null); } : undefined;
          const pick = mine ? (e2: React.MouseEvent) => { e2.stopPropagation(); setSelected((s) => s === a.id ? null : a.id); } : undefined;
          const isSel = selected === a.id;
          if (a.tool === 'HIGHLIGHT') return <rect key={a.id} x={x} y={y} width={w} height={h} fill={c} opacity={0.35} className={cls} onClick={pick} onDoubleClick={del}
            stroke={isSel ? '#0f172a' : 'none'} strokeWidth={isSel ? 1.5 : 0} strokeDasharray={isSel ? '4 3' : undefined} />;
          if (a.tool === 'PEN' && a.payload?.points) {
            const pts = a.payload.points.map(([nx, ny]: number[]) => `${x + nx * w},${y + ny * h}`).join(' ');
            return <polyline key={a.id} points={pts} fill="none" stroke={c} strokeWidth={isSel ? 3.5 : 2} className={cls} onClick={pick} onDoubleClick={del} />;
          }
          return null;
        })}
      </svg>

      {/* floating delete for a selected highlight / pen mark */}
      {selected && (() => {
        const a = annotations.find((x) => x.id === selected);
        if (!a || !['HIGHLIGHT', 'PEN'].includes(a.tool) || !mayEdit(a)) return null;
        const bx = Math.min(a.x * width + a.w * width + 4, width - 76);
        const by = Math.max(2, a.y * height - 26);
        return (
          <button className="absolute pointer-events-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-900 text-white shadow-lg"
            style={{ left: bx, top: by, zIndex: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(a.id); setSelected(null); }}>
            ✕ Delete
          </button>
        );
      })()}

      {/* in-place draft editors (no popup dialogs) */}
      {draft && draft.tool === 'STICKY' && (
        <div className="absolute pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}
          style={{ left: draft.x, top: draft.y, width: 170, height: 120, transform: 'rotate(-2deg)', zIndex: 20,
            background: 'linear-gradient(160deg, #fde047 0%, #fde047 78%, rgba(0,0,0,0.07) 100%)',
            boxShadow: '2px 8px 14px rgba(0,0,0,.28)', padding: 10 }}>
          <textarea autoFocus value={draft.text} placeholder="Type your note…"
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => { if (e.key === 'Escape') { draftRef.current = null; setDraft(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitDraft(); }}
            style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              fontFamily: '"Segoe Print","Comic Sans MS",cursive', fontSize: 13, lineHeight: 1.35, color: '#3f3000' }} />
        </div>
      )}
      {draft && (draft.tool === 'TEXT' || draft.tool === 'TAG') && (
        <div className="absolute pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}
          style={{ left: Math.min(draft.x + 14, width - 250), top: Math.max(4, draft.y - 18), zIndex: 20 }}>
          <span className="absolute block w-3 h-3 rounded-full border-2 border-white shadow" style={{ left: -18, top: 14, background: draft.tool === 'TAG' ? (tagCategory?.color || color) : '#0f172a' }} />
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white shadow-lg p-1.5" style={{ width: 240 }}>
            <input autoFocus value={draft.text}
              placeholder={draft.tool === 'TAG' ? (tagCategory ? `${tagCategory.label} — element name…` : 'Tag, e.g. Prop: Vintage watch') : 'Add a note… (Enter to save)'}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => { if (e.key === 'Enter') commitDraft(); if (e.key === 'Escape') { draftRef.current = null; setDraft(null); } }}
              className="flex-1 min-w-0 text-xs px-2 py-1.5 outline-none bg-transparent" />
            <button onMouseDown={(e) => { e.preventDefault(); }} onClick={commitDraft}
              className="shrink-0 w-6 h-6 rounded-lg bg-slate-900 text-white text-xs flex items-center justify-center">✓</button>
          </div>
        </div>
      )}

      {/* sticky notes — real paper look, movable / resizable / rotatable, double-click to edit (authors only) */}
      {annotations.filter((a) => layerVisible(a.layerId) && a.tool === 'STICKY').map((a) => (
        <StickyNote key={a.id} a={a} pageW={width} pageH={height} readOnly={!mayEdit(a)} onUpdate={onUpdate} onDelete={onDelete} />
      ))}

      {/* text / tag rendered as HTML for legibility */}
      {annotations.filter((a) => layerVisible(a.layerId) && ['TEXT', 'TAG'].includes(a.tool)).map((a) => {
        const x = a.x * width, y = a.y * height;
        const c = a.payload?.color || a.layer?.color || color;
        const del = mayEdit(a) ? () => onDelete(a.id) : undefined;
        return (
          <div key={a.id} className="absolute pointer-events-auto group" style={{ left: x, top: y }} title={del ? 'Double-click to delete' : 'Another user’s note'}>
            {a.tool === 'TAG' ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white shadow" style={{ background: c }} onDoubleClick={del}>{a.payload?.text}</span>
            ) : (
              <div className="text-[11px] max-w-[180px] rounded-md shadow border border-black/10 px-2 py-1 bg-white" onDoubleClick={del}>{a.payload?.text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
