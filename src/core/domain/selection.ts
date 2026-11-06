import type { QuestionRecord } from './question-record.js';
import { isEditorialQuarantineActive } from './question-review-overrides.js';
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
  uniqueKeyOf?: (item: T) => string | undefined,
): T[] {
  const active = topics.filter(topic => pools[topic.id]?.length);
  if (!active.length || count <= 0) return [];
  const weight = (topic: WeightedTopic) => (topic.weight ?? 0) > 0 ? topic.weight! : 1;
  const totalWeight = active.reduce((sum, topic) => sum + weight(topic), 0);
  const slots = active.map(topic => ({
    pool: pools[topic.id]!,
    target: count * weight(topic) / totalWeight,
    selected: [] as T[],
    cursor: 0,
  }));

  // Reserve one distinct family per topic when the requested form can cover the syllabus.
  // If another topic needs the same family, try moving its owner to an alternative.
  const owner = new Map<string, number>();
  const first = new Map<number, number>();
  function reserve(topic: number, visited: Set<number>): boolean {
    if (visited.has(topic)) return false;
    visited.add(topic);
    const pool = slots[topic].pool;
    for (let index = 0; index < pool.length; index++) {
      const key = uniqueKeyOf?.(pool[index]);
      const current = key === undefined ? undefined : owner.get(key);
      if (current !== undefined && !reserve(current, visited)) continue;
      if (key !== undefined) owner.set(key, topic);
      first.set(topic, index);
      return true;
    }
    return false;
  }
  if (count >= slots.length) {
    slots.forEach((_, topic) => reserve(topic, new Set()));
  }
  for (const [topic, index] of first) slots[topic].selected.push(slots[topic].pool[index]);
  const used = new Set(owner.keys());
  let selected = first.size;
  while (selected < count) {
    let next = -1;
    let deficit = -Infinity;
    for (let topic = 0; topic < slots.length; topic++) {
      const slot = slots[topic];
      while (slot.cursor < slot.pool.length) {
        const key = uniqueKeyOf?.(slot.pool[slot.cursor]);
        if (slot.cursor !== first.get(topic) && (key === undefined || !used.has(key))) break;
        slot.cursor++;
      }
      const missing = slot.target - slot.selected.length;
      if (slot.cursor < slot.pool.length && missing > deficit) {
        next = topic;
        deficit = missing;
      }
    }
    if (next < 0) break;
    const slot = slots[next];
    const item = slot.pool[slot.cursor++];
    const key = uniqueKeyOf?.(item);
    if (key !== undefined) used.add(key);
    slot.selected.push(item);
    selected++;
  }
  const result = slots.flatMap(slot => slot.selected);
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

/** Shared catalogue eligibility, identical to the study selectors. */
export function isStudyQuestionEligible(question: QuestionRecord, origins: { has(origin: QuestionRecord['o']): boolean }, mode: 'practice' | 'simulation' = 'practice'): boolean {
  return isQuestionAllowed(question.o, question.r, origins) && !isEditorialQuarantineActive(question)
    && (mode !== 'simulation' || ((question.o !== 'G' || question.v === 0) && question.np !== 1 && question.p !== 1));
}
