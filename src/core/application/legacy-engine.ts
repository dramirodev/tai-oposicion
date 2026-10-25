// Motor de preguntas: estado de la sesión en curso, guardado y reanudación, registro de respuestas, cierre con nota
// y selección de preguntas (sesión rápida, repaso, trampas). Sin DOM: la interfaz solo pinta y llama a estas funciones.
import * as store from '../../adapters/local/legacy-store.js';
import { META, temaOf, getIndex, getMeta, getTema, dueList, byIds, now } from '../../adapters/http/legacy-data.js';
import { calculateExamScore } from '../domain/scoring.js';
import { analyzeTopicMastery } from '../domain/topic-mastery.js';
import {
  estimateQuickQuestionCount,
  filterScoringQuestions,
  isQuestionAllowed,
  pickGuestQuestions,
  pickQuickQuestions,
  shuffleItems,
} from '../domain/selection.js';
import { selectSpacedReviews } from '../domain/spaced-repetition.js';
import { calculateTrapRates, selectTrapQuestions } from '../domain/traps.js';
import type { Confidence, Highlight } from '../domain/attempts/transitions.js';
import { questionContentRevision } from '../domain/attempts/highlights.js';
import type { Index, Question, Session, SessionKind } from '../../adapters/legacy/types.js';
import type { AttemptIntent } from '../domain/attempts/transitions.js';
import type { AttemptTracker } from '../ports/AttemptTracker.js';

// ───────── sesión en curso ─────────
export interface RunCfg {
  kind: SessionKind; feedback: boolean; items: Question[]; titulo?: string;
  limit?: number; porTiempo?: boolean; supTexto?: string;
}
export interface Run extends RunCfg {
  idx: number; ans: (number | undefined)[]; times?: (number | undefined)[]; t0: number; secs: number; paused: boolean;
  studyStates?: ('unseen' | 'pending' | 'answered' | 'revealed')[];
  confidences?: Confidence[]; discardedOptions?: number[][]; highlights?: Highlight[][];
  since?: number | null; base?: number; tIdx?: number; q0?: number; qT0?: number; gt?: ReturnType<typeof setInterval>;
  review?: number[];
  luck?: Record<number, number>; fast?: Record<number, [number, number]>;
  attemptScope?: string; attemptSessionId?: string; attemptIds?: string[]; attemptTrackingPaused?: boolean;
}
/** Último resultado, para la pantalla de resultados. */
export interface LastResult { ses: Session & { porTiempo?: boolean }; items: Question[]; ans: (number | undefined)[]; times: (number | undefined)[]; limit: number; studyStates?: ('unseen' | 'pending' | 'answered' | 'revealed')[]; confidences?: Confidence[]; discardedOptions?: number[][]; highlights?: Highlight[][] }

