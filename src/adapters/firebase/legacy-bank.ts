// Origen alternativo del banco: Firestore (comprimido) con caché local primero y revalidación en segundo plano.
// Desactivado por defecto: se activa con localStorage tai.bank = 'fs'. Si algo falla, quien llama recurre al JSON estático.
import { isFull } from '../legacy/access.js';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB = 'tai-bank', ST = 'f';
interface Entry { h: string; text: string }
interface BankCacheSchema extends DBSchema { f: { key: string; value: Entry } }
let metaP: Promise<Record<string, string> | null> | undefined;
let database: Promise<IDBPDatabase<BankCacheSchema>> | undefined;

export const bankEnabled = (): boolean => { try { return localStorage.getItem('tai.bank') === 'fs'; } catch { return false; } };

function idb(): Promise<IDBPDatabase<BankCacheSchema>> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('sin indexedDB'));
  if (database) return database;
  const connection = openDB<BankCacheSchema>(DB, 1, {
    upgrade(openDatabase) {
      if (!openDatabase.objectStoreNames.contains(ST)) openDatabase.createObjectStore(ST);
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
async function getEntry(name: string): Promise<Entry | undefined> {
  try { return await (await idb()).get(ST, name); } catch { return undefined; }
}
async function putEntry(name: string, event: Entry): Promise<void> {
  try { await (await idb()).put(ST, event, name); } catch { /* sin caché local: sigue funcionando */ }
}
export async function gunzip(bytes: Uint8Array): Promise<string> {
  const body = new Response(bytes as BodyInit).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(body).text();
}
/** Hashes del banco; se consulta una sola vez por sesión de la página. */
function remoteHashes(): Promise<Record<string, string> | null> {
  return (metaP ||= import('./study-bank-source.js').then(source => source.bankMeta()).then(bankMetadata => bankMetadata?.files || null).catch(() => null));
}
/** Descarga, descomprime y guarda un fichero. */
async function fetchFresh(name: string, html: string): Promise<string | null> {
  const bytes = await (await import('./study-bank-source.js')).bankFile(name); if (!bytes) return null;
  const text = await gunzip(bytes); await putEntry(name, { h: html, text }); return text;
}
/**
 * Devuelve el JSON ya interpretado, o null si hay que usar la vía estática.
 * Con copia local: responde al instante y, si el hash remoto cambió, la actualiza detrás para la próxima vez.
 */
export async function loadBank<T>(name: string): Promise<T | null> {
  if (!bankEnabled() || !isFull() || typeof DecompressionStream === 'undefined' || typeof indexedDB === 'undefined') return null;
  try {
    const local = await getEntry(name);
    if (local) {
      remoteHashes().then(metadata => { if (metadata && metadata[name] && metadata[name] !== local.h) return fetchFresh(name, metadata[name]); }).catch(() => {});
      return JSON.parse(local.text) as T;
    }
    const metadata = await remoteHashes(); if (!metadata || !metadata[name]) return null;
    const text = await fetchFresh(name, metadata[name]);
    return text ? JSON.parse(text) as T : null;
  } catch { return null; }
}
/** Solo para tests. */
export const _reset = (): void => { metaP = undefined; };
