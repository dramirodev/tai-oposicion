import { describe, it, expect } from 'vitest';
import { esc, shuffle, fmtT, pct, nota, allowed, composeSim, dominioCalc, weekStart, aggregateWeeks, slowList, quickN, pickQuick, pickGuest, simHistory, compareSessions, trapRates, pickTrampas, MOTIVOS } from '../src/domain/logic.js';

describe('nota', () => {
  it('aciertos suman y fallos restan un tercio', () => {
    expect(nota(60, 0, 80)).toBe(75);
    expect(nota(60, 9, 80)).toBe(71.3); // (60-3)/80
    expect(nota(80, 0, 80)).toBe(100);
  });
  it('los blancos no penalizan y n=0 no divide por cero', () => {
    expect(nota(40, 0, 80)).toBe(50);
    expect(nota(0, 0, 0)).toBe(0);
  });
  it('puede ser negativa si hay muchos fallos', () => { expect(nota(0, 30, 30)).toBeLessThan(0); });
});
describe('utilidades', () => {
  it('pct', () => { expect(pct(1, 3)).toBe(33); expect(pct(2, 0)).toBe(0); });
  it('fmtT', () => { expect(fmtT(65)).toBe('1:05'); expect(fmtT(3725)).toBe('1:02:05'); expect(fmtT(-5)).toBe('0:00'); });
  it('esc neutraliza HTML', () => {
    expect(esc('<img src=x onerror="a">')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;');
    expect(esc(null)).toBe(''); expect(esc("it's & co")).toBe('it&#39;s &amp; co');
  });
  it('allowed filtra por origen y excluye reservas', () => {
    expect(allowed({ o: 'O' }, new Set(['O']))).toBe(true);
    expect(allowed({ o: 'A' }, new Set(['O']))).toBe(false);
    expect(allowed({ o: 'O', r: 1 }, new Set(['O']))).toBe(false);
  });
  it('shuffle conserva los elementos, no muta y es determinista con rnd fijo', () => {
    const a = [1, 2, 3, 4, 5, 6]; const b = shuffle(a);
    expect(a).toEqual([1, 2, 3, 4, 5, 6]); expect([...b].sort()).toEqual(a);
    const seq = () => { let i = 0; return () => [0.1, 0.9, 0.5, 0.3, 0.7][i++ % 5]; };
    expect(shuffle(a, seq())).toEqual(shuffle(a, seq()));
  });
});

const mk = (t, n) => Array.from({ length: n }, (_, i) => ({ i: `${t}-${i}`, t }));
describe('composeSim', () => {
  const temas = [{ id: 'A', w: 6 }, { id: 'B', w: 3 }, { id: 'C', w: 1 }];
  const pools = { A: mk('A', 100), B: mk('B', 100), C: mk('C', 100) };
  it('devuelve exactamente N preguntas sin duplicados', () => {
    for (const N of [10, 40, 80, 37]) {
      const r = composeSim(temas, pools, N);
      expect(r).toHaveLength(N); expect(new Set(r.map(x => x.i)).size).toBe(N);
    }
  });
  it('reparte según el peso', () => {
    const r = composeSim(temas, pools, 100); const c = t => r.filter(x => x.t === t).length;
    expect([c('A'), c('B'), c('C')]).toEqual([60, 30, 10]);
  });
  it('si un tema tiene pocas preguntas, rellena con los demás', () => {
    const r = composeSim(temas, { A: mk('A', 2), B: mk('B', 100), C: mk('C', 100) }, 40);
    expect(r).toHaveLength(40); expect(r.filter(x => x.t === 'A')).toHaveLength(2);
  });
  it('se acorta si no hay preguntas suficientes y no falla con pools vacíos', () => {
    expect(composeSim(temas, { A: mk('A', 3), B: [], C: [] }, 40)).toHaveLength(3);
    expect(composeSim(temas, { A: [], B: [], C: [] }, 40)).toEqual([]);
  });
  it('un tema sin peso cuenta como 1 y no rompe el reparto', () => {
    const r = composeSim([{ id: 'A', w: 0 }, { id: 'B', w: 0 }], { A: mk('A', 50), B: mk('B', 50) }, 20);
    expect(r).toHaveLength(20); expect(r.filter(x => x.t === 'A')).toHaveLength(10);
  });
  it('usa solo los temas pasados (modo temas vistos)', () => {
    const r = composeSim([temas[1]], pools, 20); expect(r.every(x => x.t === 'B')).toBe(true);
  });
});

describe('dominioCalc (semáforo)', () => {
  const D = 86400000, T0 = 1_800_000_000_000;
  const mkRec = (n, okFrac, days, extra = {}) => {
    const ids = Array.from({ length: n }, (_, i) => 'q' + i);
    const recs = Object.fromEntries(ids.map((id, i) => [id, [2, i < n * okFrac ? 2 : 0, T0 - days * D, -1, 0, i < n * okFrac ? 1 : 0, 0]]));
    return { ids, rec: id => recs[id], ...extra };
  };
  const run = (n, okFrac, days, total = 20) => { const { ids, rec } = mkRec(n, okFrac, days); return dominioCalc([{ id: 'X', n: total }], () => ids, rec, T0)[0]; };
  it('sin datos', () => { expect(dominioCalc([{ id: 'X', n: 50 }], () => ['a'], () => undefined, T0)[0].est).toBe('n'); });
  it('pocas respuestas = sin datos', () => { expect(run(2, 1, 1, 100).est).toBe('n'); });
  it('verde: acierta, cubre y reciente', () => { expect(run(15, 0.95, 2).est).toBe('g'); });
  it('ámbar: bien pero lleva 15-30 días parado', () => { const r = run(15, 0.95, 20); expect(r.est).toBe('y'); expect(r.why).toMatch(/enfriando/); });
  it('rojo: más de 30 días sin tocar', () => { expect(run(15, 0.95, 45).est).toBe('r'); });
  it('rojo: muchos fallos', () => { expect(run(15, 0.2, 1).est).toBe('r'); });
  it('ámbar: buen acierto pero faltan preguntas por ver', () => { const r = run(6, 1, 1, 200); expect(r.est).toBe('y'); expect(r.why).toMatch(/falta ver/); });
  it('rojo por cobertura baja con acierto medio', () => { const r = run(10, 0.6, 1, 500); expect(r.est).toBe('r'); expect(r.why).toMatch(/Cobertura/); });
  it('cuenta repasos vencidos y días', () => {
    const rec = id => [2, 0, T0 - 3 * D, 0, T0 - 1, 0, 0];
    const r = dominioCalc([{ id: 'X', n: 10 }], () => ['a', 'b', 'c'], rec, T0)[0];
    expect(r.due).toBe(3); expect(r.dias).toBe(3);
  });
});

describe('evolución semanal', () => {
  const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
  it('weekStart devuelve el lunes a las 00:00', () => {
    const w = new Date(weekStart(day(2026, 10, 22))); // jueves
    expect([w.getDay(), w.getHours(), w.getDate()]).toEqual([1, 0, 19]);
    expect(new Date(weekStart(day(2026, 10, 25, 23))).getDate()).toBe(19); // domingo
    expect(new Date(weekStart(day(2026, 10, 26, 0))).getDate()).toBe(26); // lunes
  });
  const ses = (ts, a, n, secs, extra = {}) => ({ id: 's' + ts, ts, kind: 'test', a, n, f: n - a, b: 0, secs, temas: {}, tipos: {}, ...extra });
  const now = day(2026, 10, 22);
  it('agrupa por semana, rellena huecos y calcula acierto y segundos por pregunta', () => {
    const W = aggregateWeeks([ses(day(2026, 10, 20), 8, 10, 200), ses(day(2026, 10, 21), 6, 10, 100), ses(day(2026, 10, 7), 5, 10, 300)], { weeks: 4, now });
    expect(W).toHaveLength(4);
    expect(W.map(w => w.n)).toEqual([0, 10, 0, 20]);
    expect(W[3].acierto).toBe(70); expect(W[3].segPreg).toBe(15); expect(W[3].ses).toBe(2);
    expect(W[0].acierto).toBeNull();
  });
  it('ignora sesiones fuera del periodo', () => {
    const W = aggregateWeeks([ses(day(2026, 1, 5), 1, 1, 1)], { weeks: 4, now }); expect(W.every(w => w.n === 0)).toBe(true);
  });
  it('filtra por tema y por tipo', () => {
    const s1 = ses(day(2026, 10, 21), 5, 10, 100, { temas: { 'T1.01': [3, 4], 'T1.02': [2, 6] }, tipos: { D: [4, 5], I: [1, 5] } });
    expect(aggregateWeeks([s1], { tema: 'T1.01', weeks: 1, now })[0].acierto).toBe(75);
    expect(aggregateWeeks([s1], { tipo: 'I', weeks: 1, now })[0].acierto).toBe(20);
    expect(aggregateWeeks([s1], { tema: 'T9.99', weeks: 1, now })[0].n).toBe(0);
    expect(aggregateWeeks([ses(day(2026, 10, 21), 1, 1, 1)], { tipo: 'D', weeks: 1, now })[0].n).toBe(0); // sesión antigua sin tipos
  });
});

describe('preguntas lentas', () => {
  const r = (n, ok, lastRes, secs, tn) => [n, ok, 1, -1, 0, lastRes, 0, secs, tn];
  const stats = { a: r(3, 3, 1, 90, 3), b: r(2, 0, 0, 100, 2), c: r(1, 1, 1, 20, 1), d: r(4, 4, 1, 0, 0), e: [1, 1, 1, -1, 0, 1, 0] };
  it('ordena por tiempo medio y excluye las sin cronometrar', () => {
    const l = slowList(stats); expect(l.map(x => x.id)).toEqual(['b', 'a', 'c']); expect(l[0].avg).toBe(50); expect(l[1].avg).toBe(30);
  });
  it('filtra las acertadas, el mínimo de intentos y el límite', () => {
    expect(slowList(stats, { soloAcertadas: true }).map(x => x.id)).toEqual(['a', 'c']);
    expect(slowList(stats, { min: 2 }).map(x => x.id)).toEqual(['b', 'a']);
    expect(slowList(stats, { limit: 1 })).toHaveLength(1);
  });
});

describe('sesión rápida', () => {
  const Q = (t, n, p = t) => Array.from({ length: n }, (_, i) => ({ i: `${p}-${i}`, t }));
  it('quickN: 10 por defecto y se ajusta a tu ritmo con límites', () => {
    expect(quickN({})).toBe(10);
    const rapido = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['q' + i, [1, 1, 1, -1, 0, 1, 0, 10, 1]]));
    expect(quickN(rapido)).toBe(15); // 10 s por pregunta → tope 15
    const lento = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['q' + i, [1, 1, 1, -1, 0, 1, 0, 100, 1]]));
    expect(quickN(lento)).toBe(6); // 100 s → mínimo 6
    expect(quickN({ a: [1, 1, 1, -1, 0, 1, 0, 100, 1] })).toBe(10); // con menos de 10 muestras se ignora
  });
  it('mezcla repasos (≤60 %) y nuevas hasta N, sin duplicados', () => {
    const r = pickQuick(Q('D', 10), [Q('A', 10), Q('B', 10)], 10);
    expect(r).toHaveLength(10); expect(new Set(r.map(x => x.i)).size).toBe(10);
    expect(r.filter(x => x.t === 'D')).toHaveLength(6);
    expect(r.filter(x => x.t === 'A')).toHaveLength(2); expect(r.filter(x => x.t === 'B')).toHaveLength(2);
  });
  it('si hay pocos repasos, el resto son nuevas', () => {
    const r = pickQuick(Q('D', 2), [Q('A', 20)], 10); expect(r).toHaveLength(10); expect(r.filter(x => x.t === 'D')).toHaveLength(2);
  });
  it('si no hay nuevas, completa con más repasos', () => {
    const r = pickQuick(Q('D', 20), [], 10); expect(r).toHaveLength(10); expect(r.every(x => x.t === 'D')).toBe(true);
  });
  it('si no hay nada devuelve vacío; si hay menos que N, devuelve lo que hay', () => {
    expect(pickQuick([], [], 10)).toEqual([]); expect(pickQuick(Q('D', 3), [Q('A', 2)], 10)).toHaveLength(5);
  });
  it('reparte las nuevas por turnos entre temas (el primero es el más débil)', () => {
    const r = pickQuick([], [Q('A', 10), Q('B', 10), Q('C', 10)], 5); const c = k => r.filter(x => x.t === k).length;
    expect([c('A'), c('B'), c('C')]).toEqual([2, 2, 1]);
  });
  it('una pregunta repetida en repasos y nuevas no sale dos veces', () => {
    const d = Q('D', 3), n = [[...d, ...Q('A', 5)]]; const r = pickQuick(d, n, 8); expect(new Set(r.map(x => x.i)).size).toBe(r.length);
  });
});

