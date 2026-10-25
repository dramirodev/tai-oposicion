import type { CodeExplanation } from '../domain/explanations.js';

export interface ExplanationRepository {
  getExplanation(questionId: string): Promise<CodeExplanation | undefined>;
}
