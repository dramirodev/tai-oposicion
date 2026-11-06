import { describe, expect, it } from 'vitest';
import { summarizeDetailedMetrics } from '../../src/core/application/stats/detailed-metrics.js';
import { metricsCalendar, presetMetricsQuery, accuracyMetric, percentagePointChange } from '../../src/core/application/stats/metrics-query.js';
import { loadDetailedMetrics } from '../../src/core/application/stats/load-detailed-metrics.js';

const base = Date.parse('2026-11-06T09:00:00Z');
const question = id => ({ id, sessionId: 's', questionId: id, contentRevision: 'r', mode: 'practice', position: 0, exposure: 1, state: 'answered', outcome: 'correct', response: 0, createdAt: base, completedAt: base + 1000 });
const session = { id: 's', status: 'completed', startedAt: base, endedAt: base + 2000 };
const query = { fromInclusive: base - 1000, toExclusive: base + 100_000, timeZone: 'Europe/Madrid' };
function summarize(attempts, events = [], changes = {}) {
  const questions = new Map(Array.from({ length: 10 }, (_, n) => [`q${n}`, { topicId: 'T1.01', origin: 'O' }]));
  return summarizeDetailedMetrics({ archive: { createdAt: base, attempts, events, sessions: [session] }, questions, query, catalogueRevision: 'synthetic-v1', ...changes });
}
const event = (id, attemptId, sequence, type, at, monotonicAt = at - base) => ({ id, attemptId, sequence, type, at, monotonicAt, payload: {} });

describe('one detailed metrics query', () => {
  it('separates ordinary, revealed and immediate answers without multiplying distinct questions', () => {
    const attempts = [question('q0'), question('q1'), question('q2'), { ...question('q3'), outcome: 'wrong' },
      ...['q4', 'q5'].map(id => ({ ...question(id), state: 'revealed', outcome: null, response: null })),
      { ...question('q3'), id: 'retry', exposureKind: 'immediate-retry' }];
    const result = summarize(attempts);
    expect(result.accuracy).toEqual({ state: 'available', value: 75, observed: 4 });
    expect(result.counts).toMatchObject({ revealed: 2, immediateRetries: 1 });
    expect(result.recent).toEqual({ distinctQuestions: 4, correct: 3, wrong: 1 });
    expect(result.catalogue).toEqual({ eligible: 10, practiced: 4, coveragePercent: 40 });
  });
  it('keeps latest ordinary outcomes, counts a duplicate only once, and respects terminal date and cutoff', () => {
    const wrong = { ...question('q0'), outcome: 'wrong', terminalEventId: 'answer', completedAt: base + 200_000 };
    const good = question('q1');
    const retry = { ...question('q0'), id: 'retry', exposureKind: 'immediate-retry' };
    const events = [event('answer', 'q0', 2, 'answer', base + 500)];
    expect(summarize([wrong, good, wrong, retry], events).recent).toEqual({ distinctQuestions: 2, correct: 1, wrong: 1 });
    const later = { ...question('q0'), id: 'later', completedAt: base + 5000 };
    expect(summarize([wrong, good, retry, later], events).recent.correct).toBe(2);
    const after = { ...later, completedAt: query.toExclusive };
    expect(summarize([wrong, good, after], events).recent.correct).toBe(1);
  });
  it('distinguishes no answers from real zero and percentage points', () => {
    expect(summarize([]).accuracy.value).toBeNull();
    expect(summarize(Array.from({ length: 5 }, (_, n) => ({ ...question(`q${n}`), outcome: 'wrong' }))).accuracy.value).toBe(0);
    expect(percentagePointChange(accuracyMetric(3, 1), accuracyMetric(3, 2))).toBe(15);
  });
  it('unions overlaps, clips intervals and never extends an unclosed start to now', () => {
    const events = [event('a', 'q0', 1, 'open', base), event('b', 'q0', 2, 'leave', base + 60_000),
      event('c', 'q1', 1, 'open', base + 30_000), event('d', 'q1', 2, 'close', base + 90_000),
      event('e', 'q2', 1, 'open', base)];
    const result = summarize([question('q0'), question('q1'), question('q2')], [...events, events[0]]);
    expect(result.observedMilliseconds).toBe(90_000);
    expect(result.overlapMilliseconds).toBe(30_000);
    expect(result.coverage.partialIntervals).toBe(1);
    expect(summarize([question('q0')], events, { query: { ...query, fromInclusive: base + 40_000 } }).observedMilliseconds).toBe(20_000);
  });
  it('does not score simulation option changes until final consolidation', () => {
    const exam = { ...question('q0'), mode: 'simulation', terminalEventId: 'last', outcome: 'wrong' };
    const events = [event('first', 'q0', 1, 'answer', base), event('last', 'q0', 2, 'answer', base + 50)];
    expect(summarize([exam], events).counts).toMatchObject({ correct: 0, wrong: 1 });
    expect(summarize([exam], events, { archive: { attempts: [exam], events, sessions: [{ ...session, status: 'active' }], createdAt: base } }).accuracy.value).toBeNull();
  });
  it('filters origin, topic and modality consistently across counts and time', () => {
    const result = summarize([question('q0')], [event('a', 'q0', 1, 'open', base), event('b', 'q0', 2, 'close', base + 1000)], { query: { ...query, origin: 'G' } });
    expect(result.catalogue.eligible).toBe(0); expect(result.counts.correct).toBe(0); expect(result.observedMilliseconds).toBe(0);
  });
  it('refuses a result after the account changes during a page read', async () => {
    let account = 'A';
    await expect(loadDetailedMetrics({ repository: { getScopePage: async () => { account = 'B'; return { attempts: [], nextCursor: null }; } }, accountId: () => account, query, questions: new Map(), catalogueRevision: 'v1', now: base })).rejects.toThrow('cuenta');
  });
});

