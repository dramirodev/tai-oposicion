import { useState } from 'react';
import type { ExplanationLookup } from '../../core/domain/explanations.js';
import { CodeExplanationView } from '../explanations/CodeExplanation.js';
import { Brain, Check, Clover, NotebookTabs, Star, TriangleAlert } from 'lucide-react';
import { TRAMPAS } from '../../shared/presentation/labels.js';
import { FAILURE_REASONS } from '../../shared/presentation/study-labels.js';
import { hiliteHtml } from '../../shared/presentation/study-text.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyService, type QuizPrompt, type QuizSnapshot } from '../../shared/ui/study-services.js';

function FeedbackMessage({ snapshot, prompt }: { snapshot: QuizSnapshot; prompt: QuizPrompt }) {
  const message = snapshot.studyState === 'revealed' ? 'Solución consultada · cuenta como blanco'
    : snapshot.answer === -1 ? 'Sin responder'
      : snapshot.answer === prompt.correctIndex ? '¡Correcto!' : 'Incorrecto';
  return <>
    <b>{message}</b> · Respuesta: <b>{'ABCD'[prompt.correctIndex]}</b>
    {snapshot.studyState === 'revealed' && <span className="sr" id="live">Solución consultada · cuenta como blanco</span>}
    {snapshot.studyState !== 'revealed' && snapshot.answer !== -1 && snapshot.answer !== prompt.correctIndex && snapshot.recentAnswer && <div className="mt-1 text-[length:var(--fs-m)] opacity-90">Marcaste {'ABCD'[snapshot.answer!]} en {snapshot.recentAnswer[0]} s{snapshot.recentAnswer[0] < snapshot.recentAnswer[1] * 0.6 ? `; leerla con calma lleva unos ${snapshot.recentAnswer[1]} s` : ''}.</div>}
    {prompt.citation && <div className="mt-2.5 rounded-[var(--r-l)] border border-[var(--line)] bg-[var(--card)] p-4 text-[length:var(--fs-b)] leading-[1.65] text-[var(--ink)] [overflow-wrap:anywhere]"><span className="mb-1.5 block text-[length:var(--fs-xs)] font-bold text-[var(--mute)]">Temario</span><StudyMarkup html={hiliteHtml(prompt.citation, prompt.options[prompt.correctIndex])} languageContext={prompt.statement} /></div>}
    {prompt.source && <StudyMarkup html={prompt.source} languageContext={prompt.statement} />}
    {prompt.traps.length > 0 && <div className="trap">Trampa: {prompt.traps.map(id => TRAMPAS[id] || id).join(' · ')}</div>}
  </>;
}

function FailedAnswerActions({ snapshot, prompt }: { snapshot: QuizSnapshot; prompt: QuizPrompt }) {
  const quiz = useStudyService('quiz');
  const quick = snapshot.recentAnswer && snapshot.recentAnswer[0] < snapshot.recentAnswer[1] * 0.6;
  if (snapshot.studyState === 'revealed' || snapshot.answer === prompt.correctIndex || snapshot.answer === -1) return null;
  return <div className="mot"><small>¿Por qué fallé? <HelpIconLink topic="motivos" label="Ayuda sobre los motivos del fallo" />{quick && snapshot.recentAnswer && <b className="r">Respondiste en {snapshot.recentAnswer[0]} s; leerla bien lleva ≈{snapshot.recentAnswer[1]} s. ¿Fue velocidad?</b>}</small>
    {[5, 7, 1, 2, 3, 4].map(reason => <button className={snapshot.failureReason === reason ? 'on' : reason === 7 && quick ? 'sug' : ''} data-m={reason} key={reason} onClick={() => quiz.setFailureReason(reason)}>{FAILURE_REASONS[reason]}</button>)}
    {!(snapshot.failureReason === 4 && !snapshot.cardExists) && <button className="mk" id="mkcard" onClick={() => quiz.toggleCard()}><NotebookTabs size="1em" aria-hidden="true" /> {snapshot.cardExists ? <>Tarjeta creada <Check size="1em" aria-hidden="true" /></> : 'Hacer tarjeta'}</button>}
  </div>;
}

