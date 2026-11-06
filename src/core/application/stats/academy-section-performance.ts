import { parsePublishedSectionManifest, resolvePublishedSectionLink } from '../../domain/academy-section-evidence.js';
import type { AcademyCurriculumSection } from '../../domain/academy-curriculum-types.js';
import type { Question } from '../../domain/entities.js';
import type { MetricsQuery } from './metrics-query.js';
import type { QuestionAttempt, QuestionAttemptSession, AttemptEvent } from '../../domain/attempts/transitions.js';

export interface AcademySectionPerformance {
  sectionId: string;
  topicId: string;
  title: string;
  materialPath: string;
  sourceHash: string;
  manifestRevision: string;
  linkedQuestions: number;
  observedDistinct?: number;
  latestWrongDistinct?: number;
  lastPracticeAt?: number | null;
  errorQuestions?: { practice: readonly string[]; simulation: readonly string[] };
  practice: AcademySectionAttemptSummary;
  simulation: AcademySectionAttemptSummary;
}

export interface AcademySectionAttemptSummary {
  observedQuestions: number;
  latestCorrect: number;
  latestWrong: number;
  answeredAttempts: number;
  immediateRetryAttempts: number;
  confidence: { sure: number; betweenTwo: number; guess: number; notRecorded: number };
  selfAssessment: { couldExplain: number; needsHelp: number; notRecorded: number };
}

export type AcademySectionPerformanceResult =
  | { status: 'invalid-manifest'; rows: readonly [] }
  | { status: 'no-approved-links'; rows: readonly [] }
  | { status: 'no-current-links'; rows: readonly []; staleLinks: number }
  | { status: 'ready'; rows: readonly AcademySectionPerformance[]; staleLinks: number };

interface MutableAttemptSummary extends AcademySectionAttemptSummary {
  latestByQuestion: Map<string, { at: number; id: string; outcome: 'correct' | 'wrong'; confidence: QuestionAttempt['confidence']; selfAssessment?: QuestionAttempt['selfAssessment'] }>;
}

interface MutableSectionPerformance extends Omit<AcademySectionPerformance, 'practice' | 'simulation'> {
  practice: MutableAttemptSummary;
  simulation: MutableAttemptSummary;
}

function emptyAttemptSummary(): MutableAttemptSummary {
  return {
    observedQuestions: 0, latestCorrect: 0, latestWrong: 0, answeredAttempts: 0, immediateRetryAttempts: 0,
    confidence: { sure: 0, betweenTwo: 0, guess: 0, notRecorded: 0 },
    selfAssessment: { couldExplain: 0, needsHelp: 0, notRecorded: 0 }, latestByQuestion: new Map(),
  };
}

function toPublicAttemptSummary(summary: MutableAttemptSummary): AcademySectionAttemptSummary {
  return {
    observedQuestions: summary.observedQuestions,
    latestCorrect: summary.latestCorrect,
    latestWrong: summary.latestWrong,
    answeredAttempts: summary.answeredAttempts,
    immediateRetryAttempts: summary.immediateRetryAttempts,
    confidence: { ...summary.confidence },
    selfAssessment: { ...summary.selfAssessment },
  };
}

/**
 * Summarizes objective results only for currently approved, exact-revision links.
 * Immediate retries remain visible as practice volume but never improve the
 * per-question latest ordinary result. This is an observed question sample,
 * not section mastery or delayed retention.
 */
