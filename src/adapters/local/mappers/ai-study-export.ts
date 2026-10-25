import type { AiStudyExport } from '../../../core/domain/attempts/ai-study-export.js';
import type { AiStudyExportDto } from '../dto/ai-study-export.js';

export const aiStudyExportMapper = {
  toDto(value: AiStudyExport): AiStudyExportDto {
    return {
      format: 'tai-study-ai-export',
      schemaVersion: 1,
      createdAt: value.createdAt,
      filters: { ...value.filters, modes: [...value.filters.modes] },
      report: {
        ...value.report,
        period: { ...value.report.period },
        scoring: { ...value.report.scoring },
        overall: {
          ...value.report.overall,
          confidence: { ...value.report.overall.confidence },
          highlights: { ...value.report.overall.highlights },
          activeTime: { ...value.report.overall.activeTime },
        },
        segments: value.report.segments.map(segment => ({
          ...segment,
          confidence: { ...segment.confidence },
          highlights: { ...segment.highlights },
          activeTime: { ...segment.activeTime },
          recommendationSample: { ...segment.recommendationSample },
          timingSample: { ...segment.timingSample },
        })),
      },
      manifest: { ...value.manifest, parts: value.manifest.parts.map(part => ({ ...part })) },
      parts: value.parts.map(part => ({
        ...part,
        format: 'tai-study-ai-export-part',
        schemaVersion: 1,
        sessions: part.sessions.map(session => ({ ...session })),
        attempts: part.attempts.map(attempt => ({
          ...attempt,
          discardedOptions: [...attempt.discardedOptions],
          highlights: attempt.highlights.map(highlight => ({ ...highlight })),
          activeTime: { ...attempt.activeTime },
          appliedEventIds: [...attempt.appliedEventIds],
        })),
        events: part.events.map(event => ({ ...event, payload: { ...event.payload } })),
        questions: part.questions.map(question => ({
          ...question,
          attemptRevisions: [...question.attemptRevisions],
          ...(question.content ? {
            content: {
              ...question.content,
              options: [...question.content.options],
              flags: { ...question.content.flags },
              ...(question.content.source ? { source: { ...question.content.source } } : {}),
            },
          } : { content: null }),
        })),
        explanations: part.explanations.map(explanation => ({
          ...explanation,
          result: { ...explanation.result },
          steps: explanation.steps.map(step => ({ ...step })),
          distractors: explanation.distractors.map(distractor => ({ ...distractor })),
          sources: explanation.sources.map(source => ({ ...source })),
        })),
      })),
    };
  },
};
