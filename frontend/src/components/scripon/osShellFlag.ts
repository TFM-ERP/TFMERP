'use client';
import { useState, useEffect } from 'react';

export type ShellFlag = 'new' | 'old';
export const OS_SHELL_DEFAULT: ShellFlag = 'new';
export const SHELL_FLAG_KEY = 'scripon.osShell';

/** Resolves the ScripON shell flag. Returns OS_SHELL_DEFAULT on SSR + first render
 *  (no hydration mismatch); applies a localStorage override post-mount for QA. */
export function useScriponShellFlag(): ShellFlag {
  const [flag, setFlag] = useState<ShellFlag>(OS_SHELL_DEFAULT);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SHELL_FLAG_KEY);
      if (v === 'new' || v === 'old') setFlag(v);
    } catch { /* ignore */ }
  }, []);
  return flag;
}
