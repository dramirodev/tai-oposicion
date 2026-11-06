export type QuestionAttemptState = 'unseen' | 'pending' | 'answered' | 'revealed';
export type AttemptMode = 'practice' | 'simulation';
export type AttemptOutcome = 'correct' | 'wrong';
export type Confidence = 'sure' | 'betweenTwo' | 'guess' | null;
export type SelfAssessment = 'could-explain' | 'needs-help';
export type ExposureKind = 'ordinary' | 'immediate-retry';
export type HighlightCategory = 'key' | 'doubt';
export type AttemptSessionStatus = 'active' | 'completed' | 'interrupted';

/** Session-level lifecycle is kept separate from each question's answer state. */
export interface QuestionAttemptSession {
  id: string;
  sourceSessionId?: string;
  activity?: 'questions' | 'attentive-reading';
  mode: AttemptMode;
  status: AttemptSessionStatus;
  startedAt: number;
  /** Optional timer metadata; absent in attempt histories created before this field existed. */
  timeLimitSeconds?: number;
  elapsedSeconds?: number;
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
  semanticRevision?: string;
  mode: AttemptMode;
  position: number;
  exposure: number;
  exposureKind?: ExposureKind;
  retryOfAttemptId?: string;
  state: QuestionAttemptState;
  response: number | null;
  outcome: AttemptOutcome | null;
  selfAssessment?: SelfAssessment;
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
  clockContext?: string;
}

export type AttemptAction =
  | (ActionMetadata & { type: 'open' | 'leave' | 'pause' | 'resume' })
  | (ActionMetadata & { type: 'mark-pending' })
  | (ActionMetadata & { type: 'answer'; optionIndex: number; outcome: AttemptOutcome })
  | (ActionMetadata & { type: 'reveal' })
  | (ActionMetadata & { type: 'self-assess'; value: SelfAssessment })
  | (ActionMetadata & { type: 'set-confidence'; value: Exclude<Confidence, null> })
  | (ActionMetadata & { type: 'discard-option'; optionIndex: number })
  | (ActionMetadata & { type: 'restore-option'; optionIndex: number })
  | (ActionMetadata & { type: 'add-highlight'; highlight: Highlight })
  | (ActionMetadata & { type: 'remove-highlight'; highlightId: string })
  | (ActionMetadata & { type: 'close'; at: number });

export type AttemptIntent = AttemptAction extends infer Action
  ? Action extends AttemptAction ? Omit<Action, 'id' | 'sequence' | 'at' | 'monotonicAt' | 'clockContext'> : never
  : never;

export type AttemptEventType = AttemptAction['type'];
export interface AttemptEvent {
  id: string;
  attemptId: string;
  sequence: number;
  type: AttemptEventType;
  at: number;
  monotonicAt?: number;
  clockContext?: string;
  payload: AttemptActionPayload;
}

type AttemptActionPayload = AttemptAction extends infer Action
  ? Action extends AttemptAction ? Omit<Action, 'id' | 'sequence' | 'at' | 'monotonicAt' | 'clockContext' | 'type'> : never
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

type PayloadMapper<Type extends AttemptAction['type']> = (action: Extract<AttemptAction, { type: Type }>) => AttemptActionPayload;
type PayloadMappers = { [Type in AttemptAction['type']]: PayloadMapper<Type> };
const payloadMappers: PayloadMappers = {
  open: () => ({}), leave: () => ({}), 'mark-pending': () => ({}), reveal: () => ({}),
  pause: () => ({}), resume: () => ({}), close: () => ({}),
  answer: action => ({ optionIndex: action.optionIndex, outcome: action.outcome }),
  'self-assess': action => ({ value: action.value }),
  'set-confidence': action => ({ value: action.value }),
  'discard-option': action => ({ optionIndex: action.optionIndex }),
  'restore-option': action => ({ optionIndex: action.optionIndex }),
  'add-highlight': action => ({ highlight: action.highlight }),
  'remove-highlight': action => ({ highlightId: action.highlightId }),
};

function payloadOf(action: AttemptAction): AttemptActionPayload {
  // TypeScript widens the lookup to a union of handler signatures; the shared key and action discriminator match.
  const mapper = payloadMappers[action.type] as (action: AttemptAction) => AttemptActionPayload;
  return mapper(action);
}

