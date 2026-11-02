import { isStudyDateKey } from './study-training-calendar.js';
import { isStudyTopicId } from './topic-id.js';
import type { DailyTrainingPlan, PlannedTrainingActivity, TrainingPlanReason } from './study-training-plan.js';
import type { TrainingSessionStep } from './study-training-session.js';

export const WEEKLY_AGENDA_SCHEMA_VERSION = 1 as const;
export const MAX_WEEKLY_AGENDA_ITEMS = 70;

export type WeeklyAgendaKind = 'newContent' | 'activeRecall' | 'topicTest' | 'mixedTopicTest' | 'failures' | 'spacedReviews';
export type WeeklyAgendaStatus = 'planned' | 'completed' | 'skipped';

/** A dated, user-confirmed activity. New content is not a review and may target an unstudied topic. */
export interface WeeklyAgendaItem {
  id: string;
  weekStart: string;
  dateKey: string;
  kind: WeeklyAgendaKind;
  topicIds: readonly string[];
  minutes: number;
  status: WeeklyAgendaStatus;
  createdAt: number;
  updatedAt: number;
}

export interface WeeklyStudyAgenda {
  schemaVersion: typeof WEEKLY_AGENDA_SCHEMA_VERSION;
  revision: number;
  updatedAt: number;
  items: readonly WeeklyAgendaItem[];
}

const kinds = new Set<WeeklyAgendaKind>(['newContent', 'activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews']);
const statuses = new Set<WeeklyAgendaStatus>(['planned', 'completed', 'skipped']);

export function isMondayStudyDate(dateKey: unknown): dateKey is string {
  if (!isStudyDateKey(dateKey)) return false;
  return new Date(`${dateKey}T12:00:00`).getDay() === 1;
}

