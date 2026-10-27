const storageKey = (accountId: string | null) => `tai.lrec:${accountId || 'guest'}`;

/** Stores recently used reading questions separately for each local account. */
export const localReadingQuestionHistoryRepository = {
  readRecentQuestionIds(accountId: string | null): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey(accountId)) || '[]');
      return Array.isArray(value) ? value.map(String) : [];
    } catch {
      return [];
    }
  },

  rememberQuestion(accountId: string | null, questionId: string): void {
    try {
      const key = storageKey(accountId);
      const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      const previous = Array.isArray(value) ? value : [];
      localStorage.setItem(key, JSON.stringify([String(questionId), ...previous.filter(id => String(id) !== String(questionId))].slice(0, 80)));
    } catch {}
  },
};
