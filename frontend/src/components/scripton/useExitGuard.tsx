'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';

type GuardOpts = { dirty?: () => boolean; title?: string; body?: string; seconds?: number; exitLabel?: string };

/* Click-outside / close guard: confirm before exit, then a 10s armed window
   (click Confirm again to leave now, or wait/Keep editing to stay). */
export function useExitGuard(onExit: () => void, opts: GuardOpts = {}) {
  const seconds = opts.seconds ?? 10;
  const [phase, setPhase] = useState<'idle' | 'ask' | 'armed'>('idle');
  const [left, setLeft] = useState(seconds);
  const timer = useRef<any>(null);
  const stop = useCallback(() => { if (timer.current) { clearInterval(timer.current); timer.current = null; } }, []);
  useEffect(() => stop, [stop]);

  const requestClose = useCallback(() => {
    if (opts.dirty && !opts.dirty()) { onExit(); return; }
    setPhase('ask'); setLeft(seconds);
  }, [onExit, opts, seconds]);

  const stay = useCallback(() => { stop(); setLeft(seconds); setPhase('idle'); }, [stop, seconds]);
  const exitNow = useCallback(() => { stop(); setPhase('idle'); setLeft(seconds); onExit(); }, [stop, seconds, onExit]);
  const arm = useCallback(() => {
    setPhase('armed'); setLeft(seconds); stop();
    timer.current = setInterval(() => setLeft((n) => { if (n <= 1) { stop(); setPhase('idle'); return seconds; } return n - 1; }), 1000);
  }, [stop, seconds]);

  const T = { card: '#14161c', cream: '#F4ECD8', mut: '#A9A28F', hair: 'rgba(255,255,255,.14)', red: '#d9885f' };
  const btn: React.CSSProperties = { borderRadius: 9, padding: '8px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  const guard = phase === 'idle' ? null : (
    <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 2147483000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,7,10,.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: 20 }}>
      <div style={{ width: 'min(440px,94vw)', background: T.card, border: '1px solid rgba(198,164,99,.3)', borderRadius: 16, padding: '22px 22px 18px', boxShadow: '0 30px 80px rgba(0,0,0,.6)', fontFamily: 'var(--sx-body)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.cream }}>{opts.title || 'Leave without saving?'}</div>
        <div style={{ fontSize: 13, color: T.mut, marginTop: 8, lineHeight: 1.55 }}>{opts.body || 'Work you have not applied or saved will be lost.'}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 18 }}>
          <button onClick={stay} style={{ ...btn, background: 'transparent', color: T.mut, border: '1px solid ' + T.hair, fontWeight: 600 }}>Keep editing</button>
          {phase === 'ask'
            ? <button onClick={arm} style={{ ...btn, background: 'rgba(217,136,95,.16)', color: T.red, border: '1px solid rgba(217,136,95,.5)' }}>{opts.exitLabel || 'Exit'}</button>
            : <button onClick={exitNow} style={{ ...btn, background: 'rgba(217,136,95,.16)', color: T.red, border: '1px solid rgba(217,136,95,.5)', fontWeight: 800 }}>Confirm exit ({left})</button>}
        </div>
        {phase === 'armed' ? <div style={{ fontSize: 11, color: T.mut, marginTop: 10, textAlign: 'right' }}>Click Confirm exit again to leave now. Stays open if you wait {left}s.</div> : null}
      </div>
    </div>
  );

  return { requestClose, guard, active: phase !== 'idle' };
}
