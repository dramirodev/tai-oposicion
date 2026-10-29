import { configureStudyEngine } from '../../../core/application/study-session-engine.js';
import { createStudyQuestionSelection } from '../../../core/application/study-question-selection.js';
import { localStudyProgressGateway } from '../../../adapters/local/progress-repository.js';
import { httpStudyQuestionCatalog } from '../../../adapters/http/study-question-catalog.js';

export const studyQuestionCatalog = httpStudyQuestionCatalog;

configureStudyEngine({ progress: localStudyProgressGateway, catalog: studyQuestionCatalog });

const studyQuestionSelection = createStudyQuestionSelection(localStudyProgressGateway, studyQuestionCatalog);
export const { dueQuestionIds, falladasIds, quickItems, repasoItems, selectQuestionsForTopics, selectWeightedSimulationQuestions, trapTest } = studyQuestionSelection;
export type { StudyQuestionSelection } from '../../../core/application/study-question-selection.js';

export * from '../../../core/application/study-session-engine.js';
