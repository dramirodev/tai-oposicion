import type { Question } from '../entities.js';
import type { CodeExplanation } from '../explanations.js';
import { computeActiveTime } from './active-time.js';
import type { AttemptArchive } from './archive.js';
import { questionContentRevision } from './highlights.js';
import type { AttemptEvent, QuestionAttempt, QuestionAttemptSession } from './transitions.js';
import type { AttemptStrategyReport } from './strategy-report.js';

export interface AiStudyExportFilters {
  from: number;
  to: number;
  modes: readonly ('practice' | 'simulation')[];
  sessionIds: readonly string[];
}

export interface AiStudyExportQuestion {
  questionId: string;
  attemptRevisions: string[];
  contentStatus: 'current' | 'revision-mismatch' | 'multiple-revisions' | 'unavailable';
  explanationStatus: 'reviewed-current' | 'not-included' | 'unavailable';
  currentRevision?: string;
  content: null | {
    topicId: string;
    origin: Question['origin'];
    statement: string;
    context?: string;
    options: string[];
    correctIndex: number;
    kind?: string;
    difficulty?: number | null;
    note?: string;
    year?: string;
    citation?: string;
    assumptionId?: string;
    family?: string;
    source?: Question['source'];
    flags: { provisional?: number; expiresAfter?: number; verificationStatus?: number; nonScoring?: number };
  };
}

export interface AiStudyExportAttempt {
  id: string;
  sessionId: string;
  questionId: string;
  contentRevision: string;
  mode: QuestionAttempt['mode'];
  position: number;
  exposure: number;
  state: QuestionAttempt['state'];
  response: number | null;
  outcome: QuestionAttempt['outcome'];
  confidence: QuestionAttempt['confidence'];
  discardedOptions: number[];
  highlights: Array<Omit<QuestionAttempt['highlights'][number], 'id'> & { id: string }>;
  createdAt: number;
  completedAt?: number;
  activeTime: { milliseconds: number; quality: 'complete' | 'partial' | 'unavailable' };
  terminalEventId?: string;
  appliedEventIds: string[];
}

export interface AiStudyExportEvent {
  id: string;
  attemptId: string;
  sequence: number;
  type: AttemptEvent['type'];
  at: number;
  monotonicAt?: number;
  payload: AttemptEvent['payload'];
}

export interface AiStudyExportPart {
  fileName: string;
  partNumber: number;
  sessions: Array<Omit<QuestionAttemptSession, 'id' | 'sourceSessionId'> & { id: string }>;
  attempts: AiStudyExportAttempt[];
  events: AiStudyExportEvent[];
  questions: AiStudyExportQuestion[];
  explanations: CodeExplanation[];
}

export interface AiStudyExportManifestPart {
  fileName: string;
  partNumber: number;
  sessionCount: number;
  attemptCount: number;
  eventCount: number;
  sizeBytes: number;
  oversized: boolean;
}

export interface AiStudyExport {
  createdAt: number;
  filters: { from: number; to: number; modes: Array<'practice' | 'simulation'>; sessionCount: number };
  report: AttemptStrategyReport;
  manifest: { format: 'tai-study-ai-export'; schemaVersion: 1; partCount: number; totalSizeBytes: number; parts: AiStudyExportManifestPart[] };
  parts: AiStudyExportPart[];
}

export interface BuildAiStudyExportInput {
  archive: AttemptArchive;
  report: AttemptStrategyReport;
  questions: ReadonlyMap<string, Question>;
  explanations: ReadonlyMap<string, CodeExplanation>;
  generatedAt: number;
  filters: AiStudyExportFilters;
  maxPartBytes: number;
}

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function utf8Length(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) || 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function currentContent(question: Question): AiStudyExportQuestion['content'] {
  return {
    topicId: question.topicId,
    origin: question.origin,
    statement: question.statement,
    ...(question.context !== undefined ? { context: question.context } : {}),
    options: [...question.options],
    correctIndex: question.correctIndex,
    ...(question.kind !== undefined ? { kind: question.kind } : {}),
    ...(question.difficulty !== undefined ? { difficulty: question.difficulty } : {}),
    ...(question.note !== undefined ? { note: question.note } : {}),
    ...(question.year !== undefined ? { year: question.year } : {}),
    ...(question.citation !== undefined ? { citation: question.citation } : {}),
    ...(question.assumptionId !== undefined ? { assumptionId: question.assumptionId } : {}),
    ...(question.family !== undefined ? { family: question.family } : {}),
    ...(question.source ? { source: { ...question.source } } : {}),
    flags: {
      ...(question.provisional !== undefined ? { provisional: question.provisional } : {}),
      ...(question.expiresAfter !== undefined ? { expiresAfter: question.expiresAfter } : {}),
      ...(question.verificationStatus !== undefined ? { verificationStatus: question.verificationStatus } : {}),
      ...(question.nonScoring !== undefined ? { nonScoring: question.nonScoring } : {}),
    },
  };
}

