import type { MetricsQuery } from './metrics-query.js';
import type { AcademyCurriculumTopic, AcademyCurriculumSection } from '../../domain/academy-curriculum-types.js';
import { parsePublishedSectionManifest, sourceTopicForSectionLink } from '../../domain/academy-section-evidence.js';
import type { Question } from '../../domain/entities.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import { summarizeAcademySectionPerformance, type AcademySectionPerformanceResult } from './academy-section-performance.js';

export interface AcademySectionPerformanceLoaderDependencies {
  manifest: unknown;
  accountId(): string | null;
  repository: Pick<AttemptRepository, 'getScopePage'> & Partial<Pick<AttemptRepository, 'getSession' | 'getEvents'>>;
  loadQuestions(questionIds: readonly string[]): Promise<readonly Question[]>;
  loadTopic(topicId: string): Promise<AcademyCurriculumTopic | undefined>;
}

/** Lazily joins local objective history to the shared, versioned editorial publication. */
export async function loadAcademySectionPerformance(
  dependencies: AcademySectionPerformanceLoaderDependencies,
  query?: MetricsQuery,
): Promise<AcademySectionPerformanceResult> {
  const manifest = parsePublishedSectionManifest(dependencies.manifest);
  if (!manifest) {
    return summarizeAcademySectionPerformance({ manifest: dependencies.manifest, questions: [], sections: [], availableTestMaterials: new Map(), attempts: [] });
  }
  if (manifest.links.length === 0) return summarizeAcademySectionPerformance({ manifest, questions: [], sections: [], availableTestMaterials: new Map(), attempts: [] });

  const account = dependencies.accountId();
  const scope = account || 'guest';
  const questionIds = [...new Set(manifest.links.map(link => link.questionId))];
  const topicIds = [...new Set(manifest.links.flatMap(link => [sourceTopicForSectionLink(link), link.sectionTopicId].filter((id): id is string => !!id)))];
  const [questions, topics] = await Promise.all([
    dependencies.loadQuestions(questionIds),
    Promise.all(topicIds.map(topicId => dependencies.loadTopic(topicId))),
  ]);
  if (dependencies.accountId() !== account) throw new Error('La cuenta cambió mientras se validaban los vínculos editoriales.');
  if (questions.length !== questionIds.length || topics.some(topic => !topic)) {
    throw new Error('No se pudo cargar el catálogo actual para comprobar los vínculos editoriales. Reinténtalo cuando haya conexión.');
  }

  const topicById = new Map(topics.filter((topic): topic is AcademyCurriculumTopic => !!topic).map(topic => [topic.id, topic]));
  const sections: AcademyCurriculumSection[] = manifest.links.flatMap(link => {
    const topic = topicById.get(link.sectionTopicId);
    return topic ? topic.sections.filter(section => section.id === link.sectionId) : [];
  });
  const availableTestMaterials = new Map<string, { topicId: string; sourceHash: string }>();
  for (const topicId of topicIds) {
    const topic = topicById.get(topicId);
    for (const file of topic?.files ?? []) {
      if (file.kind === 'test' && file.sha256) availableTestMaterials.set(file.path, { topicId, sourceHash: file.sha256 });
    }
  }

  const empty = summarizeAcademySectionPerformance({ manifest, questions, sections, availableTestMaterials, attempts: [], query });
  if (empty.status !== 'ready') return empty;
  const linkedIds = new Set(questionIds);
  const attempts = [];
  const sessions = new Map();
  const events = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await dependencies.repository.getScopePage(scope, cursor, 100);
    attempts.push(...page.attempts);
    for (const attempt of page.attempts) {
      if (!linkedIds.has(attempt.questionId)) continue;
      if (dependencies.repository.getSession && !sessions.has(attempt.sessionId)) {
        const session = await dependencies.repository.getSession(scope, attempt.sessionId);
        if (dependencies.accountId() !== account) throw new Error('La cuenta cambió mientras se cargaba el historial objetivo.');
        if (session) sessions.set(session.id, session);
      }
      if (query && dependencies.repository.getEvents) {
        let eventCursor: string | undefined;
        const seenEvents = new Set<string>();
        do {
          const eventPage = await dependencies.repository.getEvents(scope, attempt.id, eventCursor, 100);
          events.push(...eventPage.events); eventCursor = eventPage.nextCursor ?? undefined;
          if (eventCursor && seenEvents.has(eventCursor)) throw new Error('El historial repitió una página de eventos.');
          if (eventCursor) seenEvents.add(eventCursor);
          if (dependencies.accountId() !== account) throw new Error('La cuenta cambió mientras se cargaba el historial objetivo.');
        } while (eventCursor);
      }
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor && seenCursors.has(cursor)) throw new Error('El historial repitió una página.');
    if (cursor) seenCursors.add(cursor);
    if (dependencies.accountId() !== account) throw new Error('La cuenta cambió mientras se cargaba el historial objetivo.');
  } while (cursor);

  return summarizeAcademySectionPerformance({ manifest, questions, sections, availableTestMaterials, attempts, query, events, ...(dependencies.repository.getSession ? { sessions: [...sessions.values()] } : {}) });
}
