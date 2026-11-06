import { isEditorialQuarantineActive } from '../../../core/domain/question-review-overrides.js';
import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { QuestionStats } from '../../../core/domain/entities.js';
import type { ProgressRepository } from '../../../core/ports/ProgressRepository.js';
import type { FailureQuestion, FailureServices } from '../../../shared/ui/study-services.js';
import type { TrainingActivity } from '../../../core/domain/entities.js';
import { toFailureQuestionView, type QuestionSourceFallbacks } from '../../mappers/study-question-view-mapper.js';

interface TopicIndex { temas: readonly { id: string; nombre: string }[] }

export interface FailuresCompositionDependencies {
  accountId(): string | null;
  progressRepository: Pick<ProgressRepository, 'getStats'>;
  loadQuestionMetadata(): Promise<unknown>;
  loadQuestionIndex(): Promise<TopicIndex>;
  loadQuestionsById(ids: string[]): Promise<QuestionRecord[]>;
  failedQuestionIds(): string[];
  seenTopics(): readonly string[];
  setReviewed(id: string, topicId: string, reviewed: boolean): void;
  topicName(id: string): string;
  sourceFallbacks: QuestionSourceFallbacks;
  shuffle<T>(items: readonly T[]): T[];
  createPractice(items: QuestionRecord[], title: string, dailyTrainingActivity?: TrainingActivity): boolean;
  notify(message: string): void;
  navigateToQuiz(dailyTrainingActivity?: TrainingActivity): void;
}

/** Composes failed-question data, progress and navigation for the failures feature. */
export function createFailuresComposition(dependencies: FailuresCompositionDependencies): FailureServices {
  let cachedQuestions: QuestionRecord[] = [];

  return {
    async loadQuestions(): Promise<FailureQuestion[]> {
      const account = dependencies.accountId();
      await dependencies.loadQuestionMetadata();
      const [statistics, questions] = await Promise.all([
        dependencies.progressRepository.getStats(),
        dependencies.loadQuestionsById(dependencies.failedQuestionIds()),
      ]);
      if (account !== dependencies.accountId()) return [];
      cachedQuestions = questions.filter(question => !isEditorialQuarantineActive(question)).sort((first, second) => (statistics[second.i]?.lastSeenAt || 0) - (statistics[first.i]?.lastSeenAt || 0));
      return cachedQuestions.map(question => {
        const progress: QuestionStats | undefined = statistics[question.i];
        return {
          ...toFailureQuestionView(question, dependencies.sourceFallbacks),
          progress: progress ? {
            attempts: progress.attempts,
            correct: progress.correct,
            lastSeenAt: progress.lastSeenAt,
            failureStreak: progress.failureStreak ?? 0,
            syllabusReviewed: progress.syllabusReviewed ?? false,
          } : undefined,
        };
      });
    },
    async loadTopics() {
      const index = await dependencies.loadQuestionIndex();
      return index.temas.map(topic => ({ id: topic.id, name: topic.nombre }));
    },
    seenTopics: dependencies.seenTopics,
    setReviewed: dependencies.setReviewed,
    topicName: dependencies.topicName,
    startPractice(ids, title, options) {
      const questionsById = new Map(cachedQuestions.map(question => [question.i, question]));
      const items = dependencies.shuffle(ids.map(id => questionsById.get(id)).filter((question): question is QuestionRecord => !!question && !isEditorialQuarantineActive(question))).slice(0, 40);
      if (!items.length) return dependencies.notify('No hay preguntas con ese filtro.');
      const created = options?.dailyTrainingActivity
        ? dependencies.createPractice(items, title, options.dailyTrainingActivity)
        : dependencies.createPractice(items, title);
      if (!created) return dependencies.notify('No hay preguntas puntuables en esta selección. Puedes consultarlas en modo estudio.');
      dependencies.navigateToQuiz(options?.dailyTrainingActivity);
    },
  };
}
