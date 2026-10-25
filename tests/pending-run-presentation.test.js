import { describe, expect, it } from 'vitest';
import { formatPendingRunPrompt } from '../src/shared/presentation/pending-run.ts';

describe('formatPendingRunPrompt', () => {
  it('formats a normal pending session exactly as the legacy prompt', () => {
    expect(formatPendingRunPrompt({
      title: 'Test de tema',
      index: 2,
      itemCount: 8,
      seconds: 65,
      limitMinutes: 5,
      timeLimited: false,
    })).toBe('Tienes sin terminar «Test de tema» (3/8, quedan 3:55). ¿Continuar donde lo dejaste?');
  });

  it('uses the current question index for time-limited sessions', () => {
    expect(formatPendingRunPrompt({
      title: undefined,
      index: 1,
      itemCount: 4,
      seconds: 60,
      limitMinutes: 0,
      timeLimited: true,
    })).toBe('Tienes sin terminar «Test» (pregunta 2). ¿Continuar donde lo dejaste?');
  });
});
