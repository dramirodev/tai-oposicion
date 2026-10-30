import { openDB, unwrap, wrap, type IDBPDatabase } from 'idb';
import type { AttemptEvent, QuestionAttempt, QuestionAttemptSession } from '../../core/domain/attempts/transitions.js';
import type {
  AppendAttemptEventResult,
  AttemptPage,
  AttemptRepositoryChange,
  AttemptScopeTombstone,
  AttemptRepository,
} from '../../core/ports/AttemptRepository.js';
import { attemptMapper } from './mappers/attempt.js';
import { attemptSessionMapper } from './mappers/attempt-session.js';
import type { AttemptEventDto, QuestionAttemptDto } from './dto/attempt.js';
import type { AttemptSessionDto } from './dto/attempt-session.js';

interface StoredAttempt {
  key: [string, string];
  scope: string;
  id: string;
  sessionId: string;
  createdAt: number;
  lastSequence: number;
  value: QuestionAttemptDto;
}

interface StoredEvent {
  key: [string, string];
  scope: string;
  id: string;
  attemptId: string;
  sequence: number;
  value: AttemptEventDto;
}

interface StoredTombstone extends AttemptScopeTombstone { scope: string }
interface StoredSession {
  key: [string, string];
  scope: string;
  id: string;
  startedAt: number;
  lastSequence: number;
  value: AttemptSessionDto;
}
type PageCursor = { createdAt: number; id: string };
type EventCursor = { sequence: number; id: string };

const PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;
const clampPageSize = (value = 50): number => Number.isFinite(value)
  ? Math.min(PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.floor(value)))
  : 50;
const scopeKey = (scope: string, id: string): [string, string] => [scope, id];

function cursorValue(cursor: string | undefined): PageCursor | undefined {
  if (!cursor) return undefined;
  try {
    const parsed: unknown = JSON.parse(cursor);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const value = parsed as Record<string, unknown>;
    if (typeof value.createdAt !== 'number' || typeof value.id !== 'string') return undefined;
    return { createdAt: value.createdAt, id: value.id };
  } catch {
    return undefined;
  }
}

function encodeCursor(value: PageCursor): string { return JSON.stringify(value); }

function eventCursorValue(cursor: string | undefined): EventCursor | undefined {
  if (!cursor) return undefined;
  try {
    const parsed: unknown = JSON.parse(cursor);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const value = parsed as Record<string, unknown>;
    if (typeof value.sequence !== 'number' || typeof value.id !== 'string') return undefined;
    return { sequence: value.sequence, id: value.id };
  } catch {
    return undefined;
  }
}

function encodeEventCursor(value: EventCursor): string { return JSON.stringify(value); }

function attemptRow(scope: string, value: QuestionAttempt): StoredAttempt {
  return {
    key: scopeKey(scope, value.id),
    scope,
    id: value.id,
    sessionId: value.sessionId,
    createdAt: value.createdAt,
    lastSequence: value.lastSequence,
    value: attemptMapper.toDto(value),
  };
}

function eventRow(scope: string, value: AttemptEvent): StoredEvent {
  return {
    key: scopeKey(scope, value.id),
    scope,
    id: value.id,
    attemptId: value.attemptId,
    sequence: value.sequence,
    value: attemptMapper.eventToDto(value),
  };
}

function sessionRow(scope: string, value: QuestionAttemptSession): StoredSession {
  return {
    key: scopeKey(scope, value.id),
    scope,
    id: value.id,
    startedAt: value.startedAt,
    lastSequence: value.lastSequence,
    value: attemptSessionMapper.toDto(value),
  };
}

function openDatabase(name: string, onConnectionInvalidated: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    let connection: IDBPDatabase | undefined;
    const opening = openDB(name, 2, {
      upgrade: db => {
        if (!db.objectStoreNames.contains('attempts')) {
          const attempts = db.createObjectStore('attempts', { keyPath: 'key' });
          attempts.createIndex('scope', 'scope');
          attempts.createIndex('scopeSessionCreated', ['scope', 'sessionId', 'createdAt', 'id']);
          attempts.createIndex('scopeCreated', ['scope', 'createdAt', 'id']);
        }
        if (!db.objectStoreNames.contains('events')) {
          const events = db.createObjectStore('events', { keyPath: 'key' });
          events.createIndex('scope', 'scope');
          events.createIndex('scopeAttemptSequence', ['scope', 'attemptId', 'sequence', 'id']);
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'key' });
          sessions.createIndex('scope', 'scope');
        }
        if (!db.objectStoreNames.contains('tombstones')) db.createObjectStore('tombstones', { keyPath: 'scope' });
      },
      blocked: () => {
        blocked = true;
        onConnectionInvalidated();
        reject(new Error('El historial de intentos está bloqueado por otra pestaña'));
      },
      blocking: () => {
        onConnectionInvalidated();
        connection?.close();
      },
      terminated: () => { connection = undefined; onConnectionInvalidated(); },
    });
    opening.then(database => {
      if (blocked) database.close();
      else { connection = database; resolve(unwrap(database)); }
    }, reject);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return wrap(transaction).done;
}

