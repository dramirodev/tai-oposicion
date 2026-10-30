import type { AnswerResult, ErrorReport, Preferences, QuestionStats, SessionResult } from '../domain/entities.js';

/** Synchronous study-session operations needed while a user is answering questions. */
export interface StudyProgressGateway {
  accountId(): string | null;
  onAccountChange(listener: () => void): () => void;
  getQuestionStats(questionId: string): QuestionStats | undefined;
  getAllQuestionStats(): Readonly<Record<string, QuestionStats>>;
  getSessions(): readonly SessionResult[];
  getErrorReports(): Readonly<Record<string, ErrorReport>>;
  getErrorReport(questionId: string): ErrorReport | undefined;
  getPreferences(): Preferences;
  updatePreferences(update: (current: Preferences) => Preferences): void;
  getSeenTopics(): readonly string[];
  recordAnswer(questionId: string, topicId: string, result: AnswerResult, timestamp?: number, seconds?: number): void;
  addSession(session: SessionResult): void;
  saveErrorReport(report: ErrorReport): void;
  setErrorReportState(questionId: string, state: ErrorReport['state']): void;
  setSyllabusReviewed(questionId: string, topicId: string, reviewed: boolean): void;
}
