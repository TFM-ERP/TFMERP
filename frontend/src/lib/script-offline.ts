// SYS-13 · D7 — per-revision offline cache for the Script Hub.
// Stores the PDF bytes + parsed scenes + annotation payloads so a script opens and renders
// on set with no connectivity. Separate IndexedDB store from the write-queue (offline-db.ts).

const DB_NAME = 'tfm-script-cache';
const STORE = 'revisions';
const VERSION = 1;

export interface CachedRevision {
  revisionId: string;
  documentId?: string;
  revision: any;          // { id, revisionLabel, colorCode, pdfUrl, pageCount, scenes }
  pdf?: ArrayBuffer;      // raw PDF bytes for offline pdfjs render
  annotations: any[];
  layers: any[];
  cachedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'revisionId' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  }));
}

export async function cacheRevision(entry: Omit<CachedRevision, 'cachedAt'>): Promise<void> {
  await run<void>('readwrite', s => s.put({ ...entry, cachedAt: Date.now() })).catch(() => {});
}
export async function getCachedRevision(revisionId: string): Promise<CachedRevision | null> {
  return run<CachedRevision>('readonly', s => s.get(revisionId)).catch(() => null as any).then(r => r || null);
}
export async function updateCachedAnnotations(revisionId: string, annotations: any[]): Promise<void> {
  const cur = await getCachedRevision(revisionId);
  if (cur) await run<void>('readwrite', s => s.put({ ...cur, annotations, cachedAt: Date.now() })).catch(() => {});
}

/** Merge a partial update (annotations / layers / revision) into the cached entry. */
export async function mergeCachedRevision(revisionId: string, patch: Partial<CachedRevision>): Promise<void> {
  const cur = await getCachedRevision(revisionId);
  if (cur) await run<void>('readwrite', s => s.put({ ...cur, ...patch, cachedAt: Date.now() })).catch(() => {});
}

/** Fetch the PDF bytes for caching (object-URL-free, works with the API auth header). */
export async function fetchPdfBytes(absUrl: string): Promise<ArrayBuffer | undefined> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tfm_token') : null;
    const res = await fetch(absUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return undefined;
    return await res.arrayBuffer();
  } catch { return undefined; }
}
