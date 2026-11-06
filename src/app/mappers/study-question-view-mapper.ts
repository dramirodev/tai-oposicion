import { questionReviewOverride } from '../../core/domain/question-review-overrides.js';
import { questionNotice } from '../../shared/presentation/study-content.js';
import type { QuestionRecord } from '../../core/domain/question-record.js';
import type { FailureQuestion } from '../../shared/ui/study-services.js';

export type QuestionSourceFallbacks = Readonly<Record<string, FailureQuestion['source']>>;

/** Adapts bank fields to the stable question shape consumed by trainer views. */
export function toFailureQuestionView(
  question: QuestionRecord,
  sourceFallbacks: QuestionSourceFallbacks = {},
): FailureQuestion {
  return {
    ...(questionReviewOverride(question.i) ? { editorialNotice: questionNotice(question) } : {}),
    id: question.i,
    topicId: question.t,
    statement: question.q,
    options: question.a,
    correctIndex: question.c,
    ...(question.u !== undefined ? { citation: question.u } : {}),
    ...(question.n !== undefined ? { note: question.n } : {}),
    ...(question.y !== undefined ? { year: question.y } : {}),
    ...(question.cp !== undefined ? { context: question.cp } : {}),
    ...(question.supTexto !== undefined ? { assumptionText: question.supTexto } : {}),
    ...(question.x !== undefined ? { traps: question.x } : {}),
    ...(question.np !== undefined ? { nonScoring: question.np } : {}),
    ...((question.source || sourceFallbacks[question.i]) ? { source: question.source || sourceFallbacks[question.i] } : {}),
  };
}
