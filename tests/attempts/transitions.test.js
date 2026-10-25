import { describe, expect, it } from 'vitest';
import { applyAttemptAction } from '../../src/core/domain/attempts/transitions.js';

const attempt = (mode = 'practice') => ({
  id: 'attempt-1',
  sessionId: 'session-1',
  questionId: 'q-1',
  contentRevision: 'rev-1',
  mode,
  position: 0,
  exposure: 1,
  state: 'unseen',
  response: null,
  outcome: null,
  confidence: null,
  discardedOptions: [],
  highlights: [],
  createdAt: 100,
  lastSequence: 0,
  appliedEventIds: [],
});

const action = (type, sequence = 1, id = `event-${sequence}`) => ({
  type,
  id,
  sequence,
  at: sequence * 100,
});

describe('transiciones de intentos', () => {
  it('mantiene No lo sé pendiente sin revelar y permite responder después', () => {
    const pending = applyAttemptAction(attempt(), action('mark-pending'));
    expect(pending.attempt.state).toBe('pending');
    expect(pending.attempt.response).toBeNull();
    expect(pending.progressEffect).toBe('none');

    const answered = applyAttemptAction(pending.attempt, { ...action('answer', 2), optionIndex: 1, outcome: 1 });
    expect(answered.attempt).toMatchObject({ state: 'answered', response: 1, outcome: 1 });
    expect(answered.attempt.terminalEventId).toBe('event-2');
    expect(answered.progressEffect).toBe('record-practice-answer');
  });

  it('bloquea una respuesta de práctica ya contestada y conserva el resultado primero', () => {
    const first = applyAttemptAction(attempt(), { ...action('answer'), optionIndex: 2, outcome: 0 });
    const second = applyAttemptAction(first.attempt, { ...action('answer', 2), optionIndex: 1, outcome: 1 });
    expect(second.accepted).toBe(false);
    expect(second.attempt).toBe(first.attempt);
    expect(second.progressEffect).toBe('none');
  });

  it('revelar desde pendiente bloquea respuesta sin efecto de acierto/fallo', () => {
    const pending = applyAttemptAction(attempt(), action('mark-pending'));
    const revealed = applyAttemptAction(pending.attempt, action('reveal', 2));
    const answer = applyAttemptAction(revealed.attempt, { ...action('answer', 3), optionIndex: 0, outcome: 1 });
    expect(revealed.attempt.state).toBe('revealed');
    expect(revealed.attempt.terminalEventId).toBe('event-2');
    expect(revealed.progressEffect).toBe('none');
    expect(answer.accepted).toBe(false);
    expect(answer.attempt.response).toBeNull();
  });

  it('no permite revelar la solución de una pregunta de simulacro ni una ya respondida', () => {
    const simulation = applyAttemptAction(attempt('simulation'), action('mark-pending'));
    const deniedSimulation = applyAttemptAction(simulation.attempt, action('reveal', 2));
    const answered = applyAttemptAction(attempt(), { ...action('answer'), optionIndex: 1, outcome: 'correct' });
    const deniedAnswered = applyAttemptAction(answered.attempt, action('reveal', 2));
    expect(deniedSimulation.accepted).toBe(false);
    expect(deniedSimulation.reason).toBe('solution-not-available');
    expect(deniedAnswered.accepted).toBe(false);
  });

  it('ignora una escritura duplicada de evento sin volver a pedir mutación de progreso', () => {
    const first = applyAttemptAction(attempt(), { ...action('answer'), optionIndex: 0, outcome: 1 });
    const duplicate = applyAttemptAction(first.attempt, { ...action('answer'), optionIndex: 1, outcome: 0 });
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.reason).toBe('duplicate-event');
    expect(duplicate.attempt).toBe(first.attempt);
    expect(duplicate.progressEffect).toBe('none');
  });

  it('permite modificar respuesta en simulacro para conservar su contrato actual', () => {
    const first = applyAttemptAction(attempt('simulation'), { ...action('answer'), optionIndex: 1, outcome: 0 });
    const second = applyAttemptAction(first.attempt, { ...action('answer', 2), optionIndex: 2, outcome: 1 });
    expect(second.accepted).toBe(true);
    expect(second.attempt).toMatchObject({ state: 'answered', response: 2, outcome: 1 });
    expect(second.progressEffect).toBe('defer-to-session-finish');
  });

  it('cierra el intento una sola vez, aunque el cierre repetido llegue con otro evento', () => {
    const closed = applyAttemptAction(attempt(), { ...action('close'), at: 500 });
    const repeated = applyAttemptAction(closed.attempt, { ...action('close', 2), at: 600 });
    expect(closed.attempt.completedAt).toBe(500);
    expect(repeated.accepted).toBe(false);
    expect(repeated.reason).toBe('closed-attempt');
  });

  it('acota los ids redundantes recientes; el repositorio conserva el log completo', () => {
    let current = attempt();
    for (let sequence = 1; sequence <= 300; sequence++) {
      current = applyAttemptAction(current, { ...action('open', sequence), id: `event-${sequence}` }).attempt;
    }
    expect(current.appliedEventIds).toHaveLength(256);
    expect(current.appliedEventIds[0]).toBe('event-45');
    expect(current.appliedEventIds.at(-1)).toBe('event-300');
  });
});
