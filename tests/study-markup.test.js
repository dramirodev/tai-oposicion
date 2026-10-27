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

it('resalta código inline real en enunciados y opciones de respuesta', async () => {
  const question = 'Se ejecuta chmod 640 fichero.txt.';
  const option = 'chmod 764 fichero.txt';
  const { container } = render(React.createElement(StudyMarkup, {
    html: `<p class="question">${question.replace('chmod 640 fichero.txt', '<code class="cd">chmod 640 fichero.txt</code>')}</p><button><span class="answer"><code class="cd">${option}</code></span></button>`,
  }));

  await vi.waitFor(() => expect(container.querySelectorAll('code.cd.shiki .shiki-token').length).toBeGreaterThanOrEqual(2), { timeout: 10000 });
  expect(container.querySelector('.question code')?.textContent).toBe('chmod 640 fichero.txt');
  expect(container.querySelector('.answer code')?.textContent).toBe(option);
  expect(container.querySelectorAll('code.cd.shiki').length).toBe(2);
});
