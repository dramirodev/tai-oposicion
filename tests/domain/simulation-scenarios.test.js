import { expect, it } from 'vitest';
import historical from '../../public/data/supuestos.json';
import { selectHistoricalScenarioPair } from '../../src/core/domain/simulation-scenarios.js';

const catalog = Object.fromEntries(Object.entries(historical).map(([id, raw]) => [
  id, { text: raw.texto, questions: raw.q },
]));

it.each([
  [0, 'L2019', []],
  [0.4, 'TAIL2022', ['TAIL2022-S1-R-02']],
  [0.9, 'TAI2024B', ['TAI2024B-S2-R-01']],
])('rebuilds both blocks of the same definitive paper including only activated reserves', (random, exam, reserves) => {
  const choices = selectHistoricalScenarioPair(catalog, () => random);
  expect(choices.map(item => item.id)).toEqual([exam + '-S1', exam + '-S2']);
  expect(choices.map(item => item.block)).toEqual(['III', 'IV']);
  expect(choices.map(item => item.questions.length)).toEqual([20, 20]);
  expect(choices.flatMap(item => item.questions.filter(q => q.r).map(q => q.i))).toEqual(reserves);
});

it('never substitutes arbitrarily for missing or quarantined questions', () => {
  const id = 'L2019-S1';
  const onePair = { [id]: { ...catalog[id], questions: catalog[id].questions.map((q, i) => i ? q : { ...q, np: 1 }) }, 'L2019-S2': catalog['L2019-S2'] };
  expect(selectHistoricalScenarioPair(onePair, () => 0)).toEqual([]);
  expect(selectHistoricalScenarioPair({ 'L2019-S2': catalog['L2019-S2'] }, () => 0)).toEqual([]);
});

import { officialExamQuestionIds, matchesOfficialExamKey, scoreOfficialExam } from '../../src/core/domain/simulation-scenarios.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'public/data');
const theoryBank = readdirSync(dir).filter(name => /^T[1-4]\.\d+\.json$/.test(name))
  .flatMap(name => JSON.parse(readFileSync(join(dir, name), 'utf8')));
function loadModelA(id) {
  const cases = catalog[id].questions.map(q => ({ ...q, supTexto: catalog[id].text }));
  const byId = new Map([...theoryBank, ...cases].map(q => [q.i, q]));
  return officialExamQuestionIds(id).map(i => byId.get(i));
}
it.each(['L2025A-S1', 'L2025A-S2'])('pins all 100 scored answers for model A and rejects a changed key or wrong block', id => {
  const items = loadModelA(id);
  expect(items).toHaveLength(100);
  expect(items[79].i).toBe('L2025A-P1-R-01');
  expect(matchesOfficialExamKey(id, items)).toBe(true);
  expect(matchesOfficialExamKey(id, items.slice(1))).toBe(false);
  expect(matchesOfficialExamKey(id, items.map((q, i) => i ? q : { ...q, c: (q.c + 1) % 4 }))).toBe(false);
});
it('transforms both parts independently, enforces the first cutoff and distinguishes the two quotas', () => {
  const items = loadModelA('L2025A-S1');
  const exam = { profile: 'tai-li-2025', scenarioId: 'L2025A-S1', quota: 'general', deadlineAt: 1 };
  const all = items.map(q => q.c);
  expect(scoreOfficialExam(exam, items, all)).toMatchObject({ total: 100, passed: true });
  expect(scoreOfficialExam(exam, items, all.map((answer, i) => i < 23 || i >= 80 ? answer : -1))).toMatchObject({ total: null, practical: null, passed: false });
  for (const answers of [[], items.map(q => (q.c + 1) % 4)]) {
    expect(scoreOfficialExam(exam, items, answers)).toMatchObject({ theory: { direct: 0, mark: 0 }, practical: null, passed: false });
  }
  const six = all.map((answer, i) => i < 24 || (i >= 80 && i < 86) ? answer : -1);
  expect(scoreOfficialExam(exam, items, six)).toMatchObject({ theory: { mark: 25 }, practical: { passed: false } });
  expect(scoreOfficialExam({ ...exam, quota: 'norma13' }, items, six)).toMatchObject({ total: 50, passed: true });
  const boundary = all.map((answer, i) => i < 24 || (i >= 80 && i < 90) ? answer : i === 90 ? (answer + 1) % 4 : -1);
  expect(scoreOfficialExam(exam, items, boundary)).toMatchObject({ theory: { mark: 25 }, practical: { direct: 9.67, mark: 25 }, passed: true, total: 50 });
});
