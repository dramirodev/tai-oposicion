import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { AcademyQuestionSectionMapPage } from '../src/features/content-map/AcademyQuestionSectionMapPage.tsx';
import { isAcademyQuestionSectionManifest } from '../src/core/domain/academy-question-section-map.ts';

function CurrentPath() { const location = useLocation(); return createElement('output', { 'data-testid':'current-path' }, location.pathname); }
const question = { i:'academy-q1', t:'T3.01', o:'A', q:'En el modelo entidad relación, ¿qué representa el dominio?', a:['Valores permitidos','Una tabla','Una consulta','Un índice'], c:0 };
const matchedQuestion = { i:'AT303-P1-08', t:'T3.03', o:'A', q:'Indique el número de veces que se ejecuta el cuerpo del siguiente bucle: int salto = 3; for (int i=0; i>0; i*=salto) System.out.println(i);', a:['16.','17.','0.','18.'], c:2 };
function services(owner = true, questions = [question]) {
  return {
    access:{ accountId:()=>'curator', subscribe:()=>()=>{}, load:async()=>({ owner, requests:[], grants:[] }) },
    test:{ loadTopics:async()=>[{ id:'T3.01', name:'Modelo Entidad-Relación' }, { id:'T1.04', name:'Transparencia' }, { id:'T3.03', name:'Lenguajes de Programación' }], loadTopicQuestions:vi.fn(async()=>questions) },
  };
}

it('redirects non-owners and does not load the question catalog', async () => {
  const configured = services(false);
  renderApp(createElement('div', null, createElement(AcademyQuestionSectionMapPage), createElement(CurrentPath)), { services:configured, initialEntries:['/curar-contenido'] });
  await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/home'));
  expect(configured.test.loadTopicQuestions).not.toHaveBeenCalled();
});

it('creates a local reviewed link when the Drive test topic differs from the question and destination topics', async () => {
  const user = userEvent.setup();
  window.localStorage.clear();
  const configured = services();
  const view = renderApp(createElement(AcademyQuestionSectionMapPage), { services:configured, initialEntries:['/curar-contenido'] });
  await user.selectOptions(await screen.findByLabelText('Tema de la pregunta'), 'T3.01');
  await user.selectOptions(await screen.findByLabelText('Tema del PDF de origen'), 'T1.04');
  await user.selectOptions(await screen.findByLabelText('Tema del epígrafe de destino'), 'T3.01');
  await user.selectOptions(await screen.findByLabelText('Pregunta'), 'academy-q1');
  const testSelect = screen.getByLabelText('PDF de test de Drive');
  await waitFor(() => expect(testSelect.options.length).toBeGreaterThan(1));
  expect(Array.from(testSelect.options).some(option => /texto extraíble \(no integrado en la app\)/.test(option.text))).toBe(true);
  await user.selectOptions(testSelect, 'T1.04 Transparencia/T1.04 Transparencia - Test 1.pdf');
  expect(await screen.findByText(/la aplicación no incorpora su cuerpo/)).toBeInTheDocument();
  const sectionSelect = screen.getByLabelText('Epígrafe del temario');
  await user.selectOptions(sectionSelect, sectionSelect.options[1].value);
  await user.type(screen.getByLabelText('Página física del PDF de test'), '2');
  await user.type(screen.getByLabelText('Por qué corresponde esta pregunta al epígrafe'), 'La pregunta evalúa el concepto indicado en el epígrafe del temario.');
  await user.type(screen.getByLabelText('Identificador del revisor'), 'revisor-local');
  await user.click(screen.getByRole('checkbox', { name:/He cotejado la pregunta/ }));
  await user.click(screen.getByRole('button', { name:'Añadir al borrador local' }));

  const saved = JSON.parse(window.localStorage.getItem('tai.academy-question-section-map:v2:curator'));
  expect(isAcademyQuestionSectionManifest(saved)).toBe(true);
  expect(saved.links).toHaveLength(1);
  expect(saved.links[0]).toMatchObject({ questionId:'academy-q1', questionTopicId:'T3.01', testMaterialTopicId:'T1.04', sectionTopicId:'T3.01', reviewer:'revisor-local', rationale:'La pregunta evalúa el concepto indicado en el epígrafe del temario.' });
  expect(saved.links[0].testEvidence).toMatchObject({ page:2, sourceHash:expect.any(String), path:'T1.04 Transparencia/T1.04 Transparencia - Test 1.pdf' });
  expect(saved.links[0].sectionEvidence).toMatchObject({ page:expect.any(Number), sourceHash:expect.any(String), outlineFingerprint:expect.any(String) });
  expect(await screen.findByText(/Se guarda solo en este dispositivo y cuenta/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name:'Retirar del borrador local' }));
  expect(JSON.parse(window.localStorage.getItem('tai.academy-question-section-map:v2:curator')).links).toHaveLength(0);
  expect(await screen.findByText('Vínculo retirado del borrador local.')).toBeInTheDocument();
  expect(screen.getByText('Aún no hay vínculos para este tema.')).toBeInTheDocument();
  view.unmount();
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:configured, initialEntries:['/curar-contenido'] });
  expect(await screen.findByText('Borrador local · 0 vínculos')).toBeInTheDocument();
});

