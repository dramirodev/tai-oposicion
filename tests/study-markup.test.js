import { expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StudyMarkup } from '../src/shared/ui/StudyMarkup.js';

it('conserva la estructura y etiquetas accesibles de la explicación de código', async () => {
  const { container } = render(React.createElement(StudyMarkup, { html: '<section class="card code-explanation" aria-labelledby="explanation-title"><h3 id="explanation-title">Explicación</h3><pre class="code-sample" tabindex="0"><code>int valor = 1;</code></pre><ol><li><p>Paso uno</p></li></ol></section>' }));
  expect(container.querySelector('section.code-explanation[aria-labelledby="explanation-title"]')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Explicación' })).toBeInTheDocument();
  expect(container.querySelector('pre.code-sample')).toHaveAttribute('tabindex', '0');
  expect(screen.getByText('Paso uno')).toBeInTheDocument();
});

it('resalta bloques largos de código sin sustituir su contenido', async () => {
  const { container } = render(React.createElement(StudyMarkup, { html: '<code class="cd blk">SELECT nombre FROM usuarios;</code>' }));
  await vi.waitFor(() => expect(container.querySelector('code.shiki .shiki-token')).toBeInTheDocument(), { timeout: 10000 });
  expect(container.querySelector('code').textContent).toContain('SELECT nombre FROM usuarios;');
});
