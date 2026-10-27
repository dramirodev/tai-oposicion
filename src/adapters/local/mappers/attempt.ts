import type { AttemptEvent, Highlight, QuestionAttempt } from '../../../core/domain/attempts/transitions.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { AttemptEventDto, HighlightDto, QuestionAttemptDto } from '../dto/attempt.js';
import { attemptEventSchema, highlightSchema, questionAttemptSchema } from '../schemas/attempt.js';

const failure = <Value>(reason: string): MappingResult<Value> => ({ ok: false, reason });
type ParsedAttemptEvent = ReturnType<typeof attemptEventSchema.parse>;

const eventPayloadErrors: Record<string, string> = {
  answer: 'invalid answer payload',
  'set-confidence': 'invalid confidence payload',
  'discard-option': 'invalid option payload',
  'restore-option': 'invalid option payload',
  'remove-highlight': 'invalid highlight id',
};

function invalidEventReason(value: Record<string, unknown>, path: string[]): string {
  const field = path[0];
  if (field === 'schemaVersion') return 'unsupported event schema version';
  if (field === 'monotonicAt') return 'invalid monotonic time';
  if (['id', 'attemptId', 'sequence', 'at'].includes(field ?? '')) return 'invalid event identifiers, sequence, or time';
  if (field === 'type') return 'unknown attempt event type';
  if (field !== 'payload') return 'invalid event identifiers, sequence, or time';

  const eventType = value.type;
  if (eventType === 'add-highlight') {
    const payload = value.payload as Record<string, unknown>;
    const mapped = highlightToDomain(payload.highlight);
    return mapped.ok ? 'invalid highlight event: invalid highlight anchor' : `invalid highlight event: ${mapped.reason}`;
  }
  return eventPayloadErrors[String(eventType)] ?? 'invalid event identifiers, sequence, or time';
}

function invalidEventMapping(value: unknown, path: string[]): MappingResult<AttemptEvent> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('payload' in value)
    || !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
    return failure('event and payload must be objects');
  }
  return failure(invalidEventReason(value as Record<string, unknown>, path));
}

type EventPayloadMappers = {
  [Type in ParsedAttemptEvent['type']]: (event: Extract<ParsedAttemptEvent, { type: Type }>) => MappingResult<AttemptEvent['payload']>;
};

const eventPayloadMappers: EventPayloadMappers = {
  open: () => ({ ok: true, value: {} }),
  leave: () => ({ ok: true, value: {} }),
  'mark-pending': () => ({ ok: true, value: {} }),
  reveal: () => ({ ok: true, value: {} }),
  pause: () => ({ ok: true, value: {} }),
  resume: () => ({ ok: true, value: {} }),
  close: () => ({ ok: true, value: {} }),
  answer: event => ({ ok: true, value: { optionIndex: event.payload.optionIndex, outcome: event.payload.outcome } }),
  'set-confidence': event => ({ ok: true, value: { value: event.payload.value } }),
  'discard-option': event => ({ ok: true, value: { optionIndex: event.payload.optionIndex } }),
  'restore-option': event => ({ ok: true, value: { optionIndex: event.payload.optionIndex } }),
  'add-highlight': event => {
    const mapped = highlightToDomain(event.payload.highlight);
    return mapped.ok ? { ok: true, value: { highlight: mapped.value } } : failure(`invalid highlight event: ${mapped.reason}`);
  },
  'remove-highlight': event => ({ ok: true, value: { highlightId: event.payload.highlightId } }),
};

function mapEventPayload(record: ParsedAttemptEvent): MappingResult<AttemptEvent['payload']> {
  // TypeScript widens the lookup to a union of handler signatures; the shared key and record discriminator match.
  const mapper = eventPayloadMappers[record.type] as (event: ParsedAttemptEvent) => MappingResult<AttemptEvent['payload']>;
  return mapper(record);
}

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
    if (!parsed.success) return invalidEventMapping(value, parsed.error.issues[0]?.path.map(String) ?? []);
    const record = parsed.data;
    const mappedPayload = mapEventPayload(record);
    if (!mappedPayload.ok) return mappedPayload;
    return {
      ok: true,
      value: {
        id: record.id,
        attemptId: record.attemptId,
        sequence: record.sequence,
        type: record.type,
        at: record.at,
        ...(record.monotonicAt !== undefined ? { monotonicAt: record.monotonicAt } : {}),
        payload: mappedPayload.value,
      },
    };
  },
};
