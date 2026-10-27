import { describe, expect, it } from 'vitest';
import { evaluateReadingWords } from '../../src/core/domain/reading-strategy.js';

describe('evaluateReadingWords', () => {
  const tokens = [{ key: true }, { key: false }, { key: true }];

  it('counts correctly selected, missed, and extra words once each', () => {
    expect(evaluateReadingWords(tokens, [0, 1, 1])).toEqual({ hit: 1, missed: 1, extra: 1, total: 2, claimedNone: false });
  });

  it('treats a none-claimed answer as no selected words and reports every key as missed', () => {
    expect(evaluateReadingWords(tokens, [0, 1], true)).toEqual({ hit: 0, missed: 2, extra: 0, total: 2, claimedNone: true });
  });

  it('handles text without marked key words', () => {
    expect(evaluateReadingWords([{ key: false }], [0])).toEqual({ hit: 0, missed: 0, extra: 1, total: 0, claimedNone: false });
  });
});
