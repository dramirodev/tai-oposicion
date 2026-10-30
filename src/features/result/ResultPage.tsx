import { useEffect, useRef, useState } from 'react';
import type { ExplanationLookup } from '../../core/domain/explanations.js';
import { CodeExplanationView } from '../../shared/ui/CodeExplanationView.js';
import { Check, TriangleAlert } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ERROR_REPORT_REASONS } from '../../shared/presentation/study-labels.js';
import { hiliteHtml, richHtml } from '../../shared/presentation/study-text.js';
import { resolveHighlight } from '../../core/domain/attempts/highlights.js';
import { canonicalText, paintTextHighlight } from '../../shared/ui/text-highlights.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { useStudyService, type ResultItem, type ResultReport } from '../../shared/ui/study-services.js';

function useResultSnapshot() {
  const result = useStudyService('result');
  const [snapshot, setSnapshot] = useState(() => result.getSnapshot());
  useEffect(() => result.subscribe(() => setSnapshot(result.getSnapshot())), [result]);
  return snapshot;
}

function ReviewReport({ item, index, report }: { item: ResultItem; index: number; report: ResultReport | undefined }) {
  const result = useStudyService('result');
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(report?.reason || ERROR_REPORT_REASONS[0]);
  const [note, setNote] = useState(report?.note || '');
  if (report?.state === 'abierto' && !editing) return <div className="repw mt-1.5"><span className="rep ok text-[length:var(--fs-m)] text-[var(--good-ink)]"><Check size="1em" aria-hidden="true" /> Error anotado <button className="ghost ghost-small" onClick={() => { setReason(report.reason); setNote(report.note); setEditing(true); }}>editar</button></span></div>;
  if (!editing) return <div className="repw mt-1.5"><button className="ghost ghost-compact" onClick={() => setEditing(true)}><TriangleAlert size="1em" aria-hidden="true" /> Avisar de error</button></div>;
  return <div className="repw mt-1.5"><div className="repf mt-2 flex flex-col gap-2"><label className="sr" htmlFor={`report-reason-${index}`}>Motivo del error</label><select className="font-[inherit] rounded-[var(--r-m)] border-[1.5px] border-line bg-surface p-2.5 text-[length:var(--fs-b)] text-ink" id={`report-reason-${index}`} value={reason} onChange={event => setReason(event.target.value)}>{ERROR_REPORT_REASONS.map(value => <option key={value}>{value}</option>)}</select>
    <label className="sr" htmlFor={`report-note-${index}`}>Qué falla (opcional)</label><input className="font-[inherit] rounded-[var(--r-m)] border-[1.5px] border-line bg-surface p-2.5 text-[length:var(--fs-b)] text-ink" id={`report-note-${index}`} maxLength={300} placeholder="Qué falla (opcional)" value={note} onChange={event => setNote(event.target.value)} />
    <div className="row"><button className="btn !min-h-[2.625rem] !px-4 !py-2.5 !text-[length:var(--fs-b)]" onClick={() => { result.saveReport(item.id, item.topicId, reason, note.trim()); setEditing(false); }}>Guardar</button><button className="btn sec !min-h-[2.625rem] !px-4 !py-2.5 !text-[length:var(--fs-b)]" onClick={() => setEditing(false)}>Cancelar</button></div></div></div>;
}

const outcomePresentation = {
  correct: { style: 'g', label: 'Acierto' },
  wrong: { style: 'r', label: 'Fallo' },
  blank: { style: 'b', label: 'En blanco' },
  revealed: { style: 'b', label: 'Solución consultada · blanco' },
} as const;

