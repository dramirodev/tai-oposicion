// Lógica pura (sin DOM ni almacenamiento): se prueba con `npm test`.
import type { Origin, Question, Session, StatMap, StatRec } from '../adapters/legacy/types.js';
import { escapeHtml as esc, formatTime as fmtT, percentage as pct } from '../shared/presentation/format.ts';
import { hiliteHtml, claveSpans, claveHtml, codeSpans, todoCodigo, richHtml } from '../shared/presentation/study-text.ts';
export { esc, fmtT, pct };
export { hiliteHtml, claveSpans, claveHtml, codeSpans, todoCodigo, richHtml } from '../shared/presentation/study-text.ts';
import { analyzeSimulation, simulationPace } from '../core/domain/simulation-analysis.ts';
import { countReviewsByDay, selectSpacedReviews } from '../core/domain/spaced-repetition.ts';
import { calculateTrapRates, selectTrapQuestions } from '../core/domain/traps.ts';
import { composeWeightedQuestions, estimateQuickQuestionCount, filterScoringQuestions, isQuestionAllowed, pickGuestQuestions, pickQuickQuestions } from '../core/domain/selection.ts';
import { analyzeTopicMastery, COVERAGE_OBJECTIVE } from '../core/domain/topic-mastery.ts';
import { selectFlashcards, summarizeFlashcards } from '../core/domain/flashcards.ts';
import { ERROR_REPORT_REASONS, FAILURE_REASONS, READING_TIPS, UI_THEMES, UI_ZOOMS } from '../shared/presentation/study-labels.ts';
const TEMAS_UI = UI_THEMES;
const ZOOMS = UI_ZOOMS;
export { calculateExamScore as nota } from '../core/domain/scoring.ts';
export {
  ERROR_REPORT_REASONS as MOTIVOS,
  FAILURE_REASONS as MOTIVOS_FALLO,
  READING_TIPS as CONSEJOS_LECTURA,
};
export { UI_THEMES as TEMAS_UI, UI_ZOOMS as ZOOMS };

type Rnd = () => number;
export function shuffle<T>(firstValue: readonly T[], rnd: Rnd = Math.random): T[] { const secondValue = firstValue.slice(); for (let itemCount = secondValue.length - 1; itemCount > 0; itemCount--) { const keyIndex = Math.floor(rnd() * (itemCount + 1)); [secondValue[itemCount], secondValue[keyIndex]] = [secondValue[keyIndex], secondValue[itemCount]]; } return secondValue; }
// Las históricas no puntuables siguen disponibles en sesiones de estudio.
export const questionsForSession = <T extends { np?: number }>(items: T[], feedback?: boolean): T[] => filterScoringQuestions(items, feedback, item => item.np);
export function allowed(question: Question & { r?: unknown }, option: { has(value: unknown): boolean }): boolean { return isQuestionAllowed(question.o, question.r, option); }

// Reparto de las N preguntas de la parte 1 por temas, según su peso oficial `w`.
// pools: { idTema: [preguntas ya filtradas y ordenadas por prioridad] }
export interface TemaPeso { id: string; w?: number; n?: number; nombre?: string }
export function composeSim(temas: TemaPeso[], pools: Record<string, Question[]>, numericValue: number, rnd: Rnd = Math.random): Question[] {
  return composeWeightedQuestions(temas.map(topic => ({ id: topic.id, weight: topic.w })), pools, numericValue, rnd);
}

