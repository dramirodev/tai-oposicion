import type {
  AttemptIntent,
  AttemptMode,
  QuestionAttempt,
  QuestionAttemptSession,
} from '../domain/attempts/transitions.js';

export interface AttemptSeed {
  questionId: string;
  contentRevision: string;
  position: number;
  exposure: number;
  exposureKind?: 'ordinary' | 'immediate-retry';
  retryOfAttemptId?: string;
}

export interface AttemptTrackingRef {
  session: QuestionAttemptSession;
  attempts: readonly QuestionAttempt[];
}

export interface AttemptTracker {
  beginSession(scope: string, mode: AttemptMode, startedAt: number, seeds: readonly AttemptSeed[], timeLimitSeconds?: number, sourceSessionId?: string): AttemptTrackingRef;
  resumeSession(scope: string, sessionId: string, attemptIds: readonly string[]): void;
  record(scope: string, attemptId: string, intent: AttemptIntent): Promise<boolean>;
  closeSession(scope: string, sessionId: string, status: 'completed' | 'interrupted', endedAt: number, elapsedSeconds?: number): void;
  flush(): Promise<void>;
}
