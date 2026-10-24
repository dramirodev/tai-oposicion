// Lógica pura (sin DOM ni almacenamiento): se prueba con `npm test`.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
export const fmtT = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(x).padStart(2, '0'); };
export const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
// Nota del examen: (aciertos − fallos/3) / total × 100, un decimal. En blanco no resta.
export const nota = (a, f, n) => n ? Math.round(1000 * (a - f / 3) / n) / 10 : 0;
// Las históricas no puntuables siguen disponibles en sesiones de estudio.
export const questionsForSession = (items, feedback) => feedback ? items.slice() : items.filter(q => q.np !== 1);
export function allowed(q, o) { return o.has(q.o) && !q.r; }

// Reparto de las N preguntas de la parte 1 por temas, según su peso oficial `w`.
// pools: { idTema: [preguntas ya filtradas y ordenadas por prioridad] }
export function composeSim(temas, pools, N, rnd = Math.random) {
  const act = temas.filter(t => (pools[t.id] || []).length);
  if (!act.length) return [];
  N = Math.min(N, act.reduce((s, t) => s + pools[t.id].length, 0));
  const wt = t => (t.w > 0 ? t.w : 1); // un tema sin peso oficial cuenta como 1
  const tot = act.reduce((s, t) => s + wt(t), 0);
  const q = act.map(t => ({ t: t.id, x: N * wt(t) / tot }));
  q.forEach(o => { o.k = Math.min(Math.floor(o.x), pools[o.t].length); o.r = o.x - Math.floor(o.x); });
  let rest = N - q.reduce((s, o) => s + o.k, 0);
  for (const o of q.slice().sort((a, b) => b.r - a.r)) { if (rest > 0 && o.k < pools[o.t].length) { o.k++; rest--; } }
  while (rest > 0) { const o = q.find(x => x.k < pools[x.t].length); if (!o) break; o.k++; rest--; }
  const out = [];
  for (const o of q) out.push(...pools[o.t].slice(0, o.k));
  return shuffle(out, rnd);
}

// Mapa de dominio por tema (ver README). rec(id) devuelve el registro [n, ok, last, box, due, lastRes, flag] o undefined.
export const COV_OBJ = 0.6;
export function dominioCalc(temas, idsOf, rec, t0) {
  return temas.map(t => {
    let seen = 0, okNow = 0, last = 0, due = 0, att = 0;
    for (const id of idsOf(t.id) || []) {
      const r = rec(id); if (!r || !r[0]) continue;
      seen++; att += r[0]; if (r[5] === 1) okNow++; if (r[2] > last) last = r[2];
      if (r[3] >= 0 && r[4] && r[4] <= t0) due++;
    }
    const prec = seen ? okNow / seen : 0;
    const cob = Math.min(1, seen / Math.max(1, t.n * COV_OBJ));
    const dias = last ? Math.floor((t0 - last) / 86400000) : null;
    const score = Math.round(100 * (0.65 * prec + 0.35 * cob));
    let est, why;
    if (!seen || att < 5) { est = 'n'; why = seen ? 'Pocas respuestas todavía' : 'Sin empezar'; }
    else if (score < 50) { est = 'r'; why = prec < 0.5 ? 'Muchos fallos recientes' : 'Cobertura baja'; }
    else if (dias > 30) { est = 'r'; why = 'Más de 30 días sin tocar'; }
    else if (score < 75) { est = 'y'; why = prec < 0.75 ? 'Aún fallas bastante' : 'Te falta ver preguntas'; }
    else if (dias > 14) { est = 'y'; why = 'Se está enfriando'; }
    else { est = 'g'; why = 'Bien y reciente'; }
    return { ...t, seen, prec: Math.round(100 * prec), cob: Math.round(100 * cob), score, dias, due, est, why };
  });
}