// Mapa de dominio por tema (ver README). rec(id) devuelve el registro [n, ok, last, box, due, lastRes, flag] o undefined.
export const COV_OBJ = COVERAGE_OBJECTIVE;
export type Est = 'n' | 'r' | 'y' | 'g';
export function dominioCalc<T extends { id: string; n: number }>(temas: T[], idsOf: (text: string) => string[] | undefined, rec: (id: string) => StatRec | undefined, t0: number) {
  const reasonText = {
    'not-started': 'Sin empezar', 'few-responses': 'Pocas respuestas todavía',
    'recent-failures': 'Muchos fallos recientes', 'low-coverage': 'Cobertura baja',
    'stale-30-days': 'Más de 30 días sin tocar', 'many-failures': 'Aún fallas bastante',
    cooling: 'Se está enfriando', recent: 'Bien y reciente',
  } as const;
  const statusCode: Record<string, Est> = { new: 'n', red: 'r', yellow: 'y', green: 'g' };
  return analyzeTopicMastery(
    temas.map(topic => ({ ...topic, questionCount: topic.n })),
    idsOf,
    id => {
      const record = rec(id);
      return record ? {
        attempts: record[0], correct: record[1], lastSeenAt: record[2], intervalStep: record[3],
        dueAt: record[4], lastResult: record[5],
      } : undefined;
    },
    t0,
  ).map(({ seen, precision, coverage, score, daysSinceLastSeen, due, status, reason }, index) => ({
    ...temas[index],
    seen,
    prec: precision,
    cob: coverage,
    score,
    dias: daysSinceLastSeen,
    due,
    est: statusCode[status],
    why: reason === 'low-coverage' && status === 'yellow' ? 'Te falta ver preguntas' : reasonText[reason],
  }));
}

// ── Evolución por semanas ──
// Lunes (hora local) 00:00 de la semana de ts.
export function weekStart(ts: number): number { const date = new Date(ts); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date.getTime(); }
// sessions: sesiones guardadas. filtro: {tema} | {tipo} | {}. Devuelve las últimas `weeks` semanas (con huecos a n=0).
export function aggregateWeeks(sessions: Session[], { tema, tipo, weeks = 12, now = Date.now() }: { tema?: string; tipo?: string; weeks?: number; now?: number } = {}) {
  const w0 = weekStart(now), out: { start: number; n: number; ok: number; secs: number; ses: number }[] = [];
  for (let index = weeks - 1; index >= 0; index--) { const date = new Date(w0); date.setDate(date.getDate() - 7 * index); out.push({ start: date.getTime(), n: 0, ok: 0, secs: 0, ses: 0 }); }
  const byStart = new Map(out.map(option => [option.start, option]));
  for (const session of sessions) {
    const option = byStart.get(weekStart(session.ts)); if (!option) continue;
    let ok: number, itemCount: number;
    if (tema) { const value = session.temas && session.temas[tema]; if (!value) continue; [ok, itemCount] = value; }
    else if (tipo) { const itemValue = session.tipos && session.tipos[tipo]; if (!itemValue) continue; [ok, itemCount] = itemValue; }
    else { ok = session.a; itemCount = session.n; }
    if (!itemCount) continue;
    option.n += itemCount; option.ok += ok; option.ses++;
    if (!tema && !tipo) option.secs += session.secs || 0;
  }
  return out.map(option => ({ ...option, acierto: option.n ? Math.round(1000 * option.ok / option.n) / 10 : null, segPreg: option.n && option.secs ? Math.round(10 * option.secs / option.n) / 10 : null }));
}

// ── Preguntas lentas ──
// stats: { id: registro }. Registro: [n, ok, last, box, due, lastRes, flag, segTotales, nCronometradas]
export function slowList(stats: StatMap, { soloAcertadas = false, min = 1, limit = 15 }: { soloAcertadas?: boolean; min?: number; limit?: number } = {}) {
  const out: { id: string; avg: number; n: number; ok: number; last: number; tn: number }[] = [];
  for (const id in stats) {
    const statRecord = stats[id]; const tn = statRecord[8] || 0; if (tn < min) continue;
    if (soloAcertadas && statRecord[5] !== 1) continue;
    out.push({ id, avg: Math.round(10 * statRecord[7] / tn) / 10, n: statRecord[0], ok: statRecord[1], last: statRecord[5], tn });
  }
  return out.sort((leftItem, rightItem) => rightItem.avg - leftItem.avg || rightItem.n - leftItem.n).slice(0, limit);
}

