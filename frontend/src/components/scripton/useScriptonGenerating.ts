'use client';
/**
 * useScriptonGenerating — one live generation, visible from anywhere in ScriptON.
 *
 * WHY THIS EXISTS. A feature rewrite runs for thirty to fifty minutes, and the only place its
 * progress was visible was the overlay on the reader screen that launched it. Press "Continue in
 * background" and the run vanished: no indication anywhere in the product that the writer was
 * working, no way back to the screen except retracing your steps. On 1 Sep that cost a run — the
 * overlay had been dismissed, the screen looked idle, and Generate was pressed a second time,
 * starting a parallel run whose planner promptly failed and threw its error over the working one.
 *
 * So the run is remembered OUTSIDE the screen. The reader records the document id when it starts a
 * generation; this hook polls the same progress endpoint the overlay uses and hands the rail and
 * the floating pill something to draw.
 *
 * TWO KEYS, TWO LIFETIMES, ON PURPOSE:
 *   * KEY (sessionStorage) is the LIVE badge — the run this tab is following. Session-scoped
 *     because a run belongs to the tab that started it, and a stale id in a browser reopened next
 *     week helps nobody.
 *   * LAST_KEY (localStorage) is the LAST document we ever started a run on. It is never cleared,
 *     and it exists for exactly one job: recovery. See recoverRunningDoc below.
 *
 * The finished state is sticky. When a draft lands the badge turns green and PULSES until it is
 * clicked, because the whole point is to be told across screens that the thing you walked away
 * from is ready. Clicking clears it and returns you to the script.
 */
