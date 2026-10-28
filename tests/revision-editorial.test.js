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
  const store = await import('../src/adapters/local/legacy-store.js');
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

it('conserva las correcciones y los ejemplos de código de las preguntas generadas', () => {
  const kruskal = by('T2.03.json', 'GEN-T2.03-86.v2');
  expect(kruskal.a[kruskal.c]).toBe('Una arista de peso mínimo.');
  expect(kruskal.n).toContain('Kruskal procesa aristas de menor a mayor peso');

  const c90 = by('T3.06.json', 'GEN-T3.06-06');
  expect(c90.q).toContain('C90');
  expect(c90.n).toContain('La declaración tras una sentencia se admite desde C99');

  const cpp = by('T3.06.json', 'GEN-T3.06-55.v1');
  expect(cpp.a[cpp.c]).toBe('La condición de una estructura do/while.');
  expect(cpp.n).toContain('do/while exige una expresión');

  const bootstrap = by('T3.08.json', 'GEN-T3.08-588');
  expect(bootstrap.q).toContain('Bootstrap 3');
  expect(bootstrap.n).toContain('SM=768, MD=992 y LG=1200');

  expect(by('T3.06.json', 'GEN-T3.06-69').u).toContain('(::)');
  expect(by('T3.06.json', 'GEN-T3.06-87').u).toContain('template <class T>');
  expect(by('T3.06.json', 'GEN-T3.06-284').u).toContain('<%@include ... %>');
  expect(by('T3.06.json', 'GEN-T3.06-409').u).toContain('Expresiones Razor explícitas');

  for (const id of ['GEN-T3.06-338', 'GEN-T3.06-338.v1', 'GEN-T3.06-338.v2']) {
    expect(by('T3.06.json', id).u).toContain('@OneToMany(mappedBy="profesor", cascade=CascadeType.ALL)');
  }
  for (const id of ['GEN-T3.06-340', 'GEN-T3.06-340.v1', 'GEN-T3.06-340.v2']) {
    const question = by('T3.06.json', id);
    expect(question.u).toContain('cascade=CascadeType.ALL');
    expect(question.u).toContain('joinColumns=');
    expect(question.u).not.toMatch(/(?:^|,\s*)JoinColumns=/);
  }
});
