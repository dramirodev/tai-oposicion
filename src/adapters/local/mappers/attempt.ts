import type { AttemptEvent, Highlight, QuestionAttempt } from '../../../core/domain/attempts/transitions.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { AttemptEventDto, HighlightDto, QuestionAttemptDto } from '../dto/attempt.js';

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => !!value && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isIndex = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const isTimestamp = (value: unknown): value is number => Number.isFinite(value) && Number(value) >= 0;
const failure = <Value>(reason: string): MappingResult<Value> => ({ ok: false, reason });

function highlightToDto(highlight: Highlight): HighlightDto {
  return {
    id: highlight.id,
    field: highlight.field,
    start: highlight.start,
    end: highlight.end,
    text: highlight.text,
    before: highlight.before,
    after: highlight.after,
    category: highlight.category,
    contentRevision: highlight.contentRevision,
    createdAt: highlight.createdAt,
    timing: highlight.timing,
    ...(highlight.stale !== undefined ? { stale: highlight.stale } : {}),
  };
}

function highlightToDomain(value: unknown): MappingResult<Highlight> {
  // TODO(zod): replace the handwritten boundary checks with the shared Zod schema in phase 6.
  if (!isFields(value)) return failure('highlight must be an object');
  const validField = value.field === 'statement' || (typeof value.field === 'string' && /^option:\d+$/.test(value.field));
  if (!isText(value.id) || !validField || !isIndex(value.start) || !isIndex(value.end) || value.end <= value.start) {
    return failure('invalid highlight anchor');
  }
  if (!isText(value.text) || !isText(value.before) || !isText(value.after) || !isText(value.contentRevision)) {
    return failure('invalid highlight text or revision');
  }
  if (!isTimestamp(value.createdAt) || (value.category !== 'key' && value.category !== 'doubt')) {
    return failure('invalid highlight metadata');
  }
  if (!['before-answer', 'after-answer', 'after-reveal'].includes(String(value.timing))) {
    return failure('invalid highlight timing');
  }
  if (value.stale !== undefined && typeof value.stale !== 'boolean') return failure('invalid highlight stale flag');
  return {
    ok: true,
    value: {
      id: value.id,
      field: value.field as Highlight['field'],
      start: value.start,
      end: value.end,
      text: value.text,
      before: value.before,
      after: value.after,
      category: value.category,
      contentRevision: value.contentRevision,
      createdAt: value.createdAt,
      timing: value.timing as Highlight['timing'],
      ...(value.stale !== undefined ? { stale: value.stale } : {}),
    },
  };
}

