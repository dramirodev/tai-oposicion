export type AttemptStateDto = 'unseen' | 'pending' | 'answered' | 'revealed';
export type AttemptModeDto = 'practice' | 'simulation';
export type AttemptOutcomeDto = 'correct' | 'wrong';
export type AttemptConfidenceDto = 'sure' | 'betweenTwo' | 'guess' | null;
export type AttemptEventTypeDto =
  | 'open' | 'leave' | 'mark-pending' | 'answer' | 'reveal' | 'pause' | 'resume'
  | 'set-confidence' | 'discard-option' | 'restore-option' | 'add-highlight' | 'remove-highlight' | 'close';

export interface HighlightDto {
  id: string;
  field: 'statement' | `option:${number}`;
  start: number;
  end: number;
  text: string;
  before: string;
  after: string;
  category: 'key' | 'doubt';
  contentRevision: string;
  createdAt: number;
  timing: 'before-answer' | 'after-answer' | 'after-reveal';
  stale?: boolean;
}

export interface QuestionAttemptDto {
  schemaVersion: 1;
  id: string;
  sessionId: string;
  questionId: string;
  contentRevision: string;
  mode: AttemptModeDto;
  position: number;
  exposure: number;
  state: AttemptStateDto;
  response: number | null;
  outcome: AttemptOutcomeDto | null;
  terminalEventId?: string;
  confidence: AttemptConfidenceDto;
  discardedOptions: number[];
  highlights: HighlightDto[];
  createdAt: number;
  completedAt?: number;
  lastSequence: number;
  appliedEventIds: string[];
}

export interface AttemptEventDto {
  schemaVersion: 1;
  id: string;
  attemptId: string;
  sequence: number;
  type: AttemptEventTypeDto;
  at: number;
  monotonicAt?: number;
  payload: Record<string, unknown>;
}
