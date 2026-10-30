import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useStudyService } from '../../shared/ui/study-services.js';
import { QuizQuestionCard } from './QuizQuestionCard.js';
import { QuizNavigation, QuizQuestionMap } from './QuizProgressNavigation.js';
import { QuizPauseDialog, QuizSessionHeader } from './QuizSessionHeader.js';
import { useQuizInteractions } from './useQuizInteractions.js';
import { useQuizClock, useQuizExplanation } from './useQuizLifecycle.js';
import { useQuizNavigation } from './useQuizNavigation.js';
import { quizIsRevealed, quizPageState } from './quiz-page-state.js';
import { useQuizPageEffects } from './useQuizPageEffects.js';

function useQuizSnapshot() {
  const quiz = useStudyService('quiz');
  const [snapshot, setSnapshot] = useState(() => quiz.getSnapshot());
  useEffect(() => quiz.subscribe(() => setSnapshot(quiz.getSnapshot())), [quiz]);
  return snapshot;
}

export function QuizPage() {
  const quiz = useStudyService('quiz');
  const snapshot = useQuizSnapshot();
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const prompt = snapshot?.prompt;
  const promptId = prompt?.id, studyState = snapshot?.studyState, questionIndex = snapshot?.index;
  const { clock, finishingRef } = useQuizClock(quiz);
  const explanation = useQuizExplanation(quiz, promptId, quizIsRevealed(snapshot), studyState, questionIndex);
  const { markBlank, moveNext, movePrevious } = useQuizNavigation(quiz, finishingRef);
  const { selection, highlightMark, setHighlightMark, addMark } = useQuizInteractions({ root, snapshot, prompt, moveNext, movePrevious, markBlank });
  useQuizPageEffects(quiz, snapshot, root, heading);

  if (!snapshot || !prompt) return <><h1>Sesión de estudio</h1><p className="note">No hay una sesión activa. <Link to="/home">Volver al inicio</Link></p></>;
  const { responseLocked, sourceLabel, pace, revealed, gateRemaining } = quizPageState(snapshot, prompt, clock);
  return <div ref={root} className="quiz-page">
    <QuizSessionHeader snapshot={snapshot} pace={pace} headingRef={heading} onExit={() => void quiz.exit()} onPause={() => quiz.setPaused(true)} />
    <QuizQuestionMap snapshot={snapshot} onJump={index => { quiz.setIndex(index); window.scrollTo(0, 0); }} />
    <QuizQuestionCard key={prompt.id} snapshot={snapshot} prompt={prompt} rootRef={root} sourceLabel={sourceLabel} responseLocked={responseLocked} revealed={revealed} gateRemaining={gateRemaining} selection={selection} highlightMark={highlightMark} setHighlightMark={setHighlightMark} addMark={addMark} explanation={explanation} />
    <QuizNavigation snapshot={snapshot} onPrevious={movePrevious} onNext={() => void moveNext()} onBlank={markBlank} onReveal={() => { if (quiz.reveal()) window.scrollTo(0, 0); }} onToggleBlank={() => quiz.toggleBlank()} onToggleReview={() => quiz.toggleReview()} />
    <QuizPauseDialog paused={snapshot.paused} onResume={() => quiz.setPaused(false)} />
  </div>;
}
