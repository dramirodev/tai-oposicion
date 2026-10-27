import * as store from '../adapters/local/legacy-store.js';
import { clearPendingRun, readPendingRun, writePendingRun } from '../adapters/local/pending-run-storage.js';
import { byIds } from '../adapters/http/legacy-data.js';
import { loadPendingRun } from '../core/application/runs/pending-run.js';
import { clearRun, hasActiveRun, saveRun, setPendingRunStorage } from '../core/application/legacy-engine.js';

setPendingRunStorage({ write: writePendingRun, clear: clearPendingRun });

const repository = {
  currentAccount: store.accountId,
  hasActiveRun,
  read: readPendingRun,
  clear: clearPendingRun,
  loadQuestions: byIds,
};

/** Composition for the saved-session use case; storage and bank access stay outside the use case. */
export function pendingRun(full: boolean) {
  return loadPendingRun(full, repository);
}

export { clearRun, saveRun };
