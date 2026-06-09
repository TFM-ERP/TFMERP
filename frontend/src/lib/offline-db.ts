// IndexedDB-backed offline write queue for the mobile PWA.
// Stores write operations made while offline so they can be replayed on reconnection.
// Because the backend uses cuid() string primary keys, we mint a collision-safe id
// CLIENT-SIDE and reuse it as the record id, making every sync idempotent.

const DB_NAME = 'tfm-offline';
const STORE = 'queue';
const VERSION = 1;

export type QueueKind = 'pettyTxn' | 'location' | 'scoutSubmission' | 'scriptAnnotation';

export interface QueueItem {
  id: string;                 // client cuid — also used as the server record id (idempotent retries)
  kind: QueueKind;
  payload: any;               // pettyTxn: { floatId, data } | location: { projectId, data } | scoutSubmission: { assignmentId, data } | scriptAnnotation: { data }
  label: string;              // human summary for the queue UI
  status: 'pending' | 'error';
  error?: string;
  createdAt: number;
}

// cuid-style id, safe to generate offline. (Prisma id columns are plain Strings — format isn't validated.)
let counter = Math.floor(Math.random() * 1e6);
export function cuidLike(): string {
  counter = (counter + 1) % 1e9;
  const t = Date.now().toString(36);
  const c = counter.toString(36).padStart(4, '0');
  const r = Math.random().toString(36).slice(2, 8);
  return `c${t}${c}${r}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
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

export const enqueue = (item: QueueItem) => run<void>('readwrite', s => s.put(item));
export const updateItem = (item: QueueItem) => run<void>('readwrite', s => s.put(item));
export const dequeue = (id: string) => run<void>('readwrite', s => s.delete(id));
export async function allQueued(): Promise<QueueItem[]> {
  const items = await run<QueueItem[]>('readonly', s => s.getAll()).catch(() => []);
  return (items || []).sort((a, b) => a.createdAt - b.createdAt);
}
