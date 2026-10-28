import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('localStudyProgressGateway', () => {
  let store;
  let gateway;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    store = await import('../src/adapters/local/legacy-store.js');
    gateway = (await import('../src/adapters/local/progress-repository.js')).localStudyProgressGateway;
  });

  it('adapta las tuplas persistidas a estadísticas tipadas para el motor de estudio', () => {
    store.record('q-1', 'T1.01', 0, 100, 4);

    expect(gateway.getQuestionStats('q-1')).toMatchObject({
      attempts: 1,
      correct: 0,
      lastSeenAt: 100,
      lastResult: 0,
      secondsStudied: 4,
      timedAnswers: 1,
    });
    expect(gateway.getAllQuestionStats()['q-1']).toEqual(gateway.getQuestionStats('q-1'));
  });

  it('actualiza preferencias en bloque sin perder ajustes de otras pantallas', async () => {
    store = await import('../src/adapters/local/legacy-store.js');
    store.setCfg('training', { minutesByDay: [0, 35, 40, 35, 20, 40, 60], introductionDay: 4, activities: ['topicTest'] });
    store.setCfg('evo', { m: 'tiempo', f: 'g', w: 8, tabla: true });

    gateway.updatePreferences(current => ({ ...current, dmord: 'frios' }));

    expect(store.getCfg()).toMatchObject({ dmord: 'frios', evo: { m: 'tiempo', w: 8, tabla: true }, training: { introductionDay: 4 } });
  });
});
