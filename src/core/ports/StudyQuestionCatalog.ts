import type { QuestionRecord } from '../domain/question-record.js';
import type { StudyCatalogIndex, StudyQuestionMetadata, StudyQuestionScenario } from '../domain/study-catalog.js';

/** Reads the study bank without binding application logic to HTTP or Firebase. */
export interface StudyQuestionCatalog {
  getIndex(): Promise<StudyCatalogIndex>;
  getMetadataIndex(): Promise<StudyQuestionMetadata>;
  getMetadata(): Promise<StudyQuestionMetadata>;
  getMetadataSnapshot(): StudyQuestionMetadata | undefined;
  getQuestionIdsForTopic(topicId: string): string[];
  getScenarios(): Promise<Record<string, StudyQuestionScenario>>;
  getTopicQuestions(topicId: string): Promise<QuestionRecord[]>;
  getQuestions(questionIds: string[]): Promise<QuestionRecord[]>;
  getTopicName(topicId: string): string;
  getTopicForQuestion(questionId: string): string | null;
  now(): number;
}
