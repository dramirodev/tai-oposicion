// Lógica pura (sin DOM ni almacenamiento): se prueba con `npm test`.
import type { Origin, Question, Session, StatMap, StatRec } from '../adapters/legacy/types.js';
import { analyzeSimulation, simulationPace } from '../core/domain/simulation-analysis.ts';
import { countReviewsByDay, selectSpacedReviews } from '../core/domain/spaced-repetition.ts';
import { calculateTrapRates, selectTrapQuestions } from '../core/domain/traps.ts';
import { composeWeightedQuestions, estimateQuickQuestionCount, filterScoringQuestions, isQuestionAllowed, pickGuestQuestions, pickQuickQuestions } from '../core/domain/selection.ts';
export { calculateExamScore as nota } from '../core/domain/scoring.ts';

type Rnd = () => number;
type Span = [number, number];
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));
export function shuffle<T>(a: readonly T[], rnd: Rnd = Math.random): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [b[i], b[k]] = [b[k], b[i]]; } return b; }
export const fmtT = (s: number): string => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(x).padStart(2, '0'); };
export const pct = (a: number, b: number): number => b ? Math.round(100 * a / b) : 0;
// Las históricas no puntuables siguen disponibles en sesiones de estudio.
export const questionsForSession = <T extends { np?: number }>(items: T[], feedback?: boolean): T[] => filterScoringQuestions(items, feedback, item => item.np);
export function allowed(q: Question & { r?: unknown }, o: { has(x: unknown): boolean }): boolean { return isQuestionAllowed(q.o, q.r, o); }

// Reparto de las N preguntas de la parte 1 por temas, según su peso oficial `w`.
// pools: { idTema: [preguntas ya filtradas y ordenadas por prioridad] }
export interface TemaPeso { id: string; w?: number; n?: number; nombre?: string }
export function composeSim(temas: TemaPeso[], pools: Record<string, Question[]>, N: number, rnd: Rnd = Math.random): Question[] {
  return composeWeightedQuestions(temas.map(topic => ({ id: topic.id, weight: topic.w })), pools, N, rnd);
}

// Mapa de dominio por tema (ver README). rec(id) devuelve el registro [n, ok, last, box, due, lastRes, flag] o undefined.
export const COV_OBJ = 0.6;
export type Est = 'n' | 'r' | 'y' | 'g';
export function dominioCalc<T extends { id: string; n: number }>(temas: T[], idsOf: (t: string) => string[] | undefined, rec: (id: string) => StatRec | undefined, t0: number) {
  return temas.map(t => {
    let seen = 0, okNow = 0, last = 0, due = 0, att = 0;
    for (const id of idsOf(t.id) || []) {
      const r = rec(id); if (!r || !r[0]) continue;
      seen++; att += r[0]; if (r[5] === 1) okNow++; if (r[2] > last) last = r[2];
      if (r[3] >= 0 && r[4] && r[4] <= t0) due++;
    }
    const prec = seen ? okNow / seen : 0;
    const cob = Math.min(1, seen / Math.max(1, t.n * COV_OBJ));
    const dias: number | null = last ? Math.floor((t0 - last) / 86400000) : null;
    const score = Math.round(100 * (0.65 * prec + 0.35 * cob));
    let est: Est, why: string;
    if (!seen || att < 5) { est = 'n'; why = seen ? 'Pocas respuestas todavía' : 'Sin empezar'; }
    else if (score < 50) { est = 'r'; why = prec < 0.5 ? 'Muchos fallos recientes' : 'Cobertura baja'; }
    else if (dias! > 30) { est = 'r'; why = 'Más de 30 días sin tocar'; }
    else if (score < 75) { est = 'y'; why = prec < 0.75 ? 'Aún fallas bastante' : 'Te falta ver preguntas'; }
    else if (dias! > 14) { est = 'y'; why = 'Se está enfriando'; }
    else { est = 'g'; why = 'Bien y reciente'; }
    return { ...t, seen, prec: Math.round(100 * prec), cob: Math.round(100 * cob), score, dias, due, est, why };
  });
}

