import { describe, expect, it } from 'vitest';
import { completeTrainingSessionActivity, createDailyTrainingSession, pauseTrainingSessionActivity, startTrainingSessionActivity, toTrainingSessionHistoryEntry } from '../../src/core/domain/study-training-session.ts';

const plan = { weekday:2, minutes:30, restDay:false, activities:[
  { activity:'activeRecall', minutes:10, reason:'active-recall' },
  { activity:'topicTest', minutes:20, reason:'coverage' },
] };

describe('sesión diaria guiada', () => {
  it('no crea una sesión para descanso o plan vacío', () => {
    expect(createDailyTrainingSession({ ...plan, restDay:true }, 1_800_000_000_000)).toBeNull();
    expect(createDailyTrainingSession({ ...plan, activities:[] }, 1_800_000_000_000)).toBeNull();
  });

  it('conserva el orden del plan y avanza solo cuando se confirma la actividad actual', () => {
    const now = 1_800_000_000_000;
    const created = createDailyTrainingSession(plan, now);
    const started = startTrainingSessionActivity(created, now + 1);
    expect(startTrainingSessionActivity(started, now + 2)).toBe(started);
    expect(completeTrainingSessionActivity(started, 'topicTest', now + 3)).toBe(started);

    const next = completeTrainingSessionActivity(started, 'activeRecall', now + 4);
    expect(next).toMatchObject({ currentIndex:1, currentStartedAt:null, completedAt:null });
    const finished = completeTrainingSessionActivity(startTrainingSessionActivity(next, now + 5), 'topicTest', now + 6);
    expect(finished).toMatchObject({ currentIndex:2, completedAt:now + 6 });
    expect(completeTrainingSessionActivity(finished, 'topicTest', now + 7)).toBe(finished);
  });

  it('mantiene las marcas de tiempo válidas si el reloj del dispositivo retrocede', () => {
    const now = 1_800_000_000_000;
    const created = createDailyTrainingSession({ ...plan, activities: [plan.activities[0]] }, now);
    const started = startTrainingSessionActivity(created, now - 3_600_000);
    expect(started.currentStartedAt).toBe(now);
    expect(completeTrainingSessionActivity(started, 'activeRecall', now - 7_200_000).completedAt).toBe(now);
  });

  it('pausa y reanuda una actividad conservando tiempo acumulado sin duplicarlo', () => {
    const now = 1_800_000_000_000;
    const created = createDailyTrainingSession({ ...plan, activities: [plan.activities[0]] }, now);
    const started = startTrainingSessionActivity(created, now + 1_000);
    const paused = pauseTrainingSessionActivity(started, now + 16_000);
    expect(paused).toMatchObject({ currentStartedAt: null, elapsedSecondsByActivity: [15] });
    const resumed = startTrainingSessionActivity(paused, now + 60_000);
    const completed = completeTrainingSessionActivity(resumed, 'activeRecall', now + 70_000);
    expect(completed).toMatchObject({ elapsedSecondsByActivity: [25], currentIndex: 1, completedAt: now + 70_000 });
  });

  it('crea un resumen solo cuando la sesión completa está terminada', () => {
    const now = 1_800_000_000_000;
    const created = createDailyTrainingSession({ ...plan, activities:[plan.activities[0]] }, now);
    expect(toTrainingSessionHistoryEntry(created)).toBeNull();
    const finished = completeTrainingSessionActivity(startTrainingSessionActivity(created, now + 1), 'activeRecall', now + 5_001);
    expect(toTrainingSessionHistoryEntry(finished)).toMatchObject({
      id: finished.dateKey, dateKey: finished.dateKey, startedAt: now, completedAt: now + 5_001,
      plannedMinutes:10, activities: plan.activities.slice(0, 1), elapsedSecondsByActivity:[5],
    });
  });
});
