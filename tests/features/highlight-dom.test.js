import { beforeEach, describe, expect, it } from 'vitest';
import { canonicalText, paintTextHighlight, selectedTextAnchor } from '../../src/shared/ui/text-highlights.ts';

describe('highlight DOM mapping', () => {
  beforeEach(() => { document.body.innerHTML = '<main id="host"><div class="enun">ABCDE <code>FGHI</code><br>JKLM</div><button class="opt" data-i="2"><span class="pre">Opción útil</span></button></main>'; });

  it('maps a selection across formatted text into canonical offsets', () => {
    const host = document.querySelector('#host');
    const first = document.querySelector('.enun').firstChild;
    const code = document.querySelector('.enun code').firstChild;
    const range = document.createRange();
    range.setStart(first, 3); range.setEnd(code, 2);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    expect(selectedTextAnchor(host)).toMatchObject({
      field: 'statement', sourceText: 'ABCDE FGHI\nJKLM', start: 3, end: 8,
    });
  });

  it('maps option identity and wraps selected offsets without losing text', () => {
    const host = document.querySelector('#host'), optionText = document.querySelector('.opt .pre').firstChild;
    const range = document.createRange(); range.setStart(optionText, 7); range.setEnd(optionText, 11);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    expect(selectedTextAnchor(host)).toMatchObject({ field: 'option:2', start: 7, end: 11, sourceText: 'Opción útil' });
    const root = document.querySelector('.opt .pre');
    expect(paintTextHighlight(root, 7, 11, 'key', 'id-1')).toBe(true);
    expect(root.textContent).toBe('Opción útil');
    expect(root.querySelector('mark[data-mark-id="id-1"]').textContent).toBe('útil');
  });

  it('keeps canonical text when overlapping marks cross inline formatting', () => {
    const root = document.querySelector('.enun');
    expect(paintTextHighlight(root, 3, 9, 'key', 'first')).toBe(true);
    expect(root.querySelectorAll('mark[data-mark-id="first"]')).toHaveLength(1);
    expect(paintTextHighlight(root, 6, 12, 'doubt', 'second')).toBe(true);
    expect(canonicalText(root)).toBe('ABCDE FGHI\nJKLM');
    expect(root.querySelectorAll('br')).toHaveLength(1);
    expect(root.querySelector('[data-mark-id="first"]')).not.toBeNull();
    expect(root.querySelector('[data-mark-id="second"]')).not.toBeNull();
  });

  it('does not wrap a saved highlight twice when the same snapshot is rendered again', () => {
    const root = document.querySelector('.enun');
    expect(paintTextHighlight(root, 1, 4, 'key', 'saved-mark')).toBe(true);
    expect(paintTextHighlight(root, 1, 4, 'key', 'saved-mark')).toBe(true);
    expect(root.querySelectorAll('mark[data-mark-id="saved-mark"]')).toHaveLength(1);
    expect(canonicalText(root)).toBe('ABCDE FGHI\nJKLM');
  });
});
