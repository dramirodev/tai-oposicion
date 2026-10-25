import type { CodeExplanation, ExplanationResultKind } from '../../../core/domain/explanations.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { ExplanationDto } from '../dto/explanation.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const resultKinds: readonly ExplanationResultKind[] = ['output', 'compile-error', 'runtime-error', 'logic'];

export const explanationMapper = {
  toDomain(input: unknown): MappingResult<CodeExplanation> {
    // TODO(zod): replace these boundary checks with the phase-6 schema.
    if (!isRecord(input)) return { ok: false, reason: 'invalid-explanation' };
    if (!isText(input.i) || !isText(input.rev) || !isText(input.lang) || !isText(input.snippet) || !isText(input.limitation)) {
      return { ok: false, reason: 'invalid-required-field' };
    }
    if (input.status !== 'draft' && input.status !== 'reviewed') return { ok: false, reason: 'invalid-editorial-status' };
    if (!isRecord(input.result) || !resultKinds.includes(input.result.kind as ExplanationResultKind)) {
      return { ok: false, reason: 'invalid-result' };
    }
    if (input.result.value !== undefined && typeof input.result.value !== 'string') return { ok: false, reason: 'invalid-result-value' };
    if (!Array.isArray(input.steps) || !Array.isArray(input.distractors) || !Array.isArray(input.sources)) {
      return { ok: false, reason: 'invalid-collections' };
    }

    const steps: CodeExplanation['steps'] = [];
    for (const step of input.steps) {
      if (!isRecord(step) || !isText(step.title) || !isText(step.detail)) return { ok: false, reason: 'invalid-step' };
      steps.push({ title: step.title, explanation: step.detail });
    }

    const distractors: CodeExplanation['distractors'] = [];
    for (const distractor of input.distractors) {
      if (!isRecord(distractor) || !Number.isInteger(distractor.option) || (distractor.option as number) < 0 || !isText(distractor.detail)) {
        return { ok: false, reason: 'invalid-distractor' };
      }
      distractors.push({ optionIndex: distractor.option as number, explanation: distractor.detail });
    }

    const sources: CodeExplanation['sources'] = [];
    for (const source of input.sources) {
      if (!isRecord(source) || !isText(source.title) || !isText(source.url)) return { ok: false, reason: 'invalid-source' };
      let parsedUrl: URL;
      try { parsedUrl = new URL(source.url); } catch { return { ok: false, reason: 'invalid-source-url' }; }
      if (parsedUrl.protocol !== 'https:') return { ok: false, reason: 'invalid-source-url' };
      if (source.section !== undefined && typeof source.section !== 'string') return { ok: false, reason: 'invalid-source-section' };
      sources.push({ title: source.title, url: parsedUrl.href, ...(source.section ? { section: source.section } : {}) });
    }

    if (input.editorialNote !== undefined && typeof input.editorialNote !== 'string') return { ok: false, reason: 'invalid-editorial-note' };
    return {
      ok: true,
      value: {
        questionId: input.i,
        contentRevision: input.rev,
        language: input.lang,
        editorialStatus: input.status,
        snippet: input.snippet,
        result: { kind: input.result.kind as ExplanationResultKind, ...(input.result.value !== undefined ? { value: input.result.value } : {}) },
        steps,
        distractors,
        limitation: input.limitation,
        ...(input.editorialNote !== undefined ? { editorialNote: input.editorialNote } : {}),
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
