import { filterScoringQuestions } from '../../domain/selection.js';
import type { QuestionRecord } from '../../domain/question-record.js';
import type { SavedRunSnapshot } from '../../domain/pending-run.js';
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
  read(account: string | null): SavedRunSnapshot | null;
  clear(account: string | null): void;
  loadQuestions(ids: readonly string[]): Promise<QuestionRecord[]>;
}

const MAX_AGE = 2 * 86400000;

/** Loads and validates a saved session without knowing how storage or the bank work. */
export async function loadPendingRun(full: boolean, repository: PendingRunRepository): Promise<PendingRun | null> {
  const account = repository.currentAccount();
  const saved = repository.read(account);
  if (!saved || repository.hasActiveRun()) return null;
  if (!full && saved.kind !== 'rev') { repository.clear(account); return null; }
  if (!Array.isArray(saved.ids) || !saved.ids.length || Date.now() - (saved.savedAt || 0) > MAX_AGE) {
    repository.clear(account);
    return null;
  }
  const items = await repository.loadQuestions(saved.ids);
  if (account !== repository.currentAccount()) return null;
  if (items.length !== saved.ids.length || filterScoringQuestions(items, !!saved.feedback, question => question.np).length !== items.length) {
    repository.clear(account);
    return null;
  }
  return { saved, items, account };
}
