import { z } from 'zod';

const numericValue = z.custom<number>((value) => typeof value === 'number');

/** Deliberately mirrors the permissive legacy record contract at the storage boundary. */
export const sessionRecordSchema = z.object({
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
}).strict();
