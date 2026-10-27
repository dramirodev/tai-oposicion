import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { TRAMPAS } from '../../shared/presentation/labels.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyService, type FailureQuestion } from '../../shared/ui/study-services.js';
import { selectFailures, type FailureFilter } from './failures-controller.js';

const EMPTY_FILTER: FailureFilter = { query: '', topicId: '', syllabus: '', streak: '' };
const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

function FailureDetails({ question, streak, reviewed }: { question: FailureQuestion; streak: number; reviewed: boolean }) {
  const markup = questionNotice({ i: question.id, n: question.note, np: question.nonScoring }) + sourceHtml({ i: question.id, source: question.source, u: question.citation });
  return <details className="rv f"><summary><i /><span className="pre"><StudyMarkup html={richHtml(question.statement)} /><br /><small className="sub">Aciertos seguidos: {streak}/3 · {reviewed ? 'Temario repasado' : 'Pendiente de temario'}</small></span></summary>
    {markup && <StudyMarkup html={markup} />}
    {question.assumptionText && <details className="sup"><summary>Enunciado del supuesto</summary><div className="pre">{question.assumptionText}</div></details>}
    {question.context && <div className="ctx pre"><StudyMarkup html={richHtml(question.context)} /></div>}
    {question.options.map((option, index) => <div className={`ro ${index === question.correctIndex ? 'ok' : ''}`} key={`${question.id}-${index}`}><b>{'ABCD'[index]}</b> <StudyMarkup html={richHtml(option)} />{index === question.correctIndex && <span className="sr"> (Respuesta correcta)</span>}</div>)}
    {question.citation ? <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(question.citation, question.options[question.correctIndex])} /></div> : <p className="sm sub">Esta pregunta no tiene fragmento de temario asociado.</p>}
    {question.note && <div className="cita"><span>Nota</span>{question.note}</div>}
    {question.traps?.length ? <p className="sm sub">Trampas: {question.traps.map(trap => TRAMPAS[trap] || String(trap)).join(' · ')}</p> : null}
  </details>;
}

export function FailuresPage() {
  const failures = useStudyService('failures');
  const [questions, setQuestions] = useState<FailureQuestion[]>([]);
  const [topics, setTopics] = useState<readonly { id: string; name: string }[]>([]);
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([failures.loadQuestions(), failures.loadTopics()]).then(([loaded, availableTopics]) => {
      if (active) { setQuestions(loaded); setTopics(availableTopics); setLoadError(false); setLoaded(true); }
    }).catch(() => { if (active) { setLoadError(true); setLoaded(true); } });
    return () => { active = false; };
  }, [failures, reload]);
  const selected = useMemo(() => selectFailures(questions, filter, failures.getRecord), [questions, filter, failures]);
  const byTopic = useMemo(() => new Map(questions.reduce((entries, question) => entries.set(question.topicId, (entries.get(question.topicId) || 0) + 1), new Map<string, number>())), [questions]);

  if (!loaded) return <><h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1><p className="sub loading" role="status">Cargando preguntas falladas…</p></>;
  if (loadError) return <><h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1><div className="card" role="alert"><p>No se pudieron cargar las preguntas. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { setLoaded(false); setLoadError(false); setReload(value => value + 1); }}>Reintentar</button></div></>;
  if (!questions.length) return <><h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1><div className="card"><p className="sub">Aún no tienes preguntas falladas. Cuando falles alguna aparecerá aquí para que la busques y releas el tema.</p></div></>;

  return <>
    <h1>Falladas <HelpIconLink topic="repaso" label="Ayuda sobre preguntas falladas y repaso" /></h1>
    <p className="sub">Cada pregunta permanece hasta acertarla tres veces seguidas. Un fallo reinicia el contador; dejarla en blanco no cuenta. Marcar el temario no la quita de la lista.</p>
    <p className="sub" aria-live="polite">{selected.length === questions.length ? `${questions.length} preguntas` : `${selected.length} de ${questions.length} preguntas`}</p>
    <div className="card">
      <label className="sr" htmlFor="failure-query">Buscar en las preguntas falladas</label>
      <input id="failure-query" type="search" placeholder="Buscar: palabra, artículo, comando…" autoComplete="off" enterKeyHint="search" value={filter.query} onChange={event => setFilter(current => ({ ...current, query: event.target.value }))} />
      <label className="sr" htmlFor="failure-topic">Filtrar por tema</label>
      <select id="failure-topic" value={filter.topicId} onChange={event => setFilter(current => ({ ...current, topicId: event.target.value }))}><option value="">Todos los temas</option>{topics.filter(topic => byTopic.has(topic.id)).map(topic => <option key={topic.id} value={topic.id}>{topic.id} · {topic.name} ({byTopic.get(topic.id)})</option>)}</select>
      <div className="row"><label>Repaso del temario<select id="failure-syllabus" value={filter.syllabus} onChange={event => setFilter(current => ({ ...current, syllabus: event.target.value as FailureFilter['syllabus'] }))}><option value="">Todos</option><option value="pending">Pendiente de temario</option><option value="reviewed">Repasada</option></select></label>
        <label>Aciertos seguidos<select value={filter.streak} onChange={event => setFilter(current => ({ ...current, streak: event.target.value as FailureFilter['streak'] }))}><option value="">Todas las rachas</option><option value="0">0 de 3</option><option value="1">1 de 3</option><option value="2">2 de 3</option></select></label></div>
    </div>
    {selected.length ? <div id="failure-results">{[...new Set(selected.map(question => question.topicId))].sort().map(topicId => {
      const group = selected.filter(question => question.topicId === topicId);
      return <section key={topicId}><h2 className="h3">{topicId} · {failures.topicName(topicId)} <small>({group.length})</small></h2><div className="card">{group.map(question => {
        const record = failures.getRecord(question.id) || [0, 0, 0], streak = Math.max(0, record[10] || 0), reviewed = failures.isReviewed(question.id);
        return <article className="failure-item" key={question.id}><div className="failure-state"><label className="chk"><input type="checkbox" data-reviewed={question.id} checked={reviewed} onChange={event => { failures.setReviewed(question.id, question.topicId, event.target.checked); setQuestions(current => [...current]); }} />Repasada en el temario</label><span className="streak-meter" aria-label={`${streak} de 3 aciertos seguidos`}>{streak}/3</span></div><FailureDetails question={question} streak={streak} reviewed={reviewed} /><p className="sm sub">Última actividad: {dateLabel(record[2])} · acertada {record[1] || 0} de {record[0] || 0} veces{question.year ? ` · ${question.year}` : ''}</p></article>;
      })}</div></section>;
    })}</div> : <div className="card" id="failure-results"><p className="sub">Ninguna pregunta coincide con la búsqueda.</p></div>}
    <div className="bar2"><button className="btn" onClick={() => failures.startPractice(selected.map(question => question.id), `Falladas${filter.topicId ? ` · ${filter.topicId}` : ''}`)} disabled={!selected.length}>Practicar estas</button><Link className="btn sec" to="/home">Inicio</Link></div>
  </>;
}
