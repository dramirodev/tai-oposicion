import { useEffect, useRef, useState } from 'react';
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

export function useQuizExplanation(quiz: QuizServices, promptId: string | undefined, revealed: boolean, studyState: string | undefined, questionIndex: number | undefined) {
  const [result, setResult] = useState<{ id: string; content: string }>({ id: '', content: '' });
  useEffect(() => {
    if (!promptId || !revealed) return;
    let active = true;
    void quiz.loadExplanation().then(value => {
      if (!active) return;
      if (value.status === 'current') setResult({ id: promptId, content: value.content || '' });
      if (value.status === 'outdated') setResult({ id: promptId, content: 'Hay una explicación de una revisión anterior; no se muestra para evitar información desactualizada.' });
    }).catch(() => {});
    return () => { active = false; };
  }, [promptId, quiz, revealed, studyState, questionIndex]);
  return result.id === promptId ? result.content : '';
}