// ── Evolución por semanas ──
// Lunes (hora local) 00:00 de la semana de ts.
export function weekStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
// sessions: sesiones guardadas. filtro: {tema} | {tipo} | {}. Devuelve las últimas `weeks` semanas (con huecos a n=0).
export function aggregateWeeks(sessions, { tema, tipo, weeks = 12, now = Date.now() } = {}) {
  const w0 = weekStart(now), out = [];
  for (let i = weeks - 1; i >= 0; i--) { const d = new Date(w0); d.setDate(d.getDate() - 7 * i); out.push({ start: d.getTime(), n: 0, ok: 0, secs: 0, ses: 0 }); }
  const byStart = new Map(out.map(o => [o.start, o]));
  for (const s of sessions) {
    const o = byStart.get(weekStart(s.ts)); if (!o) continue;
    let ok, n;
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
export function slowList(stats, { soloAcertadas = false, min = 1, limit = 15 } = {}) {
  const out = [];
  for (const id in stats) {
    const r = stats[id]; const tn = r[8] || 0; if (tn < min) continue;
    if (soloAcertadas && r[5] !== 1) continue;
    out.push({ id, avg: Math.round(10 * r[7] / tn) / 10, n: r[0], ok: r[1], last: r[5], tn });
  }
  return out.sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, limit);
}

// ── Sesión rápida ──
// Nº de preguntas para ~5 minutos según tu tiempo medio por pregunta (30 s si aún no hay datos).
export function quickN(stats, minutos = 5) {
  let secs = 0, n = 0;
  for (const id in stats) { const r = stats[id]; if (r[8]) { secs += r[7]; n += r[8]; } }
  const avg = n >= 10 ? secs / n : 30;
  return Math.max(6, Math.min(15, Math.round(minutos * 60 / Math.max(5, avg))));
}
// due: preguntas con repaso vencido (las más antiguas primero). pools: preguntas nuevas por tema, temas más débiles primero.
// Hasta el 60 % son repasos; el resto, nuevas repartidas por turnos entre los temas. Si faltan de un tipo, se completa con el otro.
export function pickQuick(due, pools, N, rnd = Math.random) {
  const nDue = Math.min(due.length, Math.ceil(N * 0.6));
  const out = due.slice(0, nDue), seen = new Set(out.map(q => q.i));
  const cur = pools.map(p => p.filter(q => !seen.has(q.i)));
  let guard = 0;
  while (out.length < N && cur.some(p => p.length) && guard++ < 1000) {
    for (const p of cur) { if (out.length >= N) break; const q = p.shift(); if (q && !seen.has(q.i)) { out.push(q); seen.add(q.i); } }
  }
  for (const q of due.slice(nDue)) { if (out.length >= N) break; if (!seen.has(q.i)) { out.push(q); seen.add(q.i); } }
  return shuffle(out, rnd);
}

// ── Historial de simulacros ──
// Devuelve las sesiones de simulacro en orden cronológico, con la parte (p1 conocimientos / p2 supuesto) y la
// diferencia de nota respecto al intento anterior de la misma parte.
export function simHistory(sessions) {
  const sims = sessions.filter(s => s.kind === 'sim').slice().sort((a, b) => a.ts - b.ts);
  const prev = {};
  return sims.map(s => {
    const part = /Parte 2/.test(s.titulo || '') ? 'p2' : 'p1';
    const p = prev[part]; prev[part] = s;
    return { ...s, part, dNota: p ? Math.round((s.nota - p.nota) * 10) / 10 : null };
  });
}
// Compara dos sesiones por tema (acierto %), más totales. d = b − a (puntos porcentuales).
export function compareSessions(a, b) {
  const temas = [...new Set([...Object.keys(a.temas || {}), ...Object.keys(b.temas || {})])].sort();
  const pc = v => (v && v[1]) ? Math.round(100 * v[0] / v[1]) : null;
  const rows = temas.map(t => { const pa = pc(a.temas?.[t]), pb = pc(b.temas?.[t]); return { t, pa, pb, na: a.temas?.[t]?.[1] || 0, nb: b.temas?.[t]?.[1] || 0, d: pa !== null && pb !== null ? pb - pa : null }; });
  return { rows, dNota: Math.round((b.nota - a.nota) * 10) / 10, dAcierto: pct(b.a, b.n) - pct(a.a, a.n), dSeg: a.n && b.n ? Math.round(10 * (b.secs / b.n - a.secs / a.n)) / 10 : null };
}

// ── Mis trampas ──
// trapsOf(id) → lista de ids de trampa de la pregunta. Devuelve las trampas con más fallos (≥ min respuestas).
export function trapRates(stats, trapsOf, min = 5) {
  const T = {};
  for (const id in stats) {
    const r = stats[id]; const err = r[0] - r[1];
    for (const k of trapsOf(id) || []) { const b = T[k] ||= { k: +k, n: 0, err: 0 }; b.n += r[0]; b.err += err; }
  }
  return Object.values(T).filter(x => x.n >= min).map(x => ({ ...x, rate: x.err / x.n })).sort((a, b) => b.rate - a.rate || b.n - a.n);
}
// cands: preguntas con `x` (lista de trampas); rec(id) → registro. Prioridad: falladas la última vez, luego nunca vistas, luego el resto;
// dentro de cada grupo, primero las que reúnen más trampas objetivo.
export function pickTrampas(cands, rec, targets, N, rnd = Math.random) {
  const tg = new Set(targets.map(Number));
  const score = q => (q.x || []).filter(k => tg.has(+k)).length;
  const tier = q => { const r = rec(q.i); return r && r[5] === 0 ? 0 : !r ? 1 : 2; };
  const g = [[], [], []];
  for (const q of cands) if (score(q)) g[tier(q)].push(q);
  const out = [];
  for (const grp of g) {
    const byScore = {}; for (const q of grp) (byScore[score(q)] ||= []).push(q);
    for (const s of Object.keys(byScore).sort((a, b) => b - a)) out.push(...shuffle(byScore[s], rnd));
  }
  return out.slice(0, N);
}

// ── Informes de errores del banco ──
export const MOTIVOS = ['Respuesta correcta mal marcada', 'Enunciado erróneo o confuso', 'Opciones repetidas o dos correctas', 'La cita del temario no coincide', 'Otro'];

// ───────── comodidad: tema, tamaño, gestos y teclado ─────────
export const TEMAS_UI = ['auto', 'light', 'dark'];
export const ZOOMS = [1, 1.15, 1.3, 1.5];
export function normUi(u) {
  u = u && typeof u === 'object' ? u : {};
  return { theme: TEMAS_UI.includes(u.theme) ? u.theme : 'auto', size: Number.isInteger(u.size) && u.size >= 0 && u.size < ZOOMS.length ? u.size : 0, lectura: [0, 1, 2].includes(u.lectura) ? u.lectura : 0 };
}
// Desplazamiento horizontal claro y no vertical → 'next' | 'prev' | null
export function swipeDir(dx, dy, min = 70) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < min || ax < ay * 1.6 || ay > 90) return null;
  return dx < 0 ? 'next' : 'prev';
}
// Tecla → acción del test (nOpts = nº de opciones de la pregunta)
export function keyAction(e, nOpts = 4) {
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
const DIA = 86400000;
// items: [{ i, t, due }]. Las más vencidas primero (hasta n) y mezcladas por tema, sin repetir tema seguido si se puede.
export function pickRepaso(items, n) {
  const top = [...items].sort((a, b) => a.due - b.due).slice(0, n);
  const by = new Map();
  for (const x of top) { if (!by.has(x.t)) by.set(x.t, []); by.get(x.t).push(x); }
  const out = []; let last = null;
  while (out.length < top.length) {
    const keys = [...by.keys()].filter(k => by.get(k).length);
    keys.sort((a, b) => by.get(b).length - by.get(a).length);
    const k = keys.find(x => x !== last) ?? keys[0];
    out.push(by.get(k).shift()); last = k;
  }
  return out;
}
// Preguntas que vencen cada día: [hoy y atrasadas, +1, …, +(days-1)] (días naturales locales)
export function cargaRepasos(stats, now, days = 14) {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const out = new Array(days).fill(0);
  for (const id in stats) {
    const r = stats[id]; if (!(r[3] >= 0) || !r[4]) continue;
    const k = Math.floor((r[4] - d0.getTime()) / DIA);
    if (k < days) out[Math.max(0, k)]++;
  }
  return out;
}
// Recuento de motivos de la última falta (solo preguntas cuya última respuesta fue un fallo)
export function motivosFallo(stats) {
  const c = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const id in stats) { const r = stats[id]; if (r[5] === 0 && (r[9] >= 1 && r[9] <= 5 || r[9] === 7)) c[r[9]]++; }
  return c;
}
// Aciertos marcados como «suerte» (último resultado acierto)
export function suertes(stats) {
  let n = 0;
  for (const id in stats) { const r = stats[id]; if (r[5] === 1 && (r[9] === 6 || r[9] === 8)) n++; }
  return n;
}

