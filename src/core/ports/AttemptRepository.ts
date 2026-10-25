import type { AttemptEvent, QuestionAttempt, QuestionAttemptSession } from '../domain/attempts/transitions.js';

export interface AttemptPage {
  attempts: readonly QuestionAttempt[];
  nextCursor: string | null;
}

export interface AttemptEventPage {
  events: readonly AttemptEvent[];
  nextCursor: string | null;
}

export type AppendAttemptEventResult =
  | { status: 'stored' }
  | { status: 'duplicate' }
  | { status: 'conflict'; eventIds: readonly string[] };

export type AttemptRepositoryChange =
  | { source: 'local' | 'remote' | 'import'; type: 'session-updated'; session: QuestionAttemptSession }
  | { source: 'local'; type: 'attempt-created'; attempt: QuestionAttempt }
  | { source: 'local'; type: 'transition'; attempt: QuestionAttempt; event: AttemptEvent }
  | { source: 'import' | 'remote'; type: 'page-imported'; attempts: readonly QuestionAttempt[]; events: readonly AttemptEvent[] }
  | { source: 'local' | 'remote'; type: 'scope-deleted'; deletedAt: number };

export interface AttemptScopeTombstone { deletedAt: number; revision: number }

export interface AttemptRepository {
  subscribe(scope: string, listener: (change: AttemptRepositoryChange) => void): () => void;
  createSession(scope: string, session: QuestionAttemptSession, source?: 'local' | 'remote' | 'import'): Promise<void>;
  getSession(scope: string, sessionId: string): Promise<QuestionAttemptSession | undefined>;
  saveSession(scope: string, session: QuestionAttemptSession, source?: 'local' | 'remote' | 'import'): Promise<void>;
  createAttempt(scope: string, attempt: QuestionAttempt): Promise<void>;
  getAttempt(scope: string, attemptId: string): Promise<QuestionAttempt | undefined>;
  saveTransition(
    scope: string,
    attempt: QuestionAttempt,
    event: AttemptEvent,
  ): Promise<AppendAttemptEventResult>;
  getAttemptsBySession(scope: string, sessionId: string, cursor?: string, limit?: number): Promise<AttemptPage>;
  getEvents(scope: string, attemptId: string, cursor?: string, limit?: number): Promise<AttemptEventPage>;
  getScopePage(scope: string, cursor?: string, limit?: number): Promise<AttemptPage>;
  getScopeTombstone(scope: string): Promise<AttemptScopeTombstone | undefined>;
  importPage(
    scope: string,
    archiveCreatedAt: number,
    attempts: readonly QuestionAttempt[],
    events: readonly AttemptEvent[],
    source?: 'import' | 'remote',
  ): Promise<void>;
  deleteScope(scope: string, deletedAt: number, source?: 'local' | 'remote'): Promise<void>;
}
