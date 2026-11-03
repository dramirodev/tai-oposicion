import { z } from 'zod';
import { isSimulationScoringPolicy } from '../../../core/domain/simulation-scoring.js';

const numericValue = z.unknown().refine((value): value is number => typeof value === 'number');

/** Deliberately mirrors the permissive legacy record contract at the storage boundary. */
export const sessionRecordSchema = z.strictObject({
  id: z.string(),
  ts: numericValue,
  kind: z.string(),
  n: numericValue,
  a: numericValue,
  f: numericValue,
  b: numericValue,
  secs: numericValue,
  nota: numericValue,
  temas: z.unknown().refine(Boolean),
  tipos: z.unknown().refine(Boolean),
  fails: z.array(z.unknown()),
  titulo: z.string(),
  interrupted: z.unknown().optional(),
  porTiempo: z.unknown().optional(),
  scorePending: z.boolean().optional(),
  scoringPolicy: z.custom(isSimulationScoringPolicy).optional(),
  milestoneEventId: z.string().regex(/^[A-Za-z0-9_.:-]{1,100}$/).optional(),
});
