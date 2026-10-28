import { it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { isQuestionEditoriallyQuarantined } from '../src/core/domain/question-review-overrides.js';
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

it('permite las 16 preguntas corregidas tras cotejarlas con sus fuentes', () => {
  const reviewed = [
    ['T2.01.json', 'GEN-T2.01-18.v1', 'La universalidad, la eficiencia y la no ambigüedad.'],
    ['T3.03.json', 'GEN-T3.03-26.v2', 'Procesan datos.'],
    ['T3.03.json', 'GEN-T3.03-35.v2', 'Los sucesos (eventos) que ocurren.'],
    ['T3.03.json', 'GEN-T3.03-42', 'Propósitos específicos.'],
    ['T3.06.json', 'GEN-T3.06-19.v2', 'main.'],
    ['T3.06.json', 'GEN-T3.06-100.v2', 'const.'],
    ['T3.06.json', 'GEN-T3.06-428.v1', 'El objeto DataReader.'],
    ['T3.07.json', 'GEN-T3.07-27.v1', 'HTML.'],
    ['T3.07.json', 'GEN-T3.07-30.v2', 'Lógica de negocio compleja para los servidores.'],
    ['T3.07.json', 'GEN-T3.07-31.v2', 'Tres o más niveles.'],
    ['T3.07.json', 'GEN-T3.07-72.v2', 'SOAP.'],
    ['T3.07.json', 'GEN-T3.07-123', '2.0.'],
    ['T3.07.json', 'GEN-T3.07-123.v1', '1.1.'],
    ['T3.07.json', 'GEN-T3.07-173', 'Swagger.'],
    ['T3.10.json', 'GEN-T3.10-324.v1', 'master.'],
    ['T4.10.json', 'GEN-T4.10-40.v1', 'La detección de colisiones.'],
  ];
  for (const [file, id, answer] of reviewed) {
    const question = by(file, id);
    expect(question, id).toBeDefined();
    expect(question.a[question.c], id).toBe(answer);
    expect(question.v, id).toBe(0);
    expect(question.u, id).toBeTruthy();
    expect(isQuestionEditoriallyQuarantined(id), id).toBe(false);
  }
});
