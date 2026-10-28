import { describe, expect, it, vi } from 'vitest';
import { createFailuresComposition } from '../src/app/composition/failures/failures-composition.js';

function question(id, topicId = 'T1.01') {
  return { i: id, t: topicId, o: 'G', q: `Pregunta ${id}`, a: ['A', 'B'], c: 0 };
}

function setup(overrides = {}) {
  let account = 'account-a';
  const dependencies = {
    accountId: () => account,
    progressRepository: { getStats: vi.fn(async () => ({ old: { attempts: 2, correct: 0, lastSeenAt: 10, failureStreak: 1 }, new: { attempts: 3, correct: 1, lastSeenAt: 20, failureStreak: 2, syllabusReviewed: true } })) },
    loadQuestionMetadata: vi.fn(async () => {}),
    loadQuestionIndex: vi.fn(async () => ({ temas: [{ id: 'T1.01', nombre: 'Tema 1' }] })),
    loadQuestionsById: vi.fn(async () => [question('old'), question('new')]),
    failedQuestionIds: vi.fn(() => ['old', 'new']),
    seenTopics: vi.fn(() => ['T1.01']),
    setReviewed: vi.fn(),
    topicName: vi.fn(id => `Tema ${id}`),
    sourceFallbacks: {},
    shuffle: items => [...items],
    createPractice: vi.fn(() => true),
    notify: vi.fn(),
    navigateToQuiz: vi.fn(),
    ...overrides,
  };
  return { dependencies, setAccount: value => { account = value; }, services: createFailuresComposition(dependencies) };
}

describe('failures composition', () => {
  it('loads and orders failed questions by their latest attempt before mapping them for the UI', async () => {
    const { dependencies, services } = setup();

    const result = await services.loadQuestions();

    expect(dependencies.loadQuestionMetadata).toHaveBeenCalledOnce();
    expect(dependencies.loadQuestionsById).toHaveBeenCalledWith(['old', 'new']);
    expect(result.map(item => item.id)).toEqual(['new', 'old']);
    expect(result[0]).toMatchObject({ topicId: 'T1.01', statement: 'Pregunta new', options: ['A', 'B'] });
    expect(result[0].progress).toEqual({ attempts: 3, correct: 1, lastSeenAt: 20, failureStreak: 2, syllabusReviewed: true });
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

  it('does not return questions loaded for a different active account', async () => {
    let releaseStats;
    const pendingStats = new Promise(resolve => { releaseStats = resolve; });
    const { setAccount, services } = setup({ progressRepository: { getStats: () => pendingStats } });
    const result = services.loadQuestions();
    setAccount('account-b');
    releaseStats({ old: { attempts: 1, correct: 0, lastSeenAt: 1 } });
    await expect(result).resolves.toEqual([]);
  });
});