// ── Evolución por semanas ──
// Lunes (hora local) 00:00 de la semana de ts.
export function weekStart(ts: number): number { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
// sessions: sesiones guardadas. filtro: {tema} | {tipo} | {}. Devuelve las últimas `weeks` semanas (con huecos a n=0).
export function aggregateWeeks(sessions: Session[], { tema, tipo, weeks = 12, now = Date.now() }: { tema?: string; tipo?: string; weeks?: number; now?: number } = {}) {
  const w0 = weekStart(now), out: { start: number; n: number; ok: number; secs: number; ses: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) { const d = new Date(w0); d.setDate(d.getDate() - 7 * i); out.push({ start: d.getTime(), n: 0, ok: 0, secs: 0, ses: 0 }); }
  const byStart = new Map(out.map(o => [o.start, o]));
  for (const s of sessions) {
    const o = byStart.get(weekStart(s.ts)); if (!o) continue;
    let ok: number, n: number;
    if (tema) { const v = s.temas && s.temas[tema]; if (!v) continue; [ok, n] = v; }
    else if (tipo) { const v = s.tipos && s.tipos[tipo]; if (!v) continue; [ok, n] = v; }
    else { ok = s.a; n = s.n; }
    if (!n) continue;
    o.n += n; o.ok += ok; o.ses++;
    if (!tema && !tipo) o.secs += s.secs || 0;
  }
  return out.map(o => ({ ...o, acierto: o.n ? Math.round(1000 * o.ok / o.n) / 10 : null, segPreg: o.n && o.secs ? Math.round(10 * o.secs / o.n) / 10 : null }));
}

// ── Preguntas lentas ──
// stats: { id: registro }. Registro: [n, ok, last, box, due, lastRes, flag, segTotales, nCronometradas]
export function slowList(stats: StatMap, { soloAcertadas = false, min = 1, limit = 15 }: { soloAcertadas?: boolean; min?: number; limit?: number } = {}) {
  const out: { id: string; avg: number; n: number; ok: number; last: number; tn: number }[] = [];
  for (const id in stats) {
    const r = stats[id]; const tn = r[8] || 0; if (tn < min) continue;
    if (soloAcertadas && r[5] !== 1) continue;
    out.push({ id, avg: Math.round(10 * r[7] / tn) / 10, n: r[0], ok: r[1], last: r[5], tn });
  }
  return out.sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, limit);
}

// ── Sesión rápida ──
// Nº de preguntas para ~5 minutos según tu tiempo medio por pregunta (30 s si aún no hay datos).
export function quickN(stats: StatMap, minutos = 5): number {
  return estimateQuickQuestionCount(Object.keys(stats).map(id => ({ totalSeconds: stats[id][7], count: stats[id][8] })), minutos);
}
// due: preguntas con repaso vencido (las más antiguas primero). pools: preguntas nuevas por tema, temas más débiles primero.
// Hasta el 60 % son repasos; el resto, nuevas repartidas por turnos entre los temas. Si faltan de un tipo, se completa con el otro.
export function pickQuick(due: Question[], pools: Question[][], N: number, rnd: Rnd = Math.random): Question[] {
  return pickQuickQuestions(due, pools, N, question => question.i, rnd);
}

// Sesión rápida de invitado: una pregunta de cada tema, temas al azar. Entre las preguntas de un tema prefiere las
// no vistas y las que no salieron en la sesión anterior; así cada sesión es distinta.
// pools: [{ t, qs }]; vistas: id => ¿ya contestada?; evitar: Set de ids de la última sesión.
export function pickGuest(pools: { t: string; qs: Question[] }[], N: number, vistas: (id: string) => boolean = () => false, evitar: Set<string> = new Set(), rnd: Rnd = Math.random): Question[] {
  return pickGuestQuestions(pools.map(pool => ({ topicId: pool.t, questions: pool.qs })), N, question => question.i, vistas, evitar, rnd);
}

