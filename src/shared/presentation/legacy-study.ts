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

export function questionNotice(question: NoticeQuestion): string {
  if (!question.n && question.np !== 1) return '';
  return `<aside class="question-notice ${question.np === 1 ? 'warning' : ''}" aria-label="Advertencia de la pregunta"><b>${question.np === 1 ? 'Solo estudio · no puntuable' : 'Nota de la pregunta'}</b>${question.n ? `<p>${escapeHtml(question.n)}</p>` : '<p>Se conserva para estudiar; está excluida de los simulacros puntuables.</p>'}</aside>`;
}

export function sourceHtml(
  question: SourceQuestion,
  verifiedSources: Readonly<Record<string, QuestionSource>> = {},
): string {
  const source = question.source || (question.i ? verifiedSources[question.i] : undefined);
  if (source?.verified) {
    try {
      const url = new URL(source.url);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        const page = Number.isInteger(source.page) && source.page! > 0 ? ` · página ${source.page}` : '';
        return `<a class="source-link" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">Abrir fuente: ${escapeHtml(source.title || 'referencia verificada')}${page}<span class="sr"> (se abre en otra pestaña)</span></a>`;
      }
    } catch {}
  }
  return question.u ? '<p class="source-status">Cita del temario disponible, sin enlace verificado al PDF.</p>' : '';
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
