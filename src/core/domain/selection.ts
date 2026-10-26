import { hasPendingFailure } from './spaced-repetition.ts';

export type RandomGenerator = () => number;

export function shuffleItems<T>(items: readonly T[], random: RandomGenerator): T[] {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export interface SelectionStats {
  attempts: number;
  lastSeenAt: number;
  lastResult?: number;
  intervalStep?: number;
  doubtful?: boolean;
  failureStreak?: number;
}

export function questionPriority(mode: string, statistics?: SelectionStats): number {
  if (mode === 'falladas') {
    return hasPendingFailure(statistics) ? 0 : 9;
  }
  if (mode === 'dudosas') return statistics?.doubtful ? 0 : 9;
  if (mode === 'nuevas') return !statistics ? 0 : statistics.lastResult === 0 ? 1 : 2;
  return 0;
}

export interface WeightedTopic {
  id: string;
  weight?: number;
}

export function filterScoringQuestions<T>(
  questions: readonly T[],
  feedback: boolean | undefined,
  nonScoringOf: (question: T) => number | undefined,
): T[] {
  return feedback ? questions.slice() : questions.filter(question => nonScoringOf(question) !== 1);
}

export function isQuestionAllowed<TOrigin>(
  origin: TOrigin,
  reserved: unknown,
  allowedOrigins: { has(value: TOrigin): boolean },
): boolean {
  return allowedOrigins.has(origin) && !reserved;
}

export function composeWeightedQuestions<T>(
  topics: readonly WeightedTopic[],
  pools: Readonly<Record<string, readonly T[] | undefined>>,
  count: number,
  random: RandomGenerator,
): T[] {
  const active = topics.filter(topic => (pools[topic.id] || []).length);
  if (!active.length) return [];
  const targetCount = Math.min(count, active.reduce((sum, topic) => sum + pools[topic.id]!.length, 0));
  const weight = (topic: WeightedTopic) => (topic.weight ?? 0) > 0 ? topic.weight! : 1;
  const totalWeight = active.reduce((sum, topic) => sum + weight(topic), 0);
  const allocations = active.map(topic => ({
    topicId: topic.id,
    exact: targetCount * weight(topic) / totalWeight,
    count: 0,
    remainder: 0,
  }));
  allocations.forEach(allocation => {
    allocation.count = Math.min(Math.floor(allocation.exact), pools[allocation.topicId]!.length);
    allocation.remainder = allocation.exact - Math.floor(allocation.exact);
  });
  let remaining = targetCount - allocations.reduce((sum, allocation) => sum + allocation.count, 0);
  for (const allocation of allocations.slice().sort((leftItem, rightItem) => rightItem.remainder - leftItem.remainder)) {
    if (remaining > 0 && allocation.count < pools[allocation.topicId]!.length) {
      allocation.count++;
      remaining--;
    }
  }
  while (remaining > 0) {
    const allocation = allocations.find(item => item.count < pools[item.topicId]!.length);
    if (!allocation) break;
    allocation.count++;
    remaining--;
  }
  const result: T[] = [];
  for (const allocation of allocations) result.push(...pools[allocation.topicId]!.slice(0, allocation.count));
  return shuffleItems(result, random);
}

export function estimateQuickQuestionCount(
  timedAnswers: readonly { totalSeconds: number; count: number }[],
  minutes = 5,
): number {
  let seconds = 0;
  let count = 0;
  for (const answer of timedAnswers) {
    if (answer.count) {
      seconds += answer.totalSeconds;
      count += answer.count;
    }
  }
  const average = count >= 10 ? seconds / count : 30;
  return Math.max(6, Math.min(15, Math.round(minutes * 60 / Math.max(5, average))));
}

export function pickQuickQuestions<T>(
  due: readonly T[],
  pools: readonly (readonly T[])[],
  count: number,
  idOf: (item: T) => string,
  random: RandomGenerator,
): T[] {
  const dueCount = Math.min(due.length, Math.ceil(count * 0.6));
  const result = due.slice(0, dueCount);
  const seen = new Set(result.map(idOf));
  const queues = pools.map(pool => pool.filter(item => !seen.has(idOf(item))));
  let guard = 0;
  while (result.length < count && queues.some(pool => pool.length) && guard++ < 1000) {
    for (const pool of queues) {
      if (result.length >= count) break;
      const item = pool.shift();
      if (item && !seen.has(idOf(item))) {
        result.push(item);
        seen.add(idOf(item));
      }
    }
  }
  for (const item of due.slice(dueCount)) {
    if (result.length >= count) break;
    if (!seen.has(idOf(item))) {
      result.push(item);
      seen.add(idOf(item));
    }
  }
  return shuffleItems(result, random);
}

export interface GuestQuestionPool<T> {
  topicId: string;
  questions: readonly T[];
}

export function pickGuestQuestions<T>(
  pools: readonly GuestQuestionPool<T>[],
  count: number,
  idOf: (item: T) => string,
  isSeen: (id: string) => boolean,
  excluded: ReadonlySet<string>,
  random: RandomGenerator,
): T[] {
  const result: T[] = [];
  for (const pool of shuffleItems(pools.filter(item => item.questions.length), random)) {
    if (result.length >= count) break;
    const preferences = [
      (question: T) => !isSeen(idOf(question)) && !excluded.has(idOf(question)),
      (question: T) => !excluded.has(idOf(question)),
      () => true,
    ];
    for (const accepts of preferences) {
      const candidates = pool.questions.filter(accepts);
      if (candidates.length) {
        result.push(candidates[Math.floor(random() * candidates.length)]);
        break;
      }
    }
  }
  return result;
}
