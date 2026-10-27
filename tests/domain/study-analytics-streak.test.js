import { describe, expect, it } from 'vitest';
import { calculateStudyStreak } from '../../src/core/domain/study-analytics.js';

const localDay = (year, month, day) => new Date(year, month, day, 12).getTime();

describe('calculateStudyStreak', () => {
  it('counts consecutive local days through today', () => {
    expect(calculateStudyStreak([localDay(2026, 9, 25), localDay(2026, 9, 26), localDay(2026, 9, 27)], localDay(2026, 9, 27))).toBe(3);
  });

  it('keeps yesterday as the streak when the user has not studied today yet', () => {
    expect(calculateStudyStreak([localDay(2026, 9, 25), localDay(2026, 9, 26)], localDay(2026, 9, 27))).toBe(2);
  });

  it('stops at the first missed day and returns zero when no recent day was studied', () => {
    expect(calculateStudyStreak([localDay(2026, 9, 24)], localDay(2026, 9, 27))).toBe(0);
    expect(calculateStudyStreak([], localDay(2026, 9, 27))).toBe(0);
  });
});
