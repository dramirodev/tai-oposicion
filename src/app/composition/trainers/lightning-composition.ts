import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { QuestionStats } from '../../../core/domain/entities.js';
import type { LightningQuestion, LightningServices } from '../../../shared/ui/study-services.js';
import { toFailureQuestionView, type QuestionSourceFallbacks } from '../../mappers/study-question-view-mapper.js';

export interface LightningCompositionDependencies {
  loadQuestionMetadata(): Promise<unknown>;
  readQuestionStats(): Promise<Readonly<Record<string, QuestionStats>>>;
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
      const stats = await dependencies.readQuestionStats();
      const knownIds = new Set(dependencies.knownQuestionIds());
      const lucky = Object.keys(stats).filter(id => (stats[id].errorReason === 6 || stats[id].errorReason === 8) && knownIds.has(id));
      const due = await dependencies.loadDueQuestionIds();
      const failed = Object.keys(stats).filter(id => stats[id].lastResult === 0 && knownIds.has(id));
      const pool = [...dependencies.shuffle(lucky).slice(0, 5), ...due.slice(0, 5), ...dependencies.shuffle(failed).slice(0, 5)];
      const candidates = pool.length ? pool : dependencies.shuffle(dependencies.knownQuestionIds()).slice(0, 10);
      const question = (await dependencies.loadQuestionsById(dependencies.shuffle(candidates).slice(0, 8))).find(item => !item.s && !item.cp);
      if (!question) return null;
      const reasonKind = lucky.includes(question.i) ? 'lucky' : due.includes(question.i) ? 'due' : failed.includes(question.i) ? 'failed' : 'new';
      const reason = { lucky: 'Marcada como suerte', due: 'Toca repasarla', failed: 'La fallaste', new: 'Nueva' }[reasonKind];
      return { ...toFailureQuestionView(question, dependencies.sourceFallbacks), reason, reasonKind };
    },
    record(questionId: string, topicId: string, correct: boolean, seconds: number) {
      dependencies.recordAnswer(questionId, topicId, correct, seconds);
    },
    topicName: dependencies.topicName,
  };
}
