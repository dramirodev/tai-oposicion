export type QuestionAttemptState = 'unseen' | 'pending' | 'answered' | 'revealed';
export type AttemptMode = 'practice' | 'simulation';
export type AttemptOutcome = 'correct' | 'wrong';
export type Confidence = 'sure' | 'betweenTwo' | 'guess' | null;
export type HighlightCategory = 'key' | 'doubt';
export type AttemptSessionStatus = 'active' | 'completed' | 'interrupted';

/** Session-level lifecycle is kept separate from each question's answer state. */
export interface QuestionAttemptSession {
  id: string;
  sourceSessionId?: string;
  mode: AttemptMode;
  status: AttemptSessionStatus;
  startedAt: number;
  endedAt?: number;
  lastSequence: number;
}

export interface Highlight {
  id: string;
  field: 'statement' | `option:${number}`;
  start: number;
  end: number;
  text: string;
  before: string;
  after: string;
  category: HighlightCategory;
  contentRevision: string;
  createdAt: number;
  timing: 'before-answer' | 'after-answer' | 'after-reveal';
  stale?: boolean;
}

export interface QuestionAttempt {
  id: string;
  sessionId: string;
  questionId: string;
  contentRevision: string;
  mode: AttemptMode;
  position: number;
  exposure: number;
  state: QuestionAttemptState;
  response: number | null;
  outcome: AttemptOutcome | null;
  terminalEventId?: string;
  confidence: Confidence;
  discardedOptions: number[];
  highlights: Highlight[];
  createdAt: number;
  completedAt?: number;
  lastSequence: number;
  appliedEventIds: string[];
}

interface ActionMetadata {
  id: string;
  sequence: number;
  at: number;
  monotonicAt?: number;
}

export type AttemptAction =
  | (ActionMetadata & { type: 'open' | 'leave' | 'pause' | 'resume' })
  | (ActionMetadata & { type: 'mark-pending' })
  | (ActionMetadata & { type: 'answer'; optionIndex: number; outcome: AttemptOutcome })
  | (ActionMetadata & { type: 'reveal' })
  | (ActionMetadata & { type: 'set-confidence'; value: Exclude<Confidence, null> })
  | (ActionMetadata & { type: 'discard-option'; optionIndex: number })
  | (ActionMetadata & { type: 'restore-option'; optionIndex: number })
  | (ActionMetadata & { type: 'add-highlight'; highlight: Highlight })
  | (ActionMetadata & { type: 'remove-highlight'; highlightId: string })
  | (ActionMetadata & { type: 'close'; at: number });

export type AttemptIntent = AttemptAction extends infer Action
  ? Action extends AttemptAction ? Omit<Action, 'id' | 'sequence' | 'at' | 'monotonicAt'> : never
  : never;

export type AttemptEventType = AttemptAction['type'];
export interface AttemptEvent {
  id: string;
  attemptId: string;
  sequence: number;
  type: AttemptEventType;
  at: number;
  monotonicAt?: number;
  payload: AttemptActionPayload;
}

type AttemptActionPayload = AttemptAction extends infer Action
  ? Action extends AttemptAction ? Omit<Action, 'id' | 'sequence' | 'at' | 'monotonicAt' | 'type'> : never
  : never;

export type ProgressEffect = 'none' | 'record-practice-answer' | 'defer-to-session-finish';
export type RejectionReason =
  | 'duplicate-event'
  | 'stale-sequence'
  | 'closed-attempt'
  | 'practice-answer-locked'
  | 'solution-not-available'
  | 'action-not-available'
  | 'missing-attempt'
  | 'concurrent-conflict';

const RECENT_EVENT_ID_WINDOW = 256;

export interface AttemptTransition {
  accepted: boolean;
  attempt: QuestionAttempt;
  event: AttemptEvent | null;
  progressEffect: ProgressEffect;
  reason?: RejectionReason;
}

function rejected(attempt: QuestionAttempt, reason: RejectionReason): AttemptTransition {
  return { accepted: false, attempt, event: null, progressEffect: 'none', reason };
}