// ── Sesión rápida ──
// Nº de preguntas para ~5 minutos según tu tiempo medio por pregunta (30 s si aún no hay datos).
export function quickN(stats: StatMap, minutos = 5): number {
  return estimateQuickQuestionCount(Object.keys(stats).map(id => ({ totalSeconds: stats[id][7], count: stats[id][8] })), minutos);
}
// due: preguntas con repaso vencido (las más antiguas primero). pools: preguntas nuevas por tema, temas más débiles primero.
// Hasta el 60 % son repasos; el resto, nuevas repartidas por turnos entre los temas. Si faltan de un tipo, se completa con el otro.
export function pickQuick(due: Question[], pools: Question[][], numericValue: number, rnd: Rnd = Math.random): Question[] {
  return pickQuickQuestions(due, pools, numericValue, question => question.i, rnd);
}

// Sesión rápida de invitado: una pregunta de cada tema, temas al azar. Entre las preguntas de un tema prefiere las
// no vistas y las que no salieron en la sesión anterior; así cada sesión es distinta.
// pools: [{ t, qs }]; vistas: id => ¿ya contestada?; evitar: Set de ids de la última sesión.
export function pickGuest(pools: { t: string; qs: Question[] }[], numericValue: number, vistas: (id: string) => boolean = () => false, evitar: Set<string> = new Set(), rnd: Rnd = Math.random): Question[] {
  return pickGuestQuestions(pools.map(pool => ({ topicId: pool.t, questions: pool.qs })), numericValue, question => question.i, vistas, evitar, rnd);
}

// ── Historial de simulacros ──
// Devuelve las sesiones de simulacro en orden cronológico, con la parte (p1 conocimientos / p2 supuesto) y la
// diferencia de nota respecto al intento anterior de la misma parte.
export function simHistory(sessions: Session[]) {
  const sims = sessions.filter(session => session.kind === 'sim').slice().sort((leftSession, rightSession) => leftSession.ts - rightSession.ts);
  const prev: Record<string, Session> = {};
  return sims.map(session => {
    const part = /Parte 2/.test(session.titulo || '') ? 'p2' : 'p1';
    const currentSession = prev[part]; prev[part] = session;
    return { ...session, part, dNota: currentSession ? Math.round((session.nota - currentSession.nota) * 10) / 10 : null };
  });
}
// Compara dos sesiones por tema (acierto %), más totales. d = b − a (puntos porcentuales).
export function compareSessions(session: Session, currentSession: Session) {
  const temas = [...new Set([...Object.keys(session.temas || {}), ...Object.keys(currentSession.temas || {})])].sort();
  const pc = (value?: [number, number]) => (value && value[1]) ? Math.round(100 * value[0] / value[1]) : null;
  const rows = temas.map(topic => { const pa = pc(session.temas?.[topic]), pb = pc(currentSession.temas?.[topic]); return { t: topic, pa, pb, na: session.temas?.[topic]?.[1] || 0, nb: currentSession.temas?.[topic]?.[1] || 0, d: pa !== null && pb !== null ? pb - pa : null }; });
  return { rows, dNota: Math.round((currentSession.nota - session.nota) * 10) / 10, dAcierto: pct(currentSession.a, currentSession.n) - pct(session.a, session.n), dSeg: session.n && currentSession.n ? Math.round(10 * (currentSession.secs / currentSession.n - session.secs / session.n)) / 10 : null };
}

// ── Mis trampas ──
// trapsOf(id) → lista de ids de trampa de la pregunta. Devuelve las trampas con más fallos (≥ min respuestas).
export function trapRates(stats: StatMap, trapsOf: (id: string) => (number | string)[] | undefined, min = 5) {
  const statistics: Record<string, { attempts: number; correct: number }> = {};
  for (const id in stats) statistics[id] = { attempts: stats[id][0], correct: stats[id][1] };
  return calculateTrapRates(statistics, trapsOf, min).map(rate => ({
    k: +rate.trapId,
    n: rate.responseCount,
    err: rate.errorCount,
    rate: rate.errorRate,
  }));
}
// cands: preguntas con `x` (lista de trampas); rec(id) → registro. Prioridad: falladas la última vez, luego nunca vistas, luego el resto;
// dentro de cada grupo, primero las que reúnen más trampas objetivo.
export function pickTrampas(cands: Question[], rec: (id: string) => StatRec | undefined, targets: (number | string)[], numericValue: number, rnd: Rnd = Math.random): Question[] {
  const questions = cands.map(question => ({ id: question.i, trapIds: question.x || [], question }));
  return selectTrapQuestions(
    questions,
    id => {
      const record = rec(id);
      return record ? { lastResult: record[5] } : undefined;
    },
    targets,
    numericValue,
    rnd,
  ).map(candidate => candidate.question);
}

