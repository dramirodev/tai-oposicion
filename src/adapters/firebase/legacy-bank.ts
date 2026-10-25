// Origen alternativo del banco: Firestore (comprimido) con caché local primero y revalidación en segundo plano.
// Desactivado por defecto: se activa con localStorage tai.bank = 'fs'. Si algo falla, quien llama recurre al JSON estático.
import { isFull } from '../legacy/access.js';

const DB = 'tai-bank', ST = 'f';
interface Entry { h: string; text: string }
let metaP: Promise<Record<string, string> | null> | undefined;

export const bankEnabled = (): boolean => { try { return localStorage.getItem('tai.bank') === 'fs'; } catch { return false; } };

function idb(): Promise<IDBDatabase> {
  return new Promise((ok, no) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}
async function getEntry(name: string): Promise<Entry | undefined> {
  try { const db = await idb(); return await new Promise(ok => { const q = db.transaction(ST).objectStore(ST).get(name); q.onsuccess = () => ok(q.result); q.onerror = () => ok(undefined); }); } catch { return undefined; }
}
async function putEntry(name: string, e: Entry): Promise<void> {
  try { const db = await idb(); await new Promise<void>(ok => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(e, name); t.oncomplete = () => ok(); t.onerror = () => ok(); }); } catch { /* sin caché local: sigue funcionando */ }
}
export async function gunzip(z: Uint8Array): Promise<string> {
  const body = new Response(z as BodyInit).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(body).text();
}
/** Hashes del banco; se consulta una sola vez por sesión de la página. */
function remoteHashes(): Promise<Record<string, string> | null> {
  return (metaP ||= import('./legacy-sync.js').then(s => s.bankMeta()).then(m => m?.files || null).catch(() => null));
}
/** Descarga, descomprime y guarda un fichero. */
async function fetchFresh(name: string, h: string): Promise<string | null> {
  const z = await (await import('./legacy-sync.js')).bankFile(name); if (!z) return null;
  const text = await gunzip(z); await putEntry(name, { h, text }); return text;
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
      remoteHashes().then(m => { if (m && m[name] && m[name] !== local.h) return fetchFresh(name, m[name]); }).catch(() => {});
      return JSON.parse(local.text) as T;
    }
    const m = await remoteHashes(); if (!m || !m[name]) return null;
    const text = await fetchFresh(name, m[name]);
    return text ? JSON.parse(text) as T : null;
  } catch { return null; }
}
/** Solo para tests. */
export const _reset = (): void => { metaP = undefined; };
