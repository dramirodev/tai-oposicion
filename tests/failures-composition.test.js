import { describe, expect, it, vi } from 'vitest';
import { createFailuresComposition } from '../src/app/failures-composition.js';

function question(id, topicId = 'T1.01') {
  return { i: id, t: topicId, o: 'G', q: `Pregunta ${id}`, a: ['A', 'B'], c: 0 };
}

function setup(overrides = {}) {
  const dependencies = {
    loadQuestionMetadata: vi.fn(async () => {}),
    loadQuestionIndex: vi.fn(async () => ({ temas: [{ id: 'T1.01', nombre: 'Tema 1' }] })),
    loadQuestionsById: vi.fn(async () => [question('old'), question('new')]),
    failedQuestionIds: vi.fn(() => ['old', 'new']),
    lastAttemptAt: id => ({ old: 10, new: 20 })[id],
    readRecord: vi.fn(() => [1]),
    isReviewed: vi.fn(() => false),
    setReviewed: vi.fn(),
    topicName: vi.fn(id => `Tema ${id}`),
    sourceFallbacks: {},
    shuffle: items => [...items],
    createPractice: vi.fn(() => true),
    notify: vi.fn(),
    navigateToQuiz: vi.fn(),
    ...overrides,
  };
  return { dependencies, services: createFailuresComposition(dependencies) };
}

describe('failures composition', () => {
  it('loads and orders failed questions by their latest attempt before mapping them for the UI', async () => {
    const { dependencies, services } = setup();

    const result = await services.loadQuestions();

    expect(dependencies.loadQuestionMetadata).toHaveBeenCalledOnce();
    expect(dependencies.loadQuestionsById).toHaveBeenCalledWith(['old', 'new']);
    expect(result.map(item => item.id)).toEqual(['new', 'old']);
    expect(result[0]).toMatchObject({ topicId: 'T1.01', statement: 'Pregunta new', options: ['A', 'B'] });
  });

  it('uses only cached selected questions and navigates after practice starts', async () => {
    const { dependencies, services } = setup();
    await services.loadQuestions();
    const selected = ['old', 'missing', 'new'];

    services.startPractice(selected, 'Mis fallos');

    expect(dependencies.createPractice).toHaveBeenCalledWith([question('old'), question('new')], 'Mis fallos');
    expect(dependencies.navigateToQuiz).toHaveBeenCalledOnce();
  });

  it('reports empty selections or unscorable practice without navigating', async () => {
    const empty = setup();
    empty.services.startPractice(['missing'], 'Filtrado');
    expect(empty.dependencies.notify).toHaveBeenCalledWith('No hay preguntas con ese filtro.');
    expect(empty.dependencies.navigateToQuiz).not.toHaveBeenCalled();

    const unscorable = setup({ createPractice: vi.fn(() => false) });
    await unscorable.services.loadQuestions();
    unscorable.services.startPractice(['old'], 'Filtrado');
    expect(unscorable.dependencies.notify).toHaveBeenCalledWith('No hay preguntas puntuables en esta selección. Puedes consultarlas en modo estudio.');
    expect(unscorable.dependencies.navigateToQuiz).not.toHaveBeenCalled();
  });
});