function CorrectAnswerActions({ snapshot }: { snapshot: QuizSnapshot }) {
  const quiz = useStudyService('quiz');
  const [selectionByQuestion, setSelectionByQuestion] = useState<Record<string, 'doubt' | 'luck'>>({});
  if (snapshot.studyState === 'revealed' || snapshot.answer !== snapshot.prompt.correctIndex) return null;
  const selected = selectionByQuestion[snapshot.prompt.id] ?? (snapshot.failureReason === 6 ? 'luck' : null);
  return <div className="mot"><small>¿Seguro? (entra en repaso a +2 días)</small>
    {snapshot.scoreByLuck === 6 && <b className="r"><Clover size="1em" aria-hidden="true" /> Marcada como suerte: acierto 1/2. Otra vez bien y se quita la etiqueta.</b>}
    {snapshot.scoreByLuck === 8 && <b className="r"><Clover size="1em" aria-hidden="true" /> ¡Acierto 2/2! Etiqueta de suerte quitada: ya la sabes.</b>}
    {selected === 'doubt' && <b className="r" role="status">La pregunta queda programada para volver al repaso.</b>}
    {selected === 'luck' && snapshot.scoreByLuck !== 6 && snapshot.scoreByLuck !== 8 && <b className="r" role="status"><Clover size="1em" aria-hidden="true" /> Marcada como suerte: se repetirá mañana.</b>}
    <button className={selected === 'doubt' ? 'on' : ''} aria-pressed={selected === 'doubt'} data-a="doubt" onClick={() => { quiz.markDoubt(); setSelectionByQuestion(current => ({ ...current, [snapshot.prompt.id]: 'doubt' })); }}><Brain size="1em" aria-hidden="true" /> Acerté dudando</button><button className={selected === 'luck' ? 'on' : ''} aria-pressed={selected === 'luck'} data-a="suerte" onClick={() => { quiz.markLuck(); setSelectionByQuestion(current => ({ ...current, [snapshot.prompt.id]: 'luck' })); }}><Clover size="1em" aria-hidden="true" /> Fue suerte</button>
  </div>;
}

function QuizReport({ snapshot }: { snapshot: QuizSnapshot }) {
  const quiz = useStudyService('quiz');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(snapshot.report?.reason || 'Respuesta correcta mal marcada');
  const [note, setNote] = useState(snapshot.report?.note || '');
  if (snapshot.report?.state === 'abierto' && !open) return <div className="repw"><span className="rep ok"><Check size="1em" aria-hidden="true" /> Error anotado <button className="ghost ghost-small" onClick={() => setOpen(true)}>editar</button></span></div>;
  if (!open) return <div className="repw"><button className="ghost ghost-compact" onClick={() => setOpen(true)}><TriangleAlert size="1em" aria-hidden="true" /> Avisar de error</button></div>;
  return <div className="repw"><div className="repf"><label htmlFor="report-reason">Motivo del error</label><select id="report-reason" value={reason} onChange={event => setReason(event.target.value)}>{['Respuesta correcta mal marcada', 'Enunciado erróneo o confuso', 'Opciones repetidas o dos correctas', 'La cita del temario no coincide', 'Otro'].map(value => <option key={value}>{value}</option>)}</select>
    <label htmlFor="report-note">Qué falla (opcional)</label><input id="report-note" maxLength={300} placeholder="Qué falla (opcional)" value={note} onChange={event => setNote(event.target.value)} />
    <div className="row"><button className="btn" onClick={() => { quiz.saveReport(reason, note); setOpen(false); }}>Guardar</button><button className="btn sec" onClick={() => setOpen(false)}>Cancelar</button></div></div></div>;
}

export function QuizFeedback({ snapshot, prompt, explanation }: { snapshot: QuizSnapshot; prompt: QuizPrompt; explanation: ExplanationLookup }) {
  const quiz = useStudyService('quiz');
  const kind = snapshot.studyState === 'revealed' ? 'note' : snapshot.answer === prompt.correctIndex ? 'good' : 'wrong';
  return <div className={`fb motion-safe:animate-[fbin_.2s_ease-out] ${kind}`} role="status">
    <FeedbackMessage snapshot={snapshot} prompt={prompt} />
    <FailedAnswerActions snapshot={snapshot} prompt={prompt} />
    <CorrectAnswerActions snapshot={snapshot} />
    <button className="ghost ghost-compact" id="flag" onClick={() => quiz.toggleFlag()}><Star size="1em" fill={snapshot.flagged ? 'currentColor' : 'none'} aria-hidden="true" /> {snapshot.flagged ? 'Dudosa' : 'Marcar como dudosa'}</button>
    <QuizReport snapshot={snapshot} />
    {explanation.status === 'current' && <div id="code-explanation-slot" aria-live="polite"><CodeExplanationView explanation={explanation.explanation} /></div>}
    {explanation.status === 'outdated' && <p className="sub" role="status">Hay una explicación de una revisión anterior; no se muestra para evitar información desactualizada.</p>}
  </div>;
}
