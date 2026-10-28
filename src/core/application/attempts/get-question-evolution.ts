import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import { buildQuestionEvolution } from '../../domain/attempts/question-evolution.js';
import { summarizeObservedStudyTime } from '../../domain/attempts/observed-study-time.js';
import { exportAttemptArchive } from './export-attempt-archive.js';

export async function getStudyActivity(input: {
  repository: AttemptRepository;
  scope: string;
  weeks: number;
  now: number;
}) {
  const archive = await exportAttemptArchive(input.repository, input.scope, input.now);
  return {
    questionEvolution: buildQuestionEvolution(archive, input.weeks, input.now),
    observedStudyTime: summarizeObservedStudyTime(archive),
  };
}

/** Kept for callers that only need question history. */
export async function getQuestionEvolution(input: Parameters<typeof getStudyActivity>[0]) {
  return (await getStudyActivity(input)).questionEvolution;
}
