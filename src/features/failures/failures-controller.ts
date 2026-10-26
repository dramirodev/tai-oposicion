import type { FailureQuestion } from '../../shared/ui/study-services.js';

export interface FailureFilter { query: string; topicId: string; syllabus: '' | 'pending' | 'reviewed'; streak: '' | '0' | '1' | '2' }
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function selectFailures(
  questions: readonly FailureQuestion[],
  filter: FailureFilter,
  readRecord: (id: string) => readonly number[] | undefined,
): FailureQuestion[] {
  const query = fold(filter.query).trim();
  return questions.filter(question => {
    const record = readRecord(question.id) || [];
    const reviewed = record[11] === 1;
    const streak = Math.max(0, record[10] || 0);
    const searchable = fold([question.statement, ...question.options, question.citation, question.note].filter(Boolean).join(' '));
    return (!query || searchable.includes(query))
      && (!filter.topicId || question.topicId === filter.topicId)
      && (!filter.syllabus || (filter.syllabus === 'reviewed') === reviewed)
      && (!filter.streak || streak === Number(filter.streak));
  });
}
