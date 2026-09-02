'use client';
/**
 * ScriptonGenPill — the one live generation, floating over every ScriptON screen.
 *
 * WHY THIS EXISTS. A feature rewrite runs for thirty to fifty minutes. Until now the only place it
 * was visible was the overlay on the reader that launched it: press "Continue in background", or
 * simply walk to another screen, and the product looked idle. On 1 Sep that cost a run — the screen
 * looked idle, Generate was pressed a second time, and the second planner threw its error over the
 * first. The rail badge was the first half of the answer, but it is a 12px dot on one rail item, on
 * the screens that draw a rail, and only if you happen to be looking at it.
 *
 * This is the other half: a pill that follows you everywhere in ScriptON, says which script the
 * writer is on and what it is doing right now, and BREATHES GREEN when the draft lands. It is
 * mounted once, in scripton/layout.tsx, beside the two floating pieces already there
 * (ScriptOnCmdK, ScriptonBindBar). The bind bar owns the bottom-START corner; this owns bottom-END.
 *
 * TWO DELIBERATE SILENCES:
 *   1. It hides on the run's OWN reader screen. That screen has the full-height generation overlay,
 *      and a pill floating on top of a full-screen overlay reads as a rendering bug rather than as
 *      reassurance. Everywhere else — home, library, studio, canon, doctor, settings — it shows.
 *   2. It draws nothing at all when no run is known, so an idle ScriptON is exactly as it was.
 *
 * Collapsed state is remembered (localStorage), because a writer who tucks it away wants it tucked
 * away on the next screen too. Collapsing never dismisses: the dot stays, and it still turns green.
 */
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import { productionApi } from '@/lib/api';
import { useScriptonGenerating, markScriptonGenerating, readScriptonGenerating } from './useScriptonGenerating';

const COLLAPSE_KEY = 'tfm_scripton_pill_collapsed';

