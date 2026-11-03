// Motor de preguntas: estado de la sesión en curso, guardado y reanudación, registro de respuestas, cierre con nota
// y selección de preguntas (sesión rápida, repaso, trampas). Sin DOM: la interfaz solo pinta y llama a estas funciones.
import { calculateExamScore } from '../domain/scoring.js';
import { calculateRubricScore } from '../domain/simulation-scoring.js';
import { filterScoringQuestions } from '../domain/selection.js';
import type { Confidence, Highlight, SelfAssessment } from '../domain/attempts/transitions.js';
import { questionContentRevision } from '../domain/attempts/highlights.js';
import type { SessionKind, SessionResult } from '../domain/entities.js';
import type { QuestionRecord } from '../domain/question-record.js';
import type { EngineSnapshot, LastResult, Run, RunCfg } from './session-model.js';
export type { EngineSnapshot, LastResult, Run, RunCfg } from './session-model.js';
import type { AttemptIntent } from '../domain/attempts/transitions.js';
import type { AttemptTracker } from '../ports/AttemptTracker.js';
import type { StudyProgressGateway } from '../ports/StudyProgressGateway.js';
import type { StudyQuestionCatalog } from '../ports/StudyQuestionCatalog.js';
import type { PendingRun } from './runs/pending-run.js';
import type { SavedRunSnapshot } from '../domain/pending-run.js';

type Question = QuestionRecord;
export interface StudyEngineDependencies { progress: StudyProgressGateway; catalog: StudyQuestionCatalog }
let dependencies: StudyEngineDependencies | null = null;
let stopListeningToAccount: (() => void) | undefined;
function getDependencies(): StudyEngineDependencies {
  if (!dependencies) throw new Error('El motor de estudio todavía no se ha configurado.');
  return dependencies;
}
const progress = (): StudyProgressGateway => getDependencies().progress;
const catalog = (): StudyQuestionCatalog => getDependencies().catalog;

