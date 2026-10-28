import { expect, it } from 'vitest';
import {
  composeWeightedQuestions,
  estimateQuickQuestionCount,
  filterScoringQuestions,
  isQuestionAllowed,
  pickGuestQuestions,
  pickQuickQuestions,
  questionPriority,
} from '../../src/core/domain/selection.js';

it('filtra preguntas no puntuables y conserva las instancias originales', () => {
  const questions = [{ id: 'scored' }, { id: 'historical', nonScoring: 1 }];
  expect(filterScoringQuestions(questions, false, question => question.nonScoring)).toEqual([questions[0]]);
  const feedbackQuestions = filterScoringQuestions(questions, true, question => question.nonScoring);
  expect(feedbackQuestions).toEqual(questions);
  expect(feedbackQuestions[0]).toBe(questions[0]);
});

it('calcula prioridad de falladas, dudosas y nuevas con estadísticas de dominio', () => {
  expect(questionPriority('falladas', { attempts: 4, correct: 2, lastSeenAt: 10, failureStreak: 2 })).toBe(0);
  expect(questionPriority('falladas', { attempts: 4, correct: 2, lastSeenAt: 10, failureStreak: 3 })).toBe(9);
  expect(questionPriority('dudosas', { attempts: 1, correct: 1, lastSeenAt: 10, doubtful: true })).toBe(0);
  expect(questionPriority('nuevas', undefined)).toBe(0);
  expect(questionPriority('nuevas', { attempts: 1, correct: 0, lastSeenAt: 10, lastResult: 0 })).toBe(1);
  expect(questionPriority('nuevas', { attempts: 1, correct: 1, lastSeenAt: 10, lastResult: 1 })).toBe(2);
});

it('admite solo orígenes seleccionados y rechaza reservas', () => {
  expect(isQuestionAllowed('O', undefined, new Set(['O']))).toBe(true);
  expect(isQuestionAllowed('A', undefined, new Set(['O']))).toBe(false);
  expect(isQuestionAllowed('O', 1, new Set(['O']))).toBe(false);
});

it('reparte cupos por peso, limita el total a los pools y mezcla con aleatoriedad inyectada', () => {
  const pools = { A: ['a1', 'a2'], B: ['b1', 'b2', 'b3', 'b4'] };
  expect(composeWeightedQuestions([{ id: 'A', weight: 1 }, { id: 'B', weight: 3 }], pools, 4, () => 0))
    .toEqual(['b1', 'b2', 'b3', 'a1']);
  expect(composeWeightedQuestions([{ id: 'A' }], { A: ['a'] }, 8, () => 0)).toEqual(['a']);
});

it('evita familias repetidas y rellena el cupo con familias alternativas', () => {
  const topics = [{ id: 'A', weight: 1 }, { id: 'B', weight: 1 }];
  const pools = {
    A: [{ id: 'a1', family: 'shared' }, { id: 'a2', family: 'a2' }],
    B: [{ id: 'b1', family: 'shared' }, { id: 'b2', family: 'b2' }],
  };
  expect(composeWeightedQuestions(topics, pools, 3, () => 0, question => question.family).map(question => question.family).sort())
    .toEqual(['a2', 'b2', 'shared']);
});

it('estima la sesión rápida con el ritmo medido y los límites actuales', () => {
  expect(estimateQuickQuestionCount([], 5)).toBe(10);
  expect(estimateQuickQuestionCount([{ totalSeconds: 100, count: 10 }], 5)).toBe(15);
  expect(estimateQuickQuestionCount([{ totalSeconds: 1000, count: 10 }], 5)).toBe(6);
});

it('prioriza repasos y reparte nuevas por turnos sin repetir preguntas', () => {
  const due = [{ id: 'd1' }, { id: 'd2' }];
  const pools = [[{ id: 'd1' }, { id: 'a1' }, { id: 'a2' }], [{ id: 'b1' }, { id: 'b2' }]];
  const result = pickQuickQuestions(due, pools, 5, question => question.id, () => 0);
  expect(result.map(question => question.id).sort()).toEqual(['a1', 'a2', 'b1', 'd1', 'd2']);
  expect(new Set(result.map(question => question.id)).size).toBe(5);
});

it('selecciona una pregunta por tema priorizando no vistas y evitando la sesión anterior', () => {
  const pools = [
    { topicId: 'A', questions: [{ id: 'old' }, { id: 'seen' }, { id: 'fresh' }] },
    { topicId: 'B', questions: [{ id: 'other' }] },
  ];
  const result = pickGuestQuestions(pools, 2, question => question.id, id => id === 'seen', new Set(['old']), () => 0);
  expect(result.map(question => question.id)).toEqual(['other', 'fresh']);
});