/** Estado compartido: la sesión en curso y la última terminada. */
const subscribers = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}
let attemptTracker: AttemptTracker | null = null;
export function setAttemptTracker(tracker: AttemptTracker | null): void { attemptTracker = tracker; }
export function flushAttemptTracking(): Promise<void> { return attemptTracker?.flush() || Promise.resolve(); }
function recordAttempt(R: Run, intent: AttemptIntent, index = R.idx): void {
  const attemptId = R.attemptIds?.[index];
  if (attemptTracker && R.attemptScope && attemptId) attemptTracker.record(R.attemptScope, attemptId, intent);
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
const questionAllowed = (question: Question, origins: Set<string>): boolean =>
  isQuestionAllowed(question.o, 'r' in question ? question.r : undefined, origins);

export function clearActiveRun(): void {
  const run = engineState.run;
  if (run?.attemptSessionId && run.attemptScope && attemptTracker) {
    if (run.tIdx === run.idx && run.attemptIds?.[run.idx] && !run.attemptTrackingPaused) recordAttempt(run, { type: 'close' });
    attemptTracker.closeSession(run.attemptScope, run.attemptSessionId, 'interrupted', now());
  }
  engineState.run = null;
}
export function clearLastResult(): void { engineState.last = null; }
export function setQuestionIndex(index: number): boolean {
  const run = engineState.run;
  if (!run || run.paused || !Number.isInteger(index) || index < 0 || index >= run.items.length) return false;
  if (run.idx !== index && run.tIdx === run.idx) recordAttempt(run, { type: 'leave' });
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
  if (run.paused !== paused) recordAttempt(run, { type: paused ? 'pause' : 'resume' });
  run.paused = paused;
  return true;
}
export function toggleDeferredBlank(): boolean {
  const run = engineState.run;
  if (!run || run.feedback || run.paused) return false;
  run.ans[run.idx] = run.ans[run.idx] === -1 ? undefined : -1;
  if (run.ans[run.idx] === -1) recordAttempt(run, { type: 'mark-pending' });
  return true;
}
export function startCurrentQuestion(t = Date.now()): void {
  const run = engineState.run;
  if (!run || run.tIdx === run.idx) return;
  run.tIdx = run.idx;
  run.q0 = run.secs;
  run.qT0 = t;
  if (!run.paused && !run.attemptTrackingPaused) recordAttempt(run, { type: 'open' });
}
/** Pauses only the recorded active-time interval; it does not change the study timer. */
export function setAttemptTrackingVisible(visible: boolean): void {
  const run = engineState.run;
  if (!run || run.attemptTrackingPaused === !visible) return;
  run.attemptTrackingPaused = !visible;
  if (run.tIdx === run.idx) recordAttempt(run, { type: visible ? 'resume' : 'pause' });
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
  const items = filterScoringQuestions(cfg.items, cfg.feedback, question => question.np);
  if (!items.length) return null;
  const createdAt = now();
  const run = { ...cfg, items, idx: 0, ans: [], confidences: Array.from({ length: items.length }, () => null), discardedOptions: items.map(() => []), highlights: items.map(() => []), ...(cfg.feedback ? { studyStates: Array.from({ length: items.length }, () => 'unseen' as const) } : {}), t0: createdAt, secs: 0, paused: false } as Run;
  if (attemptTracker && items.every(question => question.i && META[question.i])) {
    const scope = store.accountId() || 'guest';
    const tracking = attemptTracker.beginSession(
      scope,
      cfg.kind === 'sim' ? 'simulation' : 'practice',
      createdAt,
      items.map((question, position) => ({
        questionId: question.i,
        contentRevision: questionContentRevision(question.q, question.a),
        position,
        exposure: Math.max(1, (store.rec(question.i)?.[0] || 0) + 1),
      })),
      cfg.limit,
    );
    run.attemptScope = scope;
    run.attemptSessionId = tracking.session.id;
    run.attemptIds = tracking.attempts.map(attempt => attempt.id);
  }
  return (engineState.run = observable(run));
}

// La sesión en curso se guarda para sobrevivir al cierre de la app por iOS (solo sesiones del banco, no los supuestos)
const runKey = () => 'tai.run:' + (store.accountId() || 'guest');
store.onAccountChange(() => { clearActiveRun(); engineState.last = null; });
const closedRuns = new WeakSet<Run>();
const MAX_EDAD = 2 * 86400000;
export function clearRun(): void { try { localStorage.removeItem(runKey()); } catch {} }
export function saveRun(): void {
  const R = engineState.run;
  if (!R || R.supTexto || !R.items.every(q => q.i && META && META[q.i])) return;
  const { kind, feedback, titulo, limit, idx, ans, times, secs, porTiempo, review } = R;
  try { localStorage.setItem(runKey(), JSON.stringify({ kind, feedback, titulo, limit, idx, ans: [...ans], times: times ? [...times] : [], secs, pt: !!porTiempo, ids: R.items.map(q => q.i), review: review || [], ...(feedback && R.studyStates ? { studyStates: [...R.studyStates] } : {}), confidences: R.confidences || [], discardedOptions: R.discardedOptions || [], highlights: R.highlights || [], savedAt: Date.now(), ...(R.attemptScope ? { attemptScope: R.attemptScope } : {}), ...(R.attemptSessionId ? { attemptSessionId: R.attemptSessionId } : {}), ...(R.attemptIds ? { attemptIds: R.attemptIds } : {}) })); } catch {}
}
interface SavedRun {
  kind: SessionKind; feedback?: boolean; titulo?: string; limit?: number; idx: number; ans?: (number | null)[]; times?: (number | null)[];
  secs?: number; pt?: boolean; review?: number[]; ids: string[]; savedAt?: number;
  attemptScope?: string; attemptSessionId?: string; attemptIds?: string[]; studyStates?: ('unseen' | 'pending' | 'answered' | 'revealed')[];
  confidences?: Confidence[]; discardedOptions?: number[][]; highlights?: Highlight[][];
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
  if (items.length !== s.ids.length || filterScoringQuestions(items, !!s.feedback, question => question.np).length !== items.length) { clearRun(); return null; }
  return { saved: s, items, account };
}
export function resumeRun({ saved: s, items, account }: PendingRun): Run | null {
  if (account !== store.accountId()) return null;
  const un = <T>(a?: (T | null)[]): (T | undefined)[] => Array.from(a || [], x => x === null ? undefined : x);
  const expectedScope = account || 'guest';
  const hasTracking = s.attemptScope === expectedScope
    && typeof s.attemptSessionId === 'string'
    && Array.isArray(s.attemptIds)
    && s.attemptIds.length === items.length
    && s.attemptIds.every(id => typeof id === 'string');
  const restoredAnswers = un(s.ans);
  const answers = Array.from({ length: items.length }, (_, index) => restoredAnswers[index]);
  const validStates = ['unseen', 'pending', 'answered', 'revealed'];
  const hasValidStates = !!s.feedback && Array.isArray(s.studyStates) && s.studyStates.length === items.length
    && s.studyStates.every((state, index) => validStates.includes(state) && (answers[index] !== undefined || state !== 'answered'));
  const states = !!s.feedback ? answers.map((answer, index) => {
    if (answer === -1) return 'revealed'; // Historical -1 was shown with its correct answer in the old practice UI.
    if (typeof answer === 'number') return 'answered';
    return hasValidStates ? s.studyStates![index] : 'unseen';
  }) : undefined;
  const confidences: Confidence[] = items.map((_, index) => {
    const value = s.confidences?.[index];
    return value === 'sure' || value === 'betweenTwo' || value === 'guess' ? value : null;
  });
  const discardedOptions = items.map((question, index) => Array.isArray(s.discardedOptions?.[index])
    ? [...new Set(s.discardedOptions[index].filter(option => Number.isInteger(option) && option >= 0 && option < question.a.length))]
    : []);
  const validHighlight = (mark: Highlight): boolean => Boolean(mark && typeof mark.id === 'string'
    && (mark.field === 'statement' || /^option:\d+$/.test(mark.field))
    && Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= 0 && mark.end > mark.start
    && typeof mark.text === 'string' && typeof mark.contentRevision === 'string');
  const highlights = items.map((_, index) => Array.isArray(s.highlights?.[index]) ? s.highlights[index].filter(validHighlight) : []);
  const run = { kind: s.kind, feedback: !!s.feedback, titulo: s.titulo, limit: s.limit || 0, porTiempo: !!s.pt, items, idx: s.idx, ans: answers, times: un(s.times), t0: now(), secs: s.secs || 0, paused: false, confidences, discardedOptions, highlights, review: (Array.isArray(s.review) ? s.review : []).filter(i => Number.isInteger(i) && i >= 0 && i < items.length), ...(states ? { studyStates: states } : {}), ...(hasTracking ? { attemptScope: s.attemptScope, attemptSessionId: s.attemptSessionId, attemptIds: s.attemptIds!.slice() } : {}) } as Run;
  if (run.attemptSessionId && run.attemptScope && run.attemptIds) attemptTracker?.resumeSession(run.attemptScope, run.attemptSessionId, run.attemptIds);
  return (engineState.run = observable(run));
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
  if (!R.feedback) {
    R.ans[R.idx] = i;
    (R.luck ||= {})[R.idx] = store.rec(q.i)?.[9] || 0;
    (R.fast ||= {})[R.idx] = [Math.round((Date.now() - (R.qT0 ?? Date.now())) / 1000), minLect];
    if (i === -1) recordAttempt(R, { type: 'mark-pending' });
    else recordAttempt(R, { type: 'answer', optionIndex: i, outcome: i === q.c ? 'correct' : 'wrong' });
    store.record(q.i, q.t, i === -1 ? 2 : i === q.c ? 1 : 0, now(), i === -1 ? undefined : Math.max(1, R.secs - (R.q0 ?? 0)));
    return;
  }
  R.studyStates ||= [];
  const state = R.studyStates[R.idx] || 'unseen';
  if (state === 'answered' || state === 'revealed') return;
  if (i === -1) {
    if (state === 'pending') return;
    R.studyStates[R.idx] = 'pending';
    recordAttempt(R, { type: 'mark-pending' });
    return;
  }
  R.ans[R.idx] = i;
  R.studyStates[R.idx] = 'answered';
  (R.luck ||= {})[R.idx] = store.rec(q.i)?.[9] || 0;
  (R.fast ||= {})[R.idx] = [Math.round((Date.now() - (R.qT0 ?? Date.now())) / 1000), minLect];
  recordAttempt(R, { type: 'answer', optionIndex: i, outcome: i === q.c ? 'correct' : 'wrong' });
  store.record(q.i, q.t, i === q.c ? 1 : 0, now(), Math.max(1, R.secs - (R.q0 ?? 0)));
}
/** Reveals only a previously deferred practice question; consultation has no score effect. */
export function revealCurrentSolution(): boolean {
  const run = engineState.run;
  if (!run?.feedback || (run.studyStates?.[run.idx] || 'unseen') !== 'pending' || run.ans[run.idx] !== undefined) return false;
  run.studyStates![run.idx] = 'revealed';
  recordAttempt(run, { type: 'reveal' });
  return true;
}
export function setCurrentConfidence(value: Exclude<Confidence, null>): boolean {
  const run = engineState.run;
  if (!run || run.paused || !['sure', 'betweenTwo', 'guess'].includes(value)) return false;
  const locked = run.feedback
    ? ['answered', 'revealed'].includes(run.studyStates?.[run.idx] || 'unseen')
    : typeof run.ans[run.idx] === 'number' && run.ans[run.idx]! >= 0;
  if (locked || run.confidences?.[run.idx] === value) return false;
  run.confidences ||= [];
  run.confidences[run.idx] = value;
  recordAttempt(run, { type: 'set-confidence', value });
  return true;
}
export function toggleCurrentDiscardedOption(optionIndex: number): boolean {
  const run = engineState.run;
  const question = run?.items[run.idx];
  if (!run || !question || run.paused || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.a.length) return false;
  const locked = run.feedback
    ? ['answered', 'revealed'].includes(run.studyStates?.[run.idx] || 'unseen')
    : typeof run.ans[run.idx] === 'number' && run.ans[run.idx]! >= 0;
  if (locked) return false;
  run.discardedOptions ||= [];
  const current = run.discardedOptions[run.idx] || [];
  if (current.includes(optionIndex)) {
    run.discardedOptions[run.idx] = current.filter(index => index !== optionIndex);
    recordAttempt(run, { type: 'restore-option', optionIndex });
  } else {
    run.discardedOptions[run.idx] = [...current, optionIndex].sort((left, right) => left - right);
    recordAttempt(run, { type: 'discard-option', optionIndex });
  }
  return true;
}
export function addCurrentHighlight(highlight: Highlight): boolean {
  const run = engineState.run;
  if (!run || run.paused || run.highlights?.[run.idx]?.some(mark => mark.id === highlight.id)) return false;
  const question = run.items[run.idx];
  const optionIndex = highlight.field.startsWith('option:') ? Number(highlight.field.slice(7)) : null;
  if (optionIndex !== null && (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.a.length)) return false;
  run.highlights ||= run.items.map(() => []);
  run.highlights[run.idx] = [...(run.highlights[run.idx] || []), highlight];
  recordAttempt(run, { type: 'add-highlight', highlight });
  return true;
}
export function removeCurrentHighlight(highlightId: string): boolean {
  const run = engineState.run;
  const marks = run?.highlights?.[run.idx];
  if (!run || run.paused || !marks?.some(mark => mark.id === highlightId)) return false;
  run.highlights![run.idx] = marks.filter(mark => mark.id !== highlightId);
  recordAttempt(run, { type: 'remove-highlight', highlightId });
  return true;
}
/** Respuesta en modo examen (sin corrección): se guarda al terminar. */
export function answerDeferred(R: Run, i: number): void {
  if (engineState.run !== R) return;
  R.ans[R.idx] = i;
  (R.times ||= [])[R.idx] = Math.max(1, R.secs - (R.q0 ?? 0));
  const q = R.items[R.idx];
  if (i === -1) recordAttempt(R, { type: 'mark-pending' });
  else recordAttempt(R, { type: 'answer', optionIndex: i, outcome: i === q.c ? 'correct' : 'wrong' });
}

/** Cierra la sesión: puntúa, guarda en el progreso y deja el resultado en `engineState.last`. null = no se contestó nada. */
export function finishRun(R: Run, reason: 'complete' | 'interrupted' | 'timeout' = 'complete'): LastResult | null {
  if (closedRuns.has(R) || engineState.run !== R) return null;
  closedRuns.add(R);
  clearRun();
  if (R.attemptSessionId && R.attemptScope && attemptTracker) {
    if (R.tIdx === R.idx && R.attemptIds?.[R.idx] && !R.attemptTrackingPaused) recordAttempt(R, { type: 'close' });
    attemptTracker.closeSession(R.attemptScope, R.attemptSessionId, reason === 'interrupted' ? 'interrupted' : 'completed', now(), R.secs);
  }
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
  return (engineState.last = observable({
    ses, items, ans: [...R.ans], times: [...(R.times || [])], limit: R.limit || 0,
    ...(R.studyStates ? { studyStates: [...R.studyStates] } : {}),
    confidences: [...(R.confidences || [])],
    discardedOptions: (R.discardedOptions || []).map(options => [...options]),
    highlights: (R.highlights || []).map(marks => marks.map(mark => ({ ...mark }))),
  }));
}

// ───────── selección de preguntas ─────────
const origenes = (): Set<string> => new Set(((store.getCfg().test || {}) as { o?: string[] }).o || ['O', 'A', 'G']);
/** Ids de preguntas con un fallo pendiente de superar. */
export const falladasIds = (): string[] => { const st = store.getStats(); return Object.keys(st).filter(id => temaOf(id) && store.pendingFailure(st[id])); };

const GQ_KEY = 'tai.gq';
async function quickGuest(idx: Index, N: number, orgs: Set<string>): Promise<Question[]> {
  let last: string[] = []; try { last = JSON.parse(localStorage.getItem(GQ_KEY) || '[]'); } catch {}
  const temas = shuffleItems(idx.temas, Math.random).slice(0, N + 3);
  const pools = (await Promise.all(temas.map(t => getTema(t.id)))).map((questions, index) => ({
    topicId: temas[index].id,
    questions: filterScoringQuestions(
      questions.filter(question => questionAllowed(question, orgs)),
      true,
      question => question.np,
    ),
  }));
  const items = pickGuestQuestions(pools, N, question => question.i, id => !!store.rec(id), new Set(last), Math.random);
  try { localStorage.setItem(GQ_KEY, JSON.stringify([...last, ...items.map(q => q.i)].slice(-300))); } catch {}
  return items;
}
export interface Seleccion { items: Question[]; titulo: string }
/** Sesión rápida (~5 min). Invitado: una pregunta de cada tema al azar. Con acceso: repasos vencidos + nuevas de los temas más débiles. */
export async function quickItems(full: boolean): Promise<Seleccion | { items: []; titulo: '' }> {
  const idx = await getIndex(); await getMeta();
  const N = estimateQuickQuestionCount(Object.values(store.getStats()).map(record => ({
    totalSeconds: record[7],
    count: record[8],
  })));
  const orgs = origenes();
  if (!full) return { items: await quickGuest(idx, N, orgs), titulo: 'Sesión rápida · una pregunta por tema' };
  const due = (await byIds((await dueList()).slice(0, N))).filter(question => questionAllowed(question, orgs));
  const seen = new Set(store.getSeen());
  const ord = { r: 0, y: 1, n: 2, g: 3 };
  const statusCode = { new: 'n', red: 'r', yellow: 'y', green: 'g' } as const;
  const topicPriorities = analyzeTopicMastery(
    idx.temas.map(topic => ({ ...topic, questionCount: topic.n })),
    topicId => META._by[topicId],
    questionId => {
      const record = store.rec(questionId);
      return record ? {
        attempts: record[0], correct: record[1], lastSeenAt: record[2], intervalStep: record[3],
        dueAt: record[4], lastResult: record[5],
      } : undefined;
    },
    now(),
  ).map(result => ({ id: result.topic.id, est: statusCode[result.status], dias: result.daysSinceLastSeen }));
  let temas = topicPriorities.filter(topic => !seen.size || seen.has(topic.id));
  if (!temas.length) temas = topicPriorities;
  temas = shuffleItems(temas, Math.random); // el orden estable de abajo conserva este azar entre temas empatados: sin datos ya no salen siempre los mismos
  temas.sort((a, b) => (ord[a.est] - ord[b.est]) || ((b.dias ?? 0) - (a.dias ?? 0)));
  const pools: Question[][] = [];
  for (const questions of await Promise.all(temas.slice(0, 8).map(t => getTema(t.id)))) {
    pools.push(shuffleItems(questions.filter(question => questionAllowed(question, orgs) && !store.rec(question.i)), Math.random));
  }
  const items = pickQuickQuestions(due, pools, N, question => question.i, Math.random);
  const nd = items.filter(q => store.rec(q.i)).length;
  return { items, titulo: `Sesión rápida · ${nd} repasos + ${items.length - nd} nuevas` };
}
/** Repaso de fallos: las más vencidas primero, temas mezclados. */
export async function repasoItems(): Promise<Seleccion> {
  await getMeta(); const st = store.getStats(), t0 = now();
  const cand: { i: string; t: string; due: number }[] = [];
  for (const id in st) { const r = st[id]; if (r[3] >= 0 && r[4] <= t0 && temaOf(id)) cand.push({ i: id, t: temaOf(id)!, due: r[4] }); }
  const ids = selectSpacedReviews(cand.map(item => ({ topicId: item.t, dueAt: item.due, item })), 30).map(review => review.item.i);
  return { items: ids.length ? await byIds(ids) : [], titulo: 'Repaso de fallos · más vencidas primero, temas mezclados' };
}
/** Test de trampas: preguntas que reúnen más de las trampas objetivo (por defecto, las 3 con más fallos). */
export async function trapTest(n: number, only?: (number | string)[], temas?: string[]): Promise<{ items: Question[]; targets: (number | string)[] }> {
  await getMeta();
  const statistics = store.getStats();
  const rates = calculateTrapRates(
    Object.fromEntries(Object.entries(statistics).map(([id, record]) => [id, { attempts: record[0], correct: record[1] }])),
    id => META[id]?.[3] || [],
    5,
  ).filter(rate => rate.errorCount > 0);
  const targets = only || rates.slice(0, 3).map(rate => +rate.trapId);
  if (!targets.length) return { items: [], targets };
  const tg = new Set(targets.map(Number)), ts = temas && temas.length ? new Set(temas) : null;
  const ids = Object.keys(META).filter(id => id !== '_by' && (!ts || ts.has(META[id][0])) && (META[id][3] || []).some((k: number | string) => tg.has(+k)));
  const cands = (await byIds(ids)).filter(question => questionAllowed(question, origenes()));
  const items = selectTrapQuestions(
    cands.map(question => ({ id: question.i, trapIds: question.x || [], question })),
    id => {
      const record = store.rec(id);
      return record ? { lastResult: record[5] } : undefined;
    },
    targets,
    n,
    Math.random,
  ).map(candidate => candidate.question);
  return { items, targets };
}
