import { expect, it } from 'vitest';
import { calculateExamScore } from '../../src/core/domain/scoring.js';

it('calcula la nota con penalización de un tercio y no penaliza blancos', () => {
  expect(calculateExamScore(60, 9, 80)).toBe(71.3);
});

it('devuelve cero cuando no hay preguntas', () => {
  expect(calculateExamScore(0, 0, 0)).toBe(0);
});
