import type { StatsSnapshot } from './statistics-model.js';
import type { MetricsQuery } from './metrics-query.js';

export function canUseUndatedStatistics(query: MetricsQuery | null): boolean {
  return query?.fromInclusive === 0 && !query.topicId && !query.origin && !query.mode && !query.activity;
}

/** A legacy session score remains a whole-session score; missing dimensions are not inferred. */
export function selectDatedStatistics(snapshot: Pick<StatsSnapshot, 'sessions' | 'simulations'>, query: MetricsQuery | null) {
  const matches = (row: { ts: number; kind?: string; topicIds?: readonly string[] }) => !query || (row.ts >= query.fromInclusive && row.ts < query.toExclusive
    && (!query.topicId || row.topicIds?.includes(query.topicId)) && !query.origin && query.activity !== 'attentive-reading'
    && (!query.mode || (query.mode === 'simulation' ? !row.kind || row.kind === 'sim' : row.kind !== 'sim')));
  return { simulations: query?.mode === 'practice' ? [] : snapshot.simulations.filter(matches), sessions: snapshot.sessions.filter(matches) };
}