import { useCallback, useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';

const KEY = 'tfm_scripton_generating';
const LAST_KEY = 'tfm_scripton_last_doc';

export type ScriptonGenerating = {
  /** The script being generated, or null when nothing is running and nothing is waiting to be seen. */
  docId: string | null;
  /** The script's name, so the indicator can say WHICH script rather than "a generation". */
  title: string;
  status: string;
  phase: string | null;
  done: number;
  total: number;
  pageCount: number;
  /** 0-99 while writing; null while planning, where a percentage against an unstarted total reads as a stuck 0%. */
  pct: number | null;
  /** The backend's own sentence about what it is doing, when it has one. */
  note: string | null;
  /** True once the draft has landed and the writer has not yet acknowledged it. The green pulse. */
  finished: boolean;
  /** True when the run ended badly — reported, but never as the celebratory pulse. */
  failed: boolean;
};

const EMPTY: ScriptonGenerating = {
  docId: null, title: '', status: 'IDLE', phase: null, done: 0, total: 0, pageCount: 0,
  pct: null, note: null, finished: false, failed: false,
};

/** Called by whatever starts a generation, so the rest of the app can find it. */
export function markScriptonGenerating(docId: string): void {
  if (!docId) return;
  try { sessionStorage.setItem(KEY, docId); } catch { /* private mode — the badge is a nicety, never load-bearing */ }
  try { localStorage.setItem(LAST_KEY, docId); } catch { /* ignore */ }
}

/**
 * Called when the writer has seen the result. Clears the badge.
 *
 * `onlyIfDocId` GUARDS AGAINST AN ORPHANED POLL, which is not hypothetical: the reader starts its
 * progress poll with `setInterval` and does not clear it when the screen unmounts, so navigating
 * away from a run leaves the timer alive in the same JS context. On 1 Sep a cancelled MINUTEMEN
 * poll outlived its screen, reached its `stop()` a minute later, and deleted the badge for the
 * Jason Quick run that had started in the meantime — a generation ran for an hour with no
 * indication anywhere in the product.
 *
 * A run may only clear the badge IT set. Passing no id keeps the old unconditional behaviour for
 * the one caller that genuinely means "clear whatever is there" — the writer clicking the badge.
 */
export function clearScriptonGenerating(onlyIfDocId?: string): void {
  try {
    if (onlyIfDocId && sessionStorage.getItem(KEY) !== onlyIfDocId) return;
    sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/** True while this document is still the one the badge is following. A poll whose document has
 *  been superseded should stop rather than keep reporting over the newer run. */
export function isScriptonGenerating(docId: string): boolean {
  return !!docId && readScriptonGenerating() === docId;
}

export function readScriptonGenerating(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

/**
 * The script's name, fetched once per document and shared by every consumer of this hook.
 *
 * A failure is deliberately NOT cached: a poll that lands while the backend is rebuilding would
 * otherwise pin the pill to a blank name for the rest of the session.
 */
const titleCache = new Map<string, string>();
async function docTitle(docId: string): Promise<string> {
  const hit = titleCache.get(docId);
  if (hit !== undefined) return hit;
  try {
    const r: any = await productionApi.script.getDocument(docId);
    const ttl = String(r?.data?.title || '').trim();
    if (ttl) titleCache.set(docId, ttl);
    return ttl;
  } catch {
    return '';
  }
}

/**
 * SELF-HEALING. The live key can be missing while a generation is genuinely running: a new tab, a
 * browser restart mid-run, or — the case that actually bit on 1 Sep — an orphaned poll from an
 * earlier run wiping it. The badge then reports nothing for an hour, which is precisely the
 * failure it was built to prevent.
 *
 * So when the live key is empty we ask the backend about the LAST document a run was started on.
 * If it is still GENERATING, the badge re-arms itself. Only GENERATING: re-arming on DONE would
 * resurrect a green pulse the writer already acknowledged, every time they opened a new tab.
 *
 * Runs at most once per page load, across every consumer of the hook — the flag is set before the
 * await so two mounting components cannot both probe. A consumer that loses the race picks the
 * recovered id up on its next tick from sessionStorage.
 */
let recoveryTried = false;
async function recoverRunningDoc(): Promise<string | null> {
  if (recoveryTried) return null;
  recoveryTried = true;
  let last = '';
  try { last = localStorage.getItem(LAST_KEY) || ''; } catch { return null; }
  if (!last) return null;
  try {
    const r: any = await productionApi.scripton.development.scriptProgress(last);
    if (String(r?.data?.status || '') === 'GENERATING') { markScriptonGenerating(last); return last; }
  } catch { /* backend down or the run is long gone — nothing to recover */ }
  return null;
}

/**
 * Poll the run, if there is one. Idle when there isn't — no timer beyond the tick, no requests.
 *
 * `intervalMs` is deliberately slower than the overlay's own poll: this is an ambient indicator,
 * not a progress bar being watched, and a generation runs for the better part of an hour.
 */
export function useScriptonGenerating(intervalMs = 8000): ScriptonGenerating & { dismiss: () => void } {
  const [state, setState] = useState<ScriptonGenerating>(EMPTY);

  const dismiss = useCallback(() => { clearScriptonGenerating(); setState(EMPTY); }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      let docId = readScriptonGenerating();
      if (!docId) {
        docId = await recoverRunningDoc();
        if (!alive) return;
        if (!docId) { setState(EMPTY); return; }
      }
      try {
        const [r, title]: [any, string] = await Promise.all([
          productionApi.scripton.development.scriptProgress(docId),
          docTitle(docId),
        ]);
        if (!alive) return;
        const p: any = r?.data || {};
        const status = String(p.status || 'UNKNOWN');
        const done = Number(p.done) || 0;
        const total = Number(p.total) || 0;
        const planning = p.phase === 'PLANNING' || (status === 'GENERATING' && done === 0 && !p.phase);
        setState({
          docId,
          title,
          status,
          phase: p.phase || null,
          done,
          total,
          pageCount: Number(p.pageCount) || 0,
          pct: planning || total <= 0 ? null : Math.min(99, Math.round((done / total) * 100)),
          note: p.note ? String(p.note) : null,
          finished: status === 'DONE',
          failed: status === 'ERROR' || status === 'CANCELLED',
        });
      } catch {
        // A failed poll is not a failed run — the backend may be restarting. Hold the last state.
      }
    };

    void tick();
    timer = setInterval(tick, Math.max(2000, intervalMs));
    // Another tab (or the reader itself) may start or clear a run; pick it up without a reload.
    const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === LAST_KEY) void tick(); };
    window.addEventListener('storage', onStorage);
    return () => { alive = false; if (timer) clearInterval(timer); window.removeEventListener('storage', onStorage); };
  }, [intervalMs]);

  return { ...state, dismiss };
}
