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

  it('roundtrips immediate retry linkage while keeping legacy attempts compatible', () => {
    const retry = { ...attempt, id: 'retry-attempt:attempt-1', sessionId: 'retry-session:attempt-1', exposureKind: 'immediate-retry', retryOfAttemptId: attempt.id };
    const dto = attemptMapper.toDto(retry);
    expect(attemptMapper.toDomain(JSON.parse(JSON.stringify(dto)))).toEqual({ ok: true, value: retry });
    const { exposureKind: _exposureKind, retryOfAttemptId: _retryOfAttemptId, ...legacy } = attempt;
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...legacy })).toEqual({ ok: true, value: legacy });
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

  it('roundtrips the post-correction self-assessment event', () => {
    const event = { id: 'event-6', attemptId: 'attempt-1', sequence: 6, type: 'self-assess', at: 250, payload: { value: 'could-explain' } };
    const dto = attemptMapper.eventToDto(event);
    expect(attemptMapper.eventToDomain(JSON.parse(JSON.stringify(dto)))).toEqual({ ok: true, value: event });
  });

  it('reads legacy attempt DTOs without the optional self-assessment', () => {
    const { selfAssessment: _selfAssessment, ...legacy } = { ...attempt, selfAssessment: 'needs-help' };
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...legacy })).toEqual({ ok: true, value: attempt });
    const assessed = { ...attempt, selfAssessment: 'needs-help' };
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...assessed })).toEqual({ ok: true, value: assessed });
  });

  it('returns an explicit mapping failure for invalid state and event payloads', () => {
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...attempt, state: 'unknown' }))
      .toEqual({ ok: false, reason: 'invalid attempt state' });
    expect(attemptMapper.eventToDomain({ schemaVersion: 1, id: 'e', attemptId: 'a', sequence: 1, type: 'answer', at: 10, payload: {} }))
      .toEqual({ ok: false, reason: 'invalid answer payload' });
    expect(attemptMapper.eventToDomain({ schemaVersion: 1, id: 'e', attemptId: 'a', sequence: 1, type: 'add-highlight', at: 10, payload: { highlight: { ...highlight, end: 2 } } }))
      .toEqual({ ok: false, reason: 'invalid highlight event: invalid highlight anchor' });
    expect(attemptMapper.eventToDomain({ schemaVersion: 1, id: 'e' }))
      .toEqual({ ok: false, reason: 'event and payload must be objects' });
  });

  it('keeps nested highlight errors explicit and strips fields outside the persistence contract', () => {
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...attempt, highlights: [{ ...highlight, end: 2 }] }))
      .toEqual({ ok: false, reason: 'invalid attempt highlight: invalid highlight anchor' });
    expect(attemptMapper.toDomain({ schemaVersion: 1, ...attempt, storageNote: 'ignored' }))
      .toEqual({ ok: true, value: attempt });
  });
});