export function summarizeAcademySectionPerformance(input: {
  manifest: unknown;
  questions: readonly Question[];
  sections: readonly AcademyCurriculumSection[];
  availableTestMaterials: ReadonlyMap<string, { topicId: string; sourceHash: string }>;
  attempts: readonly QuestionAttempt[];
  sessions?: readonly QuestionAttemptSession[];
  events?: readonly AttemptEvent[];
  query?: MetricsQuery;
}): AcademySectionPerformanceResult {
  const manifest = parsePublishedSectionManifest(input.manifest);
  if (!manifest) return { status: 'invalid-manifest', rows: [] };
  if (manifest.links.length === 0) return { status: 'no-approved-links', rows: [] };

  const questions = new Map(input.questions.map(question => [question.id, question]));
  const sections = new Map(input.sections.map(section => [section.id, section]));
  const byQuestion = new Map<string, AcademyCurriculumSection>();
  let staleLinks = 0;
  for (const link of manifest.links) {
    const question = questions.get(link.questionId);
    const section = sections.get(link.sectionId);
    const resolved = question ? resolvePublishedSectionLink({ link, question, section, availableTestMaterials: input.availableTestMaterials }) : undefined;
    if (!question || !resolved) { staleLinks++; continue; }
    byQuestion.set(`${link.questionId}\u0000${link.contentRevision}`, resolved);
  }
  if (byQuestion.size === 0) return { status: 'no-current-links', rows: [], staleLinks };

  const sessionById = new Map(input.sessions?.map(session => [session.id, session]));
  const terminalDates = new Map(input.events?.map(event => [event.id, event.at]));
  const semanticByQuestion = new Map(manifest.links.map(link => [link.questionId, link.semanticRevision]));
  const seenAttempts = new Set<string>();
  const attemptsByQuestion = new Map<string, QuestionAttempt[]>();
  for (const attempt of input.attempts) {
    if (seenAttempts.has(attempt.id)) continue;
    seenAttempts.add(attempt.id);
    if (!attempt.semanticRevision || attempt.semanticRevision !== semanticByQuestion.get(attempt.questionId)) continue;
    const question = questions.get(attempt.questionId);
    const session = sessionById.get(attempt.sessionId);
    if (input.sessions && attempt.mode === 'simulation' && session?.status !== 'completed') continue;
    const at = (attempt.terminalEventId ? terminalDates.get(attempt.terminalEventId) : undefined) ?? attempt.completedAt ?? attempt.createdAt;
    if (input.query && (at < input.query.fromInclusive || at >= input.query.toExclusive
      || (input.query.topicId && input.query.topicId !== question?.topicId)
      || (input.query.origin && input.query.origin !== question?.origin)
      || (input.query.mode && input.query.mode !== attempt.mode)
      || (input.query.activity && input.query.activity !== (session?.activity ?? 'questions')))) continue;
    const identity = `${attempt.questionId}\u0000${attempt.contentRevision}`;
    if (!byQuestion.has(identity)) continue;
    const values = attemptsByQuestion.get(identity) ?? [];
    values.push(attempt);
    attemptsByQuestion.set(identity, values);
  }

  const rows = new Map<string, MutableSectionPerformance>();
  for (const [identity, section] of byQuestion) {
    const questionId = identity.slice(0, identity.indexOf('\u0000'));
    const key = `${section.id}\u0000${section.materialPath}\u0000${section.sourceHash}`;
    const row = rows.get(key) ?? {
      sectionId: section.id, topicId: section.topicId, title: section.title, materialPath: section.materialPath,
      sourceHash: section.sourceHash, manifestRevision: manifest.revision, linkedQuestions: 0,
      practice: emptyAttemptSummary(), simulation: emptyAttemptSummary(),
    };
    row.linkedQuestions++;
    rows.set(key, row);
    const matchedAttempts = attemptsByQuestion.get(identity) ?? [];
    for (const attempt of matchedAttempts) {
      if (attempt.state !== 'answered' || attempt.outcome === null) continue;
      const summary = row[attempt.mode];
      if (attempt.exposureKind === 'immediate-retry') { summary.immediateRetryAttempts++; continue; }
      summary.answeredAttempts++;
      const at = (attempt.terminalEventId ? terminalDates.get(attempt.terminalEventId) : undefined) ?? attempt.completedAt ?? attempt.createdAt;
      const current = summary.latestByQuestion.get(questionId);
      if (!current || at > current.at || (at === current.at && attempt.id.localeCompare(current.id) > 0)) {
        summary.latestByQuestion.set(questionId, { at, id: attempt.id, outcome: attempt.outcome, confidence: attempt.confidence, selfAssessment: attempt.selfAssessment });
      }
    }
  }

  const output = [...rows.values()].map(row => {
    for (const summary of [row.practice, row.simulation]) {
      for (const latest of summary.latestByQuestion.values()) {
        summary.observedQuestions++;
        if (latest.outcome === 'correct') summary.latestCorrect++; else summary.latestWrong++;
        if (latest.confidence === 'sure') summary.confidence.sure++;
        else if (latest.confidence === 'betweenTwo') summary.confidence.betweenTwo++;
        else if (latest.confidence === 'guess') summary.confidence.guess++;
        else summary.confidence.notRecorded++;
        if (latest.selfAssessment === 'could-explain') summary.selfAssessment.couldExplain++;
        else if (latest.selfAssessment === 'needs-help') summary.selfAssessment.needsHelp++;
        else summary.selfAssessment.notRecorded++;
      }
    }
    const latestCombined = new Map<string, { at: number; id: string; outcome: 'correct' | 'wrong' }>();
    for (const summary of [row.practice, row.simulation]) for (const [id, latest] of summary.latestByQuestion) {
      const previous = latestCombined.get(id);
      if (!previous || latest.at > previous.at || (latest.at === previous.at && latest.id > previous.id)) latestCombined.set(id, latest);
    }
    return {
      ...row,
      observedDistinct: latestCombined.size,
      latestWrongDistinct: [...latestCombined.values()].filter(value => value.outcome === 'wrong').length,
      lastPracticeAt: latestCombined.size ? [...latestCombined.values()].reduce((latest, value) => Math.max(latest, value.at), 0) : null,
      errorQuestions: {
        practice: [...row.practice.latestByQuestion].filter(([, value]) => value.outcome === 'wrong').map(([id]) => id).sort(),
        simulation: [...row.simulation.latestByQuestion].filter(([, value]) => value.outcome === 'wrong').map(([id]) => id).sort(),
      },
      practice: toPublicAttemptSummary(row.practice),
      simulation: toPublicAttemptSummary(row.simulation),
    };
  }).sort((first, second) => (second.latestWrongDistinct ?? 0) - (first.latestWrongDistinct ?? 0) || (second.lastPracticeAt ?? 0) - (first.lastPracticeAt ?? 0) || first.sectionId.localeCompare(second.sectionId));
  return { status: 'ready', rows: output, staleLinks };
}
