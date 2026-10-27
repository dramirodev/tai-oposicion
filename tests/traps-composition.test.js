import { describe, expect, it, vi } from 'vitest';
import { createTrapsComposition } from '../src/app/composition/trainers/traps-composition.js';

function question(id, traps = [1]) {
  return { i: id, t: 'T1.01', o: 'G', q: `Pregunta ${id}`, a: ['A', 'B'], c: 0, x: traps };
}

function setup(overrides = {}) {
  let detectionStats = {};
  let account = 'account-a';
  const dependencies = {
    accountId: () => account,
    setAccount: value => { account = value; },
    loadQuestionMetadata: vi.fn(async () => {}),
    readQuestionStats: vi.fn(async () => ({ failed: { attempts: 1, correct: 0, lastSeenAt: 1, lastResult: 0 } })),
    eligibleQuestionIds: vi.fn(() => ['failed', 'plain', 'no-traps', 'scenario']),
    loadQuestionsById: vi.fn(async ids => ids.map(id => id === 'scenario' ? question(id, [2]) : question(id, id === 'no-traps' ? [] : [1]))),
    trapIds: [1, 2, 3, 4, 5, 6, 7, 8],
    shuffle: items => [...items],
    sourceFallbacks: {},
    topicName: id => `Tema ${id}`,
    readDetectionStats: () => detectionStats,
    writeDetectionStats: stats => { detectionStats = stats; },
    setDetectionStats: stats => { detectionStats = stats; },
    ...overrides,
  };
  return { dependencies, services: createTrapsComposition(dependencies) };
}

describe('traps composition', () => {
  it('prioritizes failed eligible questions and maps available trap choices', async () => {
    const { dependencies, services } = setup();

    const run = await services.startRun();

    expect(dependencies.loadQuestionMetadata).toHaveBeenCalledOnce();
    expect(dependencies.loadQuestionsById).toHaveBeenCalledWith(['failed', 'plain', 'no-traps', 'scenario']);
    expect(run.items.map(item => item.id)).toEqual(['failed', 'plain', 'scenario']);
    expect(run.items[0]).toMatchObject({ topicId: 'T1.01', topicName: 'Tema T1.01', trapIds: [1] });
    expect(run.items[0].choices).toHaveLength(8);
  });

  it('does not attach a run loaded for a previous account', async () => {
    let markLoading;
    let release;
    const loading = new Promise(resolve => { markLoading = resolve; });
    const { dependencies, services } = setup({
      loadQuestionsById: vi.fn(() => {
        markLoading();
        return new Promise(resolve => { release = resolve; });
      }),
    });

    const pending = services.startRun();
    await loading;
    dependencies.setAccount('account-b');
    release([question('failed')]);

    await expect(pending).resolves.toMatchObject({ items: [], index: 0, results: [] });
    expect(services.getRun()).toBeNull();
  });

  it('scores each prompt once, stores trap counts and advances the run', async () => {
    const { dependencies, services } = setup({ eligibleQuestionIds: () => ['first', 'second'], readQuestionStats: async () => ({}), loadQuestionsById: vi.fn(async ids => ids.map(id => question(id, [1]))) });
    const run = await services.startRun();
    expect(run.items).toHaveLength(2);

    expect(services.evaluate([1])).toMatchObject({ hits: 1, missed: 0, falseAlarms: 0 });
    expect(services.evaluate([1])).toBeNull();
    expect(services.next()?.index).toBe(1);
    expect(services.evaluate([])).toMatchObject({ hits: 0, missed: 1, falseAlarms: 0 });
    expect(dependencies.readDetectionStats()).toEqual({ 1: [2, 1] });
    expect(services.next()).toBeNull();
    expect(services.getRun()).toBeNull();
  });

  it('returns only sufficiently observed weaknesses, ordered by detection rate', () => {
    const { services } = setup({ readDetectionStats: () => ({ 1: [10, 2], 2: [5, 4], 3: [2, 0] }) });

    expect(services.getWeaknesses()).toEqual([{ id: 1, seen: 10, detected: 2 }, { id: 2, seen: 5, detected: 4 }]);
  });
});
