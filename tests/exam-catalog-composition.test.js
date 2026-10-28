import { expect, it } from 'vitest';
import { createExamCatalog } from '../src/app/composition/simulations/exam-catalog-composition.js';

function metadataFor(groups) {
  const meta = { _by: {} };
  for (const { prefix, count, topic = 'T1.01', origin = 'O' } of groups) {
    for (let index = 1; index <= count; index++) meta[`${prefix}-${index}`] = [topic, origin, 'test', [], 0];
  }
  return meta;
}

it('clasifica oficiales, simulacros y pruebas de tema respetando origen y mínimos de preguntas', () => {
  const meta = metadataFor([
    { prefix: 'L2025A-P1', count: 20 },
    { prefix: 'AS12B-P1', count: 20 },
    { prefix: 'AT3-P1', count: 10, origin: 'A' },
    { prefix: 'AS13-P1', count: 19 },
    { prefix: 'AT4-P1', count: 10, origin: 'G' },
  ]);
  meta['L2025A-R-1'] = ['T1.01', 'O', 'test', [], 0];

  const catalog = createExamCatalog(meta, topicId => `Tema ${topicId}`);

  expect(catalog.ofi).toEqual([{ k: 'L2025A-P1', ids: Array.from({ length: 20 }, (_, index) => `L2025A-P1-${index + 1}`).sort(), nombre: 'Ingreso libre 2025' }]);
  expect(catalog.sims.map(({ k, nombre }) => ({ k, nombre }))).toEqual([{ k: 'AS12B-P1', nombre: 'Simulacro 12 (B)' }]);
  expect(catalog.tests.map(({ k, tema, nombre }) => ({ k, tema, nombre }))).toEqual([{ k: 'AT3-P1', tema: 'T1.01', nombre: 'Test T1.01 · Tema T1.01' }]);
});

it('ordena pruebas repetidas del mismo tema y etiqueta cada una', () => {
  const meta = metadataFor([
    { prefix: 'AT9-P1', count: 10, topic: 'T1.02', origin: 'A' },
    { prefix: 'AT2ALT-P1', count: 10, topic: 'T1.02', origin: 'A' },
  ]);

  const catalog = createExamCatalog(meta, () => 'Arquitectura');

  expect(catalog.tests.map(({ k, nombre }) => [k, nombre])).toEqual([
    ['AT2ALT-P1', 'Test T1.02 · Arquitectura (1)'],
    ['AT9-P1', 'Test T1.02 · Arquitectura (2)'],
  ]);
});
