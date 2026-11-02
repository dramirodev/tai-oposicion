import { describe, expect, it } from 'vitest';
import { DEFAULT_TRAINING_PREFERENCES } from '../../src/core/domain/study-training-plan.ts';
import { buildStudyHorizonSummary } from '../../src/core/domain/study-planning-horizon.ts';

const order = ['T12.01', 'T3.02', 'T20.01'];
const catalog = ['T3.02', 'T12.01', 'T20.01', 'T30.01'];
const preferences = {
  ...DEFAULT_TRAINING_PREFERENCES,
  minutesByDay: [0, 30, 30, 0, 30, 0, 0],
  focusByDay: ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'rest', 'rest'],
};

describe('proyección del horizonte de estudio', () => {
  it('usa el orden explícito y distingue marcas declaradas de temas fuera de secuencia', () => {
    const summary = buildStudyHorizonSummary({
      todayDateKey: '2026-11-02', targetDate: '2026-11-20', academyTopicOrderIds: order,
      catalogTopicIds: catalog, studiedTopicIds: ['T3.02'], preferences,
    });
    expect(summary).toMatchObject({
      status: 'capacity-available', orderedTopicCount: 3, markedStudiedTopicCount: 1,
      pendingOrderedTopicCount: 2, unsequencedCatalogTopicCount: 1,
      weeklyMinutes: 90, weeklyNewContentDays: 3, daysUntilObjective: 18,
      availableNewTopicSessions: 9, topicSessionGap: 0,
    });
  });

  it('detecta la brecha del ritmo semanal sin afirmar que el tiempo baste para aprender', () => {
    const summary = buildStudyHorizonSummary({
      todayDateKey: '2026-11-02', targetDate: '2026-11-05', academyTopicOrderIds: order,
      catalogTopicIds: catalog, studiedTopicIds: [], preferences,
    });
    expect(summary).toMatchObject({ status: 'capacity-gap', pendingOrderedTopicCount: 3, availableNewTopicSessions: 2, topicSessionGap: 1 });
  });

  it('no deriva un orden del catálogo ni usa una fecha objetivo inventada', () => {
    const summary = buildStudyHorizonSummary({
      todayDateKey: '2026-11-02', targetDate: '', catalogTopicIds: catalog,
      studiedTopicIds: [], preferences,
    });
    expect(summary.status).toBe('no-academy-order');
    expect(summary.availableNewTopicSessions).toBeNull();
    expect(summary.unsequencedCatalogTopicCount).toBe(catalog.length);
  });

  it('mantiene desconocida la capacidad cuando la fecha falta o no es válida', () => {
    for (const targetDate of ['', '2026-02-30']) {
      const summary = buildStudyHorizonSummary({
        todayDateKey: '2026-11-02', targetDate, academyTopicOrderIds: order,
        catalogTopicIds: catalog, studiedTopicIds: [], preferences,
      });
      expect(summary.status).toBe('objective-unknown');
      expect(summary.daysUntilObjective).toBeNull();
      expect(summary.topicSessionGap).toBeNull();
    }
  });

  it('no reserva espacios de estudio el día del objetivo ni en fechas pasadas', () => {
    for (const targetDate of ['2026-11-02', '2026-11-01']) {
      const summary = buildStudyHorizonSummary({
        todayDateKey: '2026-11-02', targetDate, academyTopicOrderIds: order,
        catalogTopicIds: catalog, studiedTopicIds: [], preferences,
      });
      expect(summary.status).toBe('objective-reached');
      expect(summary.availableNewTopicSessions).toBeNull();
    }
  });

  it('resta ausencias y usa la disponibilidad especial al proyectar los espacios hasta el objetivo', () => {
    const unavailable = { id: 'leave', kind: 'unavailable', title: 'Ausencia', startDate: '2026-11-02', endDate: '2026-11-02', createdAt: 1, updatedAt: 1 };
    const window = { id: 'extra', kind: 'study-window', title: 'Vacaciones', startDate: '2026-11-04', endDate: '2026-11-04', studyMinutes: 240, startTime: '08:00', endTime: '15:00', focus: 'new-content', createdAt: 1, updatedAt: 1 };
    const summary = buildStudyHorizonSummary({
      todayDateKey: '2026-11-02', targetDate: '2026-11-06', academyTopicOrderIds: order,
      catalogTopicIds: catalog, studiedTopicIds: [], preferences: { ...preferences, calendarEvents: [unavailable, window] },
    });
    expect(summary).toMatchObject({ availableNewTopicSessions: 3, calendarOverrideDays: 2, topicSessionGap: 0 });
  });
});
