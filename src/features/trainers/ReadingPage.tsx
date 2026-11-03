import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ask } from '../../shared/ui/dialog-actions.js';
import { READING_TIPS } from '../../shared/presentation/study-labels.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { percentage } from '../../shared/presentation/format.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyService, type ReadingProgress, type ReadingPrompt, type ReadingServices } from '../../shared/ui/study-services.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { StudyFeedback } from '../../shared/ui/StudyFeedback.js';
import { StudyQuestionSources } from '../../shared/ui/StudyQuestionSources.js';
import { StudyProgressBar } from '../../shared/ui/StudyProgressBar.js';
import { StudyExitButton } from '../../shared/ui/StudyExitButton.js';

export function ReadingPage() {
  const reading = useStudyService('reading');
  const navigate = useNavigate();
  const progress = useSyncExternalStore(reading.subscribe, reading.getProgress, reading.getProgress);
  const [loading, setLoading] = useState(!progress);
  const [error, setError] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (progress) return;
    let active = true;
    void reading.start().then(value => { if (active) { setError(false); setLoading(false); if (!value) setError(true); } }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [progress, reading]);
  useEffect(() => {
    if (progress?.step !== 2 || progress.selectedAnswer !== null) return;
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [progress?.step, progress?.selectedAnswer, progress?.index]);

  const exit = async () => { if (await ask('¿Salir del ejercicio?', 'Salir')) { reading.reset(); navigate('/home'); } };
  if (loading && !progress) return <PageLoading variant="study" />;
  if (error && !progress) return <><h1>Lectura atenta</h1><div className="card" role="alert"><p>No se pudieron cargar preguntas disponibles. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { reading.reset(); setError(false); setLoading(true); }}>Reintentar</button></div></>;
  if (!progress?.items.length) return <><h1>Lectura atenta</h1><div className="card"><p>No hay preguntas disponibles ahora mismo. Comprueba la conexión e inténtalo de nuevo.</p></div><button className="btn" onClick={() => { reading.reset(); setLoading(true); }}>Reintentar</button><button className="btn sec" onClick={() => navigate('/home')}>Inicio</button></>;
  if (progress.complete) return <ReadingSummary progress={progress} onAgain={() => { reading.reset(); setLoading(true); }} onHome={() => navigate('/home')} />;

  const question = progress.items[progress.index];
  const questionCount = progress.items.length;
  return <>
    <div className="qhead sticky top-[calc(var(--sat)/var(--z,1))] z-[3] mb-4 flex items-center gap-4 border-b-0 bg-canvas py-3"><StudyExitButton onExit={() => void exit()} /><StudyProgressBar trackClassName="prog min-w-0 h-[.375rem] flex-1 overflow-hidden rounded-full bg-line" percent={100 * progress.index / questionCount} valueNow={progress.index} valueMax={questionCount} /><div className="cnt min-w-11 text-right text-[length:var(--fs-m)] font-semibold text-muted">{progress.index + 1}/{questionCount}</div></div>
    <h1 className="sub">Lectura atenta · paso {progress.step + 1} de 3</h1>
    {progress.step === 0 && <MeaningStep question={question} progress={progress} reading={reading} />}
    {progress.step === 1 && <KeywordStep question={question} progress={progress} reading={reading} />}
    {progress.step === 2 && <OptionsStep question={question} progress={progress} reading={reading} clock={clock} questionCount={questionCount} />}
  </>;
}

function QuestionSources({ question }: { question: ReadingPrompt }) {
  return <StudyQuestionSources
    noticeHtml={questionNotice({ i: question.id, n: question.note, np: question.nonScoring })}
    sourceHtml={sourceHtml({ i: question.id, source: question.source, u: question.citation })}
    languageContext={question.statement}
  />;
}

