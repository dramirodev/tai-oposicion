import { DEFAULT_SIMULATION_SCORING_POLICY, type SimulationScoringPolicy } from './simulation-scoring.js';

export interface SimulationAnalysisInput {
  correct: number[];
  answers: (number | undefined)[];
  times?: (number | undefined)[];
  limitSeconds: number;
  elapsedSeconds: number;
  scoringPolicy?: SimulationScoringPolicy;
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
  pointsLostToWrongAnswers: number | null;
  timeUsedPercent: number;
}

export type SimulationRecommendation =
  | { kind: 'slow-questions'; questions: SimulationAnalysis['slowQuestions']; thresholdSeconds: number }
  | { kind: 'fast-wrong-answers'; count: number }
  | { kind: 'wrong-answers'; count: number }
  | { kind: 'many-blank-answers'; count: number };

export function analyzeSimulation({
  correct,
  answers,
  times = [],
  limitSeconds,
  elapsedSeconds,
  scoringPolicy = DEFAULT_SIMULATION_SCORING_POLICY,
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
    const answerSeconds = times[index];
    if (answerSeconds !== undefined && answerSeconds > 0 && answer !== undefined && answer !== -1) {
      timedAnswers.push({ index, seconds: answerSeconds, correct: answer === correctIndex });
    }
  });
  const secondsPerQuestion = questionCount && limitSeconds ? limitSeconds / questionCount : 0;
  const averageAnswerSeconds = timedAnswers.length
    ? Math.round(timedAnswers.reduce((sum, answer) => sum + answer.seconds, 0) / timedAnswers.length)
    : 0;
  const slowQuestions = timedAnswers
    .slice()
    .sort((leftItem, rightItem) => rightItem.seconds - leftItem.seconds)
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
    scoreWithoutPenalty: questionCount ? Math.round(1000 * (correctCount * scoringPolicy.correctPoints + blankCount * scoringPolicy.blankPoints) / (questionCount * scoringPolicy.correctPoints)) / 10 : 0,
    pointsLostToWrongAnswers: scoringPolicy.wrongPenalty === null ? null
      : questionCount ? Math.round(1000 * (wrongCount * scoringPolicy.wrongPenalty) / (questionCount * scoringPolicy.correctPoints)) / 10 : 0,
    timeUsedPercent: limitSeconds ? Math.round(100 * Math.min(elapsedSeconds, limitSeconds) / limitSeconds) : 0,
  };
}

/** Chooses study recommendations from simulation results, without formatting UI copy. */
export function recommendSimulationStudy(analysis: SimulationAnalysis): SimulationRecommendation[] {
  const recommendations: SimulationRecommendation[] = [];
  if (analysis.slowQuestions.length) {
    recommendations.push({
      kind: 'slow-questions',
      questions: analysis.slowQuestions,
      thresholdSeconds: Math.round(analysis.secondsPerQuestion * 1.5),
    });
  }
  if (analysis.fastWrongAnswers >= 2) recommendations.push({ kind: 'fast-wrong-answers', count: analysis.fastWrongAnswers });
  if (analysis.wrongCount > 0) recommendations.push({ kind: 'wrong-answers', count: analysis.wrongCount });
  if (analysis.blankCount > analysis.questionCount * 0.15) recommendations.push({ kind: 'many-blank-answers', count: analysis.blankCount });
  return recommendations;
}

/** Difference from expected progress at the current exam pace. */
export function simulationPace(answered: number, questionCount: number, limitSeconds: number, elapsedSeconds: number): number {
  return limitSeconds && questionCount
    ? Math.round(answered - elapsedSeconds / (limitSeconds / questionCount))
    : 0;
}
