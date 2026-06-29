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
  centerTitle?: { title: string; sub: string }; // Develop (node 69:2): centered page title + sub in the freed search slot — search is suppressed
  noSearch?: boolean;              // suppress the search entirely (e.g. Develop portrait, where the title is a body header)
  scriptId?: string;               // the screen's CURRENT script — drives the continuity ring + V chip from its kernel versions (real data; hidden when none)
  scriptScoped?: boolean;          // default true. false on non-script screens (Home, Slate, Builds list) → hide the whole script cluster: crumb + continuity ring + version chip (Figma 142:2 / 145:2)
};

const RING_R = 6; // mini ring inside the green continuity pill (node 3:11)
const RING_C = 2 * Math.PI * RING_R;

const CSS = `
.sxtb{--bg:#14161c;--bg2:#101216;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--cream:#F4EEE0;--text:#E7E3D8;--mut:#9aa1ab;--faint:#6b727d;--green:#57b368;--blue:#5b8def;--violet:#9b8cf0;height:56px;flex:0 0 56px;display:flex;align-items:center;gap:14px;padding:0 16px;background:linear-gradient(180deg,var(--bg),var(--bg2));border-bottom:1px solid var(--hair);position:relative;z-index:5;font-family:var(--sx-body)}
.sxtb *{box-sizing:border-box;margin:0;padding:0}
.sxtb svg{display:block}
.sxtb .sxtb-ico{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sxtb .sxtb-tl{display:flex;align-items:center;gap:11px;min-width:0}
.sxtb .sxtb-tfm{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer;flex:none;box-shadow:0 4px 14px rgba(198,164,99,.3)}
.sxtb .sxtb-wm{font-family:var(--sx-title);font-weight:700;font-size:15px;color:var(--cream);white-space:nowrap}
.sxtb .sxtb-sep{color:var(--faint);font-size:13px}
.sxtb .sxtb-crumb{font-size:13.5px;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
/* center page title (Develop — node 69:2: replaces the search slot; Fraunces SemiBold 16 over Rubik 11) */
.sxtb .sxtb-ctr{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;pointer-events:none;max-width:56%}
.sxtb .sxtb-ctr .sxtb-ct-title{font-family:var(--sx-title);font-weight:600;font-size:16px;line-height:1;color:var(--cream);white-space:nowrap}
.sxtb .sxtb-ctr .sxtb-ct-sub{font-family:var(--sx-body);font-weight:400;font-size:11px;line-height:1;color:var(--faint);white-space:nowrap}
/* center search */
.sxtb .sxtb-search{flex:1;max-width:560px;margin:0 auto;display:flex;align-items:center;gap:9px;height:36px;padding:0 12px;border-radius:999px;background:#0e1015;border:1px solid var(--hair);color:var(--mut);cursor:text}
.sxtb .sxtb-search:hover{border-color:var(--hair2)}
.sxtb .sxtb-search input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-size:13px;font-family:inherit}
.sxtb .sxtb-search input::placeholder{color:var(--faint)}
.sxtb .sxtb-kbd{font-size:10.5px;font-weight:700;color:var(--faint);border:1px solid var(--hair2);border-radius:6px;padding:2px 6px;flex:none}
.sxtb .sxtb-sicon{width:34px;height:34px;border-radius:9px;border:1px solid var(--hair);display:grid;place-items:center;color:var(--mut);cursor:pointer;flex:none;background:#0e1015}
/* right cluster — node 6:80 / 1:2 (3:11–3:24): green continuity pill · boxed V ▾ · avatar stack · share */
.sxtb .sxtb-tr{display:flex;align-items:center;gap:11px;flex:none}
.sxtb .sxtb-ring{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 11px;border-radius:999px;background:rgba(87,179,104,.09);border:1px solid rgba(87,179,104,.28);flex:none}
.sxtb .sxtb-ring svg{width:16px;height:16px;flex:none;transform:rotate(-90deg)}
.sxtb .sxtb-ring .sxtb-pct{font-size:12px;font-weight:600;color:var(--green);line-height:1}
.sxtb .sxtb-vsw{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 11px;border-radius:8px;border:1px solid rgba(198,164,99,.3);background:rgba(198,164,99,.13);color:var(--gold2);font-size:11.5px;font-weight:600;cursor:pointer;flex:none}
.sxtb .sxtb-vsw .sxtb-car{color:var(--gold2);font-size:10px}
.sxtb .sxtb-avs{display:flex;align-items:center;flex:none}
.sxtb .sxtb-av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:9px;font-weight:600;color:#fff;border:2px solid var(--bg);margin-inline-start:-8px}
.sxtb .sxtb-av:first-child{margin-inline-start:0}
.sxtb .sxtb-share{width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.09);display:grid;place-items:center;color:var(--mut);cursor:pointer;flex:none;background:rgba(255,255,255,.04)}
.sxtb .sxtb-share:hover,.sxtb .sxtb-sicon:hover{color:var(--cream);border-color:var(--hair2)}
`;

