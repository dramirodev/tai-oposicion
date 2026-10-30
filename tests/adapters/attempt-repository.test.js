import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';
import { applyAttemptAction } from '../../src/core/domain/attempts/transitions.js';
import { attemptMapper } from '../../src/adapters/local/mappers/attempt.js';

let databaseNumber = 0;
const repository = (name = `attempt-test-${Date.now()}-${databaseNumber++}`) => createLocalAttemptRepository(name);
const makeAttempt = (id = 'attempt-1', sessionId = 'session-1') => ({
  id, sessionId, questionId: 'q-1', contentRevision: 'rev-1', mode: 'practice', position: 0, exposure: 1,
  state: 'unseen', response: null, outcome: null, confidence: null, discardedOptions: [], highlights: [],
  createdAt: 100, lastSequence: 0, appliedEventIds: [],
});
const transition = (attempt, intent) => applyAttemptAction(attempt, {
  ...intent, id: intent.id || `event-${intent.sequence}`, sequence: intent.sequence, at: 200 + intent.sequence,
  monotonicAt: 20 + intent.sequence,
});

describe('localAttemptRepository', () => {
  it('lee datos ya existentes en el esquema v2 publicado', async () => {
    const databaseName = `attempt-legacy-${Date.now()}-${databaseNumber++}`;
    const existing = makeAttempt();
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const attempts = db.createObjectStore('attempts', { keyPath: 'key' });
      attempts.createIndex('scope', 'scope');
      attempts.createIndex('scopeSessionCreated', ['scope', 'sessionId', 'createdAt', 'id']);
      attempts.createIndex('scopeCreated', ['scope', 'createdAt', 'id']);
      const events = db.createObjectStore('events', { keyPath: 'key' });
      events.createIndex('scope', 'scope');
      events.createIndex('scopeAttemptSequence', ['scope', 'attemptId', 'sequence', 'id']);
      const sessions = db.createObjectStore('sessions', { keyPath: 'key' });
      sessions.createIndex('scope', 'scope');
      db.createObjectStore('tombstones', { keyPath: 'scope' });
      attempts.add({ key: ['guest', existing.id], scope: 'guest', id: existing.id, sessionId: existing.sessionId, createdAt: existing.createdAt, lastSequence: existing.lastSequence, value: attemptMapper.toDto(existing) });
    };
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();

    const repo = createLocalAttemptRepository(databaseName);
    expect(await repo.getAttempt('guest', existing.id)).toEqual(existing);
  });

  it('aborta toda la página si un evento existente no se puede mapear', async () => {
    const databaseName = `attempt-corrupt-${Date.now()}-${databaseNumber++}`;
    const repo = repository(databaseName);
    const parent = makeAttempt('parent-attempt');
    await repo.createAttempt('guest', parent);
    const connection = await new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const seed = connection.transaction('events', 'readwrite');
    seed.objectStore('events').add({
      key: ['guest', 'corrupt-event'], scope: 'guest', id: 'corrupt-event', attemptId: parent.id, sequence: 1,
      value: { schemaVersion: 1, id: 'corrupt-event', attemptId: parent.id, sequence: 1, type: 'unknown-event', at: 200, payload: {} },
    });
    await new Promise((resolve, reject) => { seed.oncomplete = resolve; seed.onerror = () => reject(seed.error); });
    connection.close();
    const imported = makeAttempt('second-attempt');
    const collidingEvent = transition(parent, { type: 'open', sequence: 1, id: 'valid-event' }).event;

    await expect(repo.importPage('guest', 100, [imported], [collidingEvent])).rejects.toThrow();
    expect(await repo.getAttempt('guest', imported.id)).toBeUndefined();
  });

  it('aísla ámbitos de cuenta y persiste los intentos mediante el mapper', async () => {
    const repo = repository();
    await repo.createAttempt('guest', makeAttempt());
    await repo.createAttempt('user-1', makeAttempt());

    expect(await repo.getAttempt('guest', 'attempt-1')).toEqual(makeAttempt());
    expect(await repo.getAttempt('user-1', 'attempt-1')).toEqual(makeAttempt());
    expect(await repo.getAttempt('user-2', 'attempt-1')).toBeUndefined();
  });

  it('persiste el cierre de la sesión aparte de los estados de sus preguntas', async () => {
    const repo = repository();
    const active = { id: 'session-1', mode: 'practice', status: 'active', startedAt: 100, lastSequence: 0 };
    await repo.createSession('guest', active);
    await repo.saveSession('guest', { ...active, status: 'completed', endedAt: 500, lastSequence: 3 });

    expect(await repo.getSession('guest', active.id)).toEqual({ ...active, status: 'completed', endedAt: 500, lastSequence: 3 });
    await repo.saveSession('guest', active);
    expect((await repo.getSession('guest', active.id)).status).toBe('completed');
  });

  it('publica cambios solo en el ámbito suscrito y cancela listeners', async () => {
    const repo = repository();
    const guestListener = vi.fn();
    const userListener = vi.fn();
    const off = repo.subscribe('guest', guestListener);
    repo.subscribe('user-1', userListener);
    await repo.createAttempt('guest', makeAttempt());
    expect(guestListener).toHaveBeenCalledTimes(1);
    expect(userListener).not.toHaveBeenCalled();
    off();
    await repo.createAttempt('guest', makeAttempt('attempt-2'));
    expect(guestListener).toHaveBeenCalledTimes(1);
  });

  it('guarda eventos y proyección sin cargar todo el historial y pagina por secuencia', async () => {
    const repo = repository();
    const initial = makeAttempt();
    await repo.createAttempt('guest', initial);
    const first = transition(initial, { type: 'open', sequence: 1 });
    expect(await repo.saveTransition('guest', first.attempt, first.event)).toEqual({ status: 'stored' });
    const second = transition(first.attempt, { type: 'mark-pending', sequence: 2 });
    expect(await repo.saveTransition('guest', second.attempt, second.event)).toEqual({ status: 'stored' });

    const page1 = await repo.getEvents('guest', initial.id, undefined, 1);
    const page2 = await repo.getEvents('guest', initial.id, page1.nextCursor, 1);
    expect(page1.events.map(event => event.type)).toEqual(['open']);
    expect(page2.events.map(event => event.type)).toEqual(['mark-pending']);
    expect(page2.nextCursor).toBeNull();
    expect((await repo.getAttemptsBySession('guest', initial.sessionId, undefined, 1)).attempts).toHaveLength(1);
  });

  it('limita las páginas de intentos y eventos al ámbito y al intento solicitados', async () => {
    const repo = repository();
    await repo.createAttempt('guest', makeAttempt('attempt-1'));
    await repo.createAttempt('guest', makeAttempt('z-other-attempt'));
    await repo.createAttempt('user-1', makeAttempt('account-attempt'));
    const guestAttempt = await repo.getAttempt('guest', 'attempt-1');
    const ownEvent = transition(guestAttempt, { type: 'open', sequence: 1 });
    await repo.saveTransition('guest', ownEvent.attempt, ownEvent.event);
    const otherAttempt = await repo.getAttempt('guest', 'z-other-attempt');
    const otherEvent = transition(otherAttempt, { type: 'open', sequence: 1 });
    await repo.saveTransition('guest', otherEvent.attempt, otherEvent.event);
    const otherAccountAttempt = await repo.getAttempt('user-1', 'account-attempt');
    const otherAccountEvent = transition(otherAccountAttempt, { type: 'open', sequence: 1 });
    await repo.saveTransition('user-1', otherAccountEvent.attempt, otherAccountEvent.event);

    expect((await repo.getScopePage('guest')).attempts.map(attempt => attempt.id).sort())
      .toEqual(['attempt-1', 'z-other-attempt']);
    expect((await repo.getEvents('guest', 'attempt-1')).events.map(event => event.id)).toEqual([ownEvent.event.id]);
  });

  it('hace idempotente la escritura duplicada y conserva un único efecto terminal', async () => {
    const repo = repository();
    const initial = makeAttempt();
    await repo.createAttempt('guest', initial);
    const first = transition(initial, { type: 'answer', sequence: 1, id: 'event-once', optionIndex: 2, outcome: 'wrong' });
    expect(await repo.saveTransition('guest', first.attempt, first.event)).toEqual({ status: 'stored' });
    expect(await repo.saveTransition('guest', first.attempt, first.event)).toEqual({ status: 'duplicate' });
    expect((await repo.getAttempt('guest', initial.id)).response).toBe(2);
    expect((await repo.getEvents('guest', initial.id)).events).toHaveLength(1);
  });

  it('conserva ambos eventos terminales en conflicto y elige el id estable lexicográficamente menor', async () => {
    const repo = repository();
    const initial = makeAttempt();
    await repo.createAttempt('guest', initial);
    const laterId = transition(initial, { type: 'answer', sequence: 1, id: 'a-event', optionIndex: 1, outcome: 'correct' });
    const earlierId = transition(initial, { type: 'answer', sequence: 1, id: 'Z-event', optionIndex: 2, outcome: 'wrong' });
    await repo.saveTransition('guest', laterId.attempt, laterId.event);

    expect(await repo.saveTransition('guest', earlierId.attempt, earlierId.event))
      .toEqual({ status: 'conflict', eventIds: ['Z-event', 'a-event'] });
    expect((await repo.getAttempt('guest', initial.id)).response).toBe(2);
    const firstPage = await repo.getEvents('guest', initial.id, undefined, 1);
    const secondPage = await repo.getEvents('guest', initial.id, firstPage.nextCursor, 1);
    expect([...firstPage.events, ...secondPage.events].map(event => event.id)).toEqual(['Z-event', 'a-event']);
  });

  describe('notificaciones de transiciones', () => {
    const transitions = listener => listener.mock.calls.map(([change]) => change).filter(change => change.type === 'transition');
    const conflictingAnswers = initial => ({
      earlier: transition(initial, { type: 'answer', sequence: 1, id: 'Z-event', optionIndex: 2, outcome: 'wrong' }),
      later: transition(initial, { type: 'answer', sequence: 1, id: 'a-event', optionIndex: 1, outcome: 'correct' }),
    });

    it('no publica la transición de un conflicto que pierde: la proyección local no cambió, aunque el evento se conserve', async () => {
      const repo = repository(), initial = makeAttempt(), listener = vi.fn();
      await repo.createAttempt('guest', initial);
      const { earlier, later } = conflictingAnswers(initial);
      await repo.saveTransition('guest', earlier.attempt, earlier.event);
      repo.subscribe('guest', listener);

      expect(await repo.saveTransition('guest', later.attempt, later.event)).toEqual({ status: 'conflict', eventIds: ['Z-event', 'a-event'] });

      expect(transitions(listener)).toHaveLength(0);
      expect((await repo.getAttempt('guest', initial.id)).response).toBe(2);
      expect((await repo.getEvents('guest', initial.id)).events).toHaveLength(2);
    });

    it('sí publica la transición de un conflicto que gana, porque actualiza la proyección local', async () => {
      const repo = repository(), initial = makeAttempt(), listener = vi.fn();
      await repo.createAttempt('guest', initial);
      const { earlier, later } = conflictingAnswers(initial);
      await repo.saveTransition('guest', later.attempt, later.event);
      repo.subscribe('guest', listener);

      expect((await repo.saveTransition('guest', earlier.attempt, earlier.event)).status).toBe('conflict');

      expect(transitions(listener)).toHaveLength(1);
      expect(transitions(listener)[0].event.id).toBe('Z-event');
    });

    it('un suscriptor que falla no deja colgado el guardado ni impide avisar a los demás', async () => {
      const repo = repository(), initial = makeAttempt(), healthy = vi.fn();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      await repo.createAttempt('guest', initial);
      repo.subscribe('guest', () => { throw new Error('suscriptor roto'); });
      repo.subscribe('guest', healthy);
      const first = transition(initial, { type: 'answer', sequence: 1, id: 'event-once', optionIndex: 2, outcome: 'wrong' });

      await expect(repo.saveTransition('guest', first.attempt, first.event)).resolves.toEqual({ status: 'stored' });

      expect(transitions(healthy)).toHaveLength(1);
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });
  });

  it('reconcilia de forma determinista una respuesta terminal importada de otro dispositivo', async () => {
    const repo = repository();
    const initial = makeAttempt();
    await repo.createAttempt('guest', initial);
    const local = transition(initial, { type: 'answer', sequence: 1, id: 'z-event', optionIndex: 1, outcome: 'correct' });
    const remote = transition(initial, { type: 'answer', sequence: 1, id: 'A-event', optionIndex: 2, outcome: 'wrong' });
    await repo.importPage('guest', 300, [local.attempt], [local.event], 'remote');
    await repo.importPage('guest', 300, [remote.attempt], [remote.event], 'remote');

    expect(await repo.getAttempt('guest', initial.id)).toMatchObject({
      state: 'answered', response: 2, outcome: 'wrong', lastSequence: 1,
    });
    expect((await repo.getEvents('guest', initial.id)).events.map(event => event.id).sort()).toEqual(['A-event', 'z-event']);
  });

  it('respeta el tombstone al importar una copia anterior y admite una copia creada después', async () => {
    const repo = repository();
    await repo.createAttempt('guest', makeAttempt());
    await repo.deleteScope('guest', 500);
    const listener = vi.fn();
    repo.subscribe('guest', listener);
    await repo.importPage('guest', 400, [makeAttempt()], []);
    await repo.importPage('guest', 600, [makeAttempt()], []);
    expect(await repo.getAttempt('guest', 'attempt-1')).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
    await repo.importPage('guest', 600, [{ ...makeAttempt(), createdAt: 600 }], []);
    expect(await repo.getAttempt('guest', 'attempt-1')).toEqual({ ...makeAttempt(), createdAt: 600 });
  });

  it('el borrado por tombstone elimina datos existentes y conserva datos posteriores al instante de borrado', async () => {
    const repo = repository();
    const oldSession = { id: 'old-session', mode: 'practice', status: 'active', startedAt: 100, lastSequence: 0 };
    const newSession = { id: 'new-session', mode: 'practice', status: 'active', startedAt: 600, lastSequence: 0 };
    const oldAttempt = { ...makeAttempt('old-attempt', oldSession.id), createdAt: 100 };
    const newAttempt = { ...makeAttempt('new-attempt', newSession.id), createdAt: 600 };
    await repo.createSession('guest', oldSession);
    await repo.createSession('guest', newSession);
    await repo.createAttempt('guest', oldAttempt);
    await repo.createAttempt('guest', newAttempt);
    const oldOpen = transition(oldAttempt, { type: 'open', sequence: 1, id: 'old-open-event' });
    const newOpen = transition(newAttempt, { type: 'open', sequence: 1, id: 'new-open-event' });
    await repo.saveTransition('guest', oldOpen.attempt, oldOpen.event);
    await repo.saveTransition('guest', newOpen.attempt, newOpen.event);

    await repo.deleteScope('guest', 500);

    expect(await repo.getSession('guest', oldSession.id)).toBeUndefined();
    expect(await repo.getAttempt('guest', oldAttempt.id)).toBeUndefined();
    expect((await repo.getEvents('guest', oldAttempt.id)).events).toEqual([]);
    expect(await repo.getSession('guest', newSession.id)).toEqual(newSession);
    expect(await repo.getAttempt('guest', newAttempt.id)).toEqual(newOpen.attempt);
    expect((await repo.getEvents('guest', newAttempt.id)).events).toEqual([newOpen.event]);
  });

  it('ignora un tombstone remoto antiguo y conserva el alcance ya borrado', async () => {
    const repo = repository();
    await repo.createAttempt('guest', makeAttempt());
    await repo.deleteScope('guest', 500);
    await repo.importPage('guest', 600, [{ ...makeAttempt(), createdAt: 600 }], []);
    await repo.deleteScope('guest', 400, 'remote');
    expect(await repo.getScopeTombstone('guest')).toEqual({ deletedAt: 500, revision: 1 });
    expect(await repo.getAttempt('guest', 'attempt-1')).toEqual({ ...makeAttempt(), createdAt: 600 });
  });
});
