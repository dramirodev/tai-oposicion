import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
const D = 86400000;
let st;
beforeEach(async () => { localStorage.clear(); vi.resetModules(); st = await import('../src/core/store.js'); });

describe('repaso espaciado', () => {
  const T0 = 1_800_000_000_000;
  it('un fallo entra en la cola con vencimiento a +2 días', () => {
    st.record('q1', 'T1.01', 0, T0);
    const r = st.rec('q1'); expect(r.slice(0, 6)).toEqual([1, 0, T0, 0, T0 + 2 * D, 0]);
  });
  it('los aciertos sucesivos avanzan 5, 14, 30 y 60 días y luego salen de la cola', () => {
    st.record('q1', 'T1.01', 0, T0);
    st.record('q1', 'T1.01', 1, T0 + 2 * D); expect(st.rec('q1')[3]).toBe(1); expect(st.rec('q1')[4]).toBe(T0 + 2 * D + 5 * D);
    st.record('q1', 'T1.01', 1, T0 + 8 * D); expect(st.rec('q1')[3]).toBe(2); expect(st.rec('q1')[4]).toBe(T0 + 8 * D + 14 * D);
    st.record('q1', 'T1.01', 1, T0 + 25 * D); expect(st.rec('q1')[3]).toBe(3); expect(st.rec('q1')[4]).toBe(T0 + 25 * D + 30 * D);
    st.record('q1', 'T1.01', 1, T0 + 60 * D); expect(st.rec('q1')[3]).toBe(4); expect(st.rec('q1')[4]).toBe(T0 + 60 * D + 60 * D);
    st.record('q1', 'T1.01', 1, T0 + 130 * D); expect(st.rec('q1')[3]).toBe(-1); expect(st.rec('q1')[4]).toBe(0);
  });
  it('«acerté dudando» mete una pregunta acertada en la cola a +2 días', () => {
    st.record('q9', 'T1.01', 1, T0); expect(st.rec('q9')[3]).toBe(-1);
    st.doubt('q9', 'T1.01', T0); expect(st.rec('q9')[3]).toBe(0); expect(st.rec('q9')[4]).toBe(T0 + 2 * D); expect(st.rec('q9')[5]).toBe(1);
    st.doubt('nunca', 'T1.01', T0); expect(st.rec('nunca')).toBeUndefined();
  });
  it('fallar de nuevo en repaso reinicia a +2 días', () => {
    st.record('q1', 'T1.01', 0, T0); st.record('q1', 'T1.01', 1, T0 + 2 * D); st.record('q1', 'T1.01', 0, T0 + 9 * D);
    expect(st.rec('q1')[3]).toBe(0); expect(st.rec('q1')[4]).toBe(T0 + 9 * D + 2 * D);
  });
  it('acertar una pregunta que nunca falló no la mete en la cola', () => {
    st.record('q2', 'T1.01', 1, T0); expect(st.rec('q2')[3]).toBe(-1);
  });
  it('en blanco cuenta como intento, no cambia la cola ni suma acierto', () => {
    st.record('q3', 'T1.01', 2, T0); const r = st.rec('q3'); expect([r[0], r[1], r[3], r[5]]).toEqual([1, 0, -1, 2]);
  });
  it('marca el tema como pendiente de sincronizar', () => {
    st.record('q1', 'T3.02', 1, T0); expect([...st.takeDirty()]).toEqual(['T3.02']); expect(st.takeDirty().size).toBe(0);
  });
  it('toggleFlag alterna la marca de dudosa', () => {
    expect(st.toggleFlag('q1', 'T1.01')).toBe(1); expect(st.toggleFlag('q1', 'T1.01')).toBe(0);
  });
  it('persiste y recarga desde localStorage', async () => {
    st.record('q1', 'T1.01', 1, T0); st.setSeen(['T1.01']);
    vi.resetModules(); const st2 = await import('../src/core/store.js');
    expect(st2.rec('q1')[0]).toBe(1); expect(st2.getSeen()).toEqual(['T1.01']);
  });
});