describe('historial de simulacros', () => {
  const S = (id, ts, nota, titulo, temas = {}, extra = {}) => ({ id, ts, kind: 'sim', n: 80, a: 50, f: 10, b: 20, secs: 4000, nota, titulo, temas, ...extra });
  const L = [S('b', 20, 60, 'Simulacro · Parte 1'), { ...S('x', 25, 40, 'Test'), kind: 'test' }, S('a', 10, 50, 'Simulacro · Parte 1'), S('c', 30, 70, 'Simulacro · Parte 2 (supuesto)'), S('d', 40, 66.5, 'Simulacro · Parte 1')];
  it('solo simulacros, en orden cronológico y con la parte', () => {
    const h = simHistory(L); expect(h.map(x => x.id)).toEqual(['a', 'b', 'c', 'd']); expect(h.map(x => x.part)).toEqual(['p1', 'p1', 'p2', 'p1']);
  });
  it('diferencia de nota respecto al intento anterior de la misma parte', () => {
    const h = simHistory(L); expect(h.map(x => x.dNota)).toEqual([null, 10, null, 6.5]);
  });
  it('compara por tema con diferencias y huecos', () => {
    const a = S('a', 1, 50, 'p', { 'T1.01': [5, 10], 'T1.02': [2, 4] }), b = S('b', 2, 62.5, 'p', { 'T1.01': [8, 10], 'T1.03': [1, 2] });
    const c = compareSessions(a, b);
    expect(c.dNota).toBe(12.5); expect(c.rows.map(r => r.t)).toEqual(['T1.01', 'T1.02', 'T1.03']);
    expect(c.rows[0]).toMatchObject({ pa: 50, pb: 80, d: 30 }); expect(c.rows[1]).toMatchObject({ pa: 50, pb: null, d: null }); expect(c.rows[2].pa).toBeNull();
  });
});

