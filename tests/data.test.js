import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(__dirname, '../public/data');
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const index = read('index.json'), meta = read('meta.json'), sup = read('supuestos.json');
const banks = Object.fromEntries(index.temas.map(t => [t.id, read(t.id + '.json')]));
const all = Object.values(banks).flat();

describe('banco de preguntas (public/data)', () => {
  it('hay 36 temas y el índice coincide con los archivos', () => {
    expect(index.temas).toHaveLength(36);
    for (const t of index.temas) expect(banks[t.id], t.id).toHaveLength(t.n);
    expect(index.n).toBe(all.length);
  });
  it('ids únicos en todo el banco', () => {
    const ids = all.map(q => q.i); expect(new Set(ids).size).toBe(ids.length);
  });
  it('cada pregunta tiene enunciado, 4 opciones no vacías y una correcta válida', () => {
    for (const q of all) {
      expect(typeof q.q === 'string' && q.q.trim().length > 5, q.i).toBe(true);
      expect(q.a, q.i).toHaveLength(4);
      for (const o of q.a) expect(typeof o === 'string' && o.trim().length > 0, q.i).toBe(true);
      expect([0, 1, 2, 3], q.i).toContain(q.c);
    }
  });
  it('el origen es O, A o G y el tema de cada pregunta coincide con su archivo', () => {
    for (const [t, qs] of Object.entries(banks)) for (const q of qs) { expect('OAG').toContain(q.o); expect(q.t, q.i).toBe(t); }
  });
  it('las generadas llevan cita literal del temario', () => {
    for (const q of all.filter(q => q.o === 'G')) expect(typeof q.u === 'string' && q.u.length > 10, q.i).toBe(true);
  });
  it('meta.json cubre todas las preguntas con el tema correcto', () => {
    for (const q of all) expect(meta[q.i]?.[0], q.i).toBe(q.t);
  });
  it('cada tema tiene peso positivo para el simulacro', () => { for (const t of index.temas) expect(t.w, t.id).toBeGreaterThan(0); });
  it('supuestos: preguntas válidas y los que ofrece el simulacro tienen enunciado', () => {
    const k = Object.keys(sup); expect(k.length).toBeGreaterThanOrEqual(30);
    for (const id of k) {
      const v = sup[id];
      for (const q of v.q) { expect(q.a, q.i).toHaveLength(4); expect([0, 1, 2, 3], q.i).toContain(q.c); }
      // mismo criterio que la parte 2 del simulacro (routes.sim2)
      const elegible = v.q.filter(x => !x.r).length >= 18 && /libre/i.test(v.conv || '') && !/2018/.test(v.conv || '');
      if (elegible) expect(v.texto.length, id).toBeGreaterThan(50);
    }
  });
  it('hay al menos 2 supuestos elegibles para la parte 2', () => {
    const n = Object.values(sup).filter(v => v.q.filter(x => !x.r).length >= 18 && /libre/i.test(v.conv || '') && !/2018/.test(v.conv || '')).length;
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

import { readFileSync as _rf, readdirSync as _rd } from 'node:fs';
describe('preguntas con referencia a un ejemplo', () => {
  it('si el enunciado dice «ese ejemplo», «esa consulta», «el trigger anterior»… debe llevar contexto (cp)', () => {
    const re = /\b(ese|esa)\s+(mismo\s+)?(ejemplo|consulta)\b|\b(trigger|función|consulta|código)\s+anterior\b|\ben el ejemplo,|\ben ese ejemplo\b/i;
    const mal = [];
    for (const f of _rd('public/data').filter(x => /^T\d\.\d\d\.json$/.test(x)))
      for (const q of JSON.parse(_rf('public/data/' + f, 'utf8'))) if (re.test(q.q) && !q.cp) mal.push(q.i);
    expect(mal).toEqual([]);
  });
});
