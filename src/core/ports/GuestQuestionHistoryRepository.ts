export interface GuestQuestionHistoryRepository {
  readRecentQuestionIds(): readonly string[];
  saveRecentQuestionIds(questionIds: readonly string[]): void;
}
