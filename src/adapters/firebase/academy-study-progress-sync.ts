import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Firestore, FirestoreError, Unsubscribe } from 'firebase/firestore';
import {
  isAcademyMaterialOpenEvent,
  isAcademyMaterialSelection,
  isAcademySectionStudyEvent,
  type AcademyMaterialOpenEvent,
  type AcademyMaterialSelection,
  type AcademySectionStudyEvent,
} from '../../core/domain/academy-study-progress.js';

export interface AcademyStudyProgressSyncStore {
  listSelections(): readonly AcademyMaterialSelection[];
  listEvents(): readonly AcademySectionStudyEvent[];
  listMaterialOpenEvents(): readonly AcademyMaterialOpenEvent[];
  mergeRemoteSelection(value: unknown): boolean;
  mergeRemoteEvent(value: unknown): boolean;
  mergeRemoteMaterialOpenEvent(value: unknown): boolean;
}

/** Syncs material choices and immutable section-study events inside the signed-in user's namespace. */
export function createAcademyStudyProgressSyncAdapter(input: {
  db: Firestore;
  uid: string;
  store: AcademyStudyProgressSyncStore;
  isActive(): boolean;
  onSynced(): void;
  onWriteError(error: unknown): void;
}) {
  const materials = collection(input.db, 'users', input.uid, 'academyStudyMaterials');
  const events = collection(input.db, 'users', input.uid, 'academySectionEvents');
  const materialOpens = collection(input.db, 'users', input.uid, 'academyMaterialOpenEvents');

  async function pushMaterialSelection(selection: AcademyMaterialSelection): Promise<void> {
    if (!input.isActive() || !isAcademyMaterialSelection(selection)) return;
    try {
      await setDoc(doc(materials, selection.topicId), selection);
      if (input.isActive()) input.onSynced();
    } catch (error) { if (input.isActive()) input.onWriteError(error); }
  }

  async function pushSectionEvent(event: AcademySectionStudyEvent): Promise<void> {
    if (!input.isActive() || !isAcademySectionStudyEvent(event)) return;
    try {
      await setDoc(doc(events, event.id), event);
      if (input.isActive()) input.onSynced();
    } catch (error) { if (input.isActive()) input.onWriteError(error); }
  }

  async function pushMaterialOpenEvent(event: AcademyMaterialOpenEvent): Promise<void> {
    if (!input.isActive() || !isAcademyMaterialOpenEvent(event)) return;
    try {
      await setDoc(doc(materialOpens, event.id), event);
      if (input.isActive()) input.onSynced();
    } catch (error) { if (input.isActive()) input.onWriteError(error); }
  }

  function listen(onError: (error: FirestoreError) => void): Unsubscribe {
    const unsubMaterials = onSnapshot(materials, snapshot => {
      if (!input.isActive()) return;
      const remote = new Map<string, AcademyMaterialSelection>();
      snapshot.forEach(document => {
        const value = document.data();
        if (isAcademyMaterialSelection(value)) {
          remote.set(value.topicId, value);
          input.store.mergeRemoteSelection(value);
        }
      });
      const local = input.store.listSelections();
      for (const selection of local) {
        const other = remote.get(selection.topicId);
        if (!other || selection.revision > other.revision || (selection.revision === other.revision && selection.updatedAt > other.updatedAt)) {
          void pushMaterialSelection(selection);
        }
      }
    }, error => { if (input.isActive()) onError(error); });

    const unsubEvents = onSnapshot(events, snapshot => {
      if (!input.isActive()) return;
      const remoteIds = new Set<string>();
      snapshot.forEach(document => {
        const value = document.data();
        if (isAcademySectionStudyEvent(value)) {
          remoteIds.add(value.id);
          input.store.mergeRemoteEvent(value);
        }
      });
      for (const event of input.store.listEvents()) {
        if (!remoteIds.has(event.id)) void pushSectionEvent(event);
      }
    }, error => { if (input.isActive()) onError(error); });
    const unsubMaterialOpens = onSnapshot(materialOpens, snapshot => {
      if (!input.isActive()) return;
      const remoteIds = new Set<string>();
      snapshot.forEach(document => {
        const value = document.data();
        if (isAcademyMaterialOpenEvent(value)) {
          remoteIds.add(value.id);
          input.store.mergeRemoteMaterialOpenEvent(value);
        }
      });
      for (const event of input.store.listMaterialOpenEvents()) {
        if (!remoteIds.has(event.id)) void pushMaterialOpenEvent(event);
      }
    }, error => { if (input.isActive()) onError(error); });
    return () => { unsubMaterials(); unsubEvents(); unsubMaterialOpens(); };
  }

  return { listen, pushMaterialSelection, pushSectionEvent, pushMaterialOpenEvent };
}
