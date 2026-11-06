import { expect, it } from 'vitest';
import { toSettingsSnapshot } from '../src/features/settings/settings-mapper.js';

function input(overrides = {}) {
  return {
    sync: { state: 'sin sesión', user: null, configured: false, lastSync: 0, error: '', detail: '', host: '', authDomain: '', accessError: '', requests: [] },
    full: false, level: 'invitado', devMode: null, devRevealed: false,
    uiPreferences: { theme: 'dark', size: 2, lectura: 1 },
    trainingPreferences: { minutesByDay: [0, 10, 20, 30, 40, 50, 60], introductionDay: 3, activities: ['topicTest'] },
    progress: { questions: 9, topics: 2, sessions: 3, openReports: 1 },
    exam: '2027-06-01', version: '1.2.3', build: 'abc123', update: null,
    offline: null, index: { questions: 15666, scenarios: 417 },
    ...overrides,
  };
}

it('maps current settings and normalizes the stored training and UI preferences', () => {
  const snapshot = toSettingsSnapshot(input());

  expect(snapshot.ui).toEqual({ visualTheme: 'soft-brutalism', theme: 'dark', size: 2, lectura: 1 });
  expect(snapshot.training).toEqual({
    minutesByDay: [0, 10, 20, 30, 40, 50, 60],
    focusByDay: ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'],
    introductionDay: 3, focusBlockMinutes: 35, activityVersion: 3, activities: ['topicTest', 'mixedTopicTest', 'newContent'],
  });
  expect(snapshot.progress).toEqual({ questions: 9, topics: 2, sessions: 3, openReports: 1 });
  expect(snapshot.exam).toBe('2027-06-01');
  expect(snapshot.index).toEqual({ questions: 15666, scenarios: 417 });
});

it('provides safe defaults for old or malformed preferences and exam values', () => {
  const snapshot = toSettingsSnapshot(input({ uiPreferences: { theme: 'blue', size: 99, lectura: -1 }, trainingPreferences: null, exam: null }));

  expect(snapshot.ui).toEqual({ visualTheme: 'soft-brutalism', theme: 'auto', size: 0, lectura: 0 });
  expect(snapshot.training).toEqual({
    minutesByDay: [0, 120, 120, 120, 120, 120, 120],
    focusByDay: ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'],
    introductionDay: 4, focusBlockMinutes: 35, activityVersion: 3, activities: ['newContent', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews'],
  });
  expect(snapshot.exam).toBe('');
});
