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
    ], 45, 'training:2026-11-02');
    const attempt = created.attempts[0];
    tracker.record('account-1', attempt.id, { type: 'open' });
    now += 1000;
    monotonicNow += 1000;
    tracker.record('account-1', attempt.id, { type: 'answer', optionIndex: 2, outcome: 'correct' });
    tracker.closeSession('account-1', created.session.id, 'completed', now, 31);
    await tracker.flush();

    expect(await repository.getSession('account-1', created.session.id)).toMatchObject({
      status: 'completed', endedAt: now, lastSequence: 1, timeLimitSeconds: 45, elapsedSeconds: 31, sourceSessionId:'training:2026-11-02',
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

  it('devuelve el resultado del evento y permite seguir usando la cola tras un fallo', async () => {
    const errors = [];
    const tracker = createAttemptTracker({
      repository,
      createId: nextId,
      now: () => now,
      monotonicNow: () => monotonicNow,
      onError: error => errors.push(error),
    });
    const created = tracker.beginSession('account-1', 'practice', now, [
      { questionId: 'q-1', contentRevision: '', position: 0, exposure: 1 },
    ]);
    const attempt = created.attempts[0];
    await tracker.flush();
    const saveTransition = repository.saveTransition.bind(repository);
    let writeCount = 0;
    repository.saveTransition = async (...args) => {
      if (writeCount++ === 0) throw new Error('quota');
      return saveTransition(...args);
    };

    await expect(tracker.record('account-1', attempt.id, { type: 'open' })).resolves.toBe(false);
    expect(errors).toHaveLength(1);
    await expect(tracker.record('account-1', attempt.id, { type: 'open' })).resolves.toBe(true);
    expect((await repository.getEvents('account-1', attempt.id)).events.map(event => event.type)).toEqual(['open']);
  });

  it('usa identificadores estables y no duplica la sesión al iniciar dos veces el mismo reintento', async () => {
    const tracker = createAttemptTracker({ repository, createId: nextId, now: () => now, monotonicNow: () => monotonicNow });
    const seed = { questionId: 'q-1', contentRevision: 'rev-1', position: 0, exposure: 2, exposureKind: 'immediate-retry', retryOfAttemptId: 'attempt-original' };
    const first = tracker.beginSession('account-1', 'practice', now, [seed]);
    const second = tracker.beginSession('account-1', 'practice', now + 100, [seed]);
    await tracker.flush();

    expect(second.session.id).toBe(first.session.id);
    expect(second.attempts[0].id).toBe(first.attempts[0].id);
    expect(await repository.getSession('account-1', first.session.id)).toMatchObject({ id: first.session.id });
    expect(await repository.getAttempt('account-1', first.attempts[0].id)).toMatchObject({
      exposureKind: 'immediate-retry', retryOfAttemptId: 'attempt-original', questionId: 'q-1',
    });
    expect((await repository.getScopePage('account-1', null, 10)).attempts.filter(item => item.id.startsWith('retry-attempt:'))).toHaveLength(1);
  });
});
