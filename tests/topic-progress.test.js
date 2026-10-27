import { describe, expect, it } from 'vitest';
import { summarizeTopicProgress } from '../src/core/application/stats/summarize-topic-progress.js';

describe('summarizeTopicProgress', () => {
  it('aggregates answers and ranks only topics with enough practice by accuracy', () => {
    const result = summarizeTopicProgress([
      { topicId: 'A', attempts: 6, correct: 4, seen: 1 },
      { topicId: 'A', attempts: 4, correct: 3, seen: 1 },
      { topicId: 'B', attempts: 8, correct: 6, seen: 1 },
      { topicId: 'C', attempts: 1, correct: 0, seen: 1 },
    ], [
      { id: 'A', name: 'Administración', total: 20 },
      { id: 'B', name: 'Sistemas', total: 25 },
      { id: 'C', name: 'Redes', total: 10 },
      { id: 'D', name: 'Sin practicar', total: 5 },
    ]);

    expect(result.answers).toBe(19);
    expect(result.correct).toBe(13);
    expect(result.accuracy).toBe(68);
    expect(result.topics).toEqual([
      { id: 'A', name: 'Administración', interactions: 10, correct: 7, seen: 2, total: 20, accuracy: 70 },
      { id: 'B', name: 'Sistemas', interactions: 8, correct: 6, seen: 1, total: 25, accuracy: 75 },
      { id: 'C', name: 'Redes', interactions: 1, correct: 0, seen: 1, total: 10, accuracy: 0 },
      { id: 'D', name: 'Sin practicar', interactions: 0, correct: 0, seen: 0, total: 5, accuracy: 0 },
    ]);
    expect(result.weakTopics.map(topic => topic.id)).toEqual(['A', 'B']);
  });

  it('keeps empty progress at zero and permits explicit thresholds and limits', () => {
    const result = summarizeTopicProgress(
      [{ topicId: 'A', attempts: 2, correct: 1, seen: 1 }, { topicId: 'B', attempts: 4, correct: 3, seen: 1 }],
      [{ id: 'A', name: 'A', total: 3 }, { id: 'B', name: 'B', total: 5 }],
      1,
      1,
    );
    expect(result.weakTopics.map(topic => topic.id)).toEqual(['A']);
    expect(summarizeTopicProgress([], [{ id: 'A', name: 'A', total: 3 }]).accuracy).toBe(0);
  });
});
