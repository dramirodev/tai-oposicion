import type { AttemptMode } from '../../domain/attempts/transitions.js';
import { isStudyDateKey } from '../../domain/study-training-calendar.js';

export interface MetricsQuery {
  fromInclusive: number;
  toExclusive: number;
  timeZone: string;
  topicId?: string;
  mode?: AttemptMode;
  origin?: string;
  activity?: 'questions' | 'attentive-reading';
}
export type MetricState = 'available' | 'partial' | 'not-recorded' | 'error';
export interface Metric<T> { state: MetricState; value: T | null; observed: number }

/** One formatter per query, never one per response. */
export function metricsCalendar(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayKey = (at: number): string => {
    const parts = formatter.formatToParts(at);
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
  };
  // Find the first millisecond of a civil date. This also handles 23/25-hour days.
  const startOfDay = (key: string): number => {
    if (!isStudyDateKey(key)) throw new Error('Fecha no válida.');
    const nominal = Date.parse(`${key}T00:00:00Z`);
    let low = nominal - 36 * 3_600_000, high = nominal + 36 * 3_600_000;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (dayKey(middle) < key) low = middle + 1;
      else high = middle;
    }
    if (dayKey(low) !== key) throw new Error('La fecha no existe en esta zona horaria.');
    return low;
  };
  return { dayKey, startOfDay };
}

/** UTC is only used for arithmetic on date labels, never for a local day's duration. */
export function shiftMetricsDate(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function metricsWeekKey(key: string): string {
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  return shiftMetricsDate(key, -(weekday + 6) % 7);
}
export function validateMetricsQuery(query: MetricsQuery): void {
  if (!Number.isFinite(query.fromInclusive) || !Number.isFinite(query.toExclusive)
    || query.fromInclusive < 0 || query.toExclusive <= query.fromInclusive) throw new Error('Intervalo de progreso no válido.');
  metricsCalendar(query.timeZone);
}
export function presetMetricsQuery(days: 7 | 30 | 'all', now: number, timeZone: string): MetricsQuery {
  const calendar = metricsCalendar(timeZone);
  return { fromInclusive: days === 'all' ? 0 : calendar.startOfDay(shiftMetricsDate(calendar.dayKey(now), 1 - days)), toExclusive: now + 1, timeZone };
}
export function accuracyMetric(correct: number, wrong: number): Metric<number> {
  const observed = correct + wrong;
  return { state: observed ? 'available' : 'not-recorded', value: observed ? 100 * correct / observed : null, observed };
}
export function percentagePointChange(current: Metric<number>, previous: Metric<number>): number | null {
  return current.value === null || previous.value === null ? null : current.value - previous.value;
}

/** Comparisons exclude the still-open civil day from both samples. */
export function completedMetricsComparison(query: MetricsQuery, now: number): { current: MetricsQuery; previous: MetricsQuery } | null {
  validateMetricsQuery(query);
  if (query.fromInclusive === 0) return null;
  const calendar = metricsCalendar(query.timeZone);
  const end = Math.min(query.toExclusive, calendar.startOfDay(calendar.dayKey(now)));
  if (end <= query.fromInclusive) return null;
  const fromKey = calendar.dayKey(query.fromInclusive), endKey = calendar.dayKey(end);
  // Query dates are civil midnights. Refuse a hand-built partial boundary instead of approximating.
  if (calendar.startOfDay(fromKey) !== query.fromInclusive || calendar.startOfDay(endKey) !== end) return null;
  const count = Math.round((Date.parse(`${endKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / 86_400_000);
  return { current: { ...query, toExclusive: end }, previous: { ...query, fromInclusive: calendar.startOfDay(shiftMetricsDate(fromKey, -count)), toExclusive: query.fromInclusive } };
}
