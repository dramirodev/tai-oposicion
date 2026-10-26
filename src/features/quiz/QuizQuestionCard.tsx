import type { RefObject } from 'react';
import { ORIGEN } from '../../shared/presentation/labels.js';
import { asksForNegativeOption } from '../../core/domain/reading-strategy.js';
import { richHtml } from '../../shared/presentation/study-text.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyServices, type QuizPrompt, type QuizSnapshot } from '../../shared/ui/study-services.js';
import { QuizFeedback } from './QuizFeedback.js';

type HighlightMark = { questionId: string; id: string | null };

function QuestionPrompt({ snapshot, prompt, sourceLabel, responseLocked }: { snapshot: QuizSnapshot; prompt: QuizPrompt; sourceLabel: string; responseLocked: boolean }) {
  const { quiz } = useStudyServices();
  const confidenceLabels = { sure: 'Seguro', betweenTwo: 'Entre dos', guess: 'Adivino' };
  return <>
    <div className="meta"><span className="tag">{prompt.topicId} · {prompt.topicName}</span><span className={`tag o${prompt.origin}`}>{ORIGEN[prompt.origin]}{sourceLabel}</span>{prompt.provisional && <span className="tag warn">Respuesta provisional</span>}{prompt.mayExpire && <span className="tag warn">Puede caducar</span>}{prompt.variant && <span className="tag">Variante</span>}</div>
    {prompt.notice && <StudyMarkup html={prompt.notice} />}
    {prompt.hasAssumption && <details className="sup scenario-context"><summary>Enunciado del supuesto</summary><div className="pre">{prompt.assumptionText}</div></details>}
    {prompt.context && <div className="ctx pre"><StudyMarkup html={richHtml(prompt.context)} /></div>}
    {asksForNegativeOption(prompt.statement) && <div className="pide">Ojo: te piden la opción INCORRECTA o la excepción</div>}
    <div className="enun pre" tabIndex={0} aria-label="Enunciado. Usa Mayús y las flechas para seleccionar texto"><StudyMarkup html={richHtml(prompt.statement, snapshot.readingMode === 1)} /></div>
    <div className="study-signals" aria-label="Señales opcionales de estudio"><span className="study-signals-label">¿Cómo lo ves?</span>{(['sure', 'betweenTwo', 'guess'] as const).map(value => <button type="button" className={`signal${snapshot.confidence === value ? ' on' : ''}`} data-confidence={value} aria-pressed={snapshot.confidence === value} disabled={responseLocked || snapshot.paused} onClick={() => quiz.setConfidence(value)} key={value}>{confidenceLabels[value]}</button>)}</div>
  </>;
}

function QuestionOptions({ snapshot, prompt, rootRef, revealed, responseLocked, gateRemaining }: { snapshot: QuizSnapshot; prompt: QuizPrompt; rootRef: RefObject<HTMLDivElement | null>; revealed: boolean; responseLocked: boolean; gateRemaining: number }) {
  const { quiz } = useStudyServices();
  const discardedOptions = new Set(snapshot.discarded);
  return <div className="opts">{prompt.options.map((option, index) => {
    const selected = snapshot.answer === index;
    const correct = revealed && index === prompt.correctIndex;
    const wrong = revealed && selected && index !== prompt.correctIndex;
    const discarded = discardedOptions.has(index);
    return <div className="option-control" key={`${prompt.id}-${'ABCD'[index]}`}>
      <button type="button" className={`opt${discarded ? ' discarded' : ''}${correct ? ' ok' : wrong ? ' bad' : selected ? ' sel' : ''}${revealed ? ' dis' : ''}`} data-i={index} aria-pressed={selected} disabled={revealed || snapshot.paused || gateRemaining > 0} onClick={() => {
        const currentSelection = window.getSelection();
        if (currentSelection && !currentSelection.isCollapsed && (rootRef.current?.querySelector(`.opt[data-i="${index}"]`)?.contains(currentSelection.anchorNode) || rootRef.current?.querySelector(`.opt[data-i="${index}"]`)?.contains(currentSelection.focusNode))) return;
        quiz.answer(index);
      }}><b>{'ABCD'[index]}</b><span className="pre" aria-label={`Opción ${'ABCD'[index]}. Usa Mayús y las flechas para seleccionar texto`}><StudyMarkup html={richHtml(option, snapshot.readingMode === 1)} /></span>{correct && <span className="sr">(respuesta correcta)</span>}{wrong && <span className="sr">(tu respuesta, incorrecta)</span>}</button>
      <button type="button" className={`discard-option${discarded ? ' on' : ''}`} data-discard-option={index} aria-pressed={discarded} aria-label={`${discarded ? 'Restaurar' : 'Descartar'} opción ${'ABCD'[index]}`} disabled={responseLocked || snapshot.paused || gateRemaining > 0} onClick={() => quiz.toggleDiscard(index)}>{discarded ? 'Restaurar' : 'Descartar'}</button>
    </div>;
  })}</div>;
}

