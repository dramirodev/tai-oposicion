import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('expone nombres de temas desde el catálogo y conserva el fallback del identificador', async () => {
  vi.stubGlobal('fetch', async url => {
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

  expect(studyQuestionCatalog.getTopicName(topic.id)).toBe(topic.nombre);
  expect(studyQuestionCatalog.getTopicName('tema-inexistente')).toBe('tema-inexistente');
});
