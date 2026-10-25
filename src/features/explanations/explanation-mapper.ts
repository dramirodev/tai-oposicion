import type { CodeExplanation, ExplanationResultKind } from '../../core/domain/explanations.js';

export interface CodeExplanationVM {
  heading: string;
  editorialLabel: string;
  editorialNote?: string;
  language: string;
  snippet: string;
  resultLabel: string;
  resultValue?: string;
  steps: { title: string; explanation: string }[];
  distractors: { optionIndex: number; explanation: string }[];
  limitation: string;
  sources: { title: string; url: string; section?: string }[];
}

const resultLabels: Record<ExplanationResultKind, string> = {
  output: 'Resultado esperado',
  'compile-error': 'Error de compilación',
  'runtime-error': 'Error de ejecución',
  logic: 'Análisis lógico',
};

export const explanationMapper = {
  toViewModel(explanation: CodeExplanation): CodeExplanationVM {
    return {
      heading: 'Explicación del código',
      editorialLabel: explanation.editorialStatus === 'reviewed' ? 'Revisada' : 'Borrador',
      ...(explanation.editorialNote ? { editorialNote: explanation.editorialNote } : {}),
      language: explanation.language,
      snippet: explanation.snippet,
      resultLabel: resultLabels[explanation.result.kind],
      ...(explanation.result.value !== undefined ? { resultValue: explanation.result.value } : {}),
      steps: explanation.steps.map(step => ({ title: step.title, explanation: step.explanation })),
      distractors: explanation.distractors.map(distractor => ({ optionIndex: distractor.optionIndex, explanation: distractor.explanation })),
      limitation: explanation.limitation,
      sources: explanation.sources.map(source => ({ title: source.title, url: source.url, ...(source.section ? { section: source.section } : {}) })),
    };
  },
};
