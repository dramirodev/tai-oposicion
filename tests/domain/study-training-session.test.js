import { describe, expect, it } from 'vitest';
import { attachTrainingAttemptSession, completeTrainingSessionActivity, createDailyTrainingSession, localDayStart, localTrainingDateKey, pauseTrainingSessionActivity, startTrainingSessionActivity, toTrainingSessionHistoryEntry, trainingActivityReference } from '../../src/core/domain/study-training-session.ts';

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

  it('asigna identidad estable al checkpoint y a sus pasos, y enlaza intentos una sola vez', () => {
    const now = new Date(2026, 10, 2, 12).getTime();
    const created = createDailyTrainingSession(plan, now);
    const started = startTrainingSessionActivity(created, now + 1);
    const reference = trainingActivityReference(started);
    expect(reference).toEqual({ sessionId:'training:2026-11-02', activityId:'training:2026-11-02:activity:1' });
    const linked = attachTrainingAttemptSession(started, 'attempt-session-1', now + 2, reference);
    expect(linked.activities[0].attemptSessionIds).toEqual(['attempt-session-1']);
    expect(attachTrainingAttemptSession(linked, 'attempt-session-1', now + 3, reference)).toBe(linked);
    expect(attachTrainingAttemptSession(linked, 'attempt-session-2', now + 3, { ...reference, activityId:'stale' })).toBe(linked);
    expect(completeTrainingSessionActivity(linked, 'activeRecall', now + 4, { ...reference, sessionId:'stale' })).toBe(linked);
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

  describe('límites de día locales', () => {
    it('empieza el día exactamente en la medianoche local, sea cual sea la zona horaria del equipo', () => {
      const start = localDayStart('2026-10-29');
      expect(localTrainingDateKey(start)).toBe('2026-10-29');
      expect(localTrainingDateKey(start - 1)).toBe('2026-10-28');
    });

    it('desplaza por días de calendario, también al cruzar un cambio de hora', () => {
      for (const day of ['2026-03-28', '2026-10-24', '2026-10-31']) {
        const next = localDayStart(day, 1);
        expect(localTrainingDateKey(next), day).toBe(localTrainingDateKey(localDayStart(day) + 36 * 3_600_000));
        expect(localTrainingDateKey(next - 1), day).toBe(day);
      }
    });

    it('devuelve NaN, no un instante inventado, cuando no hay fecha', () => {
      expect(Number.isNaN(localDayStart(''))).toBe(true);
      expect(Number.isNaN(localDayStart('no-es-fecha'))).toBe(true);
    });
  });
});
