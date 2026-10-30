import type { CardReview } from '../domain/entities.js';

/** Synchronous card progress operations needed while planning and grading a review session. */
export interface CardProgressGateway {
  getCardReviews(): Readonly<Record<string, CardReview>>;
  getCardReview(cardId: string): CardReview | undefined;
  getSeenTopics(): readonly string[];
  previewReviewDate(cardId: string, grade: 0 | 1 | 2, timestamp: number): number;
  gradeCard(cardId: string, grade: 0 | 1 | 2, timestamp: number): void;
  removeCard(cardId: string): void;
}
