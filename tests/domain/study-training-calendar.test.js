import { describe, expect, it } from 'vitest';
import { DEFAULT_TRAINING_PREFERENCES } from '../../src/core/domain/study-training-plan.ts';
import { daysUntilStudyDate, isScheduledStudyActivity, mergeScheduledStudyActivities, proposeStudyActivity, proposeStudyActivityReschedule } from '../../src/core/domain/study-training-calendar.ts';

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

  it('programa temas de bloques futuros si están en la lista de temas vistos', () => {
    const decision = proposeStudyActivity(input({ topicId:'T12.01', seenTopicIds:['T12.01'] }));
    expect(decision).toMatchObject({ ok:true, activity:{ topicId:'T12.01' } });
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

  it('valida las actividades futuras con la excepción de disponibilidad de esa fecha', () => {
    const preferences = { ...DEFAULT_TRAINING_PREFERENCES, calendarEvents:[{ id:'event-leave', kind:'unavailable', title:'Ausencia', startDate:'2026-10-30', endDate:'2026-10-30', createdAt:1, updatedAt:1 }] };
    expect(proposeStudyActivity(input({ preferences }))).toEqual({ ok:false, reason:'rest-day' });
    const studyWindow = { ...preferences, calendarEvents:[{ id:'event-window', kind:'study-window', title:'Ventana', startDate:'2026-10-30', endDate:'2026-10-30', studyMinutes:20, startTime:'08:00', endTime:'12:00', createdAt:1, updatedAt:1 }] };
    expect(proposeStudyActivity(input({ preferences:studyWindow, minutes:30 }))).toEqual({ ok:false, reason:'day-capacity' });
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
    expect(isScheduledStudyActivity({ ...first, topicId:'T12.01' })).toBe(true);
    expect(isScheduledStudyActivity({ ...first, topicId:'T0.01' })).toBe(false);
    expect(mergeScheduledStudyActivities([first], [newer, { ...first, id:'bad', minutes:500 }])).toEqual([newer]);
  });

  const dated = (index, base = Date.UTC(2026, 0, 1)) => {
    const day = new Date(base + index * 86_400_000).toISOString().slice(0, 10);
    return { id:`${day}:topicTest:T1.01`, dateKey:day, activity:'topicTest', topicId:'T1.01', minutes:30, createdAt:1, updatedAt:1 };
  };

  it('no cuenta las actividades pasadas para el límite de la agenda', () => {
    const past = Array.from({ length:90 }, (_, index) => dated(index)); // enero–marzo de 2026, anteriores a hoy
    expect(proposeStudyActivity(input({ existing:past })).ok).toBe(true);
  });

  it('bloquea con el límite cuando ya hay 90 actividades futuras, también al mover una', () => {
    const upcoming = Array.from({ length:90 }, (_, index) => dated(index, Date.UTC(2026, 10, 2)));
    expect(proposeStudyActivity(input({ existing:upcoming, dateKey:'2026-10-30' }))).toEqual({ ok:false, reason:'schedule-limit' });
    const moved = proposeStudyActivityReschedule({ id:upcoming[0].id, dateKey:'2026-10-30', now:input().now, preferences:DEFAULT_TRAINING_PREFERENCES, seenTopicIds:['T1.01'], existing:upcoming });
    expect(moved.ok).toBe(true);
  });

  it('al superar el tope descarta las actividades más antiguas y conserva las futuras', () => {
    const all = Array.from({ length:95 }, (_, index) => dated(index));
    const merged = mergeScheduledStudyActivities(all.slice(0, 50), all.slice(50));
    expect(merged).toHaveLength(90);
    expect(merged[0].id).toBe(all[5].id);
    expect(merged.at(-1).id).toBe(all[94].id);
  });

  it('converge ante un empate de updatedAt con distinta fecha, sin importar el orden de la fusión', () => {
    const left = { ...dated(0), dateKey:'2026-10-30', updatedAt:5 };
    const right = { ...left, dateKey:'2026-10-31' };
    expect(mergeScheduledStudyActivities([left], [right])).toEqual(mergeScheduledStudyActivities([right], [left]));
    expect(mergeScheduledStudyActivities([left], [right])[0].dateKey).toBe('2026-10-31');
  });

  describe('días hasta una fecha de estudio', () => {
    const morning = new Date('2026-10-29T08:00:00').getTime();

    it('cuenta días de calendario locales sin depender de la hora del día', () => {
      expect(daysUntilStudyDate('2026-10-30', morning)).toBe(1);
      expect(daysUntilStudyDate('2026-10-30', new Date('2026-10-29T23:59:00').getTime())).toBe(1);
      expect(daysUntilStudyDate('2026-11-29', morning)).toBe(31);
    });

    it('no baja de cero cuando la fecha llega o ya pasó', () => {
      expect(daysUntilStudyDate('2026-10-29', morning)).toBe(0);
      expect(daysUntilStudyDate('2026-10-20', morning)).toBe(0);
    });

    it('devuelve null, no NaN, para fechas imposibles, mal formadas o ausentes', () => {
      for (const value of ['2026-02-31', '29/10/2026', '', null, undefined, 20261030]) expect(daysUntilStudyDate(value, morning), String(value)).toBeNull();
      expect(daysUntilStudyDate('2026-10-30', Number.NaN)).toBeNull();
    });
  });
});
