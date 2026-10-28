import type { CardReview } from './entities.js';
import { selectSpacedReviews } from './spaced-repetition.ts';

export interface FlashcardCandidate {
  id: string;
  topicId: string;
}

export interface FlashcardSelectionOptions {
  count: number;
  now: number;
  maxNew?: number;
  seenTopics?: ReadonlySet<string> | null;
}

export interface FlashcardSummary {
  new: number;
  inReview: number;
  mastered: number;
  due: number;
}

function classifyFlashcards(
  cards: readonly FlashcardCandidate[],
  reviews: Readonly<Record<string, CardReview | undefined>>,
  now: number,
  seenTopics: ReadonlySet<string> | null,
): { due: { id: string; topicId: string; dueAt: number }[]; fresh: FlashcardCandidate[] } {
  const due: { id: string; topicId: string; dueAt: number }[] = [];
  const fresh: FlashcardCandidate[] = [];
  for (const card of cards) {
    const review = reviews[card.id];
    if (review) {
      if (review.intervalStep >= 0 && review.dueAt <= now) due.push({ id: card.id, topicId: card.topicId, dueAt: review.dueAt });
    } else if (!seenTopics || seenTopics.has(card.topicId)) fresh.push(card);
  }
  return { due, fresh };
}

function selectNewCards(fresh: readonly FlashcardCandidate[], count: number): string[] {
  if (count <= 0 || !fresh.length) return [];
  const byTopic = new Map<string, string[]>();
  for (const card of fresh) {
    const topicCards = byTopic.get(card.topicId);
    if (topicCards) topicCards.push(card.id);
    else byTopic.set(card.topicId, [card.id]);
  }
  const topicIds = [...byTopic.keys()].sort();
  const selected: string[] = [];
  while (selected.length < count && topicIds.some(topicId => byTopic.get(topicId)!.length)) {
    for (const topicId of topicIds) {
      if (selected.length >= count) break;
      const id = byTopic.get(topicId)!.shift();
      if (id) selected.push(id);
    }
  }
  return selected;
}

export function selectFlashcards(
  cards: readonly FlashcardCandidate[],
  reviews: Readonly<Record<string, CardReview | undefined>>,
  { count, now, maxNew = 10, seenTopics = null }: FlashcardSelectionOptions,
): string[] {
  const { due, fresh } = classifyFlashcards(cards, reviews, now, seenTopics);
  const dueIds = selectSpacedReviews(due, count).map(card => card.id);
  const availableForNew = Math.min(count - dueIds.length, maxNew);
  return [...dueIds, ...selectNewCards(fresh, availableForNew)];
}

export function summarizeFlashcards(
  cards: readonly FlashcardCandidate[],
  reviews: Readonly<Record<string, CardReview | undefined>>,
  now: number,
): FlashcardSummary {
  const summary: FlashcardSummary = { new: 0, inReview: 0, mastered: 0, due: 0 };
  for (const card of cards) {
    const review = reviews[card.id];
    if (!review) summary.new++;
    else if (review.intervalStep >= 0) {
      summary.inReview++;
      if (review.dueAt <= now) summary.due++;
    } else if (review.attempts > 0) summary.mastered++;
  }
  return summary;
}
