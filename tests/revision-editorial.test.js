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
  const store = await import('../src/adapters/local/local-progress-store.js');
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

it('incluye 24 preguntas editoriales resueltas con fuente verificable', () => {
  const reviewed = [
    ['GEN-T2.01-66.v2', 'Un cuello de botella en el acceso a memoria.'],
    ['GEN-T2.03-27', 'El mismo valor hash.'],
    ['GEN-T2.03-77.v2', 'lg n comparaciones.'],
    ['GEN-T3.03-63.v2', 'Tomar decisiones.'],
    ['GEN-T3.03-41.v2', 'Conversiones implícitas inseguras.'],
    ['GEN-T3.05-93.v2', 'Diciembre de 2017.'],
    ['GEN-T3.06-420.v2', 'gRPC.'],
    ['GEN-T3.06-99.v2', 'System.Nullable<T>.'],
    ['GEN-T3.07-66', 'OpenShift o Kubernetes.'],
    ['GEN-T3.07-66.v1', 'Aún no cubrían por completo esos aspectos.'],
    ['GEN-T3.07-123.v2', 'Convertir automáticamente un fichero WSDL de una versión a otra.'],
    ['GEN-T3.07-176', 'WADL.'],
    ['GEN-T3.07-176.v1', 'Web Application Description Language.'],
    ['GEN-T3.07-176.v2', 'XML.'],
    ['GEN-T3.08-56.v1', '1.1.'],
    ['GEN-T3.08-69.v2', 'xs:schema.'],
    ['GEN-T3.08-795.v2', '2xx, satisfactoria.'],
    ['GEN-T3.08-937.v2', 'Añade el valor 5 al final del array.'],
    ['GEN-T3.08-950', 'Elimina un elemento del principio del array.'],
    ['GEN-T3.08-950.v1', 'Elimina el último elemento del array.'],
    ['GEN-T3.08-1142.v2', 'Natural Language Toolkit.'],
    ['GEN-T3.08-1325.v2', 'Don’t Repeat Yourself.'],
    ['GEN-T4.08-45.v1', '1999.'],
    ['GEN-T4.02-143', 'En una capa escribible del contenedor sobre las capas de imagen de solo lectura.'],
  ];
  const index = load('index.json');
  const metadata = load('meta.json');
  for (const [id, answer] of reviewed) {
    const topic = id.match(/^GEN-(T\d+\.\d{2})-/)?.[1];
    const question = topic && by(`${topic}.json`, id);
    expect(question, id).toBeDefined();
    expect(question.a[question.c], id).toBe(answer);
    expect(question.v, id).toBe(0);
    expect(question.u, id).toBeTruthy();
    expect(isQuestionEditoriallyQuarantined(id), id).toBe(false);
    expect(metadata[id]?.[1], id).toBe('G');
    const topicIndex = index.temas.find(entry => entry.id === topic);
    expect(topicIndex, id).toBeDefined();
  }
});

it('corrige las tres reservas con citas locales precisas', () => {
  const reviewed = [
    ['T3.07.json', 'GEN-T3.07-66.v2', 'Punto a punto, dotando a cada microservicio de inteligencia adicional.'],
    ['T3.07.json', 'GEN-T3.07-182.v2', 'RESTful.'],
    ['T3.08.json', 'GEN-T3.08-63.v2', 'El documento debe tener un único elemento raíz.'],
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

it('precisa preguntas repetidas cuando el mismo pasaje sustenta más de una respuesta', () => {
  const orders = by('T1.05.json', 'GEN-T1.05-54.v2');
  const gifts = by('T1.05.json', 'GEN-T1.05-55.v2');
  expect(orders.q).toContain('infracción manifiesta');
  expect(orders.a[orders.c]).toContain('inmediatamente');
  expect(orders.q).not.toBe(gifts.q);
  expect(gifts.a[gifts.c]).toContain('usos habituales, sociales y de cortesía');

  const navigation = by('T3.06.json', 'GEN-T3.06-243');
  const session = by('T3.06.json', 'GEN-T3.06-243.v1');
  expect(navigation.q).toContain('navegación');
  expect(navigation.a[navigation.c]).toContain('Controlar el flujo');
  expect(session.q).toContain('sesión');
  expect(session.a[session.c]).toContain('Mantener el estado');

  const framework = by('T3.06.json', 'GEN-T3.06-277');
  const specification = by('T3.06.json', 'GEN-T3.06-281.v2');
  expect(framework.q).toContain('tipo de framework');
  expect(framework.a[framework.c]).toContain('framework de interfaz');
  expect(specification.q).toContain('implementaciones');
  expect(specification.a[specification.c]).toContain('Mojarra');
  expect(specification.u).toContain('Apache MyFaces');
});
