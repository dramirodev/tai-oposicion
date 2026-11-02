import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { TRAMPAS } from '../../shared/presentation/labels.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyService, type FailureQuestion } from '../../shared/ui/study-services.js';
import { selectFailures, type FailureFilter } from './failures-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { PageMessage } from '../../shared/ui/PageMessage.js';
import { isStudyTopicId } from '../../core/domain/topic-id.js';

const EMPTY_FILTER: FailureFilter = { query: '', topicId: '', syllabus: '', streak: '' };
const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

function FailureDetails({ question, streak, reviewed }: { question: FailureQuestion; streak: number; reviewed: boolean }) {
  const markup = questionNotice({ i: question.id, n: question.note, np: question.nonScoring }) + sourceHtml({ i: question.id, source: question.source, u: question.citation });
  return <details className="rv f block border-0 py-2 text-[length:var(--fs-b)] [&>summary>i]:bg-[var(--bad)]"><summary className="flex cursor-pointer items-start gap-2 pt-3"><i className="mt-[.4375rem] size-2.5 shrink-0 rounded-full bg-muted" /><span className="pre"><StudyMarkup html={richHtml(question.statement)} languageContext={question.statement} /><br /><small className="sub">Aciertos seguidos: {streak}/3 · {reviewed ? 'Temario repasado' : 'Pendiente de temario'}</small></span></summary>
    {markup && <StudyMarkup html={markup} languageContext={question.statement} />}
    {question.assumptionText && <details className="sup"><summary>Enunciado del supuesto</summary><div className="pre"><StudyMarkup html={richHtml(question.assumptionText)} languageContext={question.statement} /></div></details>}
    {question.context && <div className="ctx pre"><StudyMarkup html={richHtml(question.context)} languageContext={question.statement} /></div>}
    {question.options.map((option, index) => <div className={`ro mt-1 rounded-[var(--r-s)] px-2 py-1.5 ${index === question.correctIndex ? 'bg-[var(--okbg)]' : ''}`} key={`${question.id}-${index}`}><b>{'ABCD'[index]}</b> <StudyMarkup html={richHtml(option)} languageContext={question.statement} />{index === question.correctIndex && <span className="sr"> (Respuesta correcta)</span>}</div>)}
    {question.citation ? <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(question.citation, question.options[question.correctIndex])} languageContext={question.statement} /></div> : <p className="sm sub">Esta pregunta no tiene fragmento de temario asociado.</p>}
    {question.note && <div className="cita"><span>Nota</span><StudyMarkup html={richHtml(question.note)} languageContext={question.statement} /></div>}
    {question.traps?.length ? <p className="sm sub">Trampas: {question.traps.map(trap => TRAMPAS[trap] || String(trap)).join(' · ')}</p> : null}
  </details>;
}

