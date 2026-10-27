import { expect, it } from 'vitest';
import {
  markLuckyQuestion,
  markQuestionSyllabusReviewed,
  recordQuestionAnswer,
  scheduleDoubtfulQuestion,
} from '../../src/core/domain/question-progress.js';

it('registra el primer fallo y programa el primer repaso', () => {
  expect(recordQuestionAnswer(undefined, 0, 1_000)).toMatchObject({
    attempts: 1,
    correct: 0,
    lastSeenAt: 1_000,
    intervalStep: 0,
    dueAt: 1_000 + 2 * 86_400_000,
    lastResult: 0,
    failureStreak: 0,
    syllabusReviewed: false,
  });
});

it('conserva los datos al no saber la respuesta y suma tiempo solo a respuestas puntuadas', () => {
  const markedLucky = { attempts: 2, correct: 1, lastSeenAt: 500, intervalStep: 0, dueAt: 1_000, lastResult: 1, errorReason: 6, secondsStudied: 10, timedAnswers: 1 };
  const blank = recordQuestionAnswer(markedLucky, 2, 2_000, 30);
  expect(blank).toMatchObject({ attempts: 3, correct: 1, errorReason: 6, secondsStudied: 10, timedAnswers: 1, lastResult: 2, intervalStep: 0, dueAt: 1_000 });

  const correct = recordQuestionAnswer(blank, 1, 3_000, 125);
  expect(correct).toMatchObject({ attempts: 4, correct: 2, errorReason: 8, intervalStep: 0, dueAt: 3_000 + 86_400_000, secondsStudied: 130, timedAnswers: 2 });
});

it('retira del repaso una pregunta al completar el último intervalo', () => {
  const current = { attempts: 5, correct: 5, lastSeenAt: 10, intervalStep: 4, dueAt: 20, lastResult: 1 };
  expect(recordQuestionAnswer(current, 1, 30)).toMatchObject({ intervalStep: -1, dueAt: 0, lastResult: 1 });
});

it('mantiene marcas y campos opcionales al actualizar una estadística', () => {
  const result = recordQuestionAnswer({
    attempts: 4,
    correct: 2,
    lastSeenAt: 10,
    intervalStep: 1,
    dueAt: 20,
    lastResult: 0,
    doubtful: true,
    secondsStudied: 15,
    timedAnswers: 2,
    errorReason: 5,
    failureStreak: 1,
    syllabusReviewed: true,
    syllabusReviewedAt: 12,
  }, 1, 30);

  expect(result).toMatchObject({
    attempts: 5,
    correct: 3,
    intervalStep: 2,
    dueAt: 30 + 14 * 86_400_000,
    doubtful: true,
    errorReason: 0,
    failureStreak: 2,
    syllabusReviewed: true,
    syllabusReviewedAt: 12,
  });
});

it('programa dudas y aciertos por suerte sin cambiar la respuesta guardada', () => {
  const current = { attempts: 2, correct: 1, lastSeenAt: 10, intervalStep: -1, dueAt: 0, lastResult: 1, errorReason: 0 };
  expect(scheduleDoubtfulQuestion(current, 100)).toMatchObject({ lastResult: 1, intervalStep: 0, dueAt: 100 + 2 * 86_400_000 });
  expect(markLuckyQuestion(current, 100)).toMatchObject({ lastResult: 1, errorReason: 6, lastSeenAt: 100, dueAt: 100 + 86_400_000 });
  expect(markLuckyQuestion({ ...current, lastResult: 0 }, 100)).toBeUndefined();
});

it('usa un reloj separado para la marca de temario', () => {
  const current = { attempts: 3, correct: 1, lastSeenAt: 500, lastResult: 0, intervalStep: -1, syllabusReviewedAt: 900 };
  expect(markQuestionSyllabusReviewed(current, true, 800)).toMatchObject({
    lastSeenAt: 500,
    failureStreak: 0,
    syllabusReviewed: true,
    syllabusReviewedAt: 901,
  });
});