describe('civil periods in Europe/Madrid', () => {
  it.each([['2026-03-29', 23], ['2026-10-25', 25]])('preserves %s day length (%s hours)', (key, hours) => {
    const calendar = metricsCalendar('Europe/Madrid');
    const next = key === '2026-03-29' ? '2026-03-30' : '2026-10-26';
    expect(calendar.startOfDay(next) - calendar.startOfDay(key)).toBe(hours * 3_600_000);
  });
  it('defaults to 30 civil dates including partial today and splits at midnight', () => {
    const now = Date.parse('2026-10-26T10:00:00Z');
    const preset = presetMetricsQuery(30, now, 'Europe/Madrid');
    expect(metricsCalendar('Europe/Madrid').dayKey(preset.fromInclusive)).toBe('2026-09-27');
    const start = Date.parse('2026-11-05T23:55:00+01:00'), end = start + 600_000;
    const result = summarize([question('q0')], [event('a', 'q0', 1, 'open', start, 0), event('b', 'q0', 2, 'close', end, 600_000)], { query: { ...query, fromInclusive: start, toExclusive: end } });
    expect(result.days.map(day => day.observedMilliseconds)).toEqual([300_000, 300_000]);
  });
});

import { completedMetricsComparison } from '../../src/core/application/stats/metrics-query.js';
it('compares equal complete civil days, excluding four hours of an incomplete today', () => {
  const now = Date.parse('2026-03-30T02:00:00Z');
  const range = presetMetricsQuery(7, now, 'Europe/Madrid');
  const result = completedMetricsComparison(range, now);
  const calendar = metricsCalendar('Europe/Madrid');
  expect(calendar.dayKey(result.current.fromInclusive)).toBe('2026-03-24');
  expect(calendar.dayKey(result.current.toExclusive)).toBe('2026-03-30');
  expect(calendar.dayKey(result.previous.fromInclusive)).toBe('2026-03-18');
  expect(result.previous.toExclusive).toBe(result.current.fromInclusive);
  expect(result.current.toExclusive - result.current.fromInclusive).not.toBe(result.previous.toExclusive - result.previous.fromInclusive);
});
