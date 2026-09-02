'use client';
/**
 * ScriptonGenPill — every live generation, floating over every ScriptON screen.
 *
 * WHY THIS EXISTS. A feature rewrite runs for thirty to fifty minutes. Until now the only place it
 * was visible was the overlay on the reader that launched it: press "Continue in background", or
 * simply walk to another screen, and the product looked idle. On 1 Sep that cost a run — the screen
 * looked idle, Generate was pressed a second time, and the second planner threw its error over the
 * first. The rail badge was the first half of the answer, but it is a 12px dot on one rail item, on
 * the screens that draw a rail, and only if you happen to be looking at it.
 *
 * EVERY generation, plural, because the backend always allowed it: `genProgress` is keyed per
 * document and only ever refused a second run on the SAME script. On 2 Sep a MINUTEMEN rewrite was
 * started beside a running Jason Quick, and the indicator — which held one document id — simply
 * forgot Jason Quick. Still generating, still spending, invisible. Runs now stack, newest on top.
 *
 * THREE STATES, because one size was wrong in both directions:
 *   * DOT — 38px, tucked away, carrying a count when more than one run is live, and still beating
 *     green when a draft lands.
 *   * PILL — the default. Per run: name, one line of status, a progress bar.
 *   * OPEN — the reader's generation overlay, shrunk to the corner: the mode, the ring, the FULL
 *     status sentence (the pill truncates it to "Planning the scenes — this can take…", which tells
 *     you nothing), and both controls, INCLUDING Stop generating. Stopping a run used to mean
 *     finding your way back to the screen that started it; now it is two clicks from anywhere.
 *
 * Mounted once, in scripton/layout.tsx, beside the two floating pieces already there
 * (ScriptOnCmdK, ScriptonBindBar). The bind bar owns the bottom-START corner; this owns bottom-END.
 *
 * It draws nothing at all when no run is known, so an idle ScriptON is exactly as it was. And a
 * single run stands down while the reader is genuinely reporting THAT run itself — see
 * `readerReporting` below, which is a narrower rule than it first appears.
 */
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import { productionApi } from '@/lib/api';
import {
  useScriptonGenerations, markScriptonGenerating,
  type ScriptonGenerating,
} from './useScriptonGenerating';

const VIEW_KEY = 'tfm_scripton_pill_view';
type View = 'dot' | 'pill' | 'open';

/** More than three cards stops being an indicator and starts being a window. */
const MAX_CARDS = 3;

const C = {
  panel: '#13151b',
  ink: '#E7E3D8',
  mut: '#8b8f98',
  faint: '#6b727d',
  gold: '#C6A463',
  gold2: '#E6D2A2',
  green: '#57B368',
  red: '#E5635F',
  hair: 'rgba(198,164,99,0.30)',
  hairGreen: 'rgba(87,179,104,0.45)',
  hairRed: 'rgba(229,99,95,0.45)',
};

/** The pill's own keyframes. It lives outside the `.sx` shell, so it cannot borrow the rail's CSS. */
const PILL_CSS = `
.sgp-spin{animation:sgpSpin .9s linear infinite}
@keyframes sgpSpin{to{transform:rotate(360deg)}}
.sgp-beat{animation:sgpBeat 1.6s ease-out infinite}
@keyframes sgpBeat{
  0%{box-shadow:0 0 0 0 rgba(87,179,104,.55)}
  70%{box-shadow:0 0 0 9px rgba(87,179,104,0)}
  100%{box-shadow:0 0 0 0 rgba(87,179,104,0)}
}
.sgp-glow{animation:sgpGlow 1.6s ease-in-out infinite}
@keyframes sgpGlow{
  0%,100%{border-color:rgba(87,179,104,.35)}
  50%{border-color:rgba(87,179,104,.85)}
}
.sgp-sweep{animation:sgpSweep 1.5s ease-in-out infinite}
@keyframes sgpSweep{
  0%{transform:translateX(-100%)}
  100%{transform:translateX(300%)}
}
@media (prefers-reduced-motion:reduce){
  .sgp-spin,.sgp-beat,.sgp-glow,.sgp-sweep{animation:none}
}
`;