function MeaningStep({ question, progress, reading }: { question: ReadingPrompt; progress: ReadingProgress; reading: ReadingServices }) {
  return <article className="card q"><QuestionSources question={question} /><div className="enun pre"><StudyMarkup html={richHtml(question.statement)} languageContext={question.statement} /></div><p><b>1. ¿Qué te piden?</b> Antes de ver las opciones.</p>
    <div className="opts"><button className={`opt${progress.meaningChoice === 0 && progress.meaningCorrect !== null ? progress.meaningCorrect ? ' ok' : ' bad' : ''}`} disabled={progress.meaningChoice !== null} onClick={() => reading.answerMeaning(0)}><b><Check aria-hidden="true" /></b><span>La opción CORRECTA / VERDADERA</span></button><button className={`opt${progress.meaningChoice === 1 && progress.meaningCorrect !== null ? progress.meaningCorrect ? ' ok' : ' bad' : ''}`} disabled={progress.meaningChoice !== null} onClick={() => reading.answerMeaning(1)}><b><X aria-hidden="true" /></b><span>La INCORRECTA / FALSA / la excepción</span></button></div>
    {progress.meaningChoice !== null && <><StudyFeedback tone={progress.meaningCorrect ? 'good' : 'wrong'}><b>{progress.meaningCorrect ? '¡Bien leído!' : 'Ojo: lo habías leído al revés.'}</b> Te piden la opción <b>{question.asksForNegative ? 'INCORRECTA / excepción' : 'CORRECTA'}</b>.</StudyFeedback><div className="bar2"><button className="btn" onClick={() => reading.continueMeaning()}>Siguiente →</button></div></>}
  </article>;
}

function KeywordStep({ question, progress, reading }: { question: ReadingPrompt; progress: ReadingProgress; reading: ReadingServices }) {
  return <article className="card q"><QuestionSources question={question} /><p><b>2. Toca las palabras que cambian el sentido</b> (negaciones, excepciones, absolutos, cifras y plazos).</p><p id="word-help" className="sm">Con teclado: usa las flechas para moverte, Inicio y Fin para ir a los extremos, y Espacio o Intro para marcar. Tabulador sale del grupo.</p>
    <WordSelector question={question} progress={progress} reading={reading} />
    {progress.wordResult ? <><WordFeedback result={progress.wordResult} /><div className="bar2"><button className="btn" onClick={() => reading.showOptions()}>Ver opciones →</button></div></> : <div className="bar2"><button className="btn sec" onClick={() => reading.checkWords(true)}>No contiene</button><button className="btn" onClick={() => reading.checkWords()}>Continuar</button></div>}
  </article>;
}

function WordSelector({ question, progress, reading }: { question: ReadingPrompt; progress: ReadingProgress; reading: ReadingServices }) {
  const wordRefs = useRef(new Map<number, HTMLButtonElement>());
  const selectedWords = new Set(progress.selectedWords);
  const tokenIndices = question.tokens.flatMap((token, index) => token.text.trim() ? [index] : []);
  const tokenPositions = new Map(tokenIndices.map((index, position) => [index, position]));
  const tokenIndexesByPosition = new Map(tokenIndices.map((index, position) => [position, index]));
  const firstTokenIndex = tokenIndices[0];
  const lastTokenIndex = tokenIndices[tokenIndices.length - 1];
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const currentPosition = tokenPositions.get(index) ?? 0;
    const offset = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (offset || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const position = (currentPosition + offset + tokenIndices.length) % tokenIndices.length;
      const target = event.key === 'Home' ? firstTokenIndex : event.key === 'End' ? lastTokenIndex : tokenIndexesByPosition.get(position);
      if (target !== undefined) wordRefs.current.get(target)?.focus();
    } else if ((event.key === ' ' || event.key === 'Enter') && !progress.wordResult) {
      event.preventDefault(); reading.toggleWord(index);
    }
  };
  return <div className="enun pre tks" role="group" aria-label="Palabras del enunciado" aria-describedby="word-help">{question.tokens.map((token, index) => token.text.trim() ? <button key={`${question.id}-${token.start}`} type="button" className={`tk${selectedWords.has(index) ? ' on' : ''}${progress.wordResult && token.key ? ' key' : ''}`} tabIndex={index === firstTokenIndex ? 0 : -1} aria-pressed={selectedWords.has(index)} ref={element => { if (element) wordRefs.current.set(index, element); else wordRefs.current.delete(index); }} onClick={() => { if (!progress.wordResult) reading.toggleWord(index); }} onKeyDown={event => onKeyDown(event, index)}>{token.text}</button> : token.text)}</div>;
}

