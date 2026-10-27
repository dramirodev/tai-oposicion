import { configureStudyEngine } from '../../../core/application/study-session-engine.js';
import { createStudyQuestionSelection } from '../../../core/application/study-question-selection.js';
import type { QuestionStats, SessionResult } from '../../../core/domain/entities.js';
import type { StudyProgressGateway } from '../../../core/ports/StudyProgressGateway.js';
import type { StudyQuestionCatalog } from '../../../core/ports/StudyQuestionCatalog.js';
import * as progressStore from '../../../adapters/local/legacy-store.js';
import * as questionData from '../../../adapters/http/legacy-data.js';
import { preferencesMapper } from '../../../adapters/local/mappers/preferences.js';
import { sessionMapper } from '../../../adapters/local/mappers/session.js';
import { statsMapper } from '../../../adapters/local/mappers/stats.js';

function mapStatistics(record: unknown): QuestionStats | undefined {
  const result = statsMapper.toDomain(record);
  return result.ok ? result.value : undefined;
}

const progress: StudyProgressGateway = {
  accountId: progressStore.accountId,
  onAccountChange: progressStore.onAccountChange,
  getQuestionStats: questionId => mapStatistics(progressStore.rec(questionId)),
  getAllQuestionStats() {
    const statistics: Record<string, QuestionStats> = {};
    for (const [questionId, record] of Object.entries(progressStore.getStats())) {
      const mapped = mapStatistics(record);
      if (mapped) statistics[questionId] = mapped;
    }
    return statistics;
  },
  getPreferences() {
    const result = preferencesMapper.toDomain(progressStore.getCfg());
    return result.ok ? result.value : {};
  },
  getSeenTopics: progressStore.getSeen,
  recordAnswer: progressStore.record,
  addSession(session: SessionResult) {
    progressStore.addSession(sessionMapper.toDto(session));
  },
};

const catalog: StudyQuestionCatalog = {
  getIndex: questionData.getIndex,
  getMetadata: questionData.getMeta,
  getMetadataSnapshot: () => questionData.META,
  getTopicQuestions: questionData.getTema,
  getQuestions: questionData.byIds,
  getTopicForQuestion: questionData.temaOf,
  now: questionData.now,
};

configureStudyEngine({ progress, catalog });

const studyQuestionSelection = createStudyQuestionSelection(progress, catalog);
export const { dueQuestionIds, falladasIds, quickItems, repasoItems, selectQuestionsForTopics, selectWeightedSimulationQuestions, trapTest } = studyQuestionSelection;
export type { StudyQuestionSelection } from '../../../core/application/study-question-selection.js';

export * from '../../../core/application/study-session-engine.js';