function questionReference(
  questionId: string,
  attempts: readonly QuestionAttempt[],
  question: Question | undefined,
  explanation: CodeExplanation | undefined,
): AiStudyExportQuestion {
  const explanationStatus = !question ? 'unavailable'
    : explanation?.editorialStatus === 'reviewed' && explanation.contentRevision === questionContentRevision(question.statement, question.options)
      ? 'reviewed-current' : 'not-included';
  const attemptRevisions = [...new Set(attempts.map(attempt => attempt.contentRevision))].sort(compare);
  if (!question) return { questionId, attemptRevisions, contentStatus: 'unavailable', explanationStatus, content: null };
  const currentRevision = questionContentRevision(question.statement, question.options);
  if (attemptRevisions.length !== 1) {
    return { questionId, attemptRevisions, contentStatus: 'multiple-revisions', explanationStatus, currentRevision, content: null };
  }
  if (attemptRevisions[0] !== currentRevision) {
    return { questionId, attemptRevisions, contentStatus: 'revision-mismatch', explanationStatus, currentRevision, content: null };
  }
  return { questionId, attemptRevisions, contentStatus: 'current', explanationStatus, currentRevision, content: currentContent(question) };
}

function mapEvent(event: AttemptEvent, attemptRef: string, eventRef: string, highlightRefs: ReadonlyMap<string, string>): AiStudyExportEvent {
  let payload: AttemptEvent['payload'] = event.payload;
  if (event.type === 'add-highlight' && 'highlight' in event.payload) {
    payload = { highlight: { ...event.payload.highlight, id: highlightRefs.get(event.payload.highlight.id) || 'highlight-unknown' } };
  }
  if (event.type === 'remove-highlight' && 'highlightId' in event.payload) {
    payload = { highlightId: highlightRefs.get(event.payload.highlightId) || 'highlight-unknown' };
  }
  return {
    id: eventRef,
    attemptId: attemptRef,
    sequence: event.sequence,
    type: event.type,
    at: event.at,
    ...(event.monotonicAt !== undefined ? { monotonicAt: event.monotonicAt } : {}),
    payload,
  };
}

function mapPart(
  sessions: readonly QuestionAttemptSession[],
  attempts: readonly QuestionAttempt[],
  events: readonly AttemptEvent[],
  questions: ReadonlyMap<string, Question>,
  explanations: ReadonlyMap<string, CodeExplanation>,
  partNumber: number,
): AiStudyExportPart {
  const partPrefix = `part-${String(partNumber).padStart(3, '0')}`;
  const sessionRefs = new Map(sessions.map((session, index) => [session.id, `${partPrefix}-session-${String(index + 1).padStart(3, '0')}`]));
  const orderedAttempts = [...attempts].sort((left, right) => left.position - right.position || compare(left.id, right.id));
  const attemptRefs = new Map(orderedAttempts.map((attempt, index) => [attempt.id, `${partPrefix}-attempt-${String(index + 1).padStart(6, '0')}`]));
  const orderedEvents = [...events].sort((left, right) => compare(left.attemptId, right.attemptId) || left.sequence - right.sequence || compare(left.id, right.id));
  const eventRefs = new Map(orderedEvents.map((event, index) => [event.id, `${partPrefix}-event-${String(index + 1).padStart(6, '0')}`]));
  const highlightIds = new Set(orderedAttempts.flatMap(attempt => attempt.highlights.map(highlight => highlight.id)));
  for (const event of events) {
    if (event.type === 'add-highlight' && 'highlight' in event.payload) highlightIds.add(event.payload.highlight.id);
    if (event.type === 'remove-highlight' && 'highlightId' in event.payload) highlightIds.add(event.payload.highlightId);
  }
  const highlightRefs = new Map([...highlightIds].sort(compare).map((id, index) => [id, `${partPrefix}-highlight-${String(index + 1).padStart(6, '0')}`]));
  const mappedAttempts = orderedAttempts.map(attempt => ({
    id: attemptRefs.get(attempt.id)!,
    sessionId: sessionRefs.get(attempt.sessionId)!,
    questionId: attempt.questionId,
    contentRevision: attempt.contentRevision,
    mode: attempt.mode,
    position: attempt.position,
    exposure: attempt.exposure,
    state: attempt.state,
    response: attempt.response,
    outcome: attempt.outcome,
    confidence: attempt.confidence,
    discardedOptions: [...attempt.discardedOptions],
    highlights: attempt.highlights.map(highlight => ({ ...highlight, id: highlightRefs.get(highlight.id)! })),
    createdAt: attempt.createdAt,
    ...(attempt.completedAt !== undefined ? { completedAt: attempt.completedAt } : {}),
    activeTime: computeActiveTime(events.filter(event => event.attemptId === attempt.id)),
    ...(attempt.terminalEventId ? { terminalEventId: eventRefs.get(attempt.terminalEventId) } : {}),
    appliedEventIds: attempt.appliedEventIds.map(id => eventRefs.get(id)).filter((id): id is string => id !== undefined),
  }));
  const usedQuestionIds = [...new Set(orderedAttempts.map(attempt => attempt.questionId))].sort(compare);
  const questionRows = usedQuestionIds.map(questionId => questionReference(
    questionId,
    orderedAttempts.filter(attempt => attempt.questionId === questionId),
    questions.get(questionId),
    explanations.get(questionId),
  ));
  const reviewedExplanations = usedQuestionIds.flatMap(questionId => {
    const explanation = explanations.get(questionId);
    const question = questions.get(questionId);
    if (!explanation || explanation.editorialStatus !== 'reviewed' || !question) return [];
    if (explanation.contentRevision !== questionContentRevision(question.statement, question.options)) return [];
    return [{ ...explanation, sources: explanation.sources.map(source => ({ ...source })) }];
  });
  return {
    fileName: `tai-estudio-parte-${String(partNumber).padStart(3, '0')}.json`,
    partNumber,
    sessions: [...sessions].sort((left, right) => left.startedAt - right.startedAt || compare(left.id, right.id)).map(session => ({
      id: sessionRefs.get(session.id)!, mode: session.mode, status: session.status, startedAt: session.startedAt,
      ...(session.timeLimitSeconds !== undefined ? { timeLimitSeconds: session.timeLimitSeconds } : {}),
      ...(session.elapsedSeconds !== undefined ? { elapsedSeconds: session.elapsedSeconds } : {}),
      ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}), lastSequence: session.lastSequence,
    })),
    attempts: mappedAttempts,
    events: orderedEvents.map(event => mapEvent(event, attemptRefs.get(event.attemptId)!, eventRefs.get(event.id)!, highlightRefs)),
    questions: questionRows,
    explanations: reviewedExplanations,
  };
}

