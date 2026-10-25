import { escapeHtml } from './format.ts';

interface QuestionSource { url: string; title?: string; page?: number; verified: boolean }
interface NoticeQuestion { n?: string; np?: number }
interface SourceQuestion { source?: QuestionSource; i?: string; u?: string }
export interface FailureFilterItem<T> {
  value: T;
  id: string;
  topic: string;
  reviewed: boolean;
  streak: number;
  searchableText: string;
}
export interface FailureFilters { q: string; t: string; review: string; streak: string }

export function questionNotice(q: NoticeQuestion): string {
  if (!q.n && q.np !== 1) return '';
  return `<aside class="question-notice ${q.np === 1 ? 'warning' : ''}" aria-label="Advertencia de la pregunta"><b>${q.np === 1 ? 'Solo estudio · no puntuable' : 'Nota de la pregunta'}</b>${q.n ? `<p>${escapeHtml(q.n)}</p>` : '<p>Se conserva para estudiar; está excluida de los simulacros puntuables.</p>'}</aside>`;
}

export function sourceHtml(
  q: SourceQuestion,
  verifiedSources: Readonly<Record<string, QuestionSource>> = {},
): string {
  const source = q.source || (q.i ? verifiedSources[q.i] : undefined);
  if (source?.verified) {
    try {
      const url = new URL(source.url);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        const page = Number.isInteger(source.page) && source.page! > 0 ? ` · página ${source.page}` : '';
        return `<a class="source-link" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">Abrir fuente: ${escapeHtml(source.title || 'referencia verificada')}${page}<span class="sr"> (se abre en otra pestaña)</span></a>`;
      }
    } catch {}
  }
  return q.u ? '<p class="source-status">Cita del temario disponible, sin enlace verificado al PDF.</p>' : '';
}

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
