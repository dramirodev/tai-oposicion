import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Firestore, FirestoreError, Unsubscribe } from 'firebase/firestore';
import type { DailyTrainingSession, TrainingSessionHistoryEntry } from '../../core/domain/study-training-session.js';

export interface TrainingSessionSyncStore {
  getSession(): DailyTrainingSession | null;
  getHistory(): readonly TrainingSessionHistoryEntry[];
  mergeRemote(session: unknown, updatedAt: number): boolean;
  mergeRemoteHistory(history: unknown): boolean;
}

function hasLocalHistoryMissingRemotely(
  localHistory: readonly TrainingSessionHistoryEntry[],
  remoteHistory: unknown,
  schemaVersion: unknown,
): boolean {
  if (!localHistory.length) return false;
  if (schemaVersion !== 2 || !Array.isArray(remoteHistory)) return true;
  const remoteById = new Map<string, number>();
  for (const value of remoteHistory) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = value as { id?: unknown; completedAt?: unknown };
    if (typeof entry.id === 'string' && typeof entry.completedAt === 'number' && Number.isFinite(entry.completedAt)) {
      remoteById.set(entry.id, entry.completedAt);
    }
  }
  return localHistory.some(entry => {
    const remoteCompletedAt = remoteById.get(entry.id);
    return remoteCompletedAt === undefined || entry.completedAt > remoteCompletedAt;
  });
}

/** Firestore adapter for account-scoped daily training checkpoints and bounded history. */
export function createTrainingSessionSyncAdapter(input: {
  db: Firestore;
  uid: string;
  store: TrainingSessionSyncStore;
  isActive(): boolean;
  onSynced(): void;
  onWriteError(error: unknown): void;
}) {
  const reference = doc(input.db, 'users', input.uid, 'cfg', 'training');

  async function push(session: DailyTrainingSession): Promise<void> {
    if (!input.isActive()) return;
    const payload = { schemaVersion:2, updatedAt:session.updatedAt ?? Date.now(), session, history:input.store.getHistory() };
    try {
      await setDoc(reference, payload);
      if (input.isActive()) input.onSynced();
    } catch (error) {
      if (input.isActive()) input.onWriteError(error);
    }
  }

  function listen(onError: (error: FirestoreError) => void): Unsubscribe {
    return onSnapshot(reference, snapshot => {
      if (!input.isActive()) return;
      const remote = snapshot.exists() ? snapshot.data() : null;
      const remoteSession = remote && [1, 2].includes(remote.schemaVersion) && remote.session
        && typeof remote.updatedAt === 'number' ? remote.session as DailyTrainingSession : null;
      if (remote?.schemaVersion === 2) input.store.mergeRemoteHistory(remote.history);
      const historyNeedsUpload = hasLocalHistoryMissingRemotely(input.store.getHistory(), remote?.history, remote?.schemaVersion);
      const merged = remoteSession ? input.store.mergeRemote(remoteSession, Number(remote?.updatedAt)) : false;
      const local = input.store.getSession();
      const remoteUpdatedAt = typeof remote?.updatedAt === 'number' ? remote.updatedAt : 0;
      const localUpdatedAt = local ? local.updatedAt ?? local.startedAt : 0;
      if (local && (!merged || !remoteSession) && localUpdatedAt > remoteUpdatedAt) void push(local);
      else if (historyNeedsUpload && remoteSession) void push(local && localUpdatedAt >= remoteUpdatedAt ? local : remoteSession);
    }, error => { if (input.isActive()) onError(error); });
  }

  return { listen, push };
}
