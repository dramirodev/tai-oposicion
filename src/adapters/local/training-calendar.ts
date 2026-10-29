import { isScheduledStudyActivity, MAX_SCHEDULED_STUDY_ACTIVITIES, mergeScheduledStudyActivities, type ScheduledStudyActivity } from '../../core/domain/study-training-calendar.js';

const storageKey = (accountId: string | null) => `tai.training-calendar.v1.${encodeURIComponent(accountId || 'guest')}`;

export function readScheduledStudyActivities(accountId: string | null): readonly ScheduledStudyActivity[] {
  try {
    const serialized = localStorage.getItem(storageKey(accountId));
    if (!serialized) return [];
    const value: unknown = JSON.parse(serialized);
    return Array.isArray(value) ? mergeScheduledStudyActivities([], value) : [];
  } catch { return []; }
}

export function saveScheduledStudyActivities(accountId: string | null, incoming: readonly unknown[]): boolean {
  const current = readScheduledStudyActivities(accountId);
  const merged = mergeScheduledStudyActivities(current, incoming);
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(merged));
    return true;
  } catch { return false; }
}

export function mergeRemoteScheduledStudyActivities(accountId: string | null, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const current = readScheduledStudyActivities(accountId);
  const merged = mergeScheduledStudyActivities(current, value);
  if (merged.length === current.length && merged.every((item, index) => item.id === current[index]?.id && item.updatedAt === current[index]?.updatedAt && item.dateKey === current[index]?.dateKey)) return false;
  try { localStorage.setItem(storageKey(accountId), JSON.stringify(merged)); return true; }
  catch { return false; }
}

export function isScheduledStudyActivityList(value: unknown): value is readonly ScheduledStudyActivity[] {
  return Array.isArray(value) && value.length <= MAX_SCHEDULED_STUDY_ACTIVITIES && value.every(isScheduledStudyActivity);
}
