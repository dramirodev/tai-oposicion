import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  catalog: {
    getIndex: vi.fn(), getMetadata: vi.fn(), getMetadataSnapshot: vi.fn(), now: vi.fn(),
    getTopicName: vi.fn(), getQuestions: vi.fn(),
  },
  falladasIds: vi.fn(),
  hasActiveRun: vi.fn(),
  loadStudyActivity: vi.fn(),
  loadStrategyReportForPeriod: vi.fn(),
  renderStrategyReport: vi.fn(),
}));

vi.mock('../src/app/composition/study/study-engine-composition.js', () => ({
  studyQuestionCatalog: mocks.catalog,
  falladasIds: mocks.falladasIds,
  hasActiveRun: mocks.hasActiveRun,
}));
vi.mock('../src/app/composition/topics/topic-mastery-composition.js', () => ({
  createTopicMasteryComposition: () => async () => [],
}));
vi.mock('../src/app/composition/stats/strategy-composition.js', () => ({
  loadStudyActivity: mocks.loadStudyActivity,
  loadStrategyReportForPeriod: mocks.loadStrategyReportForPeriod,
}));
vi.mock('../src/features/stats/strategy-view.js', () => ({ renderStrategyReport: mocks.renderStrategyReport }));

import { createStatsServices } from '../src/app/composition/stats/stats-composition.js';
import { publishedAcademyQuestionSectionManifest } from '../src/core/domain/academy-question-section-map.published.js';

describe('stats composition boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.catalog.getIndex.mockResolvedValue({ temas: [] });
    mocks.catalog.getMetadata.mockResolvedValue({});
    mocks.catalog.getMetadataSnapshot.mockReturnValue({ _by: {} });
    mocks.catalog.now.mockReturnValue(1_800_000_000_000);
    mocks.falladasIds.mockReturnValue([]);
    mocks.hasActiveRun.mockReturnValue(false);
  });

  it('builds statistics and comparisons from domain sessions in the injected repository', async () => {
    const session = {
      id: 'sim-1', completedAt: 1_800_000_000_000, kind: 'sim', questionCount: 2, correctCount: 2,
      wrongCount: 0, blankCount: 0, durationSeconds: 120, score: 100,
      topicResults: { 'T1.01': [2, 2] }, typeResults: {}, failedQuestionIds: [], title: 'Simulacro',
    };
    const progress = {
      getStats: vi.fn().mockResolvedValue({}),
      getSessions: vi.fn().mockResolvedValue([session]),
      getCardReviews: vi.fn().mockResolvedValue({}),
    };
    const preferences = { dmord: 'frios', evo: { m: 'tiempo', w: 8 }, customPreference: 'preservar' };
    const studyProgress = {
      accountId: () => 'user-1',
      getPreferences: () => preferences,
      updatePreferences: update => Object.assign(preferences, update(preferences)),
    };
    const services = createStatsServices({ go: vi.fn(), startRun: vi.fn(), startRepaso: vi.fn(), trapTest: vi.fn() }, progress, studyProgress);

    const snapshot = await services.load();

    expect(progress.getSessions).toHaveBeenCalledOnce();
    expect(snapshot.sessions).toEqual([expect.objectContaining({ id: 'sim-1', ts: session.completedAt, kind: 'sim', n: 2, a: 2, f: 0, b: 0, nota: 100, secs: 120 })]);
    expect(services.compareSimulations('sim-1', 'sim-1')).toMatchObject({ scoreDelta: 0, accuracyDelta: 0 });
    expect(await services.loadWeekly({ weeks: 1 })).toEqual([expect.objectContaining({ n: 2, ok: 2, sessions: 1 })]);
    expect(services.getPreference('domainOrder')).toEqual({ order: 'frios' });
  });

  it('updates one view preference while preserving the rest of the user configuration', () => {
    const preferences = { dmord: 'tema', evo: { m: 'acierto', f: 'g', w: 12 }, training: { introductionDay: 4 } };
    const studyProgress = {
      accountId: () => 'user-1',
      getPreferences: () => preferences,
      updatePreferences: update => Object.assign(preferences, update(preferences)),
    };
    const services = createStatsServices({ go: vi.fn(), startRun: vi.fn(), startRepaso: vi.fn(), trapTest: vi.fn() }, {}, studyProgress);

    services.savePreference('domainOrder', { order: 'frios' });
    services.savePreference('evolution', { mode: 'tiempo', filter: 'g', weeks: 8, table: true });

    expect(preferences).toEqual({ dmord: 'frios', evo: { m: 'tiempo', f: 'g', w: 8, tabla: true }, training: { introductionDay: 4 } });
  });

  it('keeps section statistics explicitly empty until the shared editorial manifest has approved links', async () => {
    const getScopePage = vi.fn();
    const services = createStatsServices(
      { go: vi.fn(), startRun: vi.fn(), startRepaso: vi.fn(), trapTest: vi.fn() },
      {},
      { accountId: () => 'user-1', getPreferences: () => ({}), updatePreferences: () => {} },
      { repository: { getScopePage }, manifest: publishedAcademyQuestionSectionManifest },
    );

    expect(services.getApprovedSectionLinkCount()).toBe(0);
    await expect(services.loadAcademySectionPerformance()).resolves.toEqual({ status: 'no-approved-links', rows: [] });
    expect(getScopePage).not.toHaveBeenCalled();
  });
});

