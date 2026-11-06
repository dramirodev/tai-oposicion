import { questionContentRevision } from './highlights.js';
import type { Question } from '../entities.js';
import type { QuestionRecord } from '../question-record.js';

/** Separate from text anchors: changing a key, context or source invalidates semantic attribution. */
export function questionSemanticRevision(question: Pick<Question, 'statement' | 'options' | 'correctIndex' | 'topicId' | 'origin' | 'context' | 'assumptionId' | 'citation' | 'source' | 'assumptionText'>): string {
  const source = question.source;
  return `semantic-v1-${questionContentRevision(JSON.stringify([
    question.statement, question.options, question.correctIndex, question.topicId, question.origin,
    question.context ?? null, question.assumptionId ?? null, question.assumptionText ?? null, question.citation ?? null,
    source ? [source.url, source.title ?? null, source.page ?? null, source.verified] : null,
  ]), []).slice(6)}`;
}
export function questionRecordSemanticRevision(question: QuestionRecord): string {
  return questionSemanticRevision({ statement: question.q, options: question.a, correctIndex: question.c,
    topicId: question.t, origin: question.o, context: question.cp, assumptionText: question.supTexto,
    citation: question.u, source: question.source });
}
