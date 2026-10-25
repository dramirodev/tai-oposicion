import { VERIFIED_SOURCES } from '../../adapters/http/verified-sources.js';
import { esc } from '../../legacy/logic.js';
import { failureStreak, INTERVALS, DAY } from '../../adapters/local/legacy-store.js';
import type { Question, StatMap, CardRec } from '../../adapters/legacy/types.js';

export function questionNotice(q: Pick<Question, 'n' | 'np'>): string {
  if (!q.n && q.np !== 1) return '';
  return `<aside class="question-notice ${q.np === 1 ? 'warning' : ''}" aria-label="Advertencia de la pregunta"><b>${q.np === 1 ? 'Solo estudio · no puntuable' : 'Nota de la pregunta'}</b>${q.n ? `<p>${esc(q.n)}</p>` : '<p>Se conserva para estudiar; está excluida de los simulacros puntuables.</p>'}</aside>`;
}
export function sourceHtml(q: Pick<Question, 'source' | 'u'> & { i?: string }): string {
  const s = q.source || (q.i ? VERIFIED_SOURCES[q.i] : undefined);
  if (s?.verified) {
    try {
      const url = new URL(s.url);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        const page = Number.isInteger(s.page) && s.page! > 0 ? ` · página ${s.page}` : '';
        return `<a class="source-link" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Abrir fuente: ${esc(s.title || 'referencia verificada')}${page}<span class="sr"> (se abre en otra pestaña)</span></a>`;
      }
    } catch {}
  }
  return q.u ? '<p class="source-status">Cita del temario disponible, sin enlace verificado al PDF.</p>' : '';
}
export interface FailureFilters { q: string; t: string; review: string; streak: string }
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterFailures(questions: Question[], stats: StatMap, f: FailureFilters): Question[] {
  const text = fold(f.q).trim();
  return questions.filter(q => {
    const r = stats[q.i];
    return (!f.t || q.t === f.t) && (!f.review || (f.review === 'reviewed' ? r?.[11] === 1 : r?.[11] !== 1)) &&
      (!f.streak || failureStreak(r) === +f.streak) && (!text || fold([q.q, ...q.a, q.u, q.n].join(' ')).includes(text));
  });
}
// Anticipa el calendario sin valorar ni mutar una tarjeta.
export function cardNextReview(r: CardRec | undefined, grade: number, now: number): number {
  if (grade < 2 || !r || r[0] === 0 || r[3] < 0) return now + INTERVALS[0] * DAY;
  return r[3] + 1 >= INTERVALS.length ? 0 : now + INTERVALS[r[3] + 1] * DAY;
}
