import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { RunCfg } from '../../../core/application/session-model.js';

interface StudySelection {
  items: QuestionRecord[];
  titulo: string;
}

interface StudySessionLaunchDependencies {
  currentAccount(): string | null;
  fullAccess(): boolean;
  quickSelection(fullAccess: boolean): Promise<StudySelection>;
  reviewSelection(topicIds?: readonly string[]): Promise<StudySelection>;
  startRun(configuration: RunCfg): boolean;
  showEmptyQuickSelection(fullAccess: boolean): void;
  showEmptyReviewSelection(): void;
}

/** Coordinates account-safe selection and launch of quick and due-review sessions. */
export function createStudySessionLaunchController(dependencies: StudySessionLaunchDependencies) {
  async function startQuickSession(): Promise<void> {
    const account = dependencies.currentAccount();
    const fullAccess = dependencies.fullAccess();
    const selection = await dependencies.quickSelection(fullAccess);
    if (account !== dependencies.currentAccount()) return;
    if (!selection.items.length) {
      dependencies.showEmptyQuickSelection(fullAccess);
      return;
    }
    dependencies.startRun({ kind: 'rev', feedback: true, items: selection.items, titulo: selection.titulo });
  }

  async function startDueReview(topicIds?: readonly string[]): Promise<void> {
    const account = dependencies.currentAccount();
    const selection = await dependencies.reviewSelection(topicIds);
    if (account !== dependencies.currentAccount()) return;
    if (!selection.items.length) {
      dependencies.showEmptyReviewSelection();
      return;
    }
    dependencies.startRun({ kind: 'rev', feedback: true, ...selection });
  }

  return { startQuickSession, startDueReview };
}
