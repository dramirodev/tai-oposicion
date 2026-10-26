export interface SessionBreakdown { correct: number; total: number }

export interface StudySessionSummary {
  id: string;
  startedAt: number;
  mode: 'simulation' | 'practice';
  practicePart?: 1 | 2;
  questionCount: number;
  correctCount: number;
  score: number;
  durationSeconds: number;
  byTopic?: Readonly<Record<string, SessionBreakdown>>;
  byQuestionType?: Readonly<Record<string, SessionBreakdown>>;
}

export interface WeeklyStudySummary {
  weekStart: number;
  questionCount: number;
  correctCount: number;
  durationSeconds: number;
  sessionCount: number;
  accuracyPercent: number | null;
  secondsPerQuestion: number | null;
}

/** Monday at local midnight for the week containing the supplied timestamp. */
export function startOfStudyWeek(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

export function aggregateWeeklyStudy(
  sessions: readonly StudySessionSummary[],
  { topicId, questionType, weeks = 12, now }: { topicId?: string; questionType?: string; weeks?: number; now: number },
): WeeklyStudySummary[] {
  const currentWeek = startOfStudyWeek(now);
  const result: WeeklyStudySummary[] = [];
  for (let offset = weeks - 1; offset >= 0; offset--) {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() - 7 * offset);
    result.push({ weekStart: date.getTime(), questionCount: 0, correctCount: 0, durationSeconds: 0, sessionCount: 0, accuracyPercent: null, secondsPerQuestion: null });
  }
  const byWeek = new Map(result.map(week => [week.weekStart, week]));
  for (const session of sessions) {
    const week = byWeek.get(startOfStudyWeek(session.startedAt));
    if (!week) continue;
    const breakdown = topicId ? session.byTopic?.[topicId] : questionType ? session.byQuestionType?.[questionType] : undefined;
    if ((topicId || questionType) && !breakdown) continue;
    const correctCount = breakdown?.correct ?? session.correctCount;
    const questionCount = breakdown?.total ?? session.questionCount;
    if (!questionCount) continue;
    week.questionCount += questionCount;
    week.correctCount += correctCount;
    week.sessionCount++;
    if (!topicId && !questionType) week.durationSeconds += session.durationSeconds || 0;
  }
  return result.map(week => ({
    ...week,
    accuracyPercent: week.questionCount ? Math.round(1000 * week.correctCount / week.questionCount) / 10 : null,
    secondsPerQuestion: week.questionCount && week.durationSeconds ? Math.round(10 * week.durationSeconds / week.questionCount) / 10 : null,
  }));
}

export interface QuestionTimingSummary {
  id: string;
  attempts: number;
  correct: number;
  lastOutcome: number;
  totalSeconds: number;
  timedAnswers: number;
}

export function slowestQuestions(
  statistics: readonly QuestionTimingSummary[],
  { onlyLastCorrect = false, minimumTimedAnswers = 1, limit = 15 }: { onlyLastCorrect?: boolean; minimumTimedAnswers?: number; limit?: number } = {},
) {
  return statistics
    .filter(item => item.timedAnswers >= minimumTimedAnswers && (!onlyLastCorrect || item.lastOutcome === 1))
    .map(item => ({ id: item.id, averageSeconds: Math.round(10 * item.totalSeconds / item.timedAnswers) / 10, attempts: item.attempts, correct: item.correct, lastOutcome: item.lastOutcome, timedAnswers: item.timedAnswers }))
    .sort((left, right) => right.averageSeconds - left.averageSeconds || right.attempts - left.attempts)
    .slice(0, limit);
}

export function buildSimulationHistory(sessions: readonly StudySessionSummary[]) {
  const simulations = sessions.filter(session => session.mode === 'simulation').slice().sort((left, right) => left.startedAt - right.startedAt);
  const previousByPart = new Map<1 | 2, StudySessionSummary>();
  return simulations.map(session => {
    const part = session.practicePart || 1;
    const previous = previousByPart.get(part);
    previousByPart.set(part, session);
    return { session, part, scoreDelta: previous ? Math.round((session.score - previous.score) * 10) / 10 : null };
  });
}

export function compareStudySessions(first: StudySessionSummary, second: StudySessionSummary) {
  const topicIds = [...new Set([...Object.keys(first.byTopic || {}), ...Object.keys(second.byTopic || {})])].sort();
  const accuracy = (breakdown?: SessionBreakdown) => breakdown?.total ? Math.round(100 * breakdown.correct / breakdown.total) : null;
  const topics = topicIds.map(topicId => {
    const firstBreakdown = first.byTopic?.[topicId], secondBreakdown = second.byTopic?.[topicId];
    const firstAccuracy = accuracy(firstBreakdown), secondAccuracy = accuracy(secondBreakdown);
    return {
      topicId,
      firstAccuracy,
      secondAccuracy,
      firstQuestionCount: firstBreakdown?.total || 0,
      secondQuestionCount: secondBreakdown?.total || 0,
      delta: firstAccuracy !== null && secondAccuracy !== null ? secondAccuracy - firstAccuracy : null,
    };
  });
  const rate = (correct: number, total: number) => total ? Math.round(100 * correct / total) : 0;
  return {
    topics,
    scoreDelta: Math.round((second.score - first.score) * 10) / 10,
    accuracyDelta: rate(second.correctCount, second.questionCount) - rate(first.correctCount, first.questionCount),
    secondsPerQuestionDelta: first.questionCount && second.questionCount
      ? Math.round(10 * (second.durationSeconds / second.questionCount - first.durationSeconds / first.questionCount)) / 10
      : null,
  };
}