export const attemptMapper = {
  toDto(attempt: QuestionAttempt): QuestionAttemptDto {
    return {
      schemaVersion: 1,
      id: attempt.id,
      sessionId: attempt.sessionId,
      questionId: attempt.questionId,
      contentRevision: attempt.contentRevision,
      mode: attempt.mode,
      position: attempt.position,
      exposure: attempt.exposure,
      state: attempt.state,
      response: attempt.response,
      outcome: attempt.outcome,
      ...(attempt.terminalEventId !== undefined ? { terminalEventId: attempt.terminalEventId } : {}),
      confidence: attempt.confidence,
      discardedOptions: [...attempt.discardedOptions],
      highlights: attempt.highlights.map(highlightToDto),
      createdAt: attempt.createdAt,
      ...(attempt.completedAt !== undefined ? { completedAt: attempt.completedAt } : {}),
      lastSequence: attempt.lastSequence,
      appliedEventIds: [...attempt.appliedEventIds],
    };
  },

  toDomain(value: unknown): MappingResult<QuestionAttempt> {
    // TODO(zod): replace the handwritten boundary checks with the shared Zod schema in phase 6.
    if (!isFields(value)) return failure('attempt must be an object');
    if (value.schemaVersion !== 1) return failure('unsupported attempt schema version');
    if (!isText(value.id) || !isText(value.sessionId) || !isText(value.questionId) || !isText(value.contentRevision)) {
      return failure('invalid attempt identifiers');
    }
    if (value.mode !== 'practice' && value.mode !== 'simulation') return failure('invalid attempt mode');
    if (!isIndex(value.position) || !isIndex(value.exposure) || !isTimestamp(value.createdAt) || !isIndex(value.lastSequence)) {
      return failure('invalid attempt counters or time');
    }
    if (!['unseen', 'pending', 'answered', 'revealed'].includes(String(value.state))) return failure('invalid attempt state');
    if (value.response !== null && !isIndex(value.response)) return failure('invalid attempt response');
    if (value.outcome !== null && value.outcome !== 'correct' && value.outcome !== 'wrong') return failure('invalid attempt outcome');
    if (value.terminalEventId !== undefined && !isText(value.terminalEventId)) return failure('invalid terminal event id');
    let confidence: QuestionAttempt['confidence'];
    switch (value.confidence) {
      case null: confidence = null; break;
      case 'sure': confidence = 'sure'; break;
      case 'betweenTwo': confidence = 'betweenTwo'; break;
      case 'guess': confidence = 'guess'; break;
      default: return failure('invalid attempt confidence');
    }
    if (!Array.isArray(value.discardedOptions) || !value.discardedOptions.every(isIndex)) return failure('invalid discarded options');
    if (!Array.isArray(value.highlights)) return failure('invalid attempt highlights');
    const highlights: Highlight[] = [];
    for (const raw of value.highlights) {
      const mapped = highlightToDomain(raw);
      if (!mapped.ok) return failure(`invalid attempt highlight: ${mapped.reason}`);
      highlights.push(mapped.value);
    }
    if (!Array.isArray(value.appliedEventIds) || !value.appliedEventIds.every(isText)) return failure('invalid applied event ids');
    if (value.completedAt !== undefined && !isTimestamp(value.completedAt)) return failure('invalid attempt completion time');
    return {
      ok: true,
      value: {
        id: value.id,
        sessionId: value.sessionId,
        questionId: value.questionId,
        contentRevision: value.contentRevision,
        mode: value.mode,
        position: value.position,
        exposure: value.exposure,
        state: value.state as QuestionAttempt['state'],
        response: value.response,
        outcome: value.outcome,
        ...(value.terminalEventId !== undefined ? { terminalEventId: value.terminalEventId } : {}),
        confidence,
        discardedOptions: [...value.discardedOptions],
        highlights,
        createdAt: value.createdAt,
        ...(value.completedAt !== undefined ? { completedAt: value.completedAt } : {}),
        lastSequence: value.lastSequence,
        appliedEventIds: [...value.appliedEventIds],
      },
    };
  },

  eventToDto(event: AttemptEvent): AttemptEventDto {
    return {
      schemaVersion: 1,
      id: event.id,
      attemptId: event.attemptId,
      sequence: event.sequence,
      type: event.type,
      at: event.at,
      ...(event.monotonicAt !== undefined ? { monotonicAt: event.monotonicAt } : {}),
      payload: { ...event.payload },
    };
  },

  eventToDomain(value: unknown): MappingResult<AttemptEvent> {
    // TODO(zod): replace the handwritten boundary checks with the shared Zod schema in phase 6.
    if (!isFields(value) || !isFields(value.payload)) return failure('event and payload must be objects');
    if (value.schemaVersion !== 1) return failure('unsupported event schema version');
    if (!isText(value.id) || !isText(value.attemptId) || !isIndex(value.sequence) || !isTimestamp(value.at)) {
      return failure('invalid event identifiers, sequence, or time');
    }
    if (value.monotonicAt !== undefined && !isTimestamp(value.monotonicAt)) return failure('invalid monotonic time');
    const payload = value.payload;
    let domainPayload: AttemptEvent['payload'];
    switch (value.type) {
      case 'open': case 'leave': case 'mark-pending': case 'reveal': case 'pause': case 'resume': case 'close':
        domainPayload = {};
        break;
      case 'answer':
        if (!isIndex(payload.optionIndex) || (payload.outcome !== 'correct' && payload.outcome !== 'wrong')) return failure('invalid answer payload');
        domainPayload = { optionIndex: payload.optionIndex, outcome: payload.outcome };
        break;
      case 'set-confidence':
        if (payload.value !== 'sure' && payload.value !== 'betweenTwo' && payload.value !== 'guess') return failure('invalid confidence payload');
        domainPayload = { value: payload.value };
        break;
      case 'discard-option': case 'restore-option':
        if (!isIndex(payload.optionIndex)) return failure('invalid option payload');
        domainPayload = { optionIndex: payload.optionIndex };
        break;
      case 'add-highlight': {
        const mapped = highlightToDomain(payload.highlight);
        if (!mapped.ok) return failure(`invalid highlight event: ${mapped.reason}`);
        domainPayload = { highlight: mapped.value };
        break;
      }
      case 'remove-highlight':
        if (!isText(payload.highlightId)) return failure('invalid highlight id');
        domainPayload = { highlightId: payload.highlightId };
        break;
      default:
        return failure('unknown attempt event type');
    }
    return {
      ok: true,
      value: {
        id: value.id,
        attemptId: value.attemptId,
        sequence: value.sequence,
        type: value.type as AttemptEvent['type'],
        at: value.at,
        ...(value.monotonicAt !== undefined ? { monotonicAt: value.monotonicAt } : {}),
        payload: domainPayload,
      },
    };
  },
};
