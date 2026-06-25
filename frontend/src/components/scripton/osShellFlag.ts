'use client';
import { useState, useEffect } from 'react';

export type ShellFlag = 'new' | 'old';
// ROLLOUT (Step 1): the new OS is the HARD DEFAULT for everyone — no per-user opt-in.
// Every /scripton entry resolves to 'new' unless localStorage explicitly holds 'old',
// which is the instant escape-hatch/fallback to the legacy views (kept, not deleted).
export const OS_SHELL_DEFAULT: ShellFlag = 'new';
export const SHELL_FLAG_KEY = 'scripon.osShell';

/** Resolves the ScriptON shell flag. Returns OS_SHELL_DEFAULT ('new') on SSR + first
 *  render (no hydration mismatch); post-mount, only an explicit 'old' (or 'new')
 *  localStorage override changes it — 'old' is the fallback escape hatch. */
export function useScriptonShellFlag(): ShellFlag {
  const [flag, setFlag] = useState<ShellFlag>(OS_SHELL_DEFAULT);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SHELL_FLAG_KEY);
      if (v === 'new' || v === 'old') setFlag(v);
    } catch { /* ignore */ }
  }, []);
  return flag;
}
