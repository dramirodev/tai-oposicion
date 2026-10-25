import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createAttemptTracker } from '../../src/core/application/attempts/create-attempt-tracker.js';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';

describe('createAttemptTracker', () => {
  let databaseName;
  let repository;
  let nextId;
  let now;
  let monotonicNow;

  beforeEach(() => {
    databaseName = `attempt-tracker-${Math.random()}`;
    repository = createLocalAttemptRepository(databaseName);
    let id = 0;
    nextId = kind => `${kind}-${++id}`;
    now = 1000;
    monotonicNow = 10;
  });

  it('serializa creación y eventos, y cierra la sesión sin alterar el efecto del progreso', async () => {
    const tracker = createAttemptTracker({
      repository,
      createId: nextId,
      now: () => now,
      monotonicNow: () => monotonicNow,
    });
    const created = tracker.beginSession('account-1', 'practice', now, [
      { questionId: 'q-1', contentRevision: '', position: 0, exposure: 1 },
    ]);
    const attempt = created.attempts[0];
    tracker.record('account-1', attempt.id, { type: 'open' });
    now += 1000;
    monotonicNow += 1000;
    tracker.record('account-1', attempt.id, { type: 'answer', optionIndex: 2, outcome: 'correct' });
    tracker.closeSession('account-1', created.session.id, 'completed', now);
    await tracker.flush();

    expect(await repository.getSession('account-1', created.session.id)).toMatchObject({
      status: 'completed', endedAt: now, lastSequence: 1,
    });
    expect(await repository.getAttempt('account-1', attempt.id)).toMatchObject({
      state: 'answered', response: 2, outcome: 'correct', lastSequence: 2,
    });
    const events = await repository.getEvents('account-1', attempt.id);
    expect(events.events.map(event => event.type)).toEqual(['open', 'answer']);
  });

  it('conserva errores de escritura mediante el callback sin bloquear eventos posteriores', async () => {
    const errors = [];
    const tracker = createAttemptTracker({
      repository,
      createId: nextId,
      now: () => now,
      monotonicNow: () => monotonicNow,
      onError: error => errors.push(error),
    });
    const created = tracker.beginSession('account-1', 'practice', now, []);
    repository.createSession = async () => { throw new Error('quota'); };
    tracker.closeSession('account-1', created.session.id, 'interrupted', now + 10);
    await tracker.flush();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('quota');
  });
});
