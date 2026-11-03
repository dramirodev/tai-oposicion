import { useEffect, useState } from 'react';
import { useStudyService } from '../../shared/ui/study-services.js';
import type { StatsSnapshot, StatsWeek } from '../../core/application/stats/statistics-model.js';
import { StatsTopicsSection } from './StatsTopicsSection.js';
import { StatsSimulationSection } from './StatsSimulationSection.js';
import { StatsEvolutionSection } from './StatsEvolutionSection.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import type { ObservedStudyTime } from '../../core/domain/attempts/observed-study-time.js';

type Tab = 'temas' | 'sims' | 'evo';
const date = (time: number) => new Date(time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
function formatObservedDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return 'Menos de 1 min';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${minutes} min`;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function ObservedStudyTimeSummary({ value, loaded }: { value: ObservedStudyTime | null; loaded: boolean }) {
  return <section className="card" aria-label="Tiempo activo en preguntas">
    <h2 className="h3">Tiempo activo en preguntas</h2>
    {!loaded ? <p role="status">Calculando el tiempo registrado…</p> : !value ? <p role="status">No se pudo cargar el tiempo registrado. El resto del progreso sigue disponible.</p> : value.questionAttempts === 0 ? <p>Aún no hay sesiones con tiempo registrado.</p> : <>
      <div className="stats-grid"><div className="stat"><b>{value.observedMilliseconds > 0 ? formatObservedDuration(value.observedMilliseconds) : 'Sin tiempo medible'}</b><span>Tiempo acumulado observado en preguntas</span></div></div>
      <p>{value.completeAttempts + value.partialAttempts} preguntas con tiempo observado: {value.completeAttempts} completas y {value.partialAttempts} parciales. {value.unavailableAttempts ? `${value.unavailableAttempts} sin datos de tiempo.` : ''}</p>
      <p className="legend">Cuenta solo los intervalos en que una pregunta estuvo abierta y la aplicación visible. No incluye lectura ni tarjetas, y no reconstruye actividad antigua sin datos.</p>
    </>}
  </section>;
}

export function StatsPage() {
  const stats = useStudyService('stats');
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('temas');
  const [domainOrder, setDomainOrder] = useState(() => String(stats.getPreference('domainOrder').order || 'tema'));
  const [evolution, setEvolution] = useState(() => stats.getPreference('evolution'));
  const [questionWeeks, setQuestionWeeks] = useState<readonly { start: number; seen: number; correct: number; wrong: number; unknown: number }[]>([]);
  const [studyTime, setStudyTime] = useState<ObservedStudyTime | null>(null);
  const [studyActivityLoaded, setStudyActivityLoaded] = useState(false);
  const [weekly, setWeekly] = useState<readonly StatsWeek[]>([]);
  const [slowOnlyCorrect, setSlowOnlyCorrect] = useState(false);
  const [strategy, setStrategy] = useState('');
  const [strategyDays, setStrategyDays] = useState(90);
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [firstSimulation, setFirstSimulation] = useState('');
  const [secondSimulation, setSecondSimulation] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { let active = true; void stats.load().then(value => { if (active) { setSnapshot(value); setFirstSimulation(value.simulations.at(-2)?.id || value.simulations.at(-1)?.id || ''); setSecondSimulation(value.simulations.at(-1)?.id || ''); } }).catch(() => { if (active) setError('No se pudo cargar el progreso. Inténtalo de nuevo.'); }); return () => { active = false; }; }, [stats]);
  useEffect(() => { let active = true; void stats.loadStudyActivity(12).then(value => { if (active) { setQuestionWeeks(value.questionEvolution); setStudyTime(value.observedStudyTime); setStudyActivityLoaded(true); } }).catch(() => { if (active) { setStudyActivityLoaded(true); setMessage('No se pudo leer el historial detallado. El resto del progreso sigue disponible.'); } }); return () => { active = false; }; }, [stats]);
  useEffect(() => {
    let active = true;
    const filter = String(evolution.filter || 'g');
    const weeks = Number(evolution.weeks || 12);
    void stats.loadWeekly({ weeks, ...(filter.startsWith('t:') ? { topic: filter.slice(2) } : filter.startsWith('k:') ? { type: filter.slice(2) } : {}) })
      .then(value => { if (active) setWeekly(value); })
      .catch(() => { if (active) setMessage('No se pudo cargar la evolución de las sesiones.'); });
    return () => { active = false; };
  }, [evolution, stats]);
  if (error) return <><h1>Progreso</h1><p className="note" role="alert">{error}</p><button className="btn" onClick={() => { setError(''); void stats.load().then(setSnapshot).catch(() => setError('No se pudo cargar el progreso. Inténtalo de nuevo.')); }}>Reintentar</button></>;
  if (!snapshot) return <PageLoading variant="legacy" />;
  const rank: Record<string, number> = { r: 0, y: 1, g: 2, n: 3 };
  const topics = domainOrder === 'frios' ? [...snapshot.domains].sort((a, b) => rank[a.status] - rank[b.status] || (b.days ?? -1) - (a.days ?? -1)) : snapshot.domains;
  const saveEvolution = (next: Record<string, string | number | boolean>) => { const updated = { ...evolution, ...next }; setEvolution(updated); stats.savePreference('evolution', updated); };
  const formattedDays = (days: number | null) => days === null ? '—' : days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} d`;
  const trend = stats.compareSimulations(firstSimulation, secondSimulation);
  const visibleSimulations = [...snapshot.simulations].reverse();
  return <>
    <h1>Progreso</h1>
    <section id="stats-summary" className="card" aria-label="Resumen de estudio"><h2 className="h3">Tu siguiente paso</h2>
      <p>{snapshot.answers ? `${snapshot.answers} ${snapshot.answers === 1 ? 'respuesta registrada' : 'respuestas registradas'} · ${snapshot.accuracy}% de acierto.` : 'Empieza una sesión para descubrir qué temas necesitas reforzar.'} {snapshot.weakTopics.length ? `Refuerza ${snapshot.weakTopics.map(topic => topic.id).join(', ')}.` : 'El mapa mostrará las prioridades a medida que practiques.'}</p>
      <div className="row"><button className="btn" disabled={!snapshot.reviewLoad[0]} onClick={() => stats.reviewDue()}>Repasar hoy · {snapshot.reviewLoad[0] || 0}</button><button className="btn sec" onClick={() => stats.practiceFailures()}>Preguntas falladas · {snapshot.failureCount}</button><button className="btn sec" onClick={() => stats.practiceTopics()}>Practicar temas</button></div>
    </section>
    <ObservedStudyTimeSummary value={studyTime} loaded={studyActivityLoaded} />
    <div className="seg sticky top-[calc(var(--sat)/var(--z,1))] z-[3] border-b border-line bg-canvas mb-6 py-2.5" role="group" aria-label="Sección de progreso">{([['temas', 'Temas'], ['sims', 'Simulacros'], ['evo', 'Evolución']] as const).map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'temas' && <StatsTopicsSection snapshot={snapshot} stats={stats} topics={topics} domainOrder={domainOrder} setDomainOrder={setDomainOrder} formattedDays={formattedDays} setMessage={setMessage} />}
    {tab === 'sims' && <StatsSimulationSection snapshot={snapshot} visibleSimulations={visibleSimulations} firstSimulation={firstSimulation} secondSimulation={secondSimulation} setFirstSimulation={setFirstSimulation} setSecondSimulation={setSecondSimulation} trend={trend} />}
    {tab === 'evo' && <StatsEvolutionSection snapshot={snapshot} stats={stats} questionWeeks={questionWeeks} weekly={weekly} evolution={evolution} saveEvolution={saveEvolution} onlyCorrect={slowOnlyCorrect} setOnlyCorrect={setSlowOnlyCorrect} setMessage={setMessage} strategy={strategy} setStrategy={setStrategy} strategyDays={strategyDays} setStrategyDays={setStrategyDays} strategyBusy={strategyBusy} setStrategyBusy={setStrategyBusy} />}
      <h2>Últimas sesiones</h2><div className="card">{snapshot.sessions.map(session => <div className="line" key={session.id}><span>{date(session.ts)} · {session.kind === 'sim' ? 'Simulacro' : session.kind === 'rev' ? 'Repaso' : 'Test'} {session.n}p</span><span>{session.scorePending ? 'Nota pendiente' : session.kind === 'sim' ? `${session.nota}/100` : `${Math.round(100 * session.a / Math.max(1, session.n))}%`}</span></div>)}{!snapshot.sessions.length && <p className="sub">Sin sesiones todavía.</p>}</div>
    {message && <p role="status" className="note">{message}</p>}
  </>;
}
