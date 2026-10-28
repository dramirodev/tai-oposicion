import { expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StudyMarkup } from '../src/shared/ui/StudyMarkup.js';
import { inferCodeLanguage } from '../src/shared/ui/study-code-language.js';
import { richHtml } from '../src/shared/presentation/study-text.js';
import { renderCodeExplanation } from '../src/features/explanations/legacy-view.js';

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
  expect(container.querySelector('code')).toHaveAttribute('data-shiki-language', 'sql');
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

it.each([
  ['System.out.println(i);', 'java'],
  ['static int main(String[] args)', 'java'],
  ['print("Python")', 'python'],
  ['int? Telefono', 'csharp'],
  ['Console.WriteLine("Hola")', 'csharp'],
  ['std::cout << valor;', 'cpp'],
  ['<?php echo $nombre; ?>', 'php'],
  ['xmlns:xs="http://www.w3.org/2001/XMLSchema"', 'xml'],
  ['#include <stdio.h>\nint main(void)', 'c'],
  ['Cl@ve permanente', 'text'],
  ['@firma es el servicio de validación', 'text'],
])('elige el resaltador %s como %s', (code, language) => {
  expect(inferCodeLanguage(code)).toBe(language);
});

it('no resalta como código el nombre Cl@ve ni partes de una URL de cita', () => {
  expect(new DOMParser().parseFromString(richHtml('Cl@ve y @firma'), 'text/html').querySelectorAll('code.cd')).toHaveLength(0);
  expect(new DOMParser().parseFromString(richHtml('Fuente: https://boe.es/buscar/doc.php?id=BOE-A-2013-12887#a14'), 'text/html').querySelectorAll('code.cd')).toHaveLength(0);
});

it('resalta el código también dentro de los pasos y explicaciones', async () => {
  const markup = renderCodeExplanation({
    heading: 'Explicación', editorialLabel: 'Revisada', language: 'Java', snippet: 'int i = 0;\nSystem.out.println(i);',
    resultLabel: 'Resultado esperado', resultValue: '0',
    steps: [{ title: 'Condición', explanation: 'System.out.println(i); se ejecuta después.' }],
    distractors: [{ optionIndex: 0, explanation: 'El bucle no llega a ejecutar System.out.println(i).' }],
    limitation: 'Análisis del fragmento Java.', sources: [],
  });
  const { container } = render(React.createElement(StudyMarkup, { html: markup }));
  await vi.waitFor(() => expect(container.querySelectorAll('code.shiki[data-shiki-language="java"]')).toHaveLength(3), { timeout: 10000 });
  expect(container.querySelector('.code-sample code')?.textContent).toBe('int i = 0;\nSystem.out.println(i);');
  expect(container.querySelector('ol li p code')?.textContent).toBe('System.out.println(i);');
});
