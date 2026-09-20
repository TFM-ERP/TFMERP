'use client';

/**
 * Desktop permission check — `useCan(moduleKey, minLevel)`.
 *
 * There is no client-side permission check on the desktop dashboard today: every button
 * renders for everyone and the server 403s on click. This is new groundwork, built first
 * because the invoice lifecycle's Void/Delete actions must not even render for a user who
 * lacks `finance:3` — the design calls for hiding them outright, not disabling them.
 *
 * Existing precedent considered:
 * - `lib/mobileAccess.tsx` wraps `permissionsApi` in a `can(moduleKey)` check for the /m
 *   app, via a Context provider (`MobileAccessProvider`) that also bypasses the check for
 *   admin roles and merges in `accountApi.profile()` for the role string. That provider is
 *   mounted only in `app/m/layout.tsx` — it has no desktop equivalent.
 * - `(dashboard)/layout.tsx` (the desktop shell) already calls `permissionsApi.me()` once
 *   on mount for the sidebar's own module visibility, and caches the result to
 *   `localStorage['tfm_perms']` as a side effect. That is local `useState` inside the
 *   layout component, though — not exposed through a context or hook — so there is no
 *   existing "auth context" this hook can read from without depending on a private
 *   implementation detail of one component. Reusing the `tfm_perms` cache as a seed to
 *   skip a loading flash was considered and rejected: a stale seed showing `can: true`
 *   just before the real fetch resolves to `false` is exactly the "flash the action then
 *   withdraw it" bug the design calls out — so this hook only ever reports `can` once it
 *   has its own confirmed answer.
 *
 * DIVERGENCE from mobileAccess.tsx: no Context/Provider. Like `lib/i18n.ts`'s
 * `useLocale()` ("No React context/provider is required... any client component can opt
 * in without wrapping the tree"), permissions here are held in a module-level singleton:
 * the first `useCan()` call anywhere in the tree fires one `permissionsApi.me()` request,
 * every other concurrent `useCan()` call (same page or not) shares that in-flight promise
 * and its resolved value, and nothing needs to be mounted at layout level for this to
 * work. That also means this hook needs no changes to `(dashboard)/layout.tsx`, which is
 * out of scope for this batch. No admin bypass is added either — unlike the mobile
 * version, the desktop sidebar's own `canSee()` in `(dashboard)/layout.tsx` does a plain
 * numeric comparison against `perms[key]` with no admin special-case, trusting that an
 * admin role's row in the permission matrix already grants full levels; `useCan` follows
 * that same, already-established desktop convention.
 *
 * Nothing here reads `localStorage` or `window` during render — only inside `useEffect`
 * — per this codebase's hydration-mismatch history.
 */
import { useEffect, useState } from 'react';
import { permissionsApi } from './api';

export type Permissions = Record<string, number>;

// Module-level singleton: shared across every `useCan()` consumer for the life of the tab.
let cache: Permissions | null = null;
let inflight: Promise<Permissions> | null = null;
const listeners = new Set<(perms: Permissions) => void>();

function loadPermissions(): Promise<Permissions> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = permissionsApi
    .me()
    .then((r) => (r.data?.permissions || {}) as Permissions)
    .catch(() => {
      // Network/auth failure: resolve to "no permissions" rather than leaving every
      // gated consumer stuck on `loading: true` forever. This hides every gated action,
      // which is the safe default — the server enforces the real check regardless.
      return {} as Permissions;
    })
    .then((perms) => {
      cache = perms;
      inflight = null;
      listeners.forEach((fn) => fn(perms));
      return perms;
    });

  return inflight;
}

export interface UseCanResult {
  /** True once permissions are known AND the user holds at least `minLevel` on `moduleKey`. */
  can: boolean;
  /**
   * True until the first permission fetch resolves. Per the design: render nothing while
   * this is true, rather than showing an action and then withdrawing it.
   */
  loading: boolean;
}

/**
 * `useCan('finance', 3)` — does the current user hold at least level 3 on the `finance`
 * module? Levels follow the existing RBAC matrix (0 = none .. 3 = full, per
 * `permissions/me`'s response); `minLevel` defaults to 1 ("has any access at all").
 *
 * Synchronous after the initial load: once `loading` is false, `can` is the final answer
 * for the rest of the session — permissions don't change without a re-login, so there is
 * no polling or re-fetching. Every `useCan()` call anywhere in the tree shares the same
 * one underlying network request; mounting it in ten components costs one fetch, not ten.
 */
export function useCan(moduleKey: string, minLevel = 1): UseCanResult {
  const [perms, setPerms] = useState<Permissions | null>(cache);

  useEffect(() => {
    if (cache) {
      // Another consumer already resolved this; nothing to subscribe to.
      setPerms(cache);
      return;
    }

    let alive = true;
    const onLoad = (p: Permissions) => {
      if (alive) setPerms(p);
    };
    listeners.add(onLoad);

    loadPermissions();

    return () => {
      alive = false;
      listeners.delete(onLoad);
    };
  }, []);

  const loading = perms === null;
  const can = !loading && (perms![moduleKey] ?? 0) >= minLevel;
  return { can, loading };
}

/**
 * Forces the next `useCan()` mount to re-fetch instead of reusing the cached answer.
 * Not used anywhere yet in this batch — provided for a future login/logout flow to clear
 * a stale permission set from a previous session without a full page reload.
 */
export function resetPermissionsCache(): void {
  cache = null;
  inflight = null;
}
