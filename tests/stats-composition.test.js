import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  catalog: {
    getIndex: vi.fn(), getMetadata: vi.fn(), getMetadataSnapshot: vi.fn(), now: vi.fn(),
    getTopicName: vi.fn(), getQuestions: vi.fn(),
  },
  falladasIds: vi.fn(),
  loadStudyActivity: vi.fn(),
  loadStrategyReportForPeriod: vi.fn(),
  renderStrategyReport: vi.fn(),
}));

vi.mock('../src/app/composition/study/study-engine-composition.js', () => ({
  studyQuestionCatalog: mocks.catalog,
  falladasIds: mocks.falladasIds,
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
