import { useEffect, useState } from 'react';
import { Check, Circle, CircleX, ScanSearch } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ask } from '../../shared/ui/dialog-actions.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { TRAMPAS, TRAMPA_EXPL } from '../../shared/presentation/labels.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { StudyTextPanel } from '../../shared/ui/StudyTextPanel.js';
import { getTrapChoicePresentation } from './trap-choice-presentation.js';
import { useStudyService, type TrapAnswer, type TrapRun, type TrapsServices } from '../../shared/ui/study-services.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { PageMessage } from '../../shared/ui/PageMessage.js';
import { StudyFeedback } from '../../shared/ui/StudyFeedback.js';
import { StudyQuestionSources } from '../../shared/ui/StudyQuestionSources.js';
import { StudyProgressBar } from '../../shared/ui/StudyProgressBar.js';
import { StudyExitButton } from '../../shared/ui/StudyExitButton.js';

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
  if (error) return <><h1>Detective de trampas</h1><PageMessage role="alert"><p>No se pudo cargar el ejercicio. Comprueba la conexión e inténtalo de nuevo.</p><button className="btn" onClick={() => { setError(false); setLoading(true); setRun(null); }}>Reintentar</button></PageMessage></>;
  if (complete && completedRun) return <TrapSummary run={completedRun} traps={traps} onAgain={() => { traps.resetRun(); setComplete(false); setCompletedRun(null); setLoading(true); setRun(null); }} onHome={() => navigate('/home')} />;
  if (!run?.items.length) return <><h1>Detective de trampas</h1><PageMessage><p>No hay preguntas disponibles para este ejercicio.</p></PageMessage><button className="btn sec" onClick={() => navigate('/home')}>Inicio</button></>;

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
    <div className="qhead"><StudyExitButton onExit={onExit} /><StudyProgressBar trackClassName="prog" fillClassName="origin-left animate-[grow_.45s_cubic-bezier(.2,.7,.2,1)]" percent={100 * run.index / run.items.length} valueNow={run.index} valueMax={run.items.length} /><div className="cnt">{run.index + 1}/{run.items.length}</div></div>
    <h1 className="sub"><ScanSearch className="inline-feature-icon" size="1em" strokeWidth={1.7} aria-hidden="true" /> Detective de trampas</h1><p className="sm">Lee el enunciado y todas las opciones: las trampas pueden estar en cualquiera de ellos.</p>
    <article className="card q"><div className="meta"><span className="tag">{prompt.topicId} · {prompt.topicName}</span></div>
      <StudyQuestionSources noticeHtml={notice} sourceHtml={source} languageContext={prompt.statement} />
      {prompt.context && <div className="ctx pre"><StudyMarkup html={richHtml(prompt.context)} languageContext={prompt.statement} /></div>}
      <div className="enun pre"><StudyMarkup html={richHtml(prompt.statement, true)} languageContext={prompt.statement} /></div>
      <div className="opts">{prompt.options.map((option, index) => <div className={`opt dis${result && index === prompt.correctIndex ? ' ok' : ''}`} key={`${prompt.id}-${index}`}><b>{'ABCD'[index]}</b><span className="pre"><StudyMarkup html={richHtml(option, true)} languageContext={prompt.statement} /></span></div>)}</div>
      <p><b>¿Qué trampas ves aquí?</b> <small>Marca todas las que apliquen ({prompt.trapIds.length === 1 ? 'hay 1 posible' : 'hay varias posibles'}).</small></p>
      <div className="mot">{prompt.choices.map(id => <TrapChoice key={id} id={id} selected={selected.has(id)} correct={correctIds.has(id)} revealed={!!result} wasSelected={resultSelectedIds.has(id)} onToggle={onToggle} />)}</div>
      {result && <TrapFeedback prompt={prompt} result={result} selectedIds={resultSelectedIds} falseAlarms={falseAlarms} />}
    </article>
    <div className="bar2"><button className="btn" onClick={result ? onNext : onSubmit}>{result ? run.index + 1 === run.items.length ? 'Terminar →' : 'Siguiente →' : 'Comprobar'}</button></div>
  </>;
}

