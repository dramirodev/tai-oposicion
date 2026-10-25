/** Exam scoring: each wrong answer deducts one third; blanks do not affect the score. */
export function calculateExamScore(correctAnswers: number, wrongAnswers: number, questionCount: number): number {
  return questionCount ? Math.round(1000 * (correctAnswers - wrongAnswers / 3) / questionCount) / 10 : 0;
}
