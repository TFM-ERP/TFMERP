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
  /** 'rewrite' | 'extend' | '' — which button started it, so the indicator can title itself the
   *  way the reader's overlay does. Empty when the run was adopted or recovered rather than
   *  started here, because nothing on the wire carries it. */
  mode: string;
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
  docId: null, title: '', mode: '', status: 'IDLE', phase: null, done: 0, total: 0, pageCount: 0,
  pct: null, note: null, finished: false, failed: false,
};

/**
 * Called by whatever starts a generation, so the rest of the app can find it.
 *
 * `mode` rides along in the same key as "docId|mode" rather than in a second one: it is written and
 * cleared at exactly the same moments, and two keys that must agree are two keys that can disagree.
 */
export function markScriptonGenerating(docId: string, mode?: string): void {
  if (!docId) return;
  const list = readRuns().filter((r) => r.docId !== docId);
  list.unshift({ docId, mode: mode || '' });
  writeRuns(list);
  try { localStorage.setItem(LAST_KEY, docId); } catch { /* ignore */ }
}

export interface ScriptonRun { docId: string; mode: string }

/**
 * MORE THAN ONE RUN AT A TIME. The key used to hold a single document id, so starting a second
 * generation silently replaced the first: on 2 Sep a MINUTEMEN rewrite was launched beside a
 * running Jason Quick and the indicator simply forgot Jason Quick existed — still generating,
 * still spending, invisible. The backend never had this limit; `genProgress` is keyed per
 * document and only ever blocked a second run on the SAME script.
 *
 * Stored as JSON, newest first. A legacy single "docId" or "docId|mode" string still reads.
 */
function readRuns(): ScriptonRun[] {
  let raw = '';
  try { raw = sessionStorage.getItem(KEY) || ''; } catch { return []; }
  if (!raw) return [];
  if (raw.charAt(0) !== '[') {
    const i = raw.indexOf('|');
    const docId = i < 0 ? raw : raw.slice(0, i);
    return docId ? [{ docId, mode: i < 0 ? '' : raw.slice(i + 1) }] : [];
  }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((r: any) => ({ docId: String((r && r.docId) || ''), mode: String((r && r.mode) || '') }))
      .filter((r: ScriptonRun) => !!r.docId);
  } catch { return []; }
}

function writeRuns(list: ScriptonRun[]): void {
  try {
    if (!list.length) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(list.slice(0, 6)));
  } catch { /* private mode — the badge is a nicety, never load-bearing */ }
}

/** Every run this tab is following, newest first. */
export function readScriptonRuns(): ScriptonRun[] { return readRuns(); }

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
  if (!onlyIfDocId) { writeRuns([]); return; }
  writeRuns(readRuns().filter((r) => r.docId !== onlyIfDocId));
}

/** True while this document is still the one the badge is following. A poll whose document has
 *  been superseded should stop rather than keep reporting over the newer run. */
export function isScriptonGenerating(docId: string): boolean {
  return !!docId && readRuns().some((r) => r.docId === docId);
}

/** The newest run, for the single-run consumers (the rail badge). */
export function readScriptonGenerating(): string | null {
  const r = readRuns()[0];
  return r ? r.docId : null;
}

export function readScriptonGeneratingMode(): string {
  const r = readRuns()[0];
  return r ? r.mode : '';
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
 * Poll every run this tab is following. Idle when there are none — no timer work, no requests.
 *
 * `intervalMs` is deliberately slower than the overlay's own poll: this is an ambient indicator,
 * not a progress bar being watched, and a generation runs for the better part of an hour. The
 * requests are issued together, so following three runs costs one round trip, not three in series.
 */
export function useScriptonGenerations(intervalMs = 8000): {
  runs: ScriptonGenerating[];
  dismiss: (docId?: string) => void;
} {
  const [runs, setRuns] = useState<ScriptonGenerating[]>([]);

  const dismiss = useCallback((docId?: string) => {
    clearScriptonGenerating(docId);
    setRuns((prev) => (docId ? prev.filter((r) => r.docId !== docId) : []));
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const one = async (run: ScriptonRun): Promise<ScriptonGenerating | null> => {
      try {
        const [r, title]: [any, string] = await Promise.all([
          productionApi.scripton.development.scriptProgress(run.docId),
          docTitle(run.docId),
        ]);
        const p: any = r?.data || {};
        const status = String(p.status || 'UNKNOWN');
        const done = Number(p.done) || 0;
        const total = Number(p.total) || 0;
        const planning = p.phase === 'PLANNING' || (status === 'GENERATING' && done === 0 && !p.phase);
        return {
          docId: run.docId,
          title,
          mode: run.mode,
          status,
          phase: p.phase || null,
          done,
          total,
          pageCount: Number(p.pageCount) || 0,
          pct: planning || total <= 0 ? null : Math.min(99, Math.round((done / total) * 100)),
          note: p.note ? String(p.note) : null,
          finished: status === 'DONE',
          failed: status === 'ERROR' || status === 'CANCELLED',
        };
      } catch {
        // A failed poll is not a failed run — the backend may be restarting. Drop this tick only.
        return null;
      }
    };

    const tick = async () => {
      let list = readScriptonRuns();
      if (!list.length) {
        const recovered = await recoverRunningDoc();
        if (!alive) return;
        if (!recovered) { setRuns([]); return; }
        list = readScriptonRuns();
      }
      const results = await Promise.all(list.map(one));
      if (!alive) return;
      // A poll that failed keeps whatever that run last showed, rather than blinking out of the
      // stack because the backend was mid-restart.
      setRuns((prev) => list
        .map((run, i) => results[i] || prev.find((x) => x.docId === run.docId) || null)
        .filter((x): x is ScriptonGenerating => !!x));
    };

    void tick();
    timer = setInterval(tick, Math.max(2000, intervalMs));
    // Another tab (or the reader itself) may start or clear a run; pick it up without a reload.
    const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === LAST_KEY) void tick(); };
    window.addEventListener('storage', onStorage);
    return () => { alive = false; if (timer) clearInterval(timer); window.removeEventListener('storage', onStorage); };
  }, [intervalMs]);

  return { runs, dismiss };
}

/**
 * The NEWEST run, for consumers that can only draw one — the rail badge.
 *
 * Kept deliberately as its own shape so adding parallel runs did not have to touch the rail. It is
 * a view over the same poll, not a second one.
 */
export function useScriptonGenerating(intervalMs = 8000): ScriptonGenerating & { dismiss: () => void } {
  const { runs, dismiss } = useScriptonGenerations(intervalMs);
  const primary = runs.find((r) => r.status === 'GENERATING') || runs[0] || EMPTY;
  const dismissPrimary = useCallback(() => { dismiss(primary.docId || undefined); }, [dismiss, primary.docId]);
  return { ...primary, dismiss: dismissPrimary };
}
