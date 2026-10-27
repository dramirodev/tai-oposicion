import { describe, expect, it } from 'vitest';
import { getHomeProgressSummary } from '../src/core/application/stats/get-home-progress-summary.js';

describe('getHomeProgressSummary', () => {
  it('derives Home counters from typed per-question progress', async () => {
    const summary = await getHomeProgressSummary({
      async getStats() {
        return {
          q1: { attempts: 3, correct: 2, lastSeenAt: 100, secondsStudied: 240, timedAnswers: 8 },
          q2: { attempts: 2, correct: 1, lastSeenAt: 200, secondsStudied: 60, timedAnswers: 2, lastResult: 0, errorReason: 7 },
        };
      },
    });

    expect(summary).toEqual({ seen: 2, answers: 5, answerTimestamps: [100, 200], quickCount: 10, slowCount: 1 });
  });

  it('keeps the existing default estimate when there is no timing data', async () => {
    const summary = await getHomeProgressSummary({ async getStats() { return {}; } });
    expect(summary.quickCount).toBe(10);
    expect(summary.seen).toBe(0);
    expect(summary.answers).toBe(0);
  });
});
