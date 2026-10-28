import { describe, expect, it } from 'vitest';
import { buildDailyTrainingPlan, DEFAULT_TRAINING_PREFERENCES } from '../../src/core/domain/study-training-plan.ts';

describe('planificación diaria de estudio', () => {
  it('usa la planificación semanal inicial y divide 40 minutos en actividades equilibradas', () => {
    const plan = buildDailyTrainingPlan({
      preferences: DEFAULT_TRAINING_PREFERENCES,
      weekday: 2,
      dueCount: 8,
      failureCount: 4,
      weakTopicCount: 2,
    });

    expect(DEFAULT_TRAINING_PREFERENCES.minutesByDay).toEqual([0, 35, 40, 35, 20, 40, 60]);
    expect(plan.minutes).toBe(40);
    expect(plan.activities.map(({ activity, minutes }) => [activity, minutes])).toEqual([
      ['activeRecall', 10], ['topicTest', 15], ['failures', 10], ['spacedReviews', 5],
    ]);
    expect(plan.activities.map(item => item.minutes).reduce((total, minutes) => total + minutes, 0)).toBe(plan.minutes);
  });

  it('marca el domingo como descanso y no traslada su carga a otro día', () => {
    const plan = buildDailyTrainingPlan({ preferences: DEFAULT_TRAINING_PREFERENCES, weekday: 0, dueCount: 20, failureCount: 8, weakTopicCount: 3 });
    expect(plan).toEqual({ weekday: 0, minutes: 0, restDay: true, activities: [] });
  });

  it('omite actividades sin contenido y reparte todo el tiempo disponible entre las demás', () => {
    const plan = buildDailyTrainingPlan({ preferences: DEFAULT_TRAINING_PREFERENCES, weekday: 1, dueCount: 0, failureCount: 0, weakTopicCount: 0 });
    expect(plan.activities.map(item => item.activity)).toEqual(['activeRecall', 'topicTest']);
    expect(plan.activities.map(item => item.minutes).reduce((total, minutes) => total + minutes, 0)).toBe(35);
    expect(plan.activities.every(item => item.minutes > 0)).toBe(true);
  });

  it('usa práctica del tema nuevo en el día de introducción y limita bloques a los minutos del día', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...DEFAULT_TRAINING_PREFERENCES, minutesByDay: [0, 35, 40, 35, 3, 40, 60] },
      weekday: 4,
      dueCount: 3,
      failureCount: 2,
      weakTopicCount: 0,
    });
    expect(plan.activities).toHaveLength(3);
    expect(plan.activities.find(item => item.activity === 'topicTest').reason).toBe('new-topic-day');
    expect(plan.activities.reduce((total, item) => total + item.minutes, 0)).toBe(3);
  });

  it('respeta las modalidades que la persona ha elegido', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...DEFAULT_TRAINING_PREFERENCES, activities: ['activeRecall', 'spacedReviews'] },
      weekday: 6,
      dueCount: 0,
      failureCount: 9,
      weakTopicCount: 2,
    });
    expect(plan.activities.map(item => item.activity)).toEqual(['activeRecall']);
    expect(plan.activities[0].minutes).toBe(60);
  });

  it('adjunta el tema débil prioritario a la actividad de test', () => {
    const plan = buildDailyTrainingPlan({
      preferences: DEFAULT_TRAINING_PREFERENCES,
      weekday: 2,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 2,
      weakTopicIds: ['T3.02', 'T1.04'],
    });
    expect(plan.activities.find(item => item.activity === 'topicTest')).toMatchObject({ reason:'weak-topics', topicId:'T3.02' });
  });

  it('incluye las tarjetas FSRS vencidas aunque no haya repasos de preguntas pendientes', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...DEFAULT_TRAINING_PREFERENCES, activities: ['spacedReviews'] },
      weekday: 6,
      dueCount: 0,
      cardDueCount: 2,
      failureCount: 0,
      weakTopicCount: 0,
    });
    expect(plan.activities).toEqual([{ activity: 'spacedReviews', minutes: 60, reason: 'due-reviews' }]);
  });
});
