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
import type { SessionKind } from '../domain/entities.js';
import type { EngineSnapshot, LastResult, Run, RunCfg } from './session-model.js';
export type { EngineSnapshot, LastResult, Run, RunCfg } from './session-model.js';
import type { Index, Question } from '../../adapters/legacy/types.js';
import type { AttemptIntent } from '../domain/attempts/transitions.js';
import type { AttemptTracker } from '../ports/AttemptTracker.js';
import type { GuestQuestionHistoryRepository } from '../ports/GuestQuestionHistoryRepository.js';
import type { PendingRun } from './runs/pending-run.js';
import type { SavedRunSnapshot } from '../domain/pending-run.js';
import type { SessionStateStore } from '../ports/SessionStateStore.js';

/** Estado compartido: la sesión en curso y la última terminada. */
let fallbackState: EngineSnapshot = { run: null, last: null };
const fallbackSubscribers = new Set<() => void>();
let sessionStateStore: SessionStateStore<EngineSnapshot> = {
  getState: () => fallbackState,
  setState: patch => {
    fallbackState = { ...fallbackState, ...patch };
    fallbackSubscribers.forEach(listener => listener());
  },
  subscribe: listener => { fallbackSubscribers.add(listener); return () => fallbackSubscribers.delete(listener); },
};
export function configureSessionStateStore(store: SessionStateStore<EngineSnapshot>): void {
  if (sessionStateStore.getState().run) throw new Error('No se puede cambiar el store durante una sesión activa.');
  sessionStateStore = store;
}
export function subscribe(fn: () => void): () => void { return sessionStateStore.subscribe(fn); }
let attemptTracker: AttemptTracker | null = null;
export function setAttemptTracker(tracker: AttemptTracker | null): void { attemptTracker = tracker; }
export function flushAttemptTracking(): Promise<void> { return attemptTracker?.flush() || Promise.resolve(); }
function recordAttempt(run: Run, intent: AttemptIntent, index = run.idx): void {
  const attemptId = run.attemptIds?.[index];
  if (attemptTracker && run.attemptScope && attemptId) attemptTracker.record(run.attemptScope, attemptId, intent);
}
export function getSnapshot(): EngineSnapshot { return sessionStateStore.getState(); }
export const getCurrentRun = (): Readonly<Run> | null => getSnapshot().run;
export const getLastResult = (): Readonly<LastResult> | null => getSnapshot().last;
export const getRunKind = (): SessionKind | null => getSnapshot().run?.kind || null;
export const getLastRunKind = (): SessionKind | null => getSnapshot().last?.ses.kind || null;
export const hasActiveRun = (): boolean => getSnapshot().run !== null;
let nextSessionKey = 1;
function copyRun(run: Run): Run {
  return {
    ...run,
    ans: [...run.ans],
    ...(run.times ? { times: [...run.times] } : {}),
    ...(run.studyStates ? { studyStates: [...run.studyStates] } : {}),
    ...(run.confidences ? { confidences: [...run.confidences] } : {}),
    ...(run.discardedOptions ? { discardedOptions: run.discardedOptions.map(options => [...options]) } : {}),
    ...(run.highlights ? { highlights: run.highlights.map(marks => marks.map(mark => ({ ...mark }))) } : {}),
    ...(run.review ? { review: [...run.review] } : {}),
    ...(run.luck ? { luck: { ...run.luck } } : {}),
    ...(run.fast ? { fast: { ...run.fast } } : {}),
    ...(run.attemptIds ? { attemptIds: [...run.attemptIds] } : {}),
  };
}
function updateActiveRun(update: (run: Run) => void, expectedSessionKey?: number): Run | null {
  const activeRun = getSnapshot().run;
  if (!activeRun || expectedSessionKey !== undefined && activeRun.sessionKey !== expectedSessionKey) return null;
  const nextRun = copyRun(activeRun as Run);
  update(nextRun);
  sessionStateStore.setState({ run: nextRun });
  return nextRun;
}
const questionAllowed = (question: Question, origins: Set<string>): boolean =>
  isQuestionAllowed(question.o, 'r' in question ? question.r : undefined, origins);