function payloadOf(action: AttemptAction): AttemptActionPayload {
  switch (action.type) {
    case 'open':
    case 'leave':
    case 'pause':
    case 'resume':
    case 'mark-pending':
    case 'reveal':
    case 'close':
      return {};
    case 'answer':
      return { optionIndex: action.optionIndex, outcome: action.outcome };
    case 'set-confidence':
      return { value: action.value };
    case 'discard-option':
    case 'restore-option':
      return { optionIndex: action.optionIndex };
    case 'add-highlight':
      return { highlight: action.highlight };
    case 'remove-highlight':
      return { highlightId: action.highlightId };
  }
}

/** Applies an attempt event without IO or clock access. Callers supply its stable id, sequence, and timestamp. */
export function applyAttemptAction(attempt: QuestionAttempt, action: AttemptAction): AttemptTransition {
  if (attempt.appliedEventIds.includes(action.id)) return rejected(attempt, 'duplicate-event');
  if (action.sequence <= attempt.lastSequence) return rejected(attempt, 'stale-sequence');
  if (attempt.completedAt !== undefined) return rejected(attempt, 'closed-attempt');

  let next: QuestionAttempt = {
    ...attempt,
    lastSequence: action.sequence,
    appliedEventIds: [...attempt.appliedEventIds, action.id].slice(-RECENT_EVENT_ID_WINDOW),
  };
  let progressEffect: ProgressEffect = 'none';

  switch (action.type) {
    case 'open':
    case 'leave':
    case 'pause':
    case 'resume':
      break;
    case 'mark-pending':
      if (attempt.state === 'revealed' || (attempt.state === 'answered' && attempt.mode === 'practice')) {
        return rejected(attempt, 'action-not-available');
      }
      next = { ...next, state: 'pending', response: null, outcome: null };
      break;
    case 'answer':
      if (attempt.state === 'revealed') return rejected(attempt, 'practice-answer-locked');
      if (attempt.state === 'answered' && attempt.mode === 'practice') {
        return rejected(attempt, 'practice-answer-locked');
      }
      next = { ...next, state: 'answered', response: action.optionIndex, outcome: action.outcome };
      next = { ...next, terminalEventId: action.id };
      progressEffect = attempt.mode === 'practice' ? 'record-practice-answer' : 'defer-to-session-finish';
      break;
    case 'reveal':
      if (attempt.mode !== 'practice' || attempt.state !== 'pending') {
        return rejected(attempt, 'solution-not-available');
      }
      next = { ...next, state: 'revealed', response: null, outcome: null };
      next = { ...next, terminalEventId: action.id };
      break;
    case 'set-confidence':
      if (attempt.state === 'answered' || attempt.state === 'revealed') return rejected(attempt, 'action-not-available');
      next = { ...next, confidence: action.value };
      break;
    case 'discard-option':
      if (attempt.state === 'answered' || attempt.state === 'revealed') return rejected(attempt, 'action-not-available');
      next = { ...next, discardedOptions: [...new Set([...attempt.discardedOptions, action.optionIndex])].sort((a, b) => a - b) };
      break;
    case 'restore-option':
      if (attempt.state === 'answered' || attempt.state === 'revealed') return rejected(attempt, 'action-not-available');
      next = { ...next, discardedOptions: attempt.discardedOptions.filter(index => index !== action.optionIndex) };
      break;
    case 'add-highlight':
      if (attempt.highlights.some(highlight => highlight.id === action.highlight.id)) return rejected(attempt, 'duplicate-event');
      next = { ...next, highlights: [...attempt.highlights, action.highlight] };
      break;
    case 'remove-highlight':
      next = { ...next, highlights: attempt.highlights.filter(highlight => highlight.id !== action.highlightId) };
      break;
    case 'close':
      next = { ...next, completedAt: action.at };
      break;
  }

  const event: AttemptEvent = {
    id: action.id,
    attemptId: attempt.id,
    sequence: action.sequence,
    type: action.type,
    at: action.at,
    ...(action.monotonicAt !== undefined ? { monotonicAt: action.monotonicAt } : {}),
    payload: payloadOf(action),
  };
  return { accepted: true, attempt: next, event, progressEffect };
}
