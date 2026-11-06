import { isEditorialContentBlocked } from '../../../core/domain/question-review-overrides.js';
import { evaluateReadingWords, minimumReadingSeconds, asksForNegativeOption } from '../../../core/domain/reading-strategy.js';
import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { QuestionStats } from '../../../core/domain/entities.js';
import type { ReadingOutcome, ReadingProgress, ReadingPrompt, ReadingServices, ReadingToken, ReadingWordResult } from '../../../shared/ui/study-services.js';
import { toFailureQuestionView, type QuestionSourceFallbacks } from '../../mappers/study-question-view-mapper.js';

export interface ReadingCompositionDependencies {
  accountId(): string | null;
  onAccountChange(listener: () => void): () => void;
  loadQuestionMetadata(): Promise<unknown>;
  readQuestionStats(): Promise<Readonly<Record<string, QuestionStats>>>;
  fastQuestionIds(stats: Readonly<Record<string, QuestionStats>>): readonly string[];
  recentQuestionIds(accountId: string | null): readonly string[];
  rememberQuestion(accountId: string | null, questionId: string): void;
  availableQuestionIds(): readonly string[];
  loadQuestionsById(ids: string[]): Promise<QuestionRecord[]>;
  mixQuestionIds(groups: readonly (readonly [readonly string[], number])[], rest: readonly string[], count: number, recentIds: ReadonlySet<string>, shuffle: (items: readonly string[]) => string[]): string[];
  shuffle<T>(items: readonly T[]): T[];
  tokenize(text: string): ReadingToken[];
  sourceFallbacks: QuestionSourceFallbacks;
  recordAnswer(questionId: string, topicId: string, correct: boolean, timestamp: number, seconds: number): void;
  now(): number;
  currentTime(): number;
}

const createProgress = (items: readonly ReadingPrompt[]): ReadingProgress => ({
  items, index: 0, step: 0, meaningChoice: null, meaningCorrect: null, selectedWords: [], wordResult: null,
  selectedAnswer: null, answerCorrect: null, startedAt: 0, outcomes: [], complete: false,
});

/** Account-scoped application flow for the three-step attentive-reading exercise. */
export function createReadingComposition(dependencies: ReadingCompositionDependencies): ReadingServices {
  let sourceQuestions = new Map<string, QuestionRecord>();
  let owner = dependencies.accountId();
  let batch: ReadingPrompt[] | null = null;
  let progress: ReadingProgress | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  dependencies.onAccountChange(() => {
    owner = dependencies.accountId();
    batch = null;
    progress = null;
    notify();
  });

  const ensureOwner = () => {
    const account = dependencies.accountId();
    if (owner !== account) { batch = null; progress = null; owner = account; }
  };
  const getProgress = () => { ensureOwner(); return progress; };

  return {
    getProgress,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async start() {
      ensureOwner();
      if (progress) return progress;
      const requestOwner = dependencies.accountId();
      if (batch) { progress = createProgress(batch); notify(); return progress; }
      await dependencies.loadQuestionMetadata();
      if (requestOwner !== dependencies.accountId()) return null;
      const stats = await dependencies.readQuestionStats();
      const fastIds = dependencies.fastQuestionIds(stats);
      const recentIds = new Set(dependencies.recentQuestionIds(requestOwner));
      const fastSet = new Set(fastIds);
      const failedIds = Object.keys(stats).filter(id => stats[id].lastResult === 0 && !fastSet.has(id));
      const failedSet = new Set(failedIds);
      const rest = dependencies.availableQuestionIds().filter(id => !fastSet.has(id) && !failedSet.has(id));
      const ids = dependencies.mixQuestionIds([[fastIds, 3], [failedIds, 2]], rest, 40, recentIds, dependencies.shuffle);
      const loaded = await dependencies.loadQuestionsById(ids);
      if (requestOwner !== dependencies.accountId()) return null;
      const available = new Map(loaded.filter(question => !isEditorialContentBlocked(question) && !question.s && !question.cp).map(question => [question.i, question]));
      sourceQuestions = available;
      batch = dependencies.shuffle(ids.map(id => available.get(id)).filter((question): question is QuestionRecord => !!question).slice(0, 8)).map(question => ({
        ...toFailureQuestionView(question, dependencies.sourceFallbacks),
        asksForNegative: asksForNegativeOption(question.q),
        minimumSeconds: minimumReadingSeconds({ context: question.cp, statement: question.q, options: question.a }),
        tokens: dependencies.tokenize(question.q),
      }));
      owner = requestOwner;
      progress = createProgress(batch);
      notify();
      return progress;
    },
    answerMeaning(choice) {
      const current = getProgress(), question = current?.items[current.index];
      if (!current || !question || current.step !== 0) return;
      const correct = (choice === 1) === question.asksForNegative;
      progress = { ...current, meaningChoice: choice, meaningCorrect: correct, selectedWords: [], wordResult: null };
      notify();
    },
    continueMeaning() {
      const current = getProgress();
      if (!current || current.step !== 0 || current.meaningChoice === null) return;
      progress = { ...current, step: 1 };
      notify();
    },
    toggleWord(index) {
      const current = getProgress();
      if (!current || current.step !== 1 || current.wordResult) return;
      const selected = new Set(current.selectedWords);
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
      progress = { ...current, selectedWords: [...selected] };
      notify();
    },
    checkWords(claimedNone = false): ReadingWordResult | null {
      const current = getProgress(), question = current?.items[current.index];
      if (!current || !question || current.step !== 1 || current.wordResult) return current?.wordResult || null;
      const result = evaluateReadingWords(question.tokens, current.selectedWords, claimedNone);
      progress = { ...current, wordResult: result };
      notify();
      return result;
    },
    showOptions() {
      const current = getProgress();
      if (!current || current.step !== 1 || !current.wordResult) return;
      progress = { ...current, step: 2, startedAt: dependencies.currentTime(), selectedAnswer: null, answerCorrect: null };
      notify();
    },
    answerOption(index): boolean | null {
      const current = getProgress(), question = current?.items[current.index];
      if (!current || !question || current.step !== 2 || current.selectedAnswer !== null) return null;
      const source = sourceQuestions.get(question.id);
      if (!source || isEditorialContentBlocked(source)) return null;
      const elapsedMilliseconds = dependencies.currentTime() - current.startedAt;
      if (elapsedMilliseconds < question.minimumSeconds * 1000) return false;
      const correct = index === question.correctIndex;
      dependencies.recordAnswer(question.id, question.topicId, correct, dependencies.now(), Math.max(1, Math.round(elapsedMilliseconds / 1000)));
      dependencies.rememberQuestion(dependencies.accountId(), question.id);
      const marked = current.wordResult?.claimedNone ? [0, current.wordResult.total] : [current.wordResult?.hit || 0, current.wordResult?.total || 0];
      const outcome: ReadingOutcome = { correct, meaningCorrect: !!current.meaningCorrect, marked: marked as [number, number] };
      progress = { ...current, selectedAnswer: index, answerCorrect: correct, outcomes: [...current.outcomes, outcome] };
      notify();
      return correct;
    },
    next() {
      const current = getProgress();
      if (!current || current.selectedAnswer === null) return current;
      if (current.index + 1 >= current.items.length) { progress = { ...current, complete: true }; notify(); return progress; }
      progress = { ...current, index: current.index + 1, step: 0, meaningChoice: null, meaningCorrect: null, selectedWords: [], wordResult: null, selectedAnswer: null, answerCorrect: null, startedAt: 0 };
      notify();
      return progress;
    },
    reset() { progress = null; batch = null; owner = dependencies.accountId(); notify(); },
  };
}