it('reads v1 local drafts as same-topic v2 links without deleting the legacy key', async () => {
  const legacy = {
    schemaVersion:1, revision:'legacy-review', links:[{
      status:'approved', questionId:'old-q', contentRevision:'fnv1a-01234567', topicId:'T3.01', sectionId:'ci-0123456789abcdefabcd',
      testEvidence:{ path:'T3.01/test.pdf', sourceHash:'a'.repeat(64), page:2 },
      sectionEvidence:{ path:'T3.01/outline.pdf', sourceHash:'b'.repeat(64), outlineFingerprint:'c'.repeat(64), page:3 },
      rationale:'Revisión histórica local válida.', reviewedAt:100, reviewer:'old-editor',
    }],
  };
  window.localStorage.clear();
  window.localStorage.setItem('tai.academy-question-section-map:v1:curator', JSON.stringify(legacy));
  window.localStorage.setItem('tai.academy-question-section-map:v2:curator', '{invalid-json');
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:services(), initialEntries:['/curar-contenido'] });
  expect(await screen.findByText('Borrador local · 1 vínculo')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('tai.academy-question-section-map:v1:curator'))).toEqual(legacy);
  expect(window.localStorage.getItem('tai.academy-question-section-map:v2:curator')).toBe('{invalid-json');
});

it('keeps editorial drafts isolated when the active account changes', async () => {
  window.localStorage.clear();
  const otherManifest = {
    schemaVersion:2, revision:'other-account-draft', links:[{
      status:'approved', questionId:'academy-q1', contentRevision:'fnv1a-12345678',
      questionTopicId:'T3.01', testMaterialTopicId:'T1.04', sectionTopicId:'T3.01', sectionId:'ci-0123456789abcdefabcd',
      testEvidence:{ path:'test.pdf', sourceHash:'a'.repeat(64), page:1 },
      sectionEvidence:{ path:'section.pdf', sourceHash:'b'.repeat(64), outlineFingerprint:'c'.repeat(64), page:1 },
      rationale:'Vínculo sintético de otra cuenta para verificar aislamiento.', reviewedAt:1, reviewer:'fixture',
    }],
  };
  window.localStorage.setItem('tai.academy-question-section-map:v2:other', JSON.stringify(otherManifest));
  const configured = services();
  const activeAccount = { id:'curator' };
  configured.access.accountId = () => activeAccount.id;
  const listeners = new Set();
  configured.access.subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  const changeAccount = id => { activeAccount.id = id; listeners.forEach(listener => listener()); };
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:configured, initialEntries:['/curar-contenido'] });
  expect(await screen.findByText('Borrador local · 0 vínculos')).toBeInTheDocument();

  changeAccount('other');
  expect(await screen.findByText('Borrador local · 1 vínculo')).toBeInTheDocument();
  await userEvent.setup().selectOptions(await screen.findByLabelText('Tema de la pregunta'), 'T3.01');
  expect(screen.getByRole('article')).toHaveTextContent('academy-q1 · pregunta T3.01');

  changeAccount('curator');
  expect(await screen.findByText('Borrador local · 0 vínculos')).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('imports a valid local manifest and preserves it after rejecting malformed JSON', async () => {
  window.localStorage.clear();
  const imported = {
    schemaVersion:2, revision:'imported-manifest', links:[{
      status:'approved', questionId:'academy-q1', contentRevision:'fnv1a-12345678',
      questionTopicId:'T3.01', testMaterialTopicId:'T1.04', sectionTopicId:'T3.01', sectionId:'ci-0123456789abcdefabcd',
      testEvidence:{ path:'test.pdf', sourceHash:'a'.repeat(64), page:1 },
      sectionEvidence:{ path:'section.pdf', sourceHash:'b'.repeat(64), outlineFingerprint:'c'.repeat(64), page:1 },
      rationale:'Vínculo sintético importado desde un archivo local.', reviewedAt:1, reviewer:'fixture',
    }],
  };
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:services(), initialEntries:['/curar-contenido'] });
  const user = userEvent.setup();
  const fileInput = await screen.findByLabelText('Importar manifiesto');
  const jsonFile = (text, name) => {
    const file = new File([text], name, { type:'application/json' });
    Object.defineProperty(file, 'text', { value:async () => text });
    return file;
  };
  await user.upload(fileInput, jsonFile(JSON.stringify(imported), 'draft.json'));
  expect(await screen.findByText('Manifiesto v2 importado. Comprueba vigencia al abrir los temas.')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('tai.academy-question-section-map:v2:curator'))).toEqual(imported);

  await user.upload(fileInput, jsonFile('{invalid json', 'broken.json'));
  expect(await screen.findByText('No se pudo leer el JSON seleccionado.')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('tai.academy-question-section-map:v2:curator'))).toEqual(imported);
});

