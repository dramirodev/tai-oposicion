import { beforeEach, it, expect, vi } from 'vitest';
import { clearQuestionDiagnostics, diagnoseQuestionDtos, mapQuestionDtos } from '../../src/adapters/http/question-diagnostics.js';

beforeEach(() => clearQuestionDiagnostics());

it('mapea una sola vez los DTO válidos y conserva el diagnóstico compartido', () => {
  const warn = vi.fn();
  const rows = [
    { i: 'q1', t: 'T1.01', o: 'O', q: 'Pregunta', a: ['Sí'], c: 0, futureField: true },
    { i: 'broken', t: 'T1.01', o: 'O', q: 'Pregunta inválida', a: [], c: 'bad' },
  ];

  const questions = mapQuestionDtos(rows, true, warn);

  expect(questions).toMatchObject([{ id: 'q1', topicId: 'T1.01', statement: 'Pregunta' }]);
  expect(warn).toHaveBeenCalledTimes(2);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('futureField'));
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken'));
});

it('mapea DTO válidos también en producción sin emitir diagnósticos', () => {
  const warn = vi.fn();
  const rows = [{ i: 'q1', t: 'T1.01', o: 'O', q: 'Pregunta', a: ['Sí'], c: 0 }];

  expect(mapQuestionDtos(rows, false, warn)).toMatchObject([{ id: 'q1', statement: 'Pregunta' }]);
  expect(warn).not.toHaveBeenCalled();
});

it('informa una sola vez cada campo desconocido mientras conserva el registro inválido identificado', () => {
  const warn = vi.fn();
  const rows = [
    { i: 'q1', t: 'T1.01', o: 'O', q: 'Q', a: ['A'], c: 0, futureField: true },
    { i: 'q2', t: 'T1.01', o: 'O', q: 'Q', a: ['A'], c: 0, futureField: false },
    { i: 'broken', t: 'T1.01', o: 'O', q: 'Q', a: [], c: 'bad' },
  ];
  diagnoseQuestionDtos(rows, true, warn);
  diagnoseQuestionDtos(rows, true, warn);

  expect(warn).toHaveBeenCalledTimes(2);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('futureField'));
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken'));
});

it('no emite diagnósticos en producción', () => {
  const warn = vi.fn();
  diagnoseQuestionDtos([{ i: 'q1', futureField: true }], false, warn);
  expect(warn).not.toHaveBeenCalled();
});
