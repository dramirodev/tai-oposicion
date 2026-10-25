// Motor de preguntas: estado de la sesión en curso, guardado y reanudación, registro de respuestas, cierre con nota
// y selección de preguntas (sesión rápida, repaso, trampas). Sin DOM: la interfaz solo pinta y llama a estas funciones.
import * as store from '../../adapters/local/legacy-store.js';
import { META, temaOf, getIndex, getMeta, getTema, dueList, byIds, now } from '../../adapters/http/legacy-data.js';
import { calculateExamScore } from '../domain/scoring.js';
import { allowed, dominioCalc, pickGuest, pickQuick, pickRepaso, pickTrampas, questionsForSession, quickN, shuffle, trapRates } from '../../legacy/logic.js';
import type { Index, Question, Session, SessionKind } from '../../adapters/legacy/types.js';

// ───────── sesión en curso ─────────
export interface RunCfg {
  kind: SessionKind; feedback: boolean; items: Question[]; titulo?: string;
  limit?: number; porTiempo?: boolean; supTexto?: string;
}
export interface Run extends RunCfg {
  idx: number; ans: (number | undefined)[]; times?: (number | undefined)[]; t0: number; secs: number; paused: boolean;
  since?: number | null; base?: number; tIdx?: number; q0?: number; qT0?: number; gt?: ReturnType<typeof setInterval>;
  review?: number[];
  luck?: Record<number, number>; fast?: Record<number, [number, number]>;
}
/** Último resultado, para la pantalla de resultados. */
export interface LastResult { ses: Session & { porTiempo?: boolean }; items: Question[]; ans: (number | undefined)[]; times: (number | undefined)[]; limit: number }

/** Estado compartido: la sesión en curso y la última terminada. */
const subscribers = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}
// El puente aún escribe en Run directamente. Observar objetos y arrays permite
// avisar también de esas mutaciones sin cambiar ni el motor ni sus consumidores.
// No se envuelven las preguntas (datos inmutables) ni los handles de timers.
const observed = new WeakMap<object, object>();
function observable<T extends object>(value: T): T {
  const known = observed.get(value); if (known) return known as T;
  const proxy = new Proxy(value, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      return v && typeof v === 'object' && key !== 'items' && key !== 'gt'
        && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype) ? observable(v) : v;
    },
    set(target, key, v) {
      const changed = !Object.is(Reflect.get(target, key), v);
      const ok = Reflect.set(target, key, v);
      if (ok && changed) subscribers.forEach(fn => fn());
      return ok;
    },
    deleteProperty(target, key) {
      const had = Reflect.has(target, key), ok = Reflect.deleteProperty(target, key);
      if (ok && had) subscribers.forEach(fn => fn());
      return ok;
    },
  });
  observed.set(value, proxy); observed.set(proxy, proxy);
  return proxy;
}
const engineState: { run: Run | null; last: LastResult | null } = observable({ run: null, last: null });
export interface EngineSnapshot {
  readonly run: Readonly<Run> | null;
  readonly last: Readonly<LastResult> | null;
}
export function getSnapshot(): EngineSnapshot { return engineState; }
export const getCurrentRun = (): Readonly<Run> | null => engineState.run;
export const getLastResult = (): Readonly<LastResult> | null => engineState.last;
export const getRunKind = (): SessionKind | null => engineState.run?.kind || null;
export const getLastRunKind = (): SessionKind | null => engineState.last?.ses.kind || null;
export const hasActiveRun = (): boolean => engineState.run !== null;

