import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { LightningQuestion, LightningServices } from '../../../shared/ui/study-services.js';
import { toFailureQuestionView, type QuestionSourceFallbacks } from '../../mappers/study-question-view-mapper.js';

export interface LightningCompositionDependencies {
  loadQuestionMetadata(): Promise<unknown>;
  readQuestionStats(): Readonly<Record<string, readonly number[]>>;
  loadDueQuestionIds(): Promise<readonly string[]>;
  knownQuestionIds(): readonly string[];
  shuffle<T>(items: readonly T[]): T[];
  loadQuestionsById(ids: string[]): Promise<QuestionRecord[]>;
  sourceFallbacks: QuestionSourceFallbacks;
  recordAnswer(questionId: string, topicId: string, correct: boolean, seconds: number): void;
  topicName(id: string): string;
}

/** Composes question selection and answer recording for the lightning trainer. */
export function createLightningComposition(dependencies: LightningCompositionDependencies): LightningServices {
  return {
    async loadQuestion(): Promise<LightningQuestion | null> {
      await dependencies.loadQuestionMetadata();
      const stats = dependencies.readQuestionStats();
      const knownIds = new Set(dependencies.knownQuestionIds());
      const lucky = Object.keys(stats).filter(id => (stats[id][9] === 6 || stats[id][9] === 8) && knownIds.has(id));
      const due = await dependencies.loadDueQuestionIds();
      const failed = Object.keys(stats).filter(id => stats[id][5] === 0 && knownIds.has(id));
      const pool = [...dependencies.shuffle(lucky).slice(0, 5), ...due.slice(0, 5), ...dependencies.shuffle(failed).slice(0, 5)];
      const candidates = pool.length ? pool : dependencies.shuffle(dependencies.knownQuestionIds()).slice(0, 10);
      const question = (await dependencies.loadQuestionsById(dependencies.shuffle(candidates).slice(0, 8))).find(item => !item.s && !item.cp);
      if (!question) return null;
      const reason = lucky.includes(question.i) ? '🍀 Marcada como suerte' : due.includes(question.i) ? '⏰ Toca repasarla' : failed.includes(question.i) ? '↩ La fallaste' : '🆕 Nueva';
      return { ...toFailureQuestionView(question, dependencies.sourceFallbacks), reason };
    },
    record(questionId: string, topicId: string, correct: boolean, seconds: number) {
      dependencies.recordAnswer(questionId, topicId, correct, seconds);
    },
    topicName: dependencies.topicName,
  };
}
