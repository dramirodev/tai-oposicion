import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopicsPage } from '../src/features/home/TopicsPage.tsx';
import { academyCurriculumTopicLoaders } from '../src/core/domain/academy-curriculum.generated.js';
import { createAcademyMaterialRepository } from '../src/adapters/local/academy-material-repository.js';

afterEach(() => vi.unstubAllGlobals());

it('guarda el PDF solo por elección, lo recupera al remontar y lo elimina sin registrar progreso', async () => {
  const topic = (await academyCurriculumTopicLoaders['T1.01']()).academyCurriculumTopic;
  const fileReference = topic.files.find(file => file.name === 'T1.01 Constitución Española - Temario.pdf');
  const expectedHash = fileReference.sha256;
  const expectedBytes = Uint8Array.from(expectedHash.match(/.{2}/g), byte => Number.parseInt(byte, 16)).buffer;
  const bytes = new TextEncoder().encode('%PDF-fixture').buffer;
  const repository = createAcademyMaterialRepository(`academy-ui-test-${crypto.randomUUID()}`);
  const record = vi.fn(() => false);
  const localFiles = {
    accountId:() => null,
    subscribe:() => () => {},
    loadTopicProgress:async () => ({ selection:null, events:[] }),
    loadProgressOverview:async () => ({ selections:[], events:[] }),
    selectMaterials:() => false,
    record,
    listLocalPdfs:topicId => repository.list('guest', topicId),
    saveLocalPdf:copy => repository.save('guest', copy),
    removeLocalPdf:(topicId, materialPath, hash) => repository.remove('guest', topicId, materialPath, hash),
  };
  const topics = { accountId:() => null, getStudied:() => [], subscribe:() => () => {}, setStudied:() => {}, loadTopics:async () => [{ id:'T1.01', name:'Constitución Española', total:0, answered:0, accuracy:null }] };
  class TestURL extends URL {}
  TestURL.createObjectURL = vi.fn(() => 'blob:local-test');
  TestURL.revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', TestURL);
  vi.stubGlobal('crypto', { randomUUID:() => 'test-event-id', subtle:{ digest:async () => expectedBytes } });
  const services = { topics, academyStudyProgress:localFiles };
  const user = userEvent.setup();
  let view = renderApp(createElement(TopicsPage), { services, initialEntries:['/temario?topic=T1.01'] });
  await user.click(await screen.findByText(/Material de academia/));
  const file = new File([bytes], fileReference.name, { type:'application/pdf' });
  Object.defineProperty(file, 'arrayBuffer', { value:async () => bytes });
  await user.upload(screen.getByLabelText(`Elegir PDF ${fileReference.name}`), file);
  await screen.findByText(/PDF verificado/);
  const save = await screen.findByRole('button', { name:'Guardar PDF en este dispositivo para retomar' });
  await user.click(save);
  expect(await repository.list('guest', 'T1.01')).toHaveLength(1);
  expect(record).not.toHaveBeenCalled();

  view.unmount();
  view = renderApp(createElement(TopicsPage), { services, initialEntries:['/temario?topic=T1.01'] });
  await user.click(await screen.findByText(/Material de academia/));
  expect(await screen.findByText('Copias guardadas en este dispositivo')).toBeInTheDocument();
  expect(await screen.findByRole('link', { name:/Abrir .*página 3/i })).toHaveAttribute('href', 'blob:local-test#page=3');
  await user.click(screen.getByRole('button', { name:'Eliminar copia local' }));
  expect(await screen.findByText(/Copia local eliminada/)).toBeInTheDocument();
  expect(await repository.list('guest', 'T1.01')).toHaveLength(0);
  expect(record).not.toHaveBeenCalled();
  view.unmount();
});