// ── Historial de simulacros ──
// Devuelve las sesiones de simulacro en orden cronológico, con la parte (p1 conocimientos / p2 supuesto) y la
// diferencia de nota respecto al intento anterior de la misma parte.
export function simHistory(sessions: Session[]) {
  const sims = sessions.filter(s => s.kind === 'sim').slice().sort((a, b) => a.ts - b.ts);
  const prev: Record<string, Session> = {};
  return sims.map(s => {
    const part = /Parte 2/.test(s.titulo || '') ? 'p2' : 'p1';
    const p = prev[part]; prev[part] = s;
    return { ...s, part, dNota: p ? Math.round((s.nota - p.nota) * 10) / 10 : null };
  });
}
// Compara dos sesiones por tema (acierto %), más totales. d = b − a (puntos porcentuales).
export function compareSessions(a: Session, b: Session) {
  const temas = [...new Set([...Object.keys(a.temas || {}), ...Object.keys(b.temas || {})])].sort();
  const pc = (v?: [number, number]) => (v && v[1]) ? Math.round(100 * v[0] / v[1]) : null;
  const rows = temas.map(t => { const pa = pc(a.temas?.[t]), pb = pc(b.temas?.[t]); return { t, pa, pb, na: a.temas?.[t]?.[1] || 0, nb: b.temas?.[t]?.[1] || 0, d: pa !== null && pb !== null ? pb - pa : null }; });
  return { rows, dNota: Math.round((b.nota - a.nota) * 10) / 10, dAcierto: pct(b.a, b.n) - pct(a.a, a.n), dSeg: a.n && b.n ? Math.round(10 * (b.secs / b.n - a.secs / a.n)) / 10 : null };
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
export function pickTrampas(cands: Question[], rec: (id: string) => StatRec | undefined, targets: (number | string)[], N: number, rnd: Rnd = Math.random): Question[] {
  const questions = cands.map(question => ({ id: question.i, trapIds: question.x || [], question }));
  return selectTrapQuestions(
    questions,
    id => {
      const record = rec(id);
      return record ? { lastResult: record[5] } : undefined;
    },
    targets,
    N,
    rnd,
  ).map(candidate => candidate.question);
}

// ── Informes de errores del banco ──
export const MOTIVOS = ['Respuesta correcta mal marcada', 'Enunciado erróneo o confuso', 'Opciones repetidas o dos correctas', 'La cita del temario no coincide', 'Otro'];

// ───────── comodidad: tema, tamaño, gestos y teclado ─────────
export const TEMAS_UI = ['auto', 'light', 'dark'];
export interface UiCfg { theme: string; size: number; lectura: number }
export const ZOOMS = [1, 1.15, 1.3, 1.5];
export function normUi(u0: unknown): UiCfg {
  const u: any = u0 && typeof u0 === 'object' ? u0 : {};
  return { theme: TEMAS_UI.includes(u.theme) ? u.theme : 'auto', size: Number.isInteger(u.size) && u.size >= 0 && u.size < ZOOMS.length ? u.size : 0, lectura: [0, 1, 2].includes(u.lectura) ? u.lectura : 0 };
}
// Desplazamiento horizontal claro y no vertical → 'next' | 'prev' | null
export function swipeDir(dx: number, dy: number, min = 70): 'next' | 'prev' | null {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < min || ax < ay * 1.6 || ay > 90) return null;
  return dx < 0 ? 'next' : 'prev';
}
// Tecla → acción del test (nOpts = nº de opciones de la pregunta)
export type KeyAct = { t: 'opt'; i: number } | { t: 'next' | 'prev' | 'blank' | 'flag' | 'pause' };
export function keyAction(e: { key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, nOpts = 4): KeyAct | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = String(e.key || '').toLowerCase();
  if (/^[1-9]$/.test(k) && +k <= nOpts) return { t: 'opt', i: +k - 1 };
  if (/^[a-i]$/.test(k) && k.charCodeAt(0) - 97 < nOpts && !'bfp'.includes(k)) return { t: 'opt', i: k.charCodeAt(0) - 97 };
  if (k === 'enter' || k === 'arrowright' || k === ' ') return { t: 'next' };
  if (k === 'arrowleft') return { t: 'prev' };
  if (k === 'b') return { t: 'blank' };
  if (k === 'f') return { t: 'flag' };
  if (k === 'p') return { t: 'pause' };
  return null;
}

// ───────── repaso espaciado: prioridad, motivo del fallo y calendario ─────────
export const MOTIVOS_FALLO = ['', 'Contenido', 'Trampa', 'Dudaba entre dos', 'Despiste', 'No lo sabía', '', 'Velocidad']; // 6 = acierto por suerte (solo en aciertos); 7 = fallo por leer deprisa o sin terminar
// items: [{ i, t, due }]. Las más vencidas primero (hasta n) y mezcladas por tema, sin repetir tema seguido si se puede.
export function pickRepaso<T extends { t: string; due: number }>(items: T[], n: number): T[] {
  return selectSpacedReviews(items.map(item => ({ topicId: item.t, dueAt: item.due, item })), n).map(review => review.item);
}
// Preguntas que vencen cada día: [hoy y atrasadas, +1, …, +(days-1)] (días naturales locales)
export function cargaRepasos(stats: StatMap, now: number, days = 14): number[] {
  const entries = [];
  for (const id in stats) entries.push({ intervalStep: stats[id][3], dueAt: stats[id][4] });
  return countReviewsByDay(entries, now, days);
}
// Recuento de motivos de la última falta (solo preguntas cuya última respuesta fue un fallo)
export function motivosFallo(stats: StatMap): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const id in stats) { const r = stats[id]; if (r[5] === 0 && (r[9] >= 1 && r[9] <= 5 || r[9] === 7)) c[r[9]]++; }
  return c;
}
// Aciertos marcados como «suerte» (último resultado acierto)
export function suertes(stats: StatMap): number {
  let n = 0;
  for (const id in stats) { const r = stats[id]; if (r[5] === 1 && (r[9] === 6 || r[9] === 8)) n++; }
  return n;
}