it('preselects only the exact current source candidate and leaves section approval manual', async () => {
  const user = userEvent.setup();
  window.localStorage.clear();
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:services(true, [matchedQuestion]), initialEntries:['/curar-contenido'] });
  await user.selectOptions(await screen.findByLabelText('Tema de la pregunta'), 'T3.03');
  await user.selectOptions(await screen.findByLabelText('Pregunta'), 'AT303-P1-08');
  expect(await screen.findByText(/Coincidencias candidatas en tests de Drive/)).toBeInTheDocument();
  const candidate = await screen.findByRole('button', { name:/Preseleccionar T3\.03 .* PDF p\. 3/ });
  await user.click(candidate);
  expect(screen.getByLabelText('Tema del PDF de origen')).toHaveValue('T3.03');
  await waitFor(() => expect(screen.getByLabelText('PDF de test de Drive')).toHaveValue('T3.03 Lenguajes de Programación/T3.03 Lenguajes de Programación - Test.pdf'));
  expect(screen.getByLabelText('Página física del PDF de test')).toHaveValue(3);
  expect(screen.getByLabelText('Epígrafe del temario')).toHaveValue('');
  expect(screen.getByRole('checkbox', { name:/He cotejado la pregunta/ })).not.toBeChecked();
});

it('offers a searchable candidate queue and opens a question without proposing a destination', async () => {
  const user = userEvent.setup();
  window.localStorage.clear();
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:services(true, [matchedQuestion]), initialEntries:['/curar-contenido'] });
  await user.selectOptions(await screen.findByLabelText('Tema de la pregunta'), 'T3.03');
  expect(await screen.findByText(/Cola de candidatos sin vínculo · 1/)).toBeInTheDocument();
  const openCandidate = await screen.findByRole('button', { name:'Abrir para cotejar' });
  await user.click(openCandidate);
  expect(await screen.findByText(/Coincidencias candidatas en tests de Drive/)).toBeInTheDocument();
  expect(screen.getByLabelText('Pregunta')).toHaveValue('AT303-P1-08');
  expect(screen.getByLabelText('Epígrafe del temario')).toHaveValue('');
  expect(screen.getByRole('checkbox', { name:/He cotejado la pregunta/ })).not.toBeChecked();
  await user.type(screen.getByLabelText('Buscar candidato'), 'no existe');
  expect(screen.getByText('No hay candidatos pendientes para este tema o filtro.')).toBeInTheDocument();
});
