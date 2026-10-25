export interface SimulationAnalysisInput {
  correct: number[];
  answers: (number | undefined)[];
  times?: number[];
  limitSeconds: number;
  elapsedSeconds: number;
}

export interface SimulationAnalysis {
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  secondsPerQuestion: number;
  averageAnswerSeconds: number;
  slowQuestions: { index: number; seconds: number; correct: boolean }[];
  fastWrongAnswers: number;
  scoreWithoutPenalty: number;
  pointsLostToWrongAnswers: number;
  timeUsedPercent: number;
}

export function analyzeSimulation({
  correct,
  answers,
  times = [],
  limitSeconds,
  elapsedSeconds,
}: SimulationAnalysisInput): SimulationAnalysis {
  const questionCount = correct.length;
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;
  const timedAnswers: { index: number; seconds: number; correct: boolean }[] = [];
  correct.forEach((correctIndex, index) => {
    const answer = answers[index];
    if (answer === undefined || answer === -1) blankCount++;
    else if (answer === correctIndex) correctCount++;
    else wrongCount++;
    if (times[index] > 0 && answer !== undefined && answer !== -1) {
      timedAnswers.push({ index, seconds: times[index], correct: answer === correctIndex });
    }
  });
  const secondsPerQuestion = questionCount && limitSeconds ? limitSeconds / questionCount : 0;
  const averageAnswerSeconds = timedAnswers.length
    ? Math.round(timedAnswers.reduce((sum, answer) => sum + answer.seconds, 0) / timedAnswers.length)
    : 0;
  const slowQuestions = timedAnswers
    .slice()
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 3)
    .filter(answer => !secondsPerQuestion || answer.seconds > secondsPerQuestion * 1.5);
  const fastWrongAnswers = timedAnswers.filter(
    answer => !answer.correct && secondsPerQuestion && answer.seconds < secondsPerQuestion * 0.4,
  ).length;
  return {
    questionCount,
    correctCount,
    wrongCount,
    blankCount,
    secondsPerQuestion: Math.round(secondsPerQuestion),
    averageAnswerSeconds,
    slowQuestions,
    fastWrongAnswers,
    scoreWithoutPenalty: questionCount ? Math.round(1000 * correctCount / questionCount) / 10 : 0,
    pointsLostToWrongAnswers: questionCount ? Math.round(1000 * (wrongCount / 3) / questionCount) / 10 : 0,
    timeUsedPercent: limitSeconds ? Math.round(100 * Math.min(elapsedSeconds, limitSeconds) / limitSeconds) : 0,
  };
}

/** Difference from expected progress at the current exam pace. */
export function simulationPace(answered: number, questionCount: number, limitSeconds: number, elapsedSeconds: number): number {
  return limitSeconds && questionCount
    ? Math.round(answered - elapsedSeconds / (limitSeconds / questionCount))
    : 0;
}