/**
 * A run that is actually on the stack. `ScriptonGenerating.docId` is `string | null` because the
 * idle state has no document; everything past the filter below does, and saying so once here is
 * what lets the helpers use it as a map key and a URL parameter without re-checking.
 */
type LiveRun = ScriptonGenerating & { docId: string };

const edgeOf = (r: ScriptonGenerating) => (r.failed ? C.hairRed : r.finished ? C.hairGreen : C.hair);

/** Spinning ring while writing, breathing green when the draft lands, hard red when it stopped. */
function Mark({ run, size }: { run: ScriptonGenerating; size: number }) {
  if (run.finished) {
    return <span className="sgp-beat" style={{ width: size - 2, height: size - 2, borderRadius: 999, background: C.green, flex: '0 0 auto' }} />;
  }
  if (run.failed) {
    return <span style={{ width: size - 2, height: size - 2, borderRadius: 999, background: C.red, boxShadow: '0 0 6px rgba(229,99,95,.6)', flex: '0 0 auto' }} />;
  }
  return <span className="sgp-spin" style={{ width: size, height: size, borderRadius: 999, border: Math.max(2, Math.round(size / 7)) + 'px solid rgba(198,164,99,.22)', borderTopColor: C.gold2, flex: '0 0 auto' }} />;
}

function Bar({ pct }: { pct: number | null }) {
  return (
    <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
      {pct == null
        ? <div className="sgp-sweep" style={{ width: '33%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,transparent,' + C.gold + ',transparent)' }} />
        : <div style={{ width: pct + '%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,' + C.gold + ',' + C.gold2 + ')', transition: 'width .5s ease' }} />}
    </div>
  );
}

