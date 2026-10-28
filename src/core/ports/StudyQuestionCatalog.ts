import type { QuestionRecord } from '../domain/question-record.js';
import type { StudyCatalogIndex, StudyQuestionMetadata } from '../domain/study-catalog.js';

/** Reads the study bank without binding application logic to HTTP or Firebase. */
export interface StudyQuestionCatalog {
  getIndex(): Promise<StudyCatalogIndex>;
  getMetadata(): Promise<StudyQuestionMetadata>;
  getMetadataSnapshot(): StudyQuestionMetadata | undefined;
  getTopicQuestions(topicId: string): Promise<QuestionRecord[]>;
  getQuestions(questionIds: string[]): Promise<QuestionRecord[]>;
  getTopicName(topicId: string): string;
  getTopicForQuestion(questionId: string): string | null;
  now(): number;
}
