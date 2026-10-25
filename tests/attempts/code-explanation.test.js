import { describe, expect, it, vi } from 'vitest';
import { getCodeExplanation } from '../../src/core/application/explanations/get-code-explanation.js';

const explanation = {
  questionId: 'Q-1', contentRevision: 'rev-a', language: 'Java', editorialStatus: 'draft', snippet: 'int i = 0;',
  result: { kind: 'output', value: '0' }, steps: [], distractors: [], limitation: 'Fragmento', sources: [],
};

describe('getCodeExplanation', () => {
  it('returns content only when both question ID and revision match', async () => {
    const repository = { getExplanation: vi.fn(async () => explanation) };
    expect(await getCodeExplanation(repository, 'Q-1', 'rev-a')).toEqual({ status: 'current', explanation });
    expect(await getCodeExplanation(repository, 'Q-1', 'rev-b')).toEqual({ status: 'outdated' });
    expect(await getCodeExplanation(repository, 'Q-2', 'rev-a')).toEqual({ status: 'missing' });
    expect(repository.getExplanation).toHaveBeenCalledTimes(3);
  });

  it('reports no entry as missing without constructing historical content', async () => {
    const repository = { getExplanation: async () => undefined };
    expect(await getCodeExplanation(repository, 'Q-1', 'rev-a')).toEqual({ status: 'missing' });
  });
});
