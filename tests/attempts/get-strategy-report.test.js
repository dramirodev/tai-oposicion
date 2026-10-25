import { describe, expect, it, vi } from 'vitest';
import { getStrategyReport } from '../../src/core/application/attempts/get-strategy-report.ts';

const session = { id: 's-1', mode: 'simulation', status: 'completed', startedAt: 100, endedAt: 200, lastSequence: 1 };
const attempt = (id, questionId) => ({
  id, sessionId: 's-1', questionId, contentRevision: 'rev', mode: 'simulation', position: 0, exposure: 1,
  state: 'answered', response: 0, outcome: 'correct', confidence: null, discardedOptions: [], highlights: [],
  createdAt: 100, completedAt: 200, lastSequence: 1, appliedEventIds: [],
});

function memoryRepository(attempts, events = []) {
  return {
    getScopePage: vi.fn(async () => ({ attempts, nextCursor: null })),
    getEvents: vi.fn(async (_scope, attemptId) => ({ events: events.filter(event => event.attemptId === attemptId), nextCursor: null })),
    getSession: vi.fn(async (_scope, id) => id === session.id ? session : undefined),
  };
}

describe('getStrategyReport', () => {
  it('orchestrates domain entities and asks the bank once per unique question, without reading DTOs', async () => {
    const repository = memoryRepository([attempt('a1', 'Q1'), attempt('a2', 'Q1')]);
    const question = { id: 'Q1', topicId: 'T1.01', origin: 'O', statement: 'Q', options: ['x', 'y'], correctIndex: 0, kind: 'code' };
    const bank = { getQuestion: vi.fn(async id => id === question.id ? question : undefined) };
    const report = await getStrategyReport({
      repository, bank, scope: 'guest', from: 0, to: 500, generatedAt: 500,
      reward: 1, penalty: 1 / 3, blankValue: 0,
    });
    expect(bank.getQuestion).toHaveBeenCalledTimes(1);
    expect(bank.getQuestion).toHaveBeenCalledWith('Q1');
    expect(report).toMatchObject({
      completedSessionCount: 1,
      scoring: { reward: 1, penalty: 1 / 3, blankValue: 0 },
      overall: { attempts: 2, correct: 2 },
    });
    expect(report.segments.find(item => item.dimension === 'topic')).toMatchObject({ value: 'T1.01', attempts: 2 });
  });

  it('keeps completed-history report deterministic for identical inputs', async () => {
    const repository = memoryRepository([attempt('a1', 'Q1')]);
    const bank = { getQuestion: async () => undefined };
    const input = { repository, bank, scope: 'guest', from: 0, to: 500, generatedAt: 500, reward: 1, penalty: 1 / 3, blankValue: 0 };
    expect(await getStrategyReport(input)).toEqual(await getStrategyReport(input));
  });
});
