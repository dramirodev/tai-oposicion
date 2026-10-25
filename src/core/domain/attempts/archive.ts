import type { AttemptEvent, QuestionAttempt, QuestionAttemptSession } from './transitions.js';

export interface AttemptArchive {
  createdAt: number;
  sessions: readonly QuestionAttemptSession[];
  attempts: readonly QuestionAttempt[];
  events: readonly AttemptEvent[];
}
