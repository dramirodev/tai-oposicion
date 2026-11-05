import { describe, expect, it, vi } from 'vitest';
import { createReadingComposition } from '../src/app/composition/trainers/reading-composition.js';

const question = (id, overrides = {}) => ({
  i: id, t: 'T1.01', o: 'A', q: '¿Cuál NO corresponde a la opción correcta?', a: ['No', 'Sí'], c: 1,
  ...overrides,
});

function setup(overrides = {}) {
  let account = 'account-a';
  let currentTime = 1_000;
  const dependencies = {
    accountId: () => account,
    setAccount: value => { account = value; },
    onAccountChange: vi.fn(() => () => {}),
    loadQuestionMetadata: vi.fn(async () => {}),
    readQuestionStats: vi.fn(async () => ({ failed: { attempts: 1, correct: 0, lastSeenAt: 1, lastResult: 0 } })),
    fastQuestionIds: vi.fn(() => ['fast']),
    recentQuestionIds: vi.fn(() => ['normal']),
    rememberQuestion: vi.fn(),
    availableQuestionIds: vi.fn(() => ['fast', 'failed', 'normal', 'scenario', 'context']),
    loadQuestionsById: vi.fn(async ids => ids.map(id => question(id, id === 'scenario' ? { s: true } : id === 'context' ? { cp: 'Contexto largo' } : {}))),
    mixQuestionIds: vi.fn((groups, rest) => [...groups.flatMap(([ids]) => ids), ...rest]),
    shuffle: items => [...items],
    tokenize: text => [{ text, key: true, start: 0 }],
    sourceFallbacks: {},
    recordAnswer: vi.fn(),
    now: () => 1234,
    currentTime: () => currentTime,
    setCurrentTime: value => { currentTime = value; },
    ...overrides,
  };
  return { dependencies, services: createReadingComposition(dependencies) };
}

describe('reading composition', () => {
  it('prioritizes recent and failed questions, and omits scenarios and context questions', async () => {
    const { dependencies, services } = setup();
    const progress = await services.start();

    expect(dependencies.mixQuestionIds).toHaveBeenCalledWith(
      [[['fast'], 3], [['failed'], 2]], ['normal', 'scenario', 'context'], 40, new Set(['normal']), expect.any(Function),
    );
    expect(progress.items.map(item => item.id)).toEqual(['fast', 'failed', 'normal']);
    expect(progress.items[0]).toMatchObject({ topicId: 'T1.01', asksForNegative: true, tokens: [{ key: true }] });
  });

  it('excludes non-scoring items even when prioritized by the history', async () => {
    const { services } = setup({ loadQuestionsById: async () => [question('fast', { np: 1 }), question('failed')] });
    expect((await services.start()).items.map(item => item.id)).toEqual(['failed']);
  });

  it('ignores a question batch when the account changes during loading', async () => {
    let release;
    const { dependencies, services } = setup({
      loadQuestionsById: vi.fn(() => new Promise(resolve => { release = resolve; })),
    });
    const pending = services.start();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    dependencies.setAccount('account-b');
    release([question('fast')]);

    await expect(pending).resolves.toBeNull();
    expect(services.getProgress()).toBeNull();
  });

  it('checks the three reading steps, enforces minimum reading time, and records the answer once', async () => {
    const { dependencies, services } = setup();
    const listener = vi.fn();
    services.subscribe(listener);
    await services.start();
    services.answerMeaning(1);
    services.continueMeaning();
    services.toggleWord(0);
    expect(services.checkWords()).toMatchObject({ hit: 1, missed: 0, total: 1 });
    services.showOptions();

    expect(services.answerOption(1)).toBe(false);
    dependencies.setCurrentTime(5_000);
    expect(services.answerOption(1)).toBe(true);
    expect(services.answerOption(0)).toBeNull();
    expect(dependencies.recordAnswer).toHaveBeenCalledWith('fast', 'T1.01', true, 1234, 4);
    expect(dependencies.rememberQuestion).toHaveBeenCalledWith('account-a', 'fast');
    expect(services.next()).toMatchObject({ index: 1, step: 0 });
    expect(listener).toHaveBeenCalled();
  });
});
