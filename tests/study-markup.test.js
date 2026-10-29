import { expect, it, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { StudyMarkup } from '../src/shared/ui/StudyMarkup.js';
import { inferCodeLanguage, normalizeCodeLanguage } from '../src/shared/ui/study-code-language.js';
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

it('respeta los lenguajes declarados en el marcado y normaliza sus alias', async () => {
  const { container } = render(React.createElement(StudyMarkup, {
    html: '<p><code class="language-js">const valor = 1;</code></p><pre><code lang="yml">clave: valor</code></pre>',
  }));

  await vi.waitFor(() => expect(container.querySelectorAll('code.shiki .shiki-token').length).toBeGreaterThan(0), { timeout: 10000 });
  expect(container.querySelector('code.language-js')).toHaveAttribute('data-shiki-language', 'javascript');
  expect(container.querySelector('pre code')).toHaveAttribute('data-shiki-language', 'yaml');
});

it('usa el contexto de la pregunta para resaltar una opción JSON malformada del banco real', async () => {
  const questions = JSON.parse(readFileSync('public/data/T3.08.json', 'utf8'));
  const question = questions.find(({ i }) => i === 'AS04-P1-R-04');
  expect(question).toBeDefined();
  const option = question.a[3];
  const { container } = render(React.createElement(StudyMarkup, {
    html: richHtml(option),
    languageContext: question.q,
  }));

  await vi.waitFor(() => expect(container.querySelector('code.shiki[data-shiki-language="json"] .shiki-token')).toBeInTheDocument(), { timeout: 10000 });
  expect(container.querySelector('code')?.textContent).toBe(option);
});

it.each([
  ['{"menu": { "id": "file", "popup": { "menuitem": [ {"value": "Open"} ]} ]}', 'json'],
  ['<xs:complexType><xs:element name="item" /></xs:complexType>', 'xml'],
  ['@Test void testException() { assertThrows(Exception.class, action); }', 'java'],
  ['printf("%d", valor);', 'c'],
  ['firewall-cmd --permanent --zone=public --add-rich-rule=rule', 'bash'],
  ['DROP TABLE usuarios;', 'sql'],
  ['fn main() { println!("hola"); }', 'text'],
])('clasifica conservadoramente fragmentos %s como %s', (code, language) => {
  expect(inferCodeLanguage(code)).toBe(language);
});

it('usa una mención inequívoca del lenguaje en el contexto cuando el fragmento no basta', () => {
  expect(inferCodeLanguage('{ "menu", "id" }', undefined, 'Indique cuál de estos contenidos pertenece a JSON válido')).toBe('json');
  expect(inferCodeLanguage('{ "menu", "id" }', 'java', 'Indique cuál pertenece a JSON')).toBe('java');
  expect(inferCodeLanguage('@Firma', undefined, 'Esta pregunta se resuelve usando Java')).toBe('text');
});

it('distingue JavaScript de los falsos indicios de Java y C#', () => {
  expect(inferCodeLanguage('const longitud = texto.length;', undefined, 'Código JavaScript')).toBe('javascript');
  expect(inferCodeLanguage('const resultado = condicion ? cierto : falso;', undefined, 'Código JavaScript')).toBe('javascript');
});

it('reconoce JSX y TSX antes de clasificar sus etiquetas como HTML', () => {
  expect(inferCodeLanguage('const vista = <MiComponente valor={actual} />;', undefined, 'Componente React con JSX')).toBe('jsx');
  expect(inferCodeLanguage('const vista = <MiComponente valor={actual} />;', undefined, 'Componente React con TypeScript y TSX')).toBe('tsx');
  expect(inferCodeLanguage('<div class="contenido">Texto</div>')).toBe('html');
});

it('normaliza las etiquetas de texto plano que admite Shiki', () => {
  expect(normalizeCodeLanguage('plain')).toBe('text');
  expect(normalizeCodeLanguage('plaintext')).toBe('text');
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
    heading: 'Explicación', editorialLabel: 'Revisada', language: 'Java', snippet: 'int valor = 1;',
    resultLabel: 'Resultado esperado', resultValue: '0',
    steps: [{ title: 'Condición', explanation: 'System.out.println(i); se ejecuta después.' }],
    distractors: [{ optionIndex: 0, explanation: 'El bucle no llega a ejecutar System.out.println(i).' }],
    limitation: 'Análisis del fragmento Java.', sources: [],
  });
  const { container } = render(React.createElement(StudyMarkup, { html: markup }));
  await vi.waitFor(() => expect(container.querySelectorAll('code.shiki[data-shiki-language="java"]')).toHaveLength(3), { timeout: 10000 });
  expect(container.querySelector('.code-sample code')?.textContent).toBe('int valor = 1;');
  expect(container.querySelector('ol li p code')?.textContent).toBe('System.out.println(i);');
});
