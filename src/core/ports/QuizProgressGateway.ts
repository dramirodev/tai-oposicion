import type { ErrorReport, Preferences, QuestionStats } from '../domain/entities.js';

/** Progress operations needed while a question is presented and reviewed. */
export interface QuizProgressGateway {
  getQuestionStats(questionId: string): QuestionStats | undefined;
  getErrorReport(questionId: string): ErrorReport | undefined;
  getUiPreferences(): Preferences['ui'];
  hasFailureCard(questionId: string): boolean;
  subscribe(listener: () => void): () => void;
  toggleFlag(questionId: string, topicId: string): void;
  setFailureReason(questionId: string, topicId: string, reason: number): void;
  markDoubt(questionId: string, topicId: string): void;
  markLucky(questionId: string, topicId: string): void;
  toggleFailureCard(questionId: string): void;
  saveErrorReport(questionId: string, topicId: string, reason: string, note: string): void;
}
