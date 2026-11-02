import { expect, it } from 'vitest';
import { isStudyTopicId } from '../src/core/domain/topic-id.js';
import { scopeTrainingRouteToSeenTopics } from '../src/shared/navigation/training-route.js';

it('admite IDs futuros de bloque sin dejar de filtrar por temas vistos', () => {
  expect(isStudyTopicId('T5.02')).toBe(true);
  expect(isStudyTopicId('T12.01')).toBe(true);
  expect(isStudyTopicId('T0.01')).toBe(false);
  expect(isStudyTopicId('T12')).toBe(false);
  expect(scopeTrainingRouteToSeenTopics(
    '/test?dailyTraining=topicTest&trainingTopics=T5.02,T12.01,T13.01',
    ['T5.02', 'T12.01'],
  )).toBe('/test?dailyTraining=topicTest&trainingTopics=T5.02%2CT12.01');
});