export function clearActiveRun(): void {
  const run = getSnapshot().run;
  if (!run) return;
  if (run?.attemptSessionId && run.attemptScope && attemptTracker) {
    if (run.tIdx === run.idx && run.attemptIds?.[run.idx] && !run.attemptTrackingPaused) recordAttempt(run, { type: 'close' });
    attemptTracker.closeSession(run.attemptScope, run.attemptSessionId, 'interrupted', now());
  }
  sessionStateStore.setState({ run: null });
}
export function clearLastResult(): void { if (getSnapshot().last) sessionStateStore.setState({ last: null }); }
export function setQuestionIndex(index: number): boolean {
  const run = getSnapshot().run;
  if (!run || run.paused || !Number.isInteger(index) || index < 0 || index >= run.items.length) return false;
  if (run.idx === index) return true;
  if (run.idx !== index && run.tIdx === run.idx) recordAttempt(run, { type: 'leave' });
  updateActiveRun(nextRun => { nextRun.idx = index; }, run.sessionKey);
  return true;
}
export function toggleReviewQuestion(): boolean {
  const run = getSnapshot().run;
  if (!run || run.paused) return false;
  const review = new Set(run.review || []);
  if (review.has(run.idx)) review.delete(run.idx);
  else review.add(run.idx);
  updateActiveRun(nextRun => { nextRun.review = [...review].sort((leftIndex, rightIndex) => leftIndex - rightIndex); }, run.sessionKey);
  return true;
}
export function setRunPaused(paused: boolean): boolean {
  const run = getSnapshot().run;
  if (!run) return false;
  if (run.paused !== paused) recordAttempt(run, { type: paused ? 'pause' : 'resume' });
  if (run.paused !== paused) updateActiveRun(nextRun => { nextRun.paused = paused; }, run.sessionKey);
  return true;
}
export function toggleDeferredBlank(): boolean {
  const run = getSnapshot().run;
  if (!run || run.feedback || run.paused) return false;
  const blank = run.ans[run.idx] !== -1;
  updateActiveRun(nextRun => { nextRun.ans[nextRun.idx] = blank ? -1 : undefined; }, run.sessionKey);
  if (blank) recordAttempt(run, { type: 'mark-pending' });
  return true;
}
export function startCurrentQuestion(timestamp = Date.now()): void {
  const run = getSnapshot().run;
  if (!run || run.tIdx === run.idx) return;
  updateActiveRun(nextRun => { nextRun.tIdx = nextRun.idx; nextRun.q0 = nextRun.secs; nextRun.qT0 = timestamp; }, run.sessionKey);
  if (!run.paused && !run.attemptTrackingPaused) recordAttempt(run, { type: 'open' });
}
/** Pauses only the recorded active-time interval; it does not change the study timer. */
export function setAttemptTrackingVisible(visible: boolean): void {
  const run = getSnapshot().run;
  if (!run || run.attemptTrackingPaused === !visible) return;
  updateActiveRun(nextRun => { nextRun.attemptTrackingPaused = !visible; }, run.sessionKey);
  if (run.tIdx === run.idx) recordAttempt(run, { type: visible ? 'resume' : 'pause' });
}
export function tickCurrentRun(timestamp = Date.now()): void {
  const run = getSnapshot().run;
  if (!run) return;
  const nextRun = tickRun(run as Run, timestamp);
  if (nextRun !== run) sessionStateStore.setState({ run: nextRun });
}
export const currentSecondsRemaining = (): number => getSnapshot().run ? segundosRestantes(getSnapshot().run as Run) : Infinity;
export function answerCurrentQuestion(answer: number, minimumReadingSeconds: number): void {
  const run = getSnapshot().run;
  if (run) answerQuestion(run, run.items[run.idx], answer, minimumReadingSeconds);
}
export function answerCurrentDeferred(answer: number): void { const run = getSnapshot().run; if (run) answerDeferred(run as Run, answer); }
export function finishCurrentRun(reason: 'complete' | 'interrupted' | 'timeout' = 'complete'): LastResult | null {
  const run = getSnapshot().run;
  return run ? finishRun(run as Run, reason) : null;
}

