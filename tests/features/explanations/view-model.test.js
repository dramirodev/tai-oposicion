import { describe, expect, it } from 'vitest';
import { explanationMapper } from '../../../src/features/explanations/explanation-mapper.js';
import { renderCodeExplanation } from '../../../src/features/explanations/legacy-view.js';

const entity = {
  questionId: 'Q-1', contentRevision: 'rev-1', language: 'Java', editorialStatus: 'draft',
  snippet: '<script>alert(1)</script>', result: { kind: 'output', value: '<img src=x onerror=alert(1)>' },
  steps: [{ title: 'Paso 1', explanation: '<b>dato</b>' }], distractors: [], limitation: 'No se ejecuta.',
  editorialNote: 'Revisión humana pendiente.', sources: [{ title: 'JLS', url: 'https://docs.oracle.com/spec' }],
};

describe('explicación de código para el puente legado', () => {
  it('marks AI drafted content as pending editorial review', () => {
    const vm = explanationMapper.toViewModel(entity);
    expect(vm).toMatchObject({ editorialLabel: 'Borrador', editorialNote: 'Revisión humana pendiente.' });
  });

  it('escapes code, output, notes and titles when producing accessible markup', () => {
    const markup = renderCodeExplanation(explanationMapper.toViewModel(entity));
    expect(markup).toContain('aria-labelledby');
    expect(markup).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(markup).not.toContain('<script>');
    expect(markup).not.toContain('<img src=x');
  });
});
