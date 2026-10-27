import type { GuestQuestionHistoryRepository } from '../../core/ports/GuestQuestionHistoryRepository.js';

const STORAGE_KEY = 'tai.gq';
type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createGuestQuestionHistoryRepository(storage: KeyValueStorage): GuestQuestionHistoryRepository {
  return {
    readRecentQuestionIds() {
      try {
        const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    },
    saveRecentQuestionIds(questionIds) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(questionIds)); } catch {}
    },
  };
}

export const localGuestQuestionHistoryRepository = createGuestQuestionHistoryRepository({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
