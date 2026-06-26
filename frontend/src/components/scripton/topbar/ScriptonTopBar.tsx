'use client';
/**
 * ScriptON · Unified Top Bar — the shared global bar across all nine OS workspaces
 * (Figma top bar on every frame). Rendered per-screen in place of each screen's old
 * `.top` strip (the SxRail sibling pattern). Self-contained `.sxtb` styling + own data
 * via useScriptonTopBar; props override when a screen has richer context. The ⌘K
 * palette is DEFERRED — the search field is visual only (focus, no dropdown). Behind
 * scripton.osShell (the screens only render under the new shell).
 */
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import { useScriptonTopBar } from './useScriptonTopBar';
import { initials, showRing, ringOffset } from './scripton-topbar.logic';

export type ScriptonTopBarProps = {
  vp: 'mobile' | 'tablet' | 'desktop';
  onBack?: () => void;             // TFM tile → Home / back to FilmOS
  onOpenVersions?: () => void;     // V-switcher → Versions
  onShare?: () => void;            // share / export
  scriptTitle?: string;            // override breadcrumb
  continuity?: number | null;      // override the ring (null/undefined → hidden)
  versionLabel?: string;           // override the V-switcher label
};

const RING_R = 10;
const RING_C = 2 * Math.PI * RING_R;

const CSS = `
.sxtb{--bg:#14161c;--bg2:#101216;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--cream:#F4EEE0;--text:#E7E3D8;--mut:#9aa1ab;--faint:#6b727d;--green:#57b368;--blue:#5b8def;--violet:#9b8cf0;height:56px;flex:0 0 56px;display:flex;align-items:center;gap:14px;padding:0 16px;background:linear-gradient(180deg,var(--bg),var(--bg2));border-bottom:1px solid var(--hair);position:relative;z-index:5;font-family:var(--sx-body)}
.sxtb *{box-sizing:border-box;margin:0;padding:0}
.sxtb svg{display:block}
.sxtb .ico{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sxtb .tl{display:flex;align-items:center;gap:11px;min-width:0}
.sxtb .tfm{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer;flex:none;box-shadow:0 4px 14px rgba(198,164,99,.3)}
.sxtb .wm{font-family:var(--sx-title);font-weight:700;font-size:15px;color:var(--cream);white-space:nowrap}
.sxtb .sep{color:var(--faint);font-size:13px}
.sxtb .crumb{font-size:13.5px;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
/* center search */
.sxtb .search{flex:1;max-width:560px;margin:0 auto;display:flex;align-items:center;gap:9px;height:36px;padding:0 12px;border-radius:999px;background:#0e1015;border:1px solid var(--hair);color:var(--mut);cursor:text}
.sxtb .search:hover{border-color:var(--hair2)}
.sxtb .search input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-size:13px;font-family:inherit}
.sxtb .search input::placeholder{color:var(--faint)}
.sxtb .kbd{font-size:10.5px;font-weight:700;color:var(--faint);border:1px solid var(--hair2);border-radius:6px;padding:2px 6px;flex:none}
.sxtb .sicon{width:34px;height:34px;border-radius:9px;border:1px solid var(--hair);display:grid;place-items:center;color:var(--mut);cursor:pointer;flex:none;background:#0e1015}
/* right cluster */
.sxtb .tr{display:flex;align-items:center;gap:11px;flex:none}
.sxtb .ring{position:relative;width:34px;height:34px;flex:none}
.sxtb .ring svg{position:absolute;inset:0;transform:rotate(-90deg)}
.sxtb .ring .pct{position:absolute;inset:0;display:grid;place-items:center;font-size:9px;font-weight:800;color:var(--green)}
.sxtb .vsw{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:999px;border:1px solid var(--hair2);background:#0e1015;color:var(--cream);font-size:12px;font-weight:700;cursor:pointer;flex:none}
.sxtb .vsw .car{color:var(--mut);font-size:10px}
.sxtb .avs{display:flex;align-items:center;flex:none}
.sxtb .av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:800;color:#fff;border:2px solid var(--bg);margin-inline-start:-7px}
.sxtb .av:first-child{margin-inline-start:0}
.sxtb .share{width:34px;height:34px;border-radius:9px;border:1px solid var(--hair);display:grid;place-items:center;color:var(--mut);cursor:pointer;flex:none;background:#0e1015}
.sxtb .share:hover,.sxtb .sicon:hover{color:var(--cream);border-color:var(--hair2)}
`;

const AV_COLORS = ['#5b8def', '#9b8cf0', '#57b368', '#e0a23b'];

export default function ScriptonTopBar(props: ScriptonTopBarProps) {
  const { t, dir } = useLocale();
  const router = useRouter();
  const data = useScriptonTopBar();
  const searchRef = useRef<HTMLInputElement>(null);
  const goBack = props.onBack || (() => router.push('/scripton'));
  const goVersions = props.onOpenVersions || (() => router.push('/scripton/revisions'));

  const crumb = props.scriptTitle ?? data.scriptTitle ?? '';
  const continuity = props.continuity !== undefined ? props.continuity : data.continuity;
  const versionLabel = props.versionLabel ?? data.versionLabel ?? '';
  const ringOn = showRing(continuity);
  const me = initials(data.userInitials);
  const vp = props.vp;
  const compact = vp !== 'desktop';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sxtb" dir={dir}>
        {/* Left cluster */}
        <div className="tl">
          <div className="tfm" onClick={goBack} title={t('Back to TFM')}>TFM</div>
          {!compact && <span className="wm">ScriptON</span>}
          {crumb ? <><span className="sep">›</span><span className="crumb">{crumb}</span></> : null}
        </div>

        {/* Center search (visual only — ⌘K palette deferred) */}
        {compact ? (
          <div className="sicon" style={{ marginInlineStart: 'auto' }} onClick={() => searchRef.current?.focus()} title={t('Search')}>
            <svg className="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          </div>
        ) : (
          <div className="search" onClick={() => searchRef.current?.focus()}>
            <svg className="ico" viewBox="0 0 24 24" style={{ flex: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input ref={searchRef} placeholder={t('Search scenes, characters, decisions — or run a command')} aria-label={t('Search')} />
            <span className="kbd">⌘K</span>
          </div>
        )}

        {/* Right cluster */}
        <div className="tr">
          {ringOn && (
            <div className="ring" title={t('Continuity')}>
              <svg viewBox="0 0 34 34">
                <circle cx="17" cy="17" r={RING_R} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="3" />
                <circle cx="17" cy="17" r={RING_R} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={ringOffset(continuity as number, RING_C)} />
              </svg>
              <span className="pct">{Math.round(continuity as number)}</span>
            </div>
          )}
          {versionLabel && !(vp === 'mobile') && (
            <button className="vsw" onClick={goVersions} title={t('Versions')}>{versionLabel}<span className="car">▾</span></button>
          )}
          {!(vp === 'mobile') && (
            <div className="avs"><span className="av" style={{ background: AV_COLORS[0] }}>{me}</span></div>
          )}
          <div className="share" onClick={props.onShare} title={t('Share / export')}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
          </div>
        </div>
      </div>
    </>
  );
}
