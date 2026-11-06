import { OfficialExamForm } from './OfficialExamForm.js';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStudyService, type SimulationConfiguration, type SimulationExam, type SimulationMilestoneRunOptions, type SimulationTab, type SettingsSnapshot } from '../../shared/ui/study-services.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';

const tabs: readonly [SimulationTab, string][] = [['completo', 'Configurable'], ['oficial2025', 'Oficial 2025'], ['examen', 'Por examen'], ['tema', 'Por tema']];
const origins = [['G', 'Generadas'], ['O', 'Oficiales'], ['A', 'Academia']] as const;
type SimulationGroups = { official: readonly SimulationExam[]; academy: readonly SimulationExam[]; topicTests: readonly SimulationExam[] };

function CompleteSimulationForm({ configuration, seen, starting, update, onBegin, milestone, milestoneRequested }: { configuration: SimulationConfiguration; seen: readonly string[]; starting: boolean; update: (change: Partial<SimulationConfiguration>) => void; onBegin: () => void; milestone?: NonNullable<SettingsSnapshot['training']['calendarEvents']>[number]; milestoneRequested: boolean }) {
  return <>
    {milestoneRequested && !milestone?.simulation ? <p className="note" role="status">Cargando o validando la configuración del hito…</p> : milestone?.simulation ? <section className="card" aria-label="Configuración del hito">
      <h2 className="h3">{milestone.title}</h2>
      <p>{milestone.simulation.questionCount} preguntas · {milestone.simulation.durationMinutes} minutos · {milestone.simulation.optionsPerQuestion} opciones por pregunta.</p>
      <p>Temas marcados como vistos: {seen.length}. Se usarán preguntas del catálogo que coincidan con el número de opciones configurado.</p>
      <p>{milestone.simulation.scoring.wrongPenalty === null
        ? 'La penalización por fallo no está confirmada. El resultado mostrará aciertos, errores y blancos, sin nota neta.'
        : `Regla guardada v${milestone.simulation.version}: +${milestone.simulation.scoring.correctPoints} por acierto, −${milestone.simulation.scoring.wrongPenalty} por fallo, ${milestone.simulation.scoring.blankPoints} por blanco.`}</p>
    </section> : <section className="card">
      <h2 className="h3">Parte 1 · conocimientos</h2>
      <div className="seg" role="group" aria-label="Número de preguntas">{([40, 80] as const).map(count => <button key={count} className={configuration.count === count ? 'on' : ''} aria-pressed={configuration.count === count} onClick={() => {
        const minutes = count === 40 && configuration.minutes > 60 ? 45 : count === 80 && configuration.minutes < 90 ? 90 : configuration.minutes;
        update({ count, minutes });
      }}>{count} preguntas</button>)}</div>
      <h2 className="h3">Tiempo (minutos)</h2>
      <div className="seg" role="group" aria-label="Duración">{([45, 60, 90, 120] as const).map(minutes => <button key={minutes} className={configuration.minutes === minutes ? 'on' : ''} aria-pressed={configuration.minutes === minutes} onClick={() => update({ minutes })}>{minutes}</button>)}</div>
      <h2 className="h3">Temas</h2>
      <div className="seg" role="group" aria-label="Alcance de temas">
        <button className={configuration.scope !== 'todos' ? 'on' : ''} aria-pressed={configuration.scope !== 'todos'} onClick={() => update({ scope: 'vistos' })}>Mis temas vistos ({seen.length})</button>
        <button className={configuration.scope === 'todos' ? 'on' : ''} aria-pressed={configuration.scope === 'todos'} onClick={() => update({ scope: 'todos' })}>Todo el temario</button>
      </div>
      {configuration.scope !== 'todos' && !seen.length && <p className="sub sm">No has marcado ningún tema: se usará todo el temario.</p>}
      <p className="sub sm"><Link to="/temario">Editar temas vistos</Link></p>
      <h2 className="h3">Origen de las preguntas</h2>
      <div className="seg multi" role="group" aria-label="Origen de las preguntas">{origins.map(([origin, label]) => <button key={origin} className={configuration.origins.includes(origin) ? 'on' : ''} aria-pressed={configuration.origins.includes(origin)} onClick={() => {
        const selected = new Set(configuration.origins); if (selected.has(origin)) selected.delete(origin); else selected.add(origin); if (!selected.size) selected.add(origin); update({ origins: [...selected] });
      }}>{label}</button>)}</div>
      <label className="chk"><input type="checkbox" checked={configuration.includeSecondPart} onChange={event => update({ includeSecondPart: event.target.checked })} /> Después, parte 2: elegir 1 de 2 supuestos prácticos (20 preguntas)</label>
    </section>}
    {!(milestoneRequested && !milestone?.simulation) && <div className="note">{milestone?.simulation ? 'Simulacro con corrección al final. La nota no se compara entre reglas de puntuación distintas.' : 'Práctica con reloj y nota independientes por parte. Se da cobertura a los temas seleccionados y se alternan los orígenes disponibles entre preguntas nuevas. Cada fallo resta un tercio de acierto; las respuestas en blanco valen cero.'}</div>}
    {!(milestoneRequested && !milestone?.simulation) && <div className="bar2"><button className="btn" disabled={starting} onClick={onBegin}>{starting ? 'Preparando…' : milestone ? 'Empezar este hito' : 'Empezar simulacro'}</button></div>}
  </>;
}

