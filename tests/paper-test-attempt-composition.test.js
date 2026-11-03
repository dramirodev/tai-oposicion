import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaperTestAttemptComposition } from '../src/app/composition/trainers/paper-test-attempt-composition.ts';

describe('composición de registro en papel', () => {
  beforeEach(() => localStorage.clear());

  it('corrige un tramo con el mismo ID y conserva la fecha del intento', () => {
    let now = Date.parse('2026-11-02T20:00:00Z');
    const push = vi.fn();
    const store = createPaperTestAttemptComposition({ accountId:() => 'student', now:() => now, createId:() => 'attempt-id-0001', push });
    const input = { attemptId:'attempt-id-0001', segment:1, startedAt:now - 30 * 60_000, completedAt:now, correctionStatus:'answer-key-only', questionCount:20, answeredCount:18, correctCount:12, incorrectCount:6, blankCount:2 };
    const created = store.record(input);
    now += 60_000;
    const updated = store.record({ ...input, sourceLabel:'Test en papel revisado' }, created.id);
    expect(updated).toMatchObject({ id:created.id, sourceLabel:'Test en papel revisado', completedAt:input.completedAt, updatedAt:now });
    expect(store.get()).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('no convierte una edición inexistente en un alta', () => {
    const store = createPaperTestAttemptComposition({ accountId:() => 'student', now:() => 1000, createId:() => 'attempt-id-0001' });
    expect(store.record({ attemptId:'attempt-id-0001', segment:1, startedAt:100, completedAt:200, correctionStatus:'unavailable' }, 'unknown-id')).toBeNull();
    expect(store.get()).toEqual([]);
  });

  it('anula el mismo registro de forma idempotente y sincroniza su estado', () => {
    let now = Date.parse('2026-11-02T20:00:00Z');
    const push = vi.fn();
    const store = createPaperTestAttemptComposition({ accountId:() => 'student', now:() => now, createId:() => 'attempt-id-0001', push });
    const created = store.record({ attemptId:'attempt-id-0001', segment:1, startedAt:now - 1000, completedAt:now, correctionStatus:'unavailable', topicId:'T1.01', selfRating:'partial' });
    now += 1;
    const voided = store.void(created.id);
    expect(voided).toMatchObject({ id:created.id, completedAt:created.completedAt, voidedAt:now });
    expect(store.get()).toEqual([voided]);
    expect(store.void(created.id)).toBeNull();
    expect(push).toHaveBeenCalledTimes(2);
  });
});
