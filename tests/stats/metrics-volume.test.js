// @vitest-environment node
import { expect, it } from 'vitest';
import { loadDetailedMetrics } from '../../src/core/application/stats/load-detailed-metrics.js';
import { summarizeDetailedMetrics } from '../../src/core/application/stats/detailed-metrics.js';
for (const size of [10000, 100000]) it(`projects ${size} synthetic attempts in one bounded pass`, async () => {
  const from = Date.parse('2026-10-01T00:00:00Z');
  const attempts = [], events = [], questions = new Map();
  for (let index = 0; index < 1000; index++) questions.set(`q${index}`, { topicId: `T1.${String(index % 10 + 1).padStart(2, '0')}`, origin: 'O' });
  for (let index = 0; index < size; index++) {
    const id = `a${index}`, at = from + index * 1000;
    attempts.push({ id, sessionId: 's', questionId: `q${index % 1000}`, contentRevision: 'r', mode: 'practice', state: 'answered', outcome: index % 4 ? 'correct' : 'wrong', response: 0, createdAt: at, completedAt: at + 1000, terminalEventId: `${id}-answer` });
    events.push({ id: `${id}-open`, attemptId: id, sequence: 1, type: 'open', at, monotonicAt: 0, payload: {} },
      { id: `${id}-answer`, attemptId: id, sequence: 2, type: 'answer', at: at + 500, monotonicAt: 500, payload: {} },
      { id: `${id}-close`, attemptId: id, sequence: 3, type: 'close', at: at + 1000, monotonicAt: 1000, payload: {} });
  }
  const archive = { createdAt: from + size * 1000, attempts, events, sessions: [{ id: 's', status: 'completed' }] };
  const start = performance.now();
  const result = summarizeDetailedMetrics({ archive, query: { fromInclusive: from, toExclusive: from + size * 1000 + 1, timeZone: 'Europe/Madrid' }, questions, catalogueRevision: 'synthetic-1000' });
  const milliseconds = performance.now() - start;
  let readCalls = 0;
  const page = (rows, cursor) => { readCalls++; const offset = Number(cursor ?? 0); return { rows: rows.slice(offset, offset + 100), nextCursor: offset + 100 < rows.length ? String(offset + 100) : null }; };
  const queryStart = performance.now();
  const loaded = await loadDetailedMetrics({ repository: {
    getScopePage: async (scope, cursor) => { const value = page(attempts, cursor); return { attempts: value.rows, nextCursor: value.nextCursor }; },
    getScopeEventPage: async (scope, cursor) => { const value = page(events, cursor); return { events: value.rows, nextCursor: value.nextCursor }; },
    getScopeSessionPage: async () => { readCalls++; return { sessions: archive.sessions, nextCursor: null }; },
    getSession: async () => { throw new Error('Unexpected per-question session read'); },
    getEvents: async () => { throw new Error('Unexpected per-question event read'); },
  }, accountId: () => 'synthetic@example.test', query: { fromInclusive: from, toExclusive: from + size * 1000 + 1, timeZone: 'Europe/Madrid' }, questions, catalogueRevision: 'synthetic-1000', now: archive.createdAt });
  const fullQueryMilliseconds = Math.round(performance.now() - queryStart);
  expect(loaded.accuracy.value).toBe(75);
  expect(readCalls).toBe(Math.ceil(size / 100) + Math.ceil(events.length / 100) + 1);
  process.stdout.write(JSON.stringify({ fixture: 'progress-metrics-v1', node: process.version, platform: process.platform, attempts: size, events: events.length, distinctQuestions: result.recent.distinctQuestions, serializedBytes: Buffer.byteLength(JSON.stringify(archive)), milliseconds: Math.round(milliseconds), fullQueryMilliseconds, readCalls }) + '\n');
  expect(result.accuracy.value).toBe(75); expect(result.accuracy.observed).toBe(size); expect(result.recent.distinctQuestions).toBe(1000);
  expect(result.observedMilliseconds).toBe(size * 1000);
}, 30000);
