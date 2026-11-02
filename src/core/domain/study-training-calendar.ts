import type { TrainingActivity, TrainingPreferences } from './entities.js';
import { localTrainingDateKey } from './study-training-session.js';
import { isStudyTopicId } from './topic-id.js';
import { resolveTrainingDay } from './study-training-events.js';

export type ScheduledStudyActivityKind = Extract<TrainingActivity, 'activeRecall' | 'topicTest'>;
export const MAX_SCHEDULED_STUDY_ACTIVITIES = 90;

/** A user-confirmed, date-specific review of a topic already marked as studied. */
export interface ScheduledStudyActivity {
  id: string;
  dateKey: string;
  activity: ScheduledStudyActivityKind;
  topicId: string;
  minutes: number;
  createdAt: number;
  updatedAt: number;
}

export type ScheduleDecision =
  | { ok: true; activity: ScheduledStudyActivity }
  | { ok: false; reason: 'invalid-date' | 'past-date' | 'too-far' | 'rest-day' | 'unseen-topic' | 'invalid-duration' | 'day-capacity' | 'duplicate' | 'schedule-limit' | 'not-found' };

const DAY_MS = 86_400_000;
const MAX_SCHEDULE_DAYS = 180;
const validActivity = (value: unknown): value is ScheduledStudyActivityKind => value === 'activeRecall' || value === 'topicTest';
const validTopicId = isStudyTopicId;

export function isStudyDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isScheduledStudyActivity(value: unknown): value is ScheduledStudyActivity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<ScheduledStudyActivity>;
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && isStudyDateKey(item.dateKey) && validActivity(item.activity) && validTopicId(item.topicId)
    && Number.isInteger(item.minutes) && item.minutes! >= 5 && item.minutes! <= 120
    && Number.isFinite(item.createdAt) && item.createdAt! >= 0
    && Number.isFinite(item.updatedAt) && item.updatedAt! >= item.createdAt!;
}

function dateOrdinal(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Días de calendario locales hasta `dateKey` (0 si llega o ya pasó); null si la fecha no es válida. */
export function daysUntilStudyDate(dateKey: unknown, now: number): number | null {
  if (!isStudyDateKey(dateKey) || !Number.isFinite(now)) return null;
  return Math.max(0, dateOrdinal(dateKey) - dateOrdinal(localTrainingDateKey(now)));
}

function validateTarget(input: {
  dateKey: string; activity: ScheduledStudyActivityKind; topicId: string; minutes: number;
  now: number; preferences: TrainingPreferences; seenTopicIds: readonly string[];
  existing: readonly ScheduledStudyActivity[]; ignoredId?: string;
}): ScheduleDecision | { ok: true } {
  if (!isStudyDateKey(input.dateKey)) return { ok: false, reason: 'invalid-date' };
  if (!Number.isFinite(input.now)) return { ok: false, reason: 'invalid-date' };
  const todayKey = localTrainingDateKey(input.now);
  const difference = dateOrdinal(input.dateKey) - dateOrdinal(todayKey);
  if (difference <= 0) return { ok: false, reason: 'past-date' };
  if (difference > MAX_SCHEDULE_DAYS) return { ok: false, reason: 'too-far' };
  if (!validActivity(input.activity) || !validTopicId(input.topicId)) return { ok: false, reason: 'unseen-topic' };
  if (!input.seenTopicIds.includes(input.topicId)) return { ok: false, reason: 'unseen-topic' };
  if (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 120) return { ok: false, reason: 'invalid-duration' };
  const available = resolveTrainingDay({ dateKey: input.dateKey, preferences: input.preferences }).minutes;
  if (!available) return { ok: false, reason: 'rest-day' };
  const sameDay = input.existing.filter(item => item.dateKey === input.dateKey && item.id !== input.ignoredId);
  if (sameDay.some(item => item.activity === input.activity && item.topicId === input.topicId)) return { ok: false, reason: 'duplicate' };
  // Solo cuentan las actividades que aún no han pasado: las pasadas no se pueden borrar y bloquearían la agenda para siempre.
  const upcoming = input.existing.filter(item => item.id !== input.ignoredId && dateOrdinal(item.dateKey) >= dateOrdinal(todayKey));
  if (upcoming.length >= MAX_SCHEDULED_STUDY_ACTIVITIES) return { ok:false, reason:'schedule-limit' };
  const allocated = sameDay.reduce((total, item) => total + item.minutes, 0);
  if (allocated + input.minutes > available) return { ok: false, reason: 'day-capacity' };
  return { ok: true };
}

export function proposeStudyActivity(input: {
  dateKey: string; activity: ScheduledStudyActivityKind; topicId: string; minutes: number; now: number;
  preferences: TrainingPreferences; seenTopicIds: readonly string[]; existing: readonly ScheduledStudyActivity[];
}): ScheduleDecision {
  const validated = validateTarget(input);
  if (!validated.ok) return validated;
  const id = `${input.dateKey}:${input.activity}:${input.topicId}`;
  const activity: ScheduledStudyActivity = { id, dateKey: input.dateKey, activity: input.activity, topicId: input.topicId, minutes: input.minutes, createdAt: input.now, updatedAt: input.now };
  return { ok: true, activity };
}

export function proposeStudyActivityReschedule(input: {
  id: string; dateKey: string; now: number; preferences: TrainingPreferences; seenTopicIds: readonly string[];
  existing: readonly ScheduledStudyActivity[];
}): ScheduleDecision {
  const current = input.existing.find(item => item.id === input.id);
  if (!current) return { ok: false, reason: 'not-found' };
  const validated = validateTarget({ ...input, activity: current.activity, topicId: current.topicId, minutes: current.minutes, ignoredId: current.id });
  if (!validated.ok) return validated;
  const activity = { ...current, dateKey: input.dateKey, updatedAt: Math.max(input.now, current.updatedAt + 1) };
  return { ok: true, activity };
}

export function mergeScheduledStudyActivities(current: readonly ScheduledStudyActivity[], incoming: readonly unknown[]): ScheduledStudyActivity[] {
  const merged = new Map(current.map(item => [item.id, item]));
  for (const value of incoming) {
    if (!isScheduledStudyActivity(value)) continue;
    const previous = merged.get(value.id);
    // Con el mismo updatedAt gana la fecha mayor: ambos dispositivos eligen igual y convergen.
    if (!previous || value.updatedAt > previous.updatedAt || (value.updatedAt === previous.updatedAt && value.dateKey > previous.dateKey)) merged.set(value.id, value);
  }
  // Al superar el tope se descartan las actividades más antiguas: las futuras son las que importan.
  return [...merged.values()].sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.createdAt - right.createdAt).slice(-MAX_SCHEDULED_STUDY_ACTIVITIES);
}
