import { useState } from 'react';
import { TRAMPAS } from '../../shared/presentation/labels.js';
import { FAILURE_REASONS } from '../../shared/presentation/study-labels.js';
import { hiliteHtml } from '../../shared/presentation/study-text.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyServices, type QuizPrompt, type QuizSnapshot } from '../../shared/ui/study-services.js';

function FeedbackMessage({ snapshot, prompt }: { snapshot: QuizSnapshot; prompt: QuizPrompt }) {
  const message = snapshot.studyState === 'revealed' ? 'Solución consultada · cuenta como blanco'
    : snapshot.answer === -1 ? 'Sin responder'
      : snapshot.answer === prompt.correctIndex ? '¡Correcto!' : 'Incorrecto';
  return <>
    <b>{message}</b> · Respuesta: <b>{'ABCD'[prompt.correctIndex]}</b>
    {snapshot.studyState === 'revealed' && <span className="sr" id="live">Solución consultada · cuenta como blanco</span>}
    {snapshot.studyState !== 'revealed' && snapshot.answer !== -1 && snapshot.answer !== prompt.correctIndex && snapshot.recentAnswer && <div className="fbsub">Marcaste {'ABCD'[snapshot.answer!]} en {snapshot.recentAnswer[0]} s{snapshot.recentAnswer[0] < snapshot.recentAnswer[1] * 0.6 ? `; leerla con calma lleva unos ${snapshot.recentAnswer[1]} s` : ''}.</div>}
    {prompt.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(prompt.citation, prompt.options[prompt.correctIndex])} /></div>}
    {prompt.source && <StudyMarkup html={prompt.source} />}
    {prompt.traps.length > 0 && <div className="trap">Trampa: {prompt.traps.map(id => TRAMPAS[id] || id).join(' · ')}</div>}
  </>;
}

function FailedAnswerActions({ snapshot, prompt }: { snapshot: QuizSnapshot; prompt: QuizPrompt }) {
  const { quiz } = useStudyServices();
  const quick = snapshot.recentAnswer && snapshot.recentAnswer[0] < snapshot.recentAnswer[1] * 0.6;
  if (snapshot.studyState === 'revealed' || snapshot.answer === prompt.correctIndex || snapshot.answer === -1) return null;
  return <div className="mot"><small>¿Por qué fallé? <HelpIconLink topic="motivos" label="Ayuda sobre los motivos del fallo" />{quick && snapshot.recentAnswer && <b className="r">Respondiste en {snapshot.recentAnswer[0]} s; leerla bien lleva ≈{snapshot.recentAnswer[1]} s. ¿Fue velocidad?</b>}</small>
    {[5, 7, 1, 2, 3, 4].map(reason => <button className={snapshot.failureReason === reason ? 'on' : reason === 7 && quick ? 'sug' : ''} data-m={reason} key={reason} onClick={() => quiz.setFailureReason(reason)}>{FAILURE_REASONS[reason]}</button>)}
    {!(snapshot.failureReason === 4 && !snapshot.cardExists) && <button className="mk" id="mkcard" onClick={() => quiz.toggleCard()}>{snapshot.cardExists ? '📇 Tarjeta creada ✓' : '📇 Hacer tarjeta'}</button>}
  </div>;
}

function CorrectAnswerActions({ snapshot }: { snapshot: QuizSnapshot }) {
  const { quiz } = useStudyServices();
  if (snapshot.studyState === 'revealed' || snapshot.answer !== snapshot.prompt.correctIndex) return null;
  const lucky = snapshot.scoreByLuck === 6 || snapshot.scoreByLuck === 8;
  return <div className="mot"><small>¿Seguro? (entra en repaso a +2 días)</small>
    {snapshot.scoreByLuck === 6 && <b className="r">🍀 Marcada como suerte: acierto 1/2. Otra vez bien y se quita la etiqueta.</b>}
    {snapshot.scoreByLuck === 8 && <b className="r">🍀 ¡Acierto 2/2! Etiqueta de suerte quitada: ya la sabes.</b>}
    <button className={lucky ? 'on' : ''} data-a="doubt" onClick={() => quiz.markDoubt()}>🤔 Acerté dudando</button><button className={lucky ? 'on' : ''} data-a="suerte" onClick={() => quiz.markLuck()}>🍀 Fue suerte</button>
  </div>;
}

function QuizReport({ snapshot }: { snapshot: QuizSnapshot }) {
  const { quiz } = useStudyServices();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(snapshot.report?.reason || 'Respuesta correcta mal marcada');
  const [note, setNote] = useState(snapshot.report?.note || '');
  if (snapshot.report?.state === 'abierto' && !open) return <div className="repw"><span className="rep ok">✓ Error anotado <button className="ghost sm" onClick={() => setOpen(true)}>editar</button></span></div>;
  if (!open) return <div className="repw"><button className="ghost fl" onClick={() => setOpen(true)}>⚠ Avisar de error</button></div>;
  return <div className="repw"><div className="repf"><label htmlFor="report-reason">Motivo del error</label><select id="report-reason" value={reason} onChange={event => setReason(event.target.value)}>{['Respuesta correcta mal marcada', 'Enunciado erróneo o confuso', 'Opciones repetidas o dos correctas', 'La cita del temario no coincide', 'Otro'].map(value => <option key={value}>{value}</option>)}</select>
    <label htmlFor="report-note">Qué falla (opcional)</label><input id="report-note" maxLength={300} placeholder="Qué falla (opcional)" value={note} onChange={event => setNote(event.target.value)} />
    <div className="row"><button className="btn" onClick={() => { quiz.saveReport(reason, note); setOpen(false); }}>Guardar</button><button className="btn sec" onClick={() => setOpen(false)}>Cancelar</button></div></div></div>;
}

export function QuizFeedback({ snapshot, prompt, explanation }: { snapshot: QuizSnapshot; prompt: QuizPrompt; explanation: string }) {
  const { quiz } = useStudyServices();
  const kind = snapshot.studyState === 'revealed' ? 'note' : snapshot.answer === prompt.correctIndex ? 'good' : 'wrong';
  return <div className={`fb ${kind}`} role="status">
    <FeedbackMessage snapshot={snapshot} prompt={prompt} />
    <FailedAnswerActions snapshot={snapshot} prompt={prompt} />
    <CorrectAnswerActions snapshot={snapshot} />
    <button className="ghost fl" id="flag" onClick={() => quiz.toggleFlag()}>{snapshot.flagged ? '★ Dudosa' : '☆ Marcar como dudosa'}</button>
    <QuizReport snapshot={snapshot} />
    {explanation && <div id="code-explanation-slot" aria-live="polite"><StudyMarkup html={explanation} /></div>}
  </div>;
}
