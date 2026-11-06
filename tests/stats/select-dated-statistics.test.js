import { expect, it } from 'vitest';
import { canUseUndatedStatistics, selectDatedStatistics } from '../../src/core/application/stats/select-dated-statistics.js';
it('applies [from,to), mode and known topic membership without inventing source breakdowns', () => {
  const sessions = [{ id: 'test', kind: 'test', ts: 10, topicIds: ['T1.01'] }, { id: 'sim', kind: 'sim', ts: 20, topicIds: ['T1.01'] }];
  const snapshot = { sessions, simulations: [sessions[1]] };
  const query = { fromInclusive: 10, toExclusive: 20, timeZone: 'Europe/Madrid' };
  expect(selectDatedStatistics(snapshot, query).sessions.map(row => row.id)).toEqual(['test']);
  expect(selectDatedStatistics(snapshot, { ...query, toExclusive: 21, mode: 'simulation' }).sessions.map(row => row.id)).toEqual(['sim']);
  expect(selectDatedStatistics(snapshot, { ...query, topicId: 'T1.02' }).sessions).toEqual([]);
  expect(selectDatedStatistics(snapshot, { ...query, origin: 'O' }).simulations).toEqual([]);
  expect(canUseUndatedStatistics(query)).toBe(false);
  expect(canUseUndatedStatistics({ ...query, fromInclusive: 0 })).toBe(true);
  expect(canUseUndatedStatistics({ ...query, fromInclusive: 0, mode: 'practice' })).toBe(false);
});