// ───────── tarjetas (flashcards) ─────────
// cards: [{ id, t, ... }]; recs: { id: [n, ok, last, box, due, lastGrade] }
// Devuelve hasta n tarjetas: primero las vencidas (más atrasadas primero), luego nuevas de los temas permitidos
// (máx. maxNew), todo mezclado por tema. seen: Set de temas permitidos para las nuevas (null = todos).
export interface CardDef { id: string; t: string; [k: string]: any }
export function pickCards(cards: CardDef[], recs: Record<string, number[]>, { n = 20, now = Date.now(), maxNew = 10, seen = null }: { n?: number; now?: number; maxNew?: number; seen?: Set<string> | null } = {}): string[] {
  const due: { i: string; t: string; due: number }[] = [], fresh: CardDef[] = [];
  for (const c of cards) {
    const r = recs[c.id];
    if (r) { if (r[3] >= 0 && r[4] <= now) due.push({ i: c.id, t: c.t, due: r[4] }); }
    else if (!seen || seen.has(c.t)) fresh.push(c);
  }
  const out = pickRepaso(due, n).map(x => x.i);
  const room = Math.min(n - out.length, maxNew);
  if (room > 0 && fresh.length) {
    const by = new Map<string, string[]>();
    for (const c of fresh) { if (!by.has(c.t)) by.set(c.t, []); by.get(c.t)!.push(c.id); }
    const ts = [...by.keys()].sort(); let k = 0;
    while (k < room && ts.some(t => by.get(t)!.length)) for (const t of ts) { if (k >= room) break; const x = by.get(t)!.shift(); if (x) { out.push(x); k++; } }
  }
  return out;
}
export function cardStats(cards: CardDef[], recs: Record<string, number[]>, now = Date.now()) {
  const s = { nuevas: 0, enRepaso: 0, dominadas: 0, hoy: 0 };
  for (const c of cards) {
    const r = recs[c.id];
    if (!r) s.nuevas++;
    else if (r[3] >= 0) { s.enRepaso++; if (r[4] <= now) s.hoy++; }
    else if (r[0] > 0) s.dominadas++;
  }
  return s;
}
// Tarjeta construida desde una pregunta fallada: q = pregunta del banco ({ q, a[], c, n, u, t })
export function cardFromQuestion(q: Question) {
  return { id: 'FC-Q-' + q.i, t: q.t, tipo: 'fallo', src: 'fallo', q: q.q, a: q.a[q.c], nota: q.n || '', ref: q.u || '' };
}

// Resalta en negrita (HTML ya escapado) el fragmento de `u` que mejor responde con `ans`.
const STOP = new Set('para como pero este esta estos estas esos esas sobre entre desde hasta cada todo todos toda todas otro otra otros otras puede pueden será serán solo sólo tiene tienen según cuando donde mientras ellos ellas dicho dicha cual cuales'.split(' '));
const normW = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');
export function hiliteHtml(u0: unknown, ans0: unknown): string {
  const escH = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const u = String(u0 || ''), ans = String(ans0 || '');
  const toks = u.split(/(\s+)/);           // palabras y separadores
  const idx: number[] = []; toks.forEach((t, i) => { if (t && !/^\s+$/.test(t)) idx.push(i); });
  const nw = idx.map(i => normW(toks[i]));
  const aw = new Set(ans.split(/\s+/).map(normW).filter(w => w.length > 3 && !STOP.has(w) || /^\d+$/.test(w)));
  if (!aw.size || !idx.length) return escH(u);
  const hit = nw.map(w => aw.has(w));
  let best: { i: number; j: number; sc: number; n: number } | null = null; const maxLen = Math.min(idx.length, aw.size * 2 + 6);
  for (let i = 0; i < idx.length; i++) {
    if (!hit[i]) continue;
    const seen = new Set();
    for (let j = i; j < Math.min(idx.length, i + maxLen); j++) {
      if (hit[j]) seen.add(nw[j]);
      if (!hit[j]) continue;
      const sc = seen.size - (j - i + 1 - seen.size) * 0.15;
      if (!best || sc > best.sc + 1e-9 || (Math.abs(sc - best.sc) < 1e-9 && j - i < best.j - best.i)) best = { i, j, sc, n: seen.size };
    }
  }
  if (!best || best.n < Math.min(2, aw.size)) return escH(u);
  const a = idx[best.i], b = idx[best.j];
  return escH(toks.slice(0, a).join('')) + '<b class="hl">' + escH(toks.slice(a, b + 1).join('')) + '</b>' + escH(toks.slice(b + 1).join(''));
}

