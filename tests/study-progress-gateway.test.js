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
});
