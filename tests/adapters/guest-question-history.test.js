import { expect, it, vi } from 'vitest';
import { createGuestQuestionHistoryRepository } from '../../src/adapters/local/guest-question-history.js';

it('reads and writes recent guest question ids using the existing storage key', () => {
  const values = new Map([['tai.gq', JSON.stringify(['q1', 'q2'])]]);
  const storage = {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
  const repository = createGuestQuestionHistoryRepository(storage);

  expect(repository.readRecentQuestionIds()).toEqual(['q1', 'q2']);
  repository.saveRecentQuestionIds(['q1', 'q2', 'q3']);
  expect(storage.setItem).toHaveBeenCalledWith('tai.gq', '["q1","q2","q3"]');
  expect(repository.readRecentQuestionIds()).toEqual(['q1', 'q2', 'q3']);
});

it('ignores malformed stored data and tolerates storage failures', () => {
  const storage = { getItem: () => '{bad json', setItem: () => { throw new Error('quota'); } };
  const repository = createGuestQuestionHistoryRepository(storage);

  expect(repository.readRecentQuestionIds()).toEqual([]);
  expect(() => repository.saveRecentQuestionIds(['q1'])).not.toThrow();
});