/** Crea la sesión; devuelve null si no hay preguntas puntuables. No navega: eso lo decide la interfaz. */
export function createRun(cfg: RunCfg): Run | null {
  const items = filterScoringQuestions(cfg.items, cfg.feedback, question => question.np);
  if (!items.length) return null;
  const createdAt = now();
  const run = { ...cfg, sessionKey: nextSessionKey++, items, idx: 0, ans: [], confidences: Array.from({ length: items.length }, () => null), discardedOptions: items.map(() => []), highlights: items.map(() => []), ...(cfg.feedback ? { studyStates: Array.from({ length: items.length }, () => 'unseen' as const) } : {}), t0: createdAt, secs: 0, paused: false } as Run;
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
  sessionStateStore.setState({ run });
  return run;
}

// La sesión en curso se guarda para sobrevivir al cierre de la app por iOS (solo sesiones del banco, no los supuestos)
store.onAccountChange(() => { clearActiveRun(); if (getSnapshot().last) sessionStateStore.setState({ last: null }); });
export interface PendingRunStorage {
  write(account: string | null, snapshot: SavedRunSnapshot): void;
  clear(account: string | null): void;
}
let pendingRunStorage: PendingRunStorage | null = null;
export function setPendingRunStorage(storage: PendingRunStorage | null): void { pendingRunStorage = storage; }
export function clearRun(): void { pendingRunStorage?.clear(store.accountId()); }
export function saveRun(): void {
  const run = getSnapshot().run;
  if (!run || run.supTexto || !run.items.every(item => item.i && META && META[item.i])) return;
  const { kind, feedback, titulo, limit, idx, ans, times, secs, porTiempo, review } = run;
  pendingRunStorage?.write(store.accountId(), { kind, feedback, titulo, limit, idx, ans: [...ans], times: times ? [...times] : [], secs, pt: !!porTiempo, ids: run.items.map(item => item.i), review: review || [], ...(feedback && run.studyStates ? { studyStates: [...run.studyStates] } : {}), confidences: run.confidences || [], discardedOptions: run.discardedOptions || [], highlights: run.highlights || [], savedAt: Date.now(), ...(run.attemptScope ? { attemptScope: run.attemptScope } : {}), ...(run.attemptSessionId ? { attemptSessionId: run.attemptSessionId } : {}), ...(run.attemptIds ? { attemptIds: run.attemptIds } : {}) });
}
export function resumeRun({ saved: savedRun, items, account }: PendingRun): Run | null {
  if (account !== store.accountId()) return null;
  const un = <T>(firstValue?: (T | null)[]): (T | undefined)[] => Array.from(firstValue || [], value => value === null ? undefined : value);
  const expectedScope = account || 'guest';
  const hasTracking = savedRun.attemptScope === expectedScope
    && typeof savedRun.attemptSessionId === 'string'
    && Array.isArray(savedRun.attemptIds)
    && savedRun.attemptIds.length === items.length
    && savedRun.attemptIds.every(id => typeof id === 'string');
  const restoredAnswers = un(savedRun.ans);
  const answers = Array.from({ length: items.length }, (ignoredValue, index) => restoredAnswers[index]);
  const validStates = ['unseen', 'pending', 'answered', 'revealed'];
  const hasValidStates = !!savedRun.feedback && Array.isArray(savedRun.studyStates) && savedRun.studyStates.length === items.length
    && savedRun.studyStates.every((state, index) => validStates.includes(state) && (answers[index] !== undefined || state !== 'answered'));
  const states = !!savedRun.feedback ? answers.map((answer, index) => {
    if (answer === -1) return 'revealed'; // Historical -1 was shown with its correct answer in the old practice UI.
    if (typeof answer === 'number') return 'answered';
    return hasValidStates ? savedRun.studyStates![index] : 'unseen';
  }) : undefined;
  const confidences: Confidence[] = items.map((item, index) => {
    const value = savedRun.confidences?.[index];
    return value === 'sure' || value === 'betweenTwo' || value === 'guess' ? value : null;
  });
  const discardedOptions = items.map((question, index) => Array.isArray(savedRun.discardedOptions?.[index])
    ? [...new Set(savedRun.discardedOptions[index].filter(option => Number.isInteger(option) && option >= 0 && option < question.a.length))]
    : []);
  const validHighlight = (mark: Highlight): boolean => Boolean(mark && typeof mark.id === 'string'
    && (mark.field === 'statement' || /^option:\d+$/.test(mark.field))
    && Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= 0 && mark.end > mark.start
    && typeof mark.text === 'string' && typeof mark.contentRevision === 'string');
  const highlights = items.map((item, index) => Array.isArray(savedRun.highlights?.[index]) ? savedRun.highlights[index].filter(validHighlight) : []);
  const run = { kind: savedRun.kind, sessionKey: nextSessionKey++, feedback: !!savedRun.feedback, titulo: savedRun.titulo, limit: savedRun.limit || 0, porTiempo: !!savedRun.pt, items, idx: savedRun.idx, ans: answers, times: un(savedRun.times), t0: now(), secs: savedRun.secs || 0, paused: false, confidences, discardedOptions, highlights, review: (Array.isArray(savedRun.review) ? savedRun.review : []).filter(index => Number.isInteger(index) && index >= 0 && index < items.length), ...(states ? { studyStates: states } : {}), ...(hasTracking ? { attemptScope: savedRun.attemptScope, attemptSessionId: savedRun.attemptSessionId, attemptIds: savedRun.attemptIds!.slice() } : {}) } as Run;
  if (run.attemptSessionId && run.attemptScope && run.attemptIds) attemptTracker?.resumeSession(run.attemptScope, run.attemptSessionId, run.attemptIds);
  sessionStateStore.setState({ run });
  return run;
}

