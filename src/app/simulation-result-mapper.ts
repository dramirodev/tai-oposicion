import { analyzeSimulation } from '../core/domain/simulation-analysis.js';

/** Maps domain simulation metrics to the established labels rendered by legacy result screens. */
export function mapSimulationResultToLegacy(input: { correct: number[]; ans: (number | undefined)[]; times?: number[]; limitSecs: number; secs: number }) {
  const result = analyzeSimulation({
    correct: input.correct,
    answers: input.ans,
    times: input.times,
    limitSeconds: input.limitSecs,
    elapsedSeconds: input.secs,
  });
  return {
    n: result.questionCount,
    a: result.correctCount,
    f: result.wrongCount,
    b: result.blankCount,
    presupuesto: result.secondsPerQuestion,
    media: result.averageAnswerSeconds,
    lentas: result.slowQuestions.map(answer => ({ k: answer.index, t: answer.seconds, ok: answer.correct })),
    rapidasFalladas: result.fastWrongAnswers,
    sinPenal: result.scoreWithoutPenalty,
    perdidoFallos: result.pointsLostToWrongAnswers,
    uso: result.timeUsedPercent,
  };
}
