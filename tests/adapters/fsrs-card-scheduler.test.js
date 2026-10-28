import { describe, expect, it } from 'vitest';
import { forgetting_curve, FSRS6_DEFAULT_DECAY } from 'ts-fsrs';
import { forecastCardRetention, previewCardWithFsrs, scheduleCardWithFsrs } from '../../src/adapters/local/fsrs-card-scheduler.ts';

describe('adaptador local de FSRS para tarjetas', () => {
  it('usa valoraciones explícitas y crea estado versionado sin inventar repasos anteriores', () => {
    const now = 1_800_000_000_000;
    const first = scheduleCardWithFsrs({ attempts: 7, known: 4, lastReviewedAt: now - 1000, intervalStep: 2, dueAt: now }, 2, now);
    expect(first.attempts).toBe(8);
    expect(first.known).toBe(5);
    expect(first.fsrs).toMatchObject({ schemaVersion: 1, algorithmVersion: 6, reps: 1, state: expect.any(Number), lastReviewAt: now });
    expect(first.dueAt).toBeGreaterThan(now);
    expect(first.fsrs.reps).toBe(1);
  });

  it('continúa desde el estado guardado y conserva la misma fecha que muestra la previsualización', () => {
    const now = 1_800_000_000_000;
    const first = scheduleCardWithFsrs(undefined, 0, now);
    const secondTime = first.dueAt;
    const predicted = previewCardWithFsrs(first, 1, secondTime);
    const second = scheduleCardWithFsrs(first, 1, secondTime);
    expect(second.dueAt).toBe(predicted);
    expect(second.attempts).toBe(2);
    expect(second.known).toBe(0);
    expect(second.lastGrade).toBe(1);
    expect(second.fsrs.reps).toBe(2);
  });

  it('mantiene el reloj guardado estrictamente creciente ante dos valoraciones con la misma hora', () => {
    const now = 1_800_000_000_000;
    const first = scheduleCardWithFsrs(undefined, 2, now);
    const again = scheduleCardWithFsrs(first, 0, now);
    expect(again.lastReviewedAt).toBe(now + 1);
    expect(again.dueAt).toBeGreaterThan(now);
  });

  it('no retrocede la fecha FSRS si el reloj del dispositivo va hacia atrás', () => {
    const lastReviewAt = 1_800_000_000_000;
    const first = scheduleCardWithFsrs(undefined, 2, lastReviewAt);
    const clockMovedBack = lastReviewAt - 3 * 86_400_000;
    const preview = previewCardWithFsrs(first, 1, clockMovedBack);
    const next = scheduleCardWithFsrs(first, 1, clockMovedBack);

    expect(next.fsrs.lastReviewAt).toBe(lastReviewAt);
    expect(next.dueAt).toBe(preview);
    expect(next.fsrs.elapsedDays).toBeGreaterThanOrEqual(0);
  });

  it('estima recuerdo solo para tarjetas con datos FSRS y comunica el tamaño de la muestra', () => {
    const now = 1_800_000_000_000;
    const reviews = [
      { attempts:2, known:1, lastReviewedAt:now, intervalStep:0, dueAt:now, fsrs:{ schemaVersion:1, algorithmVersion:6, stability:5, difficulty:5, elapsedDays:0, scheduledDays:5, learningSteps:0, reps:2, lapses:0, state:2, lastReviewAt:now } },
      { attempts:1, known:1, lastReviewedAt:now-86_400_000, intervalStep:0, dueAt:now, fsrs:{ schemaVersion:1, algorithmVersion:6, stability:10, difficulty:4, elapsedDays:1, scheduledDays:10, learningSteps:0, reps:1, lapses:0, state:2, lastReviewAt:now-86_400_000 } },
      { attempts:1, known:0, lastReviewedAt:now, intervalStep:0, dueAt:now },
    ];
    const forecast = forecastCardRetention(reviews, now);
    expect(forecast.reviewedCards).toBe(2);
    expect(forecast.points.map(point => point.days)).toEqual([7, 14, 30]);
    expect(forecast.points[0].recallProbability).toBeCloseTo((forgetting_curve(FSRS6_DEFAULT_DECAY, 7, 5) + forgetting_curve(FSRS6_DEFAULT_DECAY, 8, 10)) / 2);
    expect(forecast.points[0].recallProbability).toBeGreaterThan(forecast.points[1].recallProbability);
    expect(forecast.points[1].recallProbability).toBeGreaterThan(forecast.points[2].recallProbability);
    expect(forecastCardRetention(reviews.slice(2), now)).toBeNull();
  });
});