describe('motivo del fallo', () => {
  const T0 = 1_800_000_000_000;
  beforeEach(() => st.resetAll());
  it('anota el motivo del último fallo; despiste saca la pregunta de la cola', () => {
    st.record('m1', 'T1.01', 0, T0);
    st.setMotivo('m1', 'T1.01', 2, T0); expect(st.rec('m1')[9]).toBe(2); expect(st.rec('m1')[3]).toBe(0);
    st.setMotivo('m1', 'T1.01', 4, T0); expect(st.rec('m1')[9]).toBe(4); expect(st.rec('m1')[3]).toBe(-1); expect(st.rec('m1')[4]).toBe(0);
  });
  it('ignora motivos inválidos o sin fallo previo, y se reinicia al volver a responder', () => {
    st.record('m2', 'T1.01', 1, T0); st.setMotivo('m2', 'T1.01', 1, T0); expect(st.rec('m2')[9]).toBe(0);
    st.record('m2', 'T1.01', 0, T0); st.setMotivo('m2', 'T1.01', 9, T0); expect(st.rec('m2')[9]).toBe(0);
    st.setMotivo('m2', 'T1.01', 1, T0); st.record('m2', 'T1.01', 1, T0 + D); expect(st.rec('m2')[9]).toBe(0);
  });
});
describe('no lo sabía y suerte', () => {
  const T0 = 1_800_000_000_000;
  beforeEach(() => st.resetAll());
  it('«No lo sabía» (5) se anota en un fallo y mantiene la pregunta en la cola', () => {
    st.record('n1', 'T1.01', 0, T0); st.setMotivo('n1', 'T1.01', 5, T0);
    expect(st.rec('n1')[9]).toBe(5); expect(st.rec('n1')[3]).toBe(0);
  });
  it('«Fue suerte» solo vale en aciertos: marca 6, vuelve cada día y exige acertar 2 veces para quitar la marca', () => {
    st.record('n2', 'T1.01', 0, T0); st.suerte('n2', 'T1.01', T0); expect(st.rec('n2')[9]).toBe(0); // era un fallo
    st.record('n3', 'T1.01', 1, T0); st.suerte('n3', 'T1.01', T0);
    expect(st.rec('n3')[9]).toBe(6); expect(st.rec('n3')[3]).toBe(0); expect(st.rec('n3')[4]).toBe(T0 + D);
    st.record('n3', 'T1.01', 1, T0 + D); expect(st.rec('n3')[9]).toBe(8); expect(st.rec('n3')[4]).toBe(T0 + 2 * D); // 1/2: vuelve mañana
    st.record('n3', 'T1.01', 2, T0 + 2 * D); expect(st.rec('n3')[9]).toBe(8); // en blanco no cuenta
    st.record('n3', 'T1.01', 1, T0 + 2 * D); expect(st.rec('n3')[9]).toBe(0); // 2/2: etiqueta quitada
    expect(st.rec('n3')[3]).toBe(1); // y sigue el calendario normal
    st.record('n4', 'T1.01', 1, T0); st.suerte('n4', 'T1.01', T0); st.record('n4', 'T1.01', 0, T0 + D);
    expect(st.rec('n4')[9]).toBe(0); expect(st.rec('n4')[3]).toBe(0); // fallar la reinicia como fallo normal
    st.suerte('nunca', 'T1.01', T0); expect(st.rec('nunca')).toBeUndefined();
  });
  it('cleanRec acepta marcas 0–6 y 8', () => {
    expect(st.cleanRec([1, 1, 1, 0, 1, 1, 0, 0, 0, 6])[9]).toBe(6);
  });
});
describe('informes de errores del banco', () => {
  it('guarda un informe, lo limpia y permite cambiar su estado', () => {
    st.addReport('q1', 'T3.04', 'Otro', 'x'.repeat(500));
    const r = st.getReports().q1; expect(r).toMatchObject({ tema: 'T3.04', motivo: 'Otro', st: 'abierto' }); expect(r.nota).toHaveLength(300);
    st.setReportState('q1', 'resuelto'); expect(st.getReports().q1.st).toBe('resuelto');
    st.setReportState('q1', 'raro'); expect(st.getReports().q1.st).toBe('resuelto'); st.setReportState('zz', 'quitado'); expect(st.getReports().zz).toBeUndefined();
  });
  it('mergeReports: gana el más reciente y se valida', () => {
    st.addReport('q1', 'T1.01', 'Otro', 'a');
    const t = st.getReports().q1.ts;
    expect(st.mergeReports({ q1: { ts: t - 5, motivo: 'viejo', nota: '', tema: '', st: 'abierto' } })).toBe(false);
    expect(st.mergeReports({ q1: { ts: t + 5, motivo: 'nuevo', nota: '', tema: '', st: 'resuelto' }, '<img>': { ts: 1 }, q2: 'x' })).toBe(true);
    expect(st.getReports().q1.motivo).toBe('nuevo'); expect(Object.keys(st.getReports())).toEqual(['q1']);
  });
  it('persiste y viaja en la exportación/importación', async () => {
    st.addReport('q1', 'T1.01', 'Otro', 'n'); const dump = st.exportAll();
    localStorage.clear(); vi.resetModules(); const s2 = await import('../src/core/store.js'); expect(s2.getReports()).toEqual({});
    s2.importAll(dump); expect(s2.getReports().q1.nota).toBe('n');
  });
});