describe('mis trampas', () => {
  const rec = (n, ok) => [n, ok, 1, -1, 0, 1, 0];
  const traps = { a: [1, 2], b: [1], c: [3], d: [3, 4], e: [] };
  const stats = { a: rec(4, 1), b: rec(4, 2), c: rec(5, 5), d: rec(2, 0), e: rec(10, 0) };
  it('ordena las trampas por tasa de fallo y exige un mínimo de respuestas', () => {
    const r = trapRates(stats, id => traps[id], 5);
    expect(r.map(x => x.k)).toEqual([1, 3]); // la 2 (4 resp.) y la 4 (2 resp.) quedan fuera por el mínimo
  });
  it('tasa y recuentos', () => {
    const r = trapRates(stats, id => traps[id], 4); expect(r.map(x => x.k)).toEqual([2, 1, 3]);
    expect(r[1]).toMatchObject({ k: 1, n: 8, err: 5 }); expect(r[1].rate).toBeCloseTo(0.625);
    expect(trapRates({}, () => [], 1)).toEqual([]);
  });
  const Q = (i, x) => ({ i, x });
  it('prioriza falladas, luego nuevas, y más trampas objetivo primero', () => {
    const cands = [Q('seen', [1]), Q('failed', [1]), Q('new1', [1]), Q('new2', [1, 2]), Q('otra', [9])];
    const rc = id => ({ seen: [1, 1, 1, -1, 0, 1, 0], failed: [1, 0, 1, 0, 0, 0, 0] })[id];
    const r = pickTrampas(cands, rc, [1, 2], 10).map(q => q.i);
    expect(r).toEqual(['failed', 'new2', 'new1', 'seen']); // 'otra' no tiene trampas objetivo
    expect(pickTrampas(cands, rc, [1, 2], 2)).toHaveLength(2);
  });
});
describe('motivos de error', () => { it('hay una lista cerrada de motivos', () => { expect(MOTIVOS.length).toBeGreaterThan(3); }); });

