import { describe, expect, it } from 'vitest';
import { findAddedCoverage, findAddedIgnores, readIgnoreList, chooseBaselineRef } from '../scripts/lint-ignore-growth.mjs';

describe('lint ignore growth guard', () => {
  it('finds only exclusions added after the baseline', () => {
    expect(findAddedIgnores(['old.ts', 'new.ts'], ['old.ts'])).toEqual(['new.ts']);
  });

  it('allows a narrower pattern when it excludes fewer files', () => {
    expect(findAddedCoverage(['src/adapters/legacy/types.ts'], ['src/adapters/legacy/**'], [
      'src/adapters/legacy/types.ts', 'src/adapters/legacy/access.ts',
    ])).toEqual([]);
  });

  it('finds files newly covered by a broader ignore pattern', () => {
    expect(findAddedCoverage(['src/**'], ['src/adapters/legacy/**'], [
      'src/adapters/legacy/types.ts', 'src/app/main.tsx',
    ])).toEqual(['src/app/main.tsx']);
  });

  it('reads ignore entries from the flat config block', () => {
    expect(readIgnoreList("export default [{ ignores: ['dist/**', 'src/legacy/**'] }];"))
      .toEqual(['dist/**', 'src/legacy/**']);
  });

  it('uses the nearest parent that contains the baseline config after a merge commit', () => {
    expect(chooseBaselineRef(['HEAD^', 'HEAD^2', 'HEAD~2'], ref => ref === 'HEAD^2')).toBe('HEAD^2');
  });
});
