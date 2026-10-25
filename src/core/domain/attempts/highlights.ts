import type { Highlight, HighlightCategory } from './transitions.js';

export interface CreateHighlightInput {
  id: string;
  field: Highlight['field'];
  sourceText: string;
  start: number;
  end: number;
  category: HighlightCategory;
  contentRevision: string;
  createdAt: number;
  timing: Highlight['timing'];
}

export type HighlightResult = { ok: true; value: Highlight } | { ok: false; reason: string };

export interface ResolvedHighlight {
  start: number;
  end: number;
  stale: boolean;
}

export function questionContentRevision(statement: string, options: readonly string[]): string {
  const content = `${statement}\u0000${options.join('\u0000')}`;
  let hash = 2166136261;
  for (let index = 0; index < content.length; index++) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

const CONTEXT_LENGTH = 32;
const CONTEXT_CHECK = 12;

export function createHighlight(input: CreateHighlightInput): HighlightResult {
  if (!input.id || !Number.isInteger(input.start) || !Number.isInteger(input.end)
    || input.start < 0 || input.end <= input.start || input.end > input.sourceText.length) {
    return { ok: false, reason: 'invalid-range' };
  }
  if (!input.contentRevision || !Number.isFinite(input.createdAt)) return { ok: false, reason: 'invalid-metadata' };
  const text = input.sourceText.slice(input.start, input.end);
  if (!text.trim()) return { ok: false, reason: 'empty-selection' };
  return {
    ok: true,
    value: {
      id: input.id,
      field: input.field,
      start: input.start,
      end: input.end,
      text,
      before: input.sourceText.slice(Math.max(0, input.start - CONTEXT_LENGTH), input.start),
      after: input.sourceText.slice(input.end, input.end + CONTEXT_LENGTH),
      category: input.category,
      contentRevision: input.contentRevision,
      createdAt: input.createdAt,
      timing: input.timing,
    },
  };
}

function occurrences(source: string, text: string): number[] {
  const positions: number[] = [];
  let from = 0;
  while (from <= source.length - text.length) {
    const at = source.indexOf(text, from);
    if (at < 0) break;
    positions.push(at);
    from = at + 1;
  }
  return positions;
}

export function resolveHighlight(highlight: Highlight, sourceText: string, contentRevision: string): ResolvedHighlight {
  const samePosition = sourceText.slice(highlight.start, highlight.end) === highlight.text;
  if (contentRevision === highlight.contentRevision && samePosition) {
    return { start: highlight.start, end: highlight.end, stale: false };
  }
  if (samePosition) return { start: highlight.start, end: highlight.end, stale: false };

  const matches = occurrences(sourceText, highlight.text);
  if (matches.length === 1) {
    const start = matches[0];
    const before = sourceText.slice(Math.max(0, start - CONTEXT_CHECK), start);
    const after = sourceText.slice(start + highlight.text.length, start + highlight.text.length + CONTEXT_CHECK);
    const expectedBefore = highlight.before.slice(-CONTEXT_CHECK);
    const expectedAfter = highlight.after.slice(0, CONTEXT_CHECK);
    const beforeMatches = !expectedBefore || before.endsWith(expectedBefore);
    const afterMatches = !expectedAfter || after.startsWith(expectedAfter);
    if (beforeMatches && afterMatches) {
      return { start, end: start + highlight.text.length, stale: false };
    }
  }
  return { start: highlight.start, end: highlight.end, stale: true };
}
