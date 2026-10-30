import type { Question } from '../../core/domain/entities.js';
import type { BankRepository } from '../../core/ports/BankRepository.js';
import { getMetadata, getTopicForQuestion, getTopicQuestions as loadTopicQuestionRecords, topicCacheKey } from './study-question-catalog.js';
import { clearQuestionDiagnostics, mapQuestionDtos } from './question-diagnostics.js';

const topicCache = new Map<string, Promise<Question[]>>();

async function getTopicQuestions(topicId: string): Promise<Question[]> {
  const key = topicCacheKey(topicId);
  let pending = topicCache.get(key);
  if (!pending) {
    pending = loadTopicQuestionRecords(topicId).then(rows => mapQuestionDtos(rows)).catch((error: unknown) => {
      topicCache.delete(key);
      throw error;
    });
    topicCache.set(key, pending);
  }
  return pending;
}

export const httpBankRepository: BankRepository = {
  async getQuestion(questionId) {
    const meta = await getMetadata();
    const topicId = getTopicForQuestion(questionId);
    if (!topicId) return undefined;
    const canonicalId = meta[questionId]?.[5] || questionId;
    const question = (await getTopicQuestions(topicId)).find(item => item.id === canonicalId);
    return question && canonicalId !== questionId ? { ...question, id: questionId } : question;
  },

  async getQuestions(topicIds) {
    await getMetadata();
    return (await Promise.all(topicIds.map(getTopicQuestions))).flat();
  },
};

export function clearBankRepositoryCache(): void {
  topicCache.clear();
  clearQuestionDiagnostics();
}
