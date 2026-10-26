import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useStudyServices, type LightningQuestion } from '../../shared/ui/study-services.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { TRAMPAS } from '../../shared/presentation/labels.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';

export function LightningPage() {
  const { lightning } = useStudyServices();
  const [question, setQuestion] = useState<LightningQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const next = () => { setLoading(true); setAnswered(null); setError(false); setReload(value => value + 1); };
  useEffect(() => {
    let active = true;
    void lightning.loadQuestion().then(value => {
      if (active) { setQuestion(value); setStartedAt(Date.now()); setLoading(false); }
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [lightning, reload]);

  if (loading) return <><h1>Pregunta relámpago</h1><p className="sub loading" role="status">Buscando una pregunta…</p></>;
  if (error) return <><h1>Pregunta relámpago</h1><div className="card" role="alert"><p>No se pudo cargar una pregunta. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={next}>Reintentar</button></div></>;
  if (!question) return <><h1>Pregunta relámpago</h1><div className="card"><p>No hay pregunta disponible.</p></div><Link className="btn sec" to="/home">Inicio</Link></>;

  const correct = answered === question.correctIndex;
  const notice = questionNotice({ i: question.id, n: question.note, np: question.nonScoring });
  const source = sourceHtml({ i: question.id, source: question.source, u: question.citation });
  return <>
    <h1>⚡ Pregunta relámpago</h1>
    <p className="sub">{question.reason}</p>
    <article className="card q">
      <div className="meta"><span className="tag">{question.topicId} · {lightning.topicName(question.topicId)}</span></div>
      {notice && <StudyMarkup html={notice} />}{source && <StudyMarkup html={source} />}
      {question.context && <div className="ctx pre"><StudyMarkup html={richHtml(question.context)} /></div>}
      <div className="enun pre"><StudyMarkup html={richHtml(question.statement)} /></div>
      <div className="opts">{question.options.map((option, index) => <button key={`${question.id}-${index}`} className={`opt${answered === null ? '' : index === question.correctIndex ? ' ok' : answered === index ? ' bad' : ' dis'}`} disabled={answered !== null} onClick={() => {
        setAnswered(index);
        lightning.record(question.id, question.topicId, index === question.correctIndex, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      }}><b>{'ABCD'[index]}</b><span className="pre"><StudyMarkup html={richHtml(option)} /></span></button>)}</div>
      {answered !== null && <div className={`fb ${correct ? 'good' : 'wrong'}`} role="status"><b>{correct ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>{'ABCD'[question.correctIndex]}</b>
        {question.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(question.citation, question.options[question.correctIndex])} /></div>}
        {question.note && <div className="cita"><span>Nota</span>{question.note}</div>}
        {!!question.traps?.length && <div className="trap">Trampa: {question.traps.map(trap => TRAMPAS[trap] || String(trap)).join(' · ')}</div>}
      </div>}
    </article>
    <div className="bar2">{answered === null ? <Link className="btn sec" to="/home">Ahora no</Link> : <><button className="btn" autoFocus onClick={next}>Otra →</button><Link className="btn sec" to="/home">Inicio</Link></>}</div>
  </>;
}
