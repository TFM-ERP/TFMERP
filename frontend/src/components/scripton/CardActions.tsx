'use client';
import React from 'react';

/**
 * THE CARD'S CORNER ACTIONS — one cluster, two cards, no duplicated markup.
 *
 * Archive and Delete used to sit in the builds card's footer row and, on the slate card, as a
 * single hover-revealed `<span>` in the corner. Three things were wrong with that span and only
 * one of them was visible:
 *
 *   · it was MOUSE-ONLY. A <span onClick> takes no focus, answers no Enter or Space, and carried
 *     only a `title`. Keyboard and screen-reader users could not reach it at all.
 *   · it appeared on hover, so on a touch screen or for anyone scanning the board it did not
 *     exist until the pointer happened to be over the card.
 *   · it lived INSIDE `<button className="scard">`. A span nests legally there — but a real
 *     <button> does not, and turning it into one is exactly what this change needs.
 *
 * So every action here is a real `<button type="button">` with an aria-label, always visible,
 * with a hit target no smaller than 32px. `stopPropagation` is applied once, here, rather than
 * being remembered at each call site — the card underneath is clickable on both boards now.
 *
 * ICONS COME FROM THE SET THE CARDS ALREADY USE — the same 24x24 stroke family, and the archive
 * glyph is the builds card's own existing path, moved rather than redrawn.
 */

export const ICON_ARCHIVE = 'M3 7h18v13H3zM3 7l2-4h14l2 4M9 12h6';
export const ICON_TRASH = 'M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6';

export interface CardAction {
  key: string;
  /** SVG path data, 24x24 viewBox. */
  icon: string;
  /** Used for BOTH aria-label and title — the accessible name and the tooltip never drift apart. */
  label: string;
  onClick: () => void;
  /** Delete keeps its danger styling wherever it appears. */
  danger?: boolean;
}

export const CARD_ACTIONS_CSS = `
.cact{position:absolute;top:8px;inset-inline-end:8px;z-index:3;display:flex;gap:6px;pointer-events:none}
.cact .cabtn{pointer-events:auto;width:32px;height:32px;min-width:32px;min-height:32px;display:inline-flex;
  align-items:center;justify-content:center;padding:0;border-radius:9px;cursor:pointer;
  background:rgba(12,14,18,.72);border:1px solid var(--hair,rgba(255,255,255,.14));color:var(--mute,#9aa1ab);
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:background .15s,border-color .15s,color .15s}
.cact .cabtn:hover{background:rgba(22,26,32,.92);color:#E8E6E0}
.cact .cabtn:focus-visible{outline:2px solid #C6A463;outline-offset:2px}
.cact .cabtn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;
  stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.cact .cabtn.danger{color:#e5635f;border-color:rgba(229,99,95,.42)}
.cact .cabtn.danger:hover{background:rgba(229,99,95,.16);color:#ff8a86}
`;

export default function CardActions({ actions, className }: { actions: CardAction[]; className?: string }) {
  const list = (actions || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className={'cact' + (className ? ' ' + className : '')}>
      {list.map((a) => (
        <button
          key={a.key}
          type="button"
          className={'cabtn' + (a.danger ? ' danger' : '')}
          aria-label={a.label}
          title={a.label}
          // The card underneath opens on click; an action must never also open it.
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); a.onClick(); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={a.icon} /></svg>
        </button>
      ))}
    </div>
  );
}
