import { toast } from '../../../shared/ui/dialog-actions.js';
import { localStudyProgressGateway } from '../../../adapters/local/progress-repository.js';
import { clearPendingRun, readPendingRun, writePendingRun } from '../../../adapters/local/pending-run-storage.js';
import { loadPendingRun } from '../../../core/application/runs/pending-run.js';
import { clearRun, hasActiveRun, saveRun, setPendingRunStorage, studyQuestionCatalog } from './study-engine-composition.js';

setPendingRunStorage({ write: writePendingRun, clear: clearPendingRun });

const repository = {
  currentAccount: localStudyProgressGateway.accountId,
  hasActiveRun,
  read: readPendingRun,
  clear: clearPendingRun,
  notifyChangedQuestions: () => toast('La sesión guardada ha caducado: no se puede verificar que las preguntas y sus claves sean las mismas. Puedes iniciar otra sesión.'),
  loadQuestions: studyQuestionCatalog.getQuestions,
};

/** Composition for the saved-session use case; storage and bank access stay outside the use case. */
export function pendingRun(full: boolean) {
  return loadPendingRun(full, repository);
}

export { clearRun, saveRun };
