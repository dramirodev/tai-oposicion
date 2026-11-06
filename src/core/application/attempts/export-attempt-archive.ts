import type { AttemptArchive } from '../../domain/attempts/archive.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';

const ATTEMPT_PAGE_SIZE = 100;
const EVENT_PAGE_SIZE = 100;
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export async function exportAttemptArchive(
  repository: AttemptRepository,
  scope: string,
  createdAt: number,
): Promise<AttemptArchive> {
  const attempts: AttemptArchive['attempts'][number][] = [];
  const sessions = new Map<string, NonNullable<Awaited<ReturnType<AttemptRepository['getSession']>>>>();
  const events: AttemptArchive['events'][number][] = [];
  const batchReads = !!repository.getScopeSessionPage && !!repository.getScopeEventPage;
  let attemptCursor: string | undefined;

  do {
    const page = await repository.getScopePage(scope, attemptCursor, ATTEMPT_PAGE_SIZE);
    for (const attempt of page.attempts) {
      attempts.push(attempt);
      if (batchReads) continue;
      if (!sessions.has(attempt.sessionId)) {
        const session = await repository.getSession(scope, attempt.sessionId);
        if (session) sessions.set(session.id, session);
      }
      let eventCursor: string | undefined;
      do {
        const eventPage = await repository.getEvents(scope, attempt.id, eventCursor, EVENT_PAGE_SIZE);
        events.push(...eventPage.events);
        eventCursor = eventPage.nextCursor || undefined;
      } while (eventCursor);
    }
    attemptCursor = page.nextCursor || undefined;
  } while (attemptCursor);

  if (batchReads) {
    const sessionIds = new Set(attempts.map(attempt => attempt.sessionId));
    const attemptIds = new Set(attempts.map(attempt => attempt.id));
    let sessionCursor: string | undefined;
    const visitedSessions = new Set<string>();
    do {
      const page = await repository.getScopeSessionPage!(scope, sessionCursor, ATTEMPT_PAGE_SIZE);
      for (const session of page.sessions) if (sessionIds.has(session.id)) sessions.set(session.id, session);
      sessionCursor = page.nextCursor ?? undefined;
      if (sessionCursor && visitedSessions.has(sessionCursor)) throw new Error('El historial repitió una página de sesiones.');
      if (sessionCursor) visitedSessions.add(sessionCursor);
    } while (sessionCursor);
    let eventCursor: string | undefined;
    const visitedEvents = new Set<string>();
    do {
      const page = await repository.getScopeEventPage!(scope, eventCursor, EVENT_PAGE_SIZE);
      events.push(...page.events.filter(event => attemptIds.has(event.attemptId)));
      eventCursor = page.nextCursor ?? undefined;
      if (eventCursor && visitedEvents.has(eventCursor)) throw new Error('El historial repitió una página de eventos.');
      if (eventCursor) visitedEvents.add(eventCursor);
    } while (eventCursor);
  }
  return {
    createdAt,
    sessions: [...sessions.values()].sort((left, right) => compareText(left.id, right.id)),
    attempts: attempts.sort((left, right) => compareText(left.id, right.id)),
    events: events.sort((left, right) => compareText(left.attemptId, right.attemptId) || left.sequence - right.sequence || compareText(left.id, right.id)),
  };
}
