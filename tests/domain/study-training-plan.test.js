import { describe, expect, it } from 'vitest';
import { buildDailyTrainingPlan, DEFAULT_TRAINING_PREFERENCES, normalizeTrainingPreferences, selectNextAcademyTopic } from '../../src/core/domain/study-training-plan.ts';

const testPreferences = {
  ...DEFAULT_TRAINING_PREFERENCES,
  minutesByDay: [0, 35, 40, 35, 20, 40, 60],
  focusByDay: ['rest', 'consolidation', 'consolidation', 'consolidation', 'consolidation', 'consolidation', 'consolidation'],
  activities: DEFAULT_TRAINING_PREFERENCES.activities.filter(activity => activity !== 'newContent'),
  activityVersion: 3,
};

describe('planificación diaria de estudio', () => {
  it('sigue el orden configurado por la academia y omite temas ya vistos o ausentes sin inferir el siguiente', () => {
    const topics = [{ id: 'T12.01', name: 'A' }, { id: 'T3.02', name: 'B' }, { id: 'T20.01', name: 'C' }];
    expect(selectNextAcademyTopic(['T12.01', 'T99.01', 'T20.01', 'T3.02'], topics, ['T12.01'])).toEqual(topics[2]);
    expect(selectNextAcademyTopic(['T12.01'], topics, ['T12.01'])).toBeUndefined();
    expect(selectNextAcademyTopic([], topics, [])).toBeUndefined();
  });

  it('normaliza el orden sin duplicados, conserva IDs futuros y no convierte el catálogo entero en orden', () => {
    expect(normalizeTrainingPreferences({ academyTopicOrderIds: ['T12.01', 'T3.02', 'T12.01', 'bad'] }).academyTopicOrderIds)
      .toEqual(['T12.01', 'T3.02']);
    expect(normalizeTrainingPreferences({})).not.toHaveProperty('academyTopicOrderIds');
  });

  it('genera una actividad de contenido nuevo desde el orden de academia sin exigir selección semanal manual', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds: ['T12.01'] },
      weekday: 1,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 0,
      studiedTopicIds: [],
      nextNewTopic: { topicId: 'T12.01', topicName: 'Tema futuro' },
    });
    expect(plan.activities[0]).toMatchObject({ activity: 'newContent', topicId: 'T12.01' });
  });

  it('divide una sesión de referencia de 40 minutos en actividades equilibradas', () => {
    const plan = buildDailyTrainingPlan({
      preferences: testPreferences,
      weekday: 2,
      dueCount: 8,
      failureCount: 4,
      weakTopicCount: 2,
    });

    expect(DEFAULT_TRAINING_PREFERENCES.minutesByDay).toEqual([0, 120, 120, 120, 120, 120, 120]);
    expect(plan.minutes).toBe(40);
    expect(plan.activities.map(({ activity, minutes }) => [activity, minutes])).toEqual([
      ['activeRecall', 8], ['topicTest', 12], ['mixedTopicTest', 8], ['failures', 8], ['spacedReviews', 4],
    ]);
    expect(plan.activities.map(item => item.minutes).reduce((total, minutes) => total + minutes, 0)).toBe(plan.minutes);
  });

  it('no asigna un tema nuevo cuando no se ha elegido el tema de introducción semanal', () => {
    const plan = buildDailyTrainingPlan({
      preferences: DEFAULT_TRAINING_PREFERENCES,
      weekday: 1,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 0,
      studiedTopicIds: [],
      nextNewTopic: { topicId: 'T1.01', topicName: 'Organización del Estado' },
    });
    expect(plan.activities).toEqual([]);
  });

  it('limita el tema semanal elegido y a un único tipo de refuerzo prioritario', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...DEFAULT_TRAINING_PREFERENCES, introductionTopicId: 'T1.02' },
      weekday: 1,
      dueCount: 5,
      cardDueCount: 2,
      failureCount: 4,
      weakTopicCount: 1,
      studiedTopicIds: ['T1.01'],
      nextNewTopic: { topicId: 'T1.02', topicName: 'Organización administrativa' },
    });
    expect(plan.activities.map(item => item.activity)).toEqual(['newContent', 'spacedReviews']);
    expect(plan.activities[0].minutes).toBeGreaterThan(plan.activities[1].minutes);
    expect(plan.activities[0].topicId).toBe('T1.02');
    expect(plan.activities[1].topicIds).toEqual(['T1.01']);
  });

  it('prioriza preguntas del tema visto con autoevaluación reciente de recuerdo débil', () => {
    const plan = buildDailyTrainingPlan({
      preferences:DEFAULT_TRAINING_PREFERENCES,
      weekday:1,
      dueCount:0,
      cardDueCount:0,
      failureCount:0,
      weakTopicCount:1,
      weakTopicIds:['T1.01'],
      studiedTopicIds:['T1.01'],
      nextNewTopic:{ topicId:'T1.02', topicName:'Tema siguiente' },
    });
    expect(plan.activities.map(item => item.activity)).toEqual(['activeRecall', 'topicTest', 'mixedTopicTest']);
    expect(plan.activities.find(item => item.activity === 'topicTest')).toMatchObject({ reason:'weak-topics', topicId:'T1.01', topicIds:['T1.01'] });
  });

  it('marca el domingo como descanso y no traslada su carga a otro día', () => {
    const plan = buildDailyTrainingPlan({ preferences: testPreferences, weekday: 0, dueCount: 20, failureCount: 8, weakTopicCount: 3 });
    expect(plan).toEqual({ weekday: 0, minutes: 0, restDay: true, activities: [] });
  });

  it('omite actividades sin contenido y reparte todo el tiempo disponible entre las demás', () => {
    const plan = buildDailyTrainingPlan({ preferences: testPreferences, weekday: 1, dueCount: 0, failureCount: 0, weakTopicCount: 0, studiedTopicIds: ['T1.01'] });
    expect(plan.activities.map(item => item.activity)).toEqual(['activeRecall', 'topicTest', 'mixedTopicTest']);
    expect(plan.activities.map(item => item.minutes).reduce((total, minutes) => total + minutes, 0)).toBe(35);
    expect(plan.activities.every(item => item.minutes > 0)).toBe(true);
  });

  it('usa práctica del tema nuevo en el día de introducción y limita bloques a los minutos del día', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...testPreferences, focusByDay: ['rest', 'consolidation', 'consolidation', 'consolidation', 'new-content', 'consolidation', 'consolidation'], minutesByDay: [0, 35, 40, 35, 3, 40, 60], activities: [...testPreferences.activities, 'newContent'], introductionTopicId: 'T3.02' },
      weekday: 4,
      dueCount: 3,
      failureCount: 2,
      weakTopicCount: 0,
      studiedTopicIds: [],
      nextNewTopic: { topicId: 'T3.02', topicName: 'Tribunal Constitucional' },
    });
    expect(plan.activities).toHaveLength(1);
    expect(plan.activities.find(item => item.activity === 'newContent')).toMatchObject({ reason: 'new-content-day', topicId: 'T3.02' });
    expect(plan.activities.reduce((total, item) => total + item.minutes, 0)).toBe(3);
  });

  it('recomienda estudio inicial provisional para el tema de academia seleccionado', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...testPreferences, focusByDay: ['rest', 'consolidation', 'consolidation', 'consolidation', 'new-content', 'consolidation', 'consolidation'], activities: [...testPreferences.activities, 'newContent'], introductionTopicId: 'T3.02' },
      weekday: testPreferences.introductionDay,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 0,
      studiedTopicIds: [],
      nextNewTopic: { topicId: 'T3.02', topicName: 'Tribunal Constitucional' },
      topicReviewEvidence: [{ topicId: 'T3.02', topicName: 'Tribunal Constitucional', hasStudyMarker: false, distinctQuestionsAttempted: 0, latestAnswerAccuracy: null, daysSinceLastQuestionAttempt: null }],
    });
    expect(plan.activities).toEqual([{ activity: 'newContent', minutes: 20, reason: 'new-content-day', topicId: 'T3.02' }]);
  });

  it('respeta las modalidades que la persona ha elegido', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...testPreferences, activities: ['activeRecall', 'spacedReviews'] },
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
      preferences: testPreferences,
      weekday: 2,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 2,
      weakTopicIds: ['T3.02', 'T1.04'],
    });
    expect(plan.activities.find(item => item.activity === 'topicTest')).toMatchObject({ reason:'weak-topics', topicId:'T3.02' });
  });

  it('usa el tema estudiado con menor cobertura registrada cuando amplía práctica', () => {
    const plan = buildDailyTrainingPlan({
      preferences: testPreferences,
      weekday: 2,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 0,
      topicReviewEvidence: [
        { topicId:'T1.01', topicName:'Organización', hasStudyMarker:true, distinctQuestionsAttempted:0, questionCoverageOfTarget:72, latestAnswerAccuracy:null, daysSinceLastQuestionAttempt:null },
        { topicId:'T3.02', topicName:'Tribunal', hasStudyMarker:false, distinctQuestionsAttempted:0, questionCoverageOfTarget:0, latestAnswerAccuracy:null, daysSinceLastQuestionAttempt:null },
        { topicId:'T2.01', topicName:'Informática', hasStudyMarker:true, distinctQuestionsAttempted:2, questionCoverageOfTarget:24, latestAnswerAccuracy:50, daysSinceLastQuestionAttempt:4 },
      ],
    });
    expect(plan.activities.find(item => item.activity === 'topicTest')).toMatchObject({
      reason:'coverage', topicId:'T2.01', reviewIntervention:{ topicId:'T2.01', evidence:{ questionCoverageOfTarget:24 } },
    });
  });

  it('no infiere tema inicial de cobertura desde ausencia total de evidencia', () => {
    const plan = buildDailyTrainingPlan({
      preferences: testPreferences,
      weekday: 2,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 0,
      topicReviewEvidence: [{ topicId:'T1.01', topicName:'Organización', hasStudyMarker:false, distinctQuestionsAttempted:0, questionCoverageOfTarget:0, latestAnswerAccuracy:null, daysSinceLastQuestionAttempt:null }],
    });
    expect(plan.activities.some(item => item.activity === 'topicTest')).toBe(false);
  });

  it('ante resultados bajos prioriza comprobar el recuerdo en vez de recomendar lectura amplia', () => {
    const plan = buildDailyTrainingPlan({
      preferences: testPreferences,
      weekday: 2,
      dueCount: 0,
      failureCount: 0,
      weakTopicCount: 1,
      weakTopicIds: ['T1.02'],
      topicReviewEvidence: [{ topicId: 'T1.02', topicName: 'Organización del Estado', hasStudyMarker: true, distinctQuestionsAttempted: 6, latestAnswerAccuracy: 33, daysSinceLastQuestionAttempt: 10 }],
    });
    expect(plan.activities.find(item => item.activity === 'topicTest')?.reviewIntervention).toMatchObject({
      mode: 'active-retrieval', topicId: 'T1.02', reason: 'low-results-need-diagnosis', explanation: expect.stringContaining('33 %'), evidence: { distinctQuestionsAttempted: 6, latestAnswerAccuracy: 33, daysSinceLastQuestionAttempt: 10 },
    });
  });

  it('incluye las tarjetas FSRS vencidas aunque no haya repasos de preguntas pendientes', () => {
    const plan = buildDailyTrainingPlan({
      preferences: { ...testPreferences, activities: ['spacedReviews'] },
      weekday: 6,
      dueCount: 0,
      cardDueCount: 2,
      failureCount: 0,
      weakTopicCount: 0,
      studiedTopicIds: ['T1.01'],
    });
    expect(plan.activities).toEqual([{ activity: 'spacedReviews', minutes: 60, reason: 'due-reviews', topicIds: ['T1.01'] }]);
  });

  it('limita cada actividad diaria a los temas marcados y nunca recomienda temas no estudiados', () => {
    const plan = buildDailyTrainingPlan({
      preferences: testPreferences,
      weekday: 4,
      dueCount: 3,
      cardDueCount: 2,
      failureCount: 4,
      weakTopicCount: 2,
      weakTopicIds: ['T3.02', 'T1.01'],
      studiedTopicIds: ['T1.01'],
      topicReviewEvidence: [
        { topicId:'T1.01', topicName:'Organización', hasStudyMarker:true, distinctQuestionsAttempted:3, questionCoverageOfTarget:20, latestAnswerAccuracy:50, daysSinceLastQuestionAttempt:2 },
        { topicId:'T3.02', topicName:'Tribunal', hasStudyMarker:false, distinctQuestionsAttempted:8, questionCoverageOfTarget:50, latestAnswerAccuracy:20, daysSinceLastQuestionAttempt:1 },
      ],
    });
    expect(plan.activities.map(item => item.activity)).toEqual(['activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews']);
    expect(plan.activities.every(item => item.topicIds?.length && item.topicIds.every(topicId => topicId === 'T1.01'))).toBe(true);
    expect(plan.activities.find(item => item.activity === 'topicTest')).toMatchObject({ reason:'weak-topics', topicId:'T1.01' });
  });

  it('no crea actividades cuando aún no hay temas marcados como vistos', () => {
    const plan = buildDailyTrainingPlan({
      preferences: testPreferences,
      weekday: 4,
      dueCount: 20,
      cardDueCount: 10,
      failureCount: 8,
      weakTopicCount: 4,
      weakTopicIds: ['T3.02'],
      studiedTopicIds: [],
    });
    expect(plan).toMatchObject({ restDay:false, activities:[] });
  });
});
