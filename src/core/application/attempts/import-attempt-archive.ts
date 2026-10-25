import type { AttemptArchive } from '../../domain/attempts/archive.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';

const PAGE_SIZE = 100;

export async function importAttemptArchive(
  repository: AttemptRepository,
  scope: string,
  archive: AttemptArchive,
): Promise<void> {
  if (!Number.isFinite(archive.createdAt) || archive.createdAt < 0) throw new Error('La fecha de la copia de intentos no es válida');
  const tombstone = await repository.getScopeTombstone(scope);
  if (tombstone && archive.createdAt <= tombstone.deletedAt) return;

  for (const session of archive.sessions) {
    if (tombstone && session.startedAt <= tombstone.deletedAt) continue;
    const local = await repository.getSession(scope, session.id);
    if (!local) await repository.createSession(scope, session, 'import');
    else if (local.status === 'active' && session.lastSequence > local.lastSequence) {
      await repository.saveSession(scope, session, 'import');
    }
  }

  const eventsByAttempt = new Map<string, typeof archive.events[number][]>();
  for (const event of archive.events) {
    const events = eventsByAttempt.get(event.attemptId) || [];
    events.push(event);
    eventsByAttempt.set(event.attemptId, events);
  }
  for (const attempt of archive.attempts) {
    if (tombstone && attempt.createdAt <= tombstone.deletedAt) continue;
    const localEvents = eventsByAttempt.get(attempt.id) || [];
    await repository.importPage(scope, archive.createdAt, [attempt], []);
    for (let start = 0; start < localEvents.length; start += PAGE_SIZE) {
      await repository.importPage(scope, archive.createdAt, [], localEvents.slice(start, start + PAGE_SIZE));
    }
  }
}