function ReviewDetails({ item, explanation }: { item: ResultItem; explanation: ExplanationLookup }) {
  return <>
    {item.notice && <StudyMarkup html={item.notice} languageContext={item.statement} />}
    <div className="pre review-statement"><StudyMarkup html={richHtml(item.statement)} languageContext={item.statement} /></div>
    {item.options.map((option, optionIndex) => <div className={`ro my-1 rounded-[var(--r-s)] px-2 py-1.5 ${optionIndex === item.correctIndex ? 'bg-[var(--okbg)]' : optionIndex === item.answer ? 'bg-[var(--badbg)]' : ''}`} data-answer-index={optionIndex} key={`${item.id}-${optionIndex}`}><b>{'ABCD'[optionIndex]}</b> <span className="pre review-option-text"><StudyMarkup html={richHtml(option)} languageContext={item.statement} /></span>{optionIndex === item.correctIndex && <> <span className="sr">(Respuesta correcta)</span></>}</div>)}
    {item.confidence && <p className="sub">Confianza antes de responder: {item.confidence === 'sure' ? 'Seguro' : item.confidence === 'betweenTwo' ? 'Entre dos' : 'Adivino'}</p>}
    {item.discardedOptions.length > 0 && <p className="sub">Opciones que descartaste antes de responder: {item.discardedOptions.map(option => 'ABCD'[option]).join(', ')}</p>}
    {item.highlights.length > 0 && <p className="sub">Tus marcas de este intento:</p>}
    {item.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(item.citation, item.options[item.correctIndex])} languageContext={item.statement} /></div>}
    {item.source && <StudyMarkup html={item.source} languageContext={item.statement} />}
    {explanation.status === 'current' && <div className="code-explanation-slot" aria-live="polite"><CodeExplanationView explanation={explanation.explanation} /></div>}
    {explanation.status === 'outdated' && <p className="sub" role="status">Hay una explicación de una revisión anterior; no se muestra para evitar información desactualizada.</p>}
  </>;
}

function ReviewItem({ item, index, report, interrupted }: { item: ResultItem; index: number; report: ResultReport | undefined; interrupted: boolean }) {
  const result = useStudyService('result');
  const [explanation, setExplanation] = useState<ExplanationLookup>({ status: 'missing' });
  const { style, label } = outcomePresentation[item.outcome];

  useEffect(() => {
    if (item.outcome === 'revealed' || interrupted) return;
    let active = true;
    void result.loadExplanation(item).then(value => { if (active) setExplanation(value); }).catch(() => {});
    return () => { active = false; };
  }, [interrupted, item, item.outcome, result]);

  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(`[data-review="${index}"]`);
    if (!panel || !item.highlights.length) return;
    let foundStale = false;
    item.highlights.forEach(mark => {
      const root = mark.field === 'statement' ? panel.querySelector('.review-statement') : panel.querySelector(`.ro[data-answer-index="${Number(mark.field.slice(7))}"] .review-option-text`);
      if (!root) return;
      const text = canonicalText(root);
      const position = resolveHighlight(mark, text, item.contentRevision);
      if (position.stale) { foundStale = true; return; }
      paintTextHighlight(root, position.start, position.end, mark.category, mark.id);
    });
    panel.querySelector('.stale-highlight')?.remove();
    if (foundStale) {
      const note = document.createElement('p'); note.className = 'sub stale-highlight';
      note.textContent = 'Una marca no coincide con el texto actual y no se ha movido.';
      panel.append(note);
    }
  }, [index, item]);

  return <details className={`rv block border-b border-line py-2 text-[length:var(--fs-b)] ${style === 'g' ? '[&>summary>i]:bg-[var(--ok)]' : style === 'r' ? '[&>summary>i]:bg-[var(--bad)]' : ''}`} data-review={index}><summary className="flex cursor-pointer items-start gap-2"><i className="mt-[.4375rem] size-2.5 shrink-0 rounded-full bg-muted" /><span className="sr">{label}: </span>{item.outcome === 'revealed' && <span className="tag warn">Solución consultada · blanco</span>} {item.statement.slice(0, 110)}{item.statement.length > 110 ? '…' : ''}</summary>
    <ReviewDetails item={item} explanation={explanation} />
    <ReviewReport item={item} index={index} report={report} />
  </details>;
}

