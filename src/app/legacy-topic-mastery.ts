import * as store from '../adapters/local/legacy-store.js';
import { META, now } from '../adapters/http/legacy-data.js';
import { dominioCalc } from '../legacy/logic.js';
import type { Index } from '../adapters/legacy/types.js';

/** Presentation adapter for legacy screens; localized status labels stay outside core. */
export function dominioTemas(index: Index) {
  return dominioCalc(index.temas, topicId => META._by[topicId], questionId => store.rec(questionId), now());
}
