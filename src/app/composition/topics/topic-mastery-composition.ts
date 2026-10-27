import type { ProgressRepository } from '../../../core/ports/ProgressRepository.js';
import { mapTopicMasteryToLegacy } from '../../mappers/topic-mastery-mapper.js';
import type { Index } from '../../../adapters/legacy/types.js';

interface TopicMasteryDependencies {
  progressRepository: Pick<ProgressRepository, 'getStats'>;
  accountId: () => string | null;
  questionIdsForTopic: (topicId: string) => readonly string[] | undefined;
  now: () => number;
}

/** Composes per-account progress with the legacy topic view model. */
export function createTopicMasteryComposition({ progressRepository, accountId, questionIdsForTopic, now }: TopicMasteryDependencies) {
  return async function dominioTemas(index: Index) {
    const account = accountId();
    const statistics = await progressRepository.getStats();
    if (account !== accountId()) throw new Error('La cuenta cambió mientras se cargaba el dominio por temas.');
    return mapTopicMasteryToLegacy(index.temas, questionIdsForTopic, id => statistics[id], now());
  };
}
