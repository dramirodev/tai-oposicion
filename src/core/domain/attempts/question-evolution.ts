import type { AttemptArchive } from './archive.js';

export interface QuestionEvolutionWeek {
  start: number;
  seen: number;
  correct: number;
  wrong: number;
  unknown: number;
}

/** Local midnight of `monday` shifted by whole calendar weeks, so a daylight-saving change cannot move the week boundary. */
function weekStart(monday: Date, offsetWeeks: number): number {
  const date = new Date(monday);
  date.setDate(date.getDate() + offsetWeeks * 7);
  return date.getTime();
}

/** Counts final outcomes from completed sessions; legacy aggregate data is not backfilled. */
export function buildQuestionEvolution(archive: AttemptArchive, weeks: number, now: number): QuestionEvolutionWeek[] {
  const count = Math.max(1, Math.floor(weeks));
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const result = Array.from({ length: count }, (_, index) => ({
    start: weekStart(monday, index - (count - 1)),
    seen: 0,
    correct: 0,
    wrong: 0,
    unknown: 0,
  }));
  const end = weekStart(monday, 1);
  const sessions = new Map(archive.sessions.map(session => [session.id, session]));
  for (const attempt of archive.attempts) {
    const session = sessions.get(attempt.sessionId);
    if (attempt.exposureKind === 'immediate-retry') continue;
    if (session?.status !== 'completed' || attempt.state === 'unseen') continue;
    if (session.startedAt < result[0].start || session.startedAt >= end) continue;
    let index = count - 1;
    while (index > 0 && result[index].start > session.startedAt) index--;
    const week = result[index];
    week.seen++;
    if (attempt.outcome === 'correct') week.correct++;
    else if (attempt.outcome === 'wrong') week.wrong++;
    // Revealing the solution changes `pending` to `revealed`, but the user
    // still marked the question as unknown and it must remain in the count.
    else if (attempt.state === 'pending' || attempt.state === 'revealed') week.unknown++;
  }
  return result;
}