function requestValue<Value>(request: IDBRequest<Value>): Promise<Value> {
  return wrap(request);
}

function mapAttempt(row: StoredAttempt): QuestionAttempt {
  const result = attemptMapper.toDomain(row.value);
  if (!result.ok) throw new Error(`Registro de intento ${row.id} inválido: ${result.reason}`);
  return result.value;
}

function mapEvent(row: StoredEvent): AttemptEvent {
  const result = attemptMapper.eventToDomain(row.value);
  if (!result.ok) throw new Error(`Evento de intento ${row.id} inválido: ${result.reason}`);
  return result.value;
}

function isTerminal(event: AttemptEvent): boolean { return event.type === 'answer' || event.type === 'reveal'; }

export function createLocalAttemptRepository(databaseName = 'tai-attempts'): AttemptRepository {
  let database: Promise<IDBDatabase> | undefined;
  const listeners = new Map<string, Set<(change: AttemptRepositoryChange) => void>>();
  const db = () => (database ||= openDatabase(databaseName, () => { database = undefined; }));
  // Un suscriptor roto no debe dejar sin resolver el guardado ya confirmado ni impedir que avisemos a los demás.
  const notify = (scope: string, change: AttemptRepositoryChange) => listeners.get(scope)?.forEach(listener => {
    try { listener(change); } catch (error) { console.error('Un suscriptor del historial de intentos falló:', error); }
  });

  return {
    subscribe(scope, listener) {
      const scoped = listeners.get(scope) || new Set<(change: AttemptRepositoryChange) => void>();
      scoped.add(listener);
      listeners.set(scope, scoped);
      return () => {
        scoped.delete(listener);
        if (!scoped.size) listeners.delete(scope);
      };
    },

    async createSession(scope, session, source = 'local') {
      const connection = await db();
      const tx = connection.transaction('sessions', 'readwrite');
      const done = transactionDone(tx);
      const store = tx.objectStore('sessions');
      const request = store.get(scopeKey(scope, session.id));
      let created = false;
      request.onsuccess = () => { if (!request.result) { store.add(sessionRow(scope, session)); created = true; } };
      await done;
      if (created) notify(scope, { source, type: 'session-updated', session });
    },

    async getSession(scope, sessionId) {
      const connection = await db();
      const tx = connection.transaction('sessions', 'readonly');
      const done = transactionDone(tx);
      const row = await requestValue(tx.objectStore('sessions').get(scopeKey(scope, sessionId))) as StoredSession | undefined;
      await done;
      if (!row) return undefined;
      const mapped = attemptSessionMapper.toDomain(row.value);
      if (!mapped.ok) throw new Error(`Sesión ${row.id} inválida: ${mapped.reason}`);
      return mapped.value;
    },

    async saveSession(scope, session, source = 'local') {
      const connection = await db();
      const tx = connection.transaction('sessions', 'readwrite');
      const done = transactionDone(tx);
      const store = tx.objectStore('sessions');
      const request = store.get(scopeKey(scope, session.id));
      let saved = false;
      request.onsuccess = () => {
        const current = request.result as StoredSession | undefined;
        if (!current) return;
        const mapped = attemptSessionMapper.toDomain(current.value);
        if (!mapped.ok || mapped.value.status !== 'active' || session.lastSequence < mapped.value.lastSequence) return;
        store.put(sessionRow(scope, session));
        saved = true;
      };
      await done;
      if (saved) notify(scope, { source, type: 'session-updated', session });
    },

    async createAttempt(scope, attempt) {
      const connection = await db();
      const tx = connection.transaction('attempts', 'readwrite');
      const done = transactionDone(tx);
      const store = tx.objectStore('attempts');
      const request = store.get(scopeKey(scope, attempt.id));
      let created = false;
      request.onsuccess = () => { if (!request.result) { store.add(attemptRow(scope, attempt)); created = true; } };
      await done;
      if (created) notify(scope, { source: 'local', type: 'attempt-created', attempt });
    },

    async getAttempt(scope, attemptId) {
      const connection = await db();
      const tx = connection.transaction('attempts', 'readonly');
      const done = transactionDone(tx);
      const row = await requestValue(tx.objectStore('attempts').get(scopeKey(scope, attemptId))) as StoredAttempt | undefined;
      await done;
      return row ? mapAttempt(row) : undefined;
    },

    async saveTransition(scope, attempt, event): Promise<AppendAttemptEventResult> {
      const connection = await db();
      return new Promise((resolve, reject) => {
        const tx = connection.transaction(['attempts', 'events'], 'readwrite');
        const attempts = tx.objectStore('attempts');
        const events = tx.objectStore('events');
        const outcome: { value: AppendAttemptEventResult } = { value: { status: 'stored' } };
        // Solo se publica si la fila del intento cambió: tras un conflicto perdedor el evento se conserva, pero publicar
        // `attempt` haría que el sync subiera a remoto una proyección que el local no tiene.
        let projectionSaved = false;
        tx.oncomplete = () => {
          if (projectionSaved) notify(scope, { source: 'local', type: 'transition', attempt, event });
          resolve(outcome.value);
        };
        tx.onerror = () => reject(tx.error || new Error('No se pudo guardar el evento del intento'));
        tx.onabort = () => reject(tx.error || new Error('Se canceló el guardado del intento'));

        const duplicate = events.get(scopeKey(scope, event.id));
        duplicate.onsuccess = () => {
          if (duplicate.result) {
            outcome.value = { status: 'duplicate' };
            return;
          }
          const currentRequest = attempts.get(scopeKey(scope, attempt.id));
          currentRequest.onsuccess = () => {
            const current = currentRequest.result as StoredAttempt | undefined;
            if (!current) {
              outcome.value = { status: 'conflict', eventIds: [event.id] };
              return;
            }
            const colliding = events.index('scopeAttemptSequence')
              .getAll(IDBKeyRange.bound(
                [scope, attempt.id, event.sequence, ''],
                [scope, attempt.id, event.sequence, '\uffff'],
              ));
            colliding.onsuccess = () => {
              const priorEvents = (colliding.result as StoredEvent[]).map(mapEvent);
              const sameTerminal = priorEvents.filter(isTerminal);
              const collisionIds = [...new Set([...priorEvents.map(item => item.id), event.id])].sort();
              events.add(eventRow(scope, event));

              if (event.sequence === current.lastSequence && priorEvents.length > 0) {
                outcome.value = { status: 'conflict', eventIds: collisionIds };
                const winner = sameTerminal.length && isTerminal(event)
                  ? [...sameTerminal, event].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)[0]
                  : null;
                if (winner?.id === event.id && attempt.lastSequence === event.sequence) {
                  attempts.put(attemptRow(scope, attempt));
                  projectionSaved = true;
                }
                return;
              }

              if (event.sequence !== current.lastSequence + 1 || attempt.lastSequence !== event.sequence) {
                outcome.value = { status: 'conflict', eventIds: collisionIds };
                return;
              }
              attempts.put(attemptRow(scope, attempt));
              projectionSaved = true;
            };
          };
        };
      });
    },

    async getAttemptsBySession(scope, sessionId, cursor, requestedLimit) {
      const connection = await db();
      const tx = connection.transaction('attempts', 'readonly');
      const done = transactionDone(tx);
      const index = tx.objectStore('attempts').index('scopeSessionCreated');
      const page = await readAttemptPage(index, [scope, sessionId], cursorValue(cursor), requestedLimit);
      await done;
      return page;
    },

    async getEvents(scope, attemptId, cursor, requestedLimit) {
      const connection = await db();
      const tx = connection.transaction('events', 'readonly');
      const done = transactionDone(tx);
      const index = tx.objectStore('events').index('scopeAttemptSequence');
      const limit = clampPageSize(requestedLimit);
      const after = eventCursorValue(cursor);
      const lower = after ? [scope, attemptId, after.sequence, after.id] : [scope, attemptId, 0, ''];
      const upper = [scope, attemptId, Number.MAX_VALUE, '\uffff'];
      const range = IDBKeyRange.bound(lower, upper, !!after, false);
      const rows = await readRows<StoredEvent>(index, range, limit + 1);
      await done;
      const hasMore = rows.length > limit;
      const visible = rows.slice(0, limit).map(mapEvent);
      const last = visible.at(-1);
      return {
        events: visible,
        nextCursor: hasMore && last ? encodeEventCursor({ sequence: last.sequence, id: last.id }) : null,
      };
    },

    async getScopePage(scope, cursor, requestedLimit) {
      const connection = await db();
      const tx = connection.transaction('attempts', 'readonly');
      const done = transactionDone(tx);
      const index = tx.objectStore('attempts').index('scopeCreated');
      const page = await readAttemptPage(index, [scope], cursorValue(cursor), requestedLimit);
      await done;
      return page;
    },

    async getScopeTombstone(scope) {
      const connection = await db();
      const tx = connection.transaction('tombstones', 'readonly');
      const done = transactionDone(tx);
      const tombstone = await requestValue(tx.objectStore('tombstones').get(scope)) as StoredTombstone | undefined;
      await done;
      return tombstone ? { deletedAt: tombstone.deletedAt, revision: tombstone.revision } : undefined;
    },

    async importPage(scope, archiveCreatedAt, importedAttempts, importedEvents, source = 'import') {
      if (importedAttempts.length > PAGE_SIZE || importedEvents.length > PAGE_SIZE) {
        throw new Error(`Una página de importación no puede superar ${PAGE_SIZE} registros`);
      }
      const connection = await db();
      const tx = connection.transaction(['attempts', 'events', 'sessions', 'tombstones'], 'readwrite');
      const done = transactionDone(tx);
      const tombstones = tx.objectStore('tombstones');
      const acceptedAttempts: QuestionAttempt[] = [];
      const acceptedEvents: AttemptEvent[] = [];
      const tombstoneRequest = tombstones.get(scope);
      tombstoneRequest.onsuccess = () => {
        const tombstone = tombstoneRequest.result as StoredTombstone | undefined;
        if (tombstone && archiveCreatedAt <= tombstone.deletedAt) return;
        const attemptStore = tx.objectStore('attempts');
        const eventStore = tx.objectStore('events');
        const eligibleAttempts = importedAttempts.slice(0, PAGE_SIZE).filter(item => !tombstone || item.createdAt > tombstone.deletedAt);
        for (const item of eligibleAttempts) {
          const request = attemptStore.get(scopeKey(scope, item.id));
          request.onsuccess = () => {
            const current = request.result as StoredAttempt | undefined;
            if (!current || item.lastSequence > current.lastSequence) {
              attemptStore.put(attemptRow(scope, item));
              acceptedAttempts.push(item);
            }
          };
        }
        for (const item of importedEvents.slice(0, PAGE_SIZE)) {
          const key = scopeKey(scope, item.id);
          const parent = attemptStore.get(scopeKey(scope, item.attemptId));
          parent.onsuccess = () => {
            const attempt = parent.result as StoredAttempt | undefined;
            if (!attempt || (tombstone && attempt.createdAt <= tombstone.deletedAt)) return;
            const request = eventStore.get(key);
            request.onsuccess = () => {
              if (request.result) return;
              const colliding = eventStore.index('scopeAttemptSequence').getAll(IDBKeyRange.bound(
                [scope, item.attemptId, item.sequence, ''],
                [scope, item.attemptId, item.sequence, '\uffff'],
              ));
              colliding.onsuccess = () => {
                const prior = (colliding.result as StoredEvent[]).map(mapEvent);
                eventStore.add(eventRow(scope, item));
                acceptedEvents.push(item);
                if (attempt.value.mode !== 'practice' || !isTerminal(item) || item.sequence !== attempt.lastSequence) return;
                const winner = [...prior.filter(isTerminal), item]
                  .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)[0];
                if (winner?.id !== item.id) return;
                let terminalState: Pick<QuestionAttemptDto, 'state' | 'response' | 'outcome'>;
                if (winner.type === 'reveal') terminalState = { state: 'revealed', response: null, outcome: null };
                else if (winner.type === 'answer' && 'optionIndex' in winner.payload && 'outcome' in winner.payload) {
                  terminalState = { state: 'answered', response: winner.payload.optionIndex, outcome: winner.payload.outcome };
                } else return;
                const projected: QuestionAttemptDto = {
                  ...attempt.value,
                  ...terminalState,
                  terminalEventId: winner.id,
                  appliedEventIds: [...new Set([...attempt.value.appliedEventIds, ...prior.map(event => event.id), item.id])].slice(-256),
                };
                attemptStore.put({ ...attempt, value: projected });
              };
            };
          };
        }
      };
      await done;
      if (acceptedAttempts.length || acceptedEvents.length) {
        notify(scope, {
          source,
          type: 'page-imported',
          attempts: acceptedAttempts,
          events: acceptedEvents,
        });
      }
    },

    async deleteScope(scope, deletedAt, source = 'local') {
      const connection = await db();
      const tx = connection.transaction(['attempts', 'events', 'sessions', 'tombstones'], 'readwrite');
      const done = transactionDone(tx);
      const tombstones = tx.objectStore('tombstones');
      const existing = tombstones.get(scope);
      let effectiveDeletedAt = deletedAt;
      existing.onsuccess = () => {
        const current = existing.result as StoredTombstone | undefined;
        effectiveDeletedAt = Math.max(deletedAt, current?.deletedAt || 0);
        if (!current || deletedAt > current.deletedAt) {
          tombstones.put({ scope, deletedAt: effectiveDeletedAt, revision: (current?.revision || 0) + 1 } satisfies StoredTombstone);
        }
        const removedAttempts = new Set<string>();
        const retainedAttempts = new Set<string>();
        const attempts = tx.objectStore('attempts');
        const attemptCursor = attempts.index('scope').openCursor(IDBKeyRange.only(scope));
        attemptCursor.onsuccess = () => {
          const cursor = attemptCursor.result;
          if (cursor) {
            const row = cursor.value as StoredAttempt;
            if (row.createdAt <= effectiveDeletedAt) {
              removedAttempts.add(row.id);
              cursor.delete();
            } else retainedAttempts.add(row.id);
            cursor.continue();
            return;
          }
          const events = tx.objectStore('events');
          const eventCursor = events.index('scope').openCursor(IDBKeyRange.only(scope));
          eventCursor.onsuccess = () => {
            const currentEvent = eventCursor.result;
            if (currentEvent) {
              const row = currentEvent.value as StoredEvent;
              if (removedAttempts.has(row.attemptId) || (!retainedAttempts.has(row.attemptId) && row.value.at <= effectiveDeletedAt)) currentEvent.delete();
              currentEvent.continue();
              return;
            }
            const sessions = tx.objectStore('sessions');
            const sessionCursor = sessions.index('scope').openCursor(IDBKeyRange.only(scope));
            sessionCursor.onsuccess = () => {
              const currentSession = sessionCursor.result;
              if (!currentSession) return;
              const row = currentSession.value as StoredSession;
              if (row.startedAt <= effectiveDeletedAt) currentSession.delete();
              currentSession.continue();
            };
          };
        };
      };
      await done;
      notify(scope, { source, type: 'scope-deleted', deletedAt: effectiveDeletedAt });
    },
  };
}

export const localAttemptRepository = createLocalAttemptRepository();

function readRows<Row>(index: IDBIndex, range: IDBKeyRange, count: number): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    const request = index.openCursor(range);
    request.onerror = () => reject(request.error || new Error('Falló la lectura paginada'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= count) { resolve(rows); return; }
      rows.push(cursor.value as Row);
      cursor.continue();
    };
  });
}

async function readAttemptPage(
  index: IDBIndex,
  prefix: IDBValidKey[],
  cursor: PageCursor | undefined,
  requestedLimit: number | undefined,
): Promise<AttemptPage> {
  const limit = clampPageSize(requestedLimit);
  const lower = cursor ? [...prefix, cursor.createdAt, cursor.id] : [...prefix, 0, ''];
  const upper = [...prefix, Number.MAX_VALUE, '\uffff'];
  const range = IDBKeyRange.bound(lower, upper, !!cursor, false);
  const rows = await readRows<StoredAttempt>(index, range, limit + 1);
  const visible = rows.slice(0, limit).map(mapAttempt);
  return {
    attempts: visible,
    nextCursor: rows.length > limit && visible.length
      ? encodeCursor({ createdAt: visible.at(-1)!.createdAt, id: visible.at(-1)!.id })
      : null,
  };
}
