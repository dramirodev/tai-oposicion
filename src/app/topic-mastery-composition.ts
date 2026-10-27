import * as store from '../adapters/local/legacy-store.js';
import { META, now } from '../adapters/http/legacy-data.js';
import { mapTopicMasteryToLegacy } from './topic-mastery-mapper.js';
import type { Index } from '../adapters/legacy/types.js';

/** Presentation adapter for legacy screens; localized status labels stay outside core. */
export function dominioTemas(index: Index) {
  return mapTopicMasteryToLegacy(index.temas, topicId => META._by[topicId], questionId => store.rec(questionId), now());
}
