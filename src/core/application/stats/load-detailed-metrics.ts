import type { AttemptArchive } from '../../domain/attempts/archive.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import { completedMetricsComparison, percentagePointChange, type MetricsQuery } from './metrics-query.js';
import { summarizeDetailedMetrics, type MetricsQuestion } from './detailed-metrics.js';

/** A single paged read per query, shared by the summary, series and topic table. No derived persistence. */
export async function loadDetailedMetrics(input: {
  repository: AttemptRepository;
  accountId(): string | null;
  query: MetricsQuery;
  questions: ReadonlyMap<string, MetricsQuestion>;
  catalogueRevision: string;
  now: number;
}) {
  const account = input.accountId(), scope = account || 'guest';
  const assertAccount = () => { if (input.accountId() !== account) throw new Error('La cuenta cambió al cargar el progreso.'); };
  const attempts: AttemptArchive['attempts'][number][] = [];
  const events: AttemptArchive['events'][number][] = [];
  const sessions = new Map<string, AttemptArchive['sessions'][number]>();
  if (input.repository.getScopeSessionPage) {
    let cursor: string | undefined;
    const visited = new Set<string>();
    do {
      const page = await input.repository.getScopeSessionPage(scope, cursor, 100);
      assertAccount();
      for (const session of page.sessions) sessions.set(session.id, session);
      cursor = page.nextCursor ?? undefined;
      if (cursor && visited.has(cursor)) throw new Error('El historial repitió una página de sesiones.');
      if (cursor) visited.add(cursor);
    } while (cursor);
  }
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  do {
    const page = await input.repository.getScopePage(scope, cursor, 250);
    assertAccount();
    for (const attempt of page.attempts) {
      const question = input.questions.get(attempt.questionId);
      if (!question || (input.query.topicId && question.topicId !== input.query.topicId)
        || (input.query.origin && question.origin !== input.query.origin)
        || (input.query.mode && attempt.mode !== input.query.mode)) continue;
      // Old attempts can contain intervals crossing the start boundary; do not prefilter on creation alone.
      if (attempt.createdAt >= input.query.toExclusive) continue;
      attempts.push(attempt);
      if (!input.repository.getScopeSessionPage && !sessions.has(attempt.sessionId)) {
        const session = await input.repository.getSession(scope, attempt.sessionId);
        assertAccount();
        if (session) sessions.set(session.id, session);
      }
      if (input.query.activity && (sessions.get(attempt.sessionId)?.activity ?? 'questions') !== input.query.activity) { attempts.pop(); continue; }
      if (input.repository.getScopeEventPage) continue;
      let eventCursor: string | undefined;
      const visited = new Set<string>();
      do {
        const page = await input.repository.getEvents(scope, attempt.id, eventCursor, 250);
        assertAccount(); events.push(...page.events);
        eventCursor = page.nextCursor ?? undefined;
        if (eventCursor && visited.has(eventCursor)) throw new Error('El historial repitió una página de eventos.');
        if (eventCursor) visited.add(eventCursor);
      } while (eventCursor);
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor && seenCursors.has(cursor)) throw new Error('El historial repitió una página.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  if (input.repository.getScopeEventPage) {
    const ids = new Set(attempts.map(attempt => attempt.id));
    let eventCursor: string | undefined;
    const visited = new Set<string>();
    do {
      const page = await input.repository.getScopeEventPage(scope, eventCursor, 100);
      assertAccount();
      events.push(...page.events.filter(event => ids.has(event.attemptId)));
      eventCursor = page.nextCursor ?? undefined;
      if (eventCursor && visited.has(eventCursor)) throw new Error('El historial repitió una página de eventos.');
      if (eventCursor) visited.add(eventCursor);
    } while (eventCursor);
  }
  assertAccount();
  const archive = { attempts, events, sessions: [...sessions.values()], createdAt: input.now };
  const summarize = (query: MetricsQuery) => summarizeDetailedMetrics({ archive, query, questions: input.questions, catalogueRevision: input.catalogueRevision });
  const result = summarize(input.query);
  const periods = completedMetricsComparison(input.query, input.now);
  if (!periods) return { ...result, comparison: null };
  const current = summarize(periods.current), previous = summarize(periods.previous);
  return { ...result, comparison: { periods, current: current.accuracy, previous: previous.accuracy,
    percentagePoints: percentagePointChange(current.accuracy, previous.accuracy) } };
}
