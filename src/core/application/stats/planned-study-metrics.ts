import type { TrainingSessionHistoryEntry } from '../../domain/study-training-session.js';
import type { MetricsQuery } from './metrics-query.js';

/** Uses the budget saved with each completed checkpoint, never today's preferences retroactively. */
export function summarizePlannedStudyHistory(history: readonly TrainingSessionHistoryEntry[], query: MetricsQuery) {
  if (query.origin || query.mode || query.activity === 'attentive-reading') return { status: 'not-recorded' as const, rows: [], plannedMinutes: null, elapsedSeconds: null };
  const topicId = query.topicId;
  const unique = new Map(history.map(entry => [entry.id, entry]));
  const rows = [...unique.values()].filter(entry => entry.completedAt >= query.fromInclusive && entry.completedAt < query.toExclusive)
    .filter(entry => !topicId || entry.activities.some(activity => activity.topicId === topicId || activity.topicIds?.includes(topicId)))
    .map(entry => {
      // A topic filter can select only steps with a known topic; do not distribute unassigned time.
      const steps = entry.activities.map((activity, index) => ({ activity, seconds: entry.elapsedSecondsByActivity[index] ?? 0 }))
        .filter(({ activity }) => !topicId || activity.topicId === topicId || activity.topicIds?.includes(topicId));
      return { id: entry.id, completedAt: entry.completedAt, plannedMinutes: topicId ? steps.reduce((sum, { activity }) => sum + activity.minutes, 0) : entry.plannedMinutes,
        elapsedSeconds: steps.reduce((sum, step) => sum + step.seconds, 0) };
    }).sort((a, b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id));
  return { status: rows.length ? 'partial' as const : 'not-recorded' as const, rows,
    plannedMinutes: rows.length ? rows.reduce((sum, row) => sum + row.plannedMinutes, 0) : null,
    elapsedSeconds: rows.length ? rows.reduce((sum, row) => sum + row.elapsedSeconds, 0) : null };
}