export function configureStudyEngine(deps: StudyEngineDependencies): void {
  if (getSnapshot().run) throw new Error('No se puede cambiar el catálogo durante una sesión activa.');
  stopListeningToAccount?.();
  dependencies = deps;
  stopListeningToAccount = deps.progress.onAccountChange(() => {
    clearActiveRun();
    if (getSnapshot().last) sessionStateStore.setState({ last: null });
  });
}
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
function recordAttempt(run: Run, intent: AttemptIntent, index = run.idx): Promise<boolean> {
  const attemptId = run.attemptIds?.[index];
  if (attemptTracker && run.attemptScope && attemptId) return attemptTracker.record(run.attemptScope, attemptId, intent);
  return Promise.resolve(true);
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
    ...(run.selfAssessments ? { selfAssessments: [...run.selfAssessments] } : {}),
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
export function clearActiveRun(): void {
  const run = getSnapshot().run;
  if (!run) return;
  if (run?.attemptSessionId && run.attemptScope && attemptTracker) {
    if (run.tIdx === run.idx && run.attemptIds?.[run.idx] && !run.attemptTrackingPaused) recordAttempt(run, { type: 'close' });
    attemptTracker.closeSession(run.attemptScope, run.attemptSessionId, 'interrupted', catalog().now());
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
  if (run.paused === paused) return true;
  const timestamp = Date.now();
  const current = paused ? tickRun(run, timestamp) : run;
  recordAttempt(run, { type: paused ? 'pause' : 'resume' });
  updateActiveRun(nextRun => {
    nextRun.secs = current.secs;
    nextRun.base = current.secs;
    nextRun.since = paused ? null : timestamp;
    nextRun.paused = paused;
  }, run.sessionKey);
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
export function createRun(cfg: RunCfg, sourceSessionId?: string): Run | null {
  const items = filterScoringQuestions(cfg.items, cfg.feedback, question => question.np);
  if (!items.length) return null;
  const createdAt = catalog().now();
  const metadata = catalog().getMetadataSnapshot();
  const run = { ...cfg, sessionKey: nextSessionKey++, items, idx: 0, ans: [], confidences: Array.from({ length: items.length }, () => null), discardedOptions: items.map(() => []), highlights: items.map(() => []), ...(cfg.feedback ? { studyStates: Array.from({ length: items.length }, () => 'unseen' as const) } : {}), t0: createdAt, secs: 0, paused: false } as Run;
  if (cfg.feedback) run.selfAssessments = Array.from({ length: items.length }, () => undefined);
  if (attemptTracker && items.every(question => question.i && metadata?.[question.i])) {
    const scope = progress().accountId() || 'guest';
    const tracking = attemptTracker.beginSession(
      scope,
      cfg.kind === 'sim' ? 'simulation' : 'practice',
      createdAt,
      items.map((question, position) => ({
        questionId: question.i,
        contentRevision: questionContentRevision(question.q, question.a),
        position,
        exposure: Math.max(1, (progress().getQuestionStats(question.i)?.attempts || 0) + 1),
        ...(cfg.exposureKind ? { exposureKind: cfg.exposureKind } : {}),
        ...(cfg.retryOfAttemptId ? { retryOfAttemptId: cfg.retryOfAttemptId } : {}),
      })),
      cfg.limit,
      sourceSessionId,
    );
    run.attemptScope = scope;
    run.attemptSessionId = tracking.session.id;
    run.attemptIds = tracking.attempts.map(attempt => attempt.id);
  }
  sessionStateStore.setState({ run });
  return run;
}

export interface PendingRunStorage {
  write(account: string | null, snapshot: SavedRunSnapshot): boolean;
  clear(account: string | null): void;
}
let pendingRunStorage: PendingRunStorage | null = null;
export function setPendingRunStorage(storage: PendingRunStorage | null): void { pendingRunStorage = storage; }
export function clearRun(): void { pendingRunStorage?.clear(progress().accountId()); }
function canPersistRun(run: Run, metadata: ReturnType<StudyQuestionCatalog['getMetadataSnapshot']>): boolean {
  return !run.supTexto && run.items.every(item => !!item.i && !!metadata?.[item.i]);
}

function savedRunSnapshot(run: Run): SavedRunSnapshot {
  const { kind, feedback, titulo, limit, idx, ans, times, secs, porTiempo, review } = run;
  return {
    kind, feedback, titulo, limit, idx, ans: [...ans], times: times ? [...times] : [], secs, pt: !!porTiempo,
    ids: run.items.map(item => item.i), review: review || [],
    ...(feedback && run.studyStates ? { studyStates: [...run.studyStates] } : {}),
    confidences: run.confidences || [], discardedOptions: run.discardedOptions || [], highlights: run.highlights || [],
    ...(run.selfAssessments ? { selfAssessments: run.selfAssessments.map(value => value ?? null) } : {}),
    savedAt: Date.now(),
    ...(run.attemptScope ? { attemptScope: run.attemptScope } : {}),
    ...(run.attemptSessionId ? { attemptSessionId: run.attemptSessionId } : {}),
    ...(run.attemptIds ? { attemptIds: run.attemptIds } : {}),
    ...(run.trainingActivity ? { trainingActivity: run.trainingActivity } : {}),
    ...(run.trainingActivityReference ? { trainingActivityReference: run.trainingActivityReference } : {}),
    ...(run.exposureKind ? { exposureKind: run.exposureKind } : {}),
    ...(run.retryOfAttemptId ? { retryOfAttemptId: run.retryOfAttemptId } : {}),
    ...(run.scoringPolicy ? { scoringPolicy: { ...run.scoringPolicy } } : {}),
    ...(run.milestoneEventId ? { milestoneEventId: run.milestoneEventId } : {}),
  };
}

export function saveRun(): boolean {
  const run = getSnapshot().run;
  if (!run) return false;
  const metadata = catalog().getMetadataSnapshot();
  if (!canPersistRun(run, metadata) || !pendingRunStorage) return false;
  return pendingRunStorage.write(progress().accountId(), savedRunSnapshot(run));
}

/** Starts a single-question retry as a separate immediate exposure, preserving the original attempt. */
export function startImmediateRetryFromLastResult(questionId: string, sourceAvailable: boolean): boolean {
  const last = getSnapshot().last;
  if (getSnapshot().run || !last?.feedback || last.exposureKind === 'immediate-retry' || !last.attemptIds) return false;
  const index = last.items.findIndex(item => item.i === questionId);
  if (index < 0 || !last.attemptIds[index]) return false;
  const state = last.studyStates?.[index] || (typeof last.ans[index] === 'number' && last.ans[index]! >= 0 ? 'answered' : 'unseen');
  const question = last.items[index];
  const metadata = catalog().getMetadataSnapshot();
  const hasCorrectableQuestion = question && !question.np && typeof question.i === 'string' && !!metadata?.[question.i]
    && sourceAvailable
    && Number.isInteger(question.c) && question.c >= 0 && question.c < question.a.length && question.a.length >= 2;
  if (!hasCorrectableQuestion || state !== 'answered' && state !== 'revealed') return false;

  const retryConfiguration: RunCfg = {
    kind: 'rev', feedback: true, items: [question], titulo: `Reintento inmediato · ${last.ses.titulo || 'Práctica'}`,
    exposureKind: 'immediate-retry', retryOfAttemptId: last.attemptIds[index],
  };
  if (!createRun(retryConfiguration)) return false;
  startCurrentQuestion();
  return true;
}

function restoreOptionalValues<Value>(values?: (Value | null)[]): (Value | undefined)[] {
  return Array.from(values || [], value => value === null ? undefined : value);
}

function hasValidAttemptTracking(saved: SavedRunSnapshot, itemCount: number, account: string | null): boolean {
  return saved.attemptScope === (account || 'guest')
    && typeof saved.attemptSessionId === 'string'
    && Array.isArray(saved.attemptIds)
    && saved.attemptIds.length === itemCount
    && saved.attemptIds.every(id => typeof id === 'string');
}

function restoreStudyStates(saved: SavedRunSnapshot, answers: Run['ans'], itemCount: number): Run['studyStates'] | undefined {
  if (!saved.feedback) return undefined;
  const validStates = ['unseen', 'pending', 'answered', 'revealed'];
  const hasValidStates = Array.isArray(saved.studyStates) && saved.studyStates.length === itemCount
    && saved.studyStates.every((state, index) => validStates.includes(state) && (answers[index] !== undefined || state !== 'answered'));
  return answers.map((answer, index) => {
    if (answer === -1) return 'revealed'; // Historical -1 was shown with its correct answer in the old practice UI.
    if (typeof answer === 'number') return 'answered';
    return hasValidStates ? saved.studyStates![index] : 'unseen';
  });
}

function restoreConfidences(saved: SavedRunSnapshot, items: QuestionRecord[]): Confidence[] {
  return items.map((_item, index) => {
    const value = saved.confidences?.[index];
    return value === 'sure' || value === 'betweenTwo' || value === 'guess' ? value : null;
  });
}

function restoreDiscardedOptions(saved: SavedRunSnapshot, items: QuestionRecord[]): number[][] {
  return items.map((question, index) => Array.isArray(saved.discardedOptions?.[index])
    ? [...new Set(saved.discardedOptions[index].filter(option => Number.isInteger(option) && option >= 0 && option < question.a.length))]
    : []);
}

function isValidHighlight(mark: Highlight): boolean {
  return Boolean(mark && typeof mark.id === 'string'
    && (mark.field === 'statement' || /^option:\d+$/.test(mark.field))
    && Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= 0 && mark.end > mark.start
    && typeof mark.text === 'string' && typeof mark.contentRevision === 'string');
}

function restoreHighlights(saved: SavedRunSnapshot, items: QuestionRecord[]): Highlight[][] {
  return items.map((_item, index) => Array.isArray(saved.highlights?.[index]) ? saved.highlights[index].filter(isValidHighlight) : []);
}

function restoreReview(saved: SavedRunSnapshot, itemCount: number): number[] {
  return (Array.isArray(saved.review) ? saved.review : []).filter(index => Number.isInteger(index) && index >= 0 && index < itemCount);
}

function createResumedRun(saved: SavedRunSnapshot, items: QuestionRecord[], answers: Run['ans'], account: string | null): Run {
  const hasTracking = hasValidAttemptTracking(saved, items.length, account);
  const states = restoreStudyStates(saved, answers, items.length);
  const run: Run = {
    kind: saved.kind,
    sessionKey: nextSessionKey++,
    feedback: !!saved.feedback,
    titulo: saved.titulo,
    limit: saved.limit || 0,
    porTiempo: !!saved.pt,
    items,
    idx: saved.idx,
    ans: answers,
    times: restoreOptionalValues(saved.times),
    t0: catalog().now(),
    secs: saved.secs || 0,
    paused: false,
    confidences: restoreConfidences(saved, items),
    ...(saved.feedback ? { selfAssessments: items.map((_item, index) => saved.selfAssessments?.[index] === 'could-explain' || saved.selfAssessments?.[index] === 'needs-help' ? saved.selfAssessments[index]! : undefined) } : {}),
    discardedOptions: restoreDiscardedOptions(saved, items),
    highlights: restoreHighlights(saved, items),
    review: restoreReview(saved, items.length),
    ...(states ? { studyStates: states } : {}),
    ...(hasTracking ? { attemptScope: saved.attemptScope, attemptSessionId: saved.attemptSessionId, attemptIds: saved.attemptIds!.slice() } : {}),
    ...(saved.trainingActivity ? { trainingActivity: saved.trainingActivity } : {}),
    ...(saved.trainingActivityReference ? { trainingActivityReference: saved.trainingActivityReference } : {}),
    ...(saved.exposureKind === 'immediate-retry' && saved.retryOfAttemptId ? { exposureKind: saved.exposureKind, retryOfAttemptId: saved.retryOfAttemptId } : {}),
    ...(saved.scoringPolicy ? { scoringPolicy: { ...saved.scoringPolicy } } : {}),
    ...(saved.milestoneEventId ? { milestoneEventId: saved.milestoneEventId } : {}),
  };
  return run;
}

export function resumeRun({ saved: savedRun, items, account }: PendingRun): Run | null {
  if (account !== progress().accountId()) return null;
  const restoredAnswers = restoreOptionalValues(savedRun.ans);
  const answers = Array.from({ length: items.length }, (_value, index) => restoredAnswers[index]);
  const run = createResumedRun(savedRun, items, answers, account);
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
function saveUncorrectedAnswer(run: Run, question: Question, index: number, minimumReadingSeconds: number): void {
  run.ans[run.idx] = index;
  (run.luck ||= {})[run.idx] = progress().getQuestionStats(question.i)?.errorReason || 0;
  (run.fast ||= {})[run.idx] = [Math.round((Date.now() - (run.qT0 ?? Date.now())) / 1000), minimumReadingSeconds];
  if (index === -1) recordAttempt(run, { type: 'mark-pending' });
  else recordAttempt(run, { type: 'answer', optionIndex: index, outcome: index === question.c ? 'correct' : 'wrong' });
  progress().recordAnswer(question.i, question.t, index === -1 ? 2 : index === question.c ? 1 : 0, catalog().now(), index === -1 ? undefined : Math.max(1, run.secs - (run.q0 ?? 0)));
}

function savePendingStudyAnswer(run: Run): void {
  run.studyStates ||= [];
  run.studyStates[run.idx] = 'pending';
  recordAttempt(run, { type: 'mark-pending' });
}

function saveCorrectedStudyAnswer(run: Run, question: Question, index: number, minimumReadingSeconds: number): void {
  run.ans[run.idx] = index;
  run.studyStates ||= [];
  run.studyStates[run.idx] = 'answered';
  (run.luck ||= {})[run.idx] = progress().getQuestionStats(question.i)?.errorReason || 0;
  (run.fast ||= {})[run.idx] = [Math.round((Date.now() - (run.qT0 ?? Date.now())) / 1000), minimumReadingSeconds];
  recordAttempt(run, { type: 'answer', optionIndex: index, outcome: index === question.c ? 'correct' : 'wrong' });
  if (run.exposureKind !== 'immediate-retry') {
    progress().recordAnswer(question.i, question.t, index === question.c ? 1 : 0, catalog().now(), Math.max(1, run.secs - (run.q0 ?? 0)));
  }
}

function canAnswerStudyQuestion(run: Run, index: number): boolean {
  const state = run.studyStates?.[run.idx] || 'unseen';
  return !run.feedback || !(['answered', 'revealed'].includes(state) || index === -1 && state === 'pending');
}

export function answerQuestion(run: Run, question: Question, index: number, minLect: number): void {
  const activeRun = getSnapshot().run;
  if (!activeRun || activeRun.sessionKey !== run.sessionKey) return;
  if (!canAnswerStudyQuestion(activeRun, index)) return;
  updateActiveRun(nextRun => {
    if (!nextRun.feedback) saveUncorrectedAnswer(nextRun, question, index, minLect);
    else if (index === -1) savePendingStudyAnswer(nextRun);
    else saveCorrectedStudyAnswer(nextRun, question, index, minLect);
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
/** Records an optional learner self-assessment after practice feedback; it never changes score or answer outcome. */
export function setCurrentSelfAssessment(value: SelfAssessment, retryEvent = false): Promise<boolean> {
  const run = getSnapshot().run;
  if (!run || run.paused || !run.feedback || !['could-explain', 'needs-help'].includes(value)) return Promise.resolve(false);
  const state = run.studyStates?.[run.idx] || 'unseen';
  const sameValue = run.selfAssessments?.[run.idx] === value;
  if ((state !== 'answered' && state !== 'revealed') || sameValue && !retryEvent) return Promise.resolve(false);
  const attemptId = run.attemptIds?.[run.idx];
  if (!sameValue) updateActiveRun(nextRun => { nextRun.selfAssessments ||= nextRun.items.map(() => undefined); nextRun.selfAssessments[nextRun.idx] = value; }, run.sessionKey);
  if (!attemptTracker || !run.attemptScope || !attemptId) return Promise.resolve(true);
  return attemptTracker.record(run.attemptScope, attemptId, { type: 'self-assess', value });
}
export function toggleCurrentDiscardedOption(optionIndex: number): boolean {
  const run = getSnapshot().run;
  const question = run?.items[run.idx];
  if (!run || !question || !canToggleDiscardedOption(run, question, optionIndex)) return false;
  const current = run.discardedOptions?.[run.idx] || [];
  const restoring = current.includes(optionIndex);
  const discarded = restoring ? current.filter(index => index !== optionIndex) : [...current, optionIndex].sort((left, right) => left - right);
  updateActiveRun(nextRun => { nextRun.discardedOptions ||= []; nextRun.discardedOptions[nextRun.idx] = discarded; }, run.sessionKey);
  recordAttempt(run, { type: restoring ? 'restore-option' : 'discard-option', optionIndex });
  return true;
}

function canToggleDiscardedOption(run: Run, question: Question, optionIndex: number): boolean {
  if (run.paused || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.a.length) return false;
  const state = run.studyStates?.[run.idx] || 'unseen';
  if (run.feedback) return !['answered', 'revealed'].includes(state);
  return !(typeof run.ans[run.idx] === 'number' && run.ans[run.idx]! >= 0);
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

type SessionTotals = { correct: number; wrong: number; blank: number };
type SessionBreakdown = {
  results: SessionTotals;
  failures: string[];
  topics: Record<string, [number, number]>;
  types: Record<string, [number, number]>;
};

function completedItemCount(run: Run): number {
  if (!run.porTiempo) return run.items.length;
  let completed = 0;
  run.ans.forEach((answer, index) => { if (answer !== undefined) completed = index + 1; });
  return completed;
}

function recordProgressAnswer(run: Run, item: QuestionRecord, index: number, result: 0 | 1 | 2): void {
  if (run.feedback) return;
  if (result === 2) progress().recordAnswer(item.i, item.t, result);
  else progress().recordAnswer(item.i, item.t, result, catalog().now(), run.times?.[index]);
}

function applyAnswerResult(run: Run, item: QuestionRecord, index: number, totals: SessionBreakdown, topic: [number, number], type: [number, number] | null): void {
  const answer = run.ans[index];
  if (answer === undefined || answer === -1) {
    totals.results.blank++;
    recordProgressAnswer(run, item, index, 2);
    return;
  }
  if (answer === item.c) {
    totals.results.correct++;
    topic[0]++;
    if (type) type[0]++;
    recordProgressAnswer(run, item, index, 1);
    return;
  }
  totals.results.wrong++;
  totals.failures.push(item.i);
  recordProgressAnswer(run, item, index, 0);
}

function addAnswerToTotals(run: Run, item: QuestionRecord, index: number, totals: SessionBreakdown): void {
  const topic = totals.topics[item.t] ||= [0, 0];
  topic[1]++;
  const questionType = catalog().getMetadataSnapshot()?.[item.i]?.[2];
  const type = questionType ? (totals.types[questionType] ||= [0, 0]) : null;
  if (type) type[1]++;
  applyAnswerResult(run, item, index, totals, topic, type);
}

function summarizeSession(run: Run, items: QuestionRecord[]): SessionBreakdown {
  const totals: SessionBreakdown = {
    results: { correct: 0, wrong: 0, blank: 0 },
    failures: [],
    topics: {},
    types: {},
  };
  items.forEach((item, index) => addAnswerToTotals(run, item, index, totals));
  return totals;
}

function closeAttemptSession(run: Run, reason: 'complete' | 'interrupted' | 'timeout'): void {
  if (!run.attemptSessionId || !run.attemptScope || !attemptTracker) return;
  if (run.tIdx === run.idx && run.attemptIds?.[run.idx] && !run.attemptTrackingPaused) recordAttempt(run, { type: 'close' });
  attemptTracker.closeSession(run.attemptScope, run.attemptSessionId, reason === 'interrupted' ? 'interrupted' : 'completed', catalog().now(), run.secs);
}

function completedSessionRecords(run: Run, reason: 'complete' | 'interrupted' | 'timeout', items: QuestionRecord[], totals: SessionBreakdown, completedAt: number): {
  session: SessionResult; legacySession: LastResult['ses']
} {
  const itemCount = items.length;
  const id = 's' + completedAt.toString(36);
  const { correct, wrong, blank } = totals.results;
  const rubricScore = run.scoringPolicy
    ? calculateRubricScore({ correct, wrong, blank, questionCount: itemCount, policy: run.scoringPolicy })
    : calculateExamScore(correct, wrong, itemCount);
  const scorePending = rubricScore === null;
  const score = rubricScore ?? 0;
  const durationSeconds = run.porTiempo ? Math.min(run.secs, (run.limit ?? 0) * 60) : run.secs;
  const session: SessionResult = {
    id, completedAt, kind: run.kind, questionCount: itemCount, correctCount: correct, wrongCount: wrong,
    blankCount: blank, durationSeconds, score, topicResults: totals.topics, typeResults: totals.types,
    failedQuestionIds: totals.failures, title: run.titulo || '',
    ...(scorePending ? { scorePending: true } : {}),
    ...(run.scoringPolicy ? { scoringPolicy: { ...run.scoringPolicy } } : {}),
    ...(run.milestoneEventId ? { milestoneEventId: run.milestoneEventId } : {}),
    ...(reason === 'interrupted' ? { interrupted: true } : {}),
    ...(run.porTiempo ? { timeLimited: true } : {}),
  };
  const legacySession: LastResult['ses'] = {
    id, ts: completedAt, kind: run.kind, n: itemCount, a: correct, f: wrong, b: blank,
    secs: durationSeconds, nota: score, temas: totals.topics, tipos: totals.types, fails: totals.failures, titulo: run.titulo || '',
    ...(scorePending ? { scorePending: true } : {}),
    ...(run.scoringPolicy ? { scoringPolicy: { ...run.scoringPolicy } } : {}),
    ...(run.milestoneEventId ? { milestoneEventId: run.milestoneEventId } : {}),
    ...(reason === 'interrupted' ? { interrupted: true } : {}),
    ...(run.porTiempo ? { porTiempo: true } : {}),
  };
  return { session, legacySession };
}

function lastResult(run: Run, items: QuestionRecord[], session: LastResult['ses']): LastResult {
  return {
    ses: session, items, ans: [...run.ans], times: [...(run.times || [])], limit: run.limit || 0,
    feedback: run.feedback,
    ...(run.exposureKind ? { exposureKind: run.exposureKind } : {}),
    ...(run.scoringPolicy ? { scoringPolicy: { ...run.scoringPolicy } } : {}),
    ...(run.milestoneEventId ? { milestoneEventId: run.milestoneEventId } : {}),
    ...(run.attemptIds ? { attemptIds: [...run.attemptIds] } : {}),
    ...(run.studyStates ? { studyStates: [...run.studyStates] } : {}),
    confidences: [...(run.confidences || [])],
    discardedOptions: (run.discardedOptions || []).map(options => [...options]),
    highlights: (run.highlights || []).map(marks => marks.map(mark => ({ ...mark }))),
  };
}

/** Cierra la sesión: puntúa, guarda en el progreso y publica el resultado. null = no se contestó nada. */
export function finishRun(run: Run, reason: 'complete' | 'interrupted' | 'timeout' = 'complete'): LastResult | null {
  const activeRun = getSnapshot().run;
  if (!activeRun || activeRun.sessionKey !== run.sessionKey) return null;
  run = activeRun as Run;
  clearRun();
  closeAttemptSession(run, reason);
  // «por tiempo»: solo cuentan las preguntas que llegaste a contestar (la que estaba abierta al acabar el tiempo no)
  const completed = completedItemCount(run);
  if (!completed) { sessionStateStore.setState({ run: null }); return null; }
  const items = run.items.slice(0, completed);
  const totals = summarizeSession(run, items);
  const completedAt = catalog().now();
  const { session, legacySession } = completedSessionRecords(run, reason, items, totals, completedAt);
  if (run.exposureKind !== 'immediate-retry') progress().addSession(session);
  sessionStateStore.setState({ run: null });
  const result = lastResult(run, items, legacySession);
  sessionStateStore.setState({ last: result });
  return result;
}
