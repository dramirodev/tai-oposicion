import { describe, expect, it } from 'vitest';
import { toFailureQuestionView } from '../src/app/study-question-view-mapper.js';

describe('toFailureQuestionView', () => {
  it('maps only the available bank fields to the view model', () => {
    const result = toFailureQuestionView({
      i: 'Q1', t: 'T1.01', o: 'O', q: 'Pregunta', a: ['Sí', 'No'], c: 1,
      u: 'BOE', n: 'Nota', y: '2024', cp: 'Contexto', supTexto: 'Supuesto', x: [2], np: 1,
    });

    expect(result).toEqual({
      id: 'Q1', topicId: 'T1.01', statement: 'Pregunta', options: ['Sí', 'No'], correctIndex: 1,
      citation: 'BOE', note: 'Nota', year: '2024', context: 'Contexto', assumptionText: 'Supuesto', traps: [2], nonScoring: 1,
    });
  });

  it('prefers a question source and falls back to the verified source list', () => {
    const fallback = { url: 'https://example.test/source', verified: true };
    const question = { i: 'Q1', t: 'T1.01', o: 'O', q: 'Pregunta', a: ['Sí'], c: 0 };
    expect(toFailureQuestionView(question, { Q1: fallback }).source).toBe(fallback);
    const explicit = { url: 'https://example.test/question', verified: false };
    expect(toFailureQuestionView({ ...question, source: explicit }, { Q1: fallback }).source).toBe(explicit);
  });
});
