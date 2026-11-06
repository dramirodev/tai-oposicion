import type { AttemptArchive } from '../../domain/attempts/archive.js';
import type { QuestionAttempt, AttemptEvent } from '../../domain/attempts/transitions.js';
import { observedIntervals, unionObservedIntervals, type ObservedInterval } from '../../domain/attempts/observed-intervals.js';
import { accuracyMetric, metricsCalendar, metricsWeekKey, shiftMetricsDate, validateMetricsQuery, type MetricsQuery } from './metrics-query.js';

export interface MetricsQuestion { topicId: string; origin: string }
export interface MetricsCounts {
  correct: number; wrong: number; revealed: number; pending: number; abandoned: number; blanks: number; immediateRetries: number;
}
export interface MetricsDay { date: string; correct: number; wrong: number; observedMilliseconds: number }
export interface MetricsQuestionEvidence { questionId: string; contentRevision: string; semanticRevision?: string; mode: 'practice' | 'simulation'; outcome: 'correct' | 'wrong'; at: number }
export interface MetricsTopic extends MetricsCounts {
  topicId: string; distinctQuestions: number; latestCorrect: number; latestWrong: number;
  questions: MetricsQuestionEvidence[];
  catalogueQuestions: number; observedMilliseconds: number;
  latestWrongIds: string[]; lastPracticeAt: number | null;
}
const emptyCounts = (): MetricsCounts => ({ correct: 0, wrong: 0, revealed: 0, pending: 0, abandoned: 0, blanks: 0, immediateRetries: 0 });
const ordinary = (attempt: QuestionAttempt) => attempt.exposureKind !== 'immediate-retry';