function ExamBrowser({ tab, loading, starting, filteredGroups, visibleSelection, years, originFilter, turnFilter, yearFilter, setOriginFilter, setTurnFilter, setYearFilter, onSelect, onStudy, onExam }: {
  tab: SimulationTab; loading: boolean; starting: boolean;
  filteredGroups: readonly { title: string; exams: readonly SimulationExam[] }[]; visibleSelection?: string | null; years: readonly string[];
  originFilter: string; turnFilter: string; yearFilter: string;
  setOriginFilter: (value: string) => void; setTurnFilter: (value: string) => void; setYearFilter: (value: string) => void;
  onSelect: (id: string) => void; onStudy: () => void; onExam: () => void;
}) {
  const exams = filteredGroups.flatMap(group => group.exams);
  return <>
    {tab === 'examen' && <section className="card exam-filters">
      <label>Origen<select aria-label="Origen" value={originFilter} onChange={event => setOriginFilter(event.target.value)}><option value="all">Todos</option><option value="official">Oficiales</option><option value="academy">Academia</option></select></label>
      <label>Turno<select aria-label="Turno" value={turnFilter} onChange={event => setTurnFilter(event.target.value)}><option value="all">Todos</option><option value="libre">Ingreso libre</option><option value="promotion">Promoción interna</option></select></label>
      <label>Año en la referencia<select aria-label="Año en la referencia" value={yearFilter} onChange={event => setYearFilter(event.target.value)}><option value="">Todos</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
    </section>}
    <p className="sub sm">Elige uno y contesta solo sus preguntas. Notas sobre 100; cada fallo resta 1/3.</p>
    {loading && <PageLoading variant="content" />}
    {!loading && filteredGroups.map(group => <section key={group.title}><h2 className="h3">{group.title}</h2><div className="exlist">{group.exams.map(exam => <button key={exam.id} data-exam-id={exam.id} className={`exrow ${exam.id === visibleSelection ? 'on' : ''}`} aria-pressed={exam.id === visibleSelection} onClick={() => onSelect(exam.id)}>
      <span><b>{exam.name}</b><small>{exam.questionCount} preguntas{exam.attempts > 1 ? ` · ${exam.attempts} intentos · mejor ${exam.best?.toFixed(1).replace('.', ',')}` : ''}</small></span>
      <em className={`nt ${exam.latest === null ? '' : exam.latest >= 50 ? 'ok' : 'mid'}`}>{exam.latest === null ? 'Sin hacer' : exam.latest.toFixed(1).replace('.', ',')}</em>
    </button>)}</div></section>)}
    {!loading && !exams.length && <p className="note">No hay exámenes con estos filtros. Cambia alguno de los filtros para ver otros exámenes.</p>}
    <div className="bar2"><button className="btn sec" disabled={starting || !visibleSelection} onClick={onStudy}>Estudiar</button><button className="btn" disabled={starting || !visibleSelection} onClick={onExam}>{starting ? 'Preparando…' : 'Examen · 90 min'}</button></div>
  </>;
}

