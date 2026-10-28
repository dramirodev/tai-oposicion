import { describe, expect, it } from 'vitest';
import { createStudyQuestionSelection } from '../../src/core/application/study-question-selection.js';

describe('study question selection', () => {
  const question = id => ({ i: id, o: 'O', np: 0, v: 0 });
  function reviewSelection(statistics, now, topicByQuestion = {}, seenTopics = []) {
    const questions = Object.keys(statistics).map(question);
    const progress = {
      getPreferences: () => ({}),
      getAllQuestionStats: () => statistics,
      getQuestionStats: id => statistics[id],
      getSeenTopics: () => seenTopics,
      accountId: () => null,
      onAccountChange: () => () => {},
      recordAnswer: () => {},
      addSession: () => {},
    };
    const catalog = {
      getTopicQuestions: async () => questions,
      getTopicForQuestion: id => id === 'without-topic' ? null : topicByQuestion[id] || 'T1.01',
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

  it('can restrict a daily due-review selection to explicitly studied topics', async () => {
    const now = 20 * 86_400_000;
    const selection = reviewSelection({
      studied: { intervalStep:0, dueAt:now - 2 },
      unstudied: { intervalStep:0, dueAt:now - 1 },
    }, now, { studied:'T1.01', unstudied:'T2.01' }, ['T1.01']);
    await expect(selection.repasoItems(['T1.01'])).resolves.toMatchObject({ items:[{ i:'studied' }] });
  });

  it('does not trust a training link for topics that are no longer marked as seen', async () => {
    const now = 20 * 86_400_000;
    const selection = reviewSelection({
      noLongerSeen: { intervalStep:0, dueAt:now - 2 },
    }, now, { noLongerSeen:'T1.01' }, []);

    await expect(selection.repasoItems(['T1.01'])).resolves.toMatchObject({ items:[] });
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

  it('excludes partially verified generated questions from scoring simulations', async () => {
    const questions = {
      A: [
        { i: 'generated-full', o: 'G', v: 0, f: 'family-full' },
        { i: 'generated-partial', o: 'G', v: 1, f: 'family-partial' },
        { i: 'GEN-T3.07-66.v2', o: 'G', v: 0, f: 'family-quarantined' },
        { i: 'official', o: 'O' },
        { i: 'official-provisional', o: 'O', p: 1 },
      ],
    };
    const progress = {
      getPreferences: () => ({}), getAllQuestionStats: () => ({}), getQuestionStats: () => undefined,
      getSeenTopics: () => [], accountId: () => null, onAccountChange: () => () => {},
      recordAnswer: () => {}, addSession: () => {},
    };
    const catalog = {
      getTopicQuestions: async topicId => questions[topicId], getTopicForQuestion: () => null,
      getIndex: async () => ({ n: 0, nsup: 0, temas: [] }), getMetadata: async () => ({ _by: {} }),
      getMetadataSnapshot: () => ({ _by: {} }), getQuestions: async () => [], now: () => 0,
    };
    const selection = createStudyQuestionSelection(progress, catalog);

    const chosen = await selection.selectWeightedSimulationQuestions([{ id: 'A' }], new Set(['O', 'G']), 4, () => 0);
    const practice = await selection.selectQuestionsForTopics({ topics: ['A'], origins: new Set(['O', 'G']), mode: 'aleatorio', count: 5 }, () => 0);

    expect(chosen.map(question => question.i).sort()).toEqual(['generated-full', 'official']);
    expect(practice.map(question => question.i).sort()).toEqual(['generated-full', 'generated-partial', 'official', 'official-provisional']);
  });

  it('does not select two generated variants from the same family across topics', async () => {
    const questions = {
      A: [{ i: 'variant-a', o: 'G', v: 0, f: 'same-family' }, { i: 'other-a', o: 'G', v: 0, f: 'family-a' }],
      B: [{ i: 'variant-b', o: 'G', v: 0, f: 'same-family' }, { i: 'other-b', o: 'G', v: 0, f: 'family-b' }],
    };
    const progress = {
      getPreferences: () => ({}), getAllQuestionStats: () => ({}), getQuestionStats: () => undefined,
      getSeenTopics: () => [], accountId: () => null, onAccountChange: () => () => {},
      recordAnswer: () => {}, addSession: () => {},
    };
    const catalog = {
      getTopicQuestions: async topicId => questions[topicId], getTopicForQuestion: () => null,
      getIndex: async () => ({ n: 0, nsup: 0, temas: [] }), getMetadata: async () => ({ _by: {} }),
      getMetadataSnapshot: () => ({ _by: {} }), getQuestions: async () => [], now: () => 0,
    };
    const selection = createStudyQuestionSelection(progress, catalog);

    const chosen = await selection.selectWeightedSimulationQuestions([{ id: 'A' }, { id: 'B' }], new Set(['G']), 3, () => 0);

    expect(chosen).toHaveLength(3);
    expect(chosen.filter(question => question.f === 'same-family')).toHaveLength(1);
  });

  it('keeps partially verified questions for practice but omits editorially quarantined questions', async () => {
    const progress = {
      getPreferences: () => ({}),
      getAllQuestionStats: () => ({ partial: { intervalStep: 0, dueAt: 1 }, quarantined: { intervalStep: 0, dueAt: 1 } }),
      getQuestionStats: () => undefined, getSeenTopics: () => [], accountId: () => null,
      onAccountChange: () => () => {}, recordAnswer: () => {}, addSession: () => {},
    };
    const catalog = {
      getTopicQuestions: async () => [], getTopicForQuestion: () => 'A',
      getIndex: async () => ({ n: 0, nsup: 0, temas: [] }), getMetadata: async () => ({ _by: {} }),
      getMetadataSnapshot: () => ({ _by: {} }),
      getQuestions: async () => [
        { i: 'partial', o: 'G', v: 1, f: 'family' },
        { i: 'GEN-T3.07-66.v2', o: 'G', v: 0, f: 'quarantined-family' },
      ], now: () => 10,
    };
    const { items } = await createStudyQuestionSelection(progress, catalog).repasoItems();

    expect(items.map(question => question.i)).toEqual(['partial']);
  });
});
