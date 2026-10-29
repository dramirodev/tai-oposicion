import { afterEach, expect, it } from 'vitest';
import { createTrainingSessionComposition } from '../src/app/composition/trainers/training-session-composition.js';

afterEach(() => localStorage.clear());

it('inicia y reanuda el bloque actual y rechaza completar otro bloque', () => {
  let now = new Date(2026, 9, 28, 12).getTime();
  let accountId = 'owner-a';
  const composition = createTrainingSessionComposition({ accountId: () => accountId, now: () => now });
  const plan = { weekday:2, minutes:30, restDay:false, activities:[
    { activity:'activeRecall', minutes:10, reason:'active-recall' },
    { activity:'topicTest', minutes:20, reason:'weak-topics', topicId:'T2.01' },
  ] };

  expect(composition.start(plan).currentIndex).toBe(0);
  expect(composition.startCurrentActivity().currentStartedAt).toBe(now);
  now++;
  expect(composition.completeActivity('topicTest').currentIndex).toBe(0);
  const next = composition.completeActivity('activeRecall');
  expect(next).toMatchObject({ currentIndex:1, currentStartedAt:null });
  accountId = 'owner-b';
  expect(composition.getSession()).toBeNull();
  accountId = 'owner-a';
  expect(composition.getSession().currentIndex).toBe(1);
  expect(composition.getSession().activities[1].topicId).toBe('T2.01');
});

it('inicia una sesión nueva al día siguiente sin perder el historial completado', () => {
  let now = new Date(2026, 9, 28, 12).getTime();
  const composition = createTrainingSessionComposition({ accountId: () => 'owner-a', now: () => now });
  const plan = { weekday:3, minutes:10, restDay:false, activities:[{ activity:'activeRecall', minutes:10, reason:'active-recall' }] };
  const started = composition.start(plan);
  composition.startCurrentActivity();
  now += 65_000;
  const completed = composition.completeActivity('activeRecall');
  expect(completed.completedAt).toBe(now);

  now = new Date(2026, 9, 29, 12).getTime();
  expect(composition.getSession()).toBeNull();
  expect(composition.getHistory()).toHaveLength(1);
  const next = composition.start({ ...plan, weekday:4 });
  expect(next.dateKey).toBe('2026-10-29');
  expect(next.startedAt).toBe(now);
  expect(composition.getHistory()).toMatchObject([{ id:started.dateKey, completedAt:completed.completedAt }]);
});
