import { Check } from 'lucide-react';
import type { QuizSnapshot } from '../../shared/ui/study-services.js';

export function QuizQuestionMap({ snapshot, onJump }: { snapshot: QuizSnapshot; onJump: (index: number) => void }) {
  const review = new Set(snapshot.review);
  const answered = snapshot.feedback
    ? snapshot.studyStates.filter(state => state === 'answered').length
    : snapshot.answers.filter(answer => answer !== undefined && answer >= 0).length;
  const summary = snapshot.feedback
    ? `${answered} respondidas · ${snapshot.studyStates.filter(state => state === 'pending').length} pendientes · ${snapshot.studyStates.filter(state => state === 'revealed').length} consultadas`
    : `${answered} respondidas · ${snapshot.review.length} para revisar`;
  return <details className="question-map">
    <summary>Mapa de preguntas · {summary}</summary>
    <div className="question-grid">{snapshot.questionIds.map((questionId, index) => {
      const status = questionStatus(snapshot, index);
      const label = questionStatusLabel(status, snapshot.feedback);
      return <button key={questionId} data-jump={index} aria-current={index === snapshot.index ? 'step' : undefined} className={status} onClick={() => onJump(index)}>
        {index + 1}<small>{label}{review.has(index) ? ' · Revisar' : ''}</small>
      </button>;
    })}</div>
  </details>;
}

export function QuizNavigation({ snapshot, onPrevious, onNext, onBlank, onReveal, onToggleBlank, onToggleReview }: {
  snapshot: QuizSnapshot;
  onPrevious: () => void;
  onNext: () => void;
  onBlank: () => void;
  onReveal: () => void;
  onToggleBlank: () => void;
  onToggleReview: () => void;
}) {
  const lastQuestion = snapshot.index + 1 === snapshot.count;
  return <>
    {!snapshot.feedback && <ReviewQuestionButton snapshot={snapshot} onToggleReview={onToggleReview} />}
    {snapshot.feedback && snapshot.studyState === 'pending' && <p className="note">Si ves la solución, ya no podrás responder esta pregunta en este intento.</p>}
    <div className="bar2">
      {snapshot.feedback ? <>
        <button className="btn sec" id="prev" disabled={snapshot.index === 0 || snapshot.paused} onClick={onPrevious}>← Anterior</button>
        <FeedbackAnswerAction snapshot={snapshot} onBlank={onBlank} onReveal={onReveal} />
        <NextQuestionButton paused={snapshot.paused} lastQuestion={lastQuestion} onNext={onNext} />
      </> : <>
        <PracticeNavigation snapshot={snapshot} lastQuestion={lastQuestion} onNext={onNext} onToggleBlank={onToggleBlank} />
      </>}
    </div>
  </>;
}

function ReviewQuestionButton({ snapshot, onToggleReview }: { snapshot: QuizSnapshot; onToggleReview: () => void }) {
  const marked = snapshot.review.includes(snapshot.index);
  return <button className="ghost" id="review-question" aria-pressed={marked} onClick={onToggleReview}>
    {marked && <Check size="1em" aria-hidden="true" />} {marked ? 'Marcada para revisar' : 'Marcar para revisar'}
  </button>;
}

function FeedbackAnswerAction({ snapshot, onBlank, onReveal }: { snapshot: QuizSnapshot; onBlank: () => void; onReveal: () => void }) {
  if (snapshot.studyState === 'unseen') return <button className="btn sec" id="blank" disabled={snapshot.paused} onClick={onBlank}>No lo sé</button>;
  if (snapshot.studyState === 'pending') return <><span className="tag warn" role="status">Pendiente</span><button className="btn sec" id="reveal-solution" disabled={snapshot.paused} onClick={onReveal}>Ver solución</button></>;
  if (snapshot.studyState === 'revealed') return <span className="tag warn" role="status">Solución consultada · blanco</span>;
  return <span className="tag" role="status">Respondida</span>;
}

function PracticeNavigation({ snapshot, lastQuestion, onNext, onToggleBlank }: { snapshot: QuizSnapshot; lastQuestion: boolean; onNext: () => void; onToggleBlank: () => void }) {
  const blank = snapshot.answer === -1;
  return <>
    <button className="btn sec" id="blank" disabled={snapshot.paused} onClick={onToggleBlank}>{blank && <Check size="1em" aria-hidden="true" />} {blank ? 'En blanco' : 'Dejar en blanco'}</button>
    <NextQuestionButton paused={snapshot.paused} lastQuestion={lastQuestion} onNext={onNext} />
  </>;
}

function NextQuestionButton({ paused, lastQuestion, onNext }: { paused: boolean; lastQuestion: boolean; onNext: () => void }) {
  return <button className="btn" id="next" disabled={paused} onClick={onNext}>{lastQuestion ? 'Terminar' : 'Siguiente'} →</button>;
}

function questionStatus(snapshot: QuizSnapshot, index: number): 'unseen' | 'pending' | 'revealed' | 'answered' | 'blank' {
  if (snapshot.feedback) return snapshot.studyStates[index] || 'unseen';
  const answer = snapshot.answers[index];
  return answer === undefined ? 'unseen' : answer === -1 ? 'blank' : 'answered';
}

function questionStatusLabel(status: ReturnType<typeof questionStatus>, feedback: boolean) {
  const labels = { unseen: feedback ? 'Sin visitar' : 'Sin responder', pending: 'Pendiente', revealed: 'Solución consultada', answered: 'Respondida', blank: 'En blanco' };
  return labels[status];
}