it('does not replace an active session with a section-error practice', async () => {
  mocks.hasActiveRun.mockReturnValue(true);
  const startRun = vi.fn(), getScopePage = vi.fn();
  const services = createStatsServices({ startRun }, {}, { accountId: () => 'A' }, { repository: { getScopePage } });
  expect(await services.practiceSectionErrors('ci-synthetic', { fromInclusive: 1, toExclusive: 2, timeZone: 'Europe/Madrid' })).toBe('active-session');
  expect(startRun).not.toHaveBeenCalled(); expect(getScopePage).not.toHaveBeenCalled();
});

import { questionRecordSemanticRevision } from '../src/core/domain/attempts/question-semantic-revision.js';
import { questionContentRevision } from '../src/core/domain/attempts/highlights.js';
it('checks 60 percent approved linking independently from 20 percent bank practice without reading attempts', async () => {
  const questions = Array.from({ length: 10 }, (_, index) => ({ i: `q${index}`, t: 'T1.01', o: 'G', q: `Pregunta ${index}`, a: ['a', 'b'], c: 0 }));
  const section = { id: 'ci-0123456789abcdefabcd', topicId: 'T1.01', title: 'Apartado sintético', materialPath: 'fixture/temario.pdf', printedPage: 2,
    sourceOrdinal: 1, sourceHash: 'a'.repeat(64), materialKind: 'syllabus', outlineFingerprint: 'b'.repeat(64), outlineStructureFingerprint: 'c'.repeat(64), verification: 'pending' };
  const manifest = { schemaVersion: 3, revision: 'synthetic-six-reviewed', links: questions.slice(0, 6).map(question => ({ status: 'approved', questionId: question.i,
    contentRevision: questionContentRevision(question.q, question.a), semanticRevision: questionRecordSemanticRevision(question), questionTopicId: question.t,
    sectionTopicId: section.topicId, sectionId: section.id, sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, page: section.printedPage },
    evidence: { kind: 'curriculum-only' }, rationale: 'Relación revisada solo en fixture sintético', reviewedAt: 100, reviewer: 'human-fixture' })) };
  mocks.catalog.getIndex.mockResolvedValue({ temas: [{ id: 'T1.01' }] });
  mocks.catalog.getTopicQuestions = vi.fn().mockResolvedValue(questions);
  const getScopePage = vi.fn();
  const startRun = vi.fn().mockReturnValue(true);
  mocks.hasActiveRun.mockReturnValue(false);
  mocks.catalog.getQuestions.mockImplementation(async ids => questions.filter(question => ids.includes(question.i)));
  const services = createStatsServices({ startRun }, {}, { accountId: () => 'A' }, { manifest, repository: { getScopePage }, loadQuestions: async ids => questions.filter(question => ids.includes(question.i)).map(question => ({ id: question.i, topicId: question.t, origin: question.o, statement: question.q, options: question.a, correctIndex: question.c })), loadTopic: async () => ({ id: 'T1.01', files: [], sections: [section] }) });
  const query = { fromInclusive: 1, toExclusive: 1000, timeZone: 'Europe/Madrid' };
  expect(await services.loadCatalogueCoverage(query, ['q0', 'q1'])).toMatchObject({ eligible: 10, practiced: 2, percent: 20, approvedLinks: 6, approvedPercent: 60, staleLinks: 0 });
  expect(getScopePage).not.toHaveBeenCalled();
  getScopePage.mockResolvedValue({ attempts: questions.slice(0, 2).map((question, index) => ({ id: `a${index}`, sessionId: 's', questionId: question.i,
    contentRevision: questionContentRevision(question.q, question.a), semanticRevision: questionRecordSemanticRevision(question), mode: 'practice', state: 'answered', outcome: index === 0 ? 'wrong' : 'correct', completedAt: 500, createdAt: 100, confidence: null })), nextCursor: null });
  expect(await services.practiceSectionErrors(section.id, query)).toBe('started');
  expect(startRun).toHaveBeenCalledWith(expect.objectContaining({ items: [questions[0]] }));
  questions[0].c = 1;
  expect(await services.loadCatalogueCoverage(query, ['q0', 'q1'])).toMatchObject({ approvedLinks: 5, staleLinks: 1 });
  expect(await services.practiceSectionErrors(section.id, query)).toBe('empty');
  expect(startRun).toHaveBeenCalledOnce();
});
