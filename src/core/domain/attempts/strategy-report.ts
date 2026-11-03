import type { Question } from '../entities.js';
import { computeActiveTime } from './active-time.js';
import { questionContentRevision } from './highlights.js';
import type { AttemptEvent, QuestionAttempt, QuestionAttemptSession } from './transitions.js';

export type StrategyDimension = 'mode' | 'exposure' | 'topic' | 'origin' | 'kind' | 'contentRevision' | 'difficulty';
export type StrategyRecommendation = 'answer-now' | 'defer-second-round' | 'consider-blank-final';
export type StrategyRecommendationReason = 'insufficient-sample' | 'not-simulation-only' | 'matches-blank-value' | null;

export interface StrategyActiveTime {
  observedMilliseconds: number;
  completeAttempts: number;
  partialAttempts: number;
  unavailableAttempts: number;
  p50Milliseconds: number | null;
  p75Milliseconds: number | null;
}

export interface StrategyMetrics {
  attempts: number;
  answered: number;
  correct: number;
  wrong: number;
  blankPending: number;
  blankConsulted: number;
  blankUnanswered: number;
  sessionCount: number;
  changedAnswerAttempts: number;
  discardedOptions: number;
  confidence: { sure: number; betweenTwo: number; guess: number; unset: number };
  highlights: { beforeAnswer: number; afterAnswer: number; afterReveal: number };
  activeTime: StrategyActiveTime;
}

export interface StrategySegment extends StrategyMetrics {
  dimension: StrategyDimension;
  value: string;
  observedAccuracy: number | null;
  expectedValuePerQuestion: number | null;
  recommendation: StrategyRecommendation | null;
  recommendationReason: StrategyRecommendationReason;
  recommendationSample: { answeredAttempts: number; sessions: number; minimumAttempts: number; minimumSessions: number };
  timingRecommendation: 'defer-second-round' | null;
  timingSample: { timedAttempts: number; sessionsWithTimer: number; medianSecondsPerBlank: number | null };
  metadataAvailable: boolean;
}

export interface AttemptStrategyReport {
  period: { from: number; to: number };
  scoring: { reward: number; penalty: number; blankValue: number };
  completedSessionCount: number;
  excludedSessionCount: number;
  excludedImmediateRetryCount: number;
  orphanAttemptCount: number;
  overall: StrategyMetrics;
  segments: StrategySegment[];
}

export interface AnalyzeAttemptStrategyInput {
  sessions: readonly QuestionAttemptSession[];
  attempts: readonly QuestionAttempt[];
  events: readonly AttemptEvent[];
  questions: ReadonlyMap<string, Question>;
  from: number;
  to: number;
  reward: number;
  penalty: number;
  blankValue: number;
}

interface AttemptObservation {
  attempt: QuestionAttempt;
  session: QuestionAttemptSession;
  question?: Question;
  events: readonly AttemptEvent[];
  activeTime: ReturnType<typeof computeActiveTime>;
  changedAnswer: boolean;
}

const RECOMMENDATION_MIN_ATTEMPTS = 20;
const RECOMMENDATION_MIN_SESSIONS = 3;
const dimensions: readonly StrategyDimension[] = ['mode', 'exposure', 'topic', 'origin', 'kind', 'contentRevision', 'difficulty'];

function nearestRank(values: readonly number[], percentile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
}

function changedAnswer(events: readonly AttemptEvent[], mode: QuestionAttempt['mode']): boolean {
  if (mode !== 'simulation') return false;
  const answers = events.filter((event): event is AttemptEvent & { payload: { optionIndex: number } } =>
    event.type === 'answer' && 'optionIndex' in event.payload && typeof event.payload.optionIndex === 'number')
    .sort((left, right) => left.sequence - right.sequence);
  return answers.some((answer, index) => index > 0 && answer.payload.optionIndex !== answers[index - 1].payload.optionIndex);
}

function blankMetrics(): StrategyMetrics {
  return {
    attempts: 0, answered: 0, correct: 0, wrong: 0, blankPending: 0, blankConsulted: 0, blankUnanswered: 0,
    sessionCount: 0, changedAnswerAttempts: 0, discardedOptions: 0,
    confidence: { sure: 0, betweenTwo: 0, guess: 0, unset: 0 },
    highlights: { beforeAnswer: 0, afterAnswer: 0, afterReveal: 0 },
    activeTime: { observedMilliseconds: 0, completeAttempts: 0, partialAttempts: 0, unavailableAttempts: 0, p50Milliseconds: null, p75Milliseconds: null },
  };
}

