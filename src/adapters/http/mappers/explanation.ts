import type { CodeExplanation, ExplanationResultKind } from '../../../core/domain/explanations.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { ExplanationDto } from '../dto/explanation.js';
import { explanationDtoSchema } from '../schemas/explanation.js';

export const explanationMapper = {
  toDomain(input: unknown): MappingResult<CodeExplanation> {
    const parsed = explanationDtoSchema.safeParse(input);
    if (!parsed.success) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, reason: 'invalid-explanation' };
      const issue = parsed.error.issues[0];
      const [field, index, nested] = issue?.path ?? [];
      const reason = ['i', 'rev', 'lang', 'snippet', 'limitation'].includes(String(field)) ? 'invalid-required-field'
        : field === 'status' ? 'invalid-editorial-status'
          : field === 'result' ? nested === 'value' ? 'invalid-result-value' : 'invalid-result'
            : field === 'steps' ? index === undefined ? 'invalid-collections' : 'invalid-step'
              : field === 'distractors' ? index === undefined ? 'invalid-collections' : 'invalid-distractor'
                : field === 'sources' ? index === undefined ? 'invalid-collections' : nested === 'section' ? 'invalid-source-section' : nested === 'url' && issue?.message === 'invalid-source-url' ? 'invalid-source-url' : 'invalid-source'
                  : field === 'editorialNote' ? 'invalid-editorial-note' : 'invalid-explanation';
      return { ok: false, reason };
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
