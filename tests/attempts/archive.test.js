import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { exportAttemptArchive } from '../../src/core/application/attempts/export-attempt-archive.js';
import { importAttemptArchive } from '../../src/core/application/attempts/import-attempt-archive.js';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';
import { applyAttemptAction } from '../../src/core/domain/attempts/transitions.js';

const newRepository = () => createLocalAttemptRepository(`attempt-archive-${Date.now()}-${Math.random()}`);

describe('exportación e importación del historial de intentos', () => {
  it('exporta sesiones, intentos y eventos por páginas, e importa repetidamente sin duplicados', async () => {
    const source = newRepository();
    const session = { id: 'session-1', mode: 'practice', status: 'active', startedAt: 100, lastSequence: 0 };
    const attempt = {
      id: 'attempt-1', sessionId: session.id, questionId: 'q-1', contentRevision: '', mode: 'practice',
      position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null,
      discardedOptions: [], highlights: [], createdAt: 100, lastSequence: 0, appliedEventIds: [],
    };
    await source.createSession('user-1', session);
    await source.createAttempt('user-1', attempt);
    const transition = applyAttemptAction(attempt, {
      type: 'answer', id: 'event-1', sequence: 1, at: 200, monotonicAt: 40, optionIndex: 2, outcome: 'wrong',
    });
    await source.saveTransition('user-1', transition.attempt, transition.event);
    await source.saveSession('user-1', { ...session, status: 'completed', endedAt: 300, lastSequence: 1 });

    const archive = await exportAttemptArchive(source, 'user-1', 400);
    expect(archive).toMatchObject({ createdAt: 400, sessions: [{ status: 'completed' }], attempts: [{ state: 'answered' }], events: [{ id: 'event-1' }] });

    const target = newRepository();
    await importAttemptArchive(target, 'user-2', archive);
    await importAttemptArchive(target, 'user-2', archive);
    expect(await target.getSession('user-2', session.id)).toMatchObject({ status: 'completed', endedAt: 300 });
    expect(await target.getAttempt('user-2', attempt.id)).toMatchObject({ state: 'answered', response: 2 });
    expect((await target.getEvents('user-2', attempt.id)).events).toHaveLength(1);
    expect(await target.getAttempt('user-1', attempt.id)).toBeUndefined();
  });

  it('un tombstone conserva un borrado y no resucita una copia antigua', async () => {
    const target = newRepository();
    const archive = {
      createdAt: 300,
      sessions: [{ id: 's-old', mode: 'practice', status: 'active', startedAt: 100, lastSequence: 0 }],
      attempts: [], events: [],
    };
    await target.deleteScope('user-1', 400);
    await importAttemptArchive(target, 'user-1', archive);
    expect(await target.getSession('user-1', 's-old')).toBeUndefined();
  });
});
