'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { allQueued, enqueue, dequeue, updateItem, cuidLike, QueueItem } from './offline-db';
import { productionApi, scoutingApi } from './api';

// Replay one queued write against the live API.
async function pushItem(item: QueueItem): Promise<void> {
  if (item.kind === 'pettyTxn') {
    await productionApi.costing.addPettyTxn(item.payload.floatId, item.payload.data);
  } else if (item.kind === 'location') {
    await productionApi.locations.create(item.payload.projectId, item.payload.data);
  } else if (item.kind === 'scoutSubmission') {
    await scoutingApi.submit(item.payload.assignmentId, item.payload.data);
  } else if (item.kind === 'scriptAnnotation') {
    await productionApi.scriptAnnotations.create(item.payload.data); // clientId makes the re-send idempotent
  }
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Offline write queue for the Petty Cash + Locations modules.
 * - Online: callers post directly; this hook is just status.
 * - Offline: callers use queuePetty/queueLocation to persist to IndexedDB.
 * - On reconnection (window 'online' event) the queue flushes automatically.
 * - A CLOSED accounting period (HTTP 400) is a permanent business error: the item is
 *   marked 'error' and surfaced for manual attention rather than retried in a loop.
 */
export function useOfflineSync(onSynced?: () => void) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  const refresh = useCallback(async () => {
    const q = await allQueued();
    setPending(q.filter(i => i.status === 'pending').length);
    setErrors(q.filter(i => i.status === 'error'));
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    flushing.current = true; setSyncing(true);
    let didWork = false;
    const q = await allQueued();
    for (const item of q) {
      if (item.status === 'error') continue; // needs manual attention; don't auto-retry
      try {
        await pushItem(item);
        await dequeue(item.id);
        didWork = true;
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = e?.response?.data?.message || e?.message || 'Sync failed';
        if (status && status >= 400 && status < 500) {
          // Permanent business rejection (e.g. closed period) — flag, keep, stop retrying it.
          await updateItem({ ...item, status: 'error', error: msg });
        }
        // else network / 5xx → leave 'pending' to retry on the next reconnection
      }
    }
    await refresh();
    flushing.current = false; setSyncing(false);
    if (didWork) onSynced?.();
  }, [refresh, onSynced]);

  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    refresh();
    const goOnline = () => { setOnline(true); flush(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (typeof navigator !== 'undefined' && navigator.onLine) flush();
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [flush, refresh]);

  const queuePetty = useCallback(async (floatId: string, data: any, label: string) => {
    const id = cuidLike();
    await enqueue({ id, kind: 'pettyTxn', payload: { floatId, data: { ...data, clientId: id } }, label, status: 'pending', createdAt: Date.now() });
    await refresh();
    return id;
  }, [refresh]);

  const queueLocation = useCallback(async (projectId: string, data: any, label: string) => {
    const id = cuidLike();
    await enqueue({ id, kind: 'location', payload: { projectId, data: { ...data, clientId: id } }, label, status: 'pending', createdAt: Date.now() });
    await refresh();
    return id;
  }, [refresh]);

  const queueScoutSubmission = useCallback(async (assignmentId: string, data: any, label: string) => {
    const id = cuidLike();
    await enqueue({ id, kind: 'scoutSubmission', payload: { assignmentId, data: { ...data, clientId: id } }, label, status: 'pending', createdAt: Date.now() });
    await refresh();
    return id;
  }, [refresh]);

  const queueScriptAnnotation = useCallback(async (data: any, label: string) => {
    const id = cuidLike();
    await enqueue({ id, kind: 'scriptAnnotation', payload: { data: { ...data, clientId: id } }, label, status: 'pending', createdAt: Date.now() });
    await refresh();
    return id;
  }, [refresh]);

  const dismissError = useCallback(async (id: string) => { await dequeue(id); await refresh(); }, [refresh]);

  return { online, pending, errors, syncing, flush, refresh, queuePetty, queueLocation, queueScoutSubmission, queueScriptAnnotation, dismissError };
}
