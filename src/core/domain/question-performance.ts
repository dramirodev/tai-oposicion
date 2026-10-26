export interface QuestionPerformance {
  id: string;
  lastOutcome: number;
  lastReasonCode?: number;
}

function isTaggedFailure(question: QuestionPerformance): boolean {
  const reason = question.lastReasonCode;
  return question.lastOutcome === 0 && reason !== undefined && ((reason >= 1 && reason <= 5) || reason === 7);
}

export function countFailureReasons(questions: readonly QuestionPerformance[]): number[] {
  const counts = Array.from({ length: 8 }, () => 0);
  for (const question of questions) {
    const reason = question.lastReasonCode;
    if (isTaggedFailure(question)) counts[reason!]++;
  }
  return counts;
}

export function countLuckyCorrectAnswers(questions: readonly QuestionPerformance[]): number {
  return questions.filter(question => question.lastOutcome === 1 && (question.lastReasonCode === 6 || question.lastReasonCode === 8)).length;
}

export function summarizeReadingSpeedFailures(questions: readonly QuestionPerformance[]) {
  const taggedFailures = questions.filter(isTaggedFailure);
  const speedFailures = taggedFailures.filter(question => question.lastReasonCode === 7);
  return {
    count: speedFailures.length,
    taggedFailureCount: taggedFailures.length,
    percent: taggedFailures.length ? Math.round(100 * speedFailures.length / taggedFailures.length) : 0,
    questionIds: speedFailures.map(question => question.id),
  };
}
