import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Firestore, FirestoreError, Unsubscribe } from 'firebase/firestore';
import { isWeeklyStudyAgenda, type WeeklyStudyAgenda } from '../../core/domain/study-weekly-agenda.js';

export interface WeeklyStudyAgendaSyncStore {
  get(): WeeklyStudyAgenda;
  mergeRemote(value: unknown): boolean;
}

/** Syncs the weekly proposal separately so old trainingCalendar clients cannot overwrite this schema. */
export function createWeeklyStudyAgendaSyncAdapter(input: {
  db: Firestore; uid: string; store: WeeklyStudyAgendaSyncStore; isActive(): boolean;
  onSynced(): void; onWriteError(error: unknown): void;
}) {
  const reference = doc(input.db, 'users', input.uid, 'cfg', 'weeklyStudyAgenda');

  async function push(agenda: WeeklyStudyAgenda = input.store.get()): Promise<void> {
    if (!input.isActive() || !isWeeklyStudyAgenda(agenda)) return;
    try {
      await setDoc(reference, { schemaVersion:1, updatedAt:Date.now(), agenda });
      if (input.isActive()) input.onSynced();
    } catch (error) { if (input.isActive()) input.onWriteError(error); }
  }

  function listen(onError: (error: FirestoreError) => void): Unsubscribe {
    return onSnapshot(reference, snapshot => {
      if (!input.isActive()) return;
      const remote = snapshot.exists() ? snapshot.data() : null;
      if (remote?.schemaVersion !== 1 || !isWeeklyStudyAgenda(remote.agenda)) {
        const local = input.store.get();
        if (local.revision > 0 || local.items.length) void push(local);
        return;
      }
      const changed = input.store.mergeRemote(remote.agenda);
      if (changed) input.onSynced();
      const local = input.store.get();
      if (JSON.stringify(local) !== JSON.stringify(remote.agenda)) void push(local);
    }, error => { if (input.isActive()) onError(error); });
  }

  return { listen, push };
}
