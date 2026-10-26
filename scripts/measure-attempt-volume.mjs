import { gzipSync } from 'node:zlib';
import { attemptMapper } from '../src/adapters/local/mappers/attempt.ts';
import { attemptSessionMapper } from '../src/adapters/local/mappers/attempt-session.ts';

const attemptCount = 10_000;
const attemptsPerSession = 20;
const createdAt = 1_800_000_000_000;
const sessions = Array.from({ length: attemptCount / attemptsPerSession }, (unusedSessionValue, sessionIndex) => attemptSessionMapper.toDto({
  id: `session-${sessionIndex}`,
  mode: 'practice',
  status: 'completed',
  startedAt: createdAt + sessionIndex * 1_000,
  endedAt: createdAt + sessionIndex * 1_000 + 60_000,
  lastSequence: 1,
}));
const attempts = [];
const events = [];

for (let index = 0; index < attemptCount; index++) {
  const id = `attempt-${index}`;
  const sessionId = `session-${Math.floor(index / attemptsPerSession)}`;
  const attempt = {
    id,
    sessionId,
    questionId: `question-${index}`,
    contentRevision: '',
    mode: 'practice',
    position: index % attemptsPerSession,
    exposure: 1,
    state: 'answered',
    response: 2,
    outcome: 'wrong',
    confidence: null,
    discardedOptions: [],
    highlights: [],
    createdAt: createdAt + index,
    completedAt: createdAt + index + 30_000,
    lastSequence: 3,
    appliedEventIds: [`${id}-open`, `${id}-answer`, `${id}-close`],
    terminalEventId: `${id}-answer`,
  };
  attempts.push(attemptMapper.toDto(attempt));
  events.push(
    attemptMapper.eventToDto({ id: `${id}-open`, attemptId: id, sequence: 1, type: 'open', at: createdAt + index, monotonicAt: 0, payload: {} }),
    attemptMapper.eventToDto({ id: `${id}-answer`, attemptId: id, sequence: 2, type: 'answer', at: createdAt + index + 20_000, monotonicAt: 20_000, payload: { optionIndex: 2, outcome: 'wrong' } }),
    attemptMapper.eventToDto({ id: `${id}-close`, attemptId: id, sequence: 3, type: 'close', at: createdAt + index + 30_000, monotonicAt: 30_000, payload: {} }),
  );
}

const json = JSON.stringify({ schemaVersion: 1, createdAt, sessions, attempts, events });
console.log(JSON.stringify({
  scenario: 'synthetic: 10,000 answered attempts, 3 events per attempt, 20 attempts per session',
  attempts: attempts.length,
  events: events.length,
  sessions: sessions.length,
  jsonBytes: Buffer.byteLength(json),
  gzipBytes: gzipSync(json).byteLength,
}, null, 2));
