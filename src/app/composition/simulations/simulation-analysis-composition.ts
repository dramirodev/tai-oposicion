import { analyzeSimulation } from '../../../core/domain/simulation-analysis.js';
import { renderSimulationAnalysisView } from '../../../features/simulation/simulation-analysis-view.js';
import type { SimulationScoringPolicy } from '../../../core/domain/simulation-scoring.js';

export interface SimulationAnalysisViewInput {
  correctIndices: readonly number[];
  answers: readonly (number | undefined)[];
  answerSeconds?: readonly (number | undefined)[];
  timeLimitMinutes: number;
  elapsedSeconds: number;
  scoringPolicy?: SimulationScoringPolicy;
}

/** Joins the simulation domain analysis to the legacy result view presentation. */
export function createSimulationAnalysisView({ correctIndices, answers, answerSeconds, timeLimitMinutes, elapsedSeconds, scoringPolicy }: SimulationAnalysisViewInput): string {
  const limitSeconds = timeLimitMinutes * 60;
  const analysis = analyzeSimulation({ correct: [...correctIndices], answers: [...answers], times: answerSeconds ? [...answerSeconds] : undefined, limitSeconds, elapsedSeconds, scoringPolicy });
  return renderSimulationAnalysisView(analysis, elapsedSeconds, limitSeconds, scoringPolicy);
}
