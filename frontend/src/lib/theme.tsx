'use client';

/**
 * SYS-UX Phase 0 — theme runtime (ADDITIVE; not wired into any page yet).
 * Resolves the effective theme from the org policy ∩ the user's preference and
 * applies data-theme / data-contrast / data-density to the document root.
 * Mirrors the Prisma models OrgThemePolicy + UserPreference and the governance demo.
 *
 * Wiring happens later (Settings · Appearance + Admin · Theme policy) behind a flag —
 * importing this module on its own has no effect until <ThemeProvider> is mounted.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeId = 'graphite' | 'studio' | 'ink' | 'slate' | 'aurora' | 'midnight';
export type Density = 'comfortable' | 'compact';
export type PolicyMode = 'open' | 'restricted' | 'forced';

export interface ThemeMeta { id: ThemeId; name: string; mode: 'dark' | 'light' | 'reading'; }
export const THEMES: ThemeMeta[] = [
  { id: 'graphite', name: 'Graphite & Gold', mode: 'dark' },
  { id: 'studio', name: 'Studio Light', mode: 'light' },
  { id: 'ink', name: 'Ink & Paper', mode: 'reading' },
  { id: 'slate', name: 'Slate Pro', mode: 'dark' },
  { id: 'aurora', name: 'Aurora Glass', mode: 'dark' },
  { id: 'midnight', name: 'Midnight AAA', mode: 'dark' },
];

export interface OrgThemePolicy {
  mode: PolicyMode;
  allowedThemeIds: ThemeId[];
  forcedThemeId: ThemeId | null;
  defaultThemeId: ThemeId;
}
export interface UserPreference {
  themeId: ThemeId;
  readingMode: boolean;
  highContrast: boolean;
  density: Density;
}

export const DEFAULT_POLICY: OrgThemePolicy = {
  mode: 'restricted',
  allowedThemeIds: ['graphite', 'studio', 'ink'],
  forcedThemeId: null,
  defaultThemeId: 'graphite',
};
export const DEFAULT_PREF: UserPreference = {
  themeId: 'graphite',
  readingMode: true,
  highContrast: false,
  density: 'comfortable',
};

/** Effective base theme = policy resolved against the user's pick. */
export function resolveTheme(policy: OrgThemePolicy, pref: UserPreference): ThemeId {
  if (policy.mode === 'forced' && policy.forcedThemeId) return policy.forcedThemeId;
  if (policy.mode === 'restricted') {
    return policy.allowedThemeIds.includes(pref.themeId)
      ? pref.themeId
      : (policy.allowedThemeIds[0] ?? policy.defaultThemeId);
  }
  return pref.themeId; // open
}

/** Whether the user is permitted to select a given theme under the current policy. */
export function canUseTheme(policy: OrgThemePolicy, id: ThemeId): boolean {
  if (policy.mode === 'forced') return id === policy.forcedThemeId;
  if (policy.mode === 'restricted') return policy.allowedThemeIds.includes(id);
  return true;
}

interface ThemeCtx {
  theme: ThemeId;
  pref: UserPreference;
  policy: OrgThemePolicy;
  setPref: (patch: Partial<UserPreference>) => void;
  setPolicy: (patch: Partial<OrgThemePolicy>) => void;
  canUse: (id: ThemeId) => boolean;
}
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({
  children,
  initialPolicy = DEFAULT_POLICY,
  initialPref = DEFAULT_PREF,
}: {
  children: ReactNode;
  initialPolicy?: OrgThemePolicy;
  initialPref?: UserPreference;
}) {
  const [policy, setPol] = useState<OrgThemePolicy>(initialPolicy);
  const [pref, setP] = useState<UserPreference>(initialPref);
  const theme = resolveTheme(policy, pref);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-contrast', pref.highContrast ? 'aaa' : 'no');
    root.setAttribute('data-density', pref.density);
  }, [theme, pref.highContrast, pref.density]);

  const setPref = (patch: Partial<UserPreference>) => setP((s) => ({ ...s, ...patch }));
  const setPolicy = (patch: Partial<OrgThemePolicy>) => setPol((s) => ({ ...s, ...patch }));
  const canUse = (id: ThemeId) => canUseTheme(policy, id);

  return (
    <Ctx.Provider value={{ theme, pref, policy, setPref, setPolicy, canUse }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used within <ThemeProvider>');
  return c;
}