function addObservation(metrics: StrategyMetrics, observation: AttemptObservation): void {
  const { attempt, events, activeTime } = observation;
  metrics.attempts++;
  if (attempt.outcome === 'correct') { metrics.answered++; metrics.correct++; }
  else if (attempt.outcome === 'wrong') { metrics.answered++; metrics.wrong++; }
  else if (attempt.state === 'revealed') metrics.blankConsulted++;
  else if (attempt.state === 'pending' || events.some(event => event.type === 'mark-pending')) metrics.blankPending++;
  else metrics.blankUnanswered++;
  metrics.changedAnswerAttempts += Number(observation.changedAnswer);
  metrics.discardedOptions += attempt.discardedOptions.length;
  metrics.confidence[attempt.confidence || 'unset']++;
  for (const highlight of attempt.highlights) {
    if (highlight.timing === 'before-answer') metrics.highlights.beforeAnswer++;
    else if (highlight.timing === 'after-answer') metrics.highlights.afterAnswer++;
    else if (highlight.timing === 'after-reveal') metrics.highlights.afterReveal++;
  }
  metrics.activeTime.observedMilliseconds += activeTime.milliseconds;
  if (activeTime.quality === 'complete') metrics.activeTime.completeAttempts++;
  else if (activeTime.quality === 'partial') metrics.activeTime.partialAttempts++;
  else metrics.activeTime.unavailableAttempts++;
}

function dimensionValue(dimension: StrategyDimension, observation: AttemptObservation): string | null {
  const { attempt, question } = observation;
  switch (dimension) {
    case 'mode': return attempt.mode;
    case 'exposure': return attempt.exposure === 1 ? 'first-exposure' : 'repeat';
    case 'topic': return question?.topicId ?? null;
    case 'origin': return question?.origin ?? null;
    case 'kind': return question?.kind ?? 'unspecified';
    case 'contentRevision': return question ? (questionContentRevision(question.statement, question.options) === attempt.contentRevision ? 'current' : 'stale') : 'missing-question';
    case 'difficulty': return question?.difficulty === null || question?.difficulty === undefined ? null : String(question.difficulty);
  }
}

function strategyValues(attempts: readonly AttemptObservation[], reward: number, penalty: number, blankValue: number) {
  const answered = attempts.filter(item => item.attempt.outcome !== null);
  const sessions = new Set(answered.map(item => item.session.id)).size;
  const correct = answered.filter(item => item.attempt.outcome === 'correct').length;
  const observedAccuracy = answered.length ? correct / answered.length : null;
  const enough = answered.length >= RECOMMENDATION_MIN_ATTEMPTS && sessions >= RECOMMENDATION_MIN_SESSIONS;
  const expectedValuePerQuestion = enough && observedAccuracy !== null
    ? observedAccuracy * reward - (1 - observedAccuracy) * penalty
    : null;
  const simulation = attempts.every(item => item.attempt.mode === 'simulation');
  const recommendationReason: StrategyRecommendationReason = !enough || expectedValuePerQuestion === null
    ? 'insufficient-sample'
    : !simulation ? 'not-simulation-only'
      : expectedValuePerQuestion === blankValue ? 'matches-blank-value' : null;
  const recommendation: StrategyRecommendation | null = recommendationReason !== null || expectedValuePerQuestion === null
    ? null
    : expectedValuePerQuestion > blankValue ? 'answer-now'
      : expectedValuePerQuestion < blankValue ? 'consider-blank-final' : null;
  return {
    observedAccuracy,
    expectedValuePerQuestion,
    recommendation,
    recommendationReason,
    recommendationSample: { answeredAttempts: answered.length, sessions, minimumAttempts: RECOMMENDATION_MIN_ATTEMPTS, minimumSessions: RECOMMENDATION_MIN_SESSIONS },
  };
}

function timingValues(attempts: readonly AttemptObservation[], sessionBlankCounts: ReadonlyMap<string, number>) {
  const timerSessions = new Map<string, { session: QuestionAttemptSession; blanks: number }>();
  for (const observation of attempts) {
    const session = observation.session;
    if (observation.attempt.mode !== 'simulation' || session.timeLimitSeconds === undefined || session.elapsedSeconds === undefined) continue;
    const current = timerSessions.get(session.id) || { session, blanks: sessionBlankCounts.get(session.id) || 0 };
    timerSessions.set(session.id, current);
  }
  const usable = [...timerSessions.values()].filter(item => item.blanks > 0);
  const budgets = usable.map(({ session, blanks }) => Math.max(0, (session.timeLimitSeconds! - session.elapsedSeconds!) / blanks));
  const timedAttempts = attempts.filter(item => item.attempt.mode === 'simulation'
    && item.session.timeLimitSeconds !== undefined && item.session.elapsedSeconds !== undefined
    && item.activeTime.quality === 'complete');
  const medianSecondsPerBlank = nearestRank(budgets, 0.5);
  const p75 = nearestRank(timedAttempts.map(item => item.activeTime.milliseconds), 0.75);
  const enough = timedAttempts.length >= RECOMMENDATION_MIN_ATTEMPTS && usable.length >= RECOMMENDATION_MIN_SESSIONS;
  return {
    timingRecommendation: enough && p75 !== null && medianSecondsPerBlank !== null && p75 / 1000 > medianSecondsPerBlank ? 'defer-second-round' as const : null,
    timingSample: { timedAttempts: timedAttempts.length, sessionsWithTimer: usable.length, medianSecondsPerBlank },
  };
}

