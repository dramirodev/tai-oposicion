import type { CodeExplanation, ExplanationLookup } from '../../domain/explanations.js';
import type { ExplanationRepository } from '../../ports/ExplanationRepository.js';

export async function getCodeExplanation(
  repository: ExplanationRepository,
  questionId: string,
  contentRevision: string,
): Promise<ExplanationLookup> {
  const explanation: CodeExplanation | undefined = await repository.getExplanation(questionId);
  if (!explanation || explanation.questionId !== questionId) return { status: 'missing' };
  if (explanation.contentRevision !== contentRevision) return { status: 'outdated' };
  return { status: 'current', explanation };
}
