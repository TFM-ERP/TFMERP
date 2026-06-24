'use client';

/**
 * SYS-mobile — role/permission access for the /m app.
 * Reuses the system RBAC (permissionsApi.me) + the signed-in profile (accountApi.profile),
 * exposing `can(moduleKey)` so the shell shows only the tabs/screens a role may use and each
 * screen can guard itself. Mirrors the desktop PERM_ALIAS model. Server APIs stay the source
 * of truth — this is the UI layer of "who sees what".
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { accountApi, permissionsApi } from './api';

// Each /m module → the RBAC key it needs. 'home' = always visible (no gate).
const ALIAS: Record<string, string> = {
  home: 'home', me: 'home', settings: 'home', search: 'home',
  comms: 'home', meetings: 'home',            // broadly available, like the desktop app
  callsheet: 'production', schedule: 'production', dood: 'production', recce: 'production',
  transport: 'production', travel: 'production', accommodation: 'production', script: 'production', casting: 'production',
};

type Access = {
  ready: boolean;
  role: string;
  name: string;
  perms: Record<string, number>;
  can: (moduleKey: string, level?: number) => boolean;
};

const Ctx = createContext<Access>({ ready: false, role: '', name: '', perms: {}, can: () => true });

export function MobileAccessProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Access>({ ready: false, role: '', name: '', perms: {}, can: () => true });

  useEffect(() => {
    let alive = true;
    Promise.all([
      accountApi.profile().catch(() => ({ data: {} as any })),
      permissionsApi.me().catch(() => ({ data: {} as any })),
    ]).then(([p, pm]) => {
      if (!alive) return;
      const perms: Record<string, number> = pm.data?.permissions || {};
      const role: string = p.data?.role || '';
      const name: string = p.data?.preferredName || p.data?.fullName || '';
      const isAdmin = /ADMIN/i.test(role);
      const can = (moduleKey: string, level = 1) => {
        if (isAdmin) return true;
        const k = ALIAS[moduleKey] || moduleKey;
        return k === 'home' || (perms[k] ?? 0) >= level;
      };
      setState({ ready: true, role, name, perms, can });
    });
    return () => { alive = false; };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useMobileAccess = () => useContext(Ctx);
