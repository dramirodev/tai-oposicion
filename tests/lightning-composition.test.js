import { describe, expect, it, vi } from 'vitest';
import { createLightningComposition } from '../src/app/composition/trainers/lightning-composition.js';

function question(id, extra = {}) {
  return { i: id, t: 'T1.01', o: 'G', q: `Pregunta ${id}`, a: ['A', 'B'], c: 0, ...extra };
}

function setup(overrides = {}) {
  const dependencies = {
    loadQuestionMetadata: vi.fn(async () => {}),
    readQuestionStats: vi.fn(() => ({ due: [0, 0, 0, 0, 0, 1], failed: [0, 0, 0, 0, 0, 0] })),
    loadDueQuestionIds: vi.fn(async () => ['due']),
    knownQuestionIds: vi.fn(() => ['due', 'failed', 'fresh']),
    shuffle: items => [...items],
    loadQuestionsById: vi.fn(async ids => ids.map(id => question(id))),
    sourceFallbacks: {},
    recordAnswer: vi.fn(),
    topicName: vi.fn(id => `Tema ${id}`),
    ...overrides,
  };
  return { dependencies, services: createLightningComposition(dependencies) };
}

describe('lightning composition', () => {
  it('prioritizes due questions, maps their presentation data and records the reason', async () => {
    const { dependencies, services } = setup();

    const result = await services.loadQuestion();

    expect(dependencies.loadQuestionMetadata).toHaveBeenCalledOnce();
    expect(dependencies.loadDueQuestionIds).toHaveBeenCalledOnce();
    expect(dependencies.loadQuestionsById).toHaveBeenCalledWith(['due', 'failed']);
    expect(result).toMatchObject({ id: 'due', topicId: 'T1.01', statement: 'Pregunta due', reason: '⏰ Toca repasarla' });
  });

  it('skips questions that are assumptions or context-only prompts', async () => {
    const { services } = setup({
      loadDueQuestionIds: vi.fn(async () => []),
      readQuestionStats: vi.fn(() => ({})),
      knownQuestionIds: vi.fn(() => ['scenario', 'context', 'plain']),
      loadQuestionsById: vi.fn(async () => [question('scenario', { s: true }), question('context', { cp: 'Contexto' }), question('plain')]),
    });

    await expect(services.loadQuestion()).resolves.toMatchObject({ id: 'plain', reason: '🆕 Nueva' });
  });

  it('records the answer and exposes the topic name through its dependency', async () => {
    const { dependencies, services } = setup();

    services.record('q-1', 'T1.01', false, 12);

    expect(dependencies.recordAnswer).toHaveBeenCalledWith('q-1', 'T1.01', false, 12);
    expect(services.topicName('T1.01')).toBe('Tema T1.01');
  });
});
