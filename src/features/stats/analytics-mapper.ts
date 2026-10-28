import { countReviewsByDay } from '../../core/domain/spaced-repetition.js';
import { estimateQuickQuestionCount } from '../../core/domain/selection.js';
import { countFailureReasons, countLuckyCorrectAnswers, summarizeReadingSpeedFailures } from '../../core/domain/question-performance.js';
import { aggregateWeeklyStudy, buildSimulationHistory, compareStudySessions, slowestQuestions, type StudySessionSummary } from '../../core/domain/study-analytics.js';

type LegacyStats = Readonly<Record<string, readonly number[]>>;
export interface LegacySession {
  id: string; ts: number; kind: 'sim' | 'rev' | 'test'; n: number; a: number; f: number; b: number; secs: number; nota: number;
  temas?: Readonly<Record<string, readonly [number, number]>>;
  tipos?: Readonly<Record<string, readonly [number, number]>>;
  titulo?: string;
}

function toStudySession(session: LegacySession): StudySessionSummary {
  const breakdown = (values?: Readonly<Record<string, readonly [number, number]>>) => values
    ? Object.fromEntries(Object.entries(values).map(([key, [correct, total]]) => [key, { correct, total }]))
    : undefined;
  return {
    id: session.id,
    startedAt: session.ts,
    mode: session.kind === 'sim' ? 'simulation' : 'practice',
    ...(session.kind === 'sim' ? { practicePart: /Parte 2/.test(session.titulo || '') ? 2 as const : 1 as const } : {}),
    questionCount: session.n,
    correctCount: session.a,
    score: session.nota,
    durationSeconds: session.secs,
    byTopic: breakdown(session.temas),
    byQuestionType: breakdown(session.tipos),
  };
}

export function aggregateWeeks(sessions: readonly LegacySession[], options: { tema?: string; tipo?: string; weeks?: number; now?: number } = {}) {
  return aggregateWeeklyStudy(sessions.map(toStudySession), { topicId: options.tema, questionType: options.tipo, weeks: options.weeks, now: options.now ?? Date.now() })
    .map(week => ({ start: week.weekStart, n: week.questionCount, ok: week.correctCount, secs: week.durationSeconds, ses: week.sessionCount, acierto: week.accuracyPercent, segPreg: week.secondsPerQuestion }));
}

export function slowList(stats: LegacyStats, { soloAcertadas = false, min = 1, limit = 15 }: { soloAcertadas?: boolean; min?: number; limit?: number } = {}) {
  return slowestQuestions(Object.entries(stats).map(([id, stat]) => ({
    id, attempts: stat[0], correct: stat[1], lastOutcome: stat[5], totalSeconds: stat[7] || 0, timedAnswers: stat[8] || 0,
  })), { onlyLastCorrect: soloAcertadas, minimumTimedAnswers: min, limit })
    .map(item => ({ id: item.id, avg: item.averageSeconds, n: item.attempts, ok: item.correct, last: item.lastOutcome, tn: item.timedAnswers }));
}

export function simHistory(sessions: readonly LegacySession[]) {
  return buildSimulationHistory(sessions.map(toStudySession)).map(({ session, part, scoreDelta }) => ({
    ...sessions.find(item => item.id === session.id)!, part: part === 2 ? 'p2' : 'p1', dNota: scoreDelta,
  }));
}

export function compareSessions(first: LegacySession, second: LegacySession) {
  const result = compareStudySessions(toStudySession(first), toStudySession(second));
  return {
    rows: result.topics.map(row => ({ t: row.topicId, pa: row.firstAccuracy, pb: row.secondAccuracy, na: row.firstQuestionCount, nb: row.secondQuestionCount, d: row.delta })),
    dNota: result.scoreDelta,
    dAcierto: result.accuracyDelta,
    dSeg: result.secondsPerQuestionDelta,
  };
}

function questionPerformance(stats: LegacyStats) {
  return Object.entries(stats).map(([id, stat]) => ({ id, lastOutcome: stat[5], lastReasonCode: stat[9] }));
}

export function motivosFallo(stats: LegacyStats): number[] {
  return countFailureReasons(questionPerformance(stats));
}

export function suertes(stats: LegacyStats): number {
  return countLuckyCorrectAnswers(questionPerformance(stats));
}

export function velocidad(stats: LegacyStats) {
  const result = summarizeReadingSpeedFailures(questionPerformance(stats));
  return { n: result.count, tot: result.taggedFailureCount, p: result.percent, ids: result.questionIds };
}

export function cargaRepasos(stats: LegacyStats, now: number, days = 14): number[] {
  const entries = Object.values(stats).map(stat => ({
    intervalStep: stat[3], dueAt: stat[4], lastSeenAt: stat[2], lastResult: stat[5],
    syllabusReviewed: stat[11] === 1, syllabusReviewedAt: stat[12],
  }));
  return countReviewsByDay(entries, now, days);
}

export function quickQuestionCount(stats: LegacyStats, minutes = 5): number {
  const answers = Object.values(stats).map(stat => ({ totalSeconds: stat[7] || 0, count: stat[8] || 0 }));
  return estimateQuickQuestionCount(answers, minutes);
}
