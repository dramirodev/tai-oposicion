import { beforeEach, describe, expect, it } from 'vitest';
import { localReadingQuestionHistoryRepository as history } from '../../src/adapters/local/reading-question-history.js';

describe('local reading question history', () => {
  beforeEach(() => localStorage.clear());

  it('keeps accounts isolated and stores newest questions first without duplicates', () => {
    history.rememberQuestion('account-a', 'Q1');
    history.rememberQuestion('account-a', 'Q2');
    history.rememberQuestion('account-a', 'Q1');
    history.rememberQuestion('account-b', 'Q3');

    expect(history.readRecentQuestionIds('account-a')).toEqual(['Q1', 'Q2']);
    expect(history.readRecentQuestionIds('account-b')).toEqual(['Q3']);
    expect(history.readRecentQuestionIds(null)).toEqual([]);
  });

  it('bounds history to 80 ids and safely ignores malformed stored data', () => {
    for (let index = 0; index < 90; index++) history.rememberQuestion(null, `Q${index}`);
    expect(history.readRecentQuestionIds(null)).toHaveLength(80);
    localStorage.setItem('tai.lrec:broken', '{');
    expect(history.readRecentQuestionIds('broken')).toEqual([]);
  });
});
