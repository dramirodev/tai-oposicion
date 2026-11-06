import { describe, expect, it } from 'vitest';
import { buildQuestionEvolution } from '../src/core/domain/attempts/question-evolution.ts';

const now = new Date('2026-10-27T12:00:00+01:00').getTime();
const session = { id: 'session-1', mode: 'practice', status: 'completed', startedAt: now, lastSequence: 0 };
const attempt = (id, state, outcome = null) => ({
  id, sessionId: session.id, questionId: id, contentRevision: 'v1', mode: 'practice', position: 0, exposure: 1,
  state, response: null, outcome, confidence: null, discardedOptions: [], highlights: [], createdAt: now, lastSequence: 1, appliedEventIds: [],
});

describe('buildQuestionEvolution', () => {
  it('conserva fallos y preguntas marcadas como no lo sé aunque se revele la solución', () => {
    const weeks = buildQuestionEvolution({
      createdAt: now,
      sessions: [session],
      attempts: [
        attempt('correct', 'answered', 'correct'),
        attempt('wrong', 'answered', 'wrong'),
        attempt('unknown-pending', 'pending'),
        attempt('unknown-revealed', 'revealed'),
        { ...attempt('immediate-retry-correct', 'answered', 'correct'), exposureKind: 'immediate-retry', retryOfAttemptId: 'correct' },
        attempt('unseen', 'unseen'),
      ],
      events: [],
    }, 1, now);

    expect(weeks[0]).toMatchObject({ seen: 4, correct: 1, wrong: 1, unknown: 2 });
  });
});

it('attributes an ordinary answer to its terminal event, not session creation, and deduplicates delivery', () => {
  const now = new Date(2026, 10, 6, 12).getTime();
  const at = new Date(2026, 10, 5, 12).getTime();
  const attempt = { id: 'terminal-date', sessionId: 'old-start', questionId: 'q', state: 'answered', outcome: 'correct', terminalEventId: 'answer', completedAt: new Date(2026, 10, 7).getTime() };
  const result = buildQuestionEvolution({ createdAt: now, sessions: [{ id: 'old-start', status: 'completed', startedAt: new Date(2026, 8, 1).getTime() }], attempts: [attempt, attempt], events: [{ id: 'answer', attemptId: attempt.id, at }] }, 2, now);
  expect(result.at(-1)).toMatchObject({ seen: 1, correct: 1, wrong: 0 });
});
