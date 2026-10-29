import { describe, expect, it } from 'vitest';
import { DEFAULT_TRAINING_PREFERENCES } from '../../src/core/domain/study-training-plan.ts';
import { isScheduledStudyActivity, mergeScheduledStudyActivities, proposeStudyActivity, proposeStudyActivityReschedule } from '../../src/core/domain/study-training-calendar.ts';

const input = (overrides = {}) => ({
  dateKey: '2026-10-30', activity: 'topicTest', topicId: 'T1.01', minutes: 30,
  now: new Date('2026-10-29T12:00:00').getTime(), preferences: DEFAULT_TRAINING_PREFERENCES,
  seenTopicIds: ['T1.01'], existing: [], ...overrides,
});

describe('agenda de estudio futura', () => {
  it('crea una prueba real solo para tema visto, en un día activo y dentro del tiempo disponible', () => {
    const decision = proposeStudyActivity(input());
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.activity).toMatchObject({ dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30 });
  });

  it.each([
    ['fecha imposible', { dateKey:'2026-02-30' }, 'invalid-date'],
    ['fecha pasada o de hoy', { dateKey:'2026-10-29' }, 'past-date'],
    ['más de seis meses', { dateKey:'2027-04-30' }, 'too-far'],
    ['tema no visto', { seenTopicIds:[] }, 'unseen-topic'],
    ['día de descanso', { dateKey:'2026-11-01' }, 'rest-day'],
    ['duración superior a la disponible', { minutes:121 }, 'invalid-duration'],
  ])('rechaza la planificación cuando %s', (_label, overrides, reason) => {
    expect(proposeStudyActivity(input(overrides))).toEqual({ ok:false, reason });
  });

  it('no supera la disponibilidad diaria ni duplica tema y actividad', () => {
    const existing = [{ id:'existing', dateKey:'2026-10-30', activity:'activeRecall', topicId:'T1.02', minutes:100, createdAt:1, updatedAt:1 }];
    expect(proposeStudyActivity(input({ existing, minutes:30 }))).toEqual({ ok:false, reason:'day-capacity' });
    const duplicate = [{ ...existing[0], activity:'topicTest', topicId:'T1.01', minutes:15 }];
    expect(proposeStudyActivity(input({ existing:duplicate, minutes:15 }))).toEqual({ ok:false, reason:'duplicate' });
  });

  it('no acepta una nueva actividad cuando alcanzó el límite sincronizable', () => {
    const existing = Array.from({ length:90 }, (_, index) => ({ id:`scheduled-${index}`, dateKey:'2026-11-03', activity:'activeRecall', topicId:'T1.02', minutes:5, createdAt:index + 1, updatedAt:index + 1 }));
    expect(proposeStudyActivity(input({ existing }))).toEqual({ ok:false, reason:'schedule-limit' });
  });

  it('propone un cambio de fecha sin guardar y protege el límite diario', () => {
    const planned = proposeStudyActivity(input());
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const moved = proposeStudyActivityReschedule({ id:planned.activity.id, dateKey:'2026-10-31', now:input().now + 10, preferences:DEFAULT_TRAINING_PREFERENCES, seenTopicIds:['T1.01'], existing:[planned.activity] });
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.activity).toMatchObject({ id:planned.activity.id, dateKey:'2026-10-31', updatedAt:planned.activity.updatedAt + 10 });
    expect(proposeStudyActivityReschedule({ id:planned.activity.id, dateKey:'2026-11-01', now:input().now + 10, preferences:DEFAULT_TRAINING_PREFERENCES, seenTopicIds:['T1.01'], existing:[planned.activity] })).toEqual({ ok:false, reason:'rest-day' });
  });

  it('valida entradas importadas y conserva la versión más reciente entre dispositivos', () => {
    const first = { id:'schedule-1', dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30, createdAt:1, updatedAt:1 };
    const newer = { ...first, dateKey:'2026-10-31', updatedAt:2 };
    expect(isScheduledStudyActivity(first)).toBe(true);
    expect(isScheduledStudyActivity({ ...first, topicId:'T9.99' })).toBe(false);
    expect(mergeScheduledStudyActivities([first], [newer, { ...first, id:'bad', minutes:500 }])).toEqual([newer]);
  });
});
