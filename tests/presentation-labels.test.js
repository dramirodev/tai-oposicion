import { describe, expect, it } from 'vitest';
import {
  ERROR_REPORT_REASONS,
  FAILURE_REASONS,
  READING_TIPS,
  UI_THEMES,
  UI_ZOOMS,
} from '../src/shared/presentation/study-labels.ts';
import { normalizeUiPreferences } from '../src/shared/presentation/ui-preferences.ts';

describe('study presentation labels', () => {
  it('normalizes saved presentation settings against shared labels', () => {
    expect(ERROR_REPORT_REASONS.length).toBeGreaterThan(3);
    expect(FAILURE_REASONS).toContain('No lo sabía');
    expect(READING_TIPS.length).toBeGreaterThan(3);
    expect(UI_THEMES).toContain('dark');
    expect(UI_ZOOMS).toHaveLength(4);
    expect(normalizeUiPreferences(null)).toEqual({ theme: 'auto', size: 0, lectura: 0 });
  });
});
