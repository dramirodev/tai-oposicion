/** Local editorial quarantine for documented risks in the externally authored bank. */
export interface QuestionReviewOverride {
  id: string;
  status: 'quarantined';
  reason: string;
  source: string;
  page?: number;
}

export const questionReviewOverrides: readonly QuestionReviewOverride[] = [
];

const quarantinedIds = new Set(questionReviewOverrides.map(item => item.id));

export function isQuestionEditoriallyQuarantined(questionId: string): boolean {
  return quarantinedIds.has(questionId);
}
