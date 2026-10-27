import { useEffect, useState } from 'react';
import { Check, Circle, CircleX, ScanSearch, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ask } from '../../shared/ui/dialog-actions.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { TRAMPAS, TRAMPA_EXPL } from '../../shared/presentation/labels.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { useStudyService, type TrapAnswer, type TrapRun, type TrapsServices } from '../../shared/ui/study-services.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';

export function TrapsPage() {
  const traps = useStudyService('traps');
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
  if (loading) return <PageLoading variant="study" />;
  if (error) return <><h1>Detective de trampas</h1><div className="card" role="alert"><p>No se pudo cargar el ejercicio. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { setError(false); setLoading(true); setRun(null); }}>Reintentar</button></div></>;
  if (complete && completedRun) return <TrapSummary run={completedRun} traps={traps} onAgain={() => { traps.resetRun(); setComplete(false); setCompletedRun(null); setLoading(true); setRun(null); }} onHome={() => navigate('/home')} />;
  if (!run?.items.length) return <><h1>Detective de trampas</h1><div className="card"><p>No hay preguntas disponibles para este ejercicio.</p></div><button className="btn sec" onClick={() => navigate('/home')}>Inicio</button></>;

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
  return <TrapQuestion run={run} selected={selected} result={answer || run.results[run.index]} onToggle={id => setSelected(current => {
    const changed = new Set(current);
    if (changed.has(id)) changed.delete(id); else changed.add(id);
    return changed;
  })} onExit={() => void exit()} onSubmit={submit} onNext={next} />;
}

function TrapQuestion({ run, selected, result, onToggle, onExit, onSubmit, onNext }: {
  run: TrapRun; selected: ReadonlySet<number>; result: TrapAnswer | undefined;
  onToggle(id: number): void; onExit(): void; onSubmit(): void; onNext(): void;
}) {
  const prompt = run.items[run.index];
  const notice = questionNotice({ i: prompt.id, n: prompt.note, np: prompt.nonScoring });
  const source = sourceHtml({ i: prompt.id, source: prompt.source, u: prompt.citation });
  const correctIds = new Set(result?.correctIds || prompt.trapIds);
  const resultSelectedIds = new Set(result?.selectedIds || []);
  const falseAlarms = result ? result.selectedIds.filter(id => !correctIds.has(id)) : [];
  return <>
    <div className="qhead"><button className="ghost" aria-label="Salir" onClick={onExit}><X size="1.25rem" aria-hidden="true" /></button><div className="prog" role="progressbar" aria-label="Progreso" aria-valuemin={0} aria-valuemax={run.items.length} aria-valuenow={run.index}><div style={{ width: `${100 * run.index / run.items.length}%` }} /></div><div className="cnt">{run.index + 1}/{run.items.length}</div></div>
    <h1 className="sub"><ScanSearch className="inline-feature-icon" size="1em" strokeWidth={1.7} aria-hidden="true" /> Detective de trampas</h1><p className="sm">Lee el enunciado y todas las opciones: las trampas pueden estar en cualquiera de ellos.</p>
    <article className="card q"><div className="meta"><span className="tag">{prompt.topicId} · {prompt.topicName}</span></div>
      {notice && <StudyMarkup html={notice} />}{source && <StudyMarkup html={source} />}
      {prompt.context && <div className="ctx pre"><StudyMarkup html={richHtml(prompt.context)} /></div>}
      <div className="enun pre"><StudyMarkup html={richHtml(prompt.statement, true)} /></div>
      <div className="opts">{prompt.options.map((option, index) => <div className={`opt dis${result && index === prompt.correctIndex ? ' ok' : ''}`} key={`${prompt.id}-${index}`}><b>{'ABCD'[index]}</b><span className="pre"><StudyMarkup html={richHtml(option, true)} /></span></div>)}</div>
      <p><b>¿Qué trampas ves aquí?</b> <small>Marca todas las que apliquen ({prompt.trapIds.length === 1 ? 'hay 1 posible' : 'hay varias posibles'}).</small></p>
      <div className="mot">{prompt.choices.map(id => <TrapChoice key={id} id={id} selected={selected.has(id)} correct={correctIds.has(id)} revealed={!!result} wasSelected={resultSelectedIds.has(id)} onToggle={onToggle} />)}</div>
      {result && <TrapFeedback prompt={prompt} result={result} selectedIds={resultSelectedIds} falseAlarms={falseAlarms} />}
    </article>
    <div className="bar2"><button className="btn" onClick={result ? onNext : onSubmit}>{result ? run.index + 1 === run.items.length ? 'Terminar →' : 'Siguiente →' : 'Comprobar'}</button></div>
  </>;
}

