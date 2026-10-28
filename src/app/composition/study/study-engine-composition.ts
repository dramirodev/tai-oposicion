import { configureStudyEngine } from '../../../core/application/study-session-engine.js';
import { createStudyQuestionSelection } from '../../../core/application/study-question-selection.js';
import type { StudyQuestionCatalog } from '../../../core/ports/StudyQuestionCatalog.js';
import { localStudyProgressGateway } from '../../../adapters/local/progress-repository.js';
import * as questionData from '../../../adapters/http/legacy-data.js';

export const studyQuestionCatalog: StudyQuestionCatalog = {
  getIndex: questionData.getIndex,
  getMetadata: questionData.getMeta,
  getMetadataSnapshot: () => questionData.META,
  getTopicQuestions: questionData.getTema,
  getQuestions: questionData.byIds,
  getTopicName: questionData.temaName,
  getTopicForQuestion: questionData.temaOf,
  now: questionData.now,
};

configureStudyEngine({ progress: localStudyProgressGateway, catalog: studyQuestionCatalog });

const studyQuestionSelection = createStudyQuestionSelection(localStudyProgressGateway, studyQuestionCatalog);
export const { dueQuestionIds, falladasIds, quickItems, repasoItems, selectQuestionsForTopics, selectWeightedSimulationQuestions, trapTest } = studyQuestionSelection;
export type { StudyQuestionSelection } from '../../../core/application/study-question-selection.js';

export * from '../../../core/application/study-session-engine.js';
