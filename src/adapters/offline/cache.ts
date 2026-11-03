// Verificación de CacheStorage: las cachés en memoria de los lectores no prueban uso sin red.
import { isStudyTopicId } from '../../core/domain/topic-id.js';
const OFFLINE_DATA_CACHE_NAME = 'tai-data', OFFLINE_VERIFICATION_KEY = 'tai.offline-verified';
type Index = { temas: { id: string }[] };
type CardIndex = { temas: Record<string, unknown> };
export interface OfflineState { complete: boolean; missing: string[]; total: number; completedAt: number | null }
type OfflineFileFetcher = (url: string, init?: RequestInit) => Promise<Response>;
let fetchOfflineFile: OfflineFileFetcher = (...request) => fetch(...request);
/** El banco completo ya no se sirve como JSON estático: la composición aporta la fuente autenticada. */
export function configureOfflineFileFetcher(fetcher: OfflineFileFetcher): void { fetchOfflineFile = fetcher; }
const getBaseFilesToCache =(bankIndex: Index) => ['data/index.json', 'data/meta.json', 'data/supuestos.json', 'cards/index.json', 'explanations/index.json', ...bankIndex.temas.map(topic => `data/${topic.id}.json`)];

/** Warms the browser/service-worker cache for question topics without blocking startup. */
export async function prefetchQuestionBank(bankIndex: Index): Promise<void> {
  const connection = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData || (typeof navigator !== 'undefined' && navigator.onLine === false) || typeof caches === 'undefined') return;
  try {
    const questionCache = await caches.open(OFFLINE_DATA_CACHE_NAME);
    const paths = bankIndex.temas.map(topic => `data/${topic.id}.json`);
    const cached = await Promise.all(paths.map(path => questionCache.match(path)));
    const missing = paths.filter((_, index) => !cached[index]);
    const worker = async () => {
      for (let path; (path = missing.shift());) {
        try {
          const response = await fetchOfflineFile(path);
          if (!response.ok) return;
          await questionCache.put(path, response); // la fuente autenticada no pasa por el service worker
        } catch {
          return;
        }
      }
    };
    await Promise.all([worker(), worker()]);
  } catch {
    // Prefetch is an optional startup optimization; the normal request path remains available.
  }
}

function isCardIndex(value: unknown): value is CardIndex {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && 'temas' in value && !!value.temas && typeof value.temas === 'object' && !Array.isArray(value.temas);
}
function getCardFiles(cardIndex: unknown): string[] {
  if (!isCardIndex(cardIndex)) throw new Error('Índice de tarjetas no válido');
  const topicIds = Object.keys(cardIndex.temas);
  if (!topicIds.length || topicIds.some(topicId => !isStudyTopicId(topicId))) throw new Error('Índice de tarjetas no válido');
  return topicIds.map(topicId => `cards/${topicId}.json`);
}
export async function inspectOffline(bankIndex: Index): Promise<OfflineState> {
  const requiredFiles = getBaseFilesToCache(bankIndex);
  if (typeof caches === 'undefined') return {complete:false, missing:requiredFiles, total:requiredFiles.length, completedAt:null};
  const offlineCache = await caches.open(OFFLINE_DATA_CACHE_NAME);
  const cardIndexResponse = await offlineCache.match('cards/index.json', {ignoreSearch:true});
  let validCards = false;
  if (cardIndexResponse?.ok) { try { requiredFiles.push(...getCardFiles(await cardIndexResponse.json())); validCards = true; } catch {} }
  const unavailable = new Set<string>();
  let next = 0;
  // Limit concurrent responseBody reads so inspecting the full bank does not spike memory.
  const inspect = async () => {
    while (next < requiredFiles.length) {
      const filePath = requiredFiles[next++];
      const cachedResponse = await offlineCache.match(filePath, {ignoreSearch:true});
      try {
        if (!cachedResponse?.ok) throw new Error('Archivo no disponible');
        const responseBody = await cachedResponse.json();
        if (!responseBody || typeof responseBody !== 'object') throw new Error('JSON no válido');
        if (/^(data|cards)\/T\d+\.\d{2}\.json$/.test(filePath) && !Array.isArray(responseBody)) throw new Error('Lista no válida');
        if (filePath === 'explanations/index.json' && !Array.isArray(responseBody)) throw new Error('Índice de explicaciones no válido');
        if (filePath === 'data/index.json' && !Array.isArray(responseBody.temas)) throw new Error('Índice no válido');
        if (filePath === 'cards/index.json' && !validCards) throw new Error('Índice de tarjetas no válido');
      } catch { unavailable.add(filePath); }
    }
  };
  await Promise.all(Array.from({length: Math.min(4, requiredFiles.length)}, inspect));
  const missing = requiredFiles.filter(filePath => unavailable.has(filePath));
  const complete = missing.length === 0 && validCards;
  let completedAt: number | null = null;
  try {
    const saved = JSON.parse(localStorage.getItem(OFFLINE_VERIFICATION_KEY) || 'null');
    if (complete && saved?.signature === requiredFiles.join('|') && Number.isFinite(saved.at)) completedAt = saved.at;
  } catch {}
  return {complete,missing,total:requiredFiles.length,completedAt};
}
export async function downloadOffline(bankIndex: Index, progress: (completedFiles: number, totalFiles: number) => void = () => {}, isCurrent: () => boolean = () => true): Promise<OfflineState> {
  if (typeof caches === 'undefined') throw new Error('Este navegador no permite guardar descargas sin conexión.');
  const offlineCache = await caches.open(OFFLINE_DATA_CACHE_NAME), requiredFiles = getBaseFilesToCache(bankIndex);
  let completedFiles = 0;
  const cacheFile = async (filePath: string) => {
    if (!isCurrent()) throw new Error('Descarga cancelada al salir de Ajustes o cambiar de cuenta.');
    const response = await fetchOfflineFile(filePath, {cache:'reload'});
    if (!response.ok) throw new Error(`No se pudo descargar ${filePath}. Reintenta cuando tengas conexión.`);
    const responseBody = await response.clone().json(); // rechaza errores HTML con estado 200
    if (filePath === 'explanations/index.json' && !Array.isArray(responseBody)) throw new Error('El índice de explicaciones no es una lista válida.');
    if (!isCurrent()) throw new Error('Descarga cancelada.');
    await offlineCache.put(filePath, response);
    progress(++completedFiles,requiredFiles.length);
    return responseBody;
  };
  const cardIndexData = await cacheFile('cards/index.json');
  requiredFiles.push(...getCardFiles(cardIndexData));
  const filesToCache = requiredFiles.filter(filePath => filePath !== 'cards/index.json');
  let nextFile = 0, failed = false, failure: unknown;
  const cacheWorker = async () => {
    while (!failed && nextFile < filesToCache.length) {
      const filePath = filesToCache[nextFile++];
      try {
        await cacheFile(filePath);
      } catch (error) {
        if (!failed) { failed = true; failure = error; }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, filesToCache.length) }, cacheWorker));
  if (failed) throw failure;
  const offlineStatus = await inspectOffline(bankIndex);
  if (!isCurrent()) throw new Error('Descarga cancelada.');
  if (!offlineStatus.complete) throw new Error(`Descarga incompleta: faltan ${offlineStatus.missing.length} archivos.`);
  offlineStatus.completedAt = Date.now();
  try { localStorage.setItem(OFFLINE_VERIFICATION_KEY, JSON.stringify({at:offlineStatus.completedAt,signature:requiredFiles.join('|')})); } catch {}
  return offlineStatus;
}