export function clearActiveRun(): void { engineState.run = null; }
export function clearLastResult(): void { engineState.last = null; }
export function setQuestionIndex(index: number): boolean {
  const run = engineState.run;
  if (!run || run.paused || !Number.isInteger(index) || index < 0 || index >= run.items.length) return false;
  run.idx = index;
  return true;
}
export function toggleReviewQuestion(): boolean {
  const run = engineState.run;
  if (!run || run.paused) return false;
  const review = new Set(run.review || []);
  if (review.has(run.idx)) review.delete(run.idx);
  else review.add(run.idx);
  run.review = [...review].sort((a, b) => a - b);
  return true;
}
export function setRunPaused(paused: boolean): boolean {
  const run = engineState.run;
  if (!run) return false;
  run.paused = paused;
  return true;
}
export function toggleDeferredBlank(): boolean {
  const run = engineState.run;
  if (!run || run.feedback || run.paused) return false;
  run.ans[run.idx] = run.ans[run.idx] === -1 ? undefined : -1;
  return true;
}
export function startCurrentQuestion(t = Date.now()): void {
  const run = engineState.run;
  if (!run || run.tIdx === run.idx) return;
  run.tIdx = run.idx;
  run.q0 = run.secs;
  run.qT0 = t;
}
export function tickCurrentRun(t = Date.now()): void { if (engineState.run) tickRun(engineState.run, t); }
export const currentSecondsRemaining = (): number => engineState.run ? segundosRestantes(engineState.run) : Infinity;
export function answerCurrentQuestion(answer: number, minimumReadingSeconds: number): void {
  const run = engineState.run;
  if (run) answerQuestion(run, run.items[run.idx], answer, minimumReadingSeconds);
}
export function answerCurrentDeferred(answer: number): void { if (engineState.run) answerDeferred(engineState.run, answer); }
export function finishCurrentRun(reason: 'complete' | 'interrupted' | 'timeout' = 'complete'): LastResult | null {
  return engineState.run ? finishRun(engineState.run, reason) : null;
}

/** Crea la sesión; devuelve null si no hay preguntas puntuables. No navega: eso lo decide la interfaz. */
export function createRun(cfg: RunCfg): Run | null {
  const items = questionsForSession(cfg.items, cfg.feedback);
  if (!items.length) return null;
  return (engineState.run = observable({ ...cfg, items, idx: 0, ans: [], t0: now(), secs: 0, paused: false }));
}

// La sesión en curso se guarda para sobrevivir al cierre de la app por iOS (solo sesiones del banco, no los supuestos)
const runKey = () => 'tai.run:' + (store.accountId() || 'guest');
store.onAccountChange(() => { engineState.run = null; engineState.last = null; });
const closedRuns = new WeakSet<Run>();
const MAX_EDAD = 2 * 86400000;
export function clearRun(): void { try { localStorage.removeItem(runKey()); } catch {} }
export function saveRun(): void {
  const R = engineState.run;
  if (!R || R.supTexto || !R.items.every(q => q.i && META && META[q.i])) return;
  const { kind, feedback, titulo, limit, idx, ans, times, secs, porTiempo, review } = R;
  try { localStorage.setItem(runKey(), JSON.stringify({ kind, feedback, titulo, limit, idx, ans: [...ans], times: times ? [...times] : [], secs, pt: !!porTiempo, ids: R.items.map(q => q.i), review: review || [], savedAt: Date.now() })); } catch {}
}
interface SavedRun {
  kind: SessionKind; feedback?: boolean; titulo?: string; limit?: number; idx: number; ans?: (number | null)[]; times?: (number | null)[];
  secs?: number; pt?: boolean; review?: number[]; ids: string[]; savedAt?: number;
}
export interface PendingRun { saved: SavedRun; items: Question[]; account: string | null }
/** Sesión guardada que se puede retomar; descarta (y borra) la caducada o incoherente. */
export async function pendingRun(full: boolean): Promise<PendingRun | null> {
  const account = store.accountId();
  let s: SavedRun | null = null; try { s = JSON.parse(localStorage.getItem(runKey()) || 'null'); } catch {}
  if (!s || engineState.run) return null;
  if (!full && s.kind !== 'rev') { clearRun(); return null; }
  if (!Array.isArray(s.ids) || !s.ids.length || Date.now() - (s.savedAt || 0) > MAX_EDAD) { clearRun(); return null; }
  const items = await byIds(s.ids);
  if (account !== store.accountId()) return null;
  if (items.length !== s.ids.length || questionsForSession(items, !!s.feedback).length !== items.length) { clearRun(); return null; }
  return { saved: s, items, account };
}
export function resumeRun({ saved: s, items, account }: PendingRun): Run | null {
  if (account !== store.accountId()) return null;
  const un = <T>(a?: (T | null)[]): (T | undefined)[] => Array.from(a || [], x => x === null ? undefined : x);
  return (engineState.run = observable({ kind: s.kind, feedback: !!s.feedback, titulo: s.titulo, limit: s.limit || 0, porTiempo: !!s.pt, items, idx: s.idx, ans: un(s.ans), times: un(s.times), t0: now(), secs: s.secs || 0, paused: false, review: (Array.isArray(s.review) ? s.review : []).filter(i => Number.isInteger(i) && i >= 0 && i < items.length) }));
}

