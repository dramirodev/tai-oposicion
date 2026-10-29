import type { BankRepository } from '../../ports/BankRepository.js';
import type { ExplanationRepository } from '../../ports/ExplanationRepository.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import type { AttemptMode, QuestionAttemptSession } from '../../domain/attempts/transitions.js';
import type { AttemptArchive } from '../../domain/attempts/archive.js';
import { analyzeAttemptStrategy } from '../../domain/attempts/strategy-report.js';
import { buildAiStudyExport, type AiStudyExport, type AiStudyExportFilters } from '../../domain/attempts/ai-study-export.js';
import { questionContentRevision } from '../../domain/attempts/highlights.js';
import { exportAttemptArchive } from './export-attempt-archive.js';

export interface AiStudyExportSessionChoice {
  id: string;
  mode: AttemptMode;
  startedAt: number;
  endedAt?: number;
  attemptCount: number;
}

export interface PrepareAiStudyExportInput {
  repository: AttemptRepository;
  bank: BankRepository;
  explanations: ExplanationRepository;
  scope: string;
  generatedAt: number;
  filters: AiStudyExportFilters;
  maxPartBytes: number;
  reward: number;
  penalty: number;
  blankValue: number;
}

function selectedSessions(archive: AttemptArchive, filters: AiStudyExportFilters): QuestionAttemptSession[] {
  const ids = new Set(filters.sessionIds);
  const modes = new Set(filters.modes);
  return archive.sessions.filter(session => ids.has(session.id) && modes.has(session.mode)
    && session.status === 'completed' && session.startedAt >= filters.from && session.startedAt < filters.to);
}

export async function listAiStudyExportSessions(input: {
  repository: AttemptRepository;
  scope: string;
  from: number;
  to: number;
  modes: readonly AttemptMode[];
}): Promise<AiStudyExportSessionChoice[]> {
  const choices: AiStudyExportSessionChoice[] = [];
  const attemptCounts = new Map<string, number>();
  const modes = new Set(input.modes);
  let cursor: string | undefined;
  do {
    const page = await input.repository.getScopePage(input.scope, cursor, 100);
    for (const attempt of page.attempts) attemptCounts.set(attempt.sessionId, (attemptCounts.get(attempt.sessionId) || 0) + 1);
    cursor = page.nextCursor || undefined;
  } while (cursor);
  for (const sessionId of attemptCounts.keys()) {
    const session = await input.repository.getSession(input.scope, sessionId);
    if (!session || session.status !== 'completed' || session.startedAt < input.from || session.startedAt >= input.to || !modes.has(session.mode)) continue;
    choices.push({ id: session.id, mode: session.mode, startedAt: session.startedAt, ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}), attemptCount: attemptCounts.get(session.id) || 0 });
  }
  return choices.sort((left, right) => left.startedAt - right.startedAt || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

export async function prepareAiStudyExport(input: PrepareAiStudyExportInput): Promise<AiStudyExport> {
  const archive = await exportAttemptArchive(input.repository, input.scope, input.generatedAt);
  const sessions = selectedSessions(archive, input.filters);
  const sessionIds = new Set(sessions.map(session => session.id));
  const attempts = archive.attempts.filter(attempt => sessionIds.has(attempt.sessionId));
  const attemptIds = new Set(attempts.map(attempt => attempt.id));
  const events = archive.events.filter(event => attemptIds.has(event.attemptId));
  const questionIds = [...new Set(attempts.map(attempt => attempt.questionId))];
  const questionRows = await Promise.all(questionIds.map(async id => [id, await input.bank.getQuestion(id)] as const));
  const questions = new Map(questionRows.filter((row): row is readonly [string, NonNullable<typeof row[1]>] => row[1] !== undefined));
  const explanationRows = await Promise.all([...questions].map(async ([id, question]) => {
    const currentRevision = questionContentRevision(question.statement, question.options);
    const matchingAttempts = attempts.filter(attempt => attempt.questionId === id && attempt.contentRevision === currentRevision);
    if (!matchingAttempts.length) return [id, undefined] as const;
    try { return [id, await input.explanations.getExplanation(id)] as const; }
    catch { return [id, undefined] as const; }
  }));
  const explanations = new Map(explanationRows.filter((row): row is readonly [string, NonNullable<typeof row[1]>] => row[1] !== undefined));
  const filteredArchive = { createdAt: archive.createdAt, sessions, attempts, events };
  const report = analyzeAttemptStrategy({
    sessions, attempts, events, questions, from: input.filters.from, to: input.filters.to,
    reward: input.reward, penalty: input.penalty, blankValue: input.blankValue,
  });
  return buildAiStudyExport({
    archive: filteredArchive,
    report,
    questions,
    explanations,
    generatedAt: input.generatedAt,
    filters: { ...input.filters, sessionIds: sessions.map(session => session.id) },
    maxPartBytes: input.maxPartBytes,
  });
}
