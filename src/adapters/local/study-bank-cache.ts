import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DATABASE = 'tai-bank';
const STORE = 'f';

export interface CachedStudyBankFile { hash: string; content: string }
interface StudyBankCacheSchema extends DBSchema { f: { key: string; value: CachedStudyBankFile } }

let database: Promise<IDBPDatabase<StudyBankCacheSchema>> | undefined;

function openCache(): Promise<IDBPDatabase<StudyBankCacheSchema>> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('sin indexedDB'));
  if (database) return database;
  const connection = openDB<StudyBankCacheSchema>(DATABASE, 1, {
    upgrade(openDatabase) {
      if (!openDatabase.objectStoreNames.contains(STORE)) openDatabase.createObjectStore(STORE);
    },
    blocked() {
      try { dispatchEvent(new Event('tai-storage-blocked')); } catch {}
    },
    blocking() {
      void connection.then(openDatabase => openDatabase.close());
      if (database === connection) database = undefined;
    },
    terminated() {
      if (database === connection) database = undefined;
    },
  }).catch(error => {
    if (database === connection) database = undefined;
    throw error;
  });
  database = connection;
  return connection;
}

export async function readCachedStudyBankFile(name: string): Promise<CachedStudyBankFile | undefined> {
  try { return await (await openCache()).get(STORE, name); } catch { return undefined; }
}

export async function cacheStudyBankFile(name: string, file: CachedStudyBankFile): Promise<void> {
  try { await (await openCache()).put(STORE, file, name); } catch { /* La aplicación conserva el fallback HTTP si la caché no está disponible. */ }
}
