import { claveSpans } from '../../shared/presentation/study-text.js';
import type { ReadingToken } from '../../shared/ui/study-services.js';

export function readingTokens(statement: string): ReadingToken[] {
  const keySpans = claveSpans(statement);
  let position = 0;
  return statement.split(/(\s+)/).map(text => {
    const start = position;
    position += text.length;
    return { text, key: !!text.trim() && keySpans.some(([from, to]) => start < to && position > from) };
  });
}

export function mixReadingIds(groups: readonly (readonly [readonly string[], number])[], rest: readonly string[], count = 40, recent = new Set<string>(), randomize: (items: readonly string[]) => string[] = items => [...items]): string[] {
  const prioritizeRecentLast = (ids: readonly string[]) => [
    ...randomize(ids.filter(id => !recent.has(String(id)))),
    ...randomize(ids.filter(id => recent.has(String(id)))),
  ];
  const prioritized = groups.flatMap(([ids, take]) => prioritizeRecentLast(ids).slice(0, take));
  const alreadySelected = new Set(prioritized);
  return [...prioritized, ...prioritizeRecentLast(rest).filter(id => !alreadySelected.has(id)).slice(0, Math.max(0, count - prioritized.length))];
}
