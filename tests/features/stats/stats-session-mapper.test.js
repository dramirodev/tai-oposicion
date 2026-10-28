import { describe, expect, it } from 'vitest';
import { toLegacyStatsSession } from '../../../src/features/stats/stats-session-mapper.js';

describe('toLegacyStatsSession', () => {
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