function TrapChoice({ id, selected, correct, revealed, wasSelected, onToggle }: { id: number; selected: boolean; correct: boolean; revealed: boolean; wasSelected: boolean; onToggle(id: number): void }) {
  const trapLabel = TRAMPAS[id] || String(id);
  let className = selected ? 'on' : '';
  let label = trapLabel;
  if (revealed && correct) {
    className = wasSelected ? 'ok' : 'sug';
    label = `${wasSelected ? 'Detectada: ' : 'No la viste: '}${trapLabel}`;
  } else if (revealed && wasSelected) {
    className = 'bad';
    label = `Falsa alarma: ${trapLabel}`;
  } else if (revealed) className = '';
  return <button className={className} aria-pressed={selected} disabled={revealed} onClick={() => onToggle(id)}>{revealed && correct ? wasSelected ? <Check size="1em" aria-hidden="true" /> : <Circle size="1em" aria-hidden="true" /> : revealed && wasSelected ? <CircleX size="1em" aria-hidden="true" /> : null}{label}</button>;
}

function TrapFeedback({ prompt, result, selectedIds, falseAlarms }: { prompt: TrapRun['items'][number]; result: TrapAnswer; selectedIds: ReadonlySet<number>; falseAlarms: readonly number[] }) {
  return <div className={`fb ${result.missed || result.falseAlarms ? 'wrong' : 'good'}`} role="status"><b>{!result.missed && !result.falseAlarms ? '¡Detectadas todas!' : `Detectaste ${result.hits} de ${result.total}${result.falseAlarms ? ` y marcaste ${result.falseAlarms} de más` : ''}.`}</b> Respuesta correcta: <b>{'ABCD'[prompt.correctIndex]}</b>
    {result.correctIds.map(id => <div className={`trapx ${selectedIds.has(id) ? 'trap-detected' : 'miss'}`} key={id}><b>{selectedIds.has(id) ? 'Detectada' : 'No la viste'}: {TRAMPAS[id] || id}</b><p>{TRAMPA_EXPL[id] || ''}</p></div>)}
    {falseAlarms.map(id => <div className="trapx trap-false-alarm" key={id}><b>Falsa alarma: {TRAMPAS[id] || id}</b><p>No aplica aquí. {TRAMPA_EXPL[id] || ''}</p></div>)}
    {prompt.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(prompt.citation, prompt.options[prompt.correctIndex])} /></div>}{prompt.note && <div className="cita"><span>Nota</span>{prompt.note}</div>}
  </div>;
}

function TrapSummary({ run, traps, onAgain, onHome }: { run: TrapRun; traps: TrapsServices; onAgain(): void; onHome(): void }) {
  const total = run.results.reduce((sum, item) => sum + item.total, 0);
  const hits = run.results.reduce((sum, item) => sum + item.hits, 0);
  const falseAlarms = run.results.reduce((sum, item) => sum + item.falseAlarms, 0);
  const weaknesses = traps.getWeaknesses();
  return <><h1>Detective de trampas</h1><div className="grid"><div className="stat"><b>{hits}/{total}</b><span>trampas detectadas</span></div><div className="stat"><b>{falseAlarms}</b><span>falsas alarmas</span></div></div>
    <div className="card"><h2 className="h3">Las que más se te escapan</h2>{weaknesses.length ? weaknesses.map(item => <div className="line" key={item.id}><span>{TRAMPAS[item.id] || item.id}</span><span>{Math.round(item.detected * 100 / item.seen)}% <small>({item.detected}/{item.seen})</small></span></div>) : <p className="sub">Aparecerá cuando hayas visto cada trampa al menos 3 veces.</p>}</div>
    <div className="bar2"><button className="btn" onClick={onAgain}>Otra tanda</button><button className="btn sec" onClick={onHome}>Inicio</button></div>
  </>;
}
