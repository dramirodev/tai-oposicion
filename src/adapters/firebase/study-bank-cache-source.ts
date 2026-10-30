// Fuente de Firestore con caché local; activa por defecto en producción y solo con acceso completo.
// Si algo falla, la composición recurre al JSON estático, que en producción solo conserva la muestra pública.
import { cacheStudyBankFile, readCachedStudyBankFile } from '../local/study-bank-cache.js';

let metaP: Promise<Record<string, string> | null> | undefined;
let hasBankAccess: () => boolean = () => false;

/** The app composition supplies the same access policy used by the interface. */
export function configureStudyBankAccessGate(canAccess: () => boolean): void {
  hasBankAccess = canAccess;
}

/** En producción el banco completo solo se sirve desde Firestore; `tai.bank` = 'fs' | 'static' fuerza una u otra fuente (desarrollo). */
export const studyBankCacheEnabled = (): boolean => {
  const production = !!import.meta.env?.PROD;
  try { const forced = localStorage.getItem('tai.bank'); return forced === 'fs' || (forced !== 'static' && production); } catch { return production; }
};

export async function decompressStudyBankFile(bytes: Uint8Array): Promise<string> {
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
  const text = await decompressStudyBankFile(bytes); await cacheStudyBankFile(name, { hash: html, content: text }); return text;
}
/**
 * Devuelve el JSON ya interpretado, o null si hay que usar la vía estática.
 * Con copia local: responde al instante y, si el hash remoto cambió, la actualiza detrás para la próxima vez.
 */
export async function loadStudyBank<T>(name: string): Promise<T | null> {
  if (!studyBankCacheEnabled() || !hasBankAccess() || typeof DecompressionStream === 'undefined' || typeof indexedDB === 'undefined') return null;
  try {
    const local = await readCachedStudyBankFile(name);
    if (local) {
      remoteHashes().then(metadata => { if (metadata && metadata[name] && metadata[name] !== local.hash) return fetchFresh(name, metadata[name]); }).catch(() => {});
      return JSON.parse(local.content) as T;
    }
    const metadata = await remoteHashes(); if (!metadata || !metadata[name]) return null;
    const text = await fetchFresh(name, metadata[name]);
    return text ? JSON.parse(text) as T : null;
  } catch { return null; }
}
/** Solo para tests. */
export const resetStudyBankCacheSourceForTests = (): void => { metaP = undefined; };