// ───────── tiempo y respuestas ─────────
/** El tiempo sale de la hora real (no de contar ticks): iOS frena los timers con la pantalla bloqueada. */
export function tickRun(run: Run, timestamp = Date.now()): Run {
  if (run.paused) return run.since === null ? run : { ...run, since: null };
  const since = run.since ?? timestamp;
  const base = run.since == null ? run.secs : run.base;
  const secs = (base ?? 0) + Math.floor((timestamp - since) / 1000);
  return secs === run.secs && since === run.since && base === run.base ? run : { ...run, since, base, secs };
}
/** Segundos que quedan; con límite 0 devuelve Infinity. */
export const segundosRestantes = (run: Run): number => run.limit ? run.limit * 60 - run.secs : Infinity;
/** Anota en el progreso la respuesta de una pregunta con corrección inmediata (i = -1: «no lo sé»). */
export function answerQuestion(run: Run, question: Question, index: number, minLect: number): void {
  const activeRun = getSnapshot().run;
  if (!activeRun || activeRun.sessionKey !== run.sessionKey) return;
  const currentState = activeRun.studyStates?.[activeRun.idx] || 'unseen';
  if (activeRun.feedback && (currentState === 'answered' || currentState === 'revealed' || index === -1 && currentState === 'pending')) return;
  updateActiveRun(nextRun => {
    if (!nextRun.feedback) {
      nextRun.ans[nextRun.idx] = index;
      (nextRun.luck ||= {})[nextRun.idx] = store.rec(question.i)?.[9] || 0;
      (nextRun.fast ||= {})[nextRun.idx] = [Math.round((Date.now() - (nextRun.qT0 ?? Date.now())) / 1000), minLect];
      if (index === -1) recordAttempt(nextRun, { type: 'mark-pending' });
      else recordAttempt(nextRun, { type: 'answer', optionIndex: index, outcome: index === question.c ? 'correct' : 'wrong' });
      store.record(question.i, question.t, index === -1 ? 2 : index === question.c ? 1 : 0, now(), index === -1 ? undefined : Math.max(1, nextRun.secs - (nextRun.q0 ?? 0)));
      return;
    }
    nextRun.studyStates ||= [];
    if (index === -1) {
      nextRun.studyStates[nextRun.idx] = 'pending';
      recordAttempt(nextRun, { type: 'mark-pending' });
      return;
    }
    nextRun.ans[nextRun.idx] = index;
    nextRun.studyStates[nextRun.idx] = 'answered';
    (nextRun.luck ||= {})[nextRun.idx] = store.rec(question.i)?.[9] || 0;
    (nextRun.fast ||= {})[nextRun.idx] = [Math.round((Date.now() - (nextRun.qT0 ?? Date.now())) / 1000), minLect];
    recordAttempt(nextRun, { type: 'answer', optionIndex: index, outcome: index === question.c ? 'correct' : 'wrong' });
    store.record(question.i, question.t, index === question.c ? 1 : 0, now(), Math.max(1, nextRun.secs - (nextRun.q0 ?? 0)));
  }, activeRun.sessionKey);
}
/** Reveals only a previously deferred practice question; consultation has no score effect. */
export function revealCurrentSolution(): boolean {
  const run = getSnapshot().run;
  if (!run?.feedback || (run.studyStates?.[run.idx] || 'unseen') !== 'pending' || run.ans[run.idx] !== undefined) return false;
  updateActiveRun(nextRun => { nextRun.studyStates![nextRun.idx] = 'revealed'; }, run.sessionKey);
  recordAttempt(run, { type: 'reveal' });
  return true;
}
export function setCurrentConfidence(value: Exclude<Confidence, null>): boolean {
  const run = getSnapshot().run;
  if (!run || run.paused || !['sure', 'betweenTwo', 'guess'].includes(value)) return false;
  const locked = run.feedback
    ? ['answered', 'revealed'].includes(run.studyStates?.[run.idx] || 'unseen')
    : typeof run.ans[run.idx] === 'number' && run.ans[run.idx]! >= 0;
  if (locked || run.confidences?.[run.idx] === value) return false;
  updateActiveRun(nextRun => { nextRun.confidences ||= []; nextRun.confidences[nextRun.idx] = value; }, run.sessionKey);
  recordAttempt(run, { type: 'set-confidence', value });
  return true;
}
export function toggleCurrentDiscardedOption(optionIndex: number): boolean {
  const run = getSnapshot().run;
  const question = run?.items[run.idx];
  if (!run || !question || run.paused || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.a.length) return false;
  const locked = run.feedback
    ? ['answered', 'revealed'].includes(run.studyStates?.[run.idx] || 'unseen')
    : typeof run.ans[run.idx] === 'number' && run.ans[run.idx]! >= 0;
  if (locked) return false;
  const current = run.discardedOptions?.[run.idx] || [];
  if (current.includes(optionIndex)) {
    updateActiveRun(nextRun => { nextRun.discardedOptions ||= []; nextRun.discardedOptions[nextRun.idx] = current.filter(index => index !== optionIndex); }, run.sessionKey);
    recordAttempt(run, { type: 'restore-option', optionIndex });
  } else {
    updateActiveRun(nextRun => { nextRun.discardedOptions ||= []; nextRun.discardedOptions[nextRun.idx] = [...current, optionIndex].sort((left, right) => left - right); }, run.sessionKey);
    recordAttempt(run, { type: 'discard-option', optionIndex });
  }
  return true;
}
export function addCurrentHighlight(highlight: Highlight): boolean {
  const run = getSnapshot().run;
  if (!run || run.paused || run.highlights?.[run.idx]?.some(mark => mark.id === highlight.id)) return false;
  const question = run.items[run.idx];
  const optionIndex = highlight.field.startsWith('option:') ? Number(highlight.field.slice(7)) : null;
  if (optionIndex !== null && (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.a.length)) return false;
  updateActiveRun(nextRun => { nextRun.highlights ||= nextRun.items.map(() => []); nextRun.highlights[nextRun.idx] = [...(nextRun.highlights[nextRun.idx] || []), highlight]; }, run.sessionKey);
  recordAttempt(run, { type: 'add-highlight', highlight });
  return true;
}
export function removeCurrentHighlight(highlightId: string): boolean {
  const run = getSnapshot().run;
  const marks = run?.highlights?.[run.idx];
  if (!run || run.paused || !marks?.some(mark => mark.id === highlightId)) return false;
  updateActiveRun(nextRun => { nextRun.highlights![nextRun.idx] = marks.filter(mark => mark.id !== highlightId); }, run.sessionKey);
  recordAttempt(run, { type: 'remove-highlight', highlightId });
  return true;
}
/** Respuesta en modo examen (sin corrección): se guarda al terminar. */
export function answerDeferred(run: Run, index: number): void {
  const activeRun = getSnapshot().run;
  if (!activeRun || activeRun.sessionKey !== run.sessionKey) return;
  updateActiveRun(nextRun => {
    nextRun.ans[nextRun.idx] = index;
    (nextRun.times ||= [])[nextRun.idx] = Math.max(1, nextRun.secs - (nextRun.q0 ?? 0));
    const question = nextRun.items[nextRun.idx];
    if (index === -1) recordAttempt(nextRun, { type: 'mark-pending' });
    else recordAttempt(nextRun, { type: 'answer', optionIndex: index, outcome: index === question.c ? 'correct' : 'wrong' });
  }, activeRun.sessionKey);
}