/** Detailed events stand alone: never add legacy aggregate counters to this projection. */
export function summarizeDetailedMetrics(input: {
  archive: AttemptArchive;
  query: MetricsQuery;
  questions: ReadonlyMap<string, MetricsQuestion>;
  catalogueRevision: string;
}) {
  const { archive, query, questions } = input;
  validateMetricsQuery(query);
  const calendar = metricsCalendar(query.timeZone);
  const inside = (at: number) => at >= query.fromInclusive && at < query.toExclusive;
  const selected = (id: string) => {
    const question = questions.get(id);
    return !!question && (!query.topicId || query.topicId === question.topicId) && (!query.origin || query.origin === question.origin);
  };
  const sessions = new Map(archive.sessions.map(session => [session.id, session]));
  const events = new Map<string, AttemptEvent[]>();
  for (const event of archive.events) {
    const list = events.get(event.attemptId) ?? [];
    list.push(event); events.set(event.attemptId, list);
  }
  const counts = emptyCounts();
  const topics = new Map<string, MetricsTopic>();
  for (const [id, question] of questions) {
    if (!selected(id)) continue;
    let topic = topics.get(question.topicId);
    if (!topic) { topic = { ...emptyCounts(), topicId: question.topicId, distinctQuestions: 0, latestCorrect: 0, latestWrong: 0, latestWrongIds: [], lastPracticeAt: null, questions: [], catalogueQuestions: 0, observedMilliseconds: 0 }; topics.set(question.topicId, topic); }
    topic.catalogueQuestions++;
  }
  const topicIntervals = new Map<string, ObservedInterval[]>();
  const days = new Map<string, MetricsDay>();
  const day = (at: number) => {
    const key = calendar.dayKey(at);
    let row = days.get(key);
    if (!row) { row = { date: key, correct: 0, wrong: 0, observedMilliseconds: 0 }; days.set(key, row); }
    return row;
  };
  const latest = new Map<string, { attempt: QuestionAttempt; at: number }>();
  const activeDays = new Set<string>(), completedSessions = new Set<string>();
  const intervals: ObservedInterval[] = [];
  const activityIntervals = new Map<string, ObservedInterval[]>();
  let fallbackDates = 0, excludedCatalogue = 0, incompleteSimulations = 0, unplacedMilliseconds = 0, partialIntervals = 0;
  let earliest: number | null = null, latestAt: number | null = null;
  const seen = new Set<string>();
  for (const attempt of archive.attempts) {
    if (seen.has(attempt.id)) continue;
    seen.add(attempt.id);
    if (!questions.has(attempt.questionId)) { excludedCatalogue++; continue; }
    if (!selected(attempt.questionId) || (query.mode && query.mode !== attempt.mode)) continue;
    const session = sessions.get(attempt.sessionId);
    const activity = session?.activity ?? 'questions';
    if (query.activity && query.activity !== activity) continue;
    const attemptEvents = events.get(attempt.id) ?? [];
    const recorded = observedIntervals(attemptEvents);
    intervals.push(...recorded.intervals);
    const topicValues = topicIntervals.get(questions.get(attempt.questionId)!.topicId) ?? [];
    topicValues.push(...recorded.intervals); topicIntervals.set(questions.get(attempt.questionId)!.topicId, topicValues);
    const activityValues = activityIntervals.get(activity) ?? [];
    activityValues.push(...recorded.intervals); activityIntervals.set(activity, activityValues);
    const touchesPeriod = attemptEvents.some(event => inside(event.at)) || recorded.intervals.some(interval => interval.start < query.toExclusive && interval.end > query.fromInclusive);
    if (touchesPeriod) { unplacedMilliseconds += recorded.unplacedMilliseconds; if (recorded.partial) partialIntervals++; }
    // In exam mode only the final consolidated projection is scoreable, never each click.
    if (attempt.mode === 'simulation' && session?.status !== 'completed') { incompleteSimulations++; continue; }
    const terminal = attempt.terminalEventId ? attemptEvents.find(event => event.id === attempt.terminalEventId && (event.type === 'answer' || event.type === 'reveal')) : undefined;
    const at = terminal?.at ?? attempt.completedAt ?? session?.endedAt;
    if (at === undefined || !Number.isFinite(at) || !inside(at)) continue;
    if (!terminal) fallbackDates++;
    earliest = earliest === null ? at : Math.min(earliest, at);
    latestAt = latestAt === null ? at : Math.max(latestAt, at);
    if (session?.status === 'completed') completedSessions.add(session.id);
    const question = questions.get(attempt.questionId)!;
    let topic = topics.get(question.topicId);
    if (!topic) {
      topic = { ...emptyCounts(), topicId: question.topicId, distinctQuestions: 0, latestCorrect: 0, latestWrong: 0, latestWrongIds: [], lastPracticeAt: null, questions: [], catalogueQuestions: 0, observedMilliseconds: 0 };
      topics.set(question.topicId, topic);
    }
    const increment = (key: keyof MetricsCounts) => { counts[key]++; topic[key]++; };
    if (attempt.state !== 'unseen' || attemptEvents.some(event => inside(event.at) && ['open', 'resume', 'mark-pending'].includes(event.type))) activeDays.add(calendar.dayKey(at));
    if (!ordinary(attempt)) { increment('immediateRetries'); continue; }
    if (attempt.outcome === 'correct' || attempt.outcome === 'wrong') {
      increment(attempt.outcome);
      day(at)[attempt.outcome]++;
      activeDays.add(calendar.dayKey(at));
      topic.lastPracticeAt = Math.max(topic.lastPracticeAt ?? at, at);
      const previous = latest.get(attempt.questionId);
      if (!previous || at > previous.at || (at === previous.at && attempt.id > previous.attempt.id)) latest.set(attempt.questionId, { attempt, at });
    } else if (attempt.mode === 'simulation') increment('blanks');
    else if (attempt.state === 'revealed') increment('revealed');
    else if (attempt.state === 'pending') increment('pending');
    else increment('abandoned');
  }
  for (const { attempt, at } of latest.values()) {
    const topic = topics.get(questions.get(attempt.questionId)!.topicId)!;
    topic.distinctQuestions++;
    topic.questions.push({ questionId: attempt.questionId, contentRevision: attempt.contentRevision, semanticRevision: attempt.semanticRevision, mode: attempt.mode, outcome: attempt.outcome === 'correct' ? 'correct' : 'wrong', at });
    if (attempt.outcome === 'correct') topic.latestCorrect++;
    else { topic.latestWrong++; topic.latestWrongIds.push(attempt.questionId); }
  }
  const merged = unionObservedIntervals(intervals, query.fromInclusive, query.toExclusive);
  let observedMilliseconds = 0;
  const boundaries = new Map<string, number>();
  for (const interval of merged) {
    observedMilliseconds += interval.end - interval.start;
    let cursor = interval.start;
    while (cursor < interval.end) {
      const key = calendar.dayKey(cursor);
      let next = boundaries.get(key);
      if (next === undefined) { next = calendar.startOfDay(shiftMetricsDate(key, 1)); boundaries.set(key, next); }
      const end = Math.min(interval.end, next);
      day(cursor).observedMilliseconds += end - cursor;
      activeDays.add(key); cursor = end;
    }
  }
  for (const [id, values] of topicIntervals) {
    const row = topics.get(id);
    if (row) row.observedMilliseconds = unionObservedIntervals(values, query.fromInclusive, query.toExclusive).reduce((sum, interval) => sum + interval.end - interval.start, 0);
  }
  const eligible = [...questions.keys()].filter(selected).length;
  const latestCorrect = [...latest.values()].filter(row => row.attempt.outcome === 'correct').length;
  const sumBeforeUnion = intervals.reduce((sum, interval) => sum + Math.max(0, Math.min(query.toExclusive, interval.end) - Math.max(query.fromInclusive, interval.start)), 0);
  const activities = [...activityIntervals].map(([activity, values]) => ({ activity,
    observedMilliseconds: unionObservedIntervals(values, query.fromInclusive, query.toExclusive).reduce((sum, interval) => sum + interval.end - interval.start, 0) }));
  const weeks = new Map<string, MetricsDay>();
  for (const value of days.values()) {
    const key = metricsWeekKey(value.date);
    const week = weeks.get(key) ?? { date: key, correct: 0, wrong: 0, observedMilliseconds: 0 };
    week.correct += value.correct; week.wrong += value.wrong; week.observedMilliseconds += value.observedMilliseconds;
    weeks.set(key, week);
  }
  return {
    query, generatedAt: archive.createdAt, scope: 'local-account-history' as const, catalogueRevision: input.catalogueRevision,
    coverage: { earliest, latest: latestAt, fallbackDates, excludedCatalogue, incompleteSimulations, partialIntervals, unplacedMilliseconds },
    counts, accuracy: accuracyMetric(counts.correct, counts.wrong),
    recent: { distinctQuestions: latest.size, correct: latestCorrect, wrong: latest.size - latestCorrect },
    catalogue: { eligible, practiced: latest.size, coveragePercent: eligible ? 100 * latest.size / eligible : null },
    activities, activityOverlapMilliseconds: activities.reduce((sum, row) => sum + row.observedMilliseconds, 0) - observedMilliseconds,
    weeks: [...weeks.values()].sort((a, b) => a.date.localeCompare(b.date)),
    observedMilliseconds, overlapMilliseconds: sumBeforeUnion - observedMilliseconds,
    activeDays: activeDays.size, completedSessions: completedSessions.size,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    topics: [...topics.values()].map(row => ({ ...row, accuracy: accuracyMetric(row.correct, row.wrong) })).sort((a, b) => b.latestWrong - a.latestWrong || (b.lastPracticeAt ?? 0) - (a.lastPracticeAt ?? 0) || a.topicId.localeCompare(b.topicId)),
  };
}
export type DetailedMetrics = ReturnType<typeof summarizeDetailedMetrics> & {
  planning?: ReturnType<typeof import('./planned-study-metrics.js').summarizePlannedStudyHistory>;
  comparison?: { periods: { current: MetricsQuery; previous: MetricsQuery }; current: ReturnType<typeof accuracyMetric>;
    previous: ReturnType<typeof accuracyMetric>; percentagePoints: number | null } | null;
};
