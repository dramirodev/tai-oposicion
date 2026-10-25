export interface TextAnchor {
  field: 'statement' | `option:${number}`;
  sourceText: string;
  start: number;
  end: number;
}

export function canonicalText(root: Element): string {
  return textSpans(root).text;
}

interface TextNodeSpan {
  node: Text;
  start: number;
  end: number;
}

function textSpans(root: Element): { text: string; spans: TextNodeSpan[] } {
  const spans: TextNodeSpan[] = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent || '';
      spans.push({ node: node as Text, start: text.length, end: text.length + value.length });
      text += value;
    } else if ((node as Element).tagName === 'BR') text += '\n';
    node = walker.nextNode();
  }
  return { text, spans };
}

function offsetForPoint(root: Element, target: Node, targetOffset: number): number | null {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node === target) {
      if (node.nodeType === Node.TEXT_NODE) return offset + Math.min(targetOffset, node.textContent?.length || 0);
      const children = [...node.childNodes];
      return offset + children.slice(0, targetOffset).reduce((length, child) => length + canonicalLength(child), 0);
    }
    if (node.nodeType === Node.TEXT_NODE) offset += node.textContent?.length || 0;
    else if ((node as Element).tagName === 'BR') offset++;
    node = walker.nextNode();
  }
  return null;
}

function canonicalLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length || 0;
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  const element = node as Element;
  if (element.tagName === 'BR') return 1;
  return [...element.childNodes].reduce((length, child) => length + canonicalLength(child), 0);
}

export function selectedTextAnchor(host: Element): TextAnchor | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return null;
  const roots = [
    ...host.querySelectorAll<HTMLElement>('.enun'),
    ...host.querySelectorAll<HTMLElement>('.opt[data-i] .pre'),
  ];
  for (const root of roots) {
    if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) continue;
    const range = selection.getRangeAt(0);
    const start = offsetForPoint(root, range.startContainer, range.startOffset);
    const end = offsetForPoint(root, range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start) return null;
    const { text } = textSpans(root);
    const option = root.closest<HTMLElement>('.opt[data-i]');
    const optionIndex = option ? Number(option.dataset.i) : NaN;
    if (option && !Number.isInteger(optionIndex)) return null;
    const field: TextAnchor['field'] = option ? `option:${optionIndex}` : 'statement';
    return { field, sourceText: text, start, end };
  }
  return null;
}

export function paintTextHighlight(
  root: Element,
  start: number,
  end: number,
  category: 'key' | 'doubt',
  id: string,
  stale = false,
): boolean {
  const { text, spans } = textSpans(root);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return false;
  let painted = false;
  for (const span of [...spans].reverse()) {
    const from = Math.max(start, span.start), to = Math.min(end, span.end);
    if (to <= from) continue;
    const localStart = from - span.start, localEnd = to - span.start;
    const tail = span.node.splitText(localEnd);
    const selected = span.node.splitText(localStart);
    const mark = document.createElement('mark');
    mark.className = 'text-highlight';
    mark.dataset.markId = id;
    mark.dataset.category = category;
    if (stale) mark.dataset.stale = 'true';
    selected.parentNode?.insertBefore(mark, selected);
    mark.append(selected);
    void tail;
    painted = true;
  }
  return painted;
}
