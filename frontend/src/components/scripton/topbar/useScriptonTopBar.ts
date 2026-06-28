'use client';
import { useState, useEffect } from 'react';
import { productionApi } from '@/lib/api';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import { activeVersion, type TopVersion } from './scripton-topbar.logic';

export type TopBarData = {
  scriptTitle: string | null;   // breadcrumb (the bound script, e.g. عنترة)
  continuity: number | null;    // active version's continuity %, or null → ring hidden (no fake number)
  versionLabel: string | null;  // e.g. "V3", or null
  versions: TopVersion[];       // for the V-switcher dropdown
  userInitials: string;         // from tfm_user, for the avatar
};

/** Self-resolves the top bar's data the same way the screens do: the bound ScriptON
 *  script (breadcrumb) + its versions (active label + continuity for the ring). Reuses
 *  the versions endpoint; degrades to nulls (the bar hides what it lacks). */
export function useScriptonTopBar(scriptId?: string): TopBarData {
  const [data, setData] = useState<TopBarData>({ scriptTitle: null, continuity: null, versionLabel: null, versions: [], userInitials: '' });
  useEffect(() => {
    let alive = true;
    // The bar's data is not on any screen's critical path — defer it off the mount
    // tick so it never competes with the screen's own load / first interactions
    // (the screens duplicate projects.list/script.list; piling on at mount starved
    // their pass-refetch). The header fills in a beat later, which is fine.
    const timer = setTimeout(() => { void run(); }, 400);
    const run = async () => {
      let userInitials = '';
      try { const u = JSON.parse(window.localStorage.getItem('tfm_user') || '{}'); userInitials = String(u.firstName || u.name || u.email || ''); } catch { /* */ }
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const pid = pickScriptonProject(projects)?.id;
        if (!pid) { if (alive) setData((d) => ({ ...d, userInitials })); return; }
        const dr: any = await productionApi.script.list(pid);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0];
        if (!doc) { if (alive) setData((d) => ({ ...d, userInitials })); return; }
        // Breadcrumb = the screen's ACTIVE script: the passed scriptId's title when it's a workspace
        // doc (so Write/Compare show their own script, not always docs[0]); otherwise the bound doc.
        const crumbDoc = (scriptId && docs.find((d: any) => d.id === scriptId)) || doc;
        // Ring + V resolve from the SAME source Develop uses: the workspace's rendered build chain
        // (a build's linked kernel script, selected server-side by "has a rendered pass"), NOT the
        // bound draft doc (which has no renders). So for عنترة every screen shows the identical %·V,
        // and hides uniformly when nothing rendered. The breadcrumb stays the bound doc's title.
        let versions: TopVersion[] = [];
        let continuity: number | null = null;
        let versionLabel: string | null = null;
        try {
          const tv: any = await productionApi.scripton.topVersion(pid, scriptId);
          versions = (tv.data?.versions || []).map((v: any) => ({ id: v.id, n: v.n, label: v.label, active: v.active, passId: v.passId, continuity: v.continuity }));
          const av = activeVersion(versions);
          continuity = typeof tv.data?.continuity === 'number' ? tv.data.continuity : (av && typeof av.continuity === 'number' ? av.continuity : null);
          versionLabel = tv.data?.versionLabel || av?.label || null;
        } catch { /* no rendered version → ring/V stay hidden */ }
        if (alive) setData({ scriptTitle: crumbDoc.title || null, continuity, versionLabel, versions, userInitials });
      } catch { if (alive) setData((d) => ({ ...d, userInitials })); }
    };
    return () => { alive = false; clearTimeout(timer); };
  }, [scriptId]);
  return data;
}
