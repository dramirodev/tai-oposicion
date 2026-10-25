import type { Question } from '../../core/domain/entities.js';
import type { BankRepository } from '../../core/ports/BankRepository.js';
import { byIds, getMeta, getTema } from './legacy-data.js';
import { questionMapper } from './mappers/question.js';

const topicCache = new Map<string, Promise<Question[]>>();
const reportedInvalid = new Set<string>();
const reportedUnknownFields = new Set<string>();

function toDomainQuestions(rows: readonly unknown[]): Question[] {
  const questions: Question[] = [];
  for (const row of rows) {
    const result = questionMapper.toDomain(row);
    if (result.ok) {
      questions.push(result.value.question);
      const freshFields = result.value.warnings.filter(field => !reportedUnknownFields.has(field));
      if (import.meta.env.DEV && freshFields.length) {
        freshFields.forEach(field => reportedUnknownFields.add(field));
        console.warn(`Campos desconocidos del banco: ${freshFields.join(', ')}`);
      }
      continue;
    }
    const id = row && typeof row === 'object' && 'i' in row && typeof row.i === 'string' ? row.i : '(sin id)';
    const diagnostic = `${id}: ${result.reason}`;
    if (import.meta.env.DEV && !reportedInvalid.has(diagnostic)) {
      reportedInvalid.add(diagnostic);
      console.warn(`Pregunta inválida ${diagnostic}`);
    }
  }
  return questions;
}

async function getTopicQuestions(topicId: string): Promise<Question[]> {
  let pending = topicCache.get(topicId);
  if (!pending) {
    pending = getTema(topicId).then(toDomainQuestions).catch((error: unknown) => {
      topicCache.delete(topicId);
      throw error;
    });
    topicCache.set(topicId, pending);
  }
  return pending;
}

export const httpBankRepository: BankRepository = {
  async getQuestion(questionId) {
    const [question] = toDomainQuestions(await byIds([questionId]));
    return question;
  },

  async getQuestions(topicIds) {
    await getMeta();
    return (await Promise.all(topicIds.map(getTopicQuestions))).flat();
  },
};

export function clearBankRepositoryCache(): void {
  topicCache.clear();
  reportedInvalid.clear();
  reportedUnknownFields.clear();
}
