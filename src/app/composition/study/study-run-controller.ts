import { canAccessStudyRun } from '../../../core/domain/pending-run.js';
import type { PendingRun } from '../../../core/application/runs/pending-run.js';
import type { RunCfg } from '../../../core/application/session-model.js';
import type { TrainingActivity } from '../../../core/domain/entities.js';
import type { TrainingActivityReference } from '../../../core/domain/study-training-session.js';

interface StudyRunControllerDependencies {
  createRun(configuration: RunCfg, reference?: TrainingActivityReference, activity?: TrainingActivity): boolean;
  getPendingRun(fullAccess: boolean): Promise<PendingRun | null>;
  isFullAccess(): boolean;
  currentAccount(): string | null;
  ask(message: string, confirmLabel: string): Promise<boolean>;
  resume(run: PendingRun): boolean;
  clearPendingRun(publicSample?: true): void;
  navigateToQuiz(dailyTrainingActivity?: TrainingActivity, reference?: TrainingActivityReference): void;
  showEmptyRunMessage(): void;
  resumePrompt(run: PendingRun): string;
}

/** Coordinates starting and restoring a study run without owning its storage or renderer. */
export function createStudyRunController(dependencies: StudyRunControllerDependencies) {
  function startRun(configuration: RunCfg, dailyTrainingActivity?: TrainingActivity, reference?: TrainingActivityReference): boolean {
    if (!dependencies.createRun(configuration, reference, dailyTrainingActivity)) {
      dependencies.showEmptyRunMessage();
      return false;
    }
    dependencies.navigateToQuiz(dailyTrainingActivity, reference);
    return true;
  }

  async function resumeSaved(): Promise<void> {
    const pending = await dependencies.getPendingRun(dependencies.isFullAccess());
    if (!pending) return;
    const accepted = await dependencies.ask(dependencies.resumePrompt(pending), 'Continuar');
    if (pending.account !== dependencies.currentAccount()) return;
    if (!canAccessStudyRun(dependencies.isFullAccess(), pending.account, pending.saved)) return;
    if (!accepted) {
      dependencies.clearPendingRun(pending.saved.publicSample);
      return;
    }
    if (dependencies.resume(pending)) dependencies.navigateToQuiz(pending.saved.trainingActivity, pending.saved.trainingActivityReference);
  }

  return { startRun, resumeSaved };
}
