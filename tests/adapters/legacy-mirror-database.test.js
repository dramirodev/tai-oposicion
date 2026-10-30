import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const DATABASE = 'tai-mirror';
const openNative = (version, upgrade) => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE, version);
  if (upgrade) request.onupgradeneeded = () => upgrade(request.result);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const deleteDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase(DATABASE);
  request.onsuccess = resolve;
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('database deletion remained blocked'));
});

afterEach(async () => {
  vi.resetModules();
  await deleteDatabase();
});

describe('legacy mirror IndexedDB', () => {
  it('reads values from the existing version 1 kv schema', async () => {
    const oldConnection = await openNative(1, database => database.createObjectStore('kv'));
    const tx = oldConnection.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(JSON.stringify({ stats: { q1: [1, 1, 100, -1, 0, 1, 0] }, sessions: [] }), 'state:guest');
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    oldConnection.close();

    const { recover } = await import('../../src/adapters/local/local-progress-store.js');
    expect(await recover()).toBe(true);
    const store = await import('../../src/adapters/local/local-progress-store.js');
    expect(store.rec('q1')).toEqual([1, 1, 100, -1, 0, 1, 0, 0, 0, 0]);
  });

  it('closes its connection when a later schema upgrade requests it', async () => {
    const { openLegacyMirrorDatabase } = await import('../../src/adapters/local/database.js');
    await openLegacyMirrorDatabase();

    const upgraded = await openNative(2, database => database.createObjectStore('metadata'));
    expect(upgraded.version).toBe(2);
    upgraded.close();
  });
});
