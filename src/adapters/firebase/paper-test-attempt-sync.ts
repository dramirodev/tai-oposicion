import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Firestore, FirestoreError, Unsubscribe } from 'firebase/firestore';
import { isPaperTestAttemptSegment, type PaperTestAttemptSegment } from '../../core/domain/paper-test-attempt.js';

export interface PaperTestAttemptSyncStore {
  get(): readonly PaperTestAttemptSegment[];
  mergeRemote(value: unknown): boolean;
}

function hasLocalSegmentMissingRemotely(local: readonly PaperTestAttemptSegment[], remote: unknown): boolean {
  if (!local.length) return false;
  if (!Array.isArray(remote)) return true;
  const remoteById = new Map<string, number>();
  for (const value of remote) if (isPaperTestAttemptSegment(value)) remoteById.set(value.id, value.updatedAt);
  return local.some(item => (remoteById.get(item.id) ?? -1) < item.updatedAt);
}

/** Account-scoped sync for aggregate paper records; never imports them into question scores. */
export function createPaperTestAttemptSyncAdapter(input: {
  db: Firestore; uid: string; store: PaperTestAttemptSyncStore; isActive(): boolean;
  onSynced(): void; onWriteError(error: unknown): void;
}) {
  const reference = doc(input.db, 'users', input.uid, 'cfg', 'paperTestLog');
  async function push(segments: readonly PaperTestAttemptSegment[] = input.store.get()): Promise<void> {
    if (!input.isActive()) return;
    try {
      await setDoc(reference, { schemaVersion:1, updatedAt:Date.now(), segments });
      if (input.isActive()) input.onSynced();
    } catch (error) { if (input.isActive()) input.onWriteError(error); }
  }
  function listen(onError: (error: FirestoreError) => void): Unsubscribe {
    return onSnapshot(reference, snapshot => {
      if (!input.isActive()) return;
      const remote = snapshot.exists() ? snapshot.data() : null;
      if (remote?.schemaVersion !== 1 || !Array.isArray(remote.segments)) {
        if (input.store.get().length) void push();
        return;
      }
      if (input.store.mergeRemote(remote.segments)) input.onSynced();
      if (hasLocalSegmentMissingRemotely(input.store.get(), remote.segments)) void push();
    }, error => { if (input.isActive()) onError(error); });
  }
  return { listen, push };
}
