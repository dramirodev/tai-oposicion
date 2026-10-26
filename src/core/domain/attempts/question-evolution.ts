import type { AttemptArchive } from './archive.js';

export interface QuestionEvolutionWeek {
  start: number;
  seen: number;
  correct: number;
  wrong: number;
  unknown: number;
}

const DAY = 86400000;

/** Counts final outcomes from completed sessions; legacy aggregate data is not backfilled. */
export function buildQuestionEvolution(archive: AttemptArchive, weeks: number, now: number): QuestionEvolutionWeek[] {
  const count = Math.max(1, Math.floor(weeks));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - (today.getDay() + 6) % 7);
  const first = today.getTime() - (count - 1) * 7 * DAY;
  const result = Array.from({ length: count }, (_, index) => ({
    start: first + index * 7 * DAY,
    seen: 0,
    correct: 0,
    wrong: 0,
    unknown: 0,
  }));
  const sessions = new Map(archive.sessions.map(session => [session.id, session]));
  for (const attempt of archive.attempts) {
    const session = sessions.get(attempt.sessionId);
    if (session?.status !== 'completed' || attempt.state === 'unseen') continue;
    const index = Math.floor((session.startedAt - first) / (7 * DAY));
    if (index < 0 || index >= count) continue;
    const week = result[index];
    week.seen++;
    if (attempt.outcome === 'correct') week.correct++;
    else if (attempt.outcome === 'wrong') week.wrong++;
    else if (attempt.state === 'pending') week.unknown++;
  }
  return result;
}