// ── Informes de errores del banco ──
// ───────── comodidad: tema, tamaño, gestos y teclado ─────────
export interface UiCfg { theme: string; size: number; lectura: number }
export function normUi(u0: unknown): UiCfg {
  const url: any = u0 && typeof u0 === 'object' ? u0 : {};
  return { theme: TEMAS_UI.includes(url.theme) ? url.theme : 'auto', size: Number.isInteger(url.size) && url.size >= 0 && url.size < ZOOMS.length ? url.size : 0, lectura: [0, 1, 2].includes(url.lectura) ? url.lectura : 0 };
}
// Desplazamiento horizontal claro y no vertical → 'next' | 'prev' | null
export function swipeDir(dx: number, dy: number, min = 70): 'next' | 'prev' | null {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < min || ax < ay * 1.6 || ay > 90) return null;
  return dx < 0 ? 'next' : 'prev';
}
// Tecla → acción del test (nOpts = nº de opciones de la pregunta)
export type KeyAct = { t: 'opt'; i: number } | { t: 'next' | 'prev' | 'blank' | 'flag' | 'pause' };
export function keyAction(event: { key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, nOpts = 4): KeyAct | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = String(event.key || '').toLowerCase();
  if (/^[1-9]$/.test(key) && +key <= nOpts) return { t: 'opt', i: +key - 1 };
  if (/^[a-i]$/.test(key) && key.charCodeAt(0) - 97 < nOpts && !'bfp'.includes(key)) return { t: 'opt', i: key.charCodeAt(0) - 97 };
  if (key === 'enter' || key === 'arrowright' || key === ' ') return { t: 'next' };
  if (key === 'arrowleft') return { t: 'prev' };
  if (key === 'b') return { t: 'blank' };
  if (key === 'f') return { t: 'flag' };
  if (key === 'p') return { t: 'pause' };
  return null;
}

// ───────── repaso espaciado: prioridad, motivo del fallo y calendario ─────────
// 6 = acierto por suerte (solo en aciertos); 7 = fallo por leer deprisa o sin terminar
// items: [{ i, t, due }]. Las más vencidas primero (hasta n) y mezcladas por tema, sin repetir tema seguido si se puede.
export function pickRepaso<T extends { t: string; due: number }>(items: T[], itemCount: number): T[] {
  return selectSpacedReviews(items.map(item => ({ topicId: item.t, dueAt: item.due, item })), itemCount).map(review => review.item);
}
// Preguntas que vencen cada día: [hoy y atrasadas, +1, …, +(days-1)] (días naturales locales)
export function cargaRepasos(stats: StatMap, now: number, days = 14): number[] {
  const entries = [];
  for (const id in stats) entries.push({ intervalStep: stats[id][3], dueAt: stats[id][4] });
  return countReviewsByDay(entries, now, days);
}
// Recuento de motivos de la última falta (solo preguntas cuya última respuesta fue un fallo)
export function motivosFallo(stats: StatMap): number[] {
  const numericValue = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const id in stats) { const statRecord = stats[id]; if (statRecord[5] === 0 && (statRecord[9] >= 1 && statRecord[9] <= 5 || statRecord[9] === 7)) numericValue[statRecord[9]]++; }
  return numericValue;
}
// Aciertos marcados como «suerte» (último resultado acierto)
export function suertes(stats: StatMap): number {
  let count = 0;
  for (const id in stats) { const statRecord = stats[id]; if (statRecord[5] === 1 && (statRecord[9] === 6 || statRecord[9] === 8)) count++; }
  return count;
}

