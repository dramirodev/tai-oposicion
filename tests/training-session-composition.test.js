import { expect, it } from 'vitest';
import { createTrainingSessionComposition } from '../src/app/composition/trainers/training-session-composition.js';

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
