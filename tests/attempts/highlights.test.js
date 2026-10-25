import { describe, expect, it } from 'vitest';
import { createHighlight, questionContentRevision, resolveHighlight } from '../../src/core/domain/attempts/highlights.ts';

const input = (overrides = {}) => ({
  id: 'mark-1', field: 'statement', sourceText: 'El plazo será de veinte días hábiles.',
  start: 17, end: 23, category: 'key', contentRevision: 'r1', createdAt: 100,
  timing: 'before-answer', ...overrides,
});

describe('text highlight anchors', () => {
  it('stores exact selected text and its surrounding context', () => {
    expect(createHighlight(input())).toEqual({
      ok: true,
      value: {
        id: 'mark-1', field: 'statement', start: 17, end: 23, text: 'veinte',
        before: 'El plazo será de ', after: ' días hábiles.', category: 'key',
        contentRevision: 'r1', createdAt: 100, timing: 'before-answer',
      },
    });
  });

  it('rejects invalid ranges instead of inventing an anchor', () => {
    expect(createHighlight(input({ start: -1 }))).toMatchObject({ ok: false });
    expect(createHighlight(input({ start: 2, end: 3 }))).toMatchObject({ ok: false });
    expect(createHighlight(input({ end: 99 }))).toMatchObject({ ok: false });
  });

  it('resolves unchanged text and a unique contextual move after a content revision', () => {
    const mark = createHighlight(input());
    expect(mark.ok && resolveHighlight(mark.value, input().sourceText, 'r1')).toMatchObject({ stale: false, start: 17, end: 23 });
    expect(mark.ok && resolveHighlight(mark.value, `Dato. ${input().sourceText}`, 'r2'))
      .toMatchObject({ stale: false, start: 23, end: 29 });
  });

  it('marks ambiguous or context-changed anchors stale', () => {
    const mark = createHighlight(input());
    expect(mark.ok && resolveHighlight(mark.value, 'veinte días. Otro plazo: veinte horas.', 'r2')).toMatchObject({ stale: true });
    expect(mark.ok && resolveHighlight(mark.value, 'El plazo será de treinta días hábiles.', 'r2')).toMatchObject({ stale: true });
  });

  it('fingerprints a question from its text and options deterministically', () => {
    const revision = questionContentRevision('Enunciado', ['A', 'B']);
    expect(questionContentRevision('Enunciado', ['A', 'B'])).toBe(revision);
    expect(questionContentRevision('Enunciado', ['A', 'C'])).not.toBe(revision);
  });
});
