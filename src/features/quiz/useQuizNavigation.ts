import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { QuizServices } from '../../shared/ui/study-services.js';

export function useQuizNavigation(quiz: QuizServices, finishingRef: MutableRefObject<boolean>) {
  const markBlank = useCallback(() => {
    quiz.markBlank();
    window.getSelection()?.removeAllRanges();
    window.scrollTo(0, 0);
  }, [quiz]);
  const moveNext = useCallback(async () => {
    const current = quiz.getSnapshot();
    if (!current || finishingRef.current) return;
    if (current.index === current.count - 1) {
      finishingRef.current = true;
      try { await quiz.finish(); }
      finally { finishingRef.current = false; }
      return;
    }
    quiz.setIndex(current.index + 1);
    window.scrollTo(0, 0);
  }, [finishingRef, quiz]);
  const movePrevious = useCallback(() => {
    const current = quiz.getSnapshot();
    if (!current || current.paused || current.index <= 0) return;
    quiz.setIndex(current.index - 1);
    window.scrollTo(0, 0);
  }, [quiz]);
  return { markBlank, moveNext, movePrevious };
}
