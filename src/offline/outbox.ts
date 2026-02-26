// src/offline/outbox.ts
export type OutboxOp =
  | "insert"
  | "upsert"
  | "update"
  | "delete"
  | "rpc";

export type OutboxItem = {
  id: string;                 // unique id (uuid string)
  dedupeKey: string;          // used to merge/replace actions (ex: "census:2026-02-24|point123")
  op: OutboxOp;

  // target
  table?: string;             // for table ops
  rpcName?: string;           // for rpc ops

  // data
  payload?: any;              // insert/upsert/update data OR rpc params
  filters?: any;              // update/delete filters (serializable)
  options?: any;              // e.g., onConflict for upsert

  createdAt: number;
  updatedAt: number;

  tries: number;              // retry count
  lastError?: string | null;  // last error message
};

const DB_NAME = "ame_offline";
const STORE = "outbox";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("dedupeKey", "dedupeKey", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function newId() {
  // simple uuid v4-ish; ok for client ids
  return crypto.randomUUID();
}

/**
 * Put with "dedupe" behavior: if another item with same dedupeKey exists,
 * replace it with the newest (so we keep only the latest intent).
 */
export async function outboxUpsertDedupe(item: Omit<OutboxItem, "id" | "createdAt" | "updatedAt" | "tries"> & { id?: string }) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const idx = store.index("dedupeKey");

  // find existing items by dedupeKey
  const existing: OutboxItem[] = await new Promise((resolve, reject) => {
    const req = idx.getAll(item.dedupeKey);
    req.onsuccess = () => resolve(req.result as OutboxItem[]);
    req.onerror = () => reject(req.error);
  });

  const now = Date.now();

  // delete all existing with same dedupeKey (keep only newest)
  for (const ex of existing) {
    store.delete(ex.id);
  }

  const full: OutboxItem = {
    id: item.id ?? newId(),
    dedupeKey: item.dedupeKey,
    op: item.op,
    table: item.table,
    rpcName: item.rpcName,
    payload: item.payload,
    filters: item.filters,
    options: item.options,
    createdAt: now,
    updatedAt: now,
    tries: 0,
    lastError: null,
  };

  store.put(full);
  await txDone(tx);
  db.close();
  return full.id;
}

export async function outboxList(limit = 100): Promise<OutboxItem[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const idx = store.index("updatedAt");

  // read all then slice; small store expected
  const all: OutboxItem[] = await new Promise((resolve, reject) => {
    const req = idx.getAll();
    req.onsuccess = () => resolve(req.result as OutboxItem[]);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  all.sort((a, b) => a.updatedAt - b.updatedAt);
  return all.slice(0, limit);
}

export async function outboxCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);

  const count = await new Promise<number>((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();
  return count;
}

export async function outboxDelete(id: string) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function outboxMarkError(id: string, message: string) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  const item: OutboxItem | undefined = await new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as OutboxItem | undefined);
    req.onerror = () => reject(req.error);
  });

  if (item) {
    item.tries = (item.tries ?? 0) + 1;
    item.lastError = message;
    item.updatedAt = Date.now();
    store.put(item);
  }

  await txDone(tx);
  db.close();
}