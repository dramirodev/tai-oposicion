import type { QuestionAttempt, QuestionAttemptSession } from '../../domain/attempts/transitions.js';

export interface ConceptCatalogue {
  schemaVersion: 1;
  revision: string;
  concepts: readonly { id: string; label: string; status: 'pending-review' | 'approved'; reviewer?: string; reviewedAt?: number }[];
  links: readonly {
    questionId: string; semanticRevision: string; conceptId: string; role: 'necessary' | 'mentioned';
    status: 'pending-review' | 'approved'; reviewer?: string; reviewedAt?: number;
    evidence: { materialPath: string; sourceHash: string; page: number; rationale: string };
    distractors: readonly { canonicalOptionIndex: number; confusionId: string; description: string }[];
  }[];
}
export const pendingConceptCatalogue: ConceptCatalogue = { schemaVersion: 1, revision: 'pending-empty-2026-11-06', concepts: [], links: [] };

/** An explicit permutation maps visual positions to canonical bank options. Unknown/malformed mappings produce no attribution. */
export function canonicalOption(response: number | null, optionOrder: readonly number[]): number | null {
  if (response === null || !Number.isInteger(response) || response < 0 || response >= optionOrder.length
    || new Set(optionOrder).size !== optionOrder.length || optionOrder.some(value => !Number.isInteger(value) || value < 0 || value >= optionOrder.length)) return null;
  return optionOrder[response];
}

/** Non-exclusive groups; never add these counts to global response totals. */
export function summarizeConceptEvidence(input: {
  catalogue: ConceptCatalogue; attempts: readonly QuestionAttempt[]; sessions?: readonly QuestionAttemptSession[];
  currentQuestions: ReadonlyMap<string, { semanticRevision: string; optionCount: number }>;
  approvedSectionQuestionIds: ReadonlySet<string>;
  optionOrders?: ReadonlyMap<string, readonly number[]>;
  lowEvidenceThreshold?: number;
}) {
  const concepts = new Map(input.catalogue.concepts.filter(concept => concept.status === 'approved' && concept.reviewer?.trim() && (concept.reviewedAt ?? 0) > 0).map(concept => [concept.id, concept]));
  const sessions = new Map(input.sessions?.map(session => [session.id, session]));
  const latest = new Map<string, QuestionAttempt>();
  for (const attempt of input.attempts) {
    if (attempt.mode === 'simulation' && sessions.get(attempt.sessionId)?.status !== 'completed') continue;
    const question = input.currentQuestions.get(attempt.questionId);
    if (!question || !attempt.semanticRevision || attempt.semanticRevision !== question.semanticRevision
      || attempt.state !== 'answered' || attempt.outcome === null || attempt.exposureKind === 'immediate-retry'
      || !input.approvedSectionQuestionIds.has(attempt.questionId)) continue;
    const previous = latest.get(attempt.questionId);
    if (!previous || (attempt.completedAt ?? attempt.createdAt) > (previous.completedAt ?? previous.createdAt)
      || ((attempt.completedAt ?? attempt.createdAt) === (previous.completedAt ?? previous.createdAt) && attempt.id > previous.id)) latest.set(attempt.questionId, attempt);
  }
  const result = new Map<string, { conceptId: string; label: string; questionIds: Set<string>; wrongIds: Set<string>; confusions: Map<string, { description: string; questionIds: Set<string> }> }>();
  for (const link of input.catalogue.links) {
    const concept = concepts.get(link.conceptId), attempt = latest.get(link.questionId), question = input.currentQuestions.get(link.questionId);
    if (!concept || !attempt || !question || link.status !== 'approved' || !link.reviewer?.trim() || (link.reviewedAt ?? 0) <= 0
      || link.role !== 'necessary' || link.semanticRevision !== question.semanticRevision
      || !link.evidence.materialPath || !/^[a-f0-9]{64}$/i.test(link.evidence.sourceHash) || !Number.isInteger(link.evidence.page) || link.evidence.page < 1 || link.evidence.rationale.trim().length < 10) continue;
    const row = result.get(concept.id) ?? { conceptId: concept.id, label: concept.label, questionIds: new Set<string>(), wrongIds: new Set<string>(), confusions: new Map() };
    result.set(concept.id, row); row.questionIds.add(attempt.questionId);
    if (attempt.outcome !== 'wrong') continue;
    row.wrongIds.add(attempt.questionId);
    const order = input.optionOrders?.get(attempt.id) ?? Array.from({ length: question.optionCount }, (_, index) => index);
    const response = canonicalOption(attempt.response, order);
    if (response === null) continue;
    for (const distractor of link.distractors.filter(item => item.canonicalOptionIndex === response)) {
      const confusion = row.confusions.get(distractor.confusionId) ?? { description: distractor.description, questionIds: new Set<string>() };
      confusion.questionIds.add(attempt.questionId); row.confusions.set(distractor.confusionId, confusion);
    }
  }
  return { nonAdditive: true as const, catalogueRevision: input.catalogue.revision, rows: [...result.values()].map(row => ({
    conceptId: row.conceptId, label: row.label, observedQuestions: row.questionIds.size, latestWrong: row.wrongIds.size,
    lowEvidence: row.questionIds.size < (input.lowEvidenceThreshold ?? 5),
    confusions: [...row.confusions].map(([id, value]) => ({ id, description: `Respuesta compatible con la confusión ${value.description}`, questionIds: [...value.questionIds].sort() })),
  })).sort((a, b) => b.latestWrong - a.latestWrong || a.conceptId.localeCompare(b.conceptId)) };
}
