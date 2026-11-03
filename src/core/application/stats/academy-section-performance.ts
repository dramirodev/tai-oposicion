import type { AcademyQuestionSectionManifest } from '../../domain/academy-question-section-map.js';
import { isAcademyQuestionSectionManifest, resolveAcademyQuestionSectionLink } from '../../domain/academy-question-section-map.js';
import type { AcademyCurriculumSection } from '../../domain/academy-curriculum-types.js';
import type { Question } from '../../domain/entities.js';
import type { QuestionAttempt } from '../../domain/attempts/transitions.js';

export interface AcademySectionPerformance {
  sectionId: string;
  topicId: string;
  title: string;
  materialPath: string;
  sourceHash: string;
  manifestRevision: string;
  linkedQuestions: number;
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
}): AcademySectionPerformanceResult {
  if (!isAcademyQuestionSectionManifest(input.manifest)) return { status: 'invalid-manifest', rows: [] };
  const manifest: AcademyQuestionSectionManifest = input.manifest;
  if (manifest.links.length === 0) return { status: 'no-approved-links', rows: [] };

  const questions = new Map(input.questions.map(question => [question.id, question]));
  const sections = new Map(input.sections.map(section => [section.id, section]));
  const byQuestion = new Map<string, AcademyCurriculumSection>();
  let staleLinks = 0;
  for (const link of manifest.links) {
    const question = questions.get(link.questionId);
    const section = sections.get(link.sectionId);
    const resolved = question ? resolveAcademyQuestionSectionLink({ link, question, section, availableTestMaterials: input.availableTestMaterials }) : undefined;
    if (!question || !resolved) { staleLinks++; continue; }
    byQuestion.set(`${link.questionId}\u0000${link.contentRevision}`, resolved);
  }
  if (byQuestion.size === 0) return { status: 'no-current-links', rows: [], staleLinks };

  const attemptsByQuestion = new Map<string, QuestionAttempt[]>();
  for (const attempt of input.attempts) {
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
      const at = attempt.completedAt ?? attempt.createdAt;
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
    return {
      ...row,
      practice: toPublicAttemptSummary(row.practice),
      simulation: toPublicAttemptSummary(row.simulation),
    };
  }).sort((first, second) => first.topicId.localeCompare(second.topicId) || first.title.localeCompare(second.title) || first.sectionId.localeCompare(second.sectionId));
  return { status: 'ready', rows: output, staleLinks };
}