/** Cierra la sesión: puntúa, guarda en el progreso y publica el resultado. null = no se contestó nada. */
export function finishRun(run: Run, reason: 'complete' | 'interrupted' | 'timeout' = 'complete'): LastResult | null {
  const activeRun = getSnapshot().run;
  if (!activeRun || activeRun.sessionKey !== run.sessionKey) return null;
  run = activeRun as Run;
  clearRun();
  if (run.attemptSessionId && run.attemptScope && attemptTracker) {
    if (run.tIdx === run.idx && run.attemptIds?.[run.idx] && !run.attemptTrackingPaused) recordAttempt(run, { type: 'close' });
    attemptTracker.closeSession(run.attemptScope, run.attemptSessionId, reason === 'interrupted' ? 'interrupted' : 'completed', now(), run.secs);
  }
  // «por tiempo»: solo cuentan las preguntas que llegaste a contestar (la que estaba abierta al acabar el tiempo no)
  let hechas = run.items.length;
  if (run.porTiempo) { hechas = 0; run.ans.forEach((numericValue, index) => { if (numericValue !== undefined) hechas = index + 1; }); if (!hechas) { sessionStateStore.setState({ run: null }); return null; } }
  const items = run.items.slice(0, hechas), res = { a: 0, f: 0, b: 0 }, fails: string[] = [];
  const porTema: Record<string, [number, number]> = {}, porTipo: Record<string, [number, number]> = {};
  items.forEach((item, index) => {
    const numericValue = run.ans[index]; const ok = numericValue === item.c;
    const pt = porTema[item.t] ||= [0, 0]; pt[1]++;
    const tk: string | undefined = META[item.i]?.[2]; const ptk = tk ? (porTipo[tk] ||= [0, 0]) : null; if (ptk) ptk[1]++;
    if (numericValue === undefined || numericValue === -1) { res.b++; if (!run.feedback) store.record(item.i, item.t, 2); }
    else if (ok) { res.a++; pt[0]++; if (ptk) ptk[0]++; if (!run.feedback) store.record(item.i, item.t, 1, now(), run.times?.[index]); }
    else { res.f++; fails.push(item.i); if (!run.feedback) store.record(item.i, item.t, 0, now(), run.times?.[index]); }
  });
  const itemCount = items.length;
  const ses = { id: 's' + now().toString(36), ts: now(), kind: run.kind, n: itemCount, a: res.a, f: res.f, b: res.b, secs: run.porTiempo ? Math.min(run.secs, (run.limit ?? 0) * 60) : run.secs, nota: calculateExamScore(res.a, res.f, itemCount), temas: porTema, tipos: porTipo, fails, titulo: run.titulo || '', ...(reason === 'interrupted' ? { interrupted: true } : {}), ...(run.porTiempo ? { porTiempo: true } : {}) };
  store.addSession(ses);
  sessionStateStore.setState({ run: null });
  const result: LastResult = {
    ses, items, ans: [...run.ans], times: [...(run.times || [])], limit: run.limit || 0,
    ...(run.studyStates ? { studyStates: [...run.studyStates] } : {}),
    confidences: [...(run.confidences || [])],
    discardedOptions: (run.discardedOptions || []).map(options => [...options]),
    highlights: (run.highlights || []).map(marks => marks.map(mark => ({ ...mark }))),
  };
  sessionStateStore.setState({ last: result });
  return result;
}

