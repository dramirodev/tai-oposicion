import { useEffect, useRef, useState } from 'react';
import type { ExplanationLookup } from '../../core/domain/explanations.js';
import type { QuizServices } from '../../shared/ui/study-services.js';

export function useQuizClock(quiz: QuizServices) {
  const [clock, setClock] = useState(0);
  const finishingRef = useRef(false);
  const timingOut = useRef(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = quiz.getSnapshot();
      if (!current || current.paused) return;
      quiz.tick();
      setClock(Date.now());
      if (current.remainingSeconds === null || current.remainingSeconds > 0 || timingOut.current) return;
      timingOut.current = true;
      finishingRef.current = true;
      void quiz.finish('timeout').finally(() => { finishingRef.current = false; });
    }, 500);
    return () => window.clearInterval(interval);
  }, [quiz]);

  return { clock, finishingRef };
}

export function useQuizExplanation(quiz: QuizServices, promptId: string | undefined, revealed: boolean, studyState: string | undefined, questionIndex: number | undefined): ExplanationLookup {
  const [result, setResult] = useState<{ id: string; value: ExplanationLookup }>({ id: '', value: { status: 'loading' } });
  useEffect(() => {
    if (!promptId || !revealed) return;
    let active = true;
    void quiz.loadExplanation().then(value => {
      if (!active) return;
      setResult({ id: promptId, value });
    }).catch(() => {
      if (active) setResult({ id: promptId, value: { status: 'unavailable' } });
    });
    return () => { active = false; };
  }, [promptId, quiz, revealed, studyState, questionIndex]);
  return result.id === promptId ? result.value : { status: 'loading' as const };
}
