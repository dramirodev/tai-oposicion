import { expect, it } from 'vitest';
import { escapeHtml, formatTime, percentage } from '../../src/shared/presentation/format.js';
import { richHtml } from '../../src/shared/presentation/study-text.js';

it('escapa contenido HTML y mantiene los formatos heredados', () => {
  expect(escapeHtml(`<a title="it's">&</a>`)).toBe('&lt;a title=&quot;it&#39;s&quot;&gt;&amp;&lt;/a&gt;');
  expect(formatTime(65)).toBe('1:05');
  expect(formatTime(3725)).toBe('1:02:05');
  expect(formatTime(-5)).toBe('0:00');
  expect(percentage(1, 3)).toBe(33);
  expect(percentage(2, 0)).toBe(0);
});

it('escapa el texto y conserva el resaltado de HTML rico', () => {
  expect(richHtml('<img src=x onerror="a">')).toContain('&lt;img src=x onerror=&quot;a&quot;&gt;');
  expect(richHtml('SELECT a FROM t', true)).toContain('<code class="cd">');
});
