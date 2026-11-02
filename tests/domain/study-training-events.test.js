import { describe, expect, it } from 'vitest';
import { DEFAULT_TRAINING_PREFERENCES, buildDailyTrainingPlan, normalizeTrainingPreferences } from '../../src/core/domain/study-training-plan.ts';
import { isTrainingCalendarEvent, normalizeTrainingCalendarEvents, resolveTrainingDay } from '../../src/core/domain/study-training-events.ts';

const event = (overrides = {}) => ({
  id: 'event-vacation', kind: 'study-window', title: 'Vacaciones', startDate: '2026-11-02', endDate: '2026-11-05',
  studyMinutes: 240, startTime: '08:00', endTime: '15:00', focus: 'new-content', createdAt: 1, updatedAt: 1, ...overrides,
});

describe('eventos de calendario de estudio', () => {
  it('aplica disponibilidad especial día a día sin mutar el horario semanal y conserva el periodo como dato histórico', () => {
    const preferences = { ...DEFAULT_TRAINING_PREFERENCES, calendarEvents: [event()] };
    expect(resolveTrainingDay({ dateKey: '2026-11-03', preferences })).toMatchObject({ minutes: 240, focus: 'new-content', override: { title: 'Vacaciones' } });
    const ordinaryDay = resolveTrainingDay({ dateKey: '2026-11-06', preferences });
    expect(ordinaryDay).toMatchObject({ minutes: 120, focus: 'new-content' });
    expect(ordinaryDay).not.toHaveProperty('override');
    expect(preferences.minutesByDay).toEqual(DEFAULT_TRAINING_PREFERENCES.minutesByDay);
  });

  it('hace prevalecer una ausencia sobre una ventana solapada y mantiene clases e hitos informativos', () => {
    const preferences = { ...DEFAULT_TRAINING_PREFERENCES, calendarEvents: [
      event({ id: 'window' }),
      event({ id: 'absence', kind: 'unavailable', title: 'Día libre', studyMinutes: undefined, startTime: undefined, endTime: undefined, focus: undefined }),
    ] };
    expect(resolveTrainingDay({ dateKey: '2026-11-03', preferences })).toMatchObject({ minutes: 0, focus: 'rest', override: { id: 'absence' } });
    for (const kind of ['class', 'milestone']) {
      const informational = event({ kind, studyMinutes: undefined, startTime: undefined, endTime: undefined, focus: undefined });
      expect(resolveTrainingDay({ dateKey: '2026-11-03', preferences: { ...preferences, calendarEvents: [informational] } }).minutes).toBe(120);
    }
  });

  it('aplica el presupuesto especial al plan diario y una ausencia produce descanso sin arrastrar carga', () => {
    const topic = { topicId: 'T12.01', topicName: 'Tema' };
    const study = buildDailyTrainingPlan({ preferences: { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds: ['T12.01'], calendarEvents: [event()] }, weekday: 2, dateKey: '2026-11-03', dueCount: 0, failureCount: 0, weakTopicCount: 0, studiedTopicIds: [], nextNewTopic: topic });
    expect(study).toMatchObject({ minutes: 240, restDay: false, activities: [{ activity: 'newContent', topicId: 'T12.01', minutes: 240 }] });
    const rest = buildDailyTrainingPlan({ preferences: { ...DEFAULT_TRAINING_PREFERENCES, calendarEvents: [event({ kind: 'unavailable', studyMinutes: undefined, startTime: undefined, endTime: undefined, focus: undefined })] }, weekday: 2, dateKey: '2026-11-03', dueCount: 9, failureCount: 3, weakTopicCount: 1, studiedTopicIds: ['T1.01'] });
    expect(rest).toMatchObject({ minutes: 0, restDay: true, activities: [] });
  });

  it('normaliza de forma compatible, descarta eventos inválidos, conserva IDs históricos y resuelve duplicados por actualización', () => {
    expect(isTrainingCalendarEvent(event({ startDate: '2026-02-30' }))).toBe(false);
    expect(normalizeTrainingCalendarEvents([
      event(), event({ studyMinutes: 180, updatedAt: 2 }), { ...event(), id: 'malicioso<script>' },
    ])).toEqual([event({ studyMinutes: 180, updatedAt: 2 })]);
    expect(normalizeTrainingPreferences({ calendarEvents: [event()] }).calendarEvents).toEqual([event()]);
    expect(normalizeTrainingPreferences({}).calendarEvents).toBeUndefined();
  });
});
