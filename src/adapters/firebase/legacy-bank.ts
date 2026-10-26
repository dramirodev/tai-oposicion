// Origen alternativo del banco: Firestore (comprimido) con caché local primero y revalidación en segundo plano.
// Desactivado por defecto: se activa con localStorage tai.bank = 'fs'. Si algo falla, quien llama recurre al JSON estático.
import { isFull } from '../legacy/access.js';

const DB = 'tai-bank', ST = 'f';
interface Entry { h: string; text: string }
let metaP: Promise<Record<string, string> | null> | undefined;

export const bankEnabled = (): boolean => { try { return localStorage.getItem('tai.bank') === 'fs'; } catch { return false; } };

function idb(): Promise<IDBDatabase> {
  return new Promise((ok, no) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(ST); request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
}
async function getEntry(name: string): Promise<Entry | undefined> {
  try { const db = await idb(); return await new Promise(ok => { const request = db.transaction(ST).objectStore(ST).get(name); request.onsuccess = () => ok(request.result); request.onerror = () => ok(undefined); }); } catch { return undefined; }
}
async function putEntry(name: string, event: Entry): Promise<void> {
  try { const db = await idb(); await new Promise<void>(ok => { const transaction = db.transaction(ST, 'readwrite'); transaction.objectStore(ST).put(event, name); transaction.oncomplete = () => ok(); transaction.onerror = () => ok(); }); } catch { /* sin caché local: sigue funcionando */ }
}
export async function gunzip(bytes: Uint8Array): Promise<string> {
  const body = new Response(bytes as BodyInit).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(body).text();
}
/** Hashes del banco; se consulta una sola vez por sesión de la página. */
function remoteHashes(): Promise<Record<string, string> | null> {
  return (metaP ||= import('./legacy-sync.js').then(state => state.bankMeta()).then(bankMetadata => bankMetadata?.files || null).catch(() => null));
}
/** Descarga, descomprime y guarda un fichero. */
async function fetchFresh(name: string, html: string): Promise<string | null> {
  const bytes = await (await import('./legacy-sync.js')).bankFile(name); if (!bytes) return null;
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
