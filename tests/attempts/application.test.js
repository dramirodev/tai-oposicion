import { describe, expect, it, vi } from 'vitest';
import { recordAttemptAction } from '../../src/core/application/attempts/record-attempt-action.js';

const initialAttempt = {
  id: 'attempt-1', sessionId: 'session-1', questionId: 'q-1', contentRevision: 'rev-1',
  mode: 'practice', position: 0, exposure: 1, state: 'unseen', response: null, outcome: null,
  confidence: null, discardedOptions: [], highlights: [], createdAt: 100, lastSequence: 0, appliedEventIds: [],
};

function memoryRepository() {
  let current = initialAttempt;
  const eventIds = new Set();
  return {
    repository: {
      getAttempt: vi.fn(async () => current),
      saveTransition: vi.fn(async (_scope, attempt, event) => {
        if (eventIds.has(event.id)) return { status: 'duplicate' };
        eventIds.add(event.id);
        current = attempt;
        return { status: 'stored' };
      }),
    },
    get current() { return current; },
  };
}

describe('caso de uso recordAttemptAction', () => {
  it('crea una acción identificable con reloj inyectado y persiste su transición antes de devolver el efecto', async () => {
    const memory = memoryRepository();
    const result = await recordAttemptAction({
      repository: memory.repository,
      scope: 'guest',
      attemptId: 'attempt-1',
      intent: { type: 'answer', optionIndex: 2, outcome: 'wrong' },
      now: () => 1234,
      monotonicNow: () => 12,
      createEventId: () => 'event-stable',
    });

    expect(result.accepted).toBe(true);
    expect(result.event).toMatchObject({ id: 'event-stable', sequence: 1, at: 1234, monotonicAt: 12, type: 'answer' });
    expect(result.progressEffect).toBe('record-practice-answer');
    expect(memory.repository.saveTransition).toHaveBeenCalledTimes(1);
    expect(memory.current.state).toBe('answered');
  });

  it('no publica un segundo efecto de progreso cuando el repositorio ya conoce el evento', async () => {
    const memory = memoryRepository();
    memory.repository.saveTransition = vi.fn(async () => ({ status: 'duplicate' }));
    const result = await recordAttemptAction({
      repository: memory.repository,
      scope: 'guest',
      attemptId: 'attempt-1',
      intent: { type: 'answer', optionIndex: 2, outcome: 'wrong' },
      now: () => 1234,
      monotonicNow: () => 12,
      createEventId: () => 'event-existing',
    });

    expect(result.accepted).toBe(false);
    expect(result.progressEffect).toBe('none');
    expect(result.reason).toBe('duplicate-event');
  });
});
