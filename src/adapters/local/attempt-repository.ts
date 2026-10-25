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

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el historial de intentos'));
    request.onblocked = () => reject(new Error('El historial de intentos está bloqueado por otra pestaña'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Falló la transacción del historial'));
    transaction.onabort = () => reject(transaction.error || new Error('Se canceló la transacción del historial'));
  });
}

function requestValue<Value>(request: IDBRequest<Value>): Promise<Value> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falló la lectura del historial'));
  });
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
  const db = () => (database ||= openDatabase(databaseName));
  const notify = (scope: string, change: AttemptRepositoryChange) => listeners.get(scope)?.forEach(listener => listener(change));

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
        tx.oncomplete = () => {
          if (outcome.value.status !== 'duplicate') notify(scope, { source: 'local', type: 'transition', attempt, event });
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
                }
                return;
              }

              if (event.sequence !== current.lastSequence + 1 || attempt.lastSequence !== event.sequence) {
                outcome.value = { status: 'conflict', eventIds: collisionIds };
                return;
              }
              attempts.put(attemptRow(scope, attempt));
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
      const range = IDBKeyRange.lowerBound(lower, !!after);
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
      const removeScoped = (store: IDBObjectStore) => {
        const cursor = store.index('scope').openKeyCursor(IDBKeyRange.only(scope));
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          store.delete(current.primaryKey);
          current.continue();
        };
      };
      const tombstones = tx.objectStore('tombstones');
      const existing = tombstones.get(scope);
      existing.onsuccess = () => {
        const current = existing.result as StoredTombstone | undefined;
        if (current && deletedAt <= current.deletedAt) return;
        tombstones.put({ scope, deletedAt, revision: (current?.revision || 0) + 1 } satisfies StoredTombstone);
        removeScoped(tx.objectStore('attempts'));
        removeScoped(tx.objectStore('events'));
        removeScoped(tx.objectStore('sessions'));
      };
      await done;
      notify(scope, { source, type: 'scope-deleted', deletedAt });
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
  const range = IDBKeyRange.lowerBound(lower, !!cursor);
  const rows = await readRows<StoredAttempt>(index, range, limit + 1);
  const visible = rows.slice(0, limit).map(mapAttempt);
  return {
    attempts: visible,
    nextCursor: rows.length > limit && visible.length
      ? encodeCursor({ createdAt: visible.at(-1)!.createdAt, id: visible.at(-1)!.id })
      : null,
  };
}
