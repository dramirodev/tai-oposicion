import { useEffect, useRef, type RefObject } from 'react';
import type { QuizServices, QuizSnapshot } from '../../shared/ui/study-services.js';

export function useQuizPageEffects(quiz: QuizServices, snapshot: QuizSnapshot | null, root: RefObject<HTMLDivElement | null>, heading: RefObject<HTMLHeadingElement | null>) {
  const wasPausedRef = useRef(false);
  const questionIndex = snapshot?.index;
  useEffect(() => { if (questionIndex !== undefined) quiz.startCurrentQuestion(); }, [quiz, questionIndex]);
  useEffect(() => { if (snapshot) quiz.persist(); }, [quiz, snapshot]);
  useEffect(() => () => quiz.cancelConfirmation(), [quiz]);
  useEffect(() => {
    if (questionIndex === undefined) return;
    heading.current?.setAttribute('tabindex', '-1');
    heading.current?.focus({ preventScroll: true });
  }, [heading, questionIndex]);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    host.querySelectorAll<HTMLElement>('.qhead,.study-run-title,.pace,.card.q,.bar2').forEach(element => { element.inert = !!snapshot?.paused; });
    if (snapshot?.paused) host.querySelector<HTMLElement>('#resume')?.focus();
    else if (wasPausedRef.current) host.querySelector<HTMLElement>('#pause')?.focus();
    wasPausedRef.current = !!snapshot?.paused;
  }, [root, snapshot?.index, snapshot?.paused]);
}
