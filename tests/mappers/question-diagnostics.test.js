import { it, expect, vi } from 'vitest';
import { diagnoseQuestionDtos } from '../../src/adapters/http/question-diagnostics.js';

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
