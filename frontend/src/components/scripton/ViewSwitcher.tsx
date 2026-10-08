'use client';
import React from 'react';

/**
 * ACTIVE / ARCHIVED / BIN — one switcher, shared by the builds board and the slate.
 *
 * It was inline in ScriptOnBuildsPanel as a `<span className="seg">` of `<span className="segb">`
 * children. The slate is about to grow the same three views, and a second copy of this markup is
 * how two boards that are meant to behave identically drift apart.
 *
 * THE BUTTONS ARE REAL BUTTONS NOW. The spans took no focus, answered no Enter or Space, and told a
 * screen reader nothing about which view was selected — the same defect the card icons had one
 * layer up. `aria-pressed` carries the selected state, which a coloured background alone does not.
 *
 * THE LOOK IS UNCHANGED, DELIBERATELY. The declarations below are copied verbatim from
 * `.bld .seg` / `.segb` / `.segb.on`, with `all:unset`-style resets added only where a <button>
 * would otherwise bring its own chrome (border, background, font). Same geometry, same colours,
 * same clicks — so adopting it changes nothing visible on the builds page.
 */

export type BoardView = 'active' | 'archived' | 'bin';

/**
 * The labels live here so both boards name the views identically — and the GLYPH IS KEPT OUTSIDE
 * THE TRANSLATED WORD, exactly as the inline version had it. Folding them into one string would
 * make "▤ Archived" the lookup key, which exists in no translation table, so every non-English
 * label would silently fall back to English.
 */
export const VIEW_LABELS: [BoardView, string, string][] = [
  ['active', '', 'Active'],
  ['archived', '▤ ', 'Archived'],
  ['bin', '✖ ', 'Bin'],
];

export const VIEW_SWITCHER_CSS = `
.vsw{margin-inline-start:auto;display:inline-flex;background:#15181e;border:1px solid var(--hair,rgba(255,255,255,.07));border-radius:9px;padding:3px;gap:2px}
.vsw .vswb{font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer;color:var(--mute,#9aa1ab);white-space:nowrap;
  font-family:inherit;background:transparent;border:0;margin:0;line-height:normal;-webkit-appearance:none;appearance:none}
.vsw .vswb.on{color:var(--gold2,#E6D2A2);background:rgba(198,164,99,.16)}
.vsw .vswb:focus-visible{outline:2px solid #C6A463;outline-offset:2px}
`;

export default function ViewSwitcher({ view, onView, t, labels }: {
  view: BoardView;
  onView: (v: BoardView) => void;
  /** Each board passes its own translator so the labels follow the page's locale. */
  t?: (s: string) => string;
  labels?: [BoardView, string, string][];
}) {
  const tr = t || ((s: string) => s);
  return (
    <span className="vsw" role="group" aria-label={tr('Which scripts to show')}>
      {(labels || VIEW_LABELS).map(([v, glyph, word]) => (
        <button
          key={v}
          type="button"
          className={'vswb' + (view === v ? ' on' : '')}
          aria-pressed={view === v}
          onClick={() => onView(v)}
        >
          {glyph}{tr(word)}
        </button>
      ))}
    </span>
  );
}
