import { describe, expect, it } from 'vitest';
import { createStudyQuestionSelection } from '../../src/core/application/study-question-selection.js';

describe('study question selection', () => {
  it('keeps simulation allocation weighted while excluding reserved and non-scoring questions', async () => {
    const questions = {
      A: [
        { i: 'a-new', o: 'O', np: 0 },
        { i: 'a-reserved', o: 'O', r: 1 },
        { i: 'a-non-scoring', o: 'O', np: 1 },
        { i: 'a-seen', o: 'O', np: 0 },
      ],
      B: [{ i: 'b-new', o: 'O', np: 0 }],
    };
    const progress = {
      getPreferences: () => ({}),
      getAllQuestionStats: () => ({}),
      getQuestionStats: id => id === 'a-seen' ? { attempts: 1, correct: 1, lastSeenAt: 1 } : undefined,
      getSeenTopics: () => [],
      accountId: () => null,
      onAccountChange: () => () => {},
      recordAnswer: () => {},
      addSession: () => {},
    };
    const catalog = {
      getTopicQuestions: async topicId => questions[topicId],
      getTopicForQuestion: () => null,
      getIndex: async () => ({ n: 0, nsup: 0, temas: [] }),
      getMetadata: async () => ({ _by: {} }),
      getMetadataSnapshot: () => ({ _by: {} }),
      getQuestions: async () => [],
      now: () => 0,
    };
    const selection = createStudyQuestionSelection(progress, catalog);

    const chosen = await selection.selectWeightedSimulationQuestions(
      [{ id: 'A', weight: 1 }, { id: 'B', weight: 1 }],
      new Set(['O']),
      2,
      () => 0,
    );

    expect(chosen.map(question => question.i).sort()).toEqual(['a-new', 'b-new']);
  });
});
