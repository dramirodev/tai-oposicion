import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
} from 'firebase/firestore';
import type { Firestore, FirestoreError, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore';
import type { AttemptRepository } from '../../core/ports/AttemptRepository.js';
import type { AttemptEvent, QuestionAttempt, QuestionAttemptSession } from '../../core/domain/attempts/transitions.js';
import { attemptMapper } from '../local/mappers/attempt.js';
import { attemptSessionMapper } from '../local/mappers/attempt-session.js';

const PAGE_SIZE = 100;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

interface FirestoreAttemptSyncOptions {
  db: Firestore;
  uid: string;
  repository: AttemptRepository;
  active: () => boolean;
  onError: (error: FirestoreError) => void;
}

function idScope(uid: string): string { return uid; }

export function syncAttemptHistory(options: FirestoreAttemptSyncOptions): Unsubscribe {
  const { db, uid, repository, active, onError } = options;
  const scope = idScope(uid);
  const base = ['users', uid] as const;
  const pendingWrites = new Map<string, Promise<void>>();
  let closed = false;
  const fail = (error: unknown) => { if (!closed && active()) onError(error as FirestoreError); };
  const eventCursor = (sequence: number): string => JSON.stringify({ sequence, id: '' });
  const localPageSize = 50;
  const localOff = repository.subscribe(scope, change => {
    if (closed || !active()) return;
    if (change.type === 'scope-deleted') {
      if (change.source === 'local') void pushTombstone(change.deletedAt).catch(fail);
      return;
    }
    if (change.type === 'page-imported') {
      if (change.source === 'import') {
        for (const attempt of change.attempts) {
          if (attempt.state === 'unseen' || attempt.state === 'pending') void pushAttempt(attempt).catch(fail);
        }
      }
      for (const event of change.events) {
        void queueAttemptWrite(event.attemptId, async () => {
          const attempt = await repository.getAttempt(scope, event.attemptId);
          if (!attempt) return;
          await pushEvent(event);
          await pushAttemptNow(attempt);
        }).catch(fail);
      }
      return;
    }
    if (change.source === 'remote') return;
    if (change.type === 'session-updated') void pushSession(change.session).catch(fail);
    if (change.type === 'attempt-created') void pushAttempt(change.attempt).catch(fail);
    if (change.type === 'transition') {
      void queueAttemptWrite(change.attempt.id, async () => {
        await pushEvent(change.event);
        await pushAttemptNow(change.attempt);
      }).catch(fail);
    }
  });

  const unsubs: Unsubscribe[] = [localOff];
  const attemptQuery = query(collection(db, ...base, 'attempts'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  unsubs.push(onSnapshot(attemptQuery, snapshot => {
    if (!active() || closed) return;
    for (const document of snapshot.docs) {
      const mapped = attemptMapper.toDomain(document.data());
      if (!mapped.ok) continue;
      void pullAttempt(mapped.value).catch(fail);
    }
  }, onError));

  const sessionQuery = query(collection(db, ...base, 'attemptSessions'), orderBy('startedAt', 'desc'), limit(PAGE_SIZE));
  unsubs.push(onSnapshot(sessionQuery, snapshot => {
    if (!active() || closed) return;
    for (const document of snapshot.docs) {
      const mapped = attemptSessionMapper.toDomain(document.data());
      if (mapped.ok) void mergeSession(mapped.value).catch(fail);
    }
  }, onError));
  void reconcileLocalAttempts().catch(fail);

  unsubs.push(onSnapshot(doc(db, ...base, 'cfg', 'attempts'), snapshot => {
    if (!active() || closed || !snapshot.exists()) return;
    const value = snapshot.data();
    const deletedAt = value.deletedAt;
    if (typeof deletedAt !== 'number' || !Number.isFinite(deletedAt)) return;
    void repository.getScopeTombstone(scope).then(current => {
      if (!active() || (current && current.deletedAt >= deletedAt)) return;
      return repository.getScopePage(scope, undefined, 1).then(page => {
        if (!active()) return;
        const newest = page.attempts[0];
        if (newest && newest.createdAt > deletedAt) return;
        return repository.deleteScope(scope, deletedAt, 'remote');
      });
    }).catch(onError);
  }, onError));

  async function pushSession(session: QuestionAttemptSession): Promise<void> {
    if (closed || !active()) return;
    const ref = doc(db, ...base, 'attemptSessions', session.id);
    const value = attemptSessionMapper.toDto(session);
    const current = await getDoc(ref);
    if (!active() || (current.exists() && stableJson(current.data()) === stableJson(value))) return;
    await setDoc(ref, value);
  }

  async function pushAttemptNow(attempt: QuestionAttempt): Promise<void> {
    if (closed || !active()) return;
    const ref = doc(db, ...base, 'attempts', attempt.id);
    const value = attemptMapper.toDto(attempt);
    const current = await getDoc(ref);
    if (!active() || (current.exists() && stableJson(current.data()) === stableJson(value))) return;
    await setDoc(ref, value);
  }

  function queueAttemptWrite(attemptId: string, action: () => Promise<void>): Promise<void> {
    const previous = pendingWrites.get(attemptId) || Promise.resolve();
    const next = previous.catch(() => undefined).then(action);
    pendingWrites.set(attemptId, next);
    void next.finally(() => {
      if (pendingWrites.get(attemptId) === next) pendingWrites.delete(attemptId);
    }).catch(() => undefined);
    return next;
  }

  function pushAttempt(attempt: QuestionAttempt): Promise<void> {
    return queueAttemptWrite(attempt.id, () => pushAttemptNow(attempt));
  }

  async function pushEvent(event: AttemptEvent): Promise<void> {
    if (closed || !active()) return;
    const ref = doc(db, ...base, 'attempts', event.attemptId, 'events', event.id);
    const existing = await getDoc(ref);
    if (!active() || existing.exists()) return;
    await setDoc(ref, attemptMapper.eventToDto(event));
  }

  async function pullAttempt(attempt: QuestionAttempt): Promise<void> {
    if (closed || !active()) return;
    const local = await repository.getAttempt(scope, attempt.id);
    const afterSequence = Math.max(0, (local?.lastSequence || 0) - 1);
    await repository.importPage(scope, attempt.createdAt, [attempt], [], 'remote');
    let cursor: QueryDocumentSnapshot | undefined;
    while (!closed && active()) {
      const events = collection(db, ...base, 'attempts', attempt.id, 'events');
      const constraints = [where('sequence', '>=', afterSequence), orderBy('sequence'), orderBy(documentId()), limit(PAGE_SIZE)];
      const page = await getDocs(query(events, ...(cursor ? [...constraints.slice(0, 3), startAfter(cursor), constraints[3]] : constraints)));
      if (!active() || closed) return;
      const mapped = page.docs.flatMap(document => {
        const result = attemptMapper.eventToDomain(document.data());
        return result.ok ? [result.value] : [];
      });
      if (mapped.length) await repository.importPage(scope, attempt.createdAt, [], mapped, 'remote');
      if (page.docs.length < PAGE_SIZE) return;
      cursor = page.docs.at(-1);
    }
  }

  async function mergeSession(remote: QuestionAttemptSession): Promise<void> {
    if (closed || !active()) return;
    const current = await repository.getSession(scope, remote.id);
    if (!current) return repository.createSession(scope, remote, 'remote');
    if (current.status === 'active' && remote.lastSequence > current.lastSequence) {
      await repository.saveSession(scope, remote, 'remote');
    }
  }

  async function pushTombstone(deletedAt: number): Promise<void> {
    if (closed || !active()) return;
    const tombstone = await repository.getScopeTombstone(scope);
    if (!tombstone) return;
    await setDoc(doc(db, ...base, 'cfg', 'attempts'), {
      schemaVersion: 1,
      deletedAt: Math.max(deletedAt, tombstone.deletedAt),
      revision: tombstone.revision,
    });
  }

  async function pushLocalEvents(attemptId: string, fromSequence: number): Promise<void> {
    let cursor: string | undefined = fromSequence > 0 ? eventCursor(fromSequence) : undefined;
    while (!closed && active()) {
      const page = await repository.getEvents(scope, attemptId, cursor, localPageSize);
      for (const event of page.events) await pushEvent(event);
      if (!page.nextCursor) return;
      cursor = page.nextCursor;
    }
  }

  async function reconcileLocalAttempts(): Promise<void> {
    let cursor: string | undefined;
    const syncedSessions = new Set<string>();
    while (!closed && active()) {
      const page = await repository.getScopePage(scope, cursor, localPageSize);
      for (const local of page.attempts) {
        if (closed || !active()) return;
        if (!syncedSessions.has(local.sessionId)) {
          const session = await repository.getSession(scope, local.sessionId);
          if (session) await pushSession(session);
          syncedSessions.add(local.sessionId);
        }
        const remoteSnapshot = await getDoc(doc(db, ...base, 'attempts', local.id));
        if (!active() || closed) return;
        if (!remoteSnapshot.exists()) {
          const needsTerminalEvent = local.state === 'answered' || local.state === 'revealed';
          if (needsTerminalEvent) {
            await pushAttempt({
              ...local,
              state: 'unseen',
              response: null,
              outcome: null,
              terminalEventId: undefined,
              completedAt: undefined,
              lastSequence: 0,
              appliedEventIds: [],
            });
          } else await pushAttempt(local);
          await pushLocalEvents(local.id, 0);
          if (needsTerminalEvent) await pushAttempt(local);
          continue;
        }
        const mapped = attemptMapper.toDomain(remoteSnapshot.data());
        if (!mapped.ok) continue;
        const remote = mapped.value;
        if (remote.lastSequence > local.lastSequence) await pullAttempt(remote);
        else {
          const remoteDto = remoteSnapshot.data();
          if (stableJson(attemptMapper.toDto(local)) !== stableJson(remoteDto)) {
            await pushLocalEvents(local.id, Math.max(0, remote.lastSequence));
            await pushAttempt(local);
          }
        }
      }
      if (!page.nextCursor) return;
      cursor = page.nextCursor;
    }
  }

  return () => {
    if (closed) return;
    closed = true;
    unsubs.forEach(unsubscribe => unsubscribe());
    pendingWrites.clear();
  };
}