// ───────── tarjetas (flashcards) ─────────
// cards: [{ id, t, ... }]; recs: { id: [n, ok, last, box, due, lastGrade] }
// Devuelve hasta n tarjetas: primero las vencidas (más atrasadas primero), luego nuevas de los temas permitidos
// (máx. maxNew), todo mezclado por tema. seen: Set de temas permitidos para las nuevas (null = todos).
export interface CardDef { id: string; t: string; [key: string]: any }
export function pickCards(cards: CardDef[], recs: Record<string, number[]>, { n: count = 20, now = Date.now(), maxNew = 10, seen = null }: { n?: number; now?: number; maxNew?: number; seen?: Set<string> | null } = {}): string[] {
  const reviews = Object.fromEntries(Object.entries(recs).map(([id, record]) => [id, {
    attempts: record[0], known: record[1], lastReviewedAt: record[2], intervalStep: record[3], dueAt: record[4], lastGrade: record[5],
  }]));
  return selectFlashcards(cards.map(card => ({ id: card.id, topicId: card.t })), reviews, {
    count: count, now, maxNew, seenTopics: seen,
  });
}
export function cardStats(cards: CardDef[], recs: Record<string, number[]>, now = Date.now()) {
  const reviews = Object.fromEntries(Object.entries(recs).map(([id, record]) => [id, {
    attempts: record[0], known: record[1], lastReviewedAt: record[2], intervalStep: record[3], dueAt: record[4], lastGrade: record[5],
  }]));
  const summary = summarizeFlashcards(cards.map(card => ({ id: card.id, topicId: card.t })), reviews, now);
  return { nuevas: summary.new, enRepaso: summary.inReview, dominadas: summary.mastered, hoy: summary.due };
}
// Tarjeta construida desde una pregunta fallada: q = pregunta del banco ({ q, a[], c, n, u, t })
export function cardFromQuestion(question: Question) {
  return { id: 'FC-Q-' + question.i, t: question.t, tipo: 'fallo', src: 'fallo', q: question.q, a: question.a[question.c], nota: question.n || '', ref: question.u || '' };
}

// ¿La pregunta pide la opción incorrecta/excepción?
export const pideNegativa = (textValue: string): boolean => /\b(INCORRECT[OA]S?|FALS[OA]S?|EXCEPTO|SALVO|NO)\b/.test(textValue) || /\b(incorrect[oa]s?|fals[oa]s?|excepto|salvo)\b/i.test(textValue) || /\bno (es|son|se|forma|corresponde|pertenece|permite)\b/i.test(textValue);
// Segundos mínimos razonables para leer enunciado + opciones con atención (~3,3 palabras/s)
export function minLectura(question: { cp?: string; q: string; a?: string[] }): number {
  const txt = [question.cp, question.q, ...(question.a || [])].filter(Boolean).join(' ');
  const itemCount = txt.split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.min(30, Math.round(itemCount / 3.3)));
}
// Resumen de fallos por velocidad
export function velocidad(stats: StatMap) {
  const numericValue = motivosFallo(stats); const tot = numericValue.reduce((itemAccumulator, item) => itemAccumulator + item, 0);
  const ids = Object.keys(stats).filter(id => stats[id][5] === 0 && stats[id][9] === 7);
  return { n: numericValue[7], tot, p: tot ? Math.round(100 * numericValue[7] / tot) : 0, ids };
}

// Compatibility view for the legacy UI; the domain model uses complete names.
export function analisisSimulacro({ correct, ans, times = [], limitSecs, secs }: { correct: number[]; ans: (number | undefined)[]; times?: number[]; limitSecs: number; secs: number }) {
  const result = analyzeSimulation({ correct, answers: ans, times, limitSeconds: limitSecs, elapsedSeconds: secs });
  return {
    n: result.questionCount,
    a: result.correctCount,
    f: result.wrongCount,
    b: result.blankCount,
    presupuesto: result.secondsPerQuestion,
    media: result.averageAnswerSeconds,
    lentas: result.slowQuestions.map(answer => ({ k: answer.index, t: answer.seconds, ok: answer.correct })),
    rapidasFalladas: result.fastWrongAnswers,
    sinPenal: result.scoreWithoutPenalty,
    perdidoFallos: result.pointsLostToWrongAnswers,
    uso: result.timeUsedPercent,
  };
}
export const ritmoSimulacro = simulationPace;
