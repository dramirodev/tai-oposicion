import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { ask } from '../../shared/ui/dialog-actions.js';
import { READING_TIPS } from '../../shared/presentation/study-labels.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { percentage } from '../../shared/presentation/format.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyServices, type ReadingProgress, type ReadingPrompt, type ReadingServices } from '../../shared/ui/study-services.js';

export function ReadingPage() {
  const { reading } = useStudyServices();
  const navigate = useNavigate();
  const progress = useSyncExternalStore(reading.subscribe, reading.getProgress, reading.getProgress);
  const [loading, setLoading] = useState(!progress);
  const [error, setError] = useState(false);
  const [clock, setClock] = useState(0);

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
  if (loading && !progress) return <><h1>Lectura atenta</h1><p className="sub loading" role="status">Preparando preguntas…</p></>;
  if (error && !progress) return <><h1>Lectura atenta</h1><div className="card" role="alert"><p>No se pudieron cargar preguntas disponibles. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { reading.reset(); setError(false); setLoading(true); }}>Reintentar</button></div></>;
  if (!progress?.items.length) return <><h1>Lectura atenta</h1><div className="card"><p>No hay preguntas disponibles ahora mismo. Comprueba la conexión e inténtalo de nuevo.</p></div><button className="btn" onClick={() => { reading.reset(); setLoading(true); }}>Reintentar</button><button className="btn sec" onClick={() => navigate('/home')}>Inicio</button></>;
  if (progress.complete) return <ReadingSummary progress={progress} onAgain={() => { reading.reset(); setLoading(true); }} onHome={() => navigate('/home')} />;

  const question = progress.items[progress.index];
  const questionCount = progress.items.length;
  return <>
    <div className="qhead"><button className="ghost" aria-label="Salir" onClick={() => void exit()}>✕</button><div className="prog" role="progressbar" aria-label="Progreso" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={progress.index}><div style={{ width: `${100 * progress.index / questionCount}%` }} /></div><div className="cnt">{progress.index + 1}/{questionCount}</div></div>
    <h1 className="sub">Lectura atenta · paso {progress.step + 1} de 3</h1>
    {progress.step === 0 && <MeaningStep question={question} progress={progress} reading={reading} />}
    {progress.step === 1 && <KeywordStep question={question} progress={progress} reading={reading} />}
    {progress.step === 2 && <OptionsStep question={question} progress={progress} reading={reading} clock={clock} questionCount={questionCount} />}
  </>;
}

function QuestionSources({ question }: { question: ReadingPrompt }) {
  const notice = questionNotice({ i: question.id, n: question.note, np: question.nonScoring });
  const source = sourceHtml({ i: question.id, source: question.source, u: question.citation });
  return <>{notice && <StudyMarkup html={notice} />}{source && <StudyMarkup html={source} />}</>;
}

function MeaningStep({ question, progress, reading }: { question: ReadingPrompt; progress: ReadingProgress; reading: ReadingServices }) {
  return <article className="card q"><QuestionSources question={question} /><div className="enun pre"><StudyMarkup html={richHtml(question.statement)} /></div><p><b>1. ¿Qué te piden?</b> Antes de ver las opciones.</p>
    <div className="opts"><button className={`opt${progress.meaningChoice === 0 && progress.meaningCorrect !== null ? progress.meaningCorrect ? ' ok' : ' bad' : ''}`} disabled={progress.meaningChoice !== null} onClick={() => reading.answerMeaning(0)}><b>✔</b><span>La opción CORRECTA / VERDADERA</span></button><button className={`opt${progress.meaningChoice === 1 && progress.meaningCorrect !== null ? progress.meaningCorrect ? ' ok' : ' bad' : ''}`} disabled={progress.meaningChoice !== null} onClick={() => reading.answerMeaning(1)}><b>✖</b><span>La INCORRECTA / FALSA / la excepción</span></button></div>
    {progress.meaningChoice !== null && <><div className={`fb ${progress.meaningCorrect ? 'good' : 'wrong'}`} role="status"><b>{progress.meaningCorrect ? '¡Bien leído!' : 'Ojo: lo habías leído al revés.'}</b> Te piden la opción <b>{question.asksForNegative ? 'INCORRECTA / excepción' : 'CORRECTA'}</b>.</div><div className="bar2"><button className="btn" onClick={() => reading.continueMeaning()}>Siguiente →</button></div></>}
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
  return <div className={`fb ${result.missed ? 'wrong' : 'good'}`} role="status">{message}</div>;
}

function OptionsStep({ question, progress, reading, clock, questionCount }: { question: ReadingPrompt; progress: ReadingProgress; reading: ReadingServices; clock: number; questionCount: number }) {
  const [tooFast, setTooFast] = useState(false);
  const remaining = Math.max(0, Math.ceil(question.minimumSeconds - (clock - progress.startedAt) / 1000));
  return <article className="card q"><QuestionSources question={question} /><div className="enun pre"><StudyMarkup html={richHtml(question.statement, true)} /></div><p className="sm"><b>3. Lee las cuatro opciones enteras</b> antes de responder.</p>
    <div className="opts">{question.options.map((option, index) => <button key={`${question.id}-${index}`} className={`opt${progress.selectedAnswer === null ? '' : index === question.correctIndex ? ' ok' : progress.selectedAnswer === index ? ' bad' : ' dis'}`} disabled={remaining > 0 || progress.selectedAnswer !== null} onClick={() => { setTooFast(reading.answerOption(index) === false); }}><b>{'ABCD'[index]}</b><span className="pre"><StudyMarkup html={richHtml(option, true)} /></span></button>)}</div>
    {remaining > 0 && <p className="gate" role="status">Lectura mínima: {remaining} s</p>}{tooFast && remaining > 0 && <p className="sub">Lee el enunciado y las opciones antes de responder.</p>}
    {progress.selectedAnswer !== null && <><div className={`fb ${progress.answerCorrect ? 'good' : 'wrong'}`} role="status"><b>{progress.answerCorrect ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>{'ABCD'[question.correctIndex]}</b>{question.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(question.citation, question.options[question.correctIndex])} /></div>}{question.note && <div className="cita"><span>Nota</span>{question.note}</div>}</div><div className="bar2"><button className="btn" onClick={() => reading.next()}>{progress.index + 1 === questionCount ? 'Terminar' : 'Siguiente'} →</button></div></>}
  </article>;
}

function ReadingSummary({ progress, onAgain, onHome }: { progress: ReadingProgress; onAgain(): void; onHome(): void }) {
  const total = progress.outcomes.length;
  const correct = progress.outcomes.filter(outcome => outcome.correct).length;
  const meaning = progress.outcomes.filter(outcome => outcome.meaningCorrect).length;
  const marked = progress.outcomes.reduce((sum, outcome) => sum + outcome.marked[0], 0);
  const keywords = progress.outcomes.reduce((sum, outcome) => sum + outcome.marked[1], 0);
  return <><h1>Lectura atenta</h1><div className="grid"><div className="stat"><b>{correct}/{total}</b><span>aciertos</span></div><div className="stat"><b>{meaning}/{total}</b><span>«qué piden» bien</span></div><div className="stat"><b>{keywords ? `${percentage(marked, keywords)}%` : '—'}</b><span>palabras clave</span></div></div>
    <div className="card"><h2 className="h3">Método de 3 pasos</h2><ul className="tips">{READING_TIPS.map(tip => <li key={tip}>{tip}</li>)}</ul></div>
    <div className="bar2"><button className="btn" onClick={onAgain}>Otra tanda</button><button className="btn sec" onClick={onHome}>Inicio</button></div>
  </>;
}
