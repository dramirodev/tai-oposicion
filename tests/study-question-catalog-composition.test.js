import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('lee índice, metadatos y nombres de temas mediante el catálogo', async () => {
  const requested = [];
  vi.stubGlobal('fetch', async url => {
    requested.push(String(url));
    const file = path.join('public', String(url));
    try {
      return { ok: true, json: async () => JSON.parse(readFileSync(file, 'utf8')) };
    } catch {
      return { ok: false, json: async () => null };
    }
  });

  const { studyQuestionCatalog } = await import('../src/app/composition/study/study-engine-composition.js');
  const index = await studyQuestionCatalog.getIndex();
  const topic = index.temas[0];
  const metadata = await studyQuestionCatalog.getMetadataIndex();

  expect(metadata._by[topic.id]).toHaveLength(topic.n);
  expect(studyQuestionCatalog.getQuestionIdsForTopic(topic.id)).toEqual(metadata._by[topic.id]);
  expect(studyQuestionCatalog.getTopicName(topic.id)).toBe(topic.nombre);
  expect(studyQuestionCatalog.getTopicName('tema-inexistente')).toBe('tema-inexistente');
  expect(requested).not.toContain('data/supuestos.json');

  const scenarios = await studyQuestionCatalog.getScenarios();
  const firstScenario = Object.values(scenarios)[0];
  expect(firstScenario).toEqual(expect.objectContaining({ text: expect.any(String), questions: expect.any(Array) }));
  expect(requested).toContain('data/supuestos.json');
  if (firstScenario.questions[0]) {
    expect(studyQuestionCatalog.getQuestionIdsForTopic(firstScenario.questions[0].t)).toContain(firstScenario.questions[0].i);
  }
});