describe('tiempo por pregunta', () => {
  it('acumula segundos (tope 120) y respuestas cronometradas', () => {
    st.record('q1', 'T1.01', 1, 1000, 10); st.record('q1', 'T1.01', 0, 2000, 500); st.record('q1', 'T1.01', 1, 3000);
    const r = st.rec('q1'); expect([r[0], r[7], r[8]]).toEqual([3, 130, 2]);
  });
  it('en blanco no cuenta tiempo', () => { st.record('q2', 'T1.01', 2, 1000, 20); expect(st.rec('q2')[8]).toBe(0); });
});

describe('fusión con la nube (gana lo más reciente)', () => {
  it('toma el remoto si es más nuevo y conserva el local si es más nuevo', () => {
    st.record('a', 'T1.01', 1, 1000); st.record('b', 'T1.01', 1, 5000);
    st.mergeRemote({ a: [9, 9, 2000, -1, 0, 1, 0], b: [9, 9, 3000, -1, 0, 1, 0], c: [1, 1, 10, -1, 0, 1, 0] });
    expect(st.rec('a')[0]).toBe(9); expect(st.rec('b')[0]).toBe(1); expect(st.rec('c')[0]).toBe(1);
  });
  it('temas vistos: gana el timestamp más reciente', () => {
    st.setSeen(['T1.01']); const ts = st.getSeenDoc().ts;
    expect(st.mergeSeen({ t: ['T2.01'], ts: ts - 10 })).toBe(false); expect(st.getSeen()).toEqual(['T1.01']);
    expect(st.mergeSeen({ t: ['T2.01'], ts: ts + 10 })).toBe(true); expect(st.getSeen()).toEqual(['T2.01']);
  });
  it('mergeSessions no duplica y ordena por fecha', () => {
    const s = (id, ts) => ({ id, ts, kind: 'test', n: 1, a: 1, f: 0, b: 0, secs: 1, nota: 100, temas: {}, titulo: 't' });
    st.mergeSessions([s('s1', 1), s('s2', 2)]); st.mergeSessions([s('s1', 1), s('s3', 3)]);
    expect(st.getSessions().map(x => x.id)).toEqual(['s3', 's2', 's1']);
  });
});

