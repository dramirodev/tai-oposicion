import { expect, it } from 'vitest';
import { analyzeSimulation, simulationPace } from '../../src/core/domain/simulation-analysis.js';

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
  expect(simulationPace(10, 80, 5400, 540)).toBe(2);
});

it('devuelve ritmo cero si faltan preguntas o límite de tiempo', () => {
  expect(simulationPace(0, 0, 0, 5)).toBe(0);
});
