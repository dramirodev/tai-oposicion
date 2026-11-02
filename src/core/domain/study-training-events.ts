import type { TrainingCalendarEvent, TrainingDayFocus, TrainingPreferences } from './entities.js';

export const MAX_TRAINING_CALENDAR_EVENTS = 200;
const kinds = new Set<TrainingCalendarEvent['kind']>(['unavailable', 'study-window', 'class', 'milestone']);
const focuses = new Set<TrainingDayFocus>(['rest', 'new-content', 'consolidation']);

export function buildTrainingCalendarEvent(input: Omit<TrainingCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>, id: string, now: number): TrainingCalendarEvent | null {
  const event = { ...input, id, createdAt: now, updatedAt: now };
  return isTrainingCalendarEvent(event) ? event : null;
}

export function isTrainingDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

export function isTrainingCalendarEvent(value: unknown): value is TrainingCalendarEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<TrainingCalendarEvent>;
  if (typeof event.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,100}$/.test(event.id)
    || !kinds.has(event.kind as TrainingCalendarEvent['kind'])
    || typeof event.title !== 'string' || !event.title.trim() || event.title.length > 100
    || (event.source !== undefined && (typeof event.source !== 'string' || event.source.length > 200))
    || !isTrainingDateKey(event.startDate) || !isTrainingDateKey(event.endDate) || event.endDate < event.startDate
    || !Number.isFinite(event.createdAt) || event.createdAt! < 0
    || !Number.isFinite(event.updatedAt) || event.updatedAt! < event.createdAt!) return false;
  if (event.kind === 'study-window') {
    if (!Number.isInteger(event.studyMinutes) || event.studyMinutes! < 15 || event.studyMinutes! > 360) return false;
    if (event.focus !== undefined && !focuses.has(event.focus)) return false;
    if ((event.startTime !== undefined || event.endTime !== undefined)
      && (!isTime(event.startTime) || !isTime(event.endTime) || event.endTime <= event.startTime)) return false;
  } else if (event.studyMinutes !== undefined || event.focus !== undefined || event.startTime !== undefined || event.endTime !== undefined) return false;
  return true;
}

export function normalizeTrainingCalendarEvents(value: unknown): TrainingCalendarEvent[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, TrainingCalendarEvent>();
  for (const item of value) {
    if (!isTrainingCalendarEvent(item)) continue;
    const previous = unique.get(item.id);
    if (!previous || item.updatedAt > previous.updatedAt) unique.set(item.id, { ...item, title: item.title.trim(), ...(item.source ? { source: item.source.trim() } : {}) });
  }
  return [...unique.values()].sort((left, right) => left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id))
    .slice(0, MAX_TRAINING_CALENDAR_EVENTS);
}

export type ResolvedTrainingDay = {
  dateKey: string;
  minutes: number;
  focus: TrainingDayFocus;
  events: readonly TrainingCalendarEvent[];
  override?: TrainingCalendarEvent;
};

/** Applies date-specific study availability without mutating the recurring weekly preferences. */
export function resolveTrainingDay(input: {
  dateKey: string;
  preferences: Pick<TrainingPreferences, 'minutesByDay' | 'focusByDay' | 'calendarEvents'>;
}): ResolvedTrainingDay {
  const weekday = isTrainingDateKey(input.dateKey) ? new Date(`${input.dateKey}T12:00:00`).getDay() : 0;
  const defaultFocus: readonly TrainingDayFocus[] = ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'];
  const events = normalizeTrainingCalendarEvents(input.preferences.calendarEvents).filter(event => event.startDate <= input.dateKey && event.endDate >= input.dateKey);
  const unavailable = events.filter(event => event.kind === 'unavailable');
  if (unavailable.length) return { dateKey: input.dateKey, minutes: 0, focus: 'rest', events, override: unavailable[0] };
  const windows = events.filter(event => event.kind === 'study-window')
    .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
  const override = windows[0];
  if (override) return {
    dateKey: input.dateKey,
    minutes: override.studyMinutes!,
    focus: override.focus ?? (input.preferences.focusByDay ?? defaultFocus)[weekday],
    events,
    override,
  };
  return {
    dateKey: input.dateKey,
    minutes: input.preferences.minutesByDay[weekday],
    focus: (input.preferences.focusByDay ?? defaultFocus)[weekday],
    events,
  };
}