export default function ScriptonGenPill() {
  const { runs, dismiss } = useScriptonGenerations(5000);
  const router = useRouter();
  const pathname = usePathname();
  const { t, dir } = useLocale();

  // Which of the three states, read post-mount only so the server and first client render agree.
  const [view, setView] = useState<View>('pill');
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'dot' || v === 'pill' || v === 'open') setView(v);
    } catch { /* ignore */ }
  }, []);
  const go = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  /** Which run the OPEN state is showing. Empty means "the newest one". */
  const [openId, setOpenId] = useState('');

  // Stopping is cooperative on the backend — the scene in flight finishes first — so the button
  // reports "Stopping…" rather than pretending the run ended the instant it was pressed. Per run,
  // because stopping one of two must never grey out the other.
  const [stopping, setStopping] = useState<Record<string, boolean>>({});
  const [stopErr, setStopErr] = useState<Record<string, string>>({});

  // Which document is the reader showing? Read from the live search string post-mount rather than
  // via useSearchParams, which would force a Suspense boundary around the whole ScriptON layout.
  const [search, setSearch] = useState('');
  useEffect(() => { setSearch(typeof window !== 'undefined' ? window.location.search : ''); }, [pathname]);

  /**
   * Is the reader ALREADY reporting a run itself?
   *
   * The first version of this hid on the whole /scripton/script route, reasoning that the reader
   * has a full-screen overlay. It only has one when that page instance started the run — its
   * `regening` is local state. Walking back to the reader later showed the old pages and nothing
   * else, on the very screen where the run matters most. So the reader now publishes a body flag
   * while it is reporting (overlay up OR minimised to its own chip), and the pill defers only to
   * that, and only for THAT ONE run — a second script's generation still shows.
   */
  const [readerReporting, setReaderReporting] = useState(false);
  useEffect(() => {
    const read = () => {
      try { setReaderReporting(!!document.body.dataset.scriptonOverlay); } catch { setReaderReporting(false); }
    };
    read();
    window.addEventListener('scripton:overlay', read);
    return () => window.removeEventListener('scripton:overlay', read);
  }, [pathname]);

  /**
   * ADOPTION. Opening a script that is ALREADY generating adds it to the stack, even though this
   * tab never pressed Generate on it. Without this the indicator only ever knows about runs it
   * started itself, which is wrong in three ordinary situations: the run was started in another
   * tab, the browser was restarted mid-run, or an orphaned poll wiped the key while the real run
   * carried on. It is also the honest way to answer "is that other script still going?" — open it.
   *
   * One probe, only on the reader route, only for a document not already followed, and it arms only
   * on GENERATING. A finished run is never adopted this way: re-arming on DONE would put a green
   * pulse back on a draft the writer already acknowledged, every time they reopened it.
   */
  useEffect(() => {
    if (pathname !== '/scripton/script') return;
    let docParam = '';
    try { docParam = new URLSearchParams(search).get('doc') || ''; } catch { return; }
    if (!docParam || runs.some((r) => r.docId === docParam)) return;
    let alive = true;
    void (async () => {
      try {
        const r: any = await productionApi.scripton.development.scriptProgress(docParam);
        if (!alive) return;
        if (String(r?.data?.status || '') === 'GENERATING') markScriptonGenerating(docParam);
      } catch { /* the backend may be restarting — the next visit tries again */ }
    })();
    return () => { alive = false; };
  }, [pathname, search, runs]);

  // A run the reader itself is reporting drops out of the stack; every other run stays.
  let readerDoc = '';
  if (readerReporting && pathname === '/scripton/script') {
    try { readerDoc = new URLSearchParams(search).get('doc') || ''; } catch { readerDoc = ''; }
  }
  const visible = runs.filter((r): r is LiveRun => !!r.docId && r.docId !== readerDoc
    && (r.status === 'GENERATING' || r.finished || r.failed));

  if (!visible.length) return null;

  const anyFinished = visible.some((r) => r.finished);
  const selected = visible.find((r) => r.docId === openId) || visible[0];
  const others = visible.filter((r) => r.docId !== selected.docId);

  const titleOf = (r: LiveRun) => r.title || t('Script');
  const eyebrowOf = (r: LiveRun) =>
    (r.mode === 'rewrite' ? t('Full rewrite') : r.mode === 'extend' ? t('Complete the script') : null);

  const lineOf = (r: LiveRun) => (stopping[r.docId]
    ? t('Stopping after the current scene…')
    : r.failed
      ? (r.status === 'CANCELLED' ? t('Generation stopped. Your current script is unchanged.') : t('Generation failed — see AI Engines & Routing.'))
      : r.finished
        ? t('Draft ready') + (r.pageCount ? ' · ' + r.pageCount + ' ' + t('pages') : '')
        : r.pct == null
          ? (r.note || t('Planning the scenes — this can take a few minutes on long scripts.'))
          : t('Writing scene') + ' ' + Math.min(r.done + 1, r.total) + ' ' + t('of') + ' ' + r.total
            + (r.pageCount ? ' · ' + r.pageCount + ' ' + t('pages') : ''));

  const openRun = (r: LiveRun) => {
    // Opening a landed or failed run acknowledges it — that is what stops the green pulse.
    if (r.finished || r.failed) dismiss(r.docId);
    const href = '/scripton/script?doc=' + encodeURIComponent(r.docId);
    /**
     * READER TO READER NEEDS A REAL NAVIGATION.
     *
     * The reader resolves its document exactly once — `window.location.search`, read inside an
     * effect with an empty dependency array. A router.push from /scripton/script?doc=A to
     * ?doc=B changes the URL without remounting the page, so the loader never re-runs and the
     * screen carries on showing A. With two generations live that is not an edge case: pressing
     * "Open the script" on MINUTEMEN while reading Jason Quick appeared to do nothing at all.
     *
     * A full navigation is the honest fix from this side, and it costs nothing here — arriving at
     * a different script wants a fresh reader anyway. The deeper fix belongs in the reader, which
     * should react to its own query rather than snapshot it, and is worth doing when no run is in
     * flight: it means re-running that loader on every param change, and it is the page every
     * generation is watched from.
     */
    if (pathname === '/scripton/script') {
      try { window.location.assign(href); return; } catch { /* fall through to the SPA route */ }
    }
    router.push(href);
  };

  const stopRun = async (r: LiveRun) => {
    if (stopping[r.docId]) return;
    setStopping((m) => ({ ...m, [r.docId]: true }));
    setStopErr((m) => ({ ...m, [r.docId]: '' }));
    try {
      await productionApi.scripton.development.cancelFeature(r.docId);
    } catch (e: any) {
      setStopping((m) => ({ ...m, [r.docId]: false }));
      setStopErr((m) => ({ ...m, [r.docId]: e?.response?.data?.message || t('Could not stop the generation — it is still running.') }));
    }
  };

  const wrap: React.CSSProperties = {
    position: 'fixed', insetInlineEnd: 16, bottom: 16, zIndex: 64,
    fontFamily: 'var(--sx-body)', direction: dir as any,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
  };
  const btn = (bg: string, fg: string, bd: string): React.CSSProperties => ({
    flex: 1, textAlign: 'center', background: bg, color: fg, border: '1px solid ' + bd,
    borderRadius: 9, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  });
  const tuckBtn = (to: View, label: string) => (
    <button
      type="button" onClick={() => go(to)} title={label} aria-label={label}
      style={{
        flex: '0 0 auto', width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center',
        background: 'transparent', color: C.mut, border: '1px solid rgba(255,255,255,.08)',
        cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0,
      }}
    >
      <span aria-hidden="true">&#8211;</span>
    </button>
  );

  // ── DOT ────────────────────────────────────────────────────────────────────────────────────
  if (view === 'dot') {
    const lead = visible.find((r) => r.finished) || visible[0];
    return (
      <>
        <style>{PILL_CSS}</style>
        <div style={wrap} dir={dir}>
          <button
            type="button" onClick={() => go('pill')}
            className={anyFinished ? 'sgp-glow' : undefined}
            title={visible.map((r) => titleOf(r) + ' — ' + lineOf(r)).join(' · ')}
            aria-label={visible.length + ' ' + t('generations')}
            role="status" aria-live="polite"
            style={{
              position: 'relative', width: 38, height: 38, borderRadius: 999, display: 'grid', placeItems: 'center',
              background: C.panel, border: '1px solid ' + edgeOf(lead), cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)', padding: 0,
            }}
          >
            <Mark run={lead} size={13} />
            {visible.length > 1 ? (
              <span style={{
                position: 'absolute', top: -5, insetInlineEnd: -5, minWidth: 17, height: 17, borderRadius: 999,
                background: C.gold, color: '#15120B', fontSize: 10, fontWeight: 800, lineHeight: '17px',
                textAlign: 'center', padding: '0 4px',
              }}>{visible.length}</span>
            ) : null}
          </button>
        </div>
      </>
    );
  }

  // ── one compact card ───────────────────────────────────────────────────────────────────────
  const compact = (r: LiveRun, withTuck: boolean) => (
    <div
      key={r.docId}
      className={r.finished ? 'sgp-glow' : undefined}
      role="status" aria-live="polite"
      style={{
        width: 268, maxWidth: 'calc(100vw - 32px)', background: C.panel, color: C.ink,
        border: '1px solid ' + edgeOf(r), borderRadius: 14, padding: '10px 12px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Mark run={r} size={13} />
        {/* Clicking the body OPENS this run's status rather than navigating: the truncated line is
            the thing you want more of, and "Open the script" is one of the buttons behind it. */}
        <button
          type="button"
          onClick={() => { setOpenId(r.docId); go('open'); }}
          title={titleOf(r) + ' — ' + lineOf(r)}
          style={{
            flex: 1, minWidth: 0, textAlign: 'start', background: 'transparent', border: 'none',
            padding: 0, cursor: 'pointer', color: C.ink, font: 'inherit',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F3ECDD', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titleOf(r)}
          </div>
          <div style={{ fontSize: 11, color: r.finished ? C.green : r.failed ? C.red : C.mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            {lineOf(r)}
          </div>
        </button>
        {withTuck ? tuckBtn('dot', t('Tuck away — they keep running')) : null}
      </div>
      {r.status === 'GENERATING' ? <div style={{ marginTop: 8 }}><Bar pct={r.pct} /></div> : null}
      {r.finished || r.failed ? (
        <button
          type="button" onClick={() => openRun(r)}
          style={{
            marginTop: 9, width: '100%', textAlign: 'center',
            background: r.finished ? 'rgba(87,179,104,.14)' : 'rgba(229,99,95,.12)',
            color: r.finished ? C.green : C.red,
            border: '1px solid ' + edgeOf(r), borderRadius: 9, padding: '7px 10px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {r.finished ? t('Read the draft') : t('Open the script')}
        </button>
      ) : null}
    </div>
  );

  // ── OPEN — the reader's overlay, shrunk to the corner ──────────────────────────────────────
  if (view === 'open') {
    const r = selected;
    const eyebrow = eyebrowOf(r);
    return (
      <>
        <style>{PILL_CSS}</style>
        <div style={wrap} dir={dir}>
          {others.slice(0, MAX_CARDS - 1).map((o) => compact(o, false))}
          <div
            className={r.finished ? 'sgp-glow' : undefined}
            role="status" aria-live="polite"
            style={{
              width: 304, maxWidth: 'calc(100vw - 32px)', background: C.panel, color: C.ink,
              border: '1px solid ' + edgeOf(r), borderRadius: 16, padding: '13px 15px 15px',
              boxShadow: '0 18px 52px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: eyebrow ? C.gold : 'transparent' }}>
                {eyebrow || '—'}
              </div>
              {tuckBtn('pill', t('Shrink'))}
            </div>

            <div style={{ display: 'grid', placeItems: 'center', padding: '2px 0 12px' }}><Mark run={r} size={46} /></div>

            <div style={{ textAlign: 'center', fontWeight: 700, color: '#F3ECDD', fontSize: 14.5, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {titleOf(r)}
            </div>
            {/* The whole point of this state: the status sentence in full, wrapped, not clipped. */}
            <div style={{ textAlign: 'center', fontSize: 12, lineHeight: 1.5, marginTop: 6, color: r.finished ? C.green : r.failed ? C.red : C.mut }}>
              {lineOf(r)}
            </div>
            {r.status === 'GENERATING' && !stopping[r.docId] ? (
              <div style={{ textAlign: 'center', fontSize: 10.5, lineHeight: 1.5, marginTop: 6, color: C.faint }}>
                {t('Your current pages stay until the new draft is ready.')}
              </div>
            ) : null}
            {stopErr[r.docId] ? (
              <div style={{ textAlign: 'center', fontSize: 10.5, lineHeight: 1.5, marginTop: 6, color: C.red }}>{stopErr[r.docId]}</div>
            ) : null}

            {r.status === 'GENERATING' ? <div style={{ marginTop: 12 }}><Bar pct={r.pct} /></div> : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => openRun(r)} style={btn('#1b1e25', C.ink, 'rgba(255,255,255,.12)')}>
                {r.finished ? t('Read the draft') : t('Open the script')}
              </button>
              {r.status === 'GENERATING' ? (
                <button
                  type="button" onClick={() => stopRun(r)} disabled={!!stopping[r.docId]}
                  style={{ ...btn('rgba(229,99,95,.10)', C.red, C.hairRed), cursor: stopping[r.docId] ? 'default' : 'pointer', opacity: stopping[r.docId] ? 0.6 : 1 }}
                  title={t('The scene being written finishes first, then the run stops.')}
                >
                  {stopping[r.docId] ? t('Stopping…') : t('Stop generating')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── PILL — the default ─────────────────────────────────────────────────────────────────────
  const shown = visible.slice(0, MAX_CARDS);
  const hidden = visible.length - shown.length;
  return (
    <>
      <style>{PILL_CSS}</style>
      <div style={wrap} dir={dir}>
        {hidden > 0 ? (
          <div style={{ fontSize: 10.5, color: C.faint, paddingInlineEnd: 4 }}>
            {'+' + hidden + ' ' + t('more running')}
          </div>
        ) : null}
        {shown.map((r, i) => compact(r, i === shown.length - 1))}
      </div>
    </>
  );
}
