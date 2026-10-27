import { z } from 'zod';

const nonNegativeTime = z.number().finite().nonnegative();

/** Persistence-boundary validation for the versioned attempt-session record. */
export const attemptSessionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  sourceSessionId: z.string().optional(),
  mode: z.enum(['practice', 'simulation']),
  status: z.enum(['active', 'completed', 'interrupted']),
  startedAt: nonNegativeTime,
  endedAt: nonNegativeTime.optional(),
  timeLimitSeconds: z.number().finite().positive().optional(),
  elapsedSeconds: nonNegativeTime.optional(),
  lastSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).superRefine((session, context) => {
  if (session.status === 'active' && session.endedAt !== undefined) {
    context.addIssue({ code: 'custom', path: ['endedAt'], message: 'active session cannot have an end time' });
  } else if (session.status !== 'active' && session.endedAt === undefined) {
    context.addIssue({ code: 'custom', path: ['endedAt'], message: 'closed session requires an end time' });
  }
});

export type AttemptSessionRecord = z.infer<typeof attemptSessionSchema>;
