'use client';
import { useCallback, useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';

const KEY = 'scripon.projectId';
const WSKEY = 'scripon.ws';

function readLS(k: string): string | null { if (typeof window === 'undefined') return null; try { return window.localStorage.getItem(k); } catch { return null; } }
function writeLS(k: string, v: string | null) { if (typeof window === 'undefined') return; try { if (v) window.localStorage.setItem(k, v); else window.localStorage.removeItem(k); } catch { /* */ } }

// ScripON is STANDALONE. Every screen binds to the hidden "ScripON Library" workspace — never to a production
// project. You only touch a real project when you explicitly Promote (or Import into) one. The workspace id is
// cached in a module var + localStorage so the synchronous pickScriponProject() can return it without a fetch.
let _wsId: string | null = readLS(WSKEY);

export function getScriponWorkspaceId(): string | null { return _wsId || (_wsId = readLS(WSKEY)); }
export function setScriponWorkspaceId(id: string | null) { _wsId = id || null; writeLS(WSKEY, id); if (id) writeLS(KEY, id); }

// Kept for back-compat with any caller; now always the Library workspace.
export function getSelectedProjectId(): string | null { return getScriponWorkspaceId() || readLS(KEY); }
export function setSelectedProjectId(id: string | null) { writeLS(KEY, id); }

// Authoritative async resolve of the Library workspace id (and cache it). Use where you can await — e.g. the build flow.
export async function resolveScriponProjectId(): Promise<string | null> {
  try {
    const w: any = await productionApi.scripton.development.workspace();
    const id = w && w.data && w.data.id ? w.data.id : null;
    if (id) setScriponWorkspaceId(id);
    return id || getScriponWorkspaceId();
  } catch { return getScriponWorkspaceId(); }
}

// Drop-in for the old list[0]/persisted pick: ScripON always resolves to the Library workspace.
// Returns null only on a cold cache (workspace not yet known) so callers wait instead of binding to a random project.
export function pickScriponProject(list: any): any {
  const arr = Array.isArray(list) ? list : [];
  const ws = getScriponWorkspaceId();
  if (ws) { const hit = arr.find((p: any) => p && p.id === ws); return hit || { id: ws, name: 'ScripON Library' }; }
  return null;
}

export type ScriponProject = { id: string; name?: string; title?: string };

export function useScriponProject() {
  const [projects, setProjects] = useState<ScriponProject[]>([]);
  const [selectedId, setSelId] = useState<string | null>(getScriponWorkspaceId());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const id = await resolveScriponProjectId();
      setSelId(id);
      setProjects(id ? [{ id, name: 'ScripON Library' }] : []);
    } catch { setProjects([]); setSelId(getScriponWorkspaceId()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ScripON's binding is fixed to the Library workspace — switching to a production project is intentionally a no-op.
  const select = useCallback((_id: string | null) => { /* fixed to the ScripON Library workspace */ }, []);

  return { projects, selectedId, select, loading, reload };
}