// ───────── lectura atenta (contra los fallos por velocidad) ─────────
// Palabras que cambian el sentido: negaciones, excepciones, absolutos, restrictivos y cifras/plazos.
const KW = /(?<![\p{L}\d])(NO|NUNCA|NINGUN[OA]S?|NADA|SIEMPRE|TODOS|TODAS|SOLO|SÓLO|ÚNICAMENTE|EXCLUSIVAMENTE|EXCEPTO|SALVO|INCORRECT[OA]S?|FALS[OA]S?|VERDADER[OA]S?|CORRECT[OA]S?|MÁXIM[OA]S?|MÍNIM[OA]S?|SIN|MENOS|MÁS|ANTES|DESPUÉS|HÁBILES|NATURALES)(?![\p{L}\d])|(?<![\p{L}\d])\d[\d.,]*\s?(?:%|bits?|bytes?|GB|MB|KB|Mbps|Gbps|MHz|GHz|días?|meses|años?|horas?|segundos?|puertos?)?/giu;
const KW_STRICT = /^(NO|NUNCA|NINGUN[OA]S?|NADA|SIEMPRE|TODOS|TODAS|SOLO|SÓLO|ÚNICAMENTE|EXCLUSIVAMENTE|EXCEPTO|SALVO|INCORRECT[OA]S?|FALS[OA]S?|SIN|MENOS)$/;
export function claveSpans(text: unknown): Span[] {
  const t = String(text ?? ''), out: Span[] = []; let m: RegExpExecArray | null; KW.lastIndex = 0;
  while ((m = KW.exec(t))) {
    const w = m[0];
    // «NO», «MÁS», «SIN»… en minúscula son palabras corrientes: solo se marcan en mayúsculas o los términos fuertes
    const flojo = /^(no|más|sin|menos|antes|después|correct[oa]s?|verdader[oa]s?|todos|todas|solo|sólo|nada)$/i.test(w) && w !== w.toUpperCase();
    if (flojo) continue;
    if (m.index === KW.lastIndex) KW.lastIndex++;
    out.push([m.index, m.index + w.length]);
  }
  return out;
}
export function claveHtml(text: unknown): string {
  const t = String(text ?? ''); let h = '', p = 0;
  for (const [a, b] of claveSpans(t)) { h += esc(t.slice(p, a)) + '<mark class="kw">' + esc(t.slice(a, b)) + '</mark>'; p = b; }
  return h + esc(t.slice(p));
}