import { normUi, swipeDir, keyAction, ZOOMS } from '../src/domain/logic.js';
describe('comodidad', () => {
  it('normUi sanea valores inválidos', () => {
    expect(normUi(null)).toEqual({ theme: 'auto', size: 0, lectura: 0 });
    expect(normUi({ theme: 'x', size: 99 })).toEqual({ theme: 'auto', size: 0, lectura: 0 });
    expect(normUi({ theme: 'dark', size: 2, lectura: 0 })).toEqual({ theme: 'dark', size: 2, lectura: 0 });
    expect(ZOOMS.length).toBe(4);
  });
  it('swipeDir exige gesto horizontal claro', () => {
    expect(swipeDir(-120, 10)).toBe('next');
    expect(swipeDir(120, -10)).toBe('prev');
    expect(swipeDir(-40, 0)).toBeNull();
    expect(swipeDir(-100, 90)).toBeNull();
    expect(swipeDir(-100, 200)).toBeNull();
  });
  it('keyAction mapea teclas', () => {
    expect(keyAction({ key: '2' }, 4)).toEqual({ t: 'opt', i: 1 });
    expect(keyAction({ key: '5' }, 4)).toBeNull();
    expect(keyAction({ key: 'c' }, 4)).toEqual({ t: 'opt', i: 2 });
    expect(keyAction({ key: 'd' }, 3)).toBeNull();
    expect(keyAction({ key: 'Enter' })).toEqual({ t: 'next' });
    expect(keyAction({ key: 'ArrowLeft' })).toEqual({ t: 'prev' });
    expect(keyAction({ key: 'b' })).toEqual({ t: 'blank' });
    expect(keyAction({ key: 'f' })).toEqual({ t: 'flag' });
    expect(keyAction({ key: 'a', metaKey: true })).toBeNull();
  });
});

