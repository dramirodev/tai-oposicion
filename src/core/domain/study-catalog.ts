import type { Origin } from './entities.js';

/** Catalog metadata used to select and describe questions from the study bank. */
export type StudyQuestionMetaEntry = [string, Origin, string, (number | string)[], number];
export type StudyQuestionMetadata = Record<string, StudyQuestionMetaEntry> & { _by: Record<string, string[]> };

export interface StudyCatalogTopic { id: string; nombre: string; n: number; w?: number }
export interface StudyCatalogIndex { n: number; nsup: number; temas: StudyCatalogTopic[] }
