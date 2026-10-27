import { describe, expect, it } from 'vitest';
import { attemptMapper } from '../../src/adapters/local/mappers/attempt.js';

const highlight = {
  id: 'highlight-1', field: 'statement', start: 4, end: 12, text: 'condición', before: 'la ', after: ' legal',
  category: 'key', contentRevision: 'rev-1', createdAt: 100, timing: 'before-answer',
};

const attempt = {
  id: 'attempt-1', sessionId: 'session-1', questionId: 'q-1', contentRevision: 'rev-1', mode: 'practice',
  position: 2, exposure: 3, state: 'answered', response: 1, outcome: 'wrong', terminalEventId: 'event-4', confidence: 'betweenTwo',
  discardedOptions: [0, 3], highlights: [highlight], createdAt: 50, lastSequence: 4,
  appliedEventIds: ['event-1', 'event-2', 'event-3', 'event-4'],
};

describe('attemptMapper', () => {
  it('roundtrips attempt records field by field including highlights and confidence', () => {
    const dto = attemptMapper.toDto(attempt);
    const domain = attemptMapper.toDomain(JSON.parse(JSON.stringify(dto)));
    expect(domain).toEqual({ ok: true, value: attempt });
    expect(attemptMapper.toDto(domain.value)).toEqual(dto);
  });

  it('roundtrips typed event payloads and optional monotonic timestamps', () => {
    const event = {
      id: 'event-5', attemptId: 'attempt-1', sequence: 5, type: 'add-highlight', at: 200, monotonicAt: 80,
      payload: { highlight },
    };
    const dto = attemptMapper.eventToDto(event);
    const domain = attemptMapper.eventToDomain(JSON.parse(JSON.stringify(dto)));
    expect(domain).toEqual({ ok: true, value: event });
    expect(attemptMapper.eventToDto(domain.value)).toEqual(dto);
  });

  it('returns an explicit mapping failure for invalid state and event payloads', () => {
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...attempt, state: 'unknown' }))
      .toEqual({ ok: false, reason: 'invalid attempt state' });
    expect(attemptMapper.eventToDomain({ schemaVersion: 1, id: 'e', attemptId: 'a', sequence: 1, type: 'answer', at: 10, payload: {} }))
      .toEqual({ ok: false, reason: 'invalid answer payload' });
  });

  it('keeps nested highlight errors explicit and strips fields outside the persistence contract', () => {
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...attempt, highlights: [{ ...highlight, end: 2 }] }))
      .toEqual({ ok: false, reason: 'invalid attempt highlight: invalid highlight anchor' });
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...attempt, storageNote: 'ignored' }))
      .toEqual({ ok: true, value: attempt });
  });
});
