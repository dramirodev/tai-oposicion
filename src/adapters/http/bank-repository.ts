import type { Question } from '../../core/domain/entities.js';
import type { BankRepository } from '../../core/ports/BankRepository.js';
import { getMeta, getTema, temaOf } from './legacy-data.js';
import { clearQuestionDiagnostics, mapQuestionDtos } from './question-diagnostics.js';

const topicCache = new Map<string, Promise<Question[]>>();

async function getTopicQuestions(topicId: string): Promise<Question[]> {
  let pending = topicCache.get(topicId);
  if (!pending) {
    pending = getTema(topicId).then(rows => mapQuestionDtos(rows)).catch((error: unknown) => {
      topicCache.delete(topicId);
      throw error;
    });
    topicCache.set(topicId, pending);
  }
  return pending;
}

export const httpBankRepository: BankRepository = {
  async getQuestion(questionId) {
    await getMeta();
    const topicId = temaOf(questionId);
    if (!topicId) return undefined;
    return (await getTopicQuestions(topicId)).find(question => question.id === questionId);
  },

  async getQuestions(topicIds) {
    await getMeta();
    return (await Promise.all(topicIds.map(getTopicQuestions))).flat();
  },
};

export function clearBankRepositoryCache(): void {
  topicCache.clear();
  clearQuestionDiagnostics();
}