function QuestionHighlightTools({ snapshot, prompt, selection, highlightMark, setHighlightMark, addMark }: { snapshot: QuizSnapshot; prompt: QuizPrompt; selection: boolean; highlightMark: HighlightMark; setHighlightMark: (mark: HighlightMark) => void; addMark: (category: 'key' | 'doubt') => void }) {
  const { quiz } = useStudyServices();
  return <div className="highlight-tools" id="highlight-tools" role="group" aria-label="Subrayado opcional" hidden={!selection || snapshot.paused}><span>Texto seleccionado:</span><button type="button" className="signal" data-add-highlight="key" onMouseDown={event => event.preventDefault()} onClick={() => addMark('key')}>Clave</button><button type="button" className="signal" data-add-highlight="doubt" onMouseDown={event => event.preventDefault()} onClick={() => addMark('doubt')}>Duda</button>{highlightMark.questionId === prompt.id && highlightMark.id && <button type="button" className="signal" data-remove-highlight onClick={() => { quiz.removeHighlight(highlightMark.id!); setHighlightMark({ questionId: prompt.id, id: null }); }}>Quitar marca</button>}</div>;
}

export function QuizQuestionCard({ snapshot, prompt, rootRef, sourceLabel, responseLocked, revealed, gateRemaining, selection, highlightMark, setHighlightMark, addMark, explanation }: {
  snapshot: QuizSnapshot; prompt: QuizPrompt; rootRef: RefObject<HTMLDivElement | null>; sourceLabel: string;
  responseLocked: boolean; revealed: boolean; gateRemaining: number; selection: boolean; highlightMark: HighlightMark;
  setHighlightMark: (mark: HighlightMark) => void; addMark: (category: 'key' | 'doubt') => void; explanation: string;
}) {
  return <div className={`card q${prompt.hasAssumption ? ' with-sup' : ''}`}>
    <QuestionPrompt snapshot={snapshot} prompt={prompt} sourceLabel={sourceLabel} responseLocked={responseLocked} />
    <QuestionOptions snapshot={snapshot} prompt={prompt} rootRef={rootRef} revealed={revealed} responseLocked={responseLocked} gateRemaining={gateRemaining} />
    <QuestionHighlightTools snapshot={snapshot} prompt={prompt} selection={selection} highlightMark={highlightMark} setHighlightMark={setHighlightMark} addMark={addMark} />
    <p className="sub stale-highlight" id="stale-highlight" hidden>Una marca no coincide con el texto actual y no se ha movido.</p>
    {gateRemaining > 0 && <div className="gate" id="gate" role="status">👀 Lee con calma: podrás responder en {gateRemaining} s. ¿Qué te piden? ¿Hay NO, SALVO, cifras?</div>}
    {revealed && <QuizFeedback snapshot={snapshot} prompt={prompt} explanation={explanation} />}
  </div>;
}
