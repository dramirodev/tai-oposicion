import { onStatus } from '../../../adapters/firebase/sync-status-store.js';
import { isFull } from '../access-composition.js';
import { toast } from '../../../shared/ui/dialog-actions.js';
import { localStudyProgressGateway } from '../../../adapters/local/progress-repository.js';
import { clearPendingRun, readPendingRun, writePendingRun } from '../../../adapters/local/pending-run-storage.js';
import { loadPendingRun } from '../../../core/application/runs/pending-run.js';
import { clearRun, hasActiveRun, saveRun, suspendPrivateRun, setPendingRunStorage, studyQuestionCatalog } from './study-engine-composition.js';

setPendingRunStorage({ write: writePendingRun, clear: clearPendingRun });

const repository = {
  currentAccount: localStudyProgressGateway.accountId,
  hasActiveRun,
  fullAccess: isFull,
  read: readPendingRun,
  clear: clearPendingRun,
  notifyChangedQuestions: () => toast('La sesión guardada ha caducado: no se puede verificar que las preguntas y sus claves sean las mismas. Puedes iniciar otra sesión.'),
  loadQuestions: studyQuestionCatalog.getQuestions,
};

/** Composition for the saved-session use case; storage and bank access stay outside the use case. */
export function pendingRun(full: boolean) {
  return loadPendingRun(full, {
    ...repository,
    read: account => full
      ? readPendingRun(account) ?? readPendingRun(account, true)
      : readPendingRun(account, true),
  });
}

export function watchPrivateRunAccess(offerResume: () => Promise<void>): () => void {
  let suspendedAccount: string | null = null;
  return onStatus(status => {
    const account = localStudyProgressGateway.accountId();
    if (account !== suspendedAccount || !status.user) suspendedAccount = null;
    if (!account || !status.user || !status.accessResolved || status.accessErr) return;
    if (status.access === 'invitado' || status.access === 'pendiente') {
      if (suspendPrivateRun()) {
        suspendedAccount = account;
        toast('El acceso al banco completo ha cambiado. Se ha retirado la sesión privada.');
      }
    } else if (suspendedAccount === account && isFull()) {
      suspendedAccount = null;
      void offerResume().catch(() => {});
    }
  });
}

export { clearRun, saveRun };
