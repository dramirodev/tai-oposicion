export { questionNotice, sourceHtml } from './study-content.js';
export interface FailureFilterItem<T> {
  value: T;
  id: string;
  topic: string;
  reviewed: boolean;
  streak: number;
  searchableText: string;
}
export interface FailureFilters { q: string; t: string; review: string; streak: string }

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterFailures<T>(items: readonly FailureFilterItem<T>[], filters: FailureFilters): T[] {
  const text = fold(filters.q).trim();
  return items
    .filter((item) => (!filters.t || item.topic === filters.t)
      && (!filters.review || (filters.review === 'reviewed' ? item.reviewed : !item.reviewed))
      && (!filters.streak || item.streak === +filters.streak)
      && (!text || fold(item.searchableText).includes(text)))
    .map((item) => item.value);
}
