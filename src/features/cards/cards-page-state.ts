import type { CardsServices } from '../../shared/ui/study-services.js';

export type CardsPageState =
  | 'topic-scope-mismatch'
  | 'another-session-pending'
  | 'load-error'
  | 'no-daily-cards'
  | 'daily-loading'
  | 'session'
  | 'loading'
  | 'plan';

export function resolveCardsPageState(input: {
  session: ReturnType<CardsServices['getSession']>;
  trainingTopicIds: ReadonlySet<string> | null;
  dailyTrainingActivity: boolean;
  preparedIds: readonly string[];
  errorKey: string;
  requestKey: string;
  planKey: string;
  hasPlan: boolean;
}): CardsPageState {
  const { session, trainingTopicIds, dailyTrainingActivity, preparedIds, errorKey, requestKey, planKey, hasPlan } = input;
  if (session && trainingTopicIds && !session.items.every(card => trainingTopicIds.has(card.t))) return 'topic-scope-mismatch';
  if (dailyTrainingActivity && session && session.items.map(card => card.id).join('\0') !== preparedIds.join('\0')) return 'another-session-pending';
  if (errorKey === requestKey) return 'load-error';
  if (dailyTrainingActivity && !session && !preparedIds.length && planKey === requestKey) return 'no-daily-cards';
  if (dailyTrainingActivity && !session) return 'daily-loading';
  if (session) return 'session';
  if (!hasPlan || planKey !== requestKey) return 'loading';
  return 'plan';
}