// ───────── tiempo y respuestas ─────────
/** El tiempo sale de la hora real (no de contar ticks): iOS frena los timers con la pantalla bloqueada. */
export function tickRun(R: Run, t = Date.now()): void {
  if (R.paused) { R.since = null; return; }
  if (R.since == null) { R.since = t; R.base = R.secs; }
  R.secs = (R.base ?? 0) + Math.floor((t - R.since) / 1000);
}
/** Segundos que quedan; con límite 0 devuelve Infinity. */
export const segundosRestantes = (R: Run): number => R.limit ? R.limit * 60 - R.secs : Infinity;
/** Anota en el progreso la respuesta de una pregunta con corrección inmediata (i = -1: «no lo sé»). */
export function answerQuestion(R: Run, q: Question, i: number, minLect: number): void {
  if (engineState.run !== R) return;
  R.ans[R.idx] = i;
  (R.luck ||= {})[R.idx] = store.rec(q.i)?.[9] || 0;
  (R.fast ||= {})[R.idx] = [Math.round((Date.now() - (R.qT0 ?? Date.now())) / 1000), minLect];
  store.record(q.i, q.t, i === -1 ? 2 : i === q.c ? 1 : 0, now(), i === -1 ? undefined : Math.max(1, R.secs - (R.q0 ?? 0)));
}
/** Respuesta en modo examen (sin corrección): se guarda al terminar. */
export function answerDeferred(R: Run, i: number): void {
  if (engineState.run !== R) return;
  R.ans[R.idx] = i;
  (R.times ||= [])[R.idx] = Math.max(1, R.secs - (R.q0 ?? 0));
}

/** Cierra la sesión: puntúa, guarda en el progreso y deja el resultado en `engineState.last`. null = no se contestó nada. */
export function finishRun(R: Run, reason: 'complete' | 'interrupted' | 'timeout' = 'complete'): LastResult | null {
  if (closedRuns.has(R) || engineState.run !== R) return null;
  closedRuns.add(R);
  clearRun();
  // «por tiempo»: solo cuentan las preguntas que llegaste a contestar (la que estaba abierta al acabar el tiempo no)
  let hechas = R.items.length;
  if (R.porTiempo) { hechas = 0; R.ans.forEach((x, k) => { if (x !== undefined) hechas = k + 1; }); if (!hechas) { engineState.run = null; return null; } }
  const items = R.items.slice(0, hechas), res = { a: 0, f: 0, b: 0 }, fails: string[] = [];
  const porTema: Record<string, [number, number]> = {}, porTipo: Record<string, [number, number]> = {};
  items.forEach((q, k) => {
    const x = R.ans[k]; const ok = x === q.c;
    const pt = porTema[q.t] ||= [0, 0]; pt[1]++;
    const tk: string | undefined = META[q.i]?.[2]; const ptk = tk ? (porTipo[tk] ||= [0, 0]) : null; if (ptk) ptk[1]++;
    if (x === undefined || x === -1) { res.b++; if (!R.feedback) store.record(q.i, q.t, 2); }
    else if (ok) { res.a++; pt[0]++; if (ptk) ptk[0]++; if (!R.feedback) store.record(q.i, q.t, 1, now(), R.times?.[k]); }
    else { res.f++; fails.push(q.i); if (!R.feedback) store.record(q.i, q.t, 0, now(), R.times?.[k]); }
  });
  const n = items.length;
  const ses = { id: 's' + now().toString(36), ts: now(), kind: R.kind, n, a: res.a, f: res.f, b: res.b, secs: R.porTiempo ? Math.min(R.secs, (R.limit ?? 0) * 60) : R.secs, nota: calculateExamScore(res.a, res.f, n), temas: porTema, tipos: porTipo, fails, titulo: R.titulo || '', ...(reason === 'interrupted' ? { interrupted: true } : {}), ...(R.porTiempo ? { porTiempo: true } : {}) };
  store.addSession(ses);
  engineState.run = null;
  return (engineState.last = observable({ ses, items, ans: R.ans, times: R.times || [], limit: R.limit || 0 }));
}