describe('validación de datos externos', () => {
  const XSS = '<img src=x onerror=alert(1)>';
  it('cleanRec acepta registros válidos y rechaza basura', () => {
    expect(st.cleanRec([2, 1, 5, 0, 9, 1, 0])).toEqual([2, 1, 5, 0, 9, 1, 0, 0, 0, 0]);
    expect(st.cleanRec([2, 1, 5, 0, 9, 1, 0, 30, 2])).toEqual([2, 1, 5, 0, 9, 1, 0, 30, 2, 0]);
    expect(st.cleanRec([2, 1, 5, 0, 9, 0, 0, 0, 0, 3])[9]).toBe(3); expect(st.cleanRec([2, 1, 5, 0, 9, 0, 0, 0, 0, 77])[9]).toBeLessThanOrEqual(8);
    expect(st.cleanRec([2, 1, 5, 0, 9, 1, 0, 30, 99])[8]).toBe(2); // cronometradas ≤ intentos
    expect(st.cleanRec('x')).toBeNull(); expect(st.cleanRec([1, 'a', 3])).toBeNull(); expect(st.cleanRec([NaN, 1, 1])).toBeNull();
    expect(st.cleanRec([1, 5, 1, 0, 0, 0, 0])[1]).toBe(1); // aciertos ≤ intentos
  });
  it('cleanStats descarta ids con HTML', () => {
    expect(Object.keys(st.cleanStats({ ok1: [1, 1, 1, -1, 0, 1, 0], [XSS]: [1, 1, 1, -1, 0, 1, 0] }))).toEqual(['ok1']);
  });
  it('cleanSession fuerza tipos y recorta', () => {
    const c = st.cleanSession({ id: 's1', ts: 5, kind: '<script>', nota: XSS, n: 'x', temas: { 'T1.01': [1, 2], [XSS]: [1, 1] }, titulo: 5, fails: ['q1', XSS] });
    expect(st.cleanSession({ id: 's2', ts: 1, tipos: { D: [1, 2], '<x>': [1, 1], I: 'no' } }).tipos).toEqual({ D: [1, 2] });
    expect(c.kind).toBe('test'); expect(c.nota).toBe(0); expect(c.n).toBe(0); expect(c.titulo).toBe('');
    expect(Object.keys(c.temas)).toEqual(['T1.01']); expect(c.fails).toEqual(['q1']);
    expect(st.cleanSession({ id: XSS, ts: 1 })).toBeNull(); expect(st.cleanSession(null)).toBeNull();
  });
  it('importAll rechaza archivos inválidos y limpia los válidos', () => {
    expect(() => st.importAll('no json')).toThrow(); expect(() => st.importAll('{"a":1}')).toThrow();
    st.importAll(JSON.stringify({ stats: { q9: [1, 1, 9, -1, 0, 1, 0], [XSS]: [1, 1, 1, -1, 0, 1, 0] }, sessions: [{ id: 's9', ts: 9, nota: XSS }, 7] }));
    expect(Object.keys(st.getStats())).toEqual(['q9']); expect(st.getSessions()).toHaveLength(1); expect(st.getSessions()[0].nota).toBe(0);
  });
  it('un localStorage corrupto no rompe la carga', async () => {
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats: { x: 'basura', y: [1, 1, 1, -1, 0, 1, 0] }, sessions: 'no', seen: 5 }));
    vi.resetModules(); const s2 = await import('../src/core/store.js');
    expect(Object.keys(s2.getStats())).toEqual(['y']); expect(s2.getSessions()).toEqual([]); expect(s2.getSeen()).toEqual([]);
  });
});

