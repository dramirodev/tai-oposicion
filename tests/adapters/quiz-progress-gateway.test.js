import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as store from '../../src/adapters/local/legacy-store.js';
import { localQuizProgressGateway } from '../../src/adapters/local/progress-repository.js';

describe('localQuizProgressGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    store.resetAll();
  });

  it('expone estadísticas, informes y preferencias tipadas durante una pregunta', () => {
    store.record('q-1', 'T1.01', 0, 100, 4);
    store.setMotivo('q-1', 'T1.01', 2, 101);
    store.toggleFlag('q-1', 'T1.01');
    store.setCfg('ui', { theme: 'dark', size: 2, lectura: 1 });
    localQuizProgressGateway.saveErrorReport('q-1', 'T1.01', 'Texto confuso', 'nota breve');

    expect(localQuizProgressGateway.getQuestionStats('q-1')).toMatchObject({ errorReason: 2, doubtful: true });
    expect(localQuizProgressGateway.getErrorReport('q-1')).toMatchObject({ reason: 'Texto confuso', note: 'nota breve', state: 'abierto' });
    expect(localQuizProgressGateway.getUiPreferences()).toEqual({ theme: 'dark', size: 2, lectura: 1 });
  });

  it('notifica los cambios y alterna tarjetas de fallo sin cambiar otros datos', () => {
    const changed = vi.fn();
    const unsubscribe = localQuizProgressGateway.subscribe(changed);
    store.record('q-2', 'T1.02', 0, 200);
    localQuizProgressGateway.toggleFailureCard('q-2');
    expect(localQuizProgressGateway.hasFailureCard('q-2')).toBe(true);
    localQuizProgressGateway.toggleFailureCard('q-2');
    expect(localQuizProgressGateway.hasFailureCard('q-2')).toBe(false);
    expect(store.rec('q-2')).toBeDefined();
    expect(changed).toHaveBeenCalled();
    unsubscribe();
  });
});