function TrapChoice({ id, selected, correct, revealed, wasSelected, onToggle }: { id: number; selected: boolean; correct: boolean; revealed: boolean; wasSelected: boolean; onToggle(id: number): void }) {
  const trapLabel = TRAMPAS[id] || String(id);
  const presentation = getTrapChoicePresentation({ trapLabel, selected, correct, revealed, wasSelected });
  const Icon = presentation.icon === 'check' ? Check : presentation.icon === 'circle' ? Circle : presentation.icon === 'circle-x' ? CircleX : null;
  return <button className={presentation.className} aria-pressed={selected} disabled={revealed} onClick={() => onToggle(id)}>{Icon && <Icon size="1em" aria-hidden="true" />}{presentation.label}</button>;
}

function TrapFeedback({ prompt, result, selectedIds, falseAlarms }: { prompt: TrapRun['items'][number]; result: TrapAnswer; selectedIds: ReadonlySet<number>; falseAlarms: readonly number[] }) {
  return <StudyFeedback tone={result.missed || result.falseAlarms ? 'wrong' : 'good'}><b>{!result.missed && !result.falseAlarms ? '¡Detectadas todas!' : `Detectaste ${result.hits} de ${result.total}${result.falseAlarms ? ` y marcaste ${result.falseAlarms} de más` : ''}.`}</b> Respuesta correcta: <b>{'ABCD'[prompt.correctIndex]}</b>
    {result.correctIds.map(id => <div className={`trapx my-2.5 rounded-[var(--r-m)] border border-[var(--line)] border-l-4 bg-[var(--card)] px-3.5 py-3 ${selectedIds.has(id) ? 'trap-detected border-l-[var(--ok)]' : 'miss border-l-[var(--amber-strong)]'}`} key={id}><b className="text-[length:var(--fs-b)]">{selectedIds.has(id) ? 'Detectada' : 'No la viste'}: {TRAMPAS[id] || id}</b><p className="mb-0 mt-1 text-[length:var(--fs-m)] leading-[1.45] text-[var(--ink)]">{TRAMPA_EXPL[id] || ''}</p></div>)}
    {falseAlarms.map(id => <div className="trapx trap-false-alarm my-2.5 rounded-[var(--r-m)] border border-[var(--line)] border-l-4 border-l-[var(--bad)] bg-[var(--card)] px-3.5 py-3" key={id}><b className="text-[length:var(--fs-b)]">Falsa alarma: {TRAMPAS[id] || id}</b><p className="mb-0 mt-1 text-[length:var(--fs-m)] leading-[1.45] text-[var(--ink)]">No aplica aquí. {TRAMPA_EXPL[id] || ''}</p></div>)}
    {prompt.citation && <StudyTextPanel title="Temario" html={hiliteHtml(prompt.citation, prompt.options[prompt.correctIndex])} languageContext={prompt.statement} />}
    {prompt.note && <StudyTextPanel title="Nota" html={richHtml(prompt.note)} languageContext={prompt.statement} />}
  </StudyFeedback>;
}

function TrapSummary({ run, traps, onAgain, onHome }: { run: TrapRun; traps: TrapsServices; onAgain(): void; onHome(): void }) {
  const total = run.results.reduce((sum, item) => sum + item.total, 0);
  const hits = run.results.reduce((sum, item) => sum + item.hits, 0);
  const falseAlarms = run.results.reduce((sum, item) => sum + item.falseAlarms, 0);
  const weaknesses = traps.getWeaknesses();
  return <><h1>Detective de trampas</h1><div className="stats-grid"><div className="stat"><b>{hits}/{total}</b><span>trampas detectadas</span></div><div className="stat"><b>{falseAlarms}</b><span>falsas alarmas</span></div></div>
    <div className="card"><h2 className="h3">Las que más se te escapan</h2>{weaknesses.length ? weaknesses.map(item => <div className="line" key={item.id}><span>{TRAMPAS[item.id] || item.id}</span><span>{Math.round(item.detected * 100 / item.seen)}% <small>({item.detected}/{item.seen})</small></span></div>) : <p className="sub">Aparecerá cuando hayas visto cada trampa al menos 3 veces.</p>}</div>
    <div className="bar2"><button className="btn" onClick={onAgain}>Otra tanda</button><button className="btn sec" onClick={onHome}>Inicio</button></div>
  </>;
}
