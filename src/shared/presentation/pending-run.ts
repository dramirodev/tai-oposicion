import { formatTime } from './format.ts';

export interface PendingRunPromptInput {
  title?: string;
  index: number;
  itemCount: number;
  seconds?: number;
  limitMinutes?: number;
  timeLimited?: boolean;
}

export function formatPendingRunPrompt(input: PendingRunPromptInput): string {
  const question = Math.min(input.index + 1, input.itemCount);
  const progress = input.timeLimited ? `pregunta ${question}` : `${question}/${input.itemCount}`;
  const remaining = input.limitMinutes
    ? `, quedan ${formatTime(Math.max(0, input.limitMinutes * 60 - (input.seconds || 0)))}`
    : '';
  return `Tienes sin terminar «${input.title || 'Test'}» (${progress}${remaining}). ¿Continuar donde lo dejaste?`;
}
