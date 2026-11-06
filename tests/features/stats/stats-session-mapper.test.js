import { describe, expect, it } from 'vitest';
import { simHistory, compareSessions } from '../../../src/features/stats/analytics-mapper.js';
import { officialExamSessionId, officialSessionQuota } from '../../../src/core/domain/simulation-scenarios.js';
import { toLegacyStatsSession } from '../../../src/features/stats/stats-session-mapper.js';

describe('toLegacyStatsSession', () => {
  it('separa el ejercicio completo, las dos cuotas y las puntuaciones no calculadas en el historial', () => {
    const exam = { profile: 'tai-li-2025', scenarioId: 'L2025A-S1', quota: 'general' };
    const ordinary = { id: 'legacy', kind: 'sim', ts: 1, n: 80, a: 60, f: 0, b: 20, secs: 1200, nota: 75 };
    const general = { ...ordinary, id: officialExamSessionId(exam, 2), ts: 2 };
    const reserved = { ...general, id: officialExamSessionId({ ...exam, quota: 'norma13' }, 3), ts: 3, nota: 70 };
    const failed = { ...reserved, id: officialExamSessionId({ ...exam, quota: 'norma13' }, 4), ts: 4, scorePending: true, nota: 0 };
    expect(officialSessionQuota(failed.id)).toBe('norma13');
    expect(simHistory([ordinary, general, reserved, failed]).map(s => [s.part, s.dNota])).toEqual([
      ['p1', null], ['both', null], ['both', null],
    ]);
    expect(compareSessions(general, ordinary).dNota).toBeNull();
    expect(compareSessions(general, reserved).dNota).toBeNull();
    expect(compareSessions(reserved, failed).dNota).toBeNull();
  });
  it('adapta una sesión de dominio al formato de estadísticas conservando sus resultados', () => {
    expect(toLegacyStatsSession({
      id: 'sim-1', completedAt: 1200, kind: 'sim', questionCount: 40, correctCount: 30,
      wrongCount: 8, blankCount: 2, durationSeconds: 3600, score: 23.33,
      topicResults: { 'T1.01': [5, 7] }, typeResults: { D: [3, 4] },
      failedQuestionIds: ['q-2'], title: 'Simulacro · Parte 2', interrupted: false, timeLimited: true,
    })).toEqual({
      id: 'sim-1', ts: 1200, kind: 'sim', n: 40, a: 30, f: 8, b: 2,
      secs: 3600, nota: 23.33, temas: { 'T1.01': [5, 7] }, tipos: { D: [3, 4] },
      titulo: 'Simulacro · Parte 2',
    });
  });
});
