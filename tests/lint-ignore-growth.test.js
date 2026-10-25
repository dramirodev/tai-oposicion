import { describe, expect, it } from 'vitest';
import { findAddedIgnores, readIgnoreList } from '../scripts/lint-ignore-growth.mjs';

describe('lint ignore growth guard', () => {
  it('finds only exclusions added after the baseline', () => {
    expect(findAddedIgnores(['old.ts', 'new.ts'], ['old.ts'])).toEqual(['new.ts']);
  });

  it('reads ignore entries from the flat config block', () => {
    expect(readIgnoreList("export default [{ ignores: ['dist/**', 'src/legacy/**'] }];"))
      .toEqual(['dist/**', 'src/legacy/**']);
  });
});
