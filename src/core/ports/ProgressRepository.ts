import type { CardReview, ErrorReport, Preferences, QuestionStats, SessionResult } from '../domain/entities.js';

export interface ProgressRepository {
  getStats(): Promise<Readonly<Record<string, QuestionStats>>>;
  getQuestionStats(questionId: string): Promise<QuestionStats | undefined>;
  saveStats(statistics: Readonly<Record<string, QuestionStats>>): Promise<void>;
  getSessions(): Promise<readonly SessionResult[]>;
  addSession(session: SessionResult): Promise<void>;
  getPreferences(): Promise<Preferences>;
  savePreferences(preferences: Preferences): Promise<void>;
  getSeenTopics(): Promise<readonly string[]>;
  saveSeenTopics(topicIds: readonly string[]): Promise<void>;
  getReports(): Promise<Readonly<Record<string, ErrorReport>>>;
  saveReports(reports: Readonly<Record<string, ErrorReport>>): Promise<void>;
  getCardReviews(): Promise<Readonly<Record<string, CardReview>>>;
  getCardReview(cardId: string): Promise<CardReview | undefined>;
  saveCardReviews(reviews: Readonly<Record<string, CardReview>>): Promise<void>;
  subscribe(listener: () => void): () => void;
}
