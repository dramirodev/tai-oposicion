import { z } from 'zod';

const numericValue = z.unknown().refine((value): value is number => typeof value === 'number');
const sourceSchema = z.looseObject({
  url: z.string(),
  title: z.string().optional(),
  page: numericValue.optional(),
  verified: z.boolean(),
});

export const questionDtoSchema = z.object({
  i: z.string(),
  t: z.string(),
  o: z.enum(['O', 'A', 'G']),
  q: z.string(),
  a: z.array(z.string()),
  c: z.number().int(),
  k: z.string().optional(),
  x: z.array(numericValue).optional(),
  d: numericValue.nullable().optional(),
  n: z.string().optional(),
  y: z.string().optional(),
  u: z.string().optional(),
  np: numericValue.optional(),
  source: sourceSchema.optional(),
  cp: z.string().optional(),
  s: z.string().optional(),
  p: numericValue.optional(),
  r: numericValue.optional(),
  v: numericValue.optional(),
  w: numericValue.optional(),
  z: numericValue.optional(),
  f: z.string().optional(),
});
