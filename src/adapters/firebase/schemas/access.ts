import { z } from 'zod';

export const accessRequestDtoSchema = z.strictObject({
  email: z.string(),
  name: z.string().optional(),
  ts: z.number().optional(),
});
