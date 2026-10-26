import { afterEach, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StudyMarkup } from '../src/shared/ui/StudyMarkup.js';

let root;
let host;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove(); root = undefined; host = undefined;
});

it('conserva la estructura y etiquetas accesibles de la explicación de código', async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(React.createElement(StudyMarkup, { html: '<section class="card code-explanation" aria-labelledby="explanation-title"><h3 id="explanation-title">Explicación</h3><pre class="code-sample" tabindex="0"><code>int valor = 1;</code></pre><ol><li><p>Paso uno</p></li></ol></section>' })));
  expect(host.querySelector('section.code-explanation[aria-labelledby="explanation-title"]')).not.toBeNull();
  expect(host.querySelector('h3#explanation-title')?.textContent).toBe('Explicación');
  expect(host.querySelector('pre.code-sample')?.tabIndex).toBe(0);
  expect(host.querySelector('ol > li p')?.textContent).toBe('Paso uno');
});

it('resalta bloques largos de código sin sustituir su contenido', async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(React.createElement(StudyMarkup, { html: '<code class="cd blk">SELECT nombre FROM usuarios;</code>' })));
  await vi.waitFor(() => expect(host.querySelector('code.shiki .shiki-token')).not.toBeNull(), { timeout: 10000 });
  expect(host.querySelector('code')?.textContent).toContain('SELECT nombre FROM usuarios;');
});
