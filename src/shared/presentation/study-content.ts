import { escapeHtml } from './format.js';
import { missingVisualQuestionIds } from './missing-visual-resources.js';

interface QuestionSource { url: string; title?: string; page?: number; verified: boolean }
interface NoticeQuestion { i?: string; id?: string; n?: string; np?: number }
interface SourceQuestion { source?: QuestionSource; i?: string; u?: string }

export function questionNotice(question: NoticeQuestion): string {
  const hasMissingVisual = missingVisualQuestionIds.has(question.i || question.id || '');
  if (!question.n && question.np !== 1 && !hasMissingVisual) return '';
  const visualNotice = hasMissingVisual
    ? '<aside class="question-notice warning" aria-label="Material visual pendiente"><b>Esquema o imagen pendiente</b><p>Esta pregunta cita un recurso visual que no está incluido.</p></aside>'
    : '';
  const contentNotice = !question.n && question.np !== 1 ? ''
    : `<aside class="question-notice ${question.np === 1 ? 'warning' : ''}" aria-label="Advertencia de la pregunta"><b>${question.np === 1 ? 'Solo estudio · no puntuable' : 'Nota de la pregunta'}</b>${question.n ? `<p>${escapeHtml(question.n)}</p>` : '<p>Se conserva para estudiar; está excluida de los simulacros puntuables.</p>'}</aside>`;
  return visualNotice + contentNotice;
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
