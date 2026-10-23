import * as store from './store.js';
import { shuffle, allowed } from './logic.js';
// ───────── datos ─────────
export let INDEX, META, SUP;
const cache = new Map();
export async function j(url) { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); }
export async function getIndex() { return INDEX ||= await j('data/index.json'); }
export async function getMeta() {
  if (!META) {
    META = await j('data/meta.json');
    const by = {};
    for (const id in META) (by[META[id][0]] ||= []).push(id);
    META._by = by;
  }
  return META;
}
export const temaOf = id => META && META[id] ? META[id][0] : null;
export async function getTema(t) { if (!cache.has(t)) cache.set(t, j(`data/${t}.json`).catch(e => { cache.delete(t); throw e; })); return cache.get(t); }
export async function getSup() { return SUP ||= await j('data/supuestos.json'); }
export const temaName = t => (INDEX?.temas.find(x => x.id === t)?.nombre) || t;

export const now = () => Date.now();

// ───────── selección de preguntas ─────────
function prioridad(q, mode) {
  const r = store.rec(q.i);
  if (mode === 'falladas') return r && (r[5] === 0 || r[3] >= 0) ? 0 : 9;
  if (mode === 'dudosas') return r && r[6] ? 0 : 9;
  if (mode === 'nuevas') return !r ? 0 : (r[5] === 0 ? 1 : 2);
  return 0;
}
export async function pick({ temas, origins, mode, n }) {
  const pool = [];
  for (const l of await Promise.all(temas.map(getTema))) for (const q of l) if (allowed(q, origins)) pool.push(q);
  let c = shuffle(pool).map(q => [prioridad(q, mode), q]);
  if (mode === 'falladas' || mode === 'dudosas') c = c.filter(x => x[0] === 0);
  else if (mode === 'nuevas') c.sort((a, b) => a[0] - b[0] || (store.rec(a[1].i)?.[2] || 0) - (store.rec(b[1].i)?.[2] || 0));
  return c.slice(0, n).map(x => x[1]);
}
export async function dueList(temasFilter) {
  await getMeta();
  const t = now(), out = [];
  const st = store.getStats();
  for (const id in st) { const r = st[id]; if (r[3] >= 0 && r[4] <= t && META[id] && (!temasFilter || temasFilter.has(META[id][0]))) out.push([r[4], id]); }
  out.sort((a, b) => a[0] - b[0]);
  return out.map(x => x[1]);
}
export async function byIds(ids) {
  await getMeta();
  const need = new Set(ids.map(id => META[id]?.[0]).filter(Boolean));
  const m = new Map();
  for (const l of await Promise.all([...need].map(getTema))) for (const q of l) m.set(q.i, q);
  return ids.map(id => m.get(id)).filter(Boolean);
}
