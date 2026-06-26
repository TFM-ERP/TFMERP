'use client';
import { useState, useEffect } from 'react';
import { productionApi } from '@/lib/api';

/** Reads the server-resolved ScriptON collaboration mode from the workspace payload.
 *  Defaults to 'team' on SSR/first paint (so Room never flickers away for team users);
 *  resolves the real value post-mount. */
export function useScriptonMode(): 'team' | 'solo' {
  const [mode, setMode] = useState<'team' | 'solo'>('team');
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r: any = await productionApi.scripton.workspace(); if (alive && (r.data?.mode === 'solo' || r.data?.mode === 'team')) setMode(r.data.mode); } catch { /* keep team */ }
    })();
    return () => { alive = false; };
  }, []);
  return mode;
}