import { pickRepaso, cargaRepasos, motivosFallo, suertes, MOTIVOS_FALLO } from '../src/domain/logic.js';
describe('repaso espaciado: prioridad, calendario y motivos', () => {
  it('pickRepaso: las más vencidas primero y temas mezclados', () => {
    const it = [{ i: 'a1', t: 'A', due: 1 }, { i: 'a2', t: 'A', due: 2 }, { i: 'a3', t: 'A', due: 3 }, { i: 'b1', t: 'B', due: 4 }, { i: 'b2', t: 'B', due: 5 }, { i: 'c1', t: 'C', due: 99 }];
    const r = pickRepaso(it, 5);
    expect(r.map(x => x.i).sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']); // c1 (menos vencida) queda fuera
    for (let k = 1; k < r.length - 1; k++) expect(r[k].t === r[k - 1].t && r.slice(k).some(x => x.t !== r[k].t)).toBe(false);
    expect(pickRepaso([], 5)).toEqual([]);
  });
  it('cargaRepasos agrupa por día y acumula las atrasadas en hoy', () => {
    const now = new Date(2026, 9, 22, 15).getTime(), D = 86400000, d0 = new Date(2026, 9, 22).getTime();
    const st = { a: [1, 0, 0, 0, d0 - 3 * D, 0], b: [1, 0, 0, 1, d0 + 1000, 0], c: [1, 0, 0, 0, d0 + 2 * D + 5, 0], d: [1, 0, 0, -1, 0, 0], e: [1, 0, 0, 2, d0 + 40 * D, 0] };
    const c = cargaRepasos(st, now, 14);
    expect(c[0]).toBe(2); expect(c[2]).toBe(1); expect(c.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it('motivosFallo cuenta solo si la última respuesta fue fallo', () => {
    const st = { a: [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], b: [1, 0, 0, 0, 0, 0, 0, 0, 0, 2], c: [1, 1, 0, -1, 0, 1, 0, 0, 0, 2], d: [1, 0, 0, 0, 0, 0, 0, 0, 0, 2] };
    expect(motivosFallo(st)).toEqual([0, 1, 2, 0, 0, 0, 0, 0]); expect(MOTIVOS_FALLO.length).toBe(8); expect(MOTIVOS_FALLO[5]).toBe('No lo sabía');
  });
});

describe('no lo sabía y suerte', () => {
  it('motivosFallo cuenta «No lo sabía» (5) y suertes cuenta aciertos con marca 6', () => {
    const st = { a: [1, 0, 0, 0, 0, 0, 0, 0, 0, 5], b: [1, 1, 0, 0, 0, 1, 0, 0, 0, 6], c: [1, 0, 0, 0, 0, 0, 0, 0, 0, 6], d: [1, 1, 0, -1, 0, 1, 0, 0, 0, 0] };
    expect(motivosFallo(st)).toEqual([0, 0, 0, 0, 0, 1, 0, 0]); expect(suertes(st)).toBe(1);
  });
});

import { pickCards, cardStats, cardFromQuestion } from '../src/domain/logic.js';
describe('tarjetas: selección y estadísticas', () => {
  const D = 86400000, now = 1_800_000_000_000;
  const C = (t, k) => Array.from({ length: k }, (_, i) => ({ id: `FC-${t}-${i}`, t }));
  it('vencidas primero y luego nuevas (máx. maxNew), mezclando temas', () => {
    const cards = [...C('A', 5), ...C('B', 5)];
    const recs = { 'FC-A-0': [1, 0, now, 0, now - 2 * D, 0], 'FC-B-0': [1, 0, now, 0, now - D, 0], 'FC-A-1': [1, 1, now, 1, now + D, 2] };
    const r = pickCards(cards, recs, { n: 6, now, maxNew: 3 });
    expect(r.slice(0, 2)).toEqual(['FC-A-0', 'FC-B-0']);
    expect(r).toHaveLength(5); expect(r).not.toContain('FC-A-1');
    expect(new Set(r).size).toBe(r.length);
  });
  it('las nuevas respetan el filtro de temas vistos', () => {
    const r = pickCards([...C('A', 3), ...C('B', 3)], {}, { n: 10, now, seen: new Set(['B']) });
    expect(r.every(id => id.startsWith('FC-B'))).toBe(true); expect(r).toHaveLength(3);
    expect(pickCards([], {}, { n: 5 })).toEqual([]);
  });
  it('cardStats clasifica nuevas, en repaso, vencen hoy y dominadas', () => {
    const cards = C('A', 4);
    const recs = { 'FC-A-0': [2, 2, now, -1, 0, 2], 'FC-A-1': [1, 1, now, 0, now - 1, 2], 'FC-A-2': [1, 1, now, 1, now + D, 2] };
    expect(cardStats(cards, recs, now)).toEqual({ nuevas: 1, enRepaso: 2, dominadas: 1, hoy: 1 });
  });
  it('cardFromQuestion usa la opción correcta, la nota y la cita', () => {
    const c = cardFromQuestion({ i: 'q1', t: 'T1.01', q: '¿X?', a: ['a', 'b', 'c', 'd'], c: 2, n: 'nota', u: 'Art. 1' });
    expect(c).toMatchObject({ id: 'FC-Q-q1', t: 'T1.01', q: '¿X?', a: 'c', nota: 'nota', ref: 'Art. 1', src: 'fallo' });
  });
});

import { hiliteHtml, claveSpans, claveHtml, pideNegativa, minLectura, velocidad } from '../src/domain/logic.js';
describe('hiliteHtml', () => {
  it('resalta el fragmento que responde', () => {
    const h = hiliteHtml('El Congreso se compone de un mínimo de 300 y un máximo de 400 Diputados elegidos.', 'De un mínimo de 300 y de un máximo de 400.');
    expect(h).toContain('<b class="hl">');
    expect(h).toContain('300');
  });
  it('escapa HTML y no marca si no hay coincidencia', () => {
    expect(hiliteHtml('a <b>x</b>', 'zzzz')).toBe('a &lt;b&gt;x&lt;/b&gt;');
  });
});

describe('lectura atenta', () => {
  it('resalta negaciones en mayúsculas, absolutos y cifras', () => {
    const h = claveHtml('Señale la INCORRECTA: el plazo es de 10 días y SOLO se aplica ÚNICAMENTE a no pocos');
    expect(h).toContain('<mark class="kw">INCORRECTA</mark>');
    expect(h).toContain('<mark class="kw">SOLO</mark>');
    expect(h).toContain('<mark class="kw">ÚNICAMENTE</mark>');
    expect(h).toContain('<mark class="kw">10 días</mark>');
    expect(h).not.toContain('>no<');
  });
  it('escapa HTML', () => { expect(claveHtml('<b>NO</b>')).toContain('&lt;b&gt;'); });
  it('detecta si piden la negativa', () => {
    expect(pideNegativa('Señale la respuesta INCORRECTA')).toBe(true);
    expect(pideNegativa('¿Qué puerto usa SSH?')).toBe(false);
  });
  it('minLectura acotada', () => {
    expect(minLectura({ q: 'a', a: ['b'] })).toBe(4);
    expect(minLectura({ q: 'x '.repeat(500), a: [] })).toBe(30);
  });
  it('velocidad cuenta fallos con motivo 7', () => {
    const v = velocidad({ a: [1, 0, 0, 0, 0, 0, 0, 0, 0, 7], b: [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], c: [1, 1, 0, 0, 0, 1, 0, 0, 0, 7] });
    expect(v).toMatchObject({ n: 1, tot: 2, p: 50, ids: ['a'] });
  });
});

describe('analisisSimulacro', () => {
  it('calcula notas, ritmo y preguntas lentas', async () => {
    const { analisisSimulacro, ritmoSimulacro } = await import('../src/domain/logic.js');
    const r = analisisSimulacro({ correct: [0, 1, 2, 3], ans: [0, 2, -1, 3], times: [10, 5, 0, 200], limitSecs: 400, secs: 300 });
    expect(r).toMatchObject({ n: 4, a: 2, f: 1, b: 1, presupuesto: 100, sinPenal: 50, perdidoFallos: 8.3, uso: 75 });
    expect(r.lentas.map(x => x.k)).toEqual([3]);
    expect(r.rapidasFalladas).toBe(1);
    expect(ritmoSimulacro(10, 80, 5400, 540)).toBe(2);
    expect(ritmoSimulacro(0, 0, 0, 5)).toBe(0);
  });
});

describe('richHtml (código)', () => {
  it('escapa siempre y marca sentencias SQL, comandos y etiquetas', async () => {
    const { richHtml, codeSpans } = await import('../src/domain/logic.js');
    const sql = richHtml('¿Qué devuelve SELECT * FROM A WHERE B IS NULL; en SQL?');
    expect(sql).toContain('<code class="cd"><b class="sk">SELECT</b> * <b class="sk">FROM</b>');
    expect(sql).toContain('en SQL?');
    expect(richHtml('El comando chmod 755 f.txt y la opción -R')).toMatch(/<code class="cd">chmod 755 f.txt<\/code>/);
    const evil = richHtml('<script>alert(1)</script> y <img src=x onerror=alert(1)>');
    expect(evil).not.toMatch(/<script|<img/);
    expect(evil).toContain('&lt;script&gt;');
    expect(codeSpans('La Constitución Española de 1978 (CE) regula la Corona.')).toEqual([]);
    expect(codeSpans('Lenguaje C++ y Node.js son conocidos')).toEqual([]);
  });
  it('combina palabras clave de lectura fuera del código', async () => {
    const { richHtml } = await import('../src/domain/logic.js');
    const h = richHtml('Señale la INCORRECTA sobre SELECT.', true);
    expect(h).toContain('<mark class="kw">INCORRECTA</mark>');
    expect(h).toContain('<code class="cd"><b class="sk">SELECT</b></code>');
  });
  it('un fragmento de código con identificadores sueltos queda en un solo bloque', async () => {
    const { richHtml } = await import('../src/domain/logic.js');
    const h = richHtml('siguiente código: a=10,b; b=a++;');
    expect(h).toContain('<code class="cd">a=10,b; b=a++;</code>');
    expect(richHtml('a=10, b=10')).toBe('<code class="cd">a=10, b=10</code>');
  });
});

describe('richHtml: opciones que son todo código', () => {
  it('pinta la opción entera como un único bloque y deja el punto final fuera (o lo quita si es un bloque)', async () => {
    const { richHtml } = await import('../src/domain/logic.js');
    const strip = h => h.replace(/<b class="sk">|<\/b>/g, '');
    expect(strip(richHtml('GRANT.'))).toBe('<code class="cd">GRANT</code>.');
    expect(strip(richHtml('/sbin.'))).toBe('<code class="cd">/sbin</code>.');
    expect(strip(richHtml('((a>b) and (a<d)) or ((a==d) and (b<=a)).'))).toBe('<code class="cd blk">((a&gt;b) and (a&lt;d)) or ((a==d) and (b&lt;=a))</code>');
    expect(strip(richHtml('MODIFY TABLE P ADD COLUMN (sexo VARCHAR2(10))'))).toBe('<code class="cd blk">MODIFY TABLE P ADD COLUMN (sexo VARCHAR2(10))</code>');
    expect(richHtml('for (int i=0; i<12; i++) x[i];')).toMatch(/^<code class="cd blk">for \(int i=0; i&lt;12; i\+\+\) x\[i\];<\/code>$/);
  });
  it('no convierte en código la prosa', async () => {
    const { richHtml, todoCodigo } = await import('../src/domain/logic.js');
    for (const t of ['La dirección de memoria de b.', 'I Plan 2012-2014; II Plan 2014-2016.', 'Solo obligatorio <html>.', 'BYOD', 'HTTP, FTP (puerto 21)', 'Permite ejecutar SELECT SYSDATE FROM DUAL.'])
      expect(todoCodigo(t)).toBe(false);
    // SELECT sin FROM dentro de una frase no es una sentencia
    expect(richHtml('Obtener en una sentencia SELECT grupos de tuplas.')).toBe('Obtener en una sentencia <code class="cd"><b class="sk">SELECT</b></code> grupos de tuplas.');
    // sentencia en minúsculas con FROM sí lo es
    expect(richHtml('Tras int *a,b; a=&b; la variable a contiene:')).toContain('<code class="cd">int *a,b; a=&amp;b;</code>');
    expect(richHtml('Dada la sentencia: select nombre from pacientes where x=1')).toContain('<code class="cd">select nombre from pacientes where x=1</code>');
  });
});

describe('sesión rápida de invitado', () => {
  const pool = (t, n) => ({ t, qs: Array.from({ length: n }, (_, k) => ({ i: `${t}-${k}`, t })) });
  const pools = ['A', 'B', 'C', 'D', 'E', 'F'].map(t => pool(t, 5));
  it('una pregunta por tema', () => {
    const r = pickGuest(pools, 4);
    expect(r).toHaveLength(4); expect(new Set(r.map(q => q.t)).size).toBe(4);
  });
  it('no repite las de la sesión anterior ni las ya vistas si hay otras', () => {
    const evitar = new Set(pools.flatMap(p => p.qs.slice(0, 4).map(q => q.i)));
    for (let k = 0; k < 20; k++) for (const q of pickGuest(pools, 6, () => false, evitar)) expect(q.i.endsWith('-4')).toBe(true);
    const vistas = id => !id.endsWith('-3');
    for (let k = 0; k < 20; k++) for (const q of pickGuest(pools, 6, vistas)) expect(q.i.endsWith('-3')).toBe(true);
  });
  it('varía entre llamadas y no falla si faltan preguntas', () => {
    const firmas = new Set(Array.from({ length: 30 }, () => pickGuest(pools, 3).map(q => q.i).join()));
    expect(firmas.size).toBeGreaterThan(5);
    expect(pickGuest([pool('A', 0), pool('B', 1)], 5)).toHaveLength(1);
  });
});
