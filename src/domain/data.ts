import * as store from '../infra/store.js';
import { shuffle, allowed } from './logic.js';
import { loadBank } from '../infra/bank.js';
import type { Index, Meta, Question } from '../core/types.js';
// ───────── datos ─────────
export let INDEX: Index | undefined, META: Meta, SUP: unknown;
const supQuestions = new Map<string, Question>();
const cache = new Map<string, Promise<Question[]>>();
export async function j<T = any>(url: string): Promise<T> {
  const m = /^data\/([\w.-]+)\.json$/.exec(url); // el banco puede venir de Firestore; si no, JSON estático
  if (m) { const b = await loadBank<T>(m[1]); if (b !== null) return b; }
  const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); }
export async function getIndex(): Promise<Index> { return (INDEX ||= await j<Index>('data/index.json')); }
let metaLoading: Promise<Meta> | undefined;
export async function getMeta(): Promise<Meta> {
  if (META && SUP) return META;
  if (!metaLoading) metaLoading = (async () => {
    if (!META) {
      const meta = await j<Meta>('data/meta.json');
      const by: Record<string, string[]> = {};
      for (const id in meta) (by[meta[id][0]] ||= []).push(id);
      meta._by = by; META = meta;
    }
    // Sin supuestos descargados, el banco por temas sigue disponible sin conexión.
    try { await getSup(); } catch {}
    return META;
  })().finally(() => { metaLoading = undefined; });
  return metaLoading;
}
export const temaOf = (id: string): string | null => META && META[id] ? META[id][0] : supQuestions.get(id)?.t || null;
export const idsOfTema = (t: string): string[] => [...(META?._by[t] || []), ...[...supQuestions.values()].filter(q => q.t === t).map(q => q.i)];
export async function getTema(t: string): Promise<Question[]> { if (!cache.has(t)) cache.set(t, j<Question[]>(`data/${t}.json`).catch(e => { cache.delete(t); throw e; })); return cache.get(t)!; }
export async function getSup(): Promise<any> {
  const sup = (SUP ||= await j('data/supuestos.json'));
  for (const v of Object.values(sup) as { texto: string; q: Question[] }[]) {
    for (const q of v.q) supQuestions.set(q.i, { ...q, supTexto: v.texto });
  }
  return sup;
}
export const temaName = (t: string): string => (INDEX?.temas.find(x => x.id === t)?.nombre) || t;

export const now = (): number => Date.now();

// ───────── selección de preguntas ─────────
function prioridad(q: Question, mode: string): number {
  const r = store.rec(q.i);
  if (mode === 'falladas') return store.pendingFailure(r) ? 0 : 9;
  if (mode === 'dudosas') return r && r[6] ? 0 : 9;
  if (mode === 'nuevas') return !r ? 0 : (r[5] === 0 ? 1 : 2);
  return 0;
}
export async function pick({ temas, origins, mode, n }: { temas: string[]; origins: { has(x: any): boolean }; mode: string; n: number }): Promise<Question[]> {
  const pool: Question[] = [];
  for (const l of await Promise.all(temas.map(getTema))) for (const q of l) if (allowed(q, origins)) pool.push(q);
  let c: [number, Question][] = shuffle(pool).map(q => [prioridad(q, mode), q]);
  if (mode === 'falladas' || mode === 'dudosas') c = c.filter(x => x[0] === 0);
  else if (mode === 'nuevas') c.sort((a, b) => a[0] - b[0] || (store.rec(a[1].i)?.[2] || 0) - (store.rec(b[1].i)?.[2] || 0));
  return c.slice(0, n).map(x => x[1]);
}
export async function dueList(temasFilter?: Set<string>): Promise<string[]> {
  await getMeta();
  const t = now(), out: [number, string][] = [];
  const st = store.getStats();
  for (const id in st) { const r = st[id]; if (r[3] >= 0 && r[4] <= t && temaOf(id) && (!temasFilter || temasFilter.has(temaOf(id)!))) out.push([r[4], id]); }
  out.sort((a, b) => a[0] - b[0]);
  return out.map(x => x[1]);
}
export async function byIds(ids: string[]): Promise<Question[]> {
  await getMeta();
  const need = new Set(ids.map(id => META[id]?.[0]).filter(Boolean));
  const m = new Map<string, Question>(supQuestions);
  for (const l of await Promise.all([...need].map(getTema))) for (const q of l) m.set(q.i, q);
  return ids.map(id => m.get(id)).filter((q): q is Question => !!q);
}
