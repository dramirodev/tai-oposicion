import type { AttemptEventDto, QuestionAttemptDto } from './attempt.js';
import type { AttemptSessionDto } from './attempt-session.js';

export interface AttemptArchiveDto {
  schemaVersion: 1;
  createdAt: number;
  sessions: AttemptSessionDto[];
  attempts: QuestionAttemptDto[];
  events: AttemptEventDto[];
}
