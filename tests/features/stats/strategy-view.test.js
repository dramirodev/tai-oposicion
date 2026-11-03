import { describe, expect, it } from 'vitest';
import { analyzeAttemptStrategy } from '../../../src/core/domain/attempts/strategy-report.ts';
import { renderStrategyReport } from '../../../src/features/stats/strategy-view.ts';

describe('strategy report presentation', () => {
  it('escapes bank labels and keeps evidence, thresholds, and missing timing explicit', () => {
    const report = analyzeAttemptStrategy({
      sessions: [{ id: 's1', mode: 'simulation', status: 'completed', startedAt: 10, endedAt: 20, lastSequence: 1 }],
      attempts: [{ id: 'a1', sessionId: 's1', questionId: 'Q1', contentRevision: 'old', mode: 'simulation', position: 0, exposure: 1, state: 'revealed', response: null, outcome: null, confidence: 'guess', discardedOptions: [], highlights: [], createdAt: 10, lastSequence: 1, appliedEventIds: [] }],
      events: [],
      questions: new Map([['Q1', { id: 'Q1', topicId: '<img src=x onerror=alert(1)>', origin: 'O', statement: 'Q', options: ['x'], correctIndex: 0 }]]),
      from: 0, to: 100, reward: 1, penalty: 1 / 3, blankValue: 0,
    });
    const html = renderStrategyReport(report);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('20 respuestas elegibles');
    expect(html).toContain('La confianza declarada no se interpreta como probabilidad');
    expect(html).toContain('Tiempo activo observado');
    expect(html).toContain('soluciones consultadas');
    expect(html).toContain('Muestra insuficiente');
    expect(report.segments[0].recommendationReason).toBe('insufficient-sample');
  });
});