const C = {
  panel: '#13151b',
  ink: '#E7E3D8',
  mut: '#8b8f98',
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

export default function ScriptonGenPill() {
  const gen = useScriptonGenerating(5000);
  const router = useRouter();
  const pathname = usePathname();
  const { t, dir } = useLocale();

  // Collapsed preference — read post-mount only, so the server and the first client render agree.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* ignore */ }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Which document is the reader showing? Read from the live search string post-mount rather than
  // via useSearchParams, which would force a Suspense boundary around the whole ScriptON layout.
  const [search, setSearch] = useState('');
  useEffect(() => { setSearch(typeof window !== 'undefined' ? window.location.search : ''); }, [pathname]);

  /**
   * ADOPTION. Opening a script that is ALREADY generating arms the indicator, even though this tab
   * never pressed Generate. Without it the indicator only ever knows about runs it started itself,
   * which is wrong in three ordinary situations: the run was started in another tab, the browser
   * was restarted mid-run, or — the case on 1 Sep — an orphaned poll from an earlier run wiped the
   * key while the real run carried on for another hour.
   *
   * One probe, only on the reader route, only when nothing is currently being followed, and it arms
   * only on GENERATING. A finished run is never adopted this way: re-arming on DONE would put a
   * green pulse back on a draft the writer already acknowledged, every time they reopened it.
   */
  useEffect(() => {
    if (pathname !== '/scripton/script') return;
    if (readScriptonGenerating()) return;
    let docParam = '';
    try { docParam = new URLSearchParams(search).get('doc') || ''; } catch { return; }
    if (!docParam) return;
    let alive = true;
    void (async () => {
      try {
        const r: any = await productionApi.scripton.development.scriptProgress(docParam);
        if (!alive) return;
        if (String(r?.data?.status || '') === 'GENERATING') markScriptonGenerating(docParam);
      } catch { /* the backend may be restarting — the next visit tries again */ }
    })();
    return () => { alive = false; };
  }, [pathname, search]);

  const running = gen.status === 'GENERATING';
  const show = !!gen.docId && (running || gen.finished || gen.failed);

  // Silence #1 — the run's own reader screen already reports it, in full.
  let onOwnReader = false;
  if (show && pathname === '/scripton/script') {
    try { onOwnReader = new URLSearchParams(search).get('doc') === gen.docId; } catch { onOwnReader = false; }
  }

  if (!show || onOwnReader) return null;

  const tone = gen.failed ? C.red : gen.finished ? C.green : C.gold;
  const edge = gen.failed ? C.hairRed : gen.finished ? C.hairGreen : C.hair;
  const title = gen.title || t('Script');

  const line = gen.failed
    ? (gen.status === 'CANCELLED' ? t('Generation stopped') : t('Generation failed'))
    : gen.finished
      ? t('Draft ready') + (gen.pageCount ? ' · ' + gen.pageCount + ' ' + t('pages') : '')
      : gen.pct == null
        ? (gen.note || t('Planning the scenes…'))
        : t('Writing scene') + ' ' + Math.min(gen.done + 1, gen.total) + ' ' + t('of') + ' ' + gen.total
          + (gen.pageCount ? ' · ' + gen.pageCount + ' ' + t('pages') : '');

  const openRun = () => {
    const id = gen.docId;
    if (!id) return;
    // Clicking a landed or failed run acknowledges it — that is what stops the green pulse.
    if (gen.finished || gen.failed) gen.dismiss();
    router.push('/scripton/script?doc=' + encodeURIComponent(id));
  };

  // ── the dot: spinning ring while writing, breathing green when the draft lands ──
  const dot = gen.finished
    ? <span className="sgp-beat" style={{ width: 11, height: 11, borderRadius: 999, background: C.green, flex: '0 0 auto' }} />
    : gen.failed
      ? <span style={{ width: 11, height: 11, borderRadius: 999, background: C.red, boxShadow: '0 0 6px rgba(229,99,95,.6)', flex: '0 0 auto' }} />
      : <span className="sgp-spin" style={{ width: 13, height: 13, borderRadius: 999, border: '2px solid rgba(198,164,99,.28)', borderTopColor: C.gold2, flex: '0 0 auto' }} />;

  const wrap: React.CSSProperties = {
    position: 'fixed', insetInlineEnd: 16, bottom: 16, zIndex: 64,
    fontFamily: 'var(--sx-body)', direction: dir as any,
  };

  if (collapsed) {
    return (
      <>
        <style>{PILL_CSS}</style>
        <div style={wrap} dir={dir}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={gen.finished ? 'sgp-glow' : undefined}
            title={title + ' — ' + line}
            aria-label={title + ' — ' + line}
            role="status"
            aria-live="polite"
            style={{
              width: 38, height: 38, borderRadius: 999, display: 'grid', placeItems: 'center',
              background: C.panel, border: '1px solid ' + edge, cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)', padding: 0,
            }}
          >
            {dot}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{PILL_CSS}</style>
      <div style={wrap} dir={dir}>
        <div
          className={gen.finished ? 'sgp-glow' : undefined}
          role="status"
          aria-live="polite"
          style={{
            width: 268, maxWidth: 'calc(100vw - 32px)', background: C.panel, color: C.ink,
            border: '1px solid ' + edge, borderRadius: 14, padding: '10px 12px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {dot}
            <button
              type="button"
              onClick={openRun}
              title={t('Open the script')}
              style={{
                flex: 1, minWidth: 0, textAlign: 'start', background: 'transparent', border: 'none',
                padding: 0, cursor: 'pointer', color: C.ink, font: 'inherit',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F3ECDD', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title}
              </div>
              <div style={{ fontSize: 11, color: gen.finished ? C.green : gen.failed ? C.red : C.mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                {line}
              </div>
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              title={t('Tuck away — it keeps running')}
              aria-label={t('Tuck away — it keeps running')}
              style={{
                flex: '0 0 auto', width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center',
                background: 'transparent', color: C.mut, border: '1px solid rgba(255,255,255,.08)',
                cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0,
              }}
            >
              <span aria-hidden="true">&#8211;</span>
            </button>
          </div>

          {/* Progress. Determinate once scenes are landing; an indeterminate sweep while the planner
              is in its one long call, where a percentage against an unstarted total reads as 0%. */}
          {running ? (
            <div style={{ marginTop: 8, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
              {gen.pct == null
                ? <div className="sgp-sweep" style={{ width: '33%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,transparent,' + C.gold + ',transparent)' }} />
                : <div style={{ width: gen.pct + '%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,' + C.gold + ',' + C.gold2 + ')', transition: 'width .5s ease' }} />}
            </div>
          ) : null}

          {gen.finished || gen.failed ? (
            <button
              type="button"
              onClick={openRun}
              style={{
                marginTop: 9, width: '100%', textAlign: 'center',
                background: gen.finished ? 'rgba(87,179,104,.14)' : 'rgba(229,99,95,.12)',
                color: gen.finished ? C.green : C.red,
                border: '1px solid ' + edge, borderRadius: 9, padding: '7px 10px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {gen.finished ? t('Read the draft') : t('Open the script')}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
