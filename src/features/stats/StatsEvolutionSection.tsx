import type { ComponentType } from 'react';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import type { StatsSnapshot, StatsServices, StatsWeek } from '../../shared/ui/study-services.js';

type QuestionWeek = { start: number; seen: number; correct: number; wrong: number; unknown: number };
type EvolutionPreference = Record<string, string | number | boolean> & { mode?: string; filter?: string | number; weeks?: string | number; table?: boolean };
type LineChartProps = { values: readonly (number | null)[]; label: string; generatedAt: number };
type Chart = ComponentType<LineChartProps>;
const date = (time: number) => new Date(time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

export function QuestionEvolutionChart({ weeks }: { weeks: readonly QuestionWeek[] }) {
  const max = Math.max(1, ...weeks.map(week => week.seen)), width = 440, height = 210, left = 38, right = 12, top = 14, bottom = 30, plotW = width - left - right, plotH = height - top - bottom;
  const x = (i: number) => left + (weeks.length === 1 ? plotW / 2 : plotW * i / Math.max(1, weeks.length - 1)), y = (value: number) => top + plotH * (1 - value / max);
  const series = [{ key: 'seen', label: 'Vistas', color: 'var(--selb)' }, { key: 'correct', label: 'Acertadas', color: 'var(--good-ink)' }, { key: 'wrong', label: 'Falladas', color: 'var(--r-ink)' }, { key: 'unknown', label: 'No lo sé', color: 'var(--mute)' }] as const;
  return <><div className="evo"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución semanal de preguntas vistas, acertadas, falladas y marcadas como no lo sé">
    {[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={width - right} y1={y(max * fraction)} y2={y(max * fraction)} className="gl" /><text x={left - 6} y={y(max * fraction) + 4} textAnchor="end" className="gt">{Math.round(max * fraction)}</text></g>)}
    {series.map(item => <g key={item.key}><polyline points={weeks.map((week, index) => `${x(index)},${y(week[item.key])}`).join(' ')} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />{weeks.map((week, index) => <circle key={week.start} cx={x(index)} cy={y(week[item.key])} r="2.5" fill={item.color}><title>{`Semana del ${date(week.start)}: ${item.label.toLowerCase()} ${week[item.key]}`}</title></circle>)}</g>)}
    {weeks.filter((_, index) => index % Math.max(1, Math.ceil(weeks.length / 6)) === 0 || index === weeks.length - 1).map(week => <text key={week.start} x={x(weeks.indexOf(week))} y={height - 5} textAnchor="middle" className="gt">{date(week.start)}</text>)}
  </svg></div><div className="evolution-legend">{series.map(item => <span className="evolution-key" key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div><p className="legend">El historial detallado está disponible desde que se activó esta función; sesiones anteriores no se reconstruyen.</p></>;
}

function QuestionHistory({ weeks }: { weeks: readonly QuestionWeek[] }) {
  if (!weeks.some(week => week.seen)) return <p className="sub">Aún no hay sesiones completadas con historial detallado en este periodo. Los registros antiguos no se reconstruyen.</p>;
  return <div className="card"><QuestionEvolutionChart weeks={weeks} /><div className="table-scroll" role="region" aria-label="Datos semanales de evolución" tabIndex={0}><table className="tb"><caption>Preguntas por semana</caption><thead><tr>{['Semana', 'Vistas', 'Acertadas', 'Falladas', 'No lo sé'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{weeks.filter(week => week.seen).map(week => <tr key={week.start}><td>{date(week.start)}</td><td>{week.seen}</td><td>{week.correct}</td><td>{week.wrong}</td><td>{week.unknown}</td></tr>)}</tbody></table></div></div>;
}

function MetricHistory({ snapshot, weekly, evolution, saveEvolution, LineChart }: { snapshot: StatsSnapshot; weekly: readonly StatsWeek[]; evolution: EvolutionPreference; saveEvolution: (next: Record<string, string | number | boolean>) => void; LineChart: Chart }) {
  const timed = evolution.mode === 'tiempo';
  const series = weekly.map(week => timed ? week.secondsPerQuestion : week.accuracy);
  return <div className="card"><div className="seg"><button className={!timed ? 'on' : ''} aria-pressed={!timed} onClick={() => saveEvolution({ mode: 'acierto' })}>Acierto</button><button className={timed ? 'on' : ''} aria-pressed={timed} onClick={() => saveEvolution({ mode: 'tiempo' })}>Tiempo por pregunta</button></div>
    <div className="row"><label>Qué medir en la evolución<select aria-label="Qué medir en la evolución" disabled={timed} value={String(evolution.filter)} onChange={event => saveEvolution({ filter: event.target.value })}><option value="g">Todo el temario</option><optgroup label="Por tipo de pregunta">{snapshot.types.map(type => <option key={type.id} value={`k:${type.id}`}>{type.label}</option>)}</optgroup><optgroup label="Por tema">{snapshot.topics.map(topic => <option key={topic.id} value={`t:${topic.id}`}>{topic.id} {topic.name}</option>)}</optgroup></select></label><label>Número de semanas<select aria-label="Número de semanas" value={String(evolution.weeks)} onChange={event => saveEvolution({ weeks: Number(event.target.value) })}>{[8, 12, 26].map(weeks => <option key={weeks}>{weeks}</option>)}</select></label></div>
    <LineChart label={timed ? 'Segundos medios por pregunta cada semana' : 'Acierto cada semana'} values={series} generatedAt={snapshot.generatedAt} />
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
  return <><h2>Preguntas lentas</h2><div className="card"><div className="seg"><button className={!onlyCorrect ? 'on' : ''} aria-pressed={!onlyCorrect} onClick={() => setOnlyCorrect(false)}>Todas</button><button className={onlyCorrect ? 'on' : ''} aria-pressed={onlyCorrect} onClick={() => setOnlyCorrect(true)}>Las que aciertas</button></div><p className="legend">Las que más tardas en contestar. Si las aciertas pero tardas mucho, probablemente aún no las dominas.</p>{questions.map(item => <div className="sl" key={item.id}><div className="slh"><b>{Math.round(item.averageSeconds)} s</b><small>{item.correct}/{item.attempts} aciertos{item.lastOutcome === 1 ? ' · última ✓' : item.lastOutcome === 0 ? ' · última ✗' : ''}</small></div><div className="sm">{item.id}</div></div>)}<div className="row"><button className="btn" onClick={() => { void practice(); }}>Practicar estas preguntas</button></div></div></>;
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

export function StatsEvolutionSection({ snapshot, stats, questionWeeks, weekly, evolution, saveEvolution, onlyCorrect, setOnlyCorrect, setMessage, strategy, setStrategy, strategyDays, setStrategyDays, strategyBusy, setStrategyBusy, LineChart }: {
  snapshot: StatsSnapshot; stats: StatsServices; questionWeeks: readonly QuestionWeek[]; weekly: readonly StatsWeek[];
  evolution: EvolutionPreference; saveEvolution: (next: Record<string, string | number | boolean>) => void;
  onlyCorrect: boolean; setOnlyCorrect: (value: boolean) => void; setMessage: (value: string) => void;
  strategy: string; setStrategy: (value: string) => void; strategyDays: number; setStrategyDays: (value: number) => void;
  strategyBusy: boolean; setStrategyBusy: (value: boolean) => void; LineChart: Chart;
}) {
  return <section aria-label="Evolución del estudio"><h2>Evolución</h2><h3>Resultados de preguntas</h3><QuestionHistory weeks={questionWeeks} /><MetricHistory snapshot={snapshot} weekly={weekly} evolution={evolution} saveEvolution={saveEvolution} LineChart={LineChart} />
    <SlowQuestions snapshot={snapshot} stats={stats} onlyCorrect={onlyCorrect} setOnlyCorrect={setOnlyCorrect} setMessage={setMessage} />
    <StrategyAnalysis stats={stats} strategy={strategy} setStrategy={setStrategy} days={strategyDays} setDays={setStrategyDays} busy={strategyBusy} setBusy={setStrategyBusy} />
  </section>;
}
