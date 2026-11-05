import type { QuestionRecord } from './question-record.js';

/** Local editorial quarantine for documented risks in the externally authored bank. */
export interface QuestionReviewOverride {
  id: string;
  status: 'quarantined';
  reason: string;
  source: string;
  page?: number;
}

export const questionReviewOverrides: readonly QuestionReviewOverride[] = [
  { id: 'AS09-P1-48', status: 'quarantined', reason: 'El enunciado necesita el diagrama de clases UML.', source: 'Simulacro 09.pdf', page: 9 },
  { id: 'AS10B-P1-63', status: 'quarantined', reason: 'El enunciado pide identificar el diagrama que aparece en la figura.', source: 'Simulacro 10 (bis).pdf', page: 11 },
  { id: 'AS09-P1-52', status: 'quarantined', reason: 'El resultado depende del fragmento de código Java que aparece en la imagen.', source: 'Simulacro 09.pdf', page: 10 },
  { id: 'AS08B-P1-37', status: 'quarantined', reason: 'El recorrido en postorden depende del árbol mostrado en el original.', source: 'Simulacro 08 (bis).pdf', page: 8 },
  { id: 'AS10B-P1-40', status: 'quarantined', reason: 'El recorrido en anchura depende del grafo mostrado en el original.', source: 'Simulacro 10 (bis).pdf', page: 8 },
];

const reviews = new Map(questionReviewOverrides.map(item => [item.id, item]));
export const questionReviewOverride = (id: string) => reviews.get(id);

export function isQuestionEditoriallyQuarantined(questionId: string): boolean {
  return reviews.has(questionId);
}

/** Applies the local evidence to static, remote and restored questions without editing the source bank. */
export function applyEditorialScoring(question: QuestionRecord): QuestionRecord {
  return question.np !== 1 && reviews.has(question.i) ? { ...question, np: 1 } : question;
}
