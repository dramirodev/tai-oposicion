import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Firestore, FirestoreError, Unsubscribe } from 'firebase/firestore';
import type { ScheduledStudyActivity } from '../../core/domain/study-training-calendar.js';

export interface TrainingCalendarSyncStore {
  get(): readonly ScheduledStudyActivity[];
  mergeRemote(value: unknown): boolean;
}

function localNeedsUpload(local: readonly ScheduledStudyActivity[], remote: unknown): boolean {
  if (!local.length) return false;
  const remoteById = new Map<string, number>();
  if (Array.isArray(remote)) for (const value of remote) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const activity = value as { id?: unknown; updatedAt?: unknown };
    if (typeof activity.id === 'string' && typeof activity.updatedAt === 'number' && Number.isFinite(activity.updatedAt)) remoteById.set(activity.id, activity.updatedAt);
  }
  return local.some(activity => (remoteById.get(activity.id) ?? -1) < activity.updatedAt);
}

/** Keeps manually scheduled review activities private and synchronized per Firebase account. */
export function createTrainingCalendarSyncAdapter(input: {
  db: Firestore; uid: string; store: TrainingCalendarSyncStore; isActive(): boolean;
  onSynced(): void; onWriteError(error: unknown): void;
}) {
  const reference = doc(input.db, 'users', input.uid, 'cfg', 'trainingCalendar');

  async function push(activities: readonly ScheduledStudyActivity[] = input.store.get()): Promise<void> {
    if (!input.isActive()) return;
    try {
      await setDoc(reference, { schemaVersion:1, updatedAt:Date.now(), activities });
      if (input.isActive()) input.onSynced();
    } catch (error) { if (input.isActive()) input.onWriteError(error); }
  }

  function listen(onError: (error: FirestoreError) => void): Unsubscribe {
    return onSnapshot(reference, snapshot => {
      if (!input.isActive()) return;
      const remote = snapshot.exists() ? snapshot.data() : null;
      if (remote?.schemaVersion !== 1 || !Array.isArray(remote.activities)) {
        if (input.store.get().length) void push();
        return;
      }
      const changed = input.store.mergeRemote(remote.activities);
      if (changed) input.onSynced();
      if (localNeedsUpload(input.store.get(), remote.activities)) void push();
    }, error => { if (input.isActive()) onError(error); });
  }

  return { listen, push };
}