export function SimulationPage() {
  const simulation = useStudyService('simulation');
  const settings = useStudyService('settings');
  const [searchParams] = useSearchParams();
  const milestoneId = searchParams.get('milestone');
  const [settingsSnapshot, setSettingsSnapshot] = useState<SettingsSnapshot>(() => settings.getSnapshot());
  const [tab, setTab] = useState(() => milestoneId ? 'completo' : simulation.getTab());
  const [configuration, setConfiguration] = useState(() => simulation.getConfiguration());
  const [groups, setGroups] = useState<SimulationGroups | null>(null);
  const [selection, setSelection] = useState(() => simulation.getSelectedExam());
  const [originFilter, setOriginFilter] = useState('all');
  const [turnFilter, setTurnFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('');
  const [loading, setLoading] = useState(() => !milestoneId && simulation.getTab() !== 'completo');
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const seen = simulation.seenTopics();
  const milestone = milestoneId ? settingsSnapshot.training.calendarEvents?.find(event => event.id === milestoneId && event.kind === 'milestone') : undefined;

  useEffect(() => {
    let active = true;
    const refresh = () => { if (active) setSettingsSnapshot(settings.getSnapshot()); };
    const unsubscribe = settings.subscribe(refresh);
    void settings.load().then(refresh).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, [settings]);

  useEffect(() => {
    if (tab === 'completo' || tab === 'oficial2025' || groups) return;
    let active = true;
    void simulation.loadExamGroups().then(value => {
      if (!active) return;
      setGroups(value);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setMessage('No se pudieron cargar los exámenes. Comprueba la conexión e inténtalo de nuevo.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [groups, simulation, tab]);

  const filteredGroups = useMemo((): { title: string; exams: readonly SimulationExam[] }[] => {
    if (!groups) return [];
    if (tab === 'tema') return [{ title: 'Tests de la academia', exams: groups.topicTests }];
    const official = groups.official.filter(exam => (turnFilter === 'all' || (turnFilter === 'libre' ? exam.name.startsWith('Ingreso libre') : exam.name.startsWith('Promoción interna'))) && (!yearFilter || exam.name.includes(yearFilter)));
    const academy = groups.academy.filter(exam => turnFilter === 'all' && (!yearFilter || exam.name.includes(yearFilter)));
    const list: { title: string; exams: readonly SimulationExam[] }[] = [];
    if (originFilter !== 'academy' && official.length) list.push({ title: 'Exámenes oficiales', exams: official });
    if (originFilter !== 'official' && academy.length) list.push({ title: 'Simulacros de la academia', exams: academy });
    return list;
  }, [groups, originFilter, tab, turnFilter, yearFilter]);
  const allVisibleExams = filteredGroups.flatMap(group => group.exams);
  const visibleSelection = allVisibleExams.some(exam => exam.id === selection) ? selection : allVisibleExams[0]?.id;
  const years = [...new Set((groups?.official || []).flatMap(exam => exam.name.match(/20\d{2}/g) || []))].sort().reverse();

  const update = (change: Partial<SimulationConfiguration>) => {
    const next = { ...configuration, ...change, origins: [...(change.origins ?? configuration.origins)] };
    simulation.saveConfiguration(next); setConfiguration(next); setMessage('');
  };
  const openTab = (next: SimulationTab) => { setTab(next); simulation.setTab(next); setMessage(''); if (next !== 'completo' && next !== 'oficial2025' && !groups) setLoading(true); };
  const begin = async (run: () => Promise<'started' | 'empty' | 'account-changed'>, emptyMessage = 'No hay preguntas disponibles con estos filtros.') => {
    setStarting(true); setMessage('');
    try { const result = await run();
      if (result === 'empty') setMessage(emptyMessage);
      if (result === 'account-changed') setMessage('La cuenta cambió mientras se preparaba el simulacro. Vuelve a intentarlo.');
    } catch { setMessage('No se pudo preparar el simulacro. Comprueba la conexión e inténtalo de nuevo.'); }
    finally { setStarting(false); }
  };

  return <>
    <h1>Simulacros <HelpIconLink topic="simulacros" label="Ayuda sobre navegación y corrección de simulacros" /></h1>
    {!milestoneId && <div className="seg tabs" role="tablist" aria-label="Tipo de simulacro">
      {tabs.map(([id, label]) => <button key={id} role="tab" className={tab === id ? 'on' : ''} aria-selected={tab === id} onClick={() => openTab(id)}>{label}</button>)}
    </div>}
    {milestoneId && !milestone && <p className="note" role="alert">No se encuentra el hito o no tiene un perfil de simulacro válido. Vuelve a Planificación o configura el evento en Ajustes.</p>}
    {tab === 'oficial2025' ? <OfficialExamForm starting={starting} onBegin={(scenario, quota) => { void begin(() => simulation.startOfficialExam(scenario, quota), 'No se ha podido verificar el cuaderno completo frente a la plantilla definitiva.'); }} /> : tab === 'completo' ? <CompleteSimulationForm configuration={configuration} seen={seen} starting={starting} update={update} milestone={milestone} milestoneRequested={!!milestoneId} onBegin={() => {
      if (milestone?.simulation) {
        const options: SimulationMilestoneRunOptions = { scoringPolicy: milestone.simulation.scoring, optionsPerQuestion: milestone.simulation.optionsPerQuestion, eventId: milestone.id, title: milestone.title };
        const profile = { ...configuration, count: milestone.simulation.questionCount, minutes: milestone.simulation.durationMinutes, scope: 'vistos' as const, includeSecondPart: false };
        void begin(() => simulation.startConfigured(profile, options), 'No hay suficientes preguntas del catálogo con el número de opciones configurado y los temas marcados como vistos.');
      } else void begin(() => simulation.startConfigured(configuration));
    }} /> : <ExamBrowser tab={tab} loading={loading} starting={starting} filteredGroups={filteredGroups} visibleSelection={visibleSelection} years={years} originFilter={originFilter} turnFilter={turnFilter} yearFilter={yearFilter} setOriginFilter={setOriginFilter} setTurnFilter={setTurnFilter} setYearFilter={setYearFilter} onSelect={id => { simulation.selectExam(id); setSelection(id); }} onStudy={() => { if (visibleSelection) void begin(() => simulation.startExam(visibleSelection, 'study')); }} onExam={() => { if (visibleSelection) void begin(() => simulation.startExam(visibleSelection, 'exam')); }} />}
    {message && <p className="card" role="alert">{message}</p>}
  </>;
}
