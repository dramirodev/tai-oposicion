import type { AcademyCurriculumTopic, AcademyCurriculumSection } from '../../domain/academy-curriculum-types.js';
import { isAcademyQuestionSectionManifest, type AcademyQuestionSectionManifest } from '../../domain/academy-question-section-map.js';
import type { Question } from '../../domain/entities.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import { summarizeAcademySectionPerformance, type AcademySectionPerformanceResult } from './academy-section-performance.js';

export interface AcademySectionPerformanceLoaderDependencies {
  manifest: unknown;
  accountId(): string | null;
  repository: Pick<AttemptRepository, 'getScopePage'>;
  loadQuestions(questionIds: readonly string[]): Promise<readonly Question[]>;
  loadTopic(topicId: string): Promise<AcademyCurriculumTopic | undefined>;
}

/** Lazily joins local objective history to the shared, versioned editorial publication. */
export async function loadAcademySectionPerformance(
  dependencies: AcademySectionPerformanceLoaderDependencies,
): Promise<AcademySectionPerformanceResult> {
  if (!isAcademyQuestionSectionManifest(dependencies.manifest)) {
    return summarizeAcademySectionPerformance({ manifest: dependencies.manifest, questions: [], sections: [], availableTestMaterials: new Map(), attempts: [] });
  }
  const manifest: AcademyQuestionSectionManifest = dependencies.manifest;
  if (manifest.links.length === 0) return summarizeAcademySectionPerformance({ manifest, questions: [], sections: [], availableTestMaterials: new Map(), attempts: [] });

  const account = dependencies.accountId();
  const scope = account || 'guest';
  const questionIds = [...new Set(manifest.links.map(link => link.questionId))];
  const topicIds = [...new Set(manifest.links.flatMap(link => [link.testMaterialTopicId, link.sectionTopicId]))];
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

  const attempts = [];
  let cursor: string | undefined;
  do {
    const page = await dependencies.repository.getScopePage(scope, cursor, 100);
    attempts.push(...page.attempts);
    cursor = page.nextCursor ?? undefined;
    if (dependencies.accountId() !== account) throw new Error('La cuenta cambió mientras se cargaba el historial objetivo.');
  } while (cursor);

  return summarizeAcademySectionPerformance({ manifest, questions, sections, availableTestMaterials, attempts });
}
