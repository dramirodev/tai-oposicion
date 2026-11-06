import { expect, it } from 'vitest';
import { summarizePlannedStudyHistory } from '../../src/core/application/stats/planned-study-metrics.js';
const query = { fromInclusive: 100, toExclusive: 300, timeZone: 'Europe/Madrid' };
const entry = { id: '2026-11-06', completedAt: 200, plannedMinutes: 45, activities: [{ minutes: 20, topicId: 'T1.01' }, { minutes: 25, topicId: 'T1.02' }], elapsedSecondsByActivity: [60, 90] };
it('uses saved goals, deduplicates sessions and does not distribute unassigned time', () => {
  expect(summarizePlannedStudyHistory([entry, entry], query)).toMatchObject({ status: 'partial', plannedMinutes: 45, elapsedSeconds: 150 });
  expect(summarizePlannedStudyHistory([entry], { ...query, topicId: 'T1.01' })).toMatchObject({ plannedMinutes: 20, elapsedSeconds: 60 });
  expect(summarizePlannedStudyHistory([entry], { ...query, origin: 'O' })).toMatchObject({ status: 'not-recorded', plannedMinutes: null });
  expect(summarizePlannedStudyHistory([entry], { ...query, toExclusive: 200 })).toMatchObject({ status: 'not-recorded' });
});
