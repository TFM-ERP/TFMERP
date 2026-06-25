'use client';
/** ScriptON Doctor — Command Palette (carbon-copy of design/command-palette.html). Workspace-wide ⌘K accelerator.
 *  Mounted once by the /scripon layout; opens on ⌘K / Ctrl-K or a 'scripon:cmdk' event. Namespaced `.sxk`. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n';

const CSS = `
.sxk{position:fixed;inset:0;z-index:120;font-family:var(--sx-body)}
.sxk *{box-sizing:border-box;margin:0;padding:0}
.sxk .scrim{position:absolute;inset:0;background:rgba(7,8,11,.66);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding-top:118px}
.sxk .palette{width:640px;max-width:94vw;background:linear-gradient(180deg,#191c23,#141720);border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 40px 100px -20px rgba(0,0,0,.85),0 0 0 1px rgba(198,164,99,.12);overflow:hidden;display:flex;flex-direction:column}
.sxk .palhead{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.sxk .si{color:#E6D2A2}.sxk .si svg{width:20px;height:20px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block}
.sxk .palq{flex:1;font-size:16px;color:#F4EEE0;font-weight:500;background:transparent;border:none;outline:none;font-family:inherit}
.sxk .palq::placeholder{color:#6b727d}
.sxk .esc{font-size:10px;font-weight:700;color:#6b727d;border:1px solid rgba(255,255,255,.07);border-radius:6px;padding:3px 7px}
.sxk .palbody{padding:8px;max-height:434px;overflow:auto}
.sxk .pgrp{font-size:10px;font-weight:700;letter-spacing:1px;color:#6b727d;padding:11px 12px 6px}
.sxk .prow{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;border:none;background:transparent;width:100%;text-align:start}
.sxk .prow:hover{background:#1d212a}
.sxk .pic{width:30px;height:30px;border-radius:8px;background:#22262f;display:grid;place-items:center;color:#9aa1ab;flex:none}.sxk .pic svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block}
.sxk .plb{flex:1;font-size:13.5px;color:#E8E6E0;font-weight:500}
.sxk .phint{font-size:11px;color:#6b727d;font-family:'Courier Prime',ui-monospace,monospace}
.sxk .prow.on{background:linear-gradient(90deg,rgba(198,164,99,.18),rgba(198,164,99,.06));box-shadow:inset 2px 0 0 #C6A463}
.sxk .prow.on .pic{background:linear-gradient(160deg,#E6D2A2,#C6A463);color:#1a1509}
.sxk .prow.on .plb{color:#F4EEE0;font-weight:600}
.sxk .palfoot{display:flex;align-items:center;gap:18px;padding:11px 18px;border-top:1px solid rgba(255,255,255,.07);font-size:11px;color:#6b727d}
.sxk .palfoot kbd{font-family:inherit;border:1px solid rgba(255,255,255,.07);border-radius:5px;padding:1px 6px;margin-inline-end:5px;color:#9aa1ab}
`;
const I = (d: React.ReactNode) => <svg viewBox="0 0 24 24">{d}</svg>;
type Cmd = { group: string; label: string; hint?: string; href: string; icon: React.ReactNode };

export default function ScriptOnCmdK() {
  const router = useRouter();
  const { dir, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const CMDS: Cmd[] = useMemo(() => [
    { group: t('DOCTOR ACTIONS'), label: t('Run coverage report'), hint: '↵', href: '/scripon/doctor', icon: I(<path d="M6 2h9l5 5v15H6z" />) },
    { group: t('DOCTOR ACTIONS'), label: t('Diagnose scenes'), href: '/scripon/doctor', icon: I(<path d="M3 12h4l2 6 4-14 2 8h6" />) },
    { group: t('DOCTOR ACTIONS'), label: t('Budget-fit rewrite'), href: '/scripon/schedule', icon: I(<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />) },
    { group: t('DOCTOR ACTIONS'), label: t('Compare revisions'), href: '/scripon/revisions', icon: I(<path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" />) },
    { group: t('NAVIGATE'), label: t('Dashboard (Home)'), hint: 'G H', href: '/scripon', icon: I(<path d="M3 11l9-8 9 8M5 10v10h14V10" />) },
    { group: t('NAVIGATE'), label: t('Script Library'), hint: 'G L', href: '/scripon/library', icon: I(<path d="M4 4h6v16H4zM14 4h6v16h-6z" />) },
    { group: t('NAVIGATE'), label: t('Script Reader'), hint: 'G R', href: '/scripon/reader', icon: I(<path d="M6 2h9l5 5v15H6z" />) },
    { group: t('NAVIGATE'), label: t('Breakdown'), href: '/scripon/breakdown', icon: I(<path d="M12 2l9 5-9 5-9-5z" />) },
    { group: t('NAVIGATE'), label: t('Schedule & Budget'), hint: 'G S', href: '/scripon/schedule', icon: I(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18" /></>) },
    { group: t('NAVIGATE'), label: t('Doctor'), href: '/scripon/doctor', icon: I(<path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" />) },
    { group: t('NAVIGATE'), label: t('Reports & Exports'), href: '/scripon/reports', icon: I(<path d="M3 3v18h18M7 14l3-3 3 3 5-6" />) },
    { group: t('NAVIGATE'), label: t('Revisions & Compare'), href: '/scripon/revisions', icon: I(<path d="M16 3l5 5-5 5M21 8H9" />) },
    { group: t('NAVIGATE'), label: t('Notes & Collaboration'), href: '/scripon/notes', icon: I(<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />) },
    { group: t('NAVIGATE'), label: t('Approvals & Sign-off'), href: '/scripon/approvals', icon: I(<path d="M9 11l3 3L22 4" />) },
    { group: t('NAVIGATE'), label: t('Settings & Governance'), href: '/scripon/settings', icon: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7 7 0 000-2l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L15 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L6.6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1L11 21h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4z" /></>) },
  ], [t]);

  const filtered = useMemo(() => { const s = q.trim().toLowerCase(); return s ? CMDS.filter((c) => c.label.toLowerCase().includes(s)) : CMDS; }, [q, CMDS]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); setQ(''); setIdx(0); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const onEvt = () => { setOpen(true); setQ(''); setIdx(0); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scripon:cmdk', onEvt as any);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scripon:cmdk', onEvt as any); };
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[idx]) go(filtered[idx].href); }
  };

  if (!open) return null;
  let lastGroup = '';
  return (
    <div className="sxk" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="scrim" onClick={() => setOpen(false)}>
        <div className="palette" onClick={(e) => e.stopPropagation()}>
          <div className="palhead">
            <span className="si">{I(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>)}</span>
            <input ref={inputRef} className="palq" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onInputKey} placeholder={t('Type a command or search…')} />
            <span className="esc">{t('ESC')}</span>
          </div>
          <div className="palbody">
            {filtered.length === 0 && <div className="pgrp">{t('No matches')}</div>}
            {filtered.map((c, i) => {
              const head = c.group !== lastGroup ? <div className="pgrp" key={'g' + i}>{c.group}</div> : null;
              lastGroup = c.group;
              return (<React.Fragment key={i}>{head}<button className={'prow' + (i === idx ? ' on' : '')} onMouseEnter={() => setIdx(i)} onClick={() => go(c.href)}><span className="pic">{c.icon}</span><span className="plb">{c.label}</span>{c.hint && <span className="phint">{c.hint}</span>}</button></React.Fragment>);
            })}
          </div>
          <div className="palfoot"><span><kbd>↑↓</kbd>{t('navigate')}</span><span><kbd>↵</kbd>{t('open')}</span><span><kbd>esc</kbd>{t('dismiss')}</span><span style={{ marginInlineStart: 'auto', color: '#E6D2A2' }}>{t('ScriptON Doctor')}</span></div>
        </div>
      </div>
    </div>
  );
}