// ───────── código: detección y marcado (SQL, comandos, etiquetas, funciones, rutas…) ─────────
const SQL_KW = 'ALTER|MODIFY|ADD|COLUMN|TABLE|CREATE|DROP|SAVEPOINT|INTO|SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LEFT OUTER JOIN|RIGHT OUTER JOIN|FULL OUTER JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|CROSS JOIN|NATURAL JOIN|JOIN|ON|AS|AND|OR|NOT NULL|NOT|NULL|IS|IN|BETWEEN|LIKE|DISTINCT|UNION ALL|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|CREATE VIEW|CREATE INDEX|ALTER TABLE|DROP TABLE|DROP VIEW|DROP INDEX|PRIMARY KEY|FOREIGN KEY|REFERENCES|GRANT|REVOKE|COMMIT|ROLLBACK|TRUNCATE|ASC|DESC|LIMIT|EXISTS|ALL|ANY|COUNT|SUM|AVG|MAX|MIN';
const SQL_KW_RE = new RegExp('(?<![\\p{L}\\d_])(' + SQL_KW + ')(?![\\p{L}\\d_])', 'gu');
const SQL_START = /(?<![\p{L}\d_])(SELECT\s|INSERT INTO\s|UPDATE\s+[\p{L}_]+\s+SET|DELETE FROM\s|CREATE\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|ALTER\s+TABLE\s|DROP\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|GRANT\s|REVOKE\s)/giu;
// una sentencia SELECT necesita FROM, y GRANT/REVOKE necesitan ON/TO/FROM: «una sentencia SELECT grupos de…» es prosa
const sqlCompleta = (s: string): boolean => /^select/i.test(s) ? /\bfrom\b/i.test(s) : /^(grant|revoke)/i.test(s) ? /\b(on|to|from)\b/i.test(s) : true;
const SQL_WORDS = /(?<![\p{L}\d_])(ORDER BY|GROUP BY|(?:LEFT|RIGHT|FULL)(?: OUTER)? JOIN|INNER JOIN|CROSS JOIN|NATURAL JOIN|PRIMARY KEY|FOREIGN KEY|NOT NULL|UNION(?: ALL)?|SELECT|INSERT|UPDATE|DELETE|WHERE|HAVING|DISTINCT|COMMIT|ROLLBACK|TRUNCATE|NULL|COUNT\(\*\))(?![\p{L}\d_])/gu;
const CMDS = '(?:chmod|chown|chgrp|grep|sudo|ping|ssh|scp|ifconfig|ipconfig|nslookup|traceroute|netstat|systemctl|mkdir|rsync|tar(?=\\s+-)|apt-get|umask|git\\s+(?:add|commit|push|pull|clone|status|log|branch|checkout|merge|rebase|init|fetch|diff|stash|reset|remote|tag)|docker\\s+(?:run|build|ps|pull|push|exec|images|compose|stop|rm|start)|kubectl\\s+(?:get|apply|describe|delete|logs|exec)|curl|wget)';
const CODE_RES = [
  /<\?php[\s\S]*?(?:\?>|$)/g,                                                              // PHP
  /<\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>/g,                                                  // etiquetas HTML/XML y genéricos <tipo>
  /(?<![\w.])\/(?:etc|var|usr|home|s?bin|dev|proc|tmp|opt|root|lib|boot|mnt|media|srv|sys|run)(?:\/[\w.*-]+)*/g,             // rutas Linux
  /(?<![\w.-])[a-z0-9_][\w-]*\.(?:php|java|js|ts|py|xml|html|css|conf|sh|sql|json|ini|txt|log|yml|yaml|cfg|bat|tar|gz|zip)\b/g, // ficheros
  new RegExp('(?<![\\w-])' + CMDS + '\\b(?:\\s+-{1,2}[\\w-]+|\\s+\\d{3,4}\\b)*', 'g'),     // comandos con sus opciones
  /(?<=^|[\s(])--?[A-Za-z][\w-]*(?=[\s.,;:)]|$)/g,                                         // opciones -R, --force
  /(?<![\p{L}\d_$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\((?:[^()]|\([^()]*\))*\)/gu,   // llamadas f(...), a.b(...)
  /[^\s]*(?:===?|!==?|\+\+|->|=>|&&|\|\|)[^\s]*/g,                                         // operadores
  /(?<![\p{L}\d_$])[A-Za-z_$][\w$.]*=[&*]?[\w$.'"]+/gu,                                          // a=b, A.a=B.b
  /(?<![\p{L}\d_$])(?:int|float|char|double|long|short|void|boolean|String)(?:\[\])*\s*\*{0,2}\s*[A-Za-z_]\w*(?:\s*,\s*\*{0,2}[A-Za-z_]\w*)*\s*(?:=\s*new\s+\w+\[[^\]]*\])?;/gu, // int *a,b;  float[] x = new float[12];
  /(?<![\p{L}\d_$])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\p{L}\d_$])/gu,                        // snake_case
  /(?<![\p{L}\d_$])(?!(?:macOS|iOS|iPadOS|iPhone|iPad|iCloud|iMac|tvOS|watchOS|visionOS|openSUSE|eDNI|eIDAS|iTunes|eBay|iOS)\b)[a-z]{2,}(?:[A-Z][a-z0-9]*)+(?![\p{L}\d_$])/gu, // camelCase
  /(?<![\p{L}\d_$])[a-z]\s+(?:XNOR|NAND|XOR|NOR|AND|OR)\s+[a-z]\s*=\s*\d(?![\p{L}\d_$])/gu,        // a XOR b = 1
];
const noEsLlamada = /^(?:\d|[A-Z]{1,2}$)/;
function rangosCodigo(t: string): Span[] {
  const r: Span[] = [];
  // sentencias SQL completas: desde la palabra inicial hasta «;», o hasta el final de la frase, o el final del texto
  SQL_START.lastIndex = 0; let m: RegExpExecArray | null;
  while ((m = SQL_START.exec(t))) {
    const a = m.index; let b = t.length;
    const semi = t.indexOf(';', a); if (semi >= 0) b = semi + 1;
    const fin = /\.\s+(?=[¿¡A-ZÁÉÍÓÚÑ])|[?!]\s|\?$/g; fin.lastIndex = a; const f = fin.exec(t);
    if (f && f.index < b) b = f.index;
    let e = b; while (e > a && /[\s.]/.test(t[e - 1])) e--;
    if (e > a + 6 && sqlCompleta(t.slice(a, e))) { r.push([a, e]); SQL_START.lastIndex = Math.max(e, a + 1); }
  }
  for (const re of CODE_RES) {
    re.lastIndex = 0;
    while ((m = re.exec(t))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      let a = m.index, b = a + m[0].length;
      if (re === CODE_RES[6] && noEsLlamada.test(m[0])) continue;
      if (re === CODE_RES[7] && /^C\+\+/.test(m[0])) continue;
      // no marcar paréntesis finales de frase: «cuando (a)» no es una llamada, pero sí «f(a)»
      while (b > a && /[.,;:]$/.test(t.slice(a, b)) && !/[)}\]]$/.test(t.slice(a, b - 1))) b--;
      if (b > a) r.push([a, b]);
    }
  }
  // bloques con llaves { … }: desde la sentencia que los abre hasta la última llave
  const o = t.indexOf('{'), c = t.lastIndexOf('}');
  if (o >= 0 && c > o) {
    let ini = 0; const pre = t.slice(0, o); const sb = /[.?!:]\s+(?=\S)/g; let q; while ((q = sb.exec(pre))) ini = q.index + q[0].length;
    const k = /\b(?:function|public|private|protected|static|class|interface|void|int|for|while|if|switch|try|def|echo|print)\b|[A-Za-z_$][\w$]*\(/.exec(t.slice(ini, o));
    r.push([k ? ini + k.index : o, c + 1]);
  }
  while ((m = SQL_WORDS.exec(t))) r.push([m.index, m.index + m[0].length]);
  r.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const u: Span[] = [];
  for (const [a, b] of r) { const l = u[u.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else u.push([a, b]); }
  // «;» pegado al final de una sentencia forma parte del código
  for (const x of u) if (t[x[1]] === ';') x[1]++;
  // fragmentos de código separados solo por «,», «;» o por un identificador suelto entre ellos («a=10,b; b=a++;») son un único bloque
  const GAP = /^\s+$|^\s*[,;]\s*(?:[A-Za-z_]\w{0,15}\s*[,;]\s*)?$/;
  const v: Span[] = [];
  for (const x of u) { const l = v[v.length - 1]; if (l && x[0] >= l[1] && GAP.test(t.slice(l[1], x[0]))) l[1] = x[1]; else v.push([...x]); }
  return v;
}
export function codeSpans(text: unknown): Span[] { return rangosCodigo(String(text ?? '')); }
const codeInner = (h: string) => h.replace(SQL_KW_RE, '<b class="sk">$1</b>');
// Un texto corto que es todo código (p. ej. una opción «((a>b) and (a<d))», «GRANT.», «MODIFY TABLE t ADD (x INT)»)
// se pinta como un único bloque, en vez de trocearlo según qué fragmentos reconozca cada regla.
const PROSA = /[áéíóúñ¿¡]|(?<![\p{L}\d_])(?:de|la|el|los|las|un|una|y|o|que|en|se|por|para|con|del|al|es|son|no|su|sus|lo|como|más|sin|si|entre|cuando)(?![\p{L}\d_])/iu;
const SQLISH = /(?<![\p{L}\d_])(?:SELECT|FROM|WHERE|TABLE|COLUMN|ADD|MODIFY|ALTER|CREATE|DROP|INSERT|INTO|VALUES|UPDATE|SET|DELETE|GRANT|REVOKE|ROLLBACK|COMMIT|SAVEPOINT|TRUNCATE|INDEX|VIEW|CONSTRAINT|PRIMARY|KEY|ORDER|GROUP|BY|JOIN|HAVING|DISTINCT|UNION)(?![\p{L}\d_])/gu;
const ETIQUETA = /<\/?[A-Za-z][^<>]*>/g;
export function todoCodigo(text: unknown): boolean {
  const s = String(text ?? '').trim().replace(/\.$/, '');
  if (!s || s.length > 160 || !/[A-Za-z]/.test(s) || PROSA.test(s)) return false;
  if (/^[A-Z]+$/.test(s)) return (s.match(SQLISH) || []).length === 1; // «GRANT», «ROLLBACK»
  const sinEtiquetas = s.replace(ETIQUETA, ' ');
  if (/[={}\[\]<>]|&&|\|\|/.test(sinEtiquetas)) return true;
  // «;» solo cuenta si no separa frases con palabras en mayúscula inicial («I Plan 2012-2014; II Plan 2014-2016»)
  if (/;/.test(s) && (s.match(/(?<![\p{L}\d_])[A-Z][a-z]{2,}(?![\p{L}\d_])/gu) || []).length < 2) return true;
  // varias palabras SQL, empezando por una de ellas o en mayúsculas («Permite ejecutar SELECT … FROM DUAL» es prosa)
  if ((s.match(SQLISH) || []).length >= 2 && /^[^A-Za-z]*[A-Z]{2,}(?![a-z])/.test(s)) return true;
  // solo etiquetas: «<footer>», «<CRLF>#<CRLF>»; con texto alrededor («Solo obligatorio <html>») se marca solo la etiqueta
  return sinEtiquetas !== s && !/[A-Za-z]{3,}/.test(sinEtiquetas);
}
// Texto → HTML seguro: escapa todo, pone en tipografía de código lo que lo parece y (opcional) resalta las palabras clave de lectura.
export function richHtml(text: unknown, clave = false): string {
  const t = String(text ?? '');
  if (todoCodigo(t)) { const m = /^(\s*)([\s\S]*?)(\.?\s*)$/.exec(t)!; const blk = /\s/.test(m[2]) && m[2].length > 18 ? ' blk' : ''; return esc(m[1]) + '<code class="cd' + blk + '">' + codeInner(esc(m[2])) + '</code>' + (blk ? '' : esc(m[3])); } // en bloque, el punto final quedaría en una línea suelta
  const code = rangosCodigo(t), key = clave ? claveSpans(t).filter(([a, b]) => !code.some(([c, d]) => a < d && c < b)) : [];
  const cuts = new Set([0, t.length]);
  for (const [a, b] of code) { cuts.add(a); cuts.add(b); }
  for (const [a, b] of key) { cuts.add(a); cuts.add(b); }
  const pts = [...cuts].sort((x, y) => x - y); let h = '';
  const dentro = (L: Span[], i: number) => L.some(([a, b]) => i >= a && i < b);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; if (a === b) continue;
    const seg = esc(t.slice(a, b));
    if (dentro(code, a)) h += '<code class="cd">' + codeInner(seg) + '</code>';
    else if (dentro(key, a)) h += '<mark class="kw">' + seg + '</mark>';
    else h += seg;
  }
  return h.replace(/<\/code><code class="cd">/g, '');
}

