import { describe, expect, it } from 'vitest';
import { createStudyQuestionSelection } from '../../src/core/application/study-question-selection.js';

describe('study question selection', () => {
  const question = id => ({ i: id, o: 'O', np: 0, v: 0 });
  function reviewSelection(statistics, now) {
    const questions = Object.keys(statistics).map(question);
    const progress = {
      getPreferences: () => ({}),
      getAllQuestionStats: () => statistics,
      getQuestionStats: id => statistics[id],
      getSeenTopics: () => [],
      accountId: () => null,
      onAccountChange: () => () => {},
      recordAnswer: () => {},
      addSession: () => {},
    };
    const catalog = {
      getTopicQuestions: async () => questions,
      getTopicForQuestion: id => id === 'without-topic' ? null : 'T1.01',
      getIndex: async () => ({ n: questions.length, nsup: 0, temas: [] }),
      getMetadata: async () => ({ _by: {} }),
      getMetadataSnapshot: () => ({ _by: {} }),
      getQuestions: async ids => questions.filter(item => ids.includes(item.i)),
      now: () => now,
    };
    return createStudyQuestionSelection(progress, catalog);
  }

  it('includes delayed syllabus checks when due, preserving ordinary reviews and excluding invalid candidates', async () => {
    const day = 86_400_000;
    const now = 20 * day;
    const reviewedAt = now - 3 * day;
    const selection = reviewSelection({
      reviewed: { syllabusReviewed: true, syllabusReviewedAt: reviewedAt, lastSeenAt: reviewedAt - 1, lastResult: 1, intervalStep: -1, dueAt: 0 },
      future: { syllabusReviewed: true, syllabusReviewedAt: now - day, lastSeenAt: 0, lastResult: 0, intervalStep: -1, dueAt: 0 },
      regular: { intervalStep: 0, dueAt: now - 2 * day },
      unmarked: { intervalStep: -1, dueAt: 0, syllabusReviewed: false, syllabusReviewedAt: reviewedAt },
      oldMarkWithoutDate: { intervalStep: -1, dueAt: 0, syllabusReviewed: true, lastSeenAt: 1 },
      answeredAfterDue: { intervalStep: -1, dueAt: 0, syllabusReviewed: true, syllabusReviewedAt: reviewedAt, lastSeenAt: reviewedAt + 2 * day, lastResult: 1 },
      unansweredTopic: { syllabusReviewed: true, syllabusReviewedAt: now - day, lastSeenAt: 0, lastResult: 0 },
      'without-topic': { syllabusReviewed: true, syllabusReviewedAt: reviewedAt, lastSeenAt: 0, lastResult: 0 },
    }, now);

    await expect(selection.dueQuestionIds()).resolves.toEqual(['regular', 'reviewed']);
    await expect(selection.repasoItems()).resolves.toMatchObject({
      items: [{ i: 'regular' }, { i: 'reviewed' }],
    });
  });

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
