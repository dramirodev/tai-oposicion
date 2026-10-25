import type { AttemptRepository } from '../../ports/AttemptRepository.js';

/** Removes attempt-level records and records a sync tombstone; aggregate progress is a different store. */
export async function deleteDetailedStudyHistory(repository: AttemptRepository, scope: string, deletedAt: number): Promise<void> {
  await repository.deleteScope(scope, deletedAt, 'local');
}
