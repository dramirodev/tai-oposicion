import { expect, it } from 'vitest';
import { analyzeSimulation, recommendSimulationStudy, simulationPace } from '../../src/core/domain/simulation-analysis.js';

it('analiza aciertos, fallos, blancos y ritmo con los segundos del examen', () => {
  const result = analyzeSimulation({
    correct: [0, 1, 2, 3],
    answers: [0, 2, -1, 3],
    times: [10, 5, 0, 200],
    limitSeconds: 400,
    elapsedSeconds: 300,
  });
  expect(result).toMatchObject({
    questionCount: 4,
    correctCount: 2,
    wrongCount: 1,
    blankCount: 1,
    secondsPerQuestion: 100,
    averageAnswerSeconds: 72,
    fastWrongAnswers: 1,
    timeUsedPercent: 75,
  });
  expect(recommendSimulationStudy(result)).toEqual([
    { kind: 'slow-questions', questions: [{ index: 3, seconds: 200, correct: true }], thresholdSeconds: 150 },
    { kind: 'wrong-answers', count: 1 },
    { kind: 'many-blank-answers', count: 1 },
  ]);
  expect(simulationPace(10, 80, 5400, 540)).toBe(2);
});

it('recomienda revisar errores rápidos y demasiadas respuestas en blanco', () => {
  const result = analyzeSimulation({
    correct: [0, 0, 0, 0, 0], answers: [1, 1, -1, -1, 0], times: [1, 1, 0, 0, 4],
    limitSeconds: 50, elapsedSeconds: 10,
  });
  expect(recommendSimulationStudy(result)).toEqual([
    { kind: 'fast-wrong-answers', count: 2 },
    { kind: 'wrong-answers', count: 2 },
    { kind: 'many-blank-answers', count: 2 },
  ]);
});

it('devuelve ritmo cero si faltan preguntas o límite de tiempo', () => {
  expect(simulationPace(0, 0, 0, 5)).toBe(0);
});

it('deja sin puntuar y no recomienda estrategias de respuesta si la penalización es desconocida', async () => {
  const { DEFAULT_SIMULATION_SCORING_POLICY, calculateRubricScore, isTrainingMilestoneSimulation } = await import('../../src/core/domain/simulation-scoring.ts');
  const unknownPolicy = { ...DEFAULT_SIMULATION_SCORING_POLICY, wrongPenalty: null };
  const result = analyzeSimulation({
    correct: [0, 1, 2, 3], answers: [0, 2, -1, -1], limitSeconds: 400, elapsedSeconds: 300, scoringPolicy: unknownPolicy,
  });
  expect(calculateRubricScore({ correct: 1, wrong: 1, blank: 2, questionCount: 4, policy: unknownPolicy })).toBeNull();
  expect(result.pointsLostToWrongAnswers).toBeNull();
  expect(recommendSimulationStudy(result)).toContainEqual({ kind: 'many-blank-answers', count: 2 });
  expect(isTrainingMilestoneSimulation({ version: 1, questionCount: 100, durationMinutes: 90, optionsPerQuestion: 4, scoring: unknownPolicy })).toBe(true);
  expect(isTrainingMilestoneSimulation({ version: 1, questionCount: 100, durationMinutes: 90, optionsPerQuestion: 4, scoring: { ...unknownPolicy, wrongPenalty: -1 } })).toBe(false);
});
