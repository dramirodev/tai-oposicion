import {
  isAcademyMaterialSelection,
  isAcademySectionStudyEvent,
  type AcademyMaterialReference,
  type AcademyMaterialSelection,
  type AcademySectionStudyEvent,
  type AcademyStudyProgressOverviewSnapshot,
  type AcademyTopicProgressSnapshot,
} from '../../../core/domain/academy-study-progress.js';
import {
  listAcademyMaterialSelections,
  listAcademySectionStudyEvents,
  mergeAcademyMaterialSelection,
  mergeAcademySectionStudyEvent,
  readAcademyTopicProgress,
  saveAcademyMaterialSelection,
  saveAcademySectionStudyEvent,
  subscribeAcademyStudyProgress,
} from '../../../adapters/local/academy-study-progress.js';

/** Sparse, versioned account-scoped curriculum progress, independent from the legacy seenTopics marker. */
export function createAcademyStudyProgressComposition(dependencies: {
  accountId(): string | null;
  now(): number;
  onAccountChange?(listener: () => void): () => void;
  pushMaterialSelection?(selection: AcademyMaterialSelection): void;
  pushSectionEvent?(event: AcademySectionStudyEvent): void;
}) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const unsubscribeStore = subscribeAcademyStudyProgress(notify);
  const unsubscribeAccount = dependencies.onAccountChange?.(notify);

  return {
    getTopicProgress(topicId: string): AcademyTopicProgressSnapshot {
      const account = dependencies.accountId();
      const snapshot = readAcademyTopicProgress(account, topicId);
      if (account !== dependencies.accountId()) return { selection: null, events: [] };
      return snapshot;
    },
    getProgressOverview(): AcademyStudyProgressOverviewSnapshot {
      const account = dependencies.accountId();
      const snapshot = {
        selections: listAcademyMaterialSelections(account),
        events: listAcademySectionStudyEvents(account),
      };
      if (account !== dependencies.accountId()) return { selections: [], events: [] };
      return snapshot;
    },
    listSelections() { return listAcademyMaterialSelections(dependencies.accountId()); },
    listEvents() { return listAcademySectionStudyEvents(dependencies.accountId()); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    selectMaterials(topicId: string, materials: readonly AcademyMaterialReference[]): AcademyMaterialSelection | null {
      const account = dependencies.accountId();
      const current = readAcademyTopicProgress(account, topicId).selection;
      const selection: AcademyMaterialSelection = {
        topicId,
        materials: [...materials],
        revision: (current?.revision ?? 0) + 1,
        updatedAt: Math.max(dependencies.now(), (current?.updatedAt ?? 0) + 1),
      };
      if (!isAcademyMaterialSelection(selection) || account !== dependencies.accountId()
        || !saveAcademyMaterialSelection(account, selection)) return null;
      dependencies.pushMaterialSelection?.(selection);
      return selection;
    },
    record(event: AcademySectionStudyEvent): AcademySectionStudyEvent | null {
      const account = dependencies.accountId();
      const normalized = { ...event, occurredAt: Math.max(event.occurredAt, dependencies.now()) };
      if (!isAcademySectionStudyEvent(normalized) || account !== dependencies.accountId()
        || !saveAcademySectionStudyEvent(account, normalized)) return null;
      dependencies.pushSectionEvent?.(normalized);
      return normalized;
    },
    mergeRemoteSelection(value: unknown): boolean { return mergeAcademyMaterialSelection(dependencies.accountId(), value); },
    mergeRemoteEvent(value: unknown): boolean { return mergeAcademySectionStudyEvent(dependencies.accountId(), value); },
    dispose() { unsubscribeStore(); unsubscribeAccount?.(); listeners.clear(); },
  };
}
