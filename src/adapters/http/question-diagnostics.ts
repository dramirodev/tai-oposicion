/// <reference types="vite/client" />
import { questionMapper } from './mappers/question.js';

const reportedFields = new Set<string>();
const reportedInvalidQuestions = new Set<string>();

function questionId(value: unknown): string {
  if (value && typeof value === 'object' && 'i' in value && typeof value.i === 'string') return value.i;
  return '(sin id)';
}

export function diagnoseQuestionDtos(
  rows: readonly unknown[],
  development = import.meta.env.DEV,
  warn: (message: string) => void = (message) => console.warn(message),
): void {
  if (!development) return;
  const unknownFields = new Set<string>();
  for (const row of rows) {
    const result = questionMapper.toDomain(row);
    if (!result.ok) {
      const key = `${questionId(row)}: ${result.reason}`;
      if (!reportedInvalidQuestions.has(key)) {
        reportedInvalidQuestions.add(key);
        warn(`Pregunta inválida ${key}`);
      }
      continue;
    }
    for (const field of result.value.warnings) unknownFields.add(field);
  }
  const freshFields = [...unknownFields].filter((field) => !reportedFields.has(field));
  if (freshFields.length) {
    freshFields.forEach((field) => reportedFields.add(field));
    warn(`Campos desconocidos del banco: ${freshFields.join(', ')}`);
  }
}
