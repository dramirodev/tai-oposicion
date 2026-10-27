import type { AnswerResult, Preferences, QuestionStats, SessionResult } from '../domain/entities.js';

/** Synchronous study-session operations needed while a user is answering questions. */
export interface StudyProgressGateway {
  accountId(): string | null;
  onAccountChange(listener: () => void): () => void;
  getQuestionStats(questionId: string): QuestionStats | undefined;
  getAllQuestionStats(): Readonly<Record<string, QuestionStats>>;
  getPreferences(): Preferences;
  getSeenTopics(): readonly string[];
  recordAnswer(questionId: string, topicId: string, result: AnswerResult, timestamp?: number, seconds?: number): void;
  addSession(session: SessionResult): void;
}
