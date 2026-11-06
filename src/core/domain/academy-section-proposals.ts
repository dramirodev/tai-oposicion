import type { AcademyCurriculumSection } from './academy-curriculum-types.js';
import type { QuestionRecord } from './question-record.js';
import { questionContentRevision } from './attempts/highlights.js';
import { questionRecordSemanticRevision } from './attempts/question-semantic-revision.js';

export type SectionProposalStatus = 'pending-review' | 'ambiguous' | 'without-evidence' | 'rejected';
export interface SectionProposal {
  schemaVersion: 1;
  id: string;
  status: SectionProposalStatus;
  questionId: string;
  contentRevision: string;
  semanticRevision: string;
  questionTopicId: string;
  candidateSectionId?: string;
  sectionEvidence?: { path: string; sourceHash: string; outlineFingerprint: string; printedPage: number };
  sourceCandidates: readonly { path: string; sourceHash: string; physicalPages: readonly number[] }[];
  rationale: string;
  provenance: 'existing-source-index-and-manual-selection' | 'manual-selection';
}
/** A proposal has no reviewer/date of approval. Repeated input yields the same identity. */
export function createSectionProposal(input: {
  question: QuestionRecord; section?: AcademyCurriculumSection; status: SectionProposalStatus; rationale: string;
  sourceCandidates?: SectionProposal['sourceCandidates'];
}): SectionProposal {
  const semanticRevision = questionRecordSemanticRevision(input.question);
  const section = input.section;
  const sourceCandidates = input.sourceCandidates ?? [];
  return {
    schemaVersion: 1, id: `proposal:${input.question.i}:${semanticRevision}:${section?.id ?? 'none'}`,
    status: section ? input.status : 'without-evidence', questionId: input.question.i,
    contentRevision: questionContentRevision(input.question.q, input.question.a), semanticRevision,
    questionTopicId: input.question.t,
    ...(section ? { candidateSectionId: section.id, sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, printedPage: section.printedPage } } : {}),
    sourceCandidates, rationale: input.rationale.trim(),
    provenance: sourceCandidates.length ? 'existing-source-index-and-manual-selection' : 'manual-selection',
  };
}
export function mergeSectionProposals(current: readonly SectionProposal[], incoming: readonly SectionProposal[]): SectionProposal[] {
  return [...new Map([...current, ...incoming].map(proposal => [proposal.id, proposal])).values()].sort((a, b) => a.id.localeCompare(b.id));
}