describe('copia de seguridad en IndexedDB', () => {
  it('recupera el progreso y los temas vistos si localStorage se pierde', async () => {
    st.record('q1', 'T1.01', 1, 5000, 12); st.setSeen(['T1.01', 'T3.04']); st.addReport('q1', 'T1.01', 'Otro', 'n');
    await st.flushNow();
    localStorage.clear(); vi.resetModules(); const s2 = await import('../src/core/store.js');
    expect(s2.getSeen()).toEqual([]); expect(s2.rec('q1')).toBeUndefined();
    expect(await s2.recover()).toBe(true);
    expect(s2.rec('q1')[0]).toBe(1); expect(s2.getSeen()).toEqual(['T1.01', 'T3.04']); expect(s2.getReports().q1.nota).toBe('n');
    expect(JSON.parse(localStorage.getItem('tai.v1:guest')).seen.t).toEqual(['T1.01', 'T3.04']); // y lo vuelve a guardar en localStorage
  });
  it('no pisa datos locales más recientes', async () => {
    st.setSeen(['T1.01']); await st.flushNow();
    vi.resetModules(); const s2 = await import('../src/core/store.js');
    s2.setSeen(['T2.01']); // más reciente que la copia
    await s2.recover(); expect(s2.getSeen()).toEqual(['T2.01']);
  });
});

describe('tarjetas (flashcards)', () => {
  const T0 = 1_800_000_000_000;
  beforeEach(() => st.resetAll());
  it('valorar o crear una tarjeta avisa a la sincronización', () => {
    const calls = []; st.setSyncer({ pushCards: m => calls.push(Object.keys(m).length) });
    st.addFallo('GEN-T3.04-57.v1', T0); st.gradeCard('FC-T1.01-001', 2, T0);
    st.setSyncer(null);
    expect(calls).toEqual([1, 2]);
  });
  it('addFallo crea la tarjeta vencida hoy y no la duplica', () => {
    expect(st.addFallo('GEN-T3.04-57.v1', T0)).toBe(true); expect(st.addFallo('GEN-T3.04-57.v1', T0)).toBe(false);
    expect(st.cardRec('FC-Q-GEN-T3.04-57.v1')).toEqual([0, 0, T0, 0, T0, 0]);
    expect(st.addFallo('bad id!', T0)).toBe(false);
  });
  it('lo sabía sube de caja con los intervalos 2/5/14/30/60 y luego domina', () => {
    const id = 'FC-T1.01-001';
    st.gradeCard(id, 2, T0); expect(st.cardRec(id)[3]).toBe(0); expect(st.cardRec(id)[4]).toBe(T0 + 2 * D);
    st.gradeCard(id, 2, T0 + 2 * D); expect(st.cardRec(id)[3]).toBe(1); expect(st.cardRec(id)[4]).toBe(T0 + 7 * D);
    st.gradeCard(id, 2, T0 + 7 * D); st.gradeCard(id, 2, T0 + 21 * D); st.gradeCard(id, 2, T0 + 51 * D);
    expect(st.cardRec(id)[3]).toBe(4); expect(st.cardRec(id)[4]).toBe(T0 + 51 * D + 60 * D);
    st.gradeCard(id, 2, T0 + 120 * D); expect(st.cardRec(id)[3]).toBe(-1); expect(st.cardRec(id)[4]).toBe(0);
  });
  it('fallé y dudaba vuelven a +2 días y no suman acierto', () => {
    const id = 'FC-T1.01-002';
    st.gradeCard(id, 2, T0); st.gradeCard(id, 2, T0 + 2 * D);
    st.gradeCard(id, 1, T0 + 7 * D); expect(st.cardRec(id)[3]).toBe(0); expect(st.cardRec(id)[4]).toBe(T0 + 9 * D); expect(st.cardRec(id)[1]).toBe(2);
    st.gradeCard(id, 0, T0 + 9 * D); expect(st.cardRec(id)[5]).toBe(0);
  });
  it('una tarjeta de fallo valorada «lo sabía» pasa a +2 días (primer acierto)', () => {
    st.addFallo('q1', T0); st.gradeCard('FC-Q-q1', 2, T0); expect(st.cardRec('FC-Q-q1')[3]).toBe(0); expect(st.cardRec('FC-Q-q1')[4]).toBe(T0 + 2 * D);
  });
  it('valida basura y rechaza ids o notas inválidas', () => {
    expect(st.gradeCard('mal id', 2, T0)).toBeNull(); expect(st.gradeCard('FC-X-1', 7, T0)).toBeNull();
    expect(st.cleanCard([1, 5, 3, 9, 10, 8])).toEqual([1, 1, 3, 4, 10, 2]);
    expect(st.cleanCard('x')).toBeNull(); expect(st.cleanCard([1, 1])).toBeNull();
    expect(Object.keys(st.cleanCards({ 'FC-A-1': [1, 1, 1, 0, 0, 0], 'zz': [1, 1, 1, 0, 0, 0], '<img>': [1, 1, 1, 0, 0, 0] }))).toEqual(['FC-A-1']);
  });
  it('mergeCards gana lo más reciente, exporta/importa y persiste', async () => {
    st.gradeCard('FC-T1.01-003', 2, T0);
    expect(st.mergeCards({ 'FC-T1.01-003': [5, 5, T0 - 1, 2, 9, 2] })).toBe(false);
    expect(st.mergeCards({ 'FC-T1.01-003': [5, 5, T0 + 1, 2, 9, 2] })).toBe(true);
    const txt = st.exportAll(); st.resetAll(); expect(st.cardRec('FC-T1.01-003')).toBeUndefined();
    st.importAll(txt); expect(st.cardRec('FC-T1.01-003')[0]).toBe(5);
    vi.resetModules(); const st2 = await import('../src/core/store.js'); expect(st2.cardRec('FC-T1.01-003')[0]).toBe(5);
  });
  it('removeCard borra la tarjeta', () => { st.addFallo('q9', T0); st.removeCard('FC-Q-q9'); expect(st.cardRec('FC-Q-q9')).toBeUndefined(); });
});

