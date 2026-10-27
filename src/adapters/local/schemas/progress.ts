import { z } from 'zod';

export const progressEnvelopeSchema = z.strictObject({
  stats: z.record(z.string(), z.unknown()),
  sessions: z.array(z.unknown()),
  cfg: z.record(z.string(), z.unknown()),
  seen: z.strictObject({
    t: z.array(z.string()),
    ts: z.number(),
  }),
  reports: z.record(z.string(), z.unknown()),
  cards: z.record(z.string(), z.unknown()),
});
