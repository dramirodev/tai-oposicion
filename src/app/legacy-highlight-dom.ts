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

function pointBefore(node: Node): { node: Node; offset: number } | null {
  const parent = node.parentNode;
  if (!parent) return null;
  return { node: parent, offset: [...parent.childNodes].findIndex(child => child.isSameNode(node)) };
}

function pointAfter(node: Node): { node: Node; offset: number } | null {
  const previous = pointBefore(node);
  return previous ? { node: previous.node, offset: previous.offset + 1 } : null;
}

function pointAtOffset(root: Element, target: number, preferPrevious: boolean): { node: Node; offset: number } | null {
  let currentOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      const endOffset = currentOffset + textLength;
      const isInsideText = preferPrevious
        ? target > currentOffset && target <= endOffset
        : target >= currentOffset && target < endOffset;
      if (isInsideText) return { node, offset: target - currentOffset };
      currentOffset = endOffset;
    } else if ((node as Element).tagName === 'BR') {
      if (target === currentOffset) return pointBefore(node);
      if (target === currentOffset + 1) return pointAfter(node);
      currentOffset++;
    }
    node = walker.nextNode();
  }
  return target === currentOffset ? { node: root, offset: root.childNodes.length } : null;
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
  const { text } = textSpans(root);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return false;
  const startPoint = pointAtOffset(root, start, false);
  const endPoint = pointAtOffset(root, end, true);
  if (!startPoint || !endPoint) return false;

  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  if (range.collapsed) return false;

  const mark = document.createElement('mark');
  mark.className = 'text-highlight';
  mark.dataset.markId = id;
  mark.dataset.category = category;
  if (stale) mark.dataset.stale = 'true';
  mark.append(range.extractContents());
  range.insertNode(mark);
  return true;
}
