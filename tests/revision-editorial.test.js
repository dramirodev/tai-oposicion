import { it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
const load = f => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
const by = (f, id) => load(f).find(q => q.i === id);
it('las preguntas reescritas como «versión editorial» vuelven a su contenido original', () => {
  const q = by('T3.09.json', 'AT309-P1-12');
  expect(q.c).toBe(3);
  expect(q.q).toContain('INCORRECTA');
  expect(by('T3.03.json', 'GEN-T3.03-48').q).toContain('débilmente tipados');
  for (const [f, id] of [['T3.09.json', 'AT309-P1-12'], ['T3.03.json', 'GEN-T3.03-48'], ['T3.03.json', 'GEN-T3.03-48.v1'], ['T3.08.json', 'GEN-T3.08-418.v1']]) {
    expect(by(f, id).n || '').not.toContain('VERSIÓN EDITORIAL');
  }
});
it('marcar el temario como repasado no cambia el día de actividad de la pregunta', async () => {
  localStorage.clear();
  const store = await import('../src/infra/store.js');
  const t0 = Date.UTC(2026, 9, 1, 10);
  store.record('AT101-P1-01', 'T1.01', 0, t0);
  store.setReviewed('AT101-P1-01', 'T1.01', true);
  const r = store.rec('AT101-P1-01');
  expect(r[11]).toBe(1);
  expect(r[2]).toBe(t0);
  expect(r[12]).toBeGreaterThan(t0);
});

it('las cuatro preguntas ambiguas advierten del problema y no puntúan', () => {
 for(const [f,id] of [['T3.09.json','AT309-P1-12'],['T3.03.json','GEN-T3.03-48'],['T3.03.json','GEN-T3.03-48.v1'],['T3.08.json','GEN-T3.08-418.v1']]) {
  const q=by(f,id); expect(q.n?.length,id).toBeGreaterThan(40); expect(q.np,id).toBe(1);
 }
});
