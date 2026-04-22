import type { DocumentRecord } from '../types';

const DB_NAME = 'plaintext';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

let dbPromise: Promise<IDBDatabase> | null = null;

function resetDb(db?: IDBDatabase): void {
  if (db) {
    db.onclose = null;
    db.onversionchange = null;
  }
  dbPromise = null;
}

function wrapRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'));
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => resetDb();
      db.onversionchange = () => {
        resetDb(db);
        db.close();
      };
      resolve(db);
    };
    req.onerror = () => {
      resetDb();
      reject(req.error ?? new Error('Failed to open IndexedDB.'));
    };
    req.onblocked = () => {
      resetDb();
      reject(new Error('IndexedDB upgrade blocked.'));
    };
  });
  return dbPromise;
}

function isValidRecord(value: unknown): value is DocumentRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.text === 'string' &&
    typeof r.updatedAt === 'number' &&
    typeof r.sourceTabId === 'string' &&
    typeof r.saveSequence === 'number'
  );
}

export async function loadRecord(id: string): Promise<DocumentRecord | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const record = await wrapRequest(tx.objectStore(STORE_NAME).get(id));
  if (!isValidRecord(record)) return null;
  return {
    id,
    text: record.text,
    updatedAt: record.updatedAt,
    sourceTabId: record.sourceTabId,
    saveSequence: record.saveSequence,
  };
}

export async function saveRecord(record: DocumentRecord): Promise<DocumentRecord> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await wrapRequest(store.put(record));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
  return record;
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await wrapRequest(store.delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

export async function listRecords(): Promise<DocumentRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const records = await wrapRequest(tx.objectStore(STORE_NAME).getAll());
  if (!Array.isArray(records)) return [];
  return records.filter(isValidRecord);
}
