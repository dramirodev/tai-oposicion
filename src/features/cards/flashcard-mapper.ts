import { selectFlashcards, summarizeFlashcards } from '../../core/domain/flashcards.js';
import type { CardReview } from '../../core/domain/entities.js';

interface CardRecord { id: string; t: string }
type LegacyCardReviews = Readonly<Record<string, readonly number[]>>;

function mapReviews(reviews: LegacyCardReviews): Record<string, CardReview> {
  return Object.fromEntries(Object.entries(reviews).map(([id, record]) => [id, {
    attempts: record[0] || 0,
    known: record[1] || 0,
    lastReviewedAt: record[2] || 0,
    intervalStep: record[3] ?? -1,
    dueAt: record[4] || 0,
    lastGrade: record[5] ?? 0,
  }]));
}

function mapCards(cards: readonly CardRecord[]) {
  return cards.map(card => ({ id: card.id, topicId: card.t }));
}

export function selectLegacyCards(cards: readonly CardRecord[], records: LegacyCardReviews, options: { n?: number; now?: number; maxNew?: number; seen?: ReadonlySet<string> | null } = {}): string[] {
  return selectFlashcards(mapCards(cards), mapReviews(records), {
    count: options.n ?? 20,
    now: options.now ?? Date.now(),
    maxNew: options.maxNew ?? 10,
    seenTopics: options.seen ?? null,
  });
}

export function summarizeLegacyCards(cards: readonly CardRecord[], records: LegacyCardReviews, now = Date.now()) {
  const summary = summarizeFlashcards(mapCards(cards), mapReviews(records), now);
  return { nuevas: summary.new, enRepaso: summary.inReview, dominadas: summary.mastered, hoy: summary.due };
}

export function cardFromFailedQuestion(question: { i: string; t: string; q: string; a: readonly string[]; c: number; n?: string; u?: string }) {
  return { id: `FC-Q-${question.i}`, t: question.t, tipo: 'fallo', src: 'fallo', q: question.q, a: question.a[question.c], nota: question.n || '', ref: question.u || '' };
}