// ¿La pregunta pide la opción incorrecta/excepción?
export const pideNegativa = (q: string): boolean => /\b(INCORRECT[OA]S?|FALS[OA]S?|EXCEPTO|SALVO|NO)\b/.test(q) || /\b(incorrect[oa]s?|fals[oa]s?|excepto|salvo)\b/i.test(q) || /\bno (es|son|se|forma|corresponde|pertenece|permite)\b/i.test(q);
// Segundos mínimos razonables para leer enunciado + opciones con atención (~3,3 palabras/s)
export function minLectura(q: { cp?: string; q: string; a?: string[] }): number {
  const txt = [q.cp, q.q, ...(q.a || [])].filter(Boolean).join(' ');
  const w = txt.split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.min(30, Math.round(w / 3.3)));
}
// Resumen de fallos por velocidad
export function velocidad(stats: StatMap) {
  const c = motivosFallo(stats); const tot = c.reduce((a, b) => a + b, 0);
  const ids = Object.keys(stats).filter(id => stats[id][5] === 0 && stats[id][9] === 7);
  return { n: c[7], tot, p: tot ? Math.round(100 * c[7] / tot) : 0, ids };
}
export const CONSEJOS_LECTURA = [
  'Antes de mirar las opciones, di con tus palabras qué te piden (¿la correcta o la incorrecta?).',
  'Marca negaciones y excepciones: NO, SALVO, EXCEPTO, INCORRECTA, FALSA.',
  'Subraya cifras, plazos y unidades (días hábiles vs naturales, bits vs bytes).',
  'Desconfía de los absolutos (siempre, nunca, solo, todos): busca la excepción.',
  'Lee las cuatro opciones enteras aunque la primera te parezca buena.',
  'Si «la sabes de golpe», frena: ahí es donde se cuelan los matices.',
  'No cambies de respuesta sin un motivo concreto en el enunciado.',
];

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
