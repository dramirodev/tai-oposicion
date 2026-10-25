import { describe, expect, it, vi } from 'vitest';
import { prepareAiStudyExport } from '../../src/core/application/attempts/prepare-ai-study-export.ts';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.ts';

const sessions = [
  { id: 's1', mode: 'practice', status: 'completed', startedAt: 100, endedAt: 200, lastSequence: 1 },
  { id: 's2', mode: 'simulation', status: 'completed', startedAt: 150, endedAt: 250, lastSequence: 1 },
  { id: 's3', mode: 'practice', status: 'interrupted', startedAt: 160, endedAt: 260, lastSequence: 1 },
];
const attempts = sessions.map((session, index) => ({
  id: `a${index + 1}`, sessionId: session.id, questionId: `Q${index + 1}`, contentRevision: questionContentRevision(`Q${index + 1}`, ['ok']), mode: session.mode,
  position: 0, exposure: 1, state: 'answered', response: 0, outcome: 'correct', confidence: null, discardedOptions: [],
  highlights: [], createdAt: session.startedAt, completedAt: session.endedAt, lastSequence: 1, appliedEventIds: [],
}));
const archiveRepository = {
  getScopePage: vi.fn(async () => ({ attempts, nextCursor: null })),
  getSession: vi.fn(async (_scope, id) => sessions.find(session => session.id === id)),
  getEvents: vi.fn(async () => ({ events: [], nextCursor: null })),
};

it('prepara solo sesiones completadas seleccionadas dentro del periodo y modalidad y busca sus contenidos', async () => {
  const bank = { getQuestion: vi.fn(async id => ({ id, topicId: 'T1.01', origin: 'O', statement: id, options: ['ok'], correctIndex: 0 })) };
  const explanations = { getExplanation: vi.fn(async id => ({ questionId: id, contentRevision: 'x', editorialStatus: 'draft', language: 'Java', snippet: '', result: { kind: 'logic' }, steps: [], distractors: [], limitation: '', sources: [] })) };
  const prepared = await prepareAiStudyExport({
    repository: archiveRepository, bank, explanations, scope: 'account-private', generatedAt: 300,
    filters: { from: 0, to: 300, modes: ['practice'], sessionIds: ['s1', 's2', 's3'] }, maxPartBytes: 100_000,
    reward: 1, penalty: 1 / 3, blankValue: 0,
  });
  expect(prepared.filters.sessionCount).toBe(1);
  expect(prepared.report.overall).toMatchObject({ attempts: 1, correct: 1 });
  expect(bank.getQuestion).toHaveBeenCalledTimes(1);
  expect(bank.getQuestion).toHaveBeenCalledWith('Q1');
  expect(explanations.getExplanation).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(prepared)).not.toContain('account-private');
});
