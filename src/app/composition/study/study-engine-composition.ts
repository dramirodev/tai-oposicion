import { configureStudyEngine } from '../../../core/application/study-session-engine.js';
import { createStudyQuestionSelection } from '../../../core/application/study-question-selection.js';
import type { StudyQuestionCatalog } from '../../../core/ports/StudyQuestionCatalog.js';
import { localStudyProgressGateway } from '../../../adapters/local/progress-repository.js';
import * as questionData from '../../../adapters/http/legacy-data.js';

export const studyQuestionCatalog: StudyQuestionCatalog = {
  getIndex: questionData.getIndex,
  getMetadataIndex: questionData.getMetaIndex,
  getMetadata: questionData.getMeta,
  getMetadataSnapshot: () => questionData.META,
  getQuestionIdsForTopic: questionData.idsOfTema,
  getScenarios: async () => Object.fromEntries(Object.entries(await questionData.getSup()).map(([id, scenario]) => [id, {
    text: scenario.texto,
    questions: scenario.q,
    ...(scenario.conv ? { convocation: scenario.conv } : {}),
  }])),
  getTopicQuestions: questionData.getTema,
  getQuestions: ids => questionData.byIds(ids),
  getTopicName: questionData.temaName,
  getTopicForQuestion: questionData.temaOf,
  now: questionData.now,
};

configureStudyEngine({ progress: localStudyProgressGateway, catalog: studyQuestionCatalog });

const studyQuestionSelection = createStudyQuestionSelection(localStudyProgressGateway, studyQuestionCatalog);
export const { dueQuestionIds, falladasIds, quickItems, repasoItems, selectQuestionsForTopics, selectWeightedSimulationQuestions, trapTest } = studyQuestionSelection;
export type { StudyQuestionSelection } from '../../../core/application/study-question-selection.js';

export * from '../../../core/application/study-session-engine.js';
