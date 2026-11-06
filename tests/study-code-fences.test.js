import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { richHtml } from '../src/shared/presentation/study-text.js';

it('preserva exactamente el bloque Java real y separa enunciado de código', () => {
  const question = JSON.parse(readFileSync('public/data/T3.06.json','utf8')).find(q => q.i === 'AT306-P1-40');
  const source = question.q.split('```java\n')[1].split('```')[0];
  const dom = new DOMParser().parseFromString(richHtml(question.q),'text/html');
  const code = dom.querySelector('pre > code');
  expect(code.textContent).toBe(source);
  expect(code.classList.contains('blk')).toBe(true);
  expect(code.dataset.language).toBe('java');
  expect(dom.body.textContent).toContain('Ejecutado dentro de un método Java');
  expect(dom.body.textContent).not.toContain('```');
  expect(code.textContent).toContain('boolean fin=false;');
});

it('escapa HTML dentro de bloques y mantiene la prosa y dos lenguajes separados', () => {
  const text = 'Antes NO\n```html\n<script>alert(1)</script>\n```\nEntre\n```sql\nSELECT * FROM t;\n```\nDespués';
  const dom = new DOMParser().parseFromString(richHtml(text,true),'text/html');
  const code = [...dom.querySelectorAll('pre > code')];
  expect(code.map(item => item.dataset.language)).toEqual(['html','sql']);
  expect(code[0].textContent).toBe('<script>alert(1)</script>\n');
  expect(dom.querySelector('script')).toBeNull();
  expect(dom.body.textContent).toContain('Entre');
  expect(dom.body.textContent).toContain('Después');
  expect(dom.querySelector('mark.kw').textContent).toBe('NO');
});

it('un delimitador incompleto conserva todo el texto mediante el formateador existente', () => {
  const text = 'Enunciado\n```java\nboolean fin=false;';
  const dom = new DOMParser().parseFromString(richHtml(text),'text/html');
  expect(dom.body.textContent).toBe(text);
  expect(dom.querySelector('pre')).toBeNull();
});