const AV_COLORS = ['#5b8def', '#9b8cf0', '#57b368', '#e0a23b'];

export default function ScriptonTopBar(props: ScriptonTopBarProps) {
  const { t, dir } = useLocale();
  const router = useRouter();
  const data = useScriptonTopBar(props.scriptId);
  const searchRef = useRef<HTMLInputElement>(null);
  const goBack = props.onBack || (() => router.push('/scripton'));
  const goVersions = props.onOpenVersions || (() => router.push('/scripton/revisions'));

  // Non-script-scoped screens (Home, Slate, Builds list) describe no single script → hide the whole
  // script cluster (crumb + continuity ring + version chip). Search · avatars · share stay. (Figma 142:2/145:2)
  const scriptScoped = props.scriptScoped !== false;
  const crumb = scriptScoped ? (props.scriptTitle ?? data.scriptTitle ?? '') : '';
  const continuity = props.continuity !== undefined ? props.continuity : data.continuity;
  const versionLabel = scriptScoped ? (props.versionLabel ?? data.versionLabel ?? '') : '';
  const ringOn = scriptScoped && showRing(continuity);
  const me = initials(data.userInitials);
  const vp = props.vp;
  const compact = vp !== 'desktop';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sxtb" dir={dir}>
        {/* Left cluster */}
        <div className="sxtb-tl">
          <div className="sxtb-tfm" onClick={goBack} title={t('Back to TFM')}>TFM</div>
          {!compact && <span className="sxtb-wm">ScriptON</span>}
          {crumb ? <><span className="sxtb-sep">›</span><span className="sxtb-crumb">{crumb}</span></> : null}
        </div>

        {/* Center: page title (Develop) replaces the search slot when centerTitle is set; otherwise the ⌘K search (visual only) */}
        {props.centerTitle ? (
          <>
            <div className="sxtb-ctr">
              <span className="sxtb-ct-title">{t(props.centerTitle.title)}</span>
              <span className="sxtb-ct-sub">{t(props.centerTitle.sub)}</span>
            </div>
            <div style={{ flex: 1 }} />
          </>
        ) : props.noSearch ? (
          <div style={{ flex: 1 }} />
        ) : compact ? (
          <div className="sxtb-sicon" style={{ marginInlineStart: 'auto' }} onClick={() => searchRef.current?.focus()} title={t('Search')}>
            <svg className="sxtb-ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          </div>
        ) : (
          <div className="sxtb-search" onClick={() => searchRef.current?.focus()}>
            <svg className="sxtb-ico" viewBox="0 0 24 24" style={{ flex: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input ref={searchRef} placeholder={t('Search scenes, characters, decisions — or run a command')} aria-label={t('Search')} />
            <span className="sxtb-kbd">⌘K</span>
          </div>
        )}

        {/* Right cluster */}
        <div className="sxtb-tr">
          {ringOn && (
            <div className="sxtb-ring" title={t('Continuity')}>
              <svg viewBox="0 0 16 16">
                <circle cx="8" cy="8" r={RING_R} fill="none" stroke="rgba(87,179,104,.25)" strokeWidth="2" />
                <circle cx="8" cy="8" r={RING_R} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={ringOffset(continuity as number, RING_C)} />
              </svg>
              <span className="sxtb-pct">{Math.round(continuity as number)}%</span>
            </div>
          )}
          {versionLabel && !(vp === 'mobile') && (
            <button className="sxtb-vsw" onClick={goVersions} title={t('Versions')}>{versionLabel}<span className="sxtb-car">▾</span></button>
          )}
          {!(vp === 'mobile') && (
            <div className="sxtb-avs"><span className="sxtb-av" style={{ background: AV_COLORS[0] }}>{me}</span></div>
          )}
          <div className="sxtb-share" onClick={props.onShare} title={t('Share / export')}>
            <svg className="sxtb-ico" viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
          </div>
        </div>
      </div>
    </>
  );
}
