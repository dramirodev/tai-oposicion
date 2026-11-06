import { applyEditorialScoring } from '../../domain/question-review-overrides.js';
import { filterScoringQuestions } from '../../domain/selection.js';
import { isSimulationScoringPolicy } from '../../domain/simulation-scoring.js';
import type { QuestionRecord } from '../../domain/question-record.js';
import { canAccessStudyRun, matchesSavedQuestions, type SavedRunSnapshot } from '../../domain/pending-run.js';
export type { SavedRunSnapshot } from '../../domain/pending-run.js';

export interface PendingRun {
  saved: SavedRunSnapshot;
  items: QuestionRecord[];
  account: string | null;
}

/** External capabilities needed to recover a saved study session. */
export interface PendingRunRepository {
  currentAccount(): string | null;
  hasActiveRun(): boolean;
  fullAccess?(): boolean;
  read(account: string | null): SavedRunSnapshot | null;
  notifyChangedQuestions?(): void;
  clear(account: string | null, publicSample?: boolean): void;
  loadQuestions(ids: readonly string[]): Promise<QuestionRecord[]>;
}

const MAX_AGE = 2 * 86400000;

/** Loads and validates a saved session without knowing how storage or the bank work. */
export async function loadPendingRun(full: boolean, repository: PendingRunRepository): Promise<PendingRun | null> {
  const account = repository.currentAccount();
  const saved = repository.read(account);
  if (!saved || repository.hasActiveRun() || !canAccessStudyRun(full, account, saved)) return null;
  if (saved.scoringPolicy !== undefined && !isSimulationScoringPolicy(saved.scoringPolicy)) { repository.clear(account, saved.publicSample); return null; }
  if (!Array.isArray(saved.ids) || !saved.ids.length || Date.now() - (saved.savedAt || 0) > MAX_AGE) {
    repository.clear(account, saved.publicSample);
    return null;
  }
  const items = (await repository.loadQuestions(saved.ids)).map(applyEditorialScoring);
  if (account !== repository.currentAccount() || !canAccessStudyRun(repository.fullAccess?.() ?? full, account, saved)) return null;
  if (!matchesSavedQuestions(saved, items) || filterScoringQuestions(items, !!saved.feedback, question => question.np).length !== items.length) {
    repository.clear(account, saved.publicSample);
    repository.notifyChangedQuestions?.();
    return null;
  }
  return { saved, items, account };
}
