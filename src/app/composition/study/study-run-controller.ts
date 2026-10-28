import type { PendingRun } from '../../../core/application/runs/pending-run.js';
import type { RunCfg } from '../../../core/application/session-model.js';

interface StudyRunControllerDependencies {
  createRun(configuration: RunCfg): boolean;
  getPendingRun(fullAccess: boolean): Promise<PendingRun | null>;
  isFullAccess(): boolean;
  currentAccount(): string | null;
  ask(message: string, confirmLabel: string): Promise<boolean>;
  resume(run: PendingRun): boolean;
  clearPendingRun(): void;
  navigateToQuiz(): void;
  showEmptyRunMessage(): void;
  resumePrompt(run: PendingRun): string;
}

/** Coordinates starting and restoring a study run without owning its storage or renderer. */
export function createStudyRunController(dependencies: StudyRunControllerDependencies) {
  function startRun(configuration: RunCfg): boolean {
    if (!dependencies.createRun(configuration)) {
      dependencies.showEmptyRunMessage();
      return false;
    }
    dependencies.navigateToQuiz();
    return true;
  }

  async function resumeSaved(): Promise<void> {
    const pending = await dependencies.getPendingRun(dependencies.isFullAccess());
    if (!pending) return;
    const accepted = await dependencies.ask(dependencies.resumePrompt(pending), 'Continuar');
    if (pending.account !== dependencies.currentAccount()) return;
    if (!accepted) {
      dependencies.clearPendingRun();
      return;
    }
    if (dependencies.resume(pending)) dependencies.navigateToQuiz();
  }

  return { startRun, resumeSaved };
}
