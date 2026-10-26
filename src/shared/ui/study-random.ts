import { shuffleItems } from '../../core/domain/selection.js';

/** Supplies the app's random source at the interface boundary before choosing a study order. */
export function randomStudyOrder<T>(items: readonly T[]): T[] {
  return shuffleItems(items, Math.random);
}