export function weekStartForStudyDate(dateKey: string): string | null {
  if (!isStudyDateKey(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function isWeeklyAgendaItem(value: unknown): value is WeeklyAgendaItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<WeeklyAgendaItem>;
  const weekStart = weekStartForStudyDate(item.dateKey ?? '');
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && isMondayStudyDate(item.weekStart) && weekStart === item.weekStart
    && isStudyDateKey(item.dateKey) && kinds.has(item.kind as WeeklyAgendaKind)
    && Array.isArray(item.topicIds) && item.topicIds.length <= 20 && item.topicIds.every(isStudyTopicId)
    && (item.kind === 'newContent' ? item.topicIds.length === 1 : item.topicIds.length >= 1)
    && Number.isInteger(item.minutes) && item.minutes! >= 5 && item.minutes! <= 240
    && statuses.has(item.status as WeeklyAgendaStatus)
    && Number.isFinite(item.createdAt) && item.createdAt! >= 0
    && Number.isFinite(item.updatedAt) && item.updatedAt! >= item.createdAt!;
}

export function emptyWeeklyStudyAgenda(): WeeklyStudyAgenda {
  return { schemaVersion: WEEKLY_AGENDA_SCHEMA_VERSION, revision: 0, updatedAt: 0, items: [] };
}

export function isWeeklyStudyAgenda(value: unknown): value is WeeklyStudyAgenda {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const agenda = value as Partial<WeeklyStudyAgenda>;
  return agenda.schemaVersion === WEEKLY_AGENDA_SCHEMA_VERSION
    && Number.isInteger(agenda.revision) && agenda.revision! >= 0
    && Number.isFinite(agenda.updatedAt) && agenda.updatedAt! >= 0
    && Array.isArray(agenda.items) && agenda.items.length <= MAX_WEEKLY_AGENDA_ITEMS
    && agenda.items.every(isWeeklyAgendaItem)
    && new Set(agenda.items.map(item => item.id)).size === agenda.items.length;
}

/** Preserves completed/skipped history and resolves concurrent item updates deterministically. */
export function mergeWeeklyStudyAgenda(current: WeeklyStudyAgenda, incoming: unknown): WeeklyStudyAgenda {
  if (!isWeeklyStudyAgenda(incoming)) return current;
  const items = new Map(current.items.map(item => [item.id, item]));
  for (const item of incoming.items) {
    const previous = items.get(item.id);
    if (!previous || item.updatedAt > previous.updatedAt
      || (item.updatedAt === previous.updatedAt && item.status > previous.status)) items.set(item.id, item);
  }
  const merged = [...items.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.id.localeCompare(b.id));
  const bounded = merged.slice(-MAX_WEEKLY_AGENDA_ITEMS);
  return {
    schemaVersion: WEEKLY_AGENDA_SCHEMA_VERSION,
    revision: Math.max(current.revision, incoming.revision),
    updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
    items: bounded,
  };
}

export function replaceWeeklyAgendaWeek(current: WeeklyStudyAgenda, weekStart: string, items: readonly WeeklyAgendaItem[], now: number): WeeklyStudyAgenda | null {
  if (!isMondayStudyDate(weekStart) || !Number.isFinite(now) || !items.every(isWeeklyAgendaItem)
    || items.some(item => item.weekStart !== weekStart) || items.length > 35) return null;
  const retained = current.items.filter(item => item.weekStart !== weekStart || item.status !== 'planned');
  const retainedIds = new Set(retained.map(item => item.id));
  if (items.some(item => retainedIds.has(item.id))) return null;
  const next: WeeklyStudyAgenda = {
    schemaVersion: WEEKLY_AGENDA_SCHEMA_VERSION,
    revision: current.revision + 1,
    updatedAt: Math.max(now, current.updatedAt + 1),
    items: [...retained, ...items.map(item => ({ ...item, status: 'planned' as const, createdAt: now, updatedAt: now }))]
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.id.localeCompare(b.id))
      .slice(-MAX_WEEKLY_AGENDA_ITEMS),
  };
  return next;
}

export function updateWeeklyAgendaItemStatus(current: WeeklyStudyAgenda, id: string, status: WeeklyAgendaStatus, now: number): WeeklyStudyAgenda | null {
  if (!Number.isFinite(now) || !statuses.has(status)) return null;
  const item = current.items.find(candidate => candidate.id === id);
  if (!item || (item.status !== 'planned' && item.status !== status)) return null;
  if (item.status === status) return current;
  const updatedAt = Math.max(now, item.updatedAt + 1);
  return {
    ...current,
    revision: current.revision + 1,
    updatedAt: Math.max(updatedAt, current.updatedAt + 1),
    items: current.items.map(candidate => candidate.id === id ? { ...candidate, status, updatedAt } : candidate),
  };
}

/** Resolves today's confirmed items to the existing daily checkpoint format without touching an active checkpoint. */
export function dailyTrainingPlanFromAgenda(input: {
  plan: DailyTrainingPlan;
  agenda: WeeklyStudyAgenda;
  dateKey: string;
  studiedTopicIds: readonly string[];
}): DailyTrainingPlan {
  if (input.plan.restDay) return input.plan;
  const studied = new Set(input.studiedTopicIds);
  const items = input.agenda.items.filter(item => item.dateKey === input.dateKey && item.status === 'planned'
    && (item.kind === 'newContent' || item.topicIds.every(topicId => studied.has(topicId))));
  if (!items.length) return input.plan;
  const activities: PlannedTrainingActivity[] = items.map(item => {
    const reason: TrainingPlanReason = item.kind === 'newContent' ? 'new-content-day'
      : item.kind === 'activeRecall' ? 'active-recall'
        : item.kind === 'failures' ? 'recurring-failures'
          : item.kind === 'spacedReviews' ? 'due-reviews' : 'coverage';
    return { activity:item.kind, minutes:item.minutes, reason,
      ...(item.kind === 'newContent' ? { topicId:item.topicIds[0] } : undefined),
      ...(item.kind !== 'newContent' ? { topicIds:[...item.topicIds], ...(item.topicIds.length === 1 ? { topicId:item.topicIds[0] } : {}) } : undefined) };
  });
  const totalMinutes = activities.reduce((sum, activity) => sum + activity.minutes, 0);
  if (totalMinutes > input.plan.minutes) return input.plan;
  return { ...input.plan, restDay:false, minutes:totalMinutes, activities };
}

export function findMatchingPlannedAgendaItem(agenda: WeeklyStudyAgenda, dateKey: string, step: TrainingSessionStep): WeeklyAgendaItem | undefined {
  const stepTopics = step.topicIds ?? (step.topicId ? [step.topicId] : []);
  return agenda.items.find(item => item.dateKey === dateKey && item.status === 'planned'
    && item.kind === step.activity && item.minutes === step.minutes && item.topicIds.join('|') === stepTopics.join('|'));
}