// ───────── selección de preguntas ─────────
const origenes = (): Set<string> => new Set(((store.getCfg().test || {}) as { o?: string[] }).o || ['O', 'A', 'G']);
export const dominioTemas = (idx: Index) => dominioCalc(idx.temas, t => META._by[t], id => store.rec(id), now());
/** Ids de preguntas con un fallo pendiente de superar. */
export const falladasIds = (): string[] => { const st = store.getStats(); return Object.keys(st).filter(id => temaOf(id) && store.pendingFailure(st[id])); };

const GQ_KEY = 'tai.gq';
async function quickGuest(idx: Index, N: number, orgs: Set<string>): Promise<Question[]> {
  let last: string[] = []; try { last = JSON.parse(localStorage.getItem(GQ_KEY) || '[]'); } catch {}
  const temas = shuffle(idx.temas).slice(0, N + 3);
  const pools = (await Promise.all(temas.map(t => getTema(t.id)))).map((l, k) => ({ t: temas[k].id, qs: questionsForSession(l.filter(q => allowed(q, orgs)), true) }));
  const items = pickGuest(pools, N, id => !!store.rec(id), new Set(last));
  try { localStorage.setItem(GQ_KEY, JSON.stringify([...last, ...items.map(q => q.i)].slice(-300))); } catch {}
  return items;
}
export interface Seleccion { items: Question[]; titulo: string }
/** Sesión rápida (~5 min). Invitado: una pregunta de cada tema al azar. Con acceso: repasos vencidos + nuevas de los temas más débiles. */
export async function quickItems(full: boolean): Promise<Seleccion | { items: []; titulo: '' }> {
  const idx = await getIndex(); await getMeta();
  const N = quickN(store.getStats());
  const orgs = origenes();
  if (!full) return { items: await quickGuest(idx, N, orgs), titulo: 'Sesión rápida · una pregunta por tema' };
  const due = (await byIds((await dueList()).slice(0, N))).filter(q => allowed(q, orgs));
  const seen = new Set(store.getSeen());
  const ord = { r: 0, y: 1, n: 2, g: 3 };
  let temas = dominioTemas(idx).filter(t => !seen.size || seen.has(t.id));
  if (!temas.length) temas = dominioTemas(idx);
  temas = shuffle(temas); // el orden estable de abajo conserva este azar entre temas empatados: sin datos ya no salen siempre los mismos
  temas.sort((a, b) => (ord[a.est] - ord[b.est]) || ((b.dias ?? 0) - (a.dias ?? 0)));
  const pools: Question[][] = [];
  for (const l of await Promise.all(temas.slice(0, 8).map(t => getTema(t.id)))) pools.push(shuffle(l.filter(q => allowed(q, orgs) && !store.rec(q.i))));
  const items = pickQuick(due, pools, N);
  const nd = items.filter(q => store.rec(q.i)).length;
  return { items, titulo: `Sesión rápida · ${nd} repasos + ${items.length - nd} nuevas` };
}
/** Repaso de fallos: las más vencidas primero, temas mezclados. */
export async function repasoItems(): Promise<Seleccion> {
  await getMeta(); const st = store.getStats(), t0 = now();
  const cand: { i: string; t: string; due: number }[] = [];
  for (const id in st) { const r = st[id]; if (r[3] >= 0 && r[4] <= t0 && temaOf(id)) cand.push({ i: id, t: temaOf(id)!, due: r[4] }); }
  const ids = pickRepaso(cand, 30).map(x => x.i);
  return { items: ids.length ? await byIds(ids) : [], titulo: 'Repaso de fallos · más vencidas primero, temas mezclados' };
}
/** Test de trampas: preguntas que reúnen más de las trampas objetivo (por defecto, las 3 con más fallos). */
export async function trapTest(n: number, only?: (number | string)[], temas?: string[]): Promise<{ items: Question[]; targets: (number | string)[] }> {
  await getMeta();
  const rates = trapRates(store.getStats(), id => META[id]?.[3] || [], 5).filter(r => r.err > 0);
  const targets = only || rates.slice(0, 3).map(r => r.k);
  if (!targets.length) return { items: [], targets };
  const tg = new Set(targets.map(Number)), ts = temas && temas.length ? new Set(temas) : null;
  const ids = Object.keys(META).filter(id => id !== '_by' && (!ts || ts.has(META[id][0])) && (META[id][3] || []).some((k: number | string) => tg.has(+k)));
  const cands = (await byIds(ids)).filter(q => allowed(q, origenes()));
  return { items: pickTrampas(cands, id => store.rec(id), targets, n), targets };
}