describe('motivo «Velocidad» (7)', () => {
  it('se acepta en fallos, se cuenta aparte y cleanRec lo conserva', async () => {
    const st = await import('../src/core/store.js'); const { motivosFallo } = await import('../src/core/logic.js');
    expect(st.cleanRec([1, 0, 1, 0, 1, 0, 0, 0, 0, 7])[9]).toBe(7);
    expect(motivosFallo({ a: [1, 0, 0, 0, 0, 0, 0, 0, 0, 7] })[7]).toBe(1);
  });
});

describe('auditoría: persistencia y datos externos', () => {
  it('conserva ajustes estructurados al recargar y recuperar la copia local', async () => {
    st.setCfg('ui', { theme: 'dark', size: 2, lectura: 1 });
    st.setCfg('test', { sel: ['T1.01'], n: 25, mode: 'falladas', o: ['O', 'G'] });
    st.setCfg('tdet', { 1: [8, 5] });
    await st.flushNow();
    vi.resetModules(); const next = await import('../src/core/store.js');
    expect(next.getCfg().ui).toEqual({ theme: 'dark', size: 2, lectura: 1 });
    expect(next.getCfg().test.sel).toEqual(['T1.01']);
    expect(next.getCfg().tdet).toEqual({ 1: [8, 5] });
    localStorage.clear(); vi.resetModules(); const recovered = await import('../src/core/store.js');
    await recovered.recover();
    expect(recovered.getCfg().ui).toEqual({ theme: 'dark', size: 2, lectura: 1 });
  });
  it('rechaza claves reservadas e ignora registros heredados al importar', () => {
    const data = JSON.parse('{"stats":{"__proto__":[1,1,1,-1,0,1,0],"constructor":[1,1,1,-1,0,1,0]},"reports":{"__proto__":{"ts":123,"tema":"T1.01","nota":"test","st":"abierto"}}}');
    st.importAll(JSON.stringify(data));
    expect(Object.keys(st.getStats())).toEqual([]);
    expect(Object.keys(st.getReports())).toEqual([]);
    const inherited = Object.create({ injected: [1, 1, 1, -1, 0, 1, 0] });
    inherited.real = [1, 1, 1, -1, 0, 1, 0];
    st.mergeRemote(inherited);
    expect(Object.keys(st.getStats())).toEqual(['real']);
    expect(st.rec('toString')).toBeUndefined();
  });
  it('no duplica sesiones repetidas dentro de una misma importación', () => {
    st.mergeSessions([{ id: 's1', ts: 1 }, { id: 's1', ts: 1 }]);
    expect(st.getSessions()).toHaveLength(1);
  });
  it('exportar e importar conserva los ajustes válidos y descarta claves peligrosas anidadas', async () => {
    st.setCfg('ui', { theme: 'dark', size: 2 });
    const text = st.exportAll(); st.resetAll(); st.importAll(text);
    expect(st.getCfg().ui).toEqual({ theme: 'dark', size: 2 });
    localStorage.setItem('tai.v1:guest', '{"stats":{},"cfg":{"ui":{"theme":"dark","__proto__":{"x":1}},"constructor":"x"}}');
    vi.resetModules(); const next = await import('../src/core/store.js');
    expect(next.getCfg().ui).toEqual({ theme: 'dark' });
    expect(Object.keys(next.getCfg())).toEqual(['ui']);
    expect(Object.getPrototypeOf(next.getCfg().ui)).toBe(Object.prototype);
  });
});

