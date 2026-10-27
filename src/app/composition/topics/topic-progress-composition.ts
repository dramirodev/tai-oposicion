import type { ProgressRepository } from '../../../core/ports/ProgressRepository.js';

interface TopicProgressDependencies {
  progressRepository: Pick<ProgressRepository, 'getStats'>;
  accountId: () => string | null;
  questionIdsForTopic: (topicId: string) => readonly string[] | undefined;
}

interface TopicSummaryInput { id: string; name: string; total: number }

/** Reads typed progress once and builds the topic summaries used by Test and Topics. */
export function createTopicProgressComposition({ progressRepository, accountId, questionIdsForTopic }: TopicProgressDependencies) {
  return async function loadTopicProgress(topics: readonly TopicSummaryInput[]) {
    const account = accountId();
    const statistics = await progressRepository.getStats();
    if (account !== accountId()) throw new Error('La cuenta cambió mientras se cargaba el progreso por temas.');

    return topics.map(topic => {
      let attempted = 0;
      let correct = 0;
      let answerCount = 0;
      for (const questionId of questionIdsForTopic(topic.id) ?? []) {
        const record = statistics[questionId];
        if (!record) continue;
        attempted++;
        correct += record.correct;
        answerCount += record.attempts;
      }
      return { id: topic.id, name: topic.name, total: topic.total, attempted, answered: attempted, correct, answerCount, accuracy: answerCount ? Math.round(100 * correct / answerCount) : null };
    });
  };
}