/** Builds a deterministic, account-free export and groups complete sessions without truncating records. */
export function buildAiStudyExport(input: BuildAiStudyExportInput): AiStudyExport {
  const selected = new Set(input.filters.sessionIds);
  const modes = [...new Set(input.filters.modes)].sort(compare) as Array<'practice' | 'simulation'>;
  const sessions = input.archive.sessions.filter(session => selected.has(session.id)
    && modes.includes(session.mode) && session.status === 'completed'
    && session.startedAt >= input.filters.from && session.startedAt < input.filters.to)
    .sort((left, right) => left.startedAt - right.startedAt || compare(left.id, right.id));
  const sessionIds = new Set(sessions.map(session => session.id));
  const attempts = input.archive.attempts.filter(attempt => sessionIds.has(attempt.sessionId));
  const attemptIds = new Set(attempts.map(attempt => attempt.id));
  const events = input.archive.events.filter(event => attemptIds.has(event.attemptId));
  const groups: QuestionAttemptSession[][] = [];
  let current: QuestionAttemptSession[] = [];
  for (const session of sessions) {
    const candidate = [...current, session];
    const candidateAttempts = attempts.filter(attempt => candidate.some(item => item.id === attempt.sessionId));
    const candidateAttemptIds = new Set(candidateAttempts.map(attempt => attempt.id));
    const candidateEvents = events.filter(event => candidateAttemptIds.has(event.attemptId));
    const candidatePart = mapPart(candidate, candidateAttempts, candidateEvents, input.questions, input.explanations, 1);
    if (current.length && utf8Length(JSON.stringify(candidatePart)) > input.maxPartBytes) {
      groups.push(current);
      current = [session];
    } else current = candidate;
  }
  if (current.length || !groups.length) groups.push(current);
  const parts = groups.map((group, index) => {
    const ids = new Set(group.map(session => session.id));
    const partAttempts = attempts.filter(attempt => ids.has(attempt.sessionId));
    const partAttemptIds = new Set(partAttempts.map(attempt => attempt.id));
    const partEvents = events.filter(event => partAttemptIds.has(event.attemptId));
    return mapPart(group, partAttempts, partEvents, input.questions, input.explanations, index + 1);
  });
  const manifests = parts.map(part => {
    const sizeBytes = utf8Length(JSON.stringify(part));
    return {
      fileName: part.fileName, partNumber: part.partNumber, sessionCount: part.sessions.length,
      attemptCount: part.attempts.length, eventCount: part.events.length, sizeBytes,
      oversized: sizeBytes > input.maxPartBytes,
    };
  });
  return {
    createdAt: input.generatedAt,
    filters: { from: input.filters.from, to: input.filters.to, modes, sessionCount: sessions.length },
    report: input.report,
    manifest: {
      format: 'tai-study-ai-export', schemaVersion: 1, partCount: parts.length,
      totalSizeBytes: manifests.reduce((sum, part) => sum + part.sizeBytes, 0), parts: manifests,
    },
    parts,
  };
}
