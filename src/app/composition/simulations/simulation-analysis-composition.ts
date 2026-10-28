import { analyzeSimulation } from '../../../core/domain/simulation-analysis.js';
import { renderSimulationAnalysisView } from '../../../features/simulation/simulation-analysis-view.js';

export interface SimulationAnalysisViewInput {
  correctIndices: readonly number[];
  answers: readonly (number | undefined)[];
  answerSeconds?: readonly (number | undefined)[];
  timeLimitMinutes: number;
  elapsedSeconds: number;
}

/** Joins the simulation domain analysis to the legacy result view presentation. */
export function createSimulationAnalysisView({ correctIndices, answers, answerSeconds, timeLimitMinutes, elapsedSeconds }: SimulationAnalysisViewInput): string {
  const limitSeconds = timeLimitMinutes * 60;
  const analysis = analyzeSimulation({ correct: [...correctIndices], answers: [...answers], times: answerSeconds ? [...answerSeconds] : undefined, limitSeconds, elapsedSeconds });
  return renderSimulationAnalysisView(analysis, elapsedSeconds, limitSeconds);
}