describe('auditoría: eliminación sincronizada de tarjetas', () => {
  it('una tarjeta eliminada no reaparece al fusionar una copia antigua y permite volver a crearla', async () => {
    st.addFallo('q9', 1000);
    const old = JSON.parse(JSON.stringify(st.getCards()));
    st.removeCard('FC-Q-q9');
    st.mergeCards(old);
    expect(st.cardRec('FC-Q-q9')).toBeUndefined();
    expect(Object.keys(st.getCards())).toEqual([]);
    const copy = st.exportAll(); st.resetAll(); st.importAll(copy); st.mergeCards(old);
    expect(st.cardRec('FC-Q-q9')).toBeUndefined();
    expect(st.addFallo('q9')).toBe(true);
    expect(st.cardRec('FC-Q-q9')[0]).toBe(0);
  });
  it('notifica a la nube la marca de borrado y la respeta al recibirla', () => {
    let remote;
    st.setSyncer({ pushCards: m => { remote = JSON.parse(JSON.stringify(m)); } });
    st.addFallo('q9', 1000); st.removeCard('FC-Q-q9');
    st.setSyncer(null);
    st.resetAll(); st.addFallo('q9', 1000); st.mergeCards(remote);
    expect(st.cardRec('FC-Q-q9')).toBeUndefined();
  });
});

describe('auditoría: formas de los ajustes importados', () => {
  it('sustituye campos de tipos incorrectos y conserva las preferencias válidas tras recargar', async () => {
    st.importAll('{"stats":{},"cfg":{"test":{"sel":42,"o":42,"n":25},"sim":{"o":42},"evo":{"f":42,"w":999999},"ui":{"theme":"dark"},"tdet":{"1":42}}}');
    vi.resetModules(); const next = await import('../src/core/store.js');
    expect(next.getCfg().test).toMatchObject({ sel: [], o: ['O', 'A', 'G'], n: 25 });
    expect(next.getCfg().sim.o).toEqual(['O', 'G']);
    expect(next.getCfg().evo).toMatchObject({ f: 'g', w: 12 });
    expect(next.getCfg().ui.theme).toBe('dark');
    expect(next.getCfg().tdet).toEqual({});
  });
  it('descarta primitivos donde las pantallas esperan objetos modificables', () => {
    st.importAll('{"stats":{},"cfg":{"test":"mal","sim":true,"ui":42,"cardsc":false,"evo":5}}');
    for (const key of ['test', 'sim', 'ui', 'cardsc', 'evo']) expect(st.getCfg()[key]).toBeUndefined();
  });
});

