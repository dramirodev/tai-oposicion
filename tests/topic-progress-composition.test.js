import { describe, expect, it } from 'vitest';
import { createTopicProgressComposition } from '../src/app/composition/topics/topic-progress-composition.js';

describe('createTopicProgressComposition', () => {
  it('summarizes per-question progress while preserving each page contract', async () => {
    const loadTopicProgress = createTopicProgressComposition({
      accountId: () => 'guest',
      questionIdsForTopic: id => id === 'A' ? ['q1', 'q2', 'unseen'] : [],
      progressRepository: {
        async getStats() {
          return {
            q1: { attempts: 3, correct: 2, lastSeenAt: 100 },
            q2: { attempts: 1, correct: 1, lastSeenAt: 200 },
          };
        },
      },
    });

    const summaries = await loadTopicProgress([{ id: 'A', name: 'Bloque A', total: 10 }, { id: 'B', name: 'Bloque B', total: 5 }]);
    expect(summaries).toEqual([
      { id: 'A', name: 'Bloque A', total: 10, attempted: 2, answered: 2, correct: 3, answerCount: 4, accuracy: 75 },
      { id: 'B', name: 'Bloque B', total: 5, attempted: 0, answered: 0, correct: 0, answerCount: 0, accuracy: null },
    ]);
  });

  it('discards results if the active account changes during the read', async () => {
    let activeAccount = 'first';
    let finishRead;
    const loadTopicProgress = createTopicProgressComposition({
      accountId: () => activeAccount,
      questionIdsForTopic: () => [],
      progressRepository: { getStats: () => new Promise(resolve => { finishRead = resolve; }) },
    });
    const result = loadTopicProgress([]);
    activeAccount = 'second';
    finishRead({});
    await expect(result).rejects.toThrow('La cuenta cambió mientras se cargaba el progreso por temas.');
  });
});
