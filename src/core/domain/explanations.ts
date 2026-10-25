export type ExplanationEditorialStatus = 'draft' | 'reviewed';
export type ExplanationResultKind = 'output' | 'compile-error' | 'runtime-error' | 'logic';

export interface ExplanationStep {
  title: string;
  explanation: string;
}

export interface CodeExplanationSource {
  title: string;
  url: string;
  section?: string;
}

export interface CodeExplanation {
  questionId: string;
  contentRevision: string;
  language: string;
  editorialStatus: ExplanationEditorialStatus;
  snippet: string;
  result: { kind: ExplanationResultKind; value?: string };
  steps: ExplanationStep[];
  distractors: { optionIndex: number; explanation: string }[];
  limitation: string;
  editorialNote?: string;
  sources: CodeExplanationSource[];
}

export type ExplanationLookup =
  | { status: 'current'; explanation: CodeExplanation }
  | { status: 'outdated' }
  | { status: 'missing' };
