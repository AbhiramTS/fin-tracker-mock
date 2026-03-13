// ─────────────────────────────────────────────────────────────────────────────
//  db/indexedDB.ts  –  Low-level IndexedDB wrapper
//  All application code talks to Repositories, not this file directly.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME    = "fintracker_v3";
const DB_VERSION = 1;

interface StoreDef { keyPath: string; indexes: string[]; }

export const STORE_DEFS: Record<string, StoreDef> = {
  accounts:          { keyPath: "id",      indexes: [] },
  expenses:          { keyPath: "id",      indexes: ["date", "accountId", "category"] },
  incomes:           { keyPath: "id",      indexes: ["accountId"] },
  recurringPayments: { keyPath: "id",      indexes: ["nextDate", "accountId"] },
  loans:             { keyPath: "id",      indexes: ["accountId"] },
  creditCards:       { keyPath: "id",      indexes: [] },
  investments:       { keyPath: "id",      indexes: ["type"] },
  syncQueue:         { keyPath: "queueId", indexes: ["entity"] },
};

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const [name, cfg] of Object.entries(STORE_DEFS)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: cfg.keyPath });
          cfg.indexes.forEach((idx) => store.createIndex(idx, idx, { unique: false }));
        }
      }
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db); };
    req.onerror   = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

function r2p<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (e) => resolve((e.target as IDBRequest<T>).result);
    request.onerror   = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  return r2p((await openDB()).transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function dbPut<T>(store: string, record: T): Promise<IDBValidKey> {
  return r2p((await openDB()).transaction(store, "readwrite").objectStore(store).put(record));
}

export async function dbDelete(store: string, key: IDBValidKey): Promise<undefined> {
  return r2p((await openDB()).transaction(store, "readwrite").objectStore(store).delete(key) as IDBRequest<undefined>);
}
