import { expect, it } from 'vitest';
import { selectFlashcards, summarizeFlashcards } from '../../src/core/domain/flashcards.js';

const review = (intervalStep, dueAt, attempts = 1) => ({ attempts, known: 0, lastReviewedAt: dueAt - 10, intervalStep, dueAt });

it('selecciona primero vencidas y después nuevas equilibradas por tema', () => {
  const cards = [
    { id: 'late-a', topicId: 'A' }, { id: 'early-a', topicId: 'A' },
    { id: 'new-a1', topicId: 'A' }, { id: 'new-a2', topicId: 'A' }, { id: 'new-b', topicId: 'B' },
  ];
  const selected = selectFlashcards(cards, {
    'late-a': review(1, 90), 'early-a': review(0, 80),
  }, { count: 4, now: 100, maxNew: 2 });
  expect(selected).toEqual(['early-a', 'late-a', 'new-a1', 'new-b']);
});

it('aplica filtro de temas solo a nuevas y cuenta las categorías de repaso', () => {
  const cards = [
    { id: 'due', topicId: 'A' }, { id: 'fresh-a', topicId: 'A' },
    { id: 'fresh-b', topicId: 'B' }, { id: 'mastered', topicId: 'B' },
  ];
  const reviews = { due: review(1, 90), mastered: review(-1, 80) };
  expect(selectFlashcards(cards, reviews, { count: 4, now: 100, seenTopics: new Set(['A']) }))
    .toEqual(['due', 'fresh-a']);
  expect(summarizeFlashcards(cards, reviews, 100)).toEqual({ new: 2, inReview: 1, mastered: 1, due: 1 });
});
