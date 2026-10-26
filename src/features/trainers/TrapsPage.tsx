import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ask } from '../../shared/ui/dialog-actions.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { TRAMPAS, TRAMPA_EXPL } from '../../shared/presentation/labels.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyServices, type TrapAnswer, type TrapRun } from '../../shared/ui/study-services.js';

export function TrapsPage() {
  const { traps } = useStudyServices();
  const navigate = useNavigate();
  const [run, setRun] = useState<TrapRun | null>(() => traps.getRun());
  const [loading, setLoading] = useState(!run);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [answer, setAnswer] = useState<TrapAnswer | null>(null);
  const [complete, setComplete] = useState(false);
  const [completedRun, setCompletedRun] = useState<TrapRun | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (run || complete) return;
    let active = true;
    void traps.startRun().then(value => { if (active) { setRun(value); setLoading(false); } }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [complete, run, traps]);

  const exit = async () => { if (await ask('¿Salir del ejercicio?', 'Salir')) { traps.resetRun(); navigate('/home'); } };
  if (loading) return <><h1>Detective de trampas</h1><p className="sub loading" role="status">Preparando preguntas…</p></>;
  if (error) return <><h1>Detective de trampas</h1><div className="card" role="alert"><p>No se pudo cargar el ejercicio. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { setError(false); setLoading(true); setRun(null); }}>Reintentar</button></div></>;
  if (complete && completedRun) {
    const total = completedRun.results.reduce((sum, item) => sum + item.total, 0);
    const hits = completedRun.results.reduce((sum, item) => sum + item.hits, 0);
    const falseAlarms = completedRun.results.reduce((sum, item) => sum + item.falseAlarms, 0);
    const weaknesses = traps.getWeaknesses();
    return <><h1>Detective de trampas</h1><div className="grid"><div className="stat"><b>{hits}/{total}</b><span>trampas detectadas</span></div><div className="stat"><b>{falseAlarms}</b><span>falsas alarmas</span></div></div>
      <div className="card"><h2 className="h3">Las que más se te escapan</h2>{weaknesses.length ? weaknesses.map(item => <div className="line" key={item.id}><span>{TRAMPAS[item.id] || item.id}</span><span>{Math.round(item.detected * 100 / item.seen)}% <small>({item.detected}/{item.seen})</small></span></div>) : <p className="sub">Aparecerá cuando hayas visto cada trampa al menos 3 veces.</p>}</div>
      <div className="bar2"><button className="btn" onClick={() => { traps.resetRun(); setComplete(false); setCompletedRun(null); setLoading(true); setRun(null); }}>Otra tanda</button><button className="btn sec" onClick={() => navigate('/home')}>Inicio</button></div>
    </>;
  }
  if (!run?.items.length) return <><h1>Detective de trampas</h1><div className="card"><p>No hay preguntas disponibles para este ejercicio.</p></div><button className="btn sec" onClick={() => navigate('/home')}>Inicio</button></>;

  const prompt = run.items[run.index];
  const notice = questionNotice({ i: prompt.id, n: prompt.note, np: prompt.nonScoring });
  const source = sourceHtml({ i: prompt.id, source: prompt.source, u: prompt.citation });
  const submit = () => {
    const result = traps.evaluate([...selected]);
    if (result) { setAnswer(result); setRun(traps.getRun()); }
  };
  const next = () => {
    const updated = traps.next();
    setSelected(new Set()); setAnswer(null);
    if (!updated) { setCompletedRun(run); setComplete(true); setRun(null); }
    else setRun(updated);
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const result = answer || run.results[run.index];

  return <>
    <div className="qhead"><button className="ghost" aria-label="Salir" onClick={() => void exit()}>✕</button><div className="prog" role="progressbar" aria-label="Progreso" aria-valuemin={0} aria-valuemax={run.items.length} aria-valuenow={run.index}><div style={{ width: `${100 * run.index / run.items.length}%` }} /></div><div className="cnt">{run.index + 1}/{run.items.length}</div></div>
    <h1 className="sub">🕵️ Detective de trampas</h1>
    <p className="sm">Lee el enunciado y todas las opciones: las trampas pueden estar en cualquiera de ellos.</p>
    <article className="card q"><div className="meta"><span className="tag">{prompt.topicId} · {prompt.topicName}</span></div>
      {notice && <StudyMarkup html={notice} />}{source && <StudyMarkup html={source} />}
      {prompt.context && <div className="ctx pre"><StudyMarkup html={richHtml(prompt.context)} /></div>}
      <div className="enun pre"><StudyMarkup html={richHtml(prompt.statement, true)} /></div>
      <div className="opts">{prompt.options.map((option, index) => <div className={`opt dis${result && index === prompt.correctIndex ? ' ok' : ''}`} key={`${prompt.id}-${index}`}><b>{'ABCD'[index]}</b><span className="pre"><StudyMarkup html={richHtml(option, true)} /></span></div>)}</div>
      <p><b>¿Qué trampas ves aquí?</b> <small>Marca todas las que apliquen ({prompt.trapIds.length === 1 ? 'hay 1 posible' : 'hay varias posibles'}).</small></p>
      <div className="mot">{prompt.choices.map(id => {
        const correctChoice = prompt.trapIds.includes(id), wasSelected = result?.selectedIds.includes(id) || selected.has(id);
        const className = result ? correctChoice ? wasSelected ? 'ok' : 'sug' : wasSelected ? 'bad' : '' : selected.has(id) ? 'on' : '';
        const label = result ? correctChoice ? `${wasSelected ? '✔ Detectada: ' : '○ No la viste: '}${TRAMPAS[id]}` : wasSelected ? `✖ Falsa alarma: ${TRAMPAS[id]}` : TRAMPAS[id] : TRAMPAS[id];
        return <button key={id} className={className} aria-pressed={selected.has(id)} disabled={!!result} onClick={() => setSelected(current => { const nextSelected = new Set(current); if (nextSelected.has(id)) nextSelected.delete(id); else nextSelected.add(id); return nextSelected; })}>{label}</button>;
      })}</div>
      {result && <div className={`fb ${result.missed || result.falseAlarms ? 'wrong' : 'good'}`} role="status"><b>{!result.missed && !result.falseAlarms ? '¡Detectadas todas!' : `Detectaste ${result.hits} de ${result.total}${result.falseAlarms ? ` y marcaste ${result.falseAlarms} de más` : ''}.`}</b> Respuesta correcta: <b>{'ABCD'[prompt.correctIndex]}</b>
        {[...result.correctIds].map(id => <div className={`trapx ${result.selectedIds.includes(id) ? 'trap-detected' : 'miss'}`} key={id}><b>{result.selectedIds.includes(id) ? 'Detectada' : 'No la viste'}: {TRAMPAS[id] || id}</b><p>{TRAMPA_EXPL[id] || ''}</p></div>)}
        {result.selectedIds.filter(id => !result.correctIds.includes(id)).map(id => <div className="trapx trap-false-alarm" key={id}><b>Falsa alarma: {TRAMPAS[id] || id}</b><p>No aplica aquí. {TRAMPA_EXPL[id] || ''}</p></div>)}
        {prompt.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(prompt.citation, prompt.options[prompt.correctIndex])} /></div>}{prompt.note && <div className="cita"><span>Nota</span>{prompt.note}</div>}
      </div>}
    </article>
    <div className="bar2"><button className="btn" onClick={result ? next : submit}>{result ? run.index + 1 === run.items.length ? 'Terminar →' : 'Siguiente →' : 'Comprobar'}</button></div>
  </>;
}
