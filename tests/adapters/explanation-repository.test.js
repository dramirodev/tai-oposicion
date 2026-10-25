import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { clearExplanationRepositoryCache, httpExplanationRepository } from '../../src/adapters/http/explanation-repository.js';
import { explanationMapper } from '../../src/adapters/http/mappers/explanation.js';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.js';

const dto = {
  i: 'Q-1', rev: 'rev-1', lang: 'Java', status: 'draft', snippet: 'int i = 0;',
  result: { kind: 'output', value: '(sin salida)' }, steps: [{ title: 'Inicio', detail: 'i vale cero.' }],
  distractors: [], limitation: 'Fragmento.', sources: [{ title: 'JLS', url: 'https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html' }],
};

describe('httpExplanationRepository', () => {
  afterEach(() => { clearExplanationRepositoryCache(); vi.unstubAllGlobals(); });

  it('loads and maps the static index once, then returns a domain entity by question ID', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => [dto] }));
    vi.stubGlobal('fetch', fetch);
    const first = await httpExplanationRepository.getExplanation('Q-1');
    const second = await httpExplanationRepository.getExplanation('Q-1');
    expect(first).toMatchObject({ questionId: 'Q-1', contentRevision: 'rev-1', steps: [{ explanation: 'i vale cero.' }] });
    expect(second).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps every pilot explanation tied to the exact bank revision and in draft status', () => {
    const explanations = JSON.parse(readFileSync('public/explanations/index.json', 'utf8'));
    const questions = JSON.parse(readFileSync('public/data/T3.03.json', 'utf8'));
    expect(explanations.length).toBeGreaterThan(0);
    for (const dto of explanations) {
      const question = questions.find(item => item.i === dto.i);
      expect(question, `${dto.i} exists in the bank`).toBeTruthy();
      expect(dto.rev).toBe(questionContentRevision(question.q, question.a));
      expect(dto.status).toBe('draft');
      expect(explanationMapper.toDomain(dto).ok).toBe(true);
    }
    expect(explanations.map(item => item.i)).not.toContain('AT303-P1-09');
  });
});
