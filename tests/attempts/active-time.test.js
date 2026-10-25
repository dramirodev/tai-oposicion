import { describe, expect, it } from 'vitest';
import { computeActiveTime } from '../../src/core/domain/attempts/active-time.js';

const event = (id, sequence, type, at, monotonicAt = at) => ({
  id, attemptId: 'attempt-1', sequence, type, at, monotonicAt, payload: {},
});

describe('tiempo activo por intento', () => {
  it('suma únicamente intervalos visibles y completos, excluyendo pausas', () => {
    const events = [
      event('1', 1, 'open', 10),
      event('2', 2, 'pause', 110),
      event('3', 3, 'resume', 1_000),
      event('4', 4, 'leave', 1_050),
    ];
    expect(computeActiveTime(events)).toEqual({ milliseconds: 150, quality: 'complete' });
  });

  it('marca parcial un intervalo abierto al cerrar sin inventar su duración', () => {
    const events = [event('1', 1, 'open', 10), event('2', 2, 'leave', 110), event('3', 3, 'resume', 1_000)];
    expect(computeActiveTime(events)).toEqual({ milliseconds: 100, quality: 'partial' });
  });

  it('marca el tiempo no medido como no disponible', () => {
    expect(computeActiveTime([])).toEqual({ milliseconds: 0, quality: 'unavailable' });
  });

  it('no cuenta dos veces eventos duplicados y señala un reloj no monotónico como parcial', () => {
    const events = [
      event('1', 1, 'open', 100),
      event('1', 1, 'open', 100),
      event('2', 2, 'leave', 90),
    ];
    expect(computeActiveTime(events)).toEqual({ milliseconds: 0, quality: 'partial' });
  });

  it('calcula duración con el reloj monotónico aunque la hora civil cambie', () => {
    const events = [
      { ...event('1', 1, 'open', 5_000), monotonicAt: 100 },
      { ...event('2', 2, 'leave', 20), monotonicAt: 250 },
    ];
    expect(computeActiveTime(events)).toEqual({ milliseconds: 150, quality: 'complete' });
  });

  it('no estima duración cuando una sesión solo tiene marcas de hora civil', () => {
    const start = event('1', 1, 'open', 100);
    const stop = event('2', 2, 'leave', 200);
    delete start.monotonicAt;
    delete stop.monotonicAt;
    expect(computeActiveTime([start, stop])).toEqual({ milliseconds: 0, quality: 'partial' });
  });
});
