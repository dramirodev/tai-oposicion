import { beforeEach, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { gzipSync } from 'node:zlib';
import { pack, plan } from '../scripts/publish_bank.mjs';

const remote = vi.hoisted(() => ({ meta: null, files: {}, calls: { meta: 0, file: 0 } }));
vi.mock('../src/adapters/firebase/study-bank-source.js', () => ({
  bankMeta: async () => { remote.calls.meta++; return remote.canRead ? remote.meta : null; },
  bankFile: async n => { remote.calls.file++; return remote.canRead ? remote.files[n] || null : null; },
}));
let bank;
const publish = (name, obj) => { const p = pack(Buffer.from(JSON.stringify(obj))); remote.files[name] = new Uint8Array(p.z); remote.meta = { v: 1, files: { ...(remote.meta?.files || {}), [name]: p.h } }; };
beforeEach(async () => {
  vi.resetModules(); localStorage.clear(); indexedDB = new IDBFactory();
  remote.meta = null; remote.files = {}; remote.calls = { meta: 0, file: 0 }; remote.canRead = true;
  bank = await import('../src/adapters/firebase/study-bank-cache-source.js');
  bank.configureStudyBankAccessGate(() => true);
});
it('en desarrollo está desactivado por defecto: devuelve null y no toca Firestore', async () => {
  publish('T1.01', [{ i: 'a' }]);
  expect(await bank.loadStudyBank('T1.01')).toBeNull();
  expect(remote.calls).toEqual({ meta: 0, file: 0 });
});
it('en producción está activo por defecto y tai.bank = static lo desactiva', async () => {
  vi.stubEnv('PROD', true);
  try {
    publish('T1.01', [{ i: 'a' }]);
    expect(await bank.loadStudyBank('T1.01')).toEqual([{ i: 'a' }]);
    localStorage.setItem('tai.bank', 'static');
    expect(bank.studyBankCacheEnabled()).toBe(false);
    expect(await bank.loadStudyBank('T1.01')).toBeNull();
  } finally { vi.unstubAllEnvs(); }
});
it('en producción un invitado no lee el banco aunque esté activo', async () => {
  vi.stubEnv('PROD', true);
  try {
    publish('T1.01', [{ i: 'a' }]);
    bank.configureStudyBankAccessGate(() => false);
    expect(await bank.loadStudyBank('T1.01')).toBeNull();
    expect(remote.calls).toEqual({ meta: 0, file: 0 });
  } finally { vi.unstubAllEnvs(); }
});
it('descarga y descomprime el fichero; la segunda vez sale de la copia local', async () => {
  localStorage.setItem('tai.bank', 'fs'); publish('T1.01', [{ i: 'a', q: 'ñandú' }]);
  expect(await bank.loadStudyBank('T1.01')).toEqual([{ i: 'a', q: 'ñandú' }]);
  expect(remote.calls.file).toBe(1);
  expect(await bank.loadStudyBank('T1.01')).toEqual([{ i: 'a', q: 'ñandú' }]);
  expect(remote.calls.file).toBe(1);
});
it('conserva la base de caché publicada y su almacén al usar idb', async () => {
  localStorage.setItem('tai.bank', 'fs'); publish('T1.01', [{ i: 'a' }]);
  await bank.loadStudyBank('T1.01');
  const request = indexedDB.open('tai-bank');
  const database = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  expect(database.version).toBe(1);
  expect([...database.objectStoreNames]).toEqual(['f']);
  database.close();
});
it('con copia local responde al instante y se actualiza detrás si cambia el hash', async () => {
  localStorage.setItem('tai.bank', 'fs'); publish('T1.01', [{ i: 'viejo' }]);
  await bank.loadStudyBank('T1.01');
  publish('T1.01', [{ i: 'nuevo' }]); bank.resetStudyBankCacheSourceForTests();
  expect(await bank.loadStudyBank('T1.01')).toEqual([{ i: 'viejo' }]);
  await vi.waitFor(() => expect(remote.calls.file).toBe(2));
  await new Promise(r => setTimeout(r, 50));
  expect(await bank.loadStudyBank('T1.01')).toEqual([{ i: 'nuevo' }]);
});
it('si Firestore no tiene el fichero o falla, devuelve null para usar el JSON estático', async () => {
  localStorage.setItem('tai.bank', 'fs');
  expect(await bank.loadStudyBank('T9.99')).toBeNull();
  remote.meta = { v: 1, files: { 'T1.01': 'x' } };
  expect(await bank.loadStudyBank('T1.01')).toBeNull();
});
it('sin acceso no lee ni siquiera una copia remota guardada en este dispositivo', async () => {
  localStorage.setItem('tai.bank', 'fs'); publish('T1.01', [{ i: 'a' }]);
  expect(await bank.loadStudyBank('T1.01')).toEqual([{ i: 'a' }]);
  bank.configureStudyBankAccessGate(() => false);
  const callsBeforeDeniedRead = { ...remote.calls };
  expect(await bank.loadStudyBank('T1.01')).toBeNull();
  expect(remote.calls).toEqual(callsBeforeDeniedRead);
});
it('el script de publicación solo sube lo que cambió y borra lo que sobra', () => {
  expect(plan({ a: '1', b: '2' }, { a: '1', b: '9', c: '3' })).toEqual({ up: ['b'], del: ['c'] });
  const p = pack(Buffer.from('{"x":1}')); expect(p.h).toHaveLength(16);
  expect(pack(Buffer.from('{"x":1}')).h).toBe(p.h);
});
