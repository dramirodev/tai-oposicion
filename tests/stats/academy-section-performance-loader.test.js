import { describe, expect, it, vi } from 'vitest';
import { loadAcademySectionPerformance } from '../../src/core/application/stats/load-academy-section-performance.ts';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.ts';

const hash = value => value.repeat(64);
const question = { id: 'q-1', topicId: 'T3.01', origin: 'A', statement: 'Enunciado', options: ['A', 'B'], correctIndex: 0 };
const section = {
  id: 'ci-0123456789abcdefabcd', topicId: 'T1.09', title: 'Destino', materialPath: 'T1.09/temario.pdf', printedPage: 12,
  sourceOrdinal: 1, sourceHash: hash('a'), materialKind: 'syllabus', outlineFingerprint: hash('b'), outlineStructureFingerprint: hash('c'), verification: 'pending',
};
const link = {
  status: 'approved', questionId: question.id, contentRevision: questionContentRevision(question.statement, question.options),
  questionTopicId: question.topicId, testMaterialTopicId: 'T1.04', sectionTopicId: section.topicId, sectionId: section.id,
  testEvidence: { path: 'T1.04/test.pdf', sourceHash: hash('d'), page: 3 },
  sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, page: section.printedPage },
  rationale: 'El test contiene evidencia precisa del concepto.', reviewedAt: 100, reviewer: 'editor-1',
};
const manifest = { schemaVersion: 2, revision: 'published-1', links: [link] };
const attempt = (id, outcome, completedAt) => ({ id, sessionId: `session-${id}`, questionId: question.id, contentRevision: link.contentRevision,
  mode: 'practice', position: 0, exposure: 1, state: 'answered', response: outcome === 'correct' ? 0 : 1, outcome, confidence: null,
  discardedOptions: [], highlights: [], createdAt: completedAt - 10, completedAt, lastSequence: 2, appliedEventIds: [], terminalEventId: `answer-${id}` });
const topic = (id) => id === 'T1.04'
  ? { id, files: [{ path: link.testEvidence.path, kind: 'test', sha256: link.testEvidence.sourceHash }], sections: [] }
  : { id, files: [], sections: [section] };

describe('loadAcademySectionPerformance', () => {
  it('does not read personal attempt history while the shared publication is empty', async () => {
    const repository = { getScopePage: vi.fn() };
    const loadQuestions = vi.fn(), loadTopic = vi.fn();
    const result = await loadAcademySectionPerformance({
      manifest: { schemaVersion: 2, revision: 'published-empty', links: [] }, accountId: () => 'user-1', repository, loadQuestions, loadTopic,
    });
    expect(result).toEqual({ status: 'no-approved-links', rows: [] });
    expect(repository.getScopePage).not.toHaveBeenCalled();
    expect(loadQuestions).not.toHaveBeenCalled();
    expect(loadTopic).not.toHaveBeenCalled();
  });

  it('validates current catalogs and exhausts paginated, account-scoped attempts only on request', async () => {
    const repository = { getScopePage: vi.fn()
      .mockResolvedValueOnce({ attempts: [attempt('first', 'correct', 200)], nextCursor: 'next' })
      .mockResolvedValueOnce({ attempts: [attempt('latest', 'wrong', 400)], nextCursor: null }) };
    const result = await loadAcademySectionPerformance({
      manifest, accountId: () => 'user-1', repository,
      loadQuestions: vi.fn().mockResolvedValue([question]),
      loadTopic: vi.fn(async id => topic(id)),
    });
    expect(repository.getScopePage).toHaveBeenNthCalledWith(1, 'user-1', undefined, 100);
    expect(repository.getScopePage).toHaveBeenNthCalledWith(2, 'user-1', 'next', 100);
    expect(result).toMatchObject({ status: 'ready', rows: [{
      manifestRevision: 'published-1', linkedQuestions: 1,
      practice: { observedQuestions: 1, latestCorrect: 0, latestWrong: 1, answeredAttempts: 2 },
    }] });
  });

  it('aborts rather than mixing attempts if the active account changes during loading', async () => {
    let account = 'user-1';
    const repository = { getScopePage: vi.fn(async () => { account = 'user-2'; return { attempts: [], nextCursor: null }; }) };
    await expect(loadAcademySectionPerformance({
      manifest, accountId: () => account, repository,
      loadQuestions: vi.fn().mockResolvedValue([question]), loadTopic: vi.fn(async id => topic(id)),
    })).rejects.toThrow('La cuenta cambió mientras se cargaba el historial objetivo.');
  });

  it('returns a retryable error if a linked question cannot be loaded to validate its revision', async () => {
    const repository = { getScopePage: vi.fn() };
    await expect(loadAcademySectionPerformance({
      manifest, accountId: () => 'user-1', repository,
      loadQuestions: vi.fn().mockResolvedValue([]), loadTopic: vi.fn(async id => topic(id)),
    })).rejects.toThrow('No se pudo cargar el catálogo actual');
    expect(repository.getScopePage).not.toHaveBeenCalled();
  });
});
