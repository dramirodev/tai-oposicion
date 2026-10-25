// Verificación de CacheStorage: las cachés en memoria de los lectores no prueban uso sin red.
const CACHE = 'tai-data', STAMP = 'tai.offline-verified';
type Index = { temas: { id: string }[] };
type CardIndex = { temas: Record<string, unknown> };
export interface OfflineState { complete: boolean; missing: string[]; total: number; completedAt: number | null }
const baseFiles = (idx: Index) => ['data/index.json', 'data/meta.json', 'data/supuestos.json', 'cards/index.json', ...idx.temas.map(t => `data/${t.id}.json`)];
function isCardIndex(index: unknown): index is CardIndex {
  return !!index && typeof index === 'object' && !Array.isArray(index)
    && 'temas' in index && !!index.temas && typeof index.temas === 'object' && !Array.isArray(index.temas);
}
function cardFiles(index: unknown): string[] {
  if (!isCardIndex(index)) throw new Error('Índice de tarjetas no válido');
  const keys = Object.keys(index.temas);
  if (!keys.length || keys.some(t => !/^T\d\.\d\d$/.test(t))) throw new Error('Índice de tarjetas no válido');
  return keys.map(t => `cards/${t}.json`);
}
export async function inspectOffline(idx: Index): Promise<OfflineState> {
  const need = baseFiles(idx);
  if (typeof caches === 'undefined') return {complete:false, missing:need, total:need.length, completedAt:null};
  const cache = await caches.open(CACHE);
  const ci = await cache.match('cards/index.json', {ignoreSearch:true});
  let validCards = false;
  if (ci?.ok) { try { need.push(...cardFiles(await ci.json())); validCards = true; } catch {} }
  const missing: string[] = [];
  for (const u of need) {
    const hit = await cache.match(u, {ignoreSearch:true});
    try {
      if (!hit?.ok) throw new Error('Archivo no disponible');
      const body = await hit.json();
      if (!body || typeof body !== 'object') throw new Error('JSON no válido');
      if (/^(data|cards)\/T\d\.\d\d\.json$/.test(u) && !Array.isArray(body)) throw new Error('Lista no válida');
      if (u === 'data/index.json' && !Array.isArray(body.temas)) throw new Error('Índice no válido');
      if (u === 'cards/index.json' && !validCards) throw new Error('Índice de tarjetas no válido');
    } catch { missing.push(u); }
  }
  const complete = missing.length === 0 && validCards;
  let completedAt: number | null = null;
  try {
    const saved = JSON.parse(localStorage.getItem(STAMP) || 'null');
    if (complete && saved?.signature === need.join('|') && Number.isFinite(saved.at)) completedAt = saved.at;
  } catch {}
  return {complete,missing,total:need.length,completedAt};
}
export async function downloadOffline(idx: Index, progress: (done: number, total: number) => void = () => {}, alive: () => boolean = () => true): Promise<OfflineState> {
  if (typeof caches === 'undefined') throw new Error('Este navegador no permite guardar descargas sin conexión.');
  const cache = await caches.open(CACHE), need = baseFiles(idx);
  let done = 0;
  const save = async (u: string) => {
    if (!alive()) throw new Error('Descarga cancelada al salir de Ajustes o cambiar de cuenta.');
    const response = await fetch(u, {cache:'reload'});
    if (!response.ok) throw new Error(`No se pudo descargar ${u}. Reintenta cuando tengas conexión.`);
    const body = await response.clone().json(); // rechaza errores HTML con estado 200
    if (!alive()) throw new Error('Descarga cancelada.');
    await cache.put(u, response);
    progress(++done,need.length);
    return body;
  };
  const ci = await save('cards/index.json');
  need.push(...cardFiles(ci));
  for (const u of need) if (u !== 'cards/index.json') await save(u);
  const result = await inspectOffline(idx);
  if (!alive()) throw new Error('Descarga cancelada.');
  if (!result.complete) throw new Error(`Descarga incompleta: faltan ${result.missing.length} archivos.`);
  result.completedAt = Date.now();
  try { localStorage.setItem(STAMP, JSON.stringify({at:result.completedAt,signature:need.join('|')})); } catch {}
  return result;
}
