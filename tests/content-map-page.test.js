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
    test:{ loadTopics:async()=>[{ id:'T3.01', name:'Modelo Entidad-Relación' }], loadTopicQuestions:vi.fn(async()=>[question]) },
  };
}

it('redirects non-owners and does not load the question catalog', async () => {
  const configured = services(false);
  renderApp(createElement('div', null, createElement(AcademyQuestionSectionMapPage), createElement(CurrentPath)), { services:configured, initialEntries:['/curar-contenido'] });
  await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/home'));
  expect(configured.test.loadTopicQuestions).not.toHaveBeenCalled();
});

it('creates a local reviewed link with exact question and Drive material versions', async () => {
  const user = userEvent.setup();
  window.localStorage.clear();
  const configured = services();
  renderApp(createElement(AcademyQuestionSectionMapPage), { services:configured, initialEntries:['/curar-contenido'] });
  await user.selectOptions(await screen.findByLabelText('Tema'), 'T3.01');
  await user.selectOptions(await screen.findByLabelText('Pregunta'), 'academy-q1');
  const testSelect = screen.getByLabelText('PDF de test de Drive');
  await waitFor(() => expect(testSelect.options.length).toBeGreaterThan(1));
  await user.selectOptions(testSelect, testSelect.options[1].value);
  const sectionSelect = screen.getByLabelText('Epígrafe del temario');
  await user.selectOptions(sectionSelect, sectionSelect.options[1].value);
  await user.type(screen.getByLabelText('Página del test'), '2');
  await user.type(screen.getByLabelText('Por qué corresponde esta pregunta al epígrafe'), 'La pregunta evalúa el concepto indicado en el epígrafe del temario.');
  await user.type(screen.getByLabelText('Identificador del revisor'), 'revisor-local');
  await user.click(screen.getByRole('checkbox', { name:/He cotejado la pregunta/ }));
  await user.click(screen.getByRole('button', { name:'Añadir al borrador local' }));

  const saved = JSON.parse(window.localStorage.getItem('tai.academy-question-section-map:v1:curator'));
  expect(isAcademyQuestionSectionManifest(saved)).toBe(true);
  expect(saved.links).toHaveLength(1);
  expect(saved.links[0]).toMatchObject({ questionId:'academy-q1', topicId:'T3.01', reviewer:'revisor-local', rationale:'La pregunta evalúa el concepto indicado en el epígrafe del temario.' });
  expect(saved.links[0].testEvidence).toMatchObject({ page:2, sourceHash:expect.any(String) });
  expect(saved.links[0].sectionEvidence).toMatchObject({ page:expect.any(Number), sourceHash:expect.any(String), outlineFingerprint:expect.any(String) });
  expect(await screen.findByText(/Se guarda solo en este dispositivo y cuenta/)).toBeInTheDocument();
});
