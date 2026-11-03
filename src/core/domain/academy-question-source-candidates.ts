export interface AcademyQuestionTestSourceCandidate {
  materialIndex: number;
  pages: readonly number[];
}

export interface AcademyQuestionTestMaterial {
  topicId: string;
  path: string;
  sourceHash: string;
}

export interface AcademyQuestionSourceCandidate {
  questionTopicId: string;
  contentRevision: string;
  sources: readonly { materialIndex: number; pages: readonly number[] }[];
}

export interface AcademyQuestionSourceCandidateIndex {
  schemaVersion: 1;
  matching: string;
  materials: readonly AcademyQuestionTestMaterial[];
  questions: Readonly<Record<string, readonly AcademyQuestionSourceCandidate[]>>;
  testMaterialCount: number;
  processedTestMaterials: number;
  skippedTestMaterialPaths: readonly string[];
  skippedTestMaterials: number;
  matchedQuestionIds: number;
}

/** Filter generated source hints against the live question identity and revision. */
export function currentQuestionSourceCandidates(
  candidates: readonly AcademyQuestionSourceCandidate[] | undefined,
  question: { id: string; topicId: string; contentRevision: string },
): readonly AcademyQuestionSourceCandidate[] {
  return (candidates ?? []).filter(candidate => candidate.questionTopicId === question.topicId
    && candidate.contentRevision === question.contentRevision);
}
