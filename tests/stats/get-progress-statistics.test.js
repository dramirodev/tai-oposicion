import { describe, expect, it, vi } from 'vitest';
import { getProgressStatistics } from '../../src/core/application/stats/get-progress-statistics.js';

describe('getProgressStatistics', () => {
  it('builds the progress summary from validated repository records and question metadata', async () => {
    const now = new Date(2026, 9, 27, 12).getTime();
    const progressRepository = {
      getStats: vi.fn().mockResolvedValue({
        q1: { attempts: 4, correct: 2, lastSeenAt: now, intervalStep: 1, dueAt: now - 1000, lastResult: 0, secondsStudied: 80, timedAnswers: 2, errorReason: 7 },
        q2: { attempts: 5, correct: 4, lastSeenAt: now, lastResult: 1, errorReason: 6 },
        unknown: { attempts: 3, correct: 1, lastSeenAt: now },
      }),
    };
    const metadata = {
      q1: { topicId: 'topic-1', origin: 'O', type: 'test', traps: [1] },
      q2: { topicId: 'topic-1', origin: 'A', type: 'test', traps: [1, 2] },
    };

    const result = await getProgressStatistics(progressRepository, metadata, [{ id: 'topic-1', name: 'Tema 1', total: 10 }], now);

    expect(progressRepository.getStats).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      answers: 9,
      correct: 6,
      accuracy: 67,
      topics: [{ id: 'topic-1', interactions: 9, correct: 6, seen: 2, total: 10, accuracy: 67 }],
      weakTopics: [{ id: 'topic-1', interactions: 9 }],
      failureReasons: [0, 0, 0, 0, 0, 0, 0, 1],
      lucky: 1,
      speed: { count: 1, total: 1, percent: 100, ids: ['q1'] },
      traps: { 1: [9, 3], 2: [5, 1] },
      origins: { O: [4, 2], A: [5, 4] },
      types: { test: [9, 6] },
      slow: [{ id: 'q1', averageSeconds: 40, attempts: 4, correct: 2, lastOutcome: 0, timedAnswers: 2 }],
    });
    expect(result.reviewLoad[0]).toBe(1);
    expect(result.reviewLoad.slice(1)).toEqual(Array(13).fill(0));
  });
});
