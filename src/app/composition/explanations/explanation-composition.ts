import { httpExplanationRepository } from '../../../adapters/http/explanation-repository.js';
import { getCodeExplanation } from '../../../core/application/explanations/get-code-explanation.js';
import { questionContentRevision } from '../../../core/domain/attempts/highlights.js';

export function findCodeExplanation(questionId: string, statement: string, options: string[]) {
  return getCodeExplanation(httpExplanationRepository, questionId, questionContentRevision(statement, options));
}
