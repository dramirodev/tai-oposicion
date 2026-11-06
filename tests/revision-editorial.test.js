import { it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { verifyQuestionContent } from '../src/adapters/http/question-content-verification.js';
import { hasApprovedQuestionContent } from '../src/core/domain/question-content-proof.js';
afterEach(()=>vi.unstubAllGlobals());
import { applyEditorialScoring, isQuestionEditoriallyQuarantined, questionReviewOverride } from '../src/core/domain/question-review-overrides.js';
import { questionNotice } from '../src/shared/presentation/study-content.js';
import { filterScoringQuestions } from '../src/core/domain/selection.js';
const load = f => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
const by = (f, id) => load(f).find(q => q.i === id);
it('conserva el original y la reparación documentada de AT309 y mantiene la cuarentena PHP', () => {
  const q = by('T3.09.json', 'AT309-P1-12');
  const reviewed=JSON.parse(readFileSync('scripts/bank-editorial/reviewed-development11.json','utf8')).questions.find(row=>row.id===q.i);
  expect(reviewed.before.c).toBe(3);
  expect(reviewed.before.q).toContain('INCORRECTA');
  expect(reviewed.before.np).toBe(1);
  expect(q).toEqual(reviewed.after);
  const php = by('T3.03.json', 'GEN-T3.03-48');
  const review = JSON.parse(readFileSync('scripts/bank-editorial/reviewed-wave2.json', 'utf8')).questions.find(q => q.id === php.i);
  expect(php).toEqual(review.after);
  expect(php.q).toContain('En PHP');
  expect(php.np).toBe(1); expect(php.w).toBe(1);
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

it('PHP y las versiones anteriores ambiguas no puntúan; sólo las dos reparaciones exactas se activan', async () => {
 for(const [f,id] of [['T3.09.json','AT309-P1-12'],['T3.03.json','GEN-T3.03-48'],['T3.03.json','GEN-T3.03-48.v1'],['T3.08.json','GEN-T3.08-418.v1']]) {
  const q=by(f,id); expect(q.n?.length,id).toBeGreaterThan(40);
 if(['GEN-T3.08-418.v1','AT309-P1-12'].includes(id)){
  const ledger=id==='GEN-T3.08-418.v1'?'reviewed-web23':'reviewed-development11';
  const entry=JSON.parse(readFileSync(`scripts/bank-editorial/${ledger}.json`,'utf8')).questions.find(q=>q.id===id);
  expect(q).toEqual(entry.after); expect(entry.before.np).toBe(1);
  vi.stubGlobal('crypto',webcrypto);
  expect(applyEditorialScoring(await verifyQuestionContent(entry.before)).np).toBe(1);
  const approved=await verifyQuestionContent(q);expect(hasApprovedQuestionContent(approved)).toBe(true);expect(applyEditorialScoring(approved).np).not.toBe(1);
 }else expect(q.np,id).toBe(1);
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

it.each([
 ['T3.05', 'AS09-P1-48', 'diagrama de clases UML', 'Simulacro 09.pdf', 9],
 ['T3.05', 'AS10B-P1-63', 'identificar el diagrama', 'Simulacro 10 (bis).pdf', 11],
 ['T3.06', 'AS09-P1-52', 'código Java', 'Simulacro 09.pdf', 10],
 ['T2.03', 'AS08B-P1-37', 'árbol', 'Simulacro 08 (bis).pdf', 8],
 ['T2.03', 'AS10B-P1-40', 'grafo', 'Simulacro 10 (bis).pdf', 8],
])('protege %s %s y localiza el material necesario en el PDF', (topic, id, content, source, page) => {
 const raw = by(topic + '.json', id);
 const protectedQuestion = applyEditorialScoring(raw);
 expect(protectedQuestion).toEqual({ ...raw, np: 1 });
 expect(filterScoringQuestions([protectedQuestion], false, q => q.np)).toEqual([]);
 expect(filterScoringQuestions([protectedQuestion], true, q => q.np)).toEqual([protectedQuestion]);
 const notice = questionNotice(raw);
 expect(notice).toContain(content);
 expect(notice).toContain(source + ', página ' + page);
 expect(notice).toContain('Solo estudio');
});


it('exige prueba de contenido para las 397 nuevas correcciones factuales', () => {
 const previous = JSON.parse(readFileSync('scripts/bank-editorial/reviewed-19.json', 'utf8')).questions;
 const followup = JSON.parse(readFileSync('scripts/bank-editorial/reviewed-followup.json', 'utf8')).questions.filter(q => q.priority === 'P0');
 const wave2 = JSON.parse(readFileSync('scripts/bank-editorial/reviewed-wave2.json', 'utf8')).questions.filter(q => q.after.np !== 1);
 const admin = JSON.parse(readFileSync('scripts/bank-editorial/reviewed-admin20.json', 'utf8')).questions;
 const legal = JSON.parse(readFileSync('scripts/bank-editorial/reviewed-legal19.json', 'utf8')).questions;
 const programming = JSON.parse(readFileSync('scripts/bank-editorial/reviewed-programming20.json', 'utf8')).questions;
 const following = ['reviewed-web25','reviewed-architecture20','reviewed-languages17','reviewed-web23','reviewed-development11','reviewed-systems20','reviewed-foundations18','reviewed-systems16', 'reviewed-syntax3', 'reviewed-admin5', 'reviewed-network2'].flatMap(name=>JSON.parse(readFileSync('scripts/bank-editorial/'+name+'.json','utf8')).questions);
 const entries = [...previous, ...followup, ...wave2, ...admin, ...legal, ...programming, ...following];
 expect(entries).toHaveLength(397);
 for (const entry of entries) {
  for (const version of [entry.before, entry.after]) {
   expect(questionReviewOverride(version.i), version.i).toBeDefined();
   const safe = applyEditorialScoring(version);
   expect(safe.np).toBe(1);
   expect(filterScoringQuestions([safe], false, q => q.np)).toEqual([]);
   expect(questionNotice(safe)).toContain('incorrección confirmada');
  }
 }
});
