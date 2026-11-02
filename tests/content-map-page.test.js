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
function services(owner = true) {
  return {
    access:{ accountId:()=>'curator', subscribe:()=>()=>{}, load:async()=>({ owner, requests:[], grants:[] }) },
    test:{ loadTopics:async()=>[{ id:'T3.01', name:'Modelo Entidad-Relación' }, { id:'T1.04', name:'Transparencia' }], loadTopicQuestions:vi.fn(async()=>[question]) },
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
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:configured, initialEntries:['/curar-contenido'] });
  await user.selectOptions(await screen.findByLabelText('Tema de la pregunta'), 'T3.01');
  await user.selectOptions(await screen.findByLabelText('Tema del PDF de origen'), 'T1.04');
  await user.selectOptions(await screen.findByLabelText('Tema del epígrafe de destino'), 'T3.01');
  await user.selectOptions(await screen.findByLabelText('Pregunta'), 'academy-q1');
  const testSelect = screen.getByLabelText('PDF de test de Drive');
  await waitFor(() => expect(testSelect.options.length).toBeGreaterThan(1));
  await user.selectOptions(testSelect, 'T1.04 Transparencia/T1.04 Transparencia - Test 1.pdf');
  const sectionSelect = screen.getByLabelText('Epígrafe del temario');
  await user.selectOptions(sectionSelect, sectionSelect.options[1].value);
  await user.type(screen.getByLabelText('Página del test'), '2');
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
  expect(await screen.findByText('Borrador local · 1 vínculos')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('tai.academy-question-section-map:v1:curator'))).toEqual(legacy);
  expect(window.localStorage.getItem('tai.academy-question-section-map:v2:curator')).toBe('{invalid-json');
});
