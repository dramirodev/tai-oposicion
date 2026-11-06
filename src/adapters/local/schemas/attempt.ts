import { z } from 'zod';

const index = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const timestamp = z.number().finite().nonnegative();
const mode = z.enum(['practice', 'simulation']);
const outcome = z.enum(['correct', 'wrong']);
const selfAssessment = z.enum(['could-explain', 'needs-help']);
const confidence = z.enum(['sure', 'betweenTwo', 'guess']).nullable();

export const highlightSchema = z.object({
  id: z.string(),
  field: z.string().refine((field) => field === 'statement' || /^option:\d+$/.test(field)),
  start: index,
  end: index,
  text: z.string(),
  before: z.string(),
  after: z.string(),
  category: z.enum(['key', 'doubt']),
  contentRevision: z.string(),
  createdAt: timestamp,
  timing: z.enum(['before-answer', 'after-answer', 'after-reveal']),
  stale: z.boolean().optional(),
}).superRefine((highlight, context) => {
  if (highlight.end <= highlight.start) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'invalid highlight anchor' });
  }
});

export const questionAttemptSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  sessionId: z.string(),
  questionId: z.string(),
  contentRevision: z.string(),
  semanticRevision: z.string().regex(/^semantic-v1-[a-f0-9]{8}$/).optional(),
  mode,
  position: index,
  exposure: index,
  exposureKind: z.enum(['ordinary', 'immediate-retry']).optional(),
  retryOfAttemptId: z.string().optional(),
  state: z.enum(['unseen', 'pending', 'answered', 'revealed']),
  response: index.nullable(),
  outcome: outcome.nullable(),
  selfAssessment: selfAssessment.optional(),
  terminalEventId: z.string().optional(),
  confidence,
  discardedOptions: z.array(index),
  highlights: z.array(highlightSchema),
  createdAt: timestamp,
  completedAt: timestamp.optional(),
  lastSequence: index,
  appliedEventIds: z.array(z.string()),
}).superRefine((attempt, context) => {
  if (attempt.exposureKind === 'immediate-retry' && (!attempt.retryOfAttemptId || attempt.retryOfAttemptId === attempt.id)) {
    context.addIssue({ code: 'custom', path: ['retryOfAttemptId'], message: 'immediate retries must reference a different original attempt' });
  }
  if (attempt.exposureKind !== 'immediate-retry' && attempt.retryOfAttemptId !== undefined) {
    context.addIssue({ code: 'custom', path: ['exposureKind'], message: 'only immediate retries may reference an original attempt' });
  }
});

const empty = z.object({});
const answerPayload = z.object({ optionIndex: index, outcome });
const confidencePayload = z.object({ value: z.enum(['sure', 'betweenTwo', 'guess']) });
const optionPayload = z.object({ optionIndex: index });
const addHighlightPayload = z.object({ highlight: highlightSchema });
const removeHighlightPayload = z.object({ highlightId: z.string() });

const event = <Type extends string, Payload extends z.ZodType>(type: Type, payload: Payload) => z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  attemptId: z.string(),
  sequence: index,
  type: z.literal(type),
  at: timestamp,
  monotonicAt: timestamp.optional(),
  clockContext: z.string().min(1).max(128).optional(),
  payload,
});
const selfAssessmentEvent = z.object({
  schemaVersion: z.literal(2),
  id: z.string(),
  attemptId: z.string(),
  sequence: index,
  type: z.literal('self-assess'),
  at: timestamp,
  monotonicAt: timestamp.optional(),
  clockContext: z.string().min(1).max(128).optional(),
  payload: z.object({ value: selfAssessment }),
});

export const attemptEventSchema = z.discriminatedUnion('type', [
  event('open', empty), event('leave', empty), event('mark-pending', empty), event('reveal', empty),
  selfAssessmentEvent,
  event('pause', empty), event('resume', empty), event('close', empty),
  event('answer', answerPayload), event('set-confidence', confidencePayload),
  event('discard-option', optionPayload), event('restore-option', optionPayload),
  event('add-highlight', addHighlightPayload), event('remove-highlight', removeHighlightPayload),
]);