type ActionApplication = { attempt: QuestionAttempt; progressEffect: ProgressEffect } | { reason: RejectionReason };
type ActionHandler<Type extends AttemptAction['type']> = (
  attempt: QuestionAttempt,
  next: QuestionAttempt,
  action: Extract<AttemptAction, { type: Type }>,
) => ActionApplication;
type ActionHandlers = { [Type in AttemptAction['type']]: ActionHandler<Type> };

const acceptedAction = (attempt: QuestionAttempt, progressEffect: ProgressEffect = 'none'): ActionApplication => ({ attempt, progressEffect });
const rejectedAction = (reason: RejectionReason): ActionApplication => ({ reason });

const actionHandlers: ActionHandlers = {
  open: (_attempt, next) => acceptedAction(next),
  leave: (_attempt, next) => acceptedAction(next),
  pause: (_attempt, next) => acceptedAction(next),
  resume: (_attempt, next) => acceptedAction(next),
  'mark-pending': (attempt, next) => attempt.state === 'revealed' || (attempt.state === 'answered' && attempt.mode === 'practice')
    ? rejectedAction('action-not-available')
    : acceptedAction({ ...next, state: 'pending', response: null, outcome: null }),
  answer: (attempt, next, action) => attempt.state === 'revealed' || (attempt.state === 'answered' && attempt.mode === 'practice')
    ? rejectedAction('practice-answer-locked')
    : acceptedAction({ ...next, state: 'answered', response: action.optionIndex, outcome: action.outcome, terminalEventId: action.id },
      attempt.exposureKind === 'immediate-retry' ? 'none' : attempt.mode === 'practice' ? 'record-practice-answer' : 'defer-to-session-finish'),
  reveal: (attempt, next, action) => attempt.mode !== 'practice' || attempt.state !== 'pending'
    ? rejectedAction('solution-not-available')
    : acceptedAction({ ...next, state: 'revealed', response: null, outcome: null, terminalEventId: action.id }),
  'self-assess': (attempt, next, action) => attempt.mode !== 'practice' || (attempt.state !== 'answered' && attempt.state !== 'revealed')
    ? rejectedAction('action-not-available')
    : acceptedAction({ ...next, selfAssessment: action.value }),
  'set-confidence': (attempt, next, action) => attempt.state === 'answered' || attempt.state === 'revealed'
    ? rejectedAction('action-not-available')
    : acceptedAction({ ...next, confidence: action.value }),
  'discard-option': (attempt, next, action) => attempt.state === 'answered' || attempt.state === 'revealed'
    ? rejectedAction('action-not-available')
    : acceptedAction({ ...next, discardedOptions: [...new Set([...attempt.discardedOptions, action.optionIndex])].sort((leftOptionIndex, rightOptionIndex) => leftOptionIndex - rightOptionIndex) }),
  'restore-option': (attempt, next, action) => attempt.state === 'answered' || attempt.state === 'revealed'
    ? rejectedAction('action-not-available')
    : acceptedAction({ ...next, discardedOptions: attempt.discardedOptions.filter(index => index !== action.optionIndex) }),
  'add-highlight': (attempt, next, action) => attempt.highlights.some(highlight => highlight.id === action.highlight.id)
    ? rejectedAction('duplicate-event')
    : acceptedAction({ ...next, highlights: [...attempt.highlights, action.highlight] }),
  'remove-highlight': (attempt, next, action) => acceptedAction({ ...next, highlights: attempt.highlights.filter(highlight => highlight.id !== action.highlightId) }),
  close: (_attempt, next, action) => acceptedAction({ ...next, completedAt: action.at }),
};

function applyAction(attempt: QuestionAttempt, next: QuestionAttempt, action: AttemptAction): ActionApplication {
  const handler = actionHandlers[action.type] as ActionHandler<AttemptAction['type']>;
  return handler(attempt, next, action);
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
  const result = applyAction(attempt, next, action);
  if ('reason' in result) return rejected(attempt, result.reason);
  next = result.attempt;

  const event: AttemptEvent = {
    id: action.id,
    attemptId: attempt.id,
    sequence: action.sequence,
    type: action.type,
    at: action.at,
    ...(action.monotonicAt !== undefined ? { monotonicAt: action.monotonicAt } : {}),
    ...(action.clockContext ? { clockContext: action.clockContext } : {}),
    payload: payloadOf(action),
  };
  return { accepted: true, attempt: next, event, progressEffect: result.progressEffect };
}
