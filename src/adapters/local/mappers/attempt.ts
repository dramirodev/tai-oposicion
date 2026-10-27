import type { AttemptEvent, Highlight, QuestionAttempt } from '../../../core/domain/attempts/transitions.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { AttemptEventDto, HighlightDto, QuestionAttemptDto } from '../dto/attempt.js';
import { attemptEventSchema, highlightSchema, questionAttemptSchema } from '../schemas/attempt.js';

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
  const parsed = highlightSchema.safeParse(value);
  if (!parsed.success) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return failure('highlight must be an object');
    const path = String(parsed.error.issues[0]?.path[0]);
    const reason = path === 'text' || path === 'before' || path === 'after' || path === 'contentRevision'
      ? 'invalid highlight text or revision'
      : path === 'category' || path === 'createdAt' ? 'invalid highlight metadata'
        : path === 'timing' ? 'invalid highlight timing'
          : path === 'stale' ? 'invalid highlight stale flag' : 'invalid highlight anchor';
    return failure(reason);
  }
  const highlight = parsed.data;
  return {
    ok: true,
    value: {
      id: highlight.id,
      field: highlight.field as Highlight['field'],
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
    const parsed = questionAttemptSchema.safeParse(value);
    if (!parsed.success) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return failure('attempt must be an object');
      const issue = parsed.error.issues[0];
      const field = String(issue?.path[0]);
      if (field === 'highlights' && Array.isArray((value as Record<string, unknown>).highlights)) {
        for (const raw of (value as Record<string, unknown>).highlights as unknown[]) {
          const mapped = highlightToDomain(raw);
          if (!mapped.ok) return failure(`invalid attempt highlight: ${mapped.reason}`);
        }
      }
      const reason = issue?.code === 'invalid_value' && field === 'schemaVersion' ? 'unsupported attempt schema version'
        : ({ id: 'invalid attempt identifiers', sessionId: 'invalid attempt identifiers', questionId: 'invalid attempt identifiers', contentRevision: 'invalid attempt identifiers', mode: 'invalid attempt mode',
          position: 'invalid attempt counters or time', exposure: 'invalid attempt counters or time', createdAt: 'invalid attempt counters or time', lastSequence: 'invalid attempt counters or time', state: 'invalid attempt state', response: 'invalid attempt response', outcome: 'invalid attempt outcome', terminalEventId: 'invalid terminal event id', confidence: 'invalid attempt confidence', discardedOptions: 'invalid discarded options', highlights: 'invalid attempt highlights', appliedEventIds: 'invalid applied event ids', completedAt: 'invalid attempt completion time' } as Record<string, string>)[field] ?? 'invalid attempt highlights';
      return failure(reason);
    }
    const attempt = parsed.data;
    const highlights: Highlight[] = [];
    for (const raw of attempt.highlights) {
      const mapped = highlightToDomain(raw);
      if (!mapped.ok) return failure(`invalid attempt highlight: ${mapped.reason}`);
      highlights.push(mapped.value);
    }
    return {
      ok: true,
      value: {
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
        highlights,
        createdAt: attempt.createdAt,
        ...(attempt.completedAt !== undefined ? { completedAt: attempt.completedAt } : {}),
        lastSequence: attempt.lastSequence,
        appliedEventIds: [...attempt.appliedEventIds],
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
    const parsed = attemptEventSchema.safeParse(value);
    if (!parsed.success) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !('payload' in value)
        || !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
        return failure('event and payload must be objects');
      }
      const issue = parsed.error.issues[0];
      const path = issue?.path.map(String) ?? [];
      const eventType = (value as Record<string, unknown>).type;
      const reason = path[0] === 'schemaVersion' ? 'unsupported event schema version'
        : path[0] === 'monotonicAt' ? 'invalid monotonic time'
          : ['id', 'attemptId', 'sequence', 'at'].includes(path[0] ?? '') ? 'invalid event identifiers, sequence, or time'
            : path[0] === 'type' ? 'unknown attempt event type'
              : path[0] === 'payload' && eventType === 'answer' ? 'invalid answer payload'
                : path[0] === 'payload' && eventType === 'set-confidence' ? 'invalid confidence payload'
                  : path[0] === 'payload' && (eventType === 'discard-option' || eventType === 'restore-option') ? 'invalid option payload'
                    : path[0] === 'payload' && eventType === 'remove-highlight' ? 'invalid highlight id'
                      : path[0] === 'payload' && eventType === 'add-highlight' ? (() => {
                        const raw = (value as Record<string, unknown>).payload as Record<string, unknown>;
                        const mapped = highlightToDomain(raw.highlight);
                        return mapped.ok ? 'invalid highlight event: invalid highlight anchor' : `invalid highlight event: ${mapped.reason}`;
                      })()
                        : 'invalid event identifiers, sequence, or time';
      return failure(reason);
    }
    const record = parsed.data;
    let domainPayload: AttemptEvent['payload'];
    switch (record.type) {
      case 'open': case 'leave': case 'mark-pending': case 'reveal': case 'pause': case 'resume': case 'close':
        domainPayload = {};
        break;
      case 'answer':
        domainPayload = { optionIndex: record.payload.optionIndex, outcome: record.payload.outcome };
        break;
      case 'set-confidence':
        domainPayload = { value: record.payload.value };
        break;
      case 'discard-option': case 'restore-option':
        domainPayload = { optionIndex: record.payload.optionIndex };
        break;
      case 'add-highlight': {
        const mapped = highlightToDomain(record.payload.highlight);
        if (!mapped.ok) return failure(`invalid highlight event: ${mapped.reason}`);
        domainPayload = { highlight: mapped.value };
        break;
      }
      case 'remove-highlight':
        domainPayload = { highlightId: record.payload.highlightId };
        break;
    }
    return {
      ok: true,
      value: {
        id: record.id,
        attemptId: record.attemptId,
        sequence: record.sequence,
        type: record.type,
        at: record.at,
        ...(record.monotonicAt !== undefined ? { monotonicAt: record.monotonicAt } : {}),
        payload: domainPayload,
      },
    };
  },
};
