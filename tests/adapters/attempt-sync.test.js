import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ snapshots: [], documents: new Map(), writes: [], deletes: [], reads: [], pages: new Map(), failWrites: false, afterDelete: null }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => ({ path: parts.join('/') }),
  doc: (_db, ...parts) => ({ path: parts.join('/') }),
  documentId: () => '__name__',
  deleteDoc: async ref => {
    boundary.deletes.push(ref.path);
    boundary.documents.delete(ref.path);
    boundary.afterDelete?.();
  },
  getDoc: async ref => ({ exists: () => boundary.documents.has(ref.path), data: () => boundary.documents.get(ref.path) }),
  getDocs: async ref => { boundary.reads.push(ref.path); return { docs: boundary.pages.get(ref.path) || [] }; },
  limit: count => ({ type: 'limit', count }),
  onSnapshot: (ref, next, error) => {
    const listener = { ref, next, error, active: true };
    boundary.snapshots.push(listener);
    return () => { listener.active = false; };
  },
  orderBy: field => ({ type: 'orderBy', field }),
  query: (ref, ...constraints) => ({ path: ref.path, constraints }),
  setDoc: async (ref, value) => {
    if (boundary.failWrites) throw new Error('offline');
    boundary.writes.push({ path: ref.path, value });
    boundary.documents.set(ref.path, value);
  },
  startAfter: value => ({ type: 'startAfter', value }),
  where: (field, operator, value) => ({ type: 'where', field, operator, value }),
}));

import { syncAttemptHistory } from '../../src/adapters/firebase/attempt-sync.js';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';
import { applyAttemptAction } from '../../src/core/domain/attempts/transitions.js';
import { attemptMapper } from '../../src/adapters/local/mappers/attempt.js';

