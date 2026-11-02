import { describe, expect, it } from 'vitest';
import { resolvePlannedActivityAction } from '../src/features/planning/planning-controller.ts';

const session = (step, overrides = {}) => ({
  activities: [step], currentIndex: 0, completedAt: null,
  dateKey: '2026-10-29', currentStartedAt: null, startedAt: 0, ...overrides,
});
const step = (activity, extra = {}) => ({ activity, minutes: 10, reason: 'coverage', ...extra });

describe('resolvePlannedActivityAction', () => {
  it('opens the selected new syllabus topic without requiring studied topics', () => {
    expect(resolvePlannedActivityAction(session(step('newContent', { topicId: 'T1.02' })), [], 0))
      .toEqual({ type: 'navigate', path: '/temario?topic=T1.02&dailyTraining=newContent' });
  });

  it('opens a scheduled section recall at its exact section without requiring cards or a generic test', () => {
    const result = resolvePlannedActivityAction(session(step('activeRecall', { topicId:'T1.01', topicIds:['T1.01'], sectionRecall:{ agendaItemId:'agenda-section-01', followUpId:'follow-up-01', sectionId:'ci-0123456789abcdefabcd', materialPath:'T1.01/Temario.pdf', sourceHash:'a'.repeat(64), outlineFingerprint:'b'.repeat(64) } })), [], 0);
    expect(result.type).toBe('navigate');
    const url = new URL(result.path, 'https://tai.test');
    expect(url.pathname).toBe('/temario');
    expect(url.searchParams.get('dailyTraining')).toBe('sectionRecall');
    expect(url.searchParams.get('topic')).toBe('T1.01');
    expect(url.searchParams.get('sectionId')).toBe('ci-0123456789abcdefabcd');
    expect(url.searchParams.get('agendaItemId')).toBe('agenda-section-01');
  });

  it('refuses recovery activities when there are no studied topics', () => {
    expect(resolvePlannedActivityAction(session(step('mixedTopicTest')), [], 0))
      .toEqual({ type: 'notify', message: 'Marca temas vistos antes de iniciar actividades de recuperación.' });
  });

  it('keeps a topic test within its studied topic', () => {
    const result = resolvePlannedActivityAction(session(step('topicTest', { topicId: 'T1.02', topicIds: ['T1.01', 'T1.02'] })), ['T1.01', 'T1.02', 'T2.01'], 0);
    expect(result).toMatchObject({ type: 'navigate', path: expect.stringContaining('trainingTopics=T1.02') });
    expect(result).toMatchObject({ path: expect.stringContaining('topic=T1.02') });
  });

  it('drops stale topic IDs and never places unstudied material in a route', () => {
    const result = resolvePlannedActivityAction(session(step('mixedTopicTest', { topicIds: ['T1.02', 'T3.01'] })), ['T1.02'], 0);
    expect(result).toEqual({ type: 'navigate', path: '/test?dailyTraining=mixedTopicTest&trainingTopics=T1.02' });
  });

  it('uses the prepared due-review flow when no cards are due', () => {
    expect(resolvePlannedActivityAction(session(step('spacedReviews')), ['T1.02'], 0))
      .toEqual({ type: 'start-review', topicIds: ['T1.02'] });
  });

  it('opens cards directly when there are due cards and ignores completed sessions', () => {
    expect(resolvePlannedActivityAction(session(step('spacedReviews')), ['T1.02'], 2))
      .toMatchObject({ type: 'navigate', path: expect.stringContaining('/cards?') });
    expect(resolvePlannedActivityAction(session(step('activeRecall'), { completedAt: 100 }), ['T1.02'], 0))
      .toEqual({ type: 'none' });
  });
});