export function FailuresPage() {
  const failures = useStudyService('failures');
  const [searchParams] = useSearchParams();
  const trainingTopicsValue = searchParams.get('trainingTopics');
  const dailyTraining = searchParams.get('dailyTraining') === 'failures';
  const requestedTrainingTopicIds = useMemo(() => trainingTopicsValue === null ? undefined
    : new Set(trainingTopicsValue.split(',').filter(isStudyTopicId)), [trainingTopicsValue]);
  const seenTopicIds = useMemo(() => new Set(failures.seenTopics()), [failures]);
  const trainingTopicIds = useMemo(() => requestedTrainingTopicIds && new Set(
    [...requestedTrainingTopicIds].filter(topicId => seenTopicIds.has(topicId)),
  ), [requestedTrainingTopicIds, seenTopicIds]);
  const [questions, setQuestions] = useState<FailureQuestion[]>([]);
  const [topics, setTopics] = useState<readonly { id: string; name: string }[]>([]);
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const autoStarted = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.all([failures.loadQuestions(), failures.loadTopics()]).then(([loaded, availableTopics]) => {
      if (active) { setQuestions(loaded); setTopics(availableTopics); setLoadError(false); setLoaded(true); }
    }).catch(() => { if (active) { setLoadError(true); setLoaded(true); } });
    return () => { active = false; };
  }, [failures, reload]);
  const scopedQuestions = useMemo(() => trainingTopicIds ? questions.filter(question => trainingTopicIds.has(question.topicId)) : questions, [questions, trainingTopicIds]);
  const selected = useMemo(() => selectFailures(scopedQuestions, filter), [scopedQuestions, filter]);
  const byTopic = useMemo(() => new Map(scopedQuestions.reduce((entries, question) => entries.set(question.topicId, (entries.get(question.topicId) || 0) + 1), new Map<string, number>())), [scopedQuestions]);

  useEffect(() => {
    if (!dailyTraining || !loaded || loadError || autoStarted.current || !selected.length) return;
    autoStarted.current = true;
    failures.startPractice(selected.map(question => question.id), 'Entrenamiento de hoy · Revisión de fallos', { dailyTrainingActivity: 'failures' });
  }, [dailyTraining, failures, loaded, loadError, selected]);

  if (!loaded) return <PageLoading variant="legacy" />;
  if (loadError) return <><h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1><PageMessage role="alert"><p>No se pudieron cargar las preguntas. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { setLoaded(false); setLoadError(false); setReload(value => value + 1); }}>Reintentar</button></PageMessage></>;
  if (!questions.length) return <><h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1><PageMessage><p className="sub">Aún no tienes preguntas falladas. Cuando falles alguna aparecerá aquí para que la busques y releas el tema.</p></PageMessage></>;
  if (trainingTopicIds && !scopedQuestions.length) return <><h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1><div className="note">El entrenamiento de hoy solo considera los temas que has marcado como vistos. No hay preguntas falladas de esos temas.</div><Link className="btn sec" to="/home">Volver al entrenamiento</Link></>;

  return <>
    <h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1>
    {trainingTopicIds && <p className="note">Entrenamiento de hoy: solo fallos de temas que has marcado como vistos.</p>}
    <p className="sub">Cada pregunta permanece hasta acertarla tres veces seguidas. Un fallo reinicia el contador; dejarla en blanco no cuenta. Marcar el temario no la quita de la lista y programa una comprobación de recuerdo dos días después.</p>
    <p className="sub" aria-live="polite">{selected.length === scopedQuestions.length ? `${scopedQuestions.length} preguntas` : `${selected.length} de ${scopedQuestions.length} preguntas`}</p>
    <div className="card">
      <label className="sr" htmlFor="failure-query">Buscar en las preguntas falladas</label>
      <input id="failure-query" type="search" placeholder="Buscar: palabra, artículo, comando…" autoComplete="off" enterKeyHint="search" value={filter.query} onChange={event => setFilter(current => ({ ...current, query: event.target.value }))} />
      <label className="sr" htmlFor="failure-topic">Filtrar por tema</label>
      {!trainingTopicIds && <select id="failure-topic" value={filter.topicId} onChange={event => setFilter(current => ({ ...current, topicId: event.target.value }))}><option value="">Todos los temas</option>{topics.filter(topic => byTopic.has(topic.id)).map(topic => <option key={topic.id} value={topic.id}>{topic.id} · {topic.name} ({byTopic.get(topic.id)})</option>)}</select>}
      <div className="row"><label>Repaso del temario<select id="failure-syllabus" value={filter.syllabus} onChange={event => setFilter(current => ({ ...current, syllabus: event.target.value as FailureFilter['syllabus'] }))}><option value="">Todos</option><option value="pending">Pendiente de temario</option><option value="reviewed">Repasada</option></select></label>
        <label>Aciertos seguidos<select value={filter.streak} onChange={event => setFilter(current => ({ ...current, streak: event.target.value as FailureFilter['streak'] }))}><option value="">Todas las rachas</option><option value="0">0 de 3</option><option value="1">1 de 3</option><option value="2">2 de 3</option></select></label></div>
    </div>
    {selected.length ? <div id="failure-results">{[...new Set(selected.map(question => question.topicId))].sort().map(topicId => {
      const group = selected.filter(question => question.topicId === topicId);
      return <section key={topicId}><h2 className="h3">{topicId} · {failures.topicName(topicId)} <small>({group.length})</small></h2><div className="card">{group.map(question => {
        const progress = question.progress, streak = Math.max(0, progress?.failureStreak ?? 0), reviewed = progress?.syllabusReviewed ?? false;
        return <article className="failure-item py-3 [&+&]:border-t [&+&]:border-line" key={question.id}><div className="failure-state flex items-center justify-between gap-3"><label className="chk !m-0"><input type="checkbox" data-reviewed={question.id} checked={reviewed} onChange={event => { const checked = event.target.checked; failures.setReviewed(question.id, question.topicId, checked); setQuestions(current => current.map(item => item.id === question.id ? { ...item, progress: { attempts: item.progress?.attempts ?? 0, correct: item.progress?.correct ?? 0, lastSeenAt: item.progress?.lastSeenAt ?? 0, failureStreak: item.progress?.failureStreak ?? 0, syllabusReviewed: checked } } : item)); }} />Repasada en el temario</label><span className="streak-meter flex-none rounded-full border border-[var(--selb)] px-[.625rem] py-[.3125rem] text-[length:var(--fs-m)] text-[var(--selb)]" aria-label={`${streak} de 3 aciertos seguidos`}>{streak}/3</span></div><FailureDetails question={question} streak={streak} reviewed={reviewed} /><p className="sm sub">Última actividad: {dateLabel(progress?.lastSeenAt ?? 0)} · acertada {progress?.correct ?? 0} de {progress?.attempts ?? 0} veces{question.year ? ` · ${question.year}` : ''}</p></article>;
      })}</div></section>;
    })}</div> : <div className="card" id="failure-results"><p className="sub">Ninguna pregunta coincide con la búsqueda.</p></div>}
    <div className="bar2"><button className="btn" onClick={() => failures.startPractice(selected.map(question => question.id), `Falladas${filter.topicId ? ` · ${filter.topicId}` : ''}`)} disabled={!selected.length}>Practicar estas</button><Link className="btn sec" to="/home">Inicio</Link></div>
  </>;
}
