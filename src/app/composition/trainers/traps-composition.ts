import { isEditorialQuarantineActive } from '../../../core/domain/question-review-overrides.js';
import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { QuestionStats } from '../../../core/domain/entities.js';
import { evaluateTrapAnswer, recordTrapDetections } from '../../../core/domain/traps.js';
import type { TrapAnswer, TrapPrompt, TrapRun, TrapWeakness, TrapsServices } from '../../../shared/ui/study-services.js';
import { toFailureQuestionView, type QuestionSourceFallbacks } from '../../mappers/study-question-view-mapper.js';

export interface TrapsCompositionDependencies {
  accountId(): string | null;
  loadQuestionMetadata(): Promise<unknown>;
  readQuestionStats(): Promise<Readonly<Record<string, QuestionStats>>>;
  eligibleQuestionIds(): readonly string[];
  loadQuestionsById(ids: string[]): Promise<QuestionRecord[]>;
  trapIds: readonly number[];
  shuffle<T>(items: readonly T[]): T[];
  sourceFallbacks: QuestionSourceFallbacks;
  topicName(id: string): string;
  readDetectionStats(): Readonly<Record<string, readonly [number, number]>>;
  writeDetectionStats(stats: Record<string, [number, number]>): void;
}

const emptyRun = (): TrapRun => ({ items: [], index: 0, results: [] });

/** Composes account-scoped question selection, trap scoring and progress storage. */
export function createTrapsComposition(dependencies: TrapsCompositionDependencies): TrapsServices {
  let run: TrapRun | null = null;
  let owner: string | null = dependencies.accountId();

  const currentRun = (): TrapRun | null => {
    const account = dependencies.accountId();
    if (owner !== account) { run = null; owner = account; }
    return run;
  };

  return {
    getRun: currentRun,
    async startRun() {
      const existing = currentRun();
      if (existing) return existing;
      const requestOwner = dependencies.accountId();
      await dependencies.loadQuestionMetadata();
      if (requestOwner !== dependencies.accountId()) return emptyRun();

      const stats = await dependencies.readQuestionStats();
      const eligible = dependencies.eligibleQuestionIds();
      const failed = eligible.filter(id => stats[id]?.lastResult === 0);
      const failedSet = new Set(failed);
      const rest = eligible.filter(id => !failedSet.has(id));
      const prioritized = dependencies.shuffle(failed).slice(0, 4);
      const prioritizedSet = new Set(prioritized);
      const selectedIds = [...prioritized, ...dependencies.shuffle(rest).filter(id => !prioritizedSet.has(id)).slice(0, Math.max(0, 40 - prioritized.length))];
      const questions = (await dependencies.loadQuestionsById(selectedIds)).filter(question => !question.s && !isEditorialQuarantineActive(question) && question.x?.length).slice(0, 8);
      if (requestOwner !== dependencies.accountId()) return emptyRun();

      const items: TrapPrompt[] = questions.map(question => {
        const trapIds = [...new Set((question.x || []).map(Number))];
        const trapSet = new Set(trapIds);
        const distractors = dependencies.shuffle(dependencies.trapIds.filter(id => !trapSet.has(id))).slice(0, Math.max(3, 8 - trapIds.length));
        return { ...toFailureQuestionView(question, dependencies.sourceFallbacks), topicName: dependencies.topicName(question.t), trapIds, choices: dependencies.shuffle([...trapIds, ...distractors]) };
      });
      owner = requestOwner;
      run = { items, index: 0, results: [] };
      return run;
    },
    evaluate(selected: readonly number[]): TrapAnswer | null {
      currentRun();
      const prompt = run?.items[run.index];
      if (!run || !prompt || run.results.length > run.index) return null;
      const answer = evaluateTrapAnswer(prompt.trapIds, selected);
      dependencies.writeDetectionStats(recordTrapDetections(dependencies.readDetectionStats(), prompt.trapIds, selected));
      run = { ...run, results: [...run.results, answer] };
      return answer;
    },
    next(): TrapRun | null {
      currentRun();
      if (!run || run.results.length <= run.index) return run;
      if (run.index + 1 >= run.items.length) { run = null; return null; }
      run = { ...run, index: run.index + 1 };
      return run;
    },
    getWeaknesses(): TrapWeakness[] {
      return Object.entries(dependencies.readDetectionStats()).map(([id, [seen, detected]]) => ({ id: Number(id), seen, detected }))
        .filter(item => item.seen >= 3)
        .sort((first, second) => first.detected / first.seen - second.detected / second.seen)
        .slice(0, 6);
    },
    resetRun() { run = null; owner = dependencies.accountId(); },
  };
}
