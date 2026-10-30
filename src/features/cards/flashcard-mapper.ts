import { selectFlashcards, summarizeFlashcards } from '../../core/domain/flashcards.js';
import type { CardReview } from '../../core/domain/entities.js';

interface CardRecord { id: string; t: string }
function mapCards(cards: readonly CardRecord[]) {
  return cards.map(card => ({ id: card.id, topicId: card.t }));
}

export function selectCards(cards: readonly CardRecord[], reviews: Readonly<Record<string, CardReview>>, options: { n?: number; now?: number; maxNew?: number; seen?: ReadonlySet<string> | null } = {}): string[] {
  return selectFlashcards(mapCards(cards), reviews, {
    count: options.n ?? 20,
    now: options.now ?? Date.now(),
    maxNew: options.maxNew ?? 10,
    seenTopics: options.seen ?? null,
  });
}

export function summarizeCards(cards: readonly CardRecord[], reviews: Readonly<Record<string, CardReview>>, now = Date.now()) {
  const summary = summarizeFlashcards(mapCards(cards), reviews, now);
  return { nuevas: summary.new, enRepaso: summary.inReview, dominadas: summary.mastered, hoy: summary.due };
}

export function cardFromFailedQuestion(question: { i: string; t: string; q: string; a: readonly string[]; c: number; n?: string; u?: string }) {
  return { id: `FC-Q-${question.i}`, t: question.t, tipo: 'fallo', src: 'fallo', q: question.q, a: question.a[question.c], nota: question.n || '', ref: question.u || '' };
}
