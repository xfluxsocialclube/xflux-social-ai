/**
 * Banco de dados local (IndexedDB) — persistência real no navegador, sem dependências.
 * Guarda apenas metadados e referências; os arquivos de mídia ficam numa pasta do computador.
 * Será substituído/espelhado por SQLite quando o app migrar para Tauri (fase futura).
 */
const DB_NAME = 'xflux';
const DB_VERSION = 3; // v2: conversas do assistente de IA · v3: legendas, associações, planos e publicações planejadas
export type StoreName = 'media' | 'categories' | 'history' | 'usage' | 'conversations' | 'captions' | 'pairings' | 'plans' | 'posts';

let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        (['media', 'categories', 'history', 'usage', 'conversations', 'captions', 'pairings', 'plans', 'posts'] as StoreName[]).forEach((s) => {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        // Se outra aba abrir uma versão mais nova do banco, libera a conexão para não bloquear a atualização.
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
      // Se houver outra aba antiga do XFLUX aberta, a atualização aguarda até que ela seja fechada.
      req.onblocked = () => console.warn('XFLUX: feche as outras abas do aplicativo para concluir a atualização do banco de dados.');
    });
  }
  return dbPromise;
}
async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const dbPut = <T>(store: StoreName, value: T) => run(store, 'readwrite', (s) => s.put(value));
export const dbGetAll = <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll());
export const dbDelete = (store: StoreName, id: string) => run(store, 'readwrite', (s) => s.delete(id));
export const kvSet = <T>(key: string, value: T) => run('kv', 'readwrite', (s) => s.put(value, key));
export const kvGet = <T>(key: string) => run<T | undefined>('kv', 'readonly', (s) => s.get(key));

/** Grava vários registros em UMA transação (importações grandes sem travar nem gravar pela metade). */
export async function dbPutMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return;
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    values.forEach((v) => os.put(v));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
/** Remove vários registros em UMA transação. */
export async function dbDeleteMany(store: StoreName, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    ids.forEach((id) => os.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