function finalizeMetrics(metrics: StrategyMetrics, observations: readonly AttemptObservation[]): StrategyMetrics {
  metrics.sessionCount = new Set(observations.map(item => item.session.id)).size;
  const timed = observations.filter(item => item.activeTime.quality === 'complete').map(item => item.activeTime.milliseconds);
  metrics.activeTime.p50Milliseconds = nearestRank(timed, 0.5);
  metrics.activeTime.p75Milliseconds = nearestRank(timed, 0.75);
  return metrics;
}

/** Creates a reproducible report from completed attempt histories; incomplete sessions never enter final metrics. */
export function analyzeAttemptStrategy(input: AnalyzeAttemptStrategyInput): AttemptStrategyReport {
  const sessionsInPeriod = input.sessions.filter(session => session.startedAt >= input.from && session.startedAt < input.to);
  const completed = new Map(sessionsInPeriod.filter(session => session.status === 'completed').map(session => [session.id, session]));
  const excludedSessionCount = sessionsInPeriod.length - completed.size;
  const eventsByAttempt = new Map<string, AttemptEvent[]>();
  for (const event of input.events) {
    const list = eventsByAttempt.get(event.attemptId) || [];
    list.push(event);
    eventsByAttempt.set(event.attemptId, list);
  }
  const excludedImmediateRetryCount = input.attempts.filter(attempt => completed.has(attempt.sessionId)
    && attempt.exposureKind === 'immediate-retry').length;
  const observations = input.attempts.flatMap(attempt => {
    if (attempt.exposureKind === 'immediate-retry') return [];
    const session = completed.get(attempt.sessionId);
    if (!session) return [];
    const events = eventsByAttempt.get(attempt.id) || [];
    return [{ attempt, session, question: input.questions.get(attempt.questionId), events, activeTime: computeActiveTime(events), changedAnswer: changedAnswer(events, attempt.mode) }];
  });
  const sessionBlankCounts = new Map<string, number>();
  for (const observation of observations) {
    if (observation.attempt.outcome === null) sessionBlankCounts.set(observation.session.id, (sessionBlankCounts.get(observation.session.id) || 0) + 1);
  }
  const overall = finalizeMetrics(observations.reduce((metrics, item) => { addObservation(metrics, item); return metrics; }, blankMetrics()), observations);
  const buckets = new Map<string, { dimension: StrategyDimension; value: string; observations: AttemptObservation[]; metadataAvailable: boolean }>();
  for (const observation of observations) {
    for (const dimension of dimensions) {
      const value = dimensionValue(dimension, observation);
      if (value === null) continue;
      const key = `${dimension}\u0000${value}`;
      const bucket = buckets.get(key) || { dimension, value, observations: [], metadataAvailable: !!observation.question };
      bucket.observations.push(observation);
      bucket.metadataAvailable &&= !!observation.question;
      buckets.set(key, bucket);
    }
  }
  const segments = [...buckets.values()].map(bucket => {
    const metrics = finalizeMetrics(bucket.observations.reduce((aggregate, item) => { addObservation(aggregate, item); return aggregate; }, blankMetrics()), bucket.observations);
    return {
      dimension: bucket.dimension,
      value: bucket.value,
      ...metrics,
      ...strategyValues(bucket.observations, input.reward, input.penalty, input.blankValue),
      ...timingValues(bucket.observations, sessionBlankCounts),
      metadataAvailable: bucket.metadataAvailable,
    } satisfies StrategySegment;
  }).sort((left, right) => dimensions.indexOf(left.dimension) - dimensions.indexOf(right.dimension) || left.value.localeCompare(right.value));
  return {
    period: { from: input.from, to: input.to },
    scoring: { reward: input.reward, penalty: input.penalty, blankValue: input.blankValue },
    completedSessionCount: completed.size,
    excludedSessionCount,
    excludedImmediateRetryCount,
    orphanAttemptCount: input.attempts.filter(attempt => !input.sessions.some(session => session.id === attempt.sessionId)).length,
    overall,
    segments,
  };
}
