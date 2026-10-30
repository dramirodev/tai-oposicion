import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { codeExplanationPresenter } from '../../../src/shared/presentation/code-explanation.js';
import { CodeExplanationView } from '../../../src/shared/ui/CodeExplanationView.js';

const entity = {
  questionId: 'Q-1', contentRevision: 'rev-1', language: 'Java', editorialStatus: 'draft',
  snippet: '<script>alert(1)</script>', result: { kind: 'output', value: '<img src=x onerror=alert(1)>' },
  steps: [{ title: 'Paso 1', explanation: '<b>dato</b>' }], distractors: [], limitation: 'No se ejecuta.',
  editorialNote: 'Revisión humana pendiente.', sources: [{ title: 'JLS', url: 'https://docs.oracle.com/spec' }],
};

describe('explicación de código como vista React', () => {
  it('marks AI drafted content as pending editorial review', () => {
    const vm = codeExplanationPresenter.toViewModel(entity);
    expect(vm).toMatchObject({ editorialLabel: 'Borrador', editorialNote: 'Revisión humana pendiente.' });
  });

  it('renders untrusted code and editorial text as text with accessible structure', () => {
    const { container } = render(React.createElement(CodeExplanationView, { explanation: entity }));
    expect(container.querySelector('section[aria-labelledby] h3')).toHaveTextContent('Explicación del código');
    expect(container.querySelector('pre.code-sample')).toHaveTextContent('<script>alert(1)</script>');
    expect(container.querySelector('pre.code-result')).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container.querySelector('script, img')).toBeNull();
    expect(container.querySelector('a[href="https://docs.oracle.com/spec"]')).toHaveTextContent('JLS');
  });
});