export function ResultPage() {
  const result = useStudyService('result');
  const home = useStudyService('home');
  const snapshot = useResultSnapshot();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const advancedDailyActivity = useRef(false);
  const dailyTrainingActivity = searchParams.get('dailyTraining');
  const [strategy, setStrategy] = useState('');
  const [strategyLoading, setStrategyLoading] = useState(false);
  useEffect(() => {
    const activity = dailyTrainingActivity;
    if (advancedDailyActivity.current || !snapshot || snapshot.interrupted
      || !['topicTest', 'mixedTopicTest', 'failures', 'spacedReviews'].includes(activity || '')) return;
    advancedDailyActivity.current = true;
    home.completeTrainingActivity(activity as 'topicTest' | 'mixedTopicTest' | 'failures' | 'spacedReviews');
  }, [dailyTrainingActivity, home, snapshot]);
  if (!snapshot) return <><h1>Resultado</h1><p className="note">No hay un resultado disponible. <Link to="/home">Volver al inicio</Link></p></>;
  return <>
    <h1>Resultado</h1>
    {snapshot.interrupted && <div className="note result-status"><b>Sesión interrumpida</b><p className="my-1.5">{snapshot.correct + snapshot.wrong} de {snapshot.items.length} preguntas respondidas. La puntuación global mantiene las no contestadas como blancos.</p></div>}
    <div className="card big text-center"><p className="score-label mb-2 mt-0 text-[length:var(--fs-m)] text-muted">Puntuación global <HelpIconLink topic="puntuacion" label="Ayuda sobre cómo se calcula la puntuación" /></p>
      <div className="score" data-count={snapshot.score}>{snapshot.score}<small>/100</small></div><div className="legend">100 × (aciertos − fallos/3) / total de preguntas</div>
      <div className="trio"><div className="g"><b>{snapshot.correct}</b>Aciertos</div><div className="r"><b>{snapshot.wrong}</b>Fallos</div><div><b>{snapshot.blank}</b>Blanco</div></div>
      {snapshot.consulted > 0 && <div className="legend" id="consulted-count">{snapshot.consulted} {snapshot.consulted === 1 ? 'solución consultada' : 'soluciones consultadas'} · contadas como blanco, sin acierto ni fallo</div>}
      <div className="legend">{snapshot.accuracy === null ? 'Sin respuestas evaluables' : `${snapshot.accuracy} % de acierto sobre lo contestado`} · {Math.floor(snapshot.seconds / 60)}:{String(snapshot.seconds % 60).padStart(2, '0')}</div>
    </div>
    <div className="row">{snapshot.secondPartAvailable && <button className="btn" onClick={() => result.continuePartTwo()}>Seguir con la parte 2 (supuesto)</button>}{snapshot.wrong > 0 && <button className="btn" onClick={() => result.repeatFailures()}>Repetir las falladas</button>}<button className="btn sec" onClick={() => dailyTrainingActivity ? void navigate('/planificacion') : result.goHome()}>{dailyTrainingActivity ? 'Continuar con el entrenamiento' : 'Inicio'}</button></div>
    {snapshot.analysis && <StudyMarkup html={snapshot.analysis} />}
    {snapshot.kind === 'sim' && !snapshot.interrupted && <section className="strategy-result mt-4"><h2>Analítica de estrategia</h2><p className="sub">Análisis del historial completado; las sesiones incompletas se excluyen y la muestra pequeña no genera recomendación.</p><button className="btn sec" disabled={strategyLoading} onClick={() => { setStrategyLoading(true); void result.loadStrategy().then(setStrategy).catch(() => setStrategy('No se pudo leer el historial detallado. El resultado de esta sesión sigue disponible.')).finally(() => setStrategyLoading(false)); }}>{strategyLoading ? 'Calculando…' : 'Calcular informe del último año'}</button>{strategy && <div aria-live="polite"><StudyMarkup html={strategy} /></div>}</section>}
    <h2>Por tema</h2><div className="card">{snapshot.topics.map(topic => <div className="line" key={topic.id}><span>{topic.id} {topic.name}</span><span>{topic.correct}/{topic.total}</span></div>)}</div>
    <h2>Revisión</h2><div className="card">{snapshot.items.map((item, index) => <ReviewItem key={item.id} item={item} index={index} report={result.getReport(item.id)} interrupted={snapshot.interrupted} />)}</div>
  </>;
}
