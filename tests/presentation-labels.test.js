import { describe, expect, it } from 'vitest';
import {
  ERROR_REPORT_REASONS,
  FAILURE_REASONS,
  READING_TIPS,
  UI_THEMES,
  UI_ZOOMS,
} from '../src/shared/presentation/study-labels.ts';
import { MOTIVOS, MOTIVOS_FALLO, CONSEJOS_LECTURA, TEMAS_UI, ZOOMS } from '../src/legacy/logic.ts';

describe('study presentation labels', () => {
  it('keeps the legacy labels as aliases of the shared presentation values', () => {
    expect(MOTIVOS).toEqual(ERROR_REPORT_REASONS);
    expect(MOTIVOS_FALLO).toEqual(FAILURE_REASONS);
    expect(CONSEJOS_LECTURA).toEqual(READING_TIPS);
    expect(TEMAS_UI).toEqual(UI_THEMES);
    expect(ZOOMS).toEqual(UI_ZOOMS);
  });
});
