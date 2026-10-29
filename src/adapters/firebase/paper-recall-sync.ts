import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Firestore, FirestoreError, Unsubscribe } from 'firebase/firestore';
import type { PaperRecallAssessment } from '../../core/domain/paper-recall-assessment.js';

export interface PaperRecallSyncStore {
  get(): readonly PaperRecallAssessment[];
  mergeRemote(value: unknown): boolean;
}

function hasLocalAssessmentMissingRemotely(local: readonly PaperRecallAssessment[], remote: unknown): boolean {
  if (!local.length) return false;
  if (!Array.isArray(remote)) return true;
  const remoteById = new Map<string, number>();
  for (const value of remote) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const item = value as { id?: unknown; ratedAt?: unknown };
    if (typeof item.id === 'string' && typeof item.ratedAt === 'number' && Number.isFinite(item.ratedAt)) remoteById.set(item.id, item.ratedAt);
  }
  return local.some(item => (remoteById.get(item.id) ?? -1) < item.ratedAt);
}

/** Account-scoped sync for paper self-assessments, separate from objective question results. */
export function createPaperRecallSyncAdapter(input: {
  db: Firestore;
  uid: string;
  store: PaperRecallSyncStore;
  isActive(): boolean;
  onSynced(): void;
  onWriteError(error: unknown): void;
}) {
  const reference = doc(input.db, 'users', input.uid, 'cfg', 'trainingRecall');

  async function push(assessments: readonly PaperRecallAssessment[] = input.store.get()): Promise<void> {
    if (!input.isActive()) return;
    try {
      await setDoc(reference, { schemaVersion:1, updatedAt:Date.now(), assessments });
      if (input.isActive()) input.onSynced();
    } catch (error) {
      if (input.isActive()) input.onWriteError(error);
    }
  }

  function listen(onError: (error: FirestoreError) => void): Unsubscribe {
    return onSnapshot(reference, snapshot => {
      if (!input.isActive()) return;
      const remote = snapshot.exists() ? snapshot.data() : null;
      if (remote?.schemaVersion !== 1 || !Array.isArray(remote.assessments)) {
        if (input.store.get().length) void push();
        return;
      }
      const changed = input.store.mergeRemote(remote.assessments);
      if (changed) input.onSynced();
      if (hasLocalAssessmentMissingRemotely(input.store.get(), remote.assessments)) void push();
    }, error => { if (input.isActive()) onError(error); });
  }

  return { listen, push };
}
