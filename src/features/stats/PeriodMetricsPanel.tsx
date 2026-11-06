import { CatalogueCoverage } from './CatalogueCoverage.js';
import { TopicPeriodEvidence } from './TopicPeriodEvidence.js';
import { AcademySectionPerformancePanel } from './AcademySectionPerformancePanel.js';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { StatsServices } from '../../shared/ui/study-services.js';
import type { DetailedMetrics } from '../../core/application/stats/detailed-metrics.js';
import { metricsCalendar, presetMetricsQuery, shiftMetricsDate, type MetricsQuery } from '../../core/application/stats/metrics-query.js';
const StatsStudyBars = lazy(() => import('./StatsCharts.js').then(module => ({ default: module.StatsStudyBars })));

type Period = '7' | '30' | 'all' | 'custom';
const percent = (value: number | null) => value === null ? 'Sin respuestas' : `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
const minutes = (value: number) => (value / 60_000).toLocaleString('es-ES', { maximumFractionDigits: 1 });

export function PeriodMetricsPanel({ stats, topics, onQuery }: { stats: StatsServices; topics: readonly { id: string; name: string }[]; onQuery?: (query: MetricsQuery | null) => void }) {
  const [sync, setSync] = useState(() => stats.getSyncSummary?.());
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => stats.onSyncChange?.(() => setSync(stats.getSyncSummary?.())), [stats]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const [now, setNow] = useState(Date.now);
  const [revision, setRevision] = useState(0);
  useEffect(() => stats.onMetricsChange?.(() => { setNow(Date.now()); setRevision(value => value + 1); }), [stats]);
  const [period, setPeriod] = useState<Period>('30');
  const [topicId, setTopicId] = useState('');
  const [mode, setMode] = useState('');
  const [activity, setActivity] = useState('');
  const [weekly, setWeekly] = useState(false);
  const [origin, setOrigin] = useState('');
  const [search, setSearch] = useState('');
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const today = useMemo(() => metricsCalendar(timeZone).dayKey(now), [timeZone, now]);
  const [from, setFrom] = useState(() => shiftMetricsDate(today, -29));
  const [to, setTo] = useState(today);
  const [state, setState] = useState<{ query: MetricsQuery | null; revision?: number; value?: DetailedMetrics; error?: string }>({ query: null });
  const queryState = useMemo(() => {
    try {
      const calendar = metricsCalendar(timeZone);
      const query: MetricsQuery = period === 'custom'
        ? { fromInclusive: calendar.startOfDay(from), toExclusive: Math.min(now + 1, calendar.startOfDay(shiftMetricsDate(to, 1))), timeZone }
        : presetMetricsQuery(period === 'all' ? 'all' : period === '7' ? 7 : 30, now, timeZone);
      if (query.fromInclusive >= query.toExclusive) throw new Error('La fecha inicial debe ser anterior al final del periodo.');
      if (topicId) query.topicId = topicId;
      if (mode === 'practice' || mode === 'simulation') query.mode = mode;
      if (origin) query.origin = origin;
      if (activity === 'questions' || activity === 'attentive-reading') query.activity = activity;
      return { query };
    } catch { return { error: 'Revisa las fechas del periodo.' }; }
  }, [period, from, to, now, timeZone, topicId, mode, origin, activity]);
  useEffect(() => { onQuery?.(queryState.query ?? null); }, [onQuery, queryState]);
  useEffect(() => {
    if (!queryState.query || !stats.loadMetrics) return;
    let active = true;
    const query = queryState.query, account = stats.accountId?.();
    void stats.loadMetrics(query).then(value => {
      if (active && account === stats.accountId?.()) setState({ query, revision, value });
    }, () => { if (active && account === stats.accountId?.()) setState({ query, revision, error: 'No se pudo cargar el historial detallado. Puedes reintentarlo; no se representa como cero.' }); });
    return () => { active = false; };
  }, [queryState, stats, revision]);
  const current = state.query === queryState.query && state.revision === revision;
  const result = current ? state.value : undefined;
  const topicOptions = topics.length ? topics : result?.topics.map(row => ({ id: row.topicId, name: row.topicId })) ?? [];
  const rows = result?.topics.filter(row => `${row.topicId} ${topics.find(topic => topic.id === row.topicId)?.name ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))) ?? [];
  const error = queryState.error ?? (current ? state.error : undefined);
  return <section aria-label="Métricas del periodo" className="card min-w-0">
    <h2>Resumen del periodo</h2>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>label]:min-w-0">
      <label>Periodo<select className="w-full min-w-0 max-w-full" value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="7">7 días, incluido hoy</option><option value="30">30 días, incluido hoy</option><option value="all">Todo el historial</option><option value="custom">Fechas personalizadas</option></select></label>
      <label>Tema del periodo<select className="w-full min-w-0 max-w-full" value={topicId} onChange={event => setTopicId(event.target.value)}><option value="">Todos los temas</option>{topicOptions.map(topic => <option key={topic.id} value={topic.id}>{topic.id} · {topic.name}</option>)}</select></label>
      <label>Modalidad<select className="w-full min-w-0 max-w-full" value={mode} onChange={event => setMode(event.target.value)}><option value="">Práctica y simulacro</option><option value="practice">Práctica</option><option value="simulation">Simulacro finalizado</option></select></label>
      <label>Origen del periodo<select className="w-full min-w-0 max-w-full" value={origin} onChange={event => setOrigin(event.target.value)}><option value="">Todos los orígenes</option><option value="O">Oficial</option><option value="A">Academia</option><option value="G">Generado</option></select></label>
      <label>Actividad medida<select className="w-full min-w-0 max-w-full" value={activity} onChange={event => setActivity(event.target.value)}><option value="">Todas las actividades medidas</option><option value="questions">Preguntas</option><option value="attentive-reading">Lectura atenta de preguntas</option></select></label>
    </div>
    {period === 'custom' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Desde<input className="w-full min-w-0 max-w-full" type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label><label>Hasta, incluido<input className="w-full min-w-0 max-w-full" type="date" value={to} max={today} min={from} onChange={event => setTo(event.target.value)} /></label></div>}
    <p className="legend">Zona horaria: {timeZone}. Hoy está incompleto; el intervalo termina en la hora de consulta. Datos disponibles de esta cuenta en este dispositivo, incluidos los recibidos por sincronización. No acredita historial completo de otros dispositivos.</p>
    <p role="status" className="legend">{!online ? 'Sin conexión: se usa el historial disponible en este dispositivo.' : sync?.error ? 'La sincronización tiene un error; el historial local sigue disponible.' : sync?.configured ? `Sincronización de cuenta: ${sync.state}.` : 'Historial local; sin sincronización configurada.'} <a href="#/settings">Ver estado en Ajustes</a></p>
    <button type="button" className="btn sec" onClick={() => { setNow(Date.now()); setRevision(value => value + 1); }}>Actualizar métricas</button>
    {error ? <p role="alert">{error}</p> : !result ? <p role="status">Cargando métricas del periodo…</p> : <>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 [&_.stat]:min-w-0 [&_.stat]:break-words">
        <div className="stat"><b>{result.observedMilliseconds ? `${minutes(result.observedMilliseconds)} min` : 'Sin tiempo medible'}</b><span>Tiempo observado</span></div>
        <div className="stat"><b>{result.completedSessions}</b><span>Sesiones completadas con actividad</span></div>
        <div className="stat"><b>{result.recent.distinctQuestions}</b><span>Preguntas distintas respondidas</span></div>
        <div className="stat"><b>{percent(result.accuracy.value)}</b><span>Acierto ordinario · {result.accuracy.observed} respuestas</span></div>
        <div className="stat"><b>{result.activeDays}</b><span>Días con actividad registrada</span></div>
      </div>
      {result.comparison && <p>Comparación de días completos, excluyendo hoy: {result.comparison.percentagePoints === null ? 'Sin muestra en ambos periodos para calcular un cambio.' : `${result.comparison.percentagePoints > 0 ? '+' : ''}${result.comparison.percentagePoints.toLocaleString('es-ES', { maximumFractionDigits: 1 })} puntos porcentuales de acierto.`} Muestras: {result.comparison.current.observed} y {result.comparison.previous.observed} respuestas. Mismos filtros; la composición de las preguntas puede variar.</p>}
      {result.coverage.earliest !== null && <p className="legend">Respuestas fechadas observadas entre {new Date(result.coverage.earliest).toLocaleString('es-ES', { timeZone })} y {new Date(result.coverage.latest ?? result.coverage.earliest).toLocaleString('es-ES', { timeZone })}. No demuestra que el historial esté completo. Consulta calculada: {new Date(result.generatedAt).toLocaleString('es-ES', { timeZone })}.</p>}
      <p>Último resultado ordinario dentro del periodo: {result.recent.correct} aciertos y {result.recent.wrong} fallos entre {result.recent.distinctQuestions} preguntas distintas. {result.recent.distinctQuestions < 5 ? 'Poca evidencia: menos de 5 preguntas distintas.' : ''}</p>
      <p>{result.counts.immediateRetries} reintentos inmediatos aparte · {result.counts.revealed} soluciones reveladas · {result.counts.pending} pendientes · {result.counts.abandoned} sin respuesta al cerrar · {result.counts.blanks} blancos de simulacro finalizado.</p>
      <p className="legend">El tiempo requiere intervalos cerrados y relojes compatibles; se recorta al periodo y se unen solapamientos. No incluye lectura externa, tiempo manual ni duración histórica de sesiones. {result.overlapMilliseconds > 0 ? `${minutes(result.overlapMilliseconds)} min simultáneos se contaron una sola vez.` : ''} {result.coverage.partialIntervals} registros con medición parcial; {minutes(result.coverage.unplacedMilliseconds)} min sin ubicación temporal fiable, excluidos del total del periodo. {result.coverage.fallbackDates} respuestas usan fecha de cierre por falta del evento terminal.</p>
      <h3>Planificación registrada</h3>
      {result.planning?.rows.length ? <p>{result.planning.rows.length} sesiones planificadas completadas con presupuesto conservado: {result.planning.plannedMinutes} min previstos y {minutes((result.planning.elapsedSeconds ?? 0) * 1000)} min transcurridos en sus checkpoints. Este tiempo no se suma al observado; puede describir las mismas actividades. La muestra excluye días sin checkpoint completado y no demuestra cumplimiento de todo el plan.</p> : <p>No hay objetivos históricos compatibles con estos filtros. Las preferencias actuales no se aplican retroactivamente.</p>}
      <h3>Estudio registrado</h3>
      <ul>{result.activities.map(row => <li key={row.activity}>{row.activity === 'attentive-reading' ? 'Lectura atenta de preguntas' : 'Preguntas'}: {minutes(row.observedMilliseconds)} min observados</li>)}</ul>
      {result.activityOverlapMilliseconds > 0 && <p>Distribución no sumable: {minutes(result.activityOverlapMilliseconds)} min coinciden entre actividades; el total los cuenta una sola vez.</p>}
      <label><input type="checkbox" checked={weekly} onChange={event => setWeekly(event.target.checked)} />Agrupar por semanas, desde el lunes</label>
      <Suspense fallback={<p role="status">Preparando gráfico…</p>}><StatsStudyBars days={weekly ? result.weeks : result.days} label={weekly ? 'Minutos observados por semana' : 'Minutos observados por día'} /></Suspense>
      <div className="max-w-full overflow-x-auto overscroll-x-contain" role="region" aria-label="Tabla de métricas" tabIndex={0}><table><caption>Los mismos datos del gráfico; {weekly ? 'semanas desde el lunes' : 'días naturales'}. Fechas sin registro omitidas, no equivalen a no estudiar.</caption><thead><tr><th scope="col">{weekly ? 'Semana desde el lunes' : 'Día'}</th><th scope="col">Minutos observados</th><th scope="col">Aciertos</th><th scope="col">Fallos</th></tr></thead><tbody>{(weekly ? result.weeks : result.days).map(day => <tr key={day.date}><th scope="row">{day.date}</th><td>{minutes(day.observedMilliseconds)}</td><td>{day.correct}</td><td>{day.wrong}</td></tr>)}</tbody></table></div>
      {!result.days.length && <p>Sin actividad detallada para estos filtros. Los agregados antiguos pueden seguir disponibles debajo.</p>}
      <h3>Temas con evidencia del periodo</h3>
      <label>Buscar en resultados<input className="w-full min-w-0 max-w-full" type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="max-w-full overflow-x-auto overscroll-x-contain" role="region" aria-label="Tabla de métricas" tabIndex={0}><table><caption>Orden por preguntas distintas con último fallo, recencia e ID. Los resultados no representan dominio.</caption><thead><tr><th scope="col">Tema</th><th scope="col">Preguntas distintas</th><th scope="col">Respuestas ordinarias</th><th scope="col">Acierto</th><th scope="col">Últimos fallos</th><th scope="col">Tiempo observado</th><th scope="col">Última respuesta</th><th scope="col">Evidencia y acción</th></tr></thead><tbody>{rows.map(row => <tr key={row.topicId}><th scope="row">{row.topicId} · {topics.find(topic => topic.id === row.topicId)?.name}<br />{row.distinctQuestions < 5 && <small>Poca evidencia</small>}</th><td>{row.distinctQuestions ? `${row.distinctQuestions} / ${row.catalogueQuestions} indexadas` : 'No practicado en el historial detallado'}</td><td>{row.correct + row.wrong}</td><td>{percent(row.accuracy.value)}</td><td>{row.latestWrong} / {row.distinctQuestions}</td><td>{row.observedMilliseconds ? `${minutes(row.observedMilliseconds)} min` : 'Sin tiempo medible'}</td><td>{row.lastPracticeAt === null ? 'Sin respuesta registrada' : new Date(row.lastPracticeAt).toLocaleDateString('es-ES', { timeZone })}</td><td><TopicPeriodEvidence key={JSON.stringify(result.query)} questions={row.questions} stats={stats} /><button className="btn sec" onClick={() => stats.practiceTopics([row.topicId], origin === 'O' || origin === 'A' || origin === 'G' ? origin : undefined)}>Practicar el tema completo</button></td></tr>)}</tbody></table></div>
      <CatalogueCoverage key={`${JSON.stringify(result.query)}:${result.generatedAt}`} stats={stats} query={result.query} practicedIds={result.topics.flatMap(row => row.questions.map(question => question.questionId))} />
      <AcademySectionPerformancePanel key={JSON.stringify(queryState.query)} stats={stats} query={queryState.query} />
      <p className="legend">Conceptos y confusiones: no hay catálogo editorial revisado publicado. No se infieren causas de error a partir de etiquetas o palabras parecidas.</p>
      <p className="legend">Catálogo indexado {result.catalogueRevision}: {result.catalogue.practiced} preguntas practicadas / {result.catalogue.eligible} IDs canónicos del filtro ({percent(result.catalogue.coveragePercent)}). La elegibilidad específica de cada examen se comprueba al iniciarlo. No es cobertura curricular ni de vinculación aprobada.</p>
    </>}
  </section>;
}
