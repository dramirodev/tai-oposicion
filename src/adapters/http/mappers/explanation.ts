import type { CodeExplanation, ExplanationResultKind } from '../../../core/domain/explanations.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { ExplanationDto } from '../dto/explanation.js';
import { explanationDtoSchema } from '../schemas/explanation.js';

type ExplanationIssue = { path: readonly PropertyKey[]; message: string };
const requiredFields = new Set(['i', 'rev', 'lang', 'snippet', 'limitation']);
const fixedFieldReasons: Record<string, string> = {
  status: 'invalid-editorial-status',
  editorialNote: 'invalid-editorial-note',
};
const collectionFields = new Set(['steps', 'distractors', 'sources']);

function invalidSourceReason(nested: PropertyKey | undefined, message: string): string {
  if (nested === 'section') return 'invalid-source-section';
  if (nested === 'url' && message === 'invalid-source-url') return 'invalid-source-url';
  return 'invalid-source';
}

function invalidCollectionReason(field: string, index: PropertyKey | undefined, nested: PropertyKey | undefined, message: string): string | undefined {
  if (!collectionFields.has(field)) return undefined;
  if (index === undefined) return 'invalid-collections';
  if (field === 'steps') return 'invalid-step';
  if (field === 'distractors') return 'invalid-distractor';
  return invalidSourceReason(nested, message);
}

function invalidExplanationReason(issue: ExplanationIssue | undefined): string {
  const [rawField, index, nested] = issue?.path ?? [];
  const field = String(rawField);
  if (requiredFields.has(field)) return 'invalid-required-field';
  if (fixedFieldReasons[field]) return fixedFieldReasons[field];
  if (field === 'result') return nested === 'value' ? 'invalid-result-value' : 'invalid-result';
  return invalidCollectionReason(field, index, nested, issue?.message ?? '') ?? 'invalid-explanation';
}

export const explanationMapper = {
  toDomain(input: unknown): MappingResult<CodeExplanation> {
    const parsed = explanationDtoSchema.safeParse(input);
    if (!parsed.success) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, reason: 'invalid-explanation' };
      return { ok: false, reason: invalidExplanationReason(parsed.error.issues[0]) };
    }
    const explanation = parsed.data;
    const steps: CodeExplanation['steps'] = explanation.steps.map((step) => ({ title: step.title, explanation: step.detail }));
    const distractors: CodeExplanation['distractors'] = explanation.distractors.map((distractor) => ({ optionIndex: distractor.option, explanation: distractor.detail }));
    const sources: CodeExplanation['sources'] = explanation.sources.map((source) => ({
      title: source.title,
      url: new URL(source.url).href,
      ...(source.section ? { section: source.section } : {}),
    }));
    return {
      ok: true,
      value: {
        questionId: explanation.i,
        contentRevision: explanation.rev,
        language: explanation.lang,
        editorialStatus: explanation.status,
        snippet: explanation.snippet,
        result: { kind: explanation.result.kind as ExplanationResultKind, ...(explanation.result.value !== undefined ? { value: explanation.result.value } : {}) },
        steps,
        distractors,
        limitation: explanation.limitation,
        ...(explanation.editorialNote !== undefined ? { editorialNote: explanation.editorialNote } : {}),
        sources,
      },
    };
  },

  toDto(explanation: CodeExplanation): ExplanationDto {
    return {
      i: explanation.questionId,
      rev: explanation.contentRevision,
      lang: explanation.language,
      status: explanation.editorialStatus,
      snippet: explanation.snippet,
      result: { kind: explanation.result.kind, ...(explanation.result.value !== undefined ? { value: explanation.result.value } : {}) },
      steps: explanation.steps.map(step => ({ title: step.title, detail: step.explanation })),
      distractors: explanation.distractors.map(distractor => ({ option: distractor.optionIndex, detail: distractor.explanation })),
      limitation: explanation.limitation,
      ...(explanation.editorialNote !== undefined ? { editorialNote: explanation.editorialNote } : {}),
      sources: explanation.sources.map(source => ({ title: source.title, url: source.url, ...(source.section ? { section: source.section } : {}) })),
    };
  },
};