describe('falladas hasta tres aciertos seguidos y temario repasado', () => {
  it('sale al tercer acierto aunque siga en el repaso espaciado; otro fallo la recupera', () => {
    st.record('f1', 'T1.01', 0, 1000);
    expect(st.pendingFailure(st.rec('f1'))).toBe(true);
    st.record('f1', 'T1.01', 1, 2000);
    st.record('f1', 'T1.01', 1, 3000);
    expect(st.failureStreak(st.rec('f1'))).toBe(2);
    expect(st.pendingFailure(st.rec('f1'))).toBe(true);
    st.record('f1', 'T1.01', 2, 4000);
    expect(st.failureStreak(st.rec('f1'))).toBe(2);
    st.record('f1', 'T1.01', 1, 5000);
    expect(st.pendingFailure(st.rec('f1'))).toBe(false);
    expect(st.rec('f1')[3]).toBeGreaterThanOrEqual(0);
    st.record('f1', 'T1.01', 0, 6000);
    expect(st.failureStreak(st.rec('f1'))).toBe(0);
    expect(st.pendingFailure(st.rec('f1'))).toBe(true);
  });
  it('un fallo intermedio reinicia y despiste no evita los tres aciertos', () => {
    st.record('f2', 'T1.01', 0, 1000);
    st.record('f2', 'T1.01', 1, 2000);
    st.record('f2', 'T1.01', 0, 3000);
    st.setMotivo('f2', 'T1.01', 4, 4000);
    expect(st.pendingFailure(st.rec('f2'))).toBe(true);
    expect(st.failureStreak(st.rec('f2'))).toBe(0);
    st.record('f2', 'T1.01', 1, 5000);
    expect(st.pendingFailure(st.rec('f2'))).toBe(true);
    st.record('bien', 'T1.01', 1, 6000);
    st.doubt('bien', 'T1.01', 7000);
    expect(st.pendingFailure(st.rec('bien'))).toBe(false);
  });
  it('marcar y desmarcar temario persiste y no cuenta como acierto', async () => {
    st.record('f3', 'T1.01', 0, 1000);
    st.setReviewed('f3', 'T1.01', true);
    expect(st.rec('f3')[11]).toBe(1);
    expect(st.rec('f3').slice(0,2)).toEqual([1,0]);
    expect(st.pendingFailure(st.rec('f3'))).toBe(true);
    expect(st.takeDirty().has('T1.01')).toBe(true);
    vi.resetModules(); st = await import('../src/core/store.js');
    expect(st.rec('f3')[11]).toBe(1);
    st.setReviewed('f3', 'T1.01', false);
    expect(st.rec('f3')[11]).toBe(0);
    const exported=st.exportAll(); st.resetAll(); st.importAll(exported);
    expect(st.rec('f3')[11]).toBe(0);
    expect(st.pendingFailure(st.rec('f3'))).toBe(true);
  });
  it('conserva el contador y la marca al importar y fusionar; no inventa aciertos antiguos', () => {
    st.mergeRemote({ old:[9,6,1000,2,9000,1,0], solved:[9,6,2000,3,9000,1,0,0,0,0,3,1] });
    expect(st.failureStreak(st.rec('old'))).toBe(0);
    expect(st.pendingFailure(st.rec('old'))).toBe(true);
    expect(st.pendingFailure(st.rec('solved'))).toBe(false);
    expect(st.rec('solved')[11]).toBe(1);
    st.record('old','T1.01',1,3000);
    expect(st.failureStreak(st.rec('old'))).toBe(1);
    expect(st.cleanRec([2,1,5000,0,0,1,0,0,0,0,999,3]).slice(10)).toEqual([3,0]);
  });
});