// ───────── tarjetas (flashcards) ─────────
// cards: [{ id, t, ... }]; recs: { id: [n, ok, last, box, due, lastGrade] }
// Devuelve hasta n tarjetas: primero las vencidas (más atrasadas primero), luego nuevas de los temas permitidos
// (máx. maxNew), todo mezclado por tema. seen: Set de temas permitidos para las nuevas (null = todos).
export function pickCards(cards, recs, { n = 20, now = Date.now(), maxNew = 10, seen = null } = {}) {
  const due = [], fresh = [];
  for (const c of cards) {
    const r = recs[c.id];
    if (r) { if (r[3] >= 0 && r[4] <= now) due.push({ i: c.id, t: c.t, due: r[4] }); }
    else if (!seen || seen.has(c.t)) fresh.push(c);
  }
  const out = pickRepaso(due, n).map(x => x.i);
  const room = Math.min(n - out.length, maxNew);
  if (room > 0 && fresh.length) {
    const by = new Map();
    for (const c of fresh) { if (!by.has(c.t)) by.set(c.t, []); by.get(c.t).push(c.id); }
    const ts = [...by.keys()].sort(); let k = 0;
    while (k < room && ts.some(t => by.get(t).length)) for (const t of ts) { if (k >= room) break; const x = by.get(t).shift(); if (x) { out.push(x); k++; } }
  }
  return out;
}
export function cardStats(cards, recs, now = Date.now()) {
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
export function cardFromQuestion(q) {
  return { id: 'FC-Q-' + q.i, t: q.t, tipo: 'fallo', src: 'fallo', q: q.q, a: q.a[q.c], nota: q.n || '', ref: q.u || '' };
}

// Resalta en negrita (HTML ya escapado) el fragmento de `u` que mejor responde con `ans`.
const STOP = new Set('para como pero este esta estos estas esos esas sobre entre desde hasta cada todo todos toda todas otro otra otros otras puede pueden será serán solo sólo tiene tienen según cuando donde mientras ellos ellas dicho dicha cual cuales'.split(' '));
const normW = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');
export function hiliteHtml(u, ans) {
  const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  u = String(u || ''); ans = String(ans || '');
  const toks = u.split(/(\s+)/);           // palabras y separadores
  const idx = []; toks.forEach((t, i) => { if (t && !/^\s+$/.test(t)) idx.push(i); });
  const nw = idx.map(i => normW(toks[i]));
  const aw = new Set(ans.split(/\s+/).map(normW).filter(w => w.length > 3 && !STOP.has(w) || /^\d+$/.test(w)));
  if (!aw.size || !idx.length) return escH(u);
  const hit = nw.map(w => aw.has(w));
  let best = null; const maxLen = Math.min(idx.length, aw.size * 2 + 6);
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
export function claveSpans(text) {
  const t = String(text ?? ''), out = []; let m; KW.lastIndex = 0;
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
export function claveHtml(text) {
  const t = String(text ?? ''); let h = '', p = 0;
  for (const [a, b] of claveSpans(t)) { h += esc(t.slice(p, a)) + '<mark class="kw">' + esc(t.slice(a, b)) + '</mark>'; p = b; }
  return h + esc(t.slice(p));
}

// ───────── código: detección y marcado (SQL, comandos, etiquetas, funciones, rutas…) ─────────
const SQL_KW = 'SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LEFT OUTER JOIN|RIGHT OUTER JOIN|FULL OUTER JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|CROSS JOIN|NATURAL JOIN|JOIN|ON|AS|AND|OR|NOT NULL|NOT|NULL|IS|IN|BETWEEN|LIKE|DISTINCT|UNION ALL|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|CREATE VIEW|CREATE INDEX|ALTER TABLE|DROP TABLE|DROP VIEW|DROP INDEX|PRIMARY KEY|FOREIGN KEY|REFERENCES|GRANT|REVOKE|COMMIT|ROLLBACK|TRUNCATE|ASC|DESC|LIMIT|EXISTS|ALL|ANY|COUNT|SUM|AVG|MAX|MIN';
const SQL_KW_RE = new RegExp('(?<![\\p{L}\\d_])(' + SQL_KW + ')(?![\\p{L}\\d_])', 'gu');
const SQL_START = /(?<![\p{L}\d_])(SELECT\s|INSERT INTO\s|UPDATE\s+[\p{L}_]+\s+SET|DELETE FROM\s|CREATE\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|ALTER\s+TABLE\s|DROP\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|GRANT\s|REVOKE\s)/gu;
const SQL_WORDS = /(?<![\p{L}\d_])(ORDER BY|GROUP BY|(?:LEFT|RIGHT|FULL)(?: OUTER)? JOIN|INNER JOIN|CROSS JOIN|NATURAL JOIN|PRIMARY KEY|FOREIGN KEY|NOT NULL|UNION(?: ALL)?|SELECT|INSERT|UPDATE|DELETE|WHERE|HAVING|DISTINCT|COMMIT|ROLLBACK|TRUNCATE|NULL|COUNT\(\*\))(?![\p{L}\d_])/gu;
const CMDS = '(?:chmod|chown|chgrp|grep|sudo|ping|ssh|scp|ifconfig|ipconfig|nslookup|traceroute|netstat|systemctl|mkdir|rsync|tar(?=\\s+-)|apt-get|umask|git\\s+(?:add|commit|push|pull|clone|status|log|branch|checkout|merge|rebase|init|fetch|diff|stash|reset|remote|tag)|docker\\s+(?:run|build|ps|pull|push|exec|images|compose|stop|rm|start)|kubectl\\s+(?:get|apply|describe|delete|logs|exec)|curl|wget)';
const CODE_RES = [
  /<\?php[\s\S]*?(?:\?>|$)/g,                                                              // PHP
  /<\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>/g,                                                  // etiquetas HTML/XML y genéricos <tipo>
  /(?<![\w.])\/(?:etc|var|usr|home|bin|dev|proc|tmp|opt|root)(?:\/[\w.*-]+)*/g,             // rutas Linux
  /(?<![\w.-])[a-z0-9_][\w-]*\.(?:php|java|js|ts|py|xml|html|css|conf|sh|sql|json|ini|txt|log|yml|yaml|cfg|bat|tar|gz|zip)\b/g, // ficheros
  new RegExp('(?<![\\w-])' + CMDS + '\\b(?:\\s+-{1,2}[\\w-]+|\\s+\\d{3,4}\\b)*', 'g'),     // comandos con sus opciones
  /(?<=^|[\s(])--?[A-Za-z][\w-]*(?=[\s.,;:)]|$)/g,                                         // opciones -R, --force
  /(?<![\p{L}\d_$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\((?:[^()]|\([^()]*\))*\)/gu,   // llamadas f(...), a.b(...)
  /[^\s]*(?:===?|!==?|\+\+|->|=>|&&|\|\|)[^\s]*/g,                                         // operadores
  /(?<![\p{L}\d_$])[A-Za-z_$][\w$.]*=[\w$.'"]+/gu,                                          // a=b, A.a=B.b
  /(?<![\p{L}\d_$])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\p{L}\d_$])/gu,                        // snake_case
  /(?<![\p{L}\d_$])(?!(?:macOS|iOS|iPadOS|iPhone|iPad|iCloud|iMac|tvOS|watchOS|visionOS|openSUSE|eDNI|eIDAS|iTunes|eBay|iOS)\b)[a-z]{2,}(?:[A-Z][a-z0-9]*)+(?![\p{L}\d_$])/gu, // camelCase
  /(?<![\p{L}\d_$])[a-z]\s+(?:XNOR|NAND|XOR|NOR|AND|OR)\s+[a-z]\s*=\s*\d(?![\p{L}\d_$])/gu,        // a XOR b = 1
];
const noEsLlamada = /^(?:\d|[A-Z]{1,2}$)/;
function rangosCodigo(t) {
  const r = [];
  // sentencias SQL completas: desde la palabra inicial hasta «;», o hasta el final de la frase, o el final del texto
  SQL_START.lastIndex = 0; let m;
  while ((m = SQL_START.exec(t))) {
    const a = m.index; let b = t.length;
    const semi = t.indexOf(';', a); if (semi >= 0) b = semi + 1;
    const fin = /\.\s+(?=[¿¡A-ZÁÉÍÓÚÑ])|[?!]\s|\?$/g; fin.lastIndex = a; const f = fin.exec(t);
    if (f && f.index < b) b = f.index;
    let e = b; while (e > a && /[\s.]/.test(t[e - 1])) e--;
    if (e > a + 6) { r.push([a, e]); SQL_START.lastIndex = Math.max(e, a + 1); }
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
  const u = [];
  for (const [a, b] of r) { const l = u[u.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else u.push([a, b]); }
  // «;» pegado al final de una sentencia forma parte del código
  for (const x of u) if (t[x[1]] === ';') x[1]++;
  // fragmentos de código separados solo por «,», «;» o por un identificador suelto entre ellos («a=10,b; b=a++;») son un único bloque
  const GAP = /^\s+$|^\s*[,;]\s*(?:[A-Za-z_]\w{0,15}\s*[,;]\s*)?$/;
  const v = [];
  for (const x of u) { const l = v[v.length - 1]; if (l && x[0] >= l[1] && GAP.test(t.slice(l[1], x[0]))) l[1] = x[1]; else v.push([...x]); }
  return v;
}
export function codeSpans(text) { return rangosCodigo(String(text ?? '')); }
const codeInner = h => h.replace(SQL_KW_RE, '<b class="sk">$1</b>');
// Texto → HTML seguro: escapa todo, pone en tipografía de código lo que lo parece y (opcional) resalta las palabras clave de lectura.
export function richHtml(text, clave = false) {
  const t = String(text ?? ''), code = rangosCodigo(t), key = clave ? claveSpans(t) : [];
  const cuts = new Set([0, t.length]);
  for (const [a, b] of code) { cuts.add(a); cuts.add(b); }
  for (const [a, b] of key) { cuts.add(a); cuts.add(b); }
  const pts = [...cuts].sort((x, y) => x - y); let h = '';
  const dentro = (L, i) => L.some(([a, b]) => i >= a && i < b);
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
export const pideNegativa = q => /\b(INCORRECT[OA]S?|FALS[OA]S?|EXCEPTO|SALVO|NO)\b/.test(q) || /\b(incorrect[oa]s?|fals[oa]s?|excepto|salvo)\b/i.test(q) || /\bno (es|son|se|forma|corresponde|pertenece|permite)\b/i.test(q);
// Segundos mínimos razonables para leer enunciado + opciones con atención (~3,3 palabras/s)
export function minLectura(q) {
  const txt = [q.cp, q.q, ...(q.a || [])].filter(Boolean).join(' ');
  const w = txt.split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.min(30, Math.round(w / 3.3)));
}
// Resumen de fallos por velocidad
export function velocidad(stats) {
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

// Análisis de ritmo y puntos de un simulacro. correct[k] = índice correcto; ans[k] = respuesta (undefined/-1 = blanco);
// times[k] = segundos empleados (si se contestó); limitSecs = tiempo total del simulacro.
export function analisisSimulacro({ correct, ans, times = [], limitSecs, secs }) {
  const n = correct.length; let a = 0, f = 0, b = 0; const tm = [];
  correct.forEach((c, k) => {
    const x = ans[k];
    if (x === undefined || x === -1) b++; else if (x === c) a++; else f++;
    if (times[k] > 0 && x !== undefined && x !== -1) tm.push({ k, t: times[k], ok: x === c });
  });
  const presupuesto = n && limitSecs ? limitSecs / n : 0;
  const media = tm.length ? Math.round(tm.reduce((s, r) => s + r.t, 0) / tm.length) : 0;
  const lentas = tm.slice().sort((x, y) => y.t - x.t).slice(0, 3).filter(r => !presupuesto || r.t > presupuesto * 1.5);
  const rapidasFalladas = tm.filter(r => !r.ok && presupuesto && r.t < presupuesto * 0.4).length;
  return {
    n, a, f, b, presupuesto: Math.round(presupuesto), media, lentas, rapidasFalladas,
    sinPenal: n ? Math.round(1000 * a / n) / 10 : 0,
    perdidoFallos: n ? Math.round(1000 * (f / 3) / n) / 10 : 0,
    uso: limitSecs ? Math.round(100 * Math.min(secs, limitSecs) / limitSecs) : 0,
  };
}
// Diferencia entre preguntas contestadas y las que tocarían al ritmo del simulacro (positivo = vas por delante).
export const ritmoSimulacro = (hechas, n, limitSecs, secs) => limitSecs && n ? Math.round(hechas - secs / (limitSecs / n)) : 0;
