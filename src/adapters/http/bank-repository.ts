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
    const meta = await getMeta();
    const topicId = temaOf(questionId);
    if (!topicId) return undefined;
    const canonicalId = meta[questionId]?.[5] || questionId;
    const question = (await getTopicQuestions(topicId)).find(item => item.id === canonicalId);
    return question && canonicalId !== questionId ? { ...question, id: questionId } : question;
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
