import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { ask } from '../../shared/ui/dialog-actions.js';
import { READING_TIPS } from '../../shared/presentation/study-labels.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { percentage } from '../../shared/presentation/format.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyServices, type ReadingProgress } from '../../shared/ui/study-services.js';

export function ReadingPage() {
  const { reading } = useStudyServices();
  const navigate = useNavigate();
  const progress = useSyncExternalStore(reading.subscribe, reading.getProgress, reading.getProgress);
  const [loading, setLoading] = useState(!progress);
  const [error, setError] = useState(false);
  const [clock, setClock] = useState(0);
  const [tooFast, setTooFast] = useState(false);
  const wordRefs = useRef(new Map<number, HTMLButtonElement>());

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
  if (loading) return <><h1>Lectura atenta</h1><p className="sub loading" role="status">Preparando preguntas…</p></>;
  if (error) return <><h1>Lectura atenta</h1><div className="card" role="alert"><p>No se pudieron cargar preguntas disponibles. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { reading.reset(); setError(false); setLoading(true); }}>Reintentar</button></div></>;
  if (!progress?.items.length) return <><h1>Lectura atenta</h1><div className="card"><p>No hay preguntas disponibles ahora mismo. Comprueba la conexión e inténtalo de nuevo.</p></div><button className="btn" onClick={() => { reading.reset(); setLoading(true); }}>Reintentar</button><button className="btn sec" onClick={() => navigate('/home')}>Inicio</button></>;
  if (progress.complete) return <ReadingSummary progress={progress} onAgain={() => { reading.reset(); setLoading(true); }} onHome={() => navigate('/home')} />;

  const question = progress.items[progress.index];
  const questionCount = progress.items.length;
  const notice = questionNotice({ i: question.id, n: question.note, np: question.nonScoring });
  const source = sourceHtml({ i: question.id, source: question.source, u: question.citation });
  const remaining = Math.max(0, Math.ceil(question.minimumSeconds - (clock - progress.startedAt) / 1000));
  const tokenIndices = question.tokens.map((token, index) => token.text.trim() ? index : -1).filter(index => index >= 0);

  return <>
    <div className="qhead"><button className="ghost" aria-label="Salir" onClick={() => void exit()}>✕</button><div className="prog" role="progressbar" aria-label="Progreso" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={progress.index}><div style={{ width: `${100 * progress.index / questionCount}%` }} /></div><div className="cnt">{progress.index + 1}/{questionCount}</div></div>
    <h1 className="sub">Lectura atenta · paso {progress.step + 1} de 3</h1>
    {progress.step === 0 && <article className="card q">{notice && <StudyMarkup html={notice} />}{source && <StudyMarkup html={source} />}<div className="enun pre"><StudyMarkup html={richHtml(question.statement)} /></div><p><b>1. ¿Qué te piden?</b> Antes de ver las opciones.</p>
      <div className="opts"><button className={`opt${progress.meaningChoice === 0 && progress.meaningCorrect !== null ? progress.meaningCorrect ? ' ok' : ' bad' : ''}`} disabled={progress.meaningChoice !== null} onClick={() => reading.answerMeaning(0)}><b>✔</b><span>La opción CORRECTA / VERDADERA</span></button><button className={`opt${progress.meaningChoice === 1 && progress.meaningCorrect !== null ? progress.meaningCorrect ? ' ok' : ' bad' : ''}`} disabled={progress.meaningChoice !== null} onClick={() => reading.answerMeaning(1)}><b>✖</b><span>La INCORRECTA / FALSA / la excepción</span></button></div>
      {progress.meaningChoice !== null && <><div className={`fb ${progress.meaningCorrect ? 'good' : 'wrong'}`} role="status"><b>{progress.meaningCorrect ? '¡Bien leído!' : 'Ojo: lo habías leído al revés.'}</b> Te piden la opción <b>{question.asksForNegative ? 'INCORRECTA / excepción' : 'CORRECTA'}</b>.</div><div className="bar2"><button className="btn" onClick={() => reading.continueMeaning()}>Siguiente →</button></div></>}
    </article>}

    {progress.step === 1 && <article className="card q">{notice && <StudyMarkup html={notice} />}{source && <StudyMarkup html={source} />}<p><b>2. Toca las palabras que cambian el sentido</b> (negaciones, excepciones, absolutos, cifras y plazos).</p><p id="word-help" className="sm">Con teclado: usa las flechas para moverte, Inicio y Fin para ir a los extremos, y Espacio o Intro para marcar. Tabulador sale del grupo.</p>
      <div className="enun pre tks" role="group" aria-label="Palabras del enunciado" aria-describedby="word-help">{question.tokens.map((token, index) => token.text.trim() ? <button key={index} type="button" className={`tk${progress.selectedWords.includes(index) ? ' on' : ''}${progress.wordResult && token.key ? ' key' : ''}`} tabIndex={index === tokenIndices[0] ? 0 : -1} aria-pressed={progress.selectedWords.includes(index)} ref={element => { if (element) wordRefs.current.set(index, element); else wordRefs.current.delete(index); }} onClick={() => { if (!progress.wordResult) reading.toggleWord(index); }} onKeyDown={event => {
        const currentPosition = tokenIndices.indexOf(index);
        const offset = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (offset || event.key === 'Home' || event.key === 'End') { event.preventDefault(); const target = event.key === 'Home' ? tokenIndices[0] : event.key === 'End' ? tokenIndices[tokenIndices.length - 1] : tokenIndices[(currentPosition + offset + tokenIndices.length) % tokenIndices.length]; wordRefs.current.get(target)?.focus(); }
        else if ((event.key === ' ' || event.key === 'Enter') && !progress.wordResult) { event.preventDefault(); reading.toggleWord(index); }
      }}>{token.text}</button> : token.text)}</div>
      {progress.wordResult && <><div className={`fb ${progress.wordResult.missed ? 'wrong' : 'good'}`} role="status">{progress.wordResult.claimedNone ? progress.wordResult.total === 0 ? <><b>Correcto:</b> no hay palabras clave destacables. Lo importante es entender bien qué pide.</> : <><b>Ojo:</b> sí había {progress.wordResult.total} palabra{progress.wordResult.total === 1 ? '' : 's'} clave (resaltada{progress.wordResult.total === 1 ? '' : 's'}). Mira qué cambia el sentido.</> : progress.wordResult.total ? <>Detectaste <b>{progress.wordResult.hit}</b> de <b>{progress.wordResult.total}</b> palabras clave{progress.wordResult.missed ? ' (las que faltaban están resaltadas)' : ''}.{progress.wordResult.extra ? ` Marcaste ${progress.wordResult.extra} que no eran clave.` : ''}</> : 'Esta pregunta no tiene palabras clave destacables: lo importante es entender bien qué pide.'}</div><div className="bar2"><button className="btn" onClick={() => reading.showOptions()}>Ver opciones →</button></div></>}
      {!progress.wordResult && <div className="bar2"><button className="btn sec" onClick={() => reading.checkWords(true)}>No contiene</button><button className="btn" onClick={() => reading.checkWords()}>Continuar</button></div>}
    </article>}

    {progress.step === 2 && <article className="card q">{notice && <StudyMarkup html={notice} />}{source && <StudyMarkup html={source} />}<div className="enun pre"><StudyMarkup html={richHtml(question.statement, true)} /></div><p className="sm"><b>3. Lee las cuatro opciones enteras</b> antes de responder.</p>
      <div className="opts">{question.options.map((option, index) => <button key={`${question.id}-${index}`} className={`opt${progress.selectedAnswer === null ? '' : index === question.correctIndex ? ' ok' : progress.selectedAnswer === index ? ' bad' : ' dis'}`} disabled={remaining > 0 || progress.selectedAnswer !== null} onClick={() => { setTooFast(reading.answerOption(index) === false); }}><b>{'ABCD'[index]}</b><span className="pre"><StudyMarkup html={richHtml(option, true)} /></span></button>)}</div>
      {remaining > 0 && <p className="gate" role="status">Lectura mínima: {remaining} s</p>}{tooFast && remaining > 0 && <p className="sub">Lee el enunciado y las opciones antes de responder.</p>}
      {progress.selectedAnswer !== null && <><div className={`fb ${progress.answerCorrect ? 'good' : 'wrong'}`} role="status"><b>{progress.answerCorrect ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>{'ABCD'[question.correctIndex]}</b>{question.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(question.citation, question.options[question.correctIndex])} /></div>}{question.note && <div className="cita"><span>Nota</span>{question.note}</div>}</div><div className="bar2"><button className="btn" onClick={() => reading.next()}>{progress.index + 1 === questionCount ? 'Terminar' : 'Siguiente'} →</button></div></>}
    </article>}
  </>;
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
