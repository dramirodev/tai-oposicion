import type { CodeExplanation } from '../../core/domain/explanations.js';
import type { ExplanationRepository } from '../../core/ports/ExplanationRepository.js';
import { explanationMapper } from './mappers/explanation.js';

let cache: Promise<Map<string, CodeExplanation>> | null = null;

async function loadExplanations(): Promise<Map<string, CodeExplanation>> {
  const rows: unknown = await fetch('explanations/index.json').then(response => {
    if (!response.ok) throw new Error(`No se pudieron cargar explicaciones: ${response.status}`);
    return response.json();
  });
  if (!Array.isArray(rows)) return new Map();
  const explanations = new Map<string, CodeExplanation>();
  for (const row of rows) {
    const mapped = explanationMapper.toDomain(row);
    if (mapped.ok) explanations.set(mapped.value.questionId, mapped.value);
    else if (import.meta.env.DEV) console.warn(`Explicación inválida: ${mapped.reason}`);
  }
  return explanations;
}

export const httpExplanationRepository: ExplanationRepository = {
  async getExplanation(questionId) {
    cache ||= loadExplanations().catch(error => { cache = null; throw error; });
    return (await cache).get(questionId);
  },
};

export function clearExplanationRepositoryCache(): void {
  cache = null;
}