function WordFeedback({ result }: { result: NonNullable<ReadingProgress['wordResult']> }) {
  let message = <>Esta pregunta no tiene palabras clave destacables: lo importante es entender bien qué pide.</>;
  if (result.claimedNone && result.total === 0) message = <><b>Correcto:</b> no hay palabras clave destacables. Lo importante es entender bien qué pide.</>;
  else if (result.claimedNone) message = <><b>Ojo:</b> sí había {result.total} palabra{result.total === 1 ? '' : 's'} clave (resaltada{result.total === 1 ? '' : 's'}). Mira qué cambia el sentido.</>;
  else if (result.total) message = <>Detectaste <b>{result.hit}</b> de <b>{result.total}</b> palabras clave{result.missed ? ' (las que faltaban están resaltadas)' : ''}.{result.extra ? ` Marcaste ${result.extra} que no eran clave.` : ''}</>;
  return <StudyFeedback tone={result.missed ? 'wrong' : 'good'}>{message}</StudyFeedback>;
}

function OptionsStep({ question, progress, reading, clock, questionCount }: { question: ReadingPrompt; progress: ReadingProgress; reading: ReadingServices; clock: number; questionCount: number }) {
  const [tooFast, setTooFast] = useState(false);
  const remaining = Math.max(0, Math.ceil(question.minimumSeconds - (clock - progress.startedAt) / 1000));
  return <article className="card q"><QuestionSources question={question} /><div className="enun pre"><StudyMarkup html={richHtml(question.statement, true)} languageContext={question.statement} /></div><p className="sm"><b>3. Lee las cuatro opciones enteras</b> antes de responder.</p>
    <div className="opts">{question.options.map((option, index) => <button key={`${question.id}-${index}`} className={`opt${progress.selectedAnswer === null ? '' : index === question.correctIndex ? ' ok' : progress.selectedAnswer === index ? ' bad' : ' dis'}`} disabled={remaining > 0 || progress.selectedAnswer !== null} onClick={() => { setTooFast(reading.answerOption(index) === false); }}><b>{'ABCD'[index]}</b><span className="pre"><StudyMarkup html={richHtml(option, true)} languageContext={question.statement} /></span></button>)}</div>
    {remaining > 0 && <p className="gate" role="status">Lectura mínima: {remaining} s</p>}{tooFast && remaining > 0 && <p className="sub">Lee el enunciado y las opciones antes de responder.</p>}
    {progress.selectedAnswer !== null && <><StudyFeedback tone={progress.answerCorrect ? 'good' : 'wrong'}><b>{progress.answerCorrect ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>{'ABCD'[question.correctIndex]}</b>{question.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(question.citation, question.options[question.correctIndex])} languageContext={question.statement} /></div>}{question.note && <div className="cita"><span>Nota</span><StudyMarkup html={richHtml(question.note)} languageContext={question.statement} /></div>}</StudyFeedback><div className="bar2"><button className="btn" onClick={() => reading.next()}>{progress.index + 1 === questionCount ? 'Terminar' : 'Siguiente'} →</button></div></>}
  </article>;
}

function ReadingSummary({ progress, onAgain, onHome }: { progress: ReadingProgress; onAgain(): void; onHome(): void }) {
  const total = progress.outcomes.length;
  const correct = progress.outcomes.filter(outcome => outcome.correct).length;
  const meaning = progress.outcomes.filter(outcome => outcome.meaningCorrect).length;
  const marked = progress.outcomes.reduce((sum, outcome) => sum + outcome.marked[0], 0);
  const keywords = progress.outcomes.reduce((sum, outcome) => sum + outcome.marked[1], 0);
  return <><h1>Lectura atenta</h1><div className="stats-grid"><div className="stat"><b>{correct}/{total}</b><span>aciertos</span></div><div className="stat"><b>{meaning}/{total}</b><span>«qué piden» bien</span></div><div className="stat"><b>{keywords ? `${percentage(marked, keywords)}%` : '—'}</b><span>palabras clave</span></div></div>
    <div className="card"><h2 className="h3">Método de 3 pasos</h2><ul className="tips">{READING_TIPS.map(tip => <li key={tip}>{tip}</li>)}</ul></div>
    <div className="bar2"><button className="btn" onClick={onAgain}>Otra tanda</button><button className="btn sec" onClick={onHome}>Inicio</button></div>
  </>;
}
