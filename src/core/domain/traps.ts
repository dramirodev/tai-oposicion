export interface TrapQuestionStats {
  lastResult?: number;
}

export interface TrapRate {
  trapId: string;
  responseCount: number;
  errorCount: number;
  errorRate: number;
}

export interface TrapAnswerEvaluation {
  hits: number;
  missed: number;
  falseAlarms: number;
  total: number;
  correctIds: number[];
  selectedIds: number[];
}

/** Scores one trap question without changing the selected answers or persistence. */
export function evaluateTrapAnswer(
  correctIds: readonly number[],
  selectedIds: readonly number[],
): TrapAnswerEvaluation {
  const correct = new Set(correctIds);
  const selected = new Set(selectedIds);
  return {
    hits: correctIds.filter(id => selected.has(id)).length,
    missed: correctIds.filter(id => !selected.has(id)).length,
    falseAlarms: selectedIds.filter(id => !correct.has(id)).length,
    total: correctIds.length,
    correctIds: [...correctIds],
    selectedIds: [...selected],
  };
}

/** Adds one response to the historic [shown, detected] counters per trap. */
export function recordTrapDetections(
  previous: Readonly<Record<string, readonly [number, number]>>,
  correctIds: readonly number[],
  selectedIds: readonly number[],
): Record<string, [number, number]> {
  const selected = new Set(selectedIds);
  const next = Object.fromEntries(Object.entries(previous).map(([id, counts]) => [id, [...counts] as [number, number]]));
  for (const id of correctIds) {
    const counts = next[id] || [0, 0];
    counts[0]++;
    if (selected.has(id)) counts[1]++;
    next[id] = counts;
  }
  return next;
}

export function calculateTrapRates(
  statistics: Record<string, { attempts: number; correct: number }>,
  trapIdsForQuestion: (questionId: string) => (number | string)[] | undefined,
  minimumResponses = 5,
): TrapRate[] {
  const totals: Record<string, { trapId: string; responseCount: number; errorCount: number }> = {};
  for (const questionId in statistics) {
    const stat = statistics[questionId];
    const errors = stat.attempts - stat.correct;
    for (const rawTrapId of trapIdsForQuestion(questionId) || []) {
      const key = String(rawTrapId);
      const total = totals[key] ||= { trapId: key, responseCount: 0, errorCount: 0 };
      total.responseCount += stat.attempts;
      total.errorCount += errors;
    }
  }
  return Object.values(totals)
    .filter(total => total.responseCount >= minimumResponses)
    .map(total => ({ ...total, errorRate: total.errorCount / total.responseCount }))
    .sort((leftItem, rightItem) => rightItem.errorRate - leftItem.errorRate || rightItem.responseCount - leftItem.responseCount);
}

function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** Select questions by latest outcome, then by how many requested traps they cover. */
export function selectTrapQuestions<T extends { id: string; trapIds: (string | number)[] }>(
  candidates: readonly T[],
  statisticsForQuestion: (questionId: string) => TrapQuestionStats | undefined,
  targetTrapIds: readonly (number | string)[],
  count: number,
  random: () => number,
): T[] {
  const targets = new Set(targetTrapIds.map(Number));
  const score = (question: T) => (question.trapIds || []).filter(id => targets.has(+id)).length;
  const priority = (question: T) => {
    const stats = statisticsForQuestion(question.id);
    return stats && stats.lastResult === 0 ? 0 : !stats ? 1 : 2;
  };
  const groups: T[][] = [[], [], []];
  for (const question of candidates) if (score(question)) groups[priority(question)].push(question);

  const selected: T[] = [];
  for (const group of groups) {
    const byScore: Record<number, T[]> = {};
    for (const question of group) (byScore[score(question)] ||= []).push(question);
    for (const scoreKey of Object.keys(byScore).sort((leftItem, rightItem) => +rightItem - +leftItem)) {
      selected.push(...shuffleWith(byScore[+scoreKey], random));
    }
  }
  return selected.slice(0, count);
}
