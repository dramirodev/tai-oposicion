import { describe, expect, it, vi } from 'vitest';
import { deleteDetailedStudyHistory } from '../../src/core/application/attempts/delete-detailed-study-history.ts';

it('borra el historial del ámbito y deja intacto el progreso agregado que pertenece a otro almacén', async () => {
  const progress = { stats: { Q1: [1, 1] } };
  const repository = { deleteScope: vi.fn(async () => undefined) };
  await deleteDetailedStudyHistory(repository, 'guest', 1234);
  expect(repository.deleteScope).toHaveBeenCalledWith('guest', 1234, 'local');
  expect(progress.stats.Q1).toEqual([1, 1]);
});