// ───────── selección de preguntas ─────────
const origenes = (): Set<string> => new Set(((store.getCfg().test || {}) as { o?: string[] }).o || ['O', 'A', 'G']);
/** Ids de preguntas con un fallo pendiente de superar. */
export const falladasIds = (): string[] => { const st = store.getStats(); return Object.keys(st).filter(id => temaOf(id) && store.pendingFailure(st[id])); };

const emptyGuestQuestionHistory: GuestQuestionHistoryRepository = {
  readRecentQuestionIds: () => [],
  saveRecentQuestionIds: () => {},
};
async function quickGuest(idx: Index, numericValue: number, orgs: Set<string>, history: GuestQuestionHistoryRepository): Promise<Question[]> {
  const last = history.readRecentQuestionIds();
  const temas = shuffleItems(idx.temas, Math.random).slice(0, numericValue + 3);
  const pools = (await Promise.all(temas.map(topic => getTema(topic.id)))).map((questions, index) => ({
    topicId: temas[index].id,
    questions: filterScoringQuestions(
      questions.filter(question => questionAllowed(question, orgs)),
      true,
      question => question.np,
    ),
  }));
  const items = pickGuestQuestions(pools, numericValue, question => question.i, id => !!store.rec(id), new Set(last), Math.random);
  history.saveRecentQuestionIds([...last, ...items.map(item => item.i)].slice(-300));
  return items;
}
export interface Seleccion { items: Question[]; titulo: string }
/** Sesión rápida (~5 min). Invitado: una pregunta de cada tema al azar. Con acceso: repasos vencidos + nuevas de los temas más débiles. */
export async function quickItems(full: boolean, history: GuestQuestionHistoryRepository = emptyGuestQuestionHistory): Promise<Seleccion | { items: []; titulo: '' }> {
  const idx = await getIndex(); await getMeta();
  const numericValue = estimateQuickQuestionCount(Object.values(store.getStats()).map(record => ({
    totalSeconds: record[7],
    count: record[8],
  })));
  const orgs = origenes();
  if (!full) return { items: await quickGuest(idx, numericValue, orgs, history), titulo: 'Sesión rápida · una pregunta por tema' };
  const due = (await byIds((await dueList()).slice(0, numericValue))).filter(question => questionAllowed(question, orgs));
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
  temas.sort((leftTopic, rightTopic) => (ord[leftTopic.est] - ord[rightTopic.est]) || ((rightTopic.dias ?? 0) - (leftTopic.dias ?? 0)));
  const pools: Question[][] = [];
  for (const questions of await Promise.all(temas.slice(0, 8).map(item => getTema(item.id)))) {
    pools.push(shuffleItems(questions.filter(question => questionAllowed(question, orgs) && !store.rec(question.i)), Math.random));
  }
  const items = pickQuickQuestions(due, pools, numericValue, question => question.i, Math.random);
  const nd = items.filter(item => store.rec(item.i)).length;
  return { items, titulo: `Sesión rápida · ${nd} repasos + ${items.length - nd} nuevas` };
}
/** Repaso de fallos: las más vencidas primero, temas mezclados. */
export async function repasoItems(): Promise<Seleccion> {
  await getMeta(); const st = store.getStats(), t0 = now();
  const cand: { i: string; t: string; due: number }[] = [];
  for (const id in st) { const statRecord = st[id]; if (statRecord[3] >= 0 && statRecord[4] <= t0 && temaOf(id)) cand.push({ i: id, t: temaOf(id)!, due: statRecord[4] }); }
  const ids = selectSpacedReviews(cand.map(item => ({ topicId: item.t, dueAt: item.due, item })), 30).map(review => review.item.i);
  return { items: ids.length ? await byIds(ids) : [], titulo: 'Repaso de fallos · más vencidas primero, temas mezclados' };
}
/** Test de trampas: preguntas que reúnen más de las trampas objetivo (por defecto, las 3 con más fallos). */
export async function trapTest(itemCount: number, only?: (number | string)[], temas?: string[]): Promise<{ items: Question[]; targets: (number | string)[] }> {
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
  const ids = Object.keys(META).filter(id => id !== '_by' && (!ts || ts.has(META[id][0])) && (META[id][3] || []).some((key: number | string) => tg.has(+key)));
  const cands = (await byIds(ids)).filter(question => questionAllowed(question, origenes()));
  const items = selectTrapQuestions(
    cands.map(question => ({ id: question.i, trapIds: question.x || [], question })),
    id => {
      const record = store.rec(id);
      return record ? { lastResult: record[5] } : undefined;
    },
    targets,
    itemCount,
    Math.random,
  ).map(candidate => candidate.question);
  return { items, targets };
}
