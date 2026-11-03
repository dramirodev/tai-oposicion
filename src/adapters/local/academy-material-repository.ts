import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AcademyMaterialPdfCopy } from '../../core/domain/academy-material-copy.js';
import type { AcademyMaterialRepository } from '../../core/ports/AcademyMaterialRepository.js';

interface StoredAcademyPdf extends AcademyMaterialPdfCopy {
  scope: string;
}
interface StoredAcademyPdfRecord extends StoredAcademyPdf { key: string }

interface AcademyMaterialSchema extends DBSchema {
  pdfs: {
    key: string;
    value: StoredAcademyPdfRecord;
    indexes: { 'scope-topic': [string, string] };
  };
}

export function createAcademyMaterialRepository(databaseName = 'tai-academy-materials'): AcademyMaterialRepository {
  let database: Promise<IDBPDatabase<AcademyMaterialSchema>> | undefined;
  const open = () => {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB no está disponible.'));
    if (database) return database;
    const connection = openDB<AcademyMaterialSchema>(databaseName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pdfs')) {
          const store = db.createObjectStore('pdfs', { keyPath: 'key' });
          store.createIndex('scope-topic', ['scope', 'topicId']);
        }
      },
      blocking() { void connection.then(db => db.close()); if (database === connection) database = undefined; },
      terminated() { if (database === connection) database = undefined; },
    }).catch(error => { if (database === connection) database = undefined; throw error; });
    database = connection;
    return connection;
  };
  const key = (scope: string, topicId: string, materialPath: string, sourceHash: string) => JSON.stringify([scope, topicId, materialPath, sourceHash]);
  const toCopy = (entry: StoredAcademyPdfRecord): AcademyMaterialPdfCopy => ({
    topicId:entry.topicId, materialPath:entry.materialPath, sourceHash:entry.sourceHash,
    name:entry.name, mimeType:entry.mimeType, sizeBytes:entry.sizeBytes, importedAt:entry.importedAt, pdfBytes:entry.pdfBytes,
  });
  return {
    async get(scope, topicId, materialPath, sourceHash) {
      const entries = await (await open()).getAllFromIndex('pdfs', 'scope-topic', [scope, topicId]);
      const found = entries.find(entry => entry.materialPath === materialPath && entry.sourceHash === sourceHash);
      return found ? toCopy(found) : undefined;
    },
    async list(scope, topicId) {
      const entries = await (await open()).getAllFromIndex('pdfs', 'scope-topic', [scope, topicId]);
      return entries.map(toCopy);
    },
    async save(scope, copy) { await (await open()).put('pdfs', { ...copy, scope, key:key(scope, copy.topicId, copy.materialPath, copy.sourceHash) }); },
    async remove(scope, topicId, materialPath, sourceHash) {
      const connection = await open();
      const transaction = connection.transaction('pdfs', 'readwrite');
      const entries = await transaction.store.index('scope-topic').getAll([scope, topicId]);
      const match = entries.find(entry => entry.materialPath === materialPath && entry.sourceHash === sourceHash);
      if (match) await transaction.store.delete(match.key);
      await transaction.done;
    },
  };
}

export const localAcademyMaterialRepository = createAcademyMaterialRepository();
