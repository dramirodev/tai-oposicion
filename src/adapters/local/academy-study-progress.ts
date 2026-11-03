import {
  ACADEMY_STUDY_PROGRESS_VERSION,
  isAcademyMaterialSelection,
  isAcademyMaterialOpenEvent,
  isAcademySectionStudyEvent,
  type AcademyMaterialSelection,
  type AcademyMaterialOpenEvent,
  type AcademySectionStudyEvent,
  type AcademyTopicProgressSnapshot,
} from '../../core/domain/academy-study-progress.js';

interface StoredAcademyStudyProgress {
  version: typeof ACADEMY_STUDY_PROGRESS_VERSION;
  selections: Record<string, AcademyMaterialSelection>;
  events: Record<string, AcademySectionStudyEvent>;
}

const storageKey = (accountId: string | null) => `tai.academy-study-progress.v1.${encodeURIComponent(accountId || 'guest')}`;
const empty = (): StoredAcademyStudyProgress => ({ version: ACADEMY_STUDY_PROGRESS_VERSION, selections: {}, events: {} });
const listeners = new Set<() => void>();

function read(accountId: string | null): StoredAcademyStudyProgress {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty();
    const value = parsed as Partial<StoredAcademyStudyProgress>;
    if (value.version !== ACADEMY_STUDY_PROGRESS_VERSION || !value.selections || !value.events) return empty();
    const selections = Object.fromEntries(Object.entries(value.selections).filter(([, item]) => isAcademyMaterialSelection(item)));
    const events = Object.fromEntries(Object.entries(value.events).filter(([, item]) => isAcademySectionStudyEvent(item)));
    return { version: ACADEMY_STUDY_PROGRESS_VERSION, selections, events };
  } catch { return empty(); }
}

function write(accountId: string | null, data: StoredAcademyStudyProgress): boolean {
  try { localStorage.setItem(storageKey(accountId), JSON.stringify(data)); }
  catch { return false; }
  listeners.forEach(listener => listener());
  return true;
}

export function readAcademyTopicProgress(accountId: string | null, topicId: string): AcademyTopicProgressSnapshot {
  const data = read(accountId);
  return {
    selection: data.selections[topicId] ?? null,
    events: Object.values(data.events).filter(event => event.topicId === topicId)
      .sort((first, second) => first.occurredAt - second.occurredAt || first.id.localeCompare(second.id)),
    materialOpenEvents: listAcademyMaterialOpenEvents(accountId, topicId),
  };
}

interface StoredAcademyMaterialOpenEvents { version: 1; events: Record<string, AcademyMaterialOpenEvent> }
const materialOpenStorageKey = (accountId: string | null) => `tai.academy-material-open-events.v1.${encodeURIComponent(accountId || 'guest')}`;
function readMaterialOpenEvents(accountId: string | null): StoredAcademyMaterialOpenEvents {
  try {
    const raw = localStorage.getItem(materialOpenStorageKey(accountId));
    if (!raw) return { version:1, events:{} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { version:1, events:{} };
    const value = parsed as Partial<StoredAcademyMaterialOpenEvents>;
    if (value.version !== 1 || !value.events || typeof value.events !== 'object' || Array.isArray(value.events)) return { version:1, events:{} };
    return { version:1, events:Object.fromEntries(Object.entries(value.events).filter(([, event]) => isAcademyMaterialOpenEvent(event))) };
  } catch { return { version:1, events:{} }; }
}
function writeMaterialOpenEvents(accountId: string | null, data: StoredAcademyMaterialOpenEvents): boolean {
  try { localStorage.setItem(materialOpenStorageKey(accountId), JSON.stringify(data)); }
  catch { return false; }
  listeners.forEach(listener => listener());
  return true;
}
export function listAcademyMaterialOpenEvents(accountId: string | null, topicId?: string): readonly AcademyMaterialOpenEvent[] {
  return Object.values(readMaterialOpenEvents(accountId).events)
    .filter(event => !topicId || event.topicId === topicId)
    .sort((first, second) => first.occurredAt - second.occurredAt || first.id.localeCompare(second.id));
}
export function saveAcademyMaterialOpenEvent(accountId: string | null, event: AcademyMaterialOpenEvent): boolean {
  if (!isAcademyMaterialOpenEvent(event)) return false;
  const data = readMaterialOpenEvents(accountId);
  if (data.events[event.id]) return false;
  data.events[event.id] = event;
  return writeMaterialOpenEvents(accountId, data);
}
export function mergeAcademyMaterialOpenEvent(accountId: string | null, value: unknown): boolean {
  if (!isAcademyMaterialOpenEvent(value)) return false;
  const data = readMaterialOpenEvents(accountId);
  if (data.events[value.id]) return false;
  data.events[value.id] = value;
  return writeMaterialOpenEvents(accountId, data);
}

export function listAcademyMaterialSelections(accountId: string | null): readonly AcademyMaterialSelection[] {
  return Object.values(read(accountId).selections);
}

export function listAcademySectionStudyEvents(accountId: string | null): readonly AcademySectionStudyEvent[] {
  return Object.values(read(accountId).events);
}

export function saveAcademyMaterialSelection(accountId: string | null, selection: AcademyMaterialSelection): boolean {
  if (!isAcademyMaterialSelection(selection)) return false;
  const data = read(accountId);
  const current = data.selections[selection.topicId];
  if (current && current.revision >= selection.revision) return false;
  data.selections[selection.topicId] = selection;
  return write(accountId, data);
}

export function saveAcademySectionStudyEvent(accountId: string | null, event: AcademySectionStudyEvent): boolean {
  if (!isAcademySectionStudyEvent(event)) return false;
  const data = read(accountId);
  if (data.events[event.id]) return false;
  if (event.kind === 'follow-up' && event.status === 'scheduled'
    && Object.values(data.events).some(candidate => candidate.kind === 'follow-up' && candidate.followUpId === event.followUpId)) return false;
  data.events[event.id] = event;
  return write(accountId, data);
}

export function mergeAcademyMaterialSelection(accountId: string | null, value: unknown): boolean {
  if (!isAcademyMaterialSelection(value)) return false;
  const data = read(accountId);
  const current = data.selections[value.topicId];
  if (current && (current.revision > value.revision || (current.revision === value.revision && current.updatedAt >= value.updatedAt))) return false;
  data.selections[value.topicId] = value;
  return write(accountId, data);
}

export function mergeAcademySectionStudyEvent(accountId: string | null, value: unknown): boolean {
  if (!isAcademySectionStudyEvent(value)) return false;
  const data = read(accountId);
  if (data.events[value.id]) return false;
  data.events[value.id] = value;
  return write(accountId, data);
}

export function subscribeAcademyStudyProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
