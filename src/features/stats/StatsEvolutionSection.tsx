import { Check, X } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import type { StatsServices } from '../../shared/ui/study-services.js';
import type { StatsSnapshot, StatsWeek } from '../../core/application/stats/statistics-model.js';
import type { QuestionEvolutionPoint, TrendPoint } from './StatsCharts.js';

type QuestionWeek = QuestionEvolutionPoint;
type EvolutionPreference = Record<string, string | number | boolean> & { mode?: string; filter?: string | number; weeks?: string | number; table?: boolean };
const date = (time: number) => new Date(time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const StatsTrendChart = lazy(() => import('./StatsCharts.js').then(module => ({ default: module.StatsTrendChart })));
const QuestionEvolutionChart = lazy(() => import('./StatsCharts.js').then(module => ({ default: module.QuestionEvolutionChart })));

function QuestionHistory({ weeks }: { weeks: readonly QuestionWeek[] }) {
  if (!weeks.some(week => week.seen)) return <p className="sub">Aún no hay sesiones completadas con historial detallado en este periodo. Los registros antiguos no se reconstruyen.</p>;
  return <div className="card"><Suspense fallback={<p className="sub chart-loading" role="status">Cargando gráfico…</p>}><QuestionEvolutionChart weeks={weeks} /></Suspense><div className="table-scroll" role="region" aria-label="Datos semanales de evolución" tabIndex={0}><table className="tb"><caption>Preguntas por semana</caption><thead><tr>{['Semana', 'Vistas', 'Acertadas', 'Falladas', 'No lo sé'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{weeks.filter(week => week.seen).map(week => <tr key={week.start}><td>{date(week.start)}</td><td>{week.seen}</td><td>{week.correct}</td><td>{week.wrong}</td><td>{week.unknown}</td></tr>)}</tbody></table></div></div>;
}

function MetricHistory({ snapshot, weekly, evolution, saveEvolution }: { snapshot: StatsSnapshot; weekly: readonly StatsWeek[]; evolution: EvolutionPreference; saveEvolution: (next: Record<string, string | number | boolean>) => void }) {
  const timed = evolution.mode === 'tiempo';
  const points = weekly.map(week => ({ timestamp: week.start, value: timed ? week.secondsPerQuestion : week.accuracy })) as TrendPoint[];
  return <div className="card"><div className="seg"><button className={!timed ? 'on' : ''} aria-pressed={!timed} onClick={() => saveEvolution({ mode: 'acierto' })}>Acierto</button><button className={timed ? 'on' : ''} aria-pressed={timed} onClick={() => saveEvolution({ mode: 'tiempo' })}>Tiempo por pregunta</button></div>
    <div className="row"><label>Qué medir en la evolución<select aria-label="Qué medir en la evolución" disabled={timed} value={String(evolution.filter)} onChange={event => saveEvolution({ filter: event.target.value })}><option value="g">Todo el temario</option><optgroup label="Por tipo de pregunta">{snapshot.types.map(type => <option key={type.id} value={`k:${type.id}`}>{type.label}</option>)}</optgroup><optgroup label="Por tema">{snapshot.topics.map(topic => <option key={topic.id} value={`t:${topic.id}`}>{topic.id} {topic.name}</option>)}</optgroup></select></label><label>Número de semanas<select aria-label="Número de semanas" value={String(evolution.weeks)} onChange={event => saveEvolution({ weeks: Number(event.target.value) })}>{[8, 12, 26].map(weeks => <option key={weeks}>{weeks}</option>)}</select></label></div>
    <Suspense fallback={<p className="sub chart-loading" role="status">Cargando gráfico…</p>}><StatsTrendChart label={timed ? 'Segundos medios por pregunta cada semana' : 'Acierto cada semana'} metric={timed ? 'Segundos por pregunta' : 'Acierto'} suffix={timed ? ' s' : '%'} points={points} emptyMessage="Aún no hay datos de evolución para el periodo seleccionado." /></Suspense>
    <p className="legend">{timed ? 'Segundos medios por pregunta en tus sesiones (sin contar pausas).' : 'Porcentaje de aciertos por semana, sobre las preguntas contestadas en esa semana.'}<button className="ghost sm" aria-expanded={!!evolution.table} onClick={() => saveEvolution({ table: !evolution.table })}>{evolution.table ? 'Ocultar tabla' : 'Ver tabla'}</button></p>
    {evolution.table && <div className="table-scroll" role="region" aria-label="Tabla de progreso" tabIndex={0}><table className="tb"><caption>Evolución semanal</caption><thead><tr><th>Semana</th><th>{timed ? 'seg/preg.' : 'Acierto'}</th><th>Resp.</th></tr></thead><tbody>{weekly.filter(week => week.n).map(week => <tr key={week.start}><td>{date(week.start)}</td><td>{timed ? week.secondsPerQuestion ?? '—' : week.accuracy ?? '—'}</td><td>{week.n}</td></tr>)}</tbody></table></div>}
  </div>;
}

function SlowQuestions({ snapshot, stats, onlyCorrect, setOnlyCorrect, setMessage }: { snapshot: StatsSnapshot; stats: StatsServices; onlyCorrect: boolean; setOnlyCorrect: (value: boolean) => void; setMessage: (value: string) => void }) {
  const questions = snapshot.slow.filter(item => !onlyCorrect || item.lastOutcome === 1);
  const practice = async () => {
    try { const result = await stats.practiceSlow(onlyCorrect); if (result === 'empty') setMessage('Aún no hay tiempos guardados para practicar.'); }
    catch { setMessage('No se pudieron preparar las preguntas lentas.'); }
  };
  return <><h2>Preguntas lentas</h2><div className="card"><div className="seg"><button className={!onlyCorrect ? 'on' : ''} aria-pressed={!onlyCorrect} onClick={() => setOnlyCorrect(false)}>Todas</button><button className={onlyCorrect ? 'on' : ''} aria-pressed={onlyCorrect} onClick={() => setOnlyCorrect(true)}>Las que aciertas</button></div><p className="legend">Las que más tardas en contestar. Si las aciertas pero tardas mucho, probablemente aún no las dominas.</p>{questions.map(item => <div className="sl" key={item.id}><div className="slh"><b>{Math.round(item.averageSeconds)} s</b><small>{item.correct}/{item.attempts} aciertos{item.lastOutcome === 1 ? <> · última <Check size="1em" aria-hidden="true" /></> : item.lastOutcome === 0 ? <> · última <X size="1em" aria-hidden="true" /></> : ''}</small></div><div className="sm">{item.id}</div></div>)}<div className="row"><button className="btn" onClick={() => { void practice(); }}>Practicar estas preguntas</button></div></div></>;
}

function StrategyAnalysis({ stats, strategy, setStrategy, days, setDays, busy, setBusy }: { stats: StatsServices; strategy: string; setStrategy: (value: string) => void; days: number; setDays: (value: number) => void; busy: boolean; setBusy: (value: boolean) => void }) {
  const calculate = async () => {
    setBusy(true);
    try { setStrategy(await stats.loadStrategy(days)); }
    catch { setStrategy('No se pudo leer el historial detallado. El progreso agregado sigue disponible.'); }
    finally { setBusy(false); }
  };
  return <><h2>Analítica de estrategia</h2><div className="card"><p>Informe experimental sobre el historial detallado. Solo incluye sesiones completadas. Recomendaciones con al menos 20 respuestas en 3 sesiones; describen asociación observada, no causalidad.</p><label htmlFor="strategy-period">Periodo</label><select id="strategy-period" value={days} onChange={event => setDays(Number(event.target.value))}><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option><option value={365}>Último año</option></select><button className="btn" disabled={busy} onClick={() => { void calculate(); }}>{busy ? 'Calculando…' : 'Calcular informe'}</button>{strategy && <div aria-live="polite"><StudyMarkup html={strategy} /></div>}</div></>;
}

export function StatsEvolutionSection({ snapshot, stats, questionWeeks, weekly, evolution, saveEvolution, onlyCorrect, setOnlyCorrect, setMessage, strategy, setStrategy, strategyDays, setStrategyDays, strategyBusy, setStrategyBusy }: {
  snapshot: StatsSnapshot; stats: StatsServices; questionWeeks: readonly QuestionWeek[]; weekly: readonly StatsWeek[];
  evolution: EvolutionPreference; saveEvolution: (next: Record<string, string | number | boolean>) => void;
  onlyCorrect: boolean; setOnlyCorrect: (value: boolean) => void; setMessage: (value: string) => void;
  strategy: string; setStrategy: (value: string) => void; strategyDays: number; setStrategyDays: (value: number) => void;
  strategyBusy: boolean; setStrategyBusy: (value: boolean) => void;
}) {
  return <section aria-label="Evolución del estudio"><h2>Evolución</h2><h3>Resultados de preguntas</h3><QuestionHistory weeks={questionWeeks} /><MetricHistory snapshot={snapshot} weekly={weekly} evolution={evolution} saveEvolution={saveEvolution} />
    <SlowQuestions snapshot={snapshot} stats={stats} onlyCorrect={onlyCorrect} setOnlyCorrect={setOnlyCorrect} setMessage={setMessage} />
    <StrategyAnalysis stats={stats} strategy={strategy} setStrategy={setStrategy} days={strategyDays} setDays={setStrategyDays} busy={strategyBusy} setBusy={setStrategyBusy} />
  </section>;
}