describe('syncAttemptHistory', () => {
  let repo;
  beforeEach(() => {
    boundary.snapshots.length = 0;
    boundary.documents.clear();
    boundary.writes.length = 0;
    boundary.deletes.length = 0;
    boundary.pages.clear();
    boundary.reads.length = 0;
    boundary.failWrites = false;
    boundary.afterDelete = null;
    repo = createLocalAttemptRepository(`attempt-sync-${Date.now()}-${Math.random()}`);
  });

  it('sube sesiones, proyecciones y eventos al ámbito autenticado, y cancela listeners', async () => {
    const active = vi.fn(() => true);
    const off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active, onError: error => { throw error; } });
    const session = { id: 'session-1', mode: 'practice', status: 'active', startedAt: 100, lastSequence: 0 };
    const attempt = {
      id: 'attempt-1', sessionId: session.id, questionId: 'q-1', contentRevision: '', mode: 'practice',
      position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null,
      discardedOptions: [], highlights: [], createdAt: 100, lastSequence: 0, appliedEventIds: [],
    };
    await repo.createSession('user-1', session);
    await repo.createAttempt('user-1', attempt);
    const answered = applyAttemptAction(attempt, {
      type: 'answer', id: 'event-1', sequence: 1, at: 200, monotonicAt: 20, optionIndex: 2, outcome: 'wrong',
    });
    await repo.saveTransition('user-1', answered.attempt, answered.event);
    await vi.waitFor(() => expect(boundary.writes.map(write => write.path)).toContain('users/user-1/attempts/attempt-1/events/event-1'));
    expect(boundary.writes.map(write => write.path)).toContain('users/user-1/attemptSessions/session-1');
    expect(boundary.writes.findIndex(write => write.path.endsWith('/events/event-1')))
      .toBeLessThan(boundary.writes.findIndex(write => write.path === 'users/user-1/attempts/attempt-1' && write.value.state === 'answered'));
    expect(boundary.documents.get('users/user-1/attempts/attempt-1').state).toBe('answered');
    expect(boundary.snapshots.map(listener => listener.ref.path)).toContain('users/user-1/attempts');

    const writesBeforeStop = boundary.writes.length;
    off();
    expect(boundary.snapshots.every(listener => !listener.active)).toBe(true);
    await repo.createAttempt('user-1', { ...attempt, id: 'attempt-2' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(boundary.writes).toHaveLength(writesBeforeStop);
  });

  it('no recibe ni envía datos después de cambiar de cuenta', async () => {
    let current = true;
    const off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => current, onError: () => {} });
    current = false;
    await repo.createAttempt('user-1', {
      id: 'attempt-1', sessionId: 'session-1', questionId: 'q-1', contentRevision: '', mode: 'practice',
      position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null,
      discardedOptions: [], highlights: [], createdAt: 100, lastSequence: 0, appliedEventIds: [],
    });
    expect(boundary.writes).toEqual([]);
    off();
  });

  it('importa por páginas los eventos del intento remoto sin descargar otras sesiones', async () => {
    const off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => true, onError: error => { throw error; } });
    const initial = {
      id: 'remote-attempt', sessionId: 'remote-session', questionId: 'q-2', contentRevision: 'r2', mode: 'practice',
      position: 1, exposure: 2, state: 'unseen', response: null, outcome: null, confidence: null,
      discardedOptions: [], highlights: [], createdAt: 300, lastSequence: 0, appliedEventIds: [],
    };
    const transition = applyAttemptAction(initial, {
      type: 'answer', id: 'remote-event', sequence: 1, at: 400, monotonicAt: 30, optionIndex: 1, outcome: 'correct',
    });
    const attempt = transition.attempt;
    const eventDocument = { id: 'remote-event', data: () => attemptMapper.eventToDto(transition.event) };
    boundary.pages.set('users/user-1/attempts/remote-attempt/events', [eventDocument]);
    const remoteDocument = { id: attempt.id, data: () => attemptMapper.toDto(attempt) };
    boundary.snapshots.find(listener => listener.ref.path === 'users/user-1/attempts').next({
      docs: [remoteDocument],
      docChanges: () => [{ type: 'added', doc: remoteDocument }],
    });

    await vi.waitFor(async () => {
      expect(await repo.getAttempt('user-1', attempt.id)).toMatchObject({ response: 1, outcome: 'correct' });
      expect((await repo.getEvents('user-1', attempt.id)).events).toHaveLength(1);
    });
    off();
  });

  it('al cambiar un intento remoto solo vuelve a leer los eventos de ese intento', async () => {
    const off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => true, onError: error => { throw error; } });
    const remote = id => ({
      id, sessionId: 'remote-session', questionId: `q-${id}`, contentRevision: '', mode: 'practice', position: 0, exposure: 1,
      state: 'unseen', response: null, outcome: null, confidence: null, discardedOptions: [], highlights: [],
      createdAt: 500, lastSequence: 0, appliedEventIds: [],
    });
    const asDocument = attempt => ({ id: attempt.id, data: () => attemptMapper.toDto(attempt) });
    const [first, second] = [asDocument(remote('attempt-a')), asDocument(remote('attempt-b'))];
    const listener = boundary.snapshots.find(item => item.ref.path === 'users/user-1/attempts');
    const snapshot = (changes) => ({ docs: [first, second], docChanges: () => changes.map(([type, document]) => ({ type, doc: document })) });

    listener.next(snapshot([['added', first], ['added', second]]));
    await vi.waitFor(() => expect(boundary.reads.filter(path => path.endsWith('/events')).sort()).toEqual([
      'users/user-1/attempts/attempt-a/events', 'users/user-1/attempts/attempt-b/events',
    ]));
    boundary.reads.length = 0;

    listener.next(snapshot([['modified', second]]));
    await vi.waitFor(() => expect(boundary.reads).toContain('users/user-1/attempts/attempt-b/events'));
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(boundary.reads.filter(path => path.endsWith('/events'))).toEqual(['users/user-1/attempts/attempt-b/events']);
    off();
  });

  it('retiene historial local durante una caída de red y lo sincroniza al reconectar', async () => {
    const errors = [];
    boundary.failWrites = true;
    let off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => true, onError: error => errors.push(error) });
    const attempt = {
      id: 'offline-attempt', sessionId: 'offline-session', questionId: 'q-3', contentRevision: '', mode: 'practice',
      position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null,
      discardedOptions: [], highlights: [], createdAt: 100, lastSequence: 0, appliedEventIds: [],
    };
    await repo.createAttempt('user-1', attempt);
    const response = applyAttemptAction(attempt, {
      type: 'answer', id: 'offline-event', sequence: 1, at: 200, monotonicAt: 50, optionIndex: 1, outcome: 'wrong',
    });
    await repo.saveTransition('user-1', response.attempt, response.event);
    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(await repo.getAttempt('user-1', attempt.id)).toMatchObject({ response: 1, outcome: 'wrong' });
    expect((await repo.getEvents('user-1', attempt.id)).events).toHaveLength(1);

    off();
    boundary.failWrites = false;
    off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => true, onError: error => errors.push(error) });
    await vi.waitFor(() => expect(boundary.documents.get('users/user-1/attempts/offline-attempt/events/offline-event')?.id).toBe('offline-event'));
    expect(boundary.documents.get('users/user-1/attempts/offline-attempt').response).toBe(1);
    off();
  });

  it('borra el historial remoto anterior al tombstone e incluye sus eventos', async () => {
    const session = { id: 'cloud-session', mode: 'practice', status: 'active', startedAt: 100, lastSequence: 0 };
    const attempt = {
      id: 'cloud-attempt', sessionId: session.id, questionId: 'q-cloud', contentRevision: '', mode: 'practice',
      position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null,
      discardedOptions: [], highlights: [], createdAt: 100, lastSequence: 0, appliedEventIds: [],
    };
    const sessionPath = 'users/user-1/attemptSessions/cloud-session';
    const attemptPath = 'users/user-1/attempts/cloud-attempt';
    const eventPath = `${attemptPath}/events/cloud-event`;
    boundary.documents.set(sessionPath, { id: session.id });
    boundary.documents.set(attemptPath, attemptMapper.toDto(attempt));
    boundary.documents.set(eventPath, { id: 'cloud-event' });
    boundary.pages.set('users/user-1/attemptSessions', [{ id: session.id, ref: { path: sessionPath }, data: () => ({ startedAt: 100 }) }]);
    boundary.pages.set('users/user-1/attempts', [{ id: attempt.id, ref: { path: attemptPath }, data: () => attemptMapper.toDto(attempt) }]);
    boundary.pages.set(`${attemptPath}/events`, [{ id: 'cloud-event', ref: { path: eventPath } }]);

    const off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => true, onError: error => { throw error; } });
    await repo.deleteScope('user-1', 500);

    await vi.waitFor(() => expect(boundary.documents.has(attemptPath)).toBe(false));
    expect(boundary.documents.has(eventPath)).toBe(false);
    expect(boundary.documents.has(sessionPath)).toBe(false);
    expect(boundary.deletes).toEqual(expect.arrayContaining([eventPath, attemptPath, sessionPath]));
    off();
  });

  it('reintenta el borrado remoto al reconectar si el tombstone ya existía localmente', async () => {
    const attempt = {
      id: 'pending-delete', sessionId: 'old-session', questionId: 'q-old', contentRevision: '', mode: 'practice',
      position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null,
      discardedOptions: [], highlights: [], createdAt: 100, lastSequence: 0, appliedEventIds: [],
    };
    const attemptPath = 'users/user-1/attempts/pending-delete';
    boundary.documents.set(attemptPath, attemptMapper.toDto(attempt));
    boundary.pages.set('users/user-1/attempts', [{ ref: { path: attemptPath }, data: () => attemptMapper.toDto(attempt) }]);
    const errors = [];
    boundary.failWrites = true;
    let off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => true, onError: error => errors.push(error) });
    await repo.deleteScope('user-1', 500);
    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(boundary.documents.has(attemptPath)).toBe(true);
    off();

    boundary.failWrites = false;
    off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => true, onError: error => { throw error; } });

    await vi.waitFor(() => expect(boundary.documents.has(attemptPath)).toBe(false));
    off();
  });

  it('detiene la purga si la cuenta activa cambia durante una página', async () => {
    let active = true;
    const attempts = ['first-attempt', 'second-attempt'].map(id => ({
      id,
      ref: { path: `users/user-1/attempts/${id}` },
      data: () => ({ createdAt: 100 }),
    }));
    for (const attempt of attempts) boundary.documents.set(attempt.ref.path, attempt.data());
    boundary.pages.set('users/user-1/attempts', attempts);
    boundary.afterDelete = () => { active = false; };
    const off = syncAttemptHistory({ db: {}, uid: 'user-1', repository: repo, active: () => active, onError: error => { throw error; } });

    await repo.deleteScope('user-1', 500);
    await vi.waitFor(() => expect(boundary.deletes).toHaveLength(1));

    expect(boundary.deletes).toEqual(['users/user-1/attempts/first-attempt']);
    expect(boundary.documents.has('users/user-1/attempts/second-attempt')).toBe(true);
    off();
  });
});
