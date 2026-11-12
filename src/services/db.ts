/**
 * Persistência local do XFLUX.
 * No instalador Windows/Tauri usa SQLite em AppData; no modo navegador mantém IndexedDB.
 * Na primeira inicialização desktop importa os registros antigos uma única vez, sem apagar a origem.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';

const DB_NAME = 'xflux';
const DB_VERSION = 3;
export type StoreName = 'media' | 'categories' | 'history' | 'usage' | 'conversations' | 'captions' | 'pairings' | 'plans' | 'posts';
const STORES: StoreName[] = ['media', 'categories', 'history', 'usage', 'conversations', 'captions', 'pairings', 'plans', 'posts'];

let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
      req.onblocked = () => console.warn('XFLUX: feche as outras abas para concluir a atualização do banco.');
    });
  }
  return dbPromise;
}

let nativeReady: Promise<void> | null = null;
async function ensureNativeDatabase(): Promise<void> {
  if (!isTauri()) return;
  if (!nativeReady) {
    nativeReady = (async () => {
      await invoke('local_db_init');
      const legacy = await open();
      const records: { store: string; id: string; payload: unknown }[] = [];
      for (const store of STORES) {
        const values = await new Promise<unknown[]>((resolve, reject) => {
          const req = legacy.transaction(store, 'readonly').objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result as unknown[]);
          req.onerror = () => reject(req.error);
        });
        for (const value of values) {
          const id = value && typeof value === 'object' && 'id' in value ? String((value as {id: unknown}).id) : '';
          if (id) records.push({ store, id, payload: value });
        }
      }
      const keyValues = await new Promise<{key:string;payload:unknown}[]>((resolve, reject) => {
        const items: {key:string;payload:unknown}[] = [];
        const req = legacy.transaction('kv', 'readonly').objectStore('kv').openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            try {
              const payload = JSON.parse(JSON.stringify(cursor.value));
              if (payload && typeof payload === 'object' && Object.keys(payload as object).length === 0) { cursor.continue(); return; }
              items.push({ key: String(cursor.key), payload });
            } catch { /* handles de diretório do navegador não são serializáveis; serão escolhidos novamente no desktop */ }
            cursor.continue();
          } else resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
      await invoke('local_db_import_legacy', { records, keyValues });
    })().catch((error) => { nativeReady = null; throw error; });
  }
  return nativeReady;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (isTauri()) {
    await ensureNativeDatabase();
    throw new Error('Operação IndexedDB não suportada no modo desktop.');
  }
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
  if (isTauri()) { await ensureNativeDatabase(); await invoke('local_db_put', { store, value }); return; }
  await run(store, 'readwrite', (s) => s.put(value));
}
export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  if (isTauri()) { await ensureNativeDatabase(); return invoke<T[]>('local_db_get_all', { store }); }
  return run<T[]>(store, 'readonly', (s) => s.getAll());
}
export async function dbDelete(store: StoreName, id: string): Promise<void> {
  if (isTauri()) { await ensureNativeDatabase(); await invoke('local_db_delete', { store, id }); return; }
  await run(store, 'readwrite', (s) => s.delete(id));
}
export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (isTauri()) { await ensureNativeDatabase(); await invoke('local_kv_set', { key, value }); return; }
  await runKv('readwrite', (s) => s.put(value, key));
}
export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (isTauri()) { await ensureNativeDatabase(); return invoke<T | null>('local_kv_get', { key }).then((v) => v ?? undefined); }
  return runKv<T | undefined>('readonly', (s) => s.get(key));
}
function runKv<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction('kv', mode).objectStore('kv'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/** Grava vários registros em uma transação atômica. */
export async function dbPutMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return;
  if (isTauri()) { await ensureNativeDatabase(); await invoke('local_db_put_many', { store, values }); return; }
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    values.forEach((v) => tx.objectStore(store).put(v));
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export async function dbDeleteMany(store: StoreName, ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (isTauri()) { await ensureNativeDatabase(); await invoke('local_db_delete_many', { store, ids }); return; }
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    ids.forEach((id) => tx.objectStore(store).delete(id));
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
