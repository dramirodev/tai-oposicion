/** Versioned rubric for a simulation. `wrongPenalty: null` means unknown, not zero. */
export interface SimulationScoringPolicy {
  version: 1;
  correctPoints: number;
  wrongPenalty: number | null;
  blankPoints: number;
}

export interface TrainingMilestoneSimulation {
  version: 1;
  questionCount: number;
  durationMinutes: number;
  optionsPerQuestion: number;
  scoring: SimulationScoringPolicy;
}

export const DEFAULT_SIMULATION_SCORING_POLICY: SimulationScoringPolicy = {
  version: 1,
  correctPoints: 1,
  wrongPenalty: 1 / 3,
  blankPoints: 0,
};

export function isSimulationScoringPolicy(value: unknown): value is SimulationScoringPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const policy = value as Partial<SimulationScoringPolicy>;
  return policy.version === 1
    && typeof policy.correctPoints === 'number' && Number.isFinite(policy.correctPoints) && policy.correctPoints > 0 && policy.correctPoints <= 100
    && (policy.wrongPenalty === null || (typeof policy.wrongPenalty === 'number' && Number.isFinite(policy.wrongPenalty) && policy.wrongPenalty >= 0 && policy.wrongPenalty <= 100))
    && typeof policy.blankPoints === 'number' && Number.isFinite(policy.blankPoints) && policy.blankPoints >= 0 && policy.blankPoints <= policy.correctPoints;
}

export function isTrainingMilestoneSimulation(value: unknown): value is TrainingMilestoneSimulation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const simulation = value as Partial<TrainingMilestoneSimulation>;
  return simulation.version === 1
    && Number.isInteger(simulation.questionCount) && simulation.questionCount! >= 1 && simulation.questionCount! <= 300
    && Number.isInteger(simulation.durationMinutes) && simulation.durationMinutes! >= 1 && simulation.durationMinutes! <= 240
    && Number.isInteger(simulation.optionsPerQuestion) && simulation.optionsPerQuestion! >= 2 && simulation.optionsPerQuestion! <= 8
    && isSimulationScoringPolicy(simulation.scoring);
}

/** Returns null while any score-affecting parameter is unknown. */
export function calculateRubricScore(input: {
  correct: number;
  wrong: number;
  blank: number;
  questionCount: number;
  policy: SimulationScoringPolicy;
}): number | null {
  const { correct, wrong, blank, questionCount, policy } = input;
  if (!questionCount || policy.wrongPenalty === null) return null;
  const maximum = questionCount * policy.correctPoints;
  const points = correct * policy.correctPoints - wrong * policy.wrongPenalty + blank * policy.blankPoints;
  return Math.round(1000 * points / maximum) / 10;
}
