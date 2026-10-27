import { z } from 'zod';

export const attemptArchiveSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.number().finite().nonnegative(),
  sessions: z.array(z.unknown()).max(100_000),
  attempts: z.array(z.unknown()).max(100_000),
  events: z.array(z.unknown()).max(1_000_000),
});
