import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface LegacyMirrorSchema extends DBSchema {
  kv: {
    key: string;
    value: string;
  };
}

const LEGACY_MIRROR_DATABASE = 'tai-mirror';
let legacyMirrorConnection: Promise<IDBPDatabase<LegacyMirrorSchema>> | undefined;

/** Opens the existing backup database without changing its name, version, or object store. */
export function openLegacyMirrorDatabase(): Promise<IDBPDatabase<LegacyMirrorSchema>> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('sin indexedDB'));
  if (legacyMirrorConnection) return legacyMirrorConnection;

  const connection = openDB<LegacyMirrorSchema>(LEGACY_MIRROR_DATABASE, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('kv')) database.createObjectStore('kv');
    },
    blocked() {
      try { dispatchEvent(new Event('tai-storage-blocked')); } catch {}
    },
    blocking() {
      void connection.then(database => database.close());
      if (legacyMirrorConnection === connection) legacyMirrorConnection = undefined;
    },
    terminated() {
      if (legacyMirrorConnection === connection) legacyMirrorConnection = undefined;
    },
  }).catch(error => {
    if (legacyMirrorConnection === connection) legacyMirrorConnection = undefined;
    throw error;
  });
  legacyMirrorConnection = connection;
  return connection;
}
