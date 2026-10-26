import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import { buildQuestionEvolution } from '../../domain/attempts/question-evolution.js';
import { exportAttemptArchive } from './export-attempt-archive.js';

export async function getQuestionEvolution(input: {
  repository: AttemptRepository;
  scope: string;
  weeks: number;
  now: number;
}) {
  const archive = await exportAttemptArchive(input.repository, input.scope, input.now);
  return buildQuestionEvolution(archive, input.weeks, input.now);
}
