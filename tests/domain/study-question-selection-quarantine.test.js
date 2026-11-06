import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/core/domain/question-review-overrides.js', () => ({
  questionReviewOverrides: [],
  isQuestionEditoriallyQuarantined: id => id === 'blocked',
  isEditorialQuarantineActive: question => question.i === 'blocked',
}));
const { createStudyQuestionSelection } = await import('../../src/core/application/study-question-selection.js');

describe('study question selection with editorially quarantined questions', () => {
  const question = id => ({ i: id, o: 'O', np: 0, v: 0 });
  function selection(statistics) {
    const questions = Object.keys(statistics).map(question);
    const progress = {
      getPreferences: () => ({}), getAllQuestionStats: () => statistics, getQuestionStats: id => statistics[id],
      getSeenTopics: () => [], accountId: () => null, onAccountChange: () => () => {}, recordAnswer: () => {}, addSession: () => {},
    };
    const catalog = {
      getTopicQuestions: async () => questions, getTopicForQuestion: () => 'T1.01',
      getIndex: async () => ({ n: questions.length, nsup: 0, temas: [] }), getMetadata: async () => ({ _by: {} }),
      getMetadataSnapshot: () => ({ _by: {} }), getQuestions: async ids => questions.filter(item => ids.includes(item.i)), now: () => 1_000,
    };
    return createStudyQuestionSelection(progress, catalog);
  }

  it('does not count a quarantined question as a due review, because it can never be answered', async () => {
    const due = await selection({ blocked: { intervalStep: 0, dueAt: 1 }, regular: { intervalStep: 0, dueAt: 2 } }).dueQuestionIds();

    expect(due).toEqual(['regular']);
  });

  it('does not count a quarantined question as a pending failure', () => {
    const failed = selection({ blocked: { failureStreak: 0 }, regular: { failureStreak: 0 } }).falladasIds();

    expect(failed).toEqual(['regular']);
  });

  it('does not waste a review slot on a quarantined question', async () => {
    const statistics = { blocked: { intervalStep: 0, dueAt: 1 } };
    for (let index = 1; index <= 30; index++) statistics[`q${index}`] = { intervalStep: 0, dueAt: 1 + index };

    const { items } = await selection(statistics).repasoItems();

    expect(items).toHaveLength(30);
    expect(items.map(item => item.i)).not.toContain('blocked');
  });
});
