import type { ReactNode } from 'react';

type StudyFeedbackTone = 'good' | 'wrong' | 'note';

export function StudyFeedback({ tone, children }: { tone: StudyFeedbackTone; children: ReactNode }) {
  return <div className={`fb motion-safe:animate-[fbin_.2s_ease-out] ${tone}`} role="status">{children}</div>;
}
