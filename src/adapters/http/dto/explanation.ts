export interface ExplanationDto {
  i: string;
  rev: string;
  lang: string;
  status: 'draft' | 'reviewed';
  snippet: string;
  result: { kind: 'output' | 'compile-error' | 'runtime-error' | 'logic'; value?: string };
  steps: { title: string; detail: string }[];
  distractors: { option: number; detail: string }[];
  limitation: string;
  editorialNote?: string;
  sources: { title: string; url: string; section?: string }[];
}
